import { gRPCServiceClients, initRPCClient, RPCServer } from '../src';
import Hello from './sample/hello';

describe('Test gRPC-GraphQL Server', () => {
  let rpcServer: RPCServer;
  let rpcClient: gRPCServiceClients;
  let port: number;

  it('should start gRPC server without GraphQL and use object params', (done) => {
    rpcServer = new RPCServer({
      port: 0,
      grpc: {
        protoFile: `${__dirname}/../examples/protos/hello.proto`,
        packages: {
          helloworld: {
            Greeter: {
              implementation: new Hello(),
            },
          },
        },
      },
    });

    expect(rpcServer).toBeDefined();

    rpcServer.once('grpc_server_started', async (payload) => {
      port = payload.port;
      done();
    });
  });

  it('should create grpc client and use object params', (done) => {
    rpcClient = initRPCClient({
      protoFile: `${__dirname}/../examples/protos/hello.proto`,
      packages: {
        helloworld: {
          Greeter: {
            port,
          },
        },
      },
    });

    expect(rpcClient).toBeDefined();
    expect(rpcClient).toHaveProperty('helloworld.Greeter');

    done();
  });

  it('should call `SayHello` and receive data (callback)', (done) => {
    rpcClient.helloworld.Greeter.SayHelloAgain(
      { name: 'test again' },
      (err, response) => {
        expect(err).toBeNull();
        expect(response).toBeDefined();
        done();
      },
    );
  });

  it('should call and receive data (async)', async () => {
    const name = 'Test';
    const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({
      name,
    });

    expect(sayHelloResponse).toBeDefined();
    expect(sayHelloResponse).toHaveProperty('message', `Hello ${name}`);
  });

  it('should force shutdown RPC Server', async () => {
    await rpcServer.forceShutdown();
  });

  it('should close RPC Client', (done) => {
    rpcClient.helloworld.Greeter.close();
    done();
  });
});
