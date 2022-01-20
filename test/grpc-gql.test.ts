import express from 'express';
import { request, gql } from 'graphql-request';
import { Server } from 'http';
import { RPCServer, initRPCClient, gRPCServiceClients } from '../src';
import Hello from './sample/hello';

const app = express();

describe('Test gRPC-GraphQL Server', () => {
  let rpcServer: RPCServer;
  let rpcClient: gRPCServiceClients;
  let server: Server;

  const methods = {
    hello: new Hello(),
  };

  it('should start gRPC server with GraphQL', (done) => {
    rpcServer = new RPCServer({
      graphql: true,
      port: 50052,
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

    if (rpcServer.gqlServer) {
      rpcServer.gqlServer.applyMiddleware({ app });
    }

    rpcServer.once('grpc_server_started', async () => {
      server = app.listen(3344, () => {
        done();
      });
    });
  });

  it('should create grpc client', (done) => {
    rpcClient = initRPCClient({
      protoFile: `${__dirname}/../examples/protos/hello.proto`,
      packages: [
        {
          name: 'helloworld',
          services: [
            {
              name: 'Greeter',
              port: 50052,
            },
          ],
        },
      ],
    });

    expect(rpcClient).toBeDefined();
    expect(rpcClient).toHaveProperty('helloworld.Greeter');

    done();
  });

  it('should call `SayHello` and receive data (callback)', (done) => {
    rpcClient.helloworld.Greeter.SayHello({ name: 'test' }, (err, response) => {
      expect(err).toBeNull();
      expect(response).toBeDefined();
      done();
    });
  });

  it('should call `SayNested` and receive data (callback)', (done) => {
    rpcClient.helloworld.Greeter.SayNested((err, response) => {
      expect(err).toBeNull();
      expect(response).toBeDefined();
      done();
    });
  });

  it('should call `SayHello` with metadata and receive data (callback)', (done) => {
    rpcClient.helloworld.Greeter.SayHello(
      {
        name: 'Test',
      },
      {
        metadata: [['time', Date.now()]],
      },
      (err, response) => {
        console.log(response);
        expect(err).toBeNull();
        expect(response).toBeDefined();
        done();
      },
    );
  });

  it('should call and receive data (async)', async () => {
    // call with promise
    const name = 'Test';
    const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({
      name,
    });

    expect(sayHelloResponse).toBeDefined();
    expect(sayHelloResponse).toHaveProperty('message', `Hello ${name}`);
  });

  it('should call `SayNested` and receive data (async)', async () => {
    const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested();

    expect(SayNestedResponse).toBeDefined();

    [
      'x',
      'x.name',
      'x.c.anums',
      'x.c.cname',
      'x.c.snums',
      'x.c.d',
      'x.d.dname',
    ].forEach((item) => {
      expect(SayNestedResponse).toHaveProperty(item);
    });
  });

  it('should call and receive via gql', async () => {
    const query = gql`
      {
        helloworld {
          Greeter {
            SayHello(request: { name: "Duye" }) {
              message
            }
          }
        }
      }
    `;

    const data = await request('http://localhost:3344/graphql', query);
    expect(data).toBeDefined();

    ['helloworld', 'helloworld.Greeter', 'helloworld.Greeter.SayHello'].forEach(
      (item) => {
        expect(data).toHaveProperty(item);
      },
    );

    expect(data).toHaveProperty(
      'helloworld.Greeter.SayHello.message',
      'Hello Duye',
    );
  });

  it('should close RPC Client', (done) => {
    rpcClient.helloworld.Greeter.close();
    done();
  });

  it('should try shutdown RPC Server', async () => {
    await rpcServer.tryShutdown();
  });

  afterAll(() => {
    server.close();
  });
});
