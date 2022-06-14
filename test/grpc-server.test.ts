import { RPCServer } from '../src';
import Hello from './sample/hello';

describe('Test gRPC-GraphQL Server', () => {
  let rpcServer: RPCServer;

  const methods = {
    hello: new Hello(),
  };

  it('should start gRPC server without GraphQL', (done) => {
    rpcServer = new RPCServer({
      port: 0,
      graphql: false,
      grpc: {
        protoFile: `${__dirname}/../examples/protos/hello.proto`,
        packages: [
          {
            name: 'helloworld',
            services: [
              {
                name: 'Greeter',
                implementation: methods.hello,
              },
            ],
          },
        ],
      },
    });

    expect(rpcServer).toBeDefined();

    rpcServer.once('grpc_server_started', async (payload) => {
      expect(payload.port).toBeDefined();
      done();
    });
  });

  it('should force shutdown RPC Server', async () => {
    await rpcServer.forceShutdown();
  });
});
