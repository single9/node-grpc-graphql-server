import { RPCServer } from '../../src';
import Calculator from '../sample/calculator';
import Hello from '../sample/hello';

describe('Test libs/rpc-server', () => {
  let rpcServer: RPCServer;

  it('should throw error if graphql and generatedCode both are set', () => {
    expect(() => {
      new RPCServer({
        port: 0,
        graphql: true,
        grpc: {
          protoFile: `${__dirname}/../../examples/protos`,
          generatedCode: {
            outDir: `${__dirname}/grpc-pb`,
          },
          packages: {
            helloworld: {
              Greeter: {
                implementation: new Hello(),
              },
            },
          },
        },
      });
    }).toThrowError(
      'GraphQL and generated gRPC code cannot be used at the same time.',
    );
  });

  it('should create server with custom graphql schema and resolvers', (done) => {
    const server = new RPCServer({
      port: 0,
      graphql: {
        enable: true,
        schemaPath: `${__dirname}/../../examples/helloworld-with-gql/schema`,
        resolverPath: `${__dirname}/../../examples/helloworld-with-gql/controllers/graphql`,
      },
      grpc: {
        protoFile: `${__dirname}/../../examples/protos`,
        packages: {
          helloworld: {
            Greeter: {
              implementation: new Hello(),
            },
          },
        },
      },
    });

    expect(server).toBeDefined();
    expect(server.gqlConfigs.schema).toBeDefined();

    server.once('grpc_server_started', async () => {
      await server.forceShutdown();
      done();
    });
  });

  it('should create server with custom graphql schema and resolvers (array path)', (done) => {
    const server = new RPCServer({
      port: 0,
      graphql: {
        enable: true,
        schemaPath: [`${__dirname}/../../examples/helloworld-with-gql/schema`],
        resolverPath: [
          `${__dirname}/../../examples/helloworld-with-gql/controllers/graphql`,
        ],
      },
      grpc: {
        protoFile: `${__dirname}/../../examples/protos`,
        packages: {
          helloworld: {
            Greeter: {
              implementation: new Hello(),
            },
          },
        },
      },
    });

    expect(server).toBeDefined();
    expect(server.gqlConfigs.schema).toBeDefined();

    server.once('grpc_server_started', async () => {
      await server.forceShutdown();
      done();
    });
  });

  it('should start gRPC server without GraphQL and use object params', (done) => {
    const calculator = new Calculator();

    rpcServer = new RPCServer({
      port: 0,
      grpc: {
        protoFile: `${__dirname}/../../examples/protos`,
        generatedCode: {
          outDir: `${__dirname}/../../examples/generated-grpc-code/grpc-pb`,
        },
        packages: {
          helloworld: {
            Greeter: {
              implementation: new Hello(),
            },
          },
          calculator: {
            Simple: {
              implementation: calculator,
            },
            Complex: {
              implementation: calculator,
            },
          },
        },
      },
    });

    expect(rpcServer).toBeDefined();

    rpcServer.once('grpc_server_started', async () => {
      done();
    });
  });

  it('should force shutdown RPC Server', async () => {
    await rpcServer.forceShutdown();
  });
});
