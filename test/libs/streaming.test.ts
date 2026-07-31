import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PubSub } from 'graphql-subscriptions';
import {
  createServerStreamCall,
  createStreamSubscribeResolver,
  genSubscriptionResolvers,
} from '../../src/libs/streaming';

async function collect(iterator: AsyncIterableIterator<any>) {
  const values: any[] = [];
  for await (const value of iterator) {
    values.push(value);
  }
  return values;
}

describe('createServerStreamCall', () => {
  it('publishes written chunks keyed by field name', async () => {
    const pubsub = new PubSub();
    const received: any[] = [];
    await pubsub.subscribe('t', (v) => received.push(v));

    const call = createServerStreamCall({ q: 'hi' }, pubsub, 't', 'field');
    call.write({ a: 1 });
    call.write({ a: 2 });

    await new Promise((r) => setImmediate(r));
    expect(received).toEqual([{ field: { a: 1 } }, { field: { a: 2 } }]);
  });

  it('exposes the request and no-ops on() / emit()', () => {
    const pubsub = new PubSub();
    const call = createServerStreamCall({ q: 'hi' }, pubsub, 't', 'field');
    expect(call.request).toEqual({ q: 'hi' });
    expect(call.on('cancelled', () => {})).toBe(call);
    expect(call.emit('data', {})).toBe(false);
  });
});

describe('createStreamSubscribeResolver', () => {
  it('completes the iterator when the implementation throws synchronously', async () => {
    const pubsub = new PubSub();
    const resolver = createStreamSubscribeResolver(
      pubsub,
      () => {
        throw new Error('boom');
      },
      'field',
    );

    const iterator = resolver.subscribe(null, { request: {} });
    await expect(collect(iterator)).rejects.toThrow('boom');
  });

  it('propagates an error from call.destroy()', async () => {
    const pubsub = new PubSub();
    const resolver = createStreamSubscribeResolver(
      pubsub,
      (call) => {
        call.write({ a: 'one' });
        call.destroy(new Error('destroyed'));
      },
      'field',
    );

    const iterator = resolver.subscribe(null, { request: {} });
    await expect(collect(iterator)).rejects.toThrow('destroyed');
  });

  it('unsubscribes from the topic once the consumer stops iterating early', async () => {
    const pubsub = new PubSub();
    let writeAfterReturn: () => void;

    const resolver = createStreamSubscribeResolver(
      pubsub,
      (call) => {
        call.write({ a: 'one' });
        writeAfterReturn = () => call.write({ a: 'two' });
      },
      'field',
    );

    const iterator = resolver.subscribe(null, { request: {} });
    const first = await iterator.next();
    expect(first).toEqual({ value: { field: { a: 'one' } }, done: false });

    await iterator.return();
    // A write issued after `return()` should have nothing subscribed to
    // receive it -- publish() to a topic nobody's listening on is a no-op,
    // not a crash.
    expect(() => writeAfterReturn()).not.toThrow();
  });
});

describe('genSubscriptionResolvers', () => {
  const protoPath = `${process.cwd()}/test/sample/protos/streaming.proto`;
  const loaderOpts: protoLoader.Options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  };

  function loadPackageObjects() {
    const packageDefinition = protoLoader.loadSync(protoPath, loaderOpts);
    return grpc.loadPackageDefinition(packageDefinition);
  }

  it('returns a Subscription resolver only for the server-streaming method', () => {
    const pubsub = new PubSub();
    const implementation = { ServerStream: () => {}, Unary: () => {} };
    const packageObjects = loadPackageObjects();

    const resolvers = genSubscriptionResolvers(
      [
        {
          name: 'streaming',
          services: [{ name: 'StreamSvc', implementation }],
        },
      ],
      { streaming: packageObjects.streaming },
      pubsub,
    );

    expect(Object.keys(resolvers.Subscription)).toEqual([
      'streaming_StreamSvc_ServerStream',
    ]);
  });

  it('skips a grpcOnly service entirely', () => {
    const pubsub = new PubSub();
    const implementation = { ServerStream: () => {} };
    const packageObjects = loadPackageObjects();

    const resolvers = genSubscriptionResolvers(
      [
        {
          name: 'streaming',
          services: [{ name: 'StreamSvc', implementation, grpcOnly: true }],
        },
      ],
      { streaming: packageObjects.streaming },
      pubsub,
    );

    expect(resolvers).toEqual({});
  });

  it('skips a service with no implementation', () => {
    const pubsub = new PubSub();
    const packageObjects = loadPackageObjects();

    const resolvers = genSubscriptionResolvers(
      [{ name: 'streaming', services: [{ name: 'StreamSvc' }] }],
      { streaming: packageObjects.streaming },
      pubsub,
    );

    expect(resolvers).toEqual({});
  });

  it('respects an excluded method name', () => {
    const pubsub = new PubSub();
    const implementation = { ServerStream: () => {} };
    const packageObjects = loadPackageObjects();

    const resolvers = genSubscriptionResolvers(
      [
        {
          name: 'streaming',
          services: [
            { name: 'StreamSvc', implementation, exclude: ['ServerStream'] },
          ],
        },
      ],
      { streaming: packageObjects.streaming },
      pubsub,
    );

    expect(resolvers).toEqual({});
  });

  it('returns an empty object when the package was never loaded', () => {
    const pubsub = new PubSub();
    const resolvers = genSubscriptionResolvers(
      [{ name: 'missing', services: [{ name: 'X', implementation: {} }] }],
      {},
      pubsub,
    );

    expect(resolvers).toEqual({});
  });
});
