import { PubSubEngine } from 'graphql-subscriptions';
import { RPCServicePackages, ServicesDescriptor } from './rpc-service';
import { replacePackageName, subscriptionFieldName } from './tools';

type StreamControlPayload = {
  __streamControl: 'end' | 'error';
  error?: Error;
};

function isStreamControl(payload: any): payload is StreamControlPayload {
  return !!payload && payload.__streamControl !== undefined;
}

let topicCounter = 0;

function uniqueTopic(fieldName: string) {
  topicCounter += 1;
  return `${fieldName}:${Date.now()}:${topicCounter}`;
}

/**
 * A `pubsub.subscribe(topic, onMessage)`-backed async iterator, subscribing
 * *eagerly* (synchronously, at construction time) rather than lazily on the
 * first `.next()` call like `PubSubEngine#asyncIterableIterator()` does.
 *
 * That laziness matters here: `PubSub#subscribe`'s listener registration
 * happens synchronously, but it's only reached the first time `.next()` is
 * called, which — for a fire-and-forget `subscribe()` resolver that
 * synchronously invokes a streaming implementation — is too late. A gRPC
 * streaming implementation that calls `call.write()` synchronously (common
 * for small/fixed responses) would have its first event(s) published before
 * anyone is listening and silently dropped. Subscribing up front avoids that
 * race. (Verified directly: `asyncIterableIterator()` drops synchronous
 * publishes issued before the first `.next()`; this does not.)
 */
function createTopicIterator(
  pubsub: PubSubEngine,
  topic: string,
): AsyncIterableIterator<any> {
  const pullQueue: Array<(result: IteratorResult<any>) => void> = [];
  const pushQueue: any[] = [];
  let listening = true;

  const pushValue = (event: any) => {
    if (pullQueue.length !== 0) {
      const resolve = pullQueue.shift();
      resolve(
        listening
          ? { value: event, done: false }
          : { value: undefined, done: true },
      );
    } else {
      pushQueue.push(event);
    }
  };

  const subscriptionIdPromise = pubsub.subscribe(topic, pushValue, {});

  const emptyQueue = async () => {
    if (!listening) return;
    listening = false;
    pullQueue.forEach((resolve) => resolve({ value: undefined, done: true }));
    pullQueue.length = 0;
    pushQueue.length = 0;
    pubsub.unsubscribe(await subscriptionIdPromise);
  };

  return {
    next() {
      if (pushQueue.length !== 0) {
        return Promise.resolve(
          listening
            ? { value: pushQueue.shift(), done: false }
            : { value: undefined, done: true },
        );
      }
      return new Promise((resolve) => pullQueue.push(resolve));
    },
    async return() {
      await emptyQueue();
      return { value: undefined, done: true };
    },
    async throw(err) {
      await emptyQueue();
      throw err;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

/**
 * Wraps `createTopicIterator()` to translate the `call.end()`/`destroy()`
 * control sentinel (an otherwise ordinary-looking value on the same topic)
 * into a real completed/errored iterator, instead of leaving the GraphQL
 * subscription looking like it hangs forever once the underlying gRPC
 * stream has actually finished.
 */
function createStreamIterator(
  pubsub: PubSubEngine,
  topic: string,
): AsyncIterableIterator<any> {
  const raw = createTopicIterator(pubsub, topic);
  let ended = false;

  return {
    async next() {
      if (ended) return { value: undefined, done: true };

      const result = await raw.next();

      if (result.done) {
        ended = true;
        return result;
      }

      if (isStreamControl(result.value)) {
        ended = true;
        await raw.return();

        if (result.value.__streamControl === 'error') {
          throw result.value.error;
        }

        return { value: undefined, done: true };
      }

      return result;
    },
    async return() {
      ended = true;
      return raw.return();
    },
    async throw(err) {
      ended = true;
      return raw.throw(err);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

/**
 * Synthetic gRPC server-streaming `call` object. Real implementations are
 * written as `(call) => { call.write(x); call.end(); }` with no callback —
 * this reproduces just enough of that surface to drive a PubSub topic
 * instead of a real wire connection, so the same implementation function
 * works unmodified whether invoked by the real gRPC server or by a GraphQL
 * subscription.
 */
export function createServerStreamCall(
  request: any,
  pubsub: PubSubEngine,
  topic: string,
  fieldName: string,
) {
  return {
    request,
    write(chunk: any) {
      pubsub.publish(topic, { [fieldName]: chunk });
    },
    end() {
      pubsub.publish(topic, { __streamControl: 'end' });
    },
    destroy(err?: Error) {
      pubsub.publish(topic, {
        __streamControl: 'error',
        error: err || new Error('stream destroyed'),
      });
    },
    // Minimal `grpc.ServerWritableStream`-compatible surface. Real
    // cancellation propagation (a client unsubscribing stopping the
    // implementation from writing further) is a known follow-up, not wired
    // up here — an implementation that keeps writing after nobody's
    // listening just publishes into the void (harmless, wasted work).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    on(...args: any[]) {
      return this;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emit(...args: any[]) {
      return false;
    },
  };
}

/**
 * Builds the `{subscribe}` resolver for a server-streaming RPC field.
 */
export function createStreamSubscribeResolver(
  pubsub: PubSubEngine,
  implementationFn: (call: any) => any,
  fieldName: string,
) {
  return {
    subscribe(_parent: any, args: any) {
      const topic = uniqueTopic(fieldName);
      const iterator = createStreamIterator(pubsub, topic);

      try {
        implementationFn(
          createServerStreamCall(
            args && args.request,
            pubsub,
            topic,
            fieldName,
          ),
        );
      } catch (err) {
        pubsub.publish(topic, { __streamControl: 'error', error: err });
      }

      return iterator;
    },
  };
}

/**
 * Generates `Subscription` resolvers for every server-streaming RPC.
 * Mirrors `genResolverType`/`genResolvers` (tools.ts), but — unlike
 * query/mutate — needs the *loaded* package objects (not just the user's
 * config) to check `requestStream`/`responseStream`, since those flags only
 * exist on the loaded service descriptor, not the config.
 */
export function genSubscriptionResolvers(
  packages: RPCServicePackages[],
  packageObjects: { [packageName: string]: any },
  pubsub: PubSubEngine,
) {
  const subscription: { [fieldName: string]: any } = {};

  packages.forEach((pack) => {
    const packageObj = packageObjects[replacePackageName(pack.name)];
    if (!packageObj) return;

    (pack.services as ServicesDescriptor[]).forEach((service) => {
      if (service.grpcOnly || !service.implementation) return;

      const serviceObj = packageObj[service.name];
      if (!serviceObj || !serviceObj.service) return;

      Object.keys(serviceObj.service).forEach((methodName) => {
        if (service.exclude && service.exclude.indexOf(methodName) >= 0) {
          return;
        }

        const methodDescriptor = serviceObj.service[methodName];

        if (
          !methodDescriptor.responseStream ||
          methodDescriptor.requestStream
        ) {
          return;
        }

        const fieldName = subscriptionFieldName(
          pack.name,
          service.name,
          methodName,
        );

        subscription[fieldName] = createStreamSubscribeResolver(
          pubsub,
          service.implementation[methodName].bind(service.implementation),
          fieldName,
        );
      });
    });
  });

  return Object.keys(subscription).length > 0
    ? { Subscription: subscription }
    : {};
}
