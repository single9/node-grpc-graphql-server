require('should');
const app = require('express')();
const { request, gql } = require('graphql-request');
const { RPCServer, RPCClient } = require('../index.js');
const Hello = require('../examples/helloworld/controllers/helloworld.js');

describe('Test gRPC-GraphQL Server', () => {
  let rpcServer;
  let rpcClient;
  let server;

  const methods = {
    hello: new Hello(),
  };

  it('should start grpc server', (done) => {
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

    rpcServer.once('grpc_server_started', async (payload) => {
      server = app.listen(3344, () => {
        done();
      });
    });
  });

  it('should create grpc client', (done) => {
    rpcClient = new RPCClient({
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

    done();
  });

  it('should call and receive data (callback)', (done) => {
    rpcClient.helloworld.Greeter.SayHelloAgain({ name: 'test again' }, (err, response) => {
      if (err) return console.log('no response');
      done();
    });
  });

  it('should call and receive data (async)', async () => {
    // call with promise
    const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({ name: 'test' });
    const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested({});

    sayHelloResponse.should.be.Object();
    sayHelloResponse.message.should.be.String();

    SayNestedResponse.should.be.Object();
    SayNestedResponse.x.should.be.Object();
    SayNestedResponse.x.name.should.be.String();
    SayNestedResponse.x.c.anums.should.be.Array();
    SayNestedResponse.x.c.cname.should.be.String();
    SayNestedResponse.x.c.d.should.be.Object();
    SayNestedResponse.x.c.snums.should.be.Number();
    SayNestedResponse.x.d.dname.should.be.String();
  });

  it('should call and receive via gql', (done) => {
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

    request('http://localhost:3344/graphql', query).then((data) => {
      data.should.be.Object();
      data.helloworld.should.be.Object();
      data.helloworld.Greeter.should.be.Object();
      data.helloworld.Greeter.SayHello.should.be.Object();
      data.helloworld.Greeter.SayHello.message.should.equal('Hello Duye');
      done();
    });
  });

  after(() => {
    rpcServer.rpcService.grpcServer.forceShutdown();
    server.close();
  });
});
