import * as grpc from '@grpc/grpc-js';
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

  it('should register extServices once across multiple packages', (done) => {
    const extService: grpc.ServiceDefinition = {
      Ping: {
        path: '/ext.Ext/Ping',
        requestStream: false,
        responseStream: false,
        requestSerialize: (v: any) => v,
        requestDeserialize: (v: any) => v,
        responseSerialize: (v: any) => v,
        responseDeserialize: (v: any) => v,
      },
    };

    // Regression test: extServices used to be added once per package, so
    // grpc-js threw on the second package's duplicate registration.
    const multiServer = new RPCServer({
      port: 0,
      grpc: {
        protoFile: `${__dirname}/../../examples/protos`,
        packages: {
          helloworld: { Greeter: { implementation: new Hello() } },
          calculator: { Simple: { implementation: new Calculator() } },
        },
        extServices: [
          { service: extService, implementation: { Ping: () => {} } },
        ],
      },
    });

    multiServer.once('grpc_server_started', async () => {
      await multiServer.forceShutdown();
      done();
    });
  });

  it('should start a GraphQL server for a service with only a streaming method', (done) => {
    // Regression test: TickerSvc has exactly one method (Watch), and it's
    // server-streaming, so it contributes nothing to Query/Mutation. This
    // used to crash server startup two different ways: (1) the converter
    // left a dangling reference to an empty `TickerSvc_query`/`ticker_query`
    // type, and (2) even after fixing that, the auto-generated Query/Mutation
    // resolvers (computed independently of the schema) still referenced a
    // `ticker` field that no longer existed in the schema.
    const streamServer = new RPCServer({
      port: 0,
      graphql: true,
      grpc: {
        protoFile: `${__dirname}/../../examples/protos/streaming.proto`,
        packages: [
          {
            name: 'ticker',
            services: [
              { name: 'TickerSvc', implementation: { Watch: () => {} } },
            ],
          },
        ],
      },
    });

    expect(streamServer.gqlConfigs.schema).toBeDefined();
    expect(streamServer.rpcService.gqlSchema).toMatch(
      /extend type Subscription/,
    );
    expect(streamServer.rpcService.gqlSchema).not.toMatch(/extend type Query/);
    expect(streamServer.rpcService.gqlSchema).not.toMatch(
      /extend type Mutation/,
    );

    streamServer.once('grpc_server_started', async () => {
      await streamServer.forceShutdown();
      done();
    });
  });
});
