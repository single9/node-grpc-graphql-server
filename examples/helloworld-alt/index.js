const path = require('path');
const app = require('express')();
const { RPCServer } = require('../../index.js');
const Hello = require('./controllers/helloworld.js');

const methods = {
  hello: new Hello(),
};

const rpcServer = new RPCServer({
  port: 50052, // set gRPC port on 50052
  graphql: {
    enable: true,
    schemaPath: path.join(__dirname, './schema'),
    resolverPath: path.join(__dirname, './controllers/graphql'),
    // context: async ({ req }) => {
    //   console.log(req);
    // }
    // auto: false,
  },
  grpc: {
    protoFile: path.join(__dirname, '../protos/hello.proto'),
    packages: {
      helloworld: {
        Greeter: {
          implementation: methods.hello,
        },
      },
    },
  },
});

rpcServer.once("grpc_server_started", async (payload) => {
  console.log("gRPC server started on %s:%d", payload.ip, payload.port);
});

if (rpcServer.gqlServer) {
  rpcServer.gqlServer.applyMiddleware({ app });
}

app.listen(3000, () => {
  console.log('Server started. http://localhost:3000');
  console.log('  GraphQL http://localhost:3000/graphql');
});
