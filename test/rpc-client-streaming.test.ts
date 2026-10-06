import {
  RPCServer,
  RPCClient,
  initRPCClient,
  gRPCServiceClients,
} from '../src';
import StreamSvcImpl from './sample/stream-svc';

describe('Test RPCClient streaming call support', () => {
  let rpcServer: RPCServer;
  let rpcClientInstance: RPCClient;
  let rpcClient: gRPCServiceClients;

  it('should start gRPC server', (done) => {
    rpcServer = new RPCServer({
      port: 50055,
      grpc: {
        protoFile: `${__dirname}/sample/protos/streaming.proto`,
        packages: [
          {
            name: 'streaming',
            services: [
              { name: 'StreamSvc', implementation: new StreamSvcImpl() },
            ],
          },
        ],
      },
    });

    rpcServer.once('grpc_server_started', () => done());
  });

  it('should create grpc client', () => {
    // `originalClass: true` returns the `RPCClient` instance itself (rather
    // than just its `.clients` map), so we can listen for the
    // `grpc_client_error` event, which is emitted on the instance.
    rpcClientInstance = initRPCClient({
      protoFile: `${__dirname}/sample/protos/streaming.proto`,
      packages: [
        {
          name: 'streaming',
          services: [{ name: 'StreamSvc', port: 50055 }],
        },
      ],
      originalClass: true,
    });
    rpcClient = rpcClientInstance.clients;

    expect(rpcClient).toHaveProperty('streaming.StreamSvc');
  });

  it('initRPCClient without originalClass returns the .clients map directly', () => {
    const plainClient = initRPCClient({
      protoFile: `${__dirname}/sample/protos/streaming.proto`,
      packages: [
        {
          name: 'streaming',
          services: [{ name: 'StreamSvc', port: 50055 }],
        },
      ],
    });

    expect(plainClient).toHaveProperty('streaming.StreamSvc');
    expect(plainClient).not.toHaveProperty('on');
    plainClient.streaming.StreamSvc.close();
  });

  it('calls a unary method exactly as before (regression)', async () => {
    const response = await rpcClient.streaming.StreamSvc.Unary({ q: 'x' });
    expect(response).toHaveProperty('a', 'echo:x');
  });

  it('calls a unary method with a callback exactly as before (regression)', (done) => {
    rpcClient.streaming.StreamSvc.Unary(
      { q: 'y' },
      (err: any, response: any) => {
        expect(err).toBeNull();
        expect(response).toHaveProperty('a', 'echo:y');
        done();
      },
    );
  });

  it('collects a server-streaming response via the async iterator', async () => {
    const call = rpcClient.streaming.StreamSvc.ServerStream({ q: 'z' });
    const values: any[] = [];

    for await (const chunk of call as any) {
      values.push(chunk);
    }

    expect(values).toEqual([{ a: 'z-1' }, { a: 'z-2' }, { a: 'z-3' }]);
  });

  it('collects a server-streaming response via data/end events', (done) => {
    const call: any = rpcClient.streaming.StreamSvc.ServerStream({ q: 'w' });
    const values: any[] = [];

    call.on('data', (chunk: any) => values.push(chunk));
    call.on('end', () => {
      expect(values).toEqual([{ a: 'w-1' }, { a: 'w-2' }, { a: 'w-3' }]);
      done();
    });
  });

  it('passes the opts.metadata array convenience through on a streaming call', (done) => {
    const call: any = rpcClient.streaming.StreamSvc.ServerStream(
      { q: 'tagged' },
      { metadata: [['x-test', 'meta']] },
    );
    const values: any[] = [];

    call.on('data', (chunk: any) => values.push(chunk));
    call.on('end', () => {
      expect(values).toEqual([
        { a: 'meta:tagged-1' },
        { a: 'meta:tagged-2' },
        { a: 'meta:tagged-3' },
      ]);
      done();
    });
  });

  it('sends a client-streaming request and gets the response via callback', (done) => {
    const call: any = rpcClient.streaming.StreamSvc.ClientStream(
      (err: any, response: any) => {
        expect(err).toBeNull();
        expect(response).toHaveProperty('a', 'a,b');
        done();
      },
    );

    call.write({ q: 'a' });
    call.write({ q: 'b' });
    call.end();
  });

  it('sends a client-streaming request and awaits the thenable stream', async () => {
    const call: any = rpcClient.streaming.StreamSvc.ClientStream();

    call.write({ q: 'c' });
    call.write({ q: 'd' });
    call.end();

    const response = await call;
    expect(response).toHaveProperty('a', 'c,d');
  });

  it('propagates a client-streaming error via callback and fires grpc_client_error', (done) => {
    const errorHandler = (details: any) => {
      expect(details.error.message).toMatch(
        /client-stream failed intentionally/,
      );
      expect(details.call).toEqual({
        service: 'StreamSvc',
        function: 'ClientStream',
        request: undefined,
      });
      rpcClientInstance.removeListener('grpc_client_error', errorHandler);
      done();
    };
    rpcClientInstance.on('grpc_client_error', errorHandler);

    const call: any = rpcClient.streaming.StreamSvc.ClientStream((err: any) => {
      expect(err).toBeDefined();
      expect(err.message).toMatch(/client-stream failed intentionally/);
    });

    call.write({ q: 'FAIL' });
    call.end();
  });

  it('propagates a client-streaming error via the awaited thenable stream', async () => {
    const call: any = rpcClient.streaming.StreamSvc.ClientStream();
    call.write({ q: 'FAIL' });
    call.end();

    await expect(call).rejects.toThrow(/client-stream failed intentionally/);
  });

  it('exchanges messages over a bidi-streaming call', (done) => {
    const call: any = rpcClient.streaming.StreamSvc.BidiStream();
    const values: any[] = [];

    call.on('data', (chunk: any) => values.push(chunk));
    call.on('end', () => {
      expect(values).toEqual([{ a: 'echo:e' }, { a: 'echo:f' }]);
      done();
    });

    call.write({ q: 'e' });
    call.write({ q: 'f' });
    call.end();
  });

  it('should close RPC Client', () => {
    rpcClient.streaming.StreamSvc.close();
  });

  it('should try shutdown RPC Server', async () => {
    await rpcServer.tryShutdown();
  });
});
