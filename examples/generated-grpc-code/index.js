const { RPCServer } = require('../../index.js');
const { Hello, Calculator } = require('./controllers');

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  // graphql: true,  // disable because generated code dose not work with GraphQL
  grpc: {
    protoFile: `${__dirname}/../protos/`,
    generatedCode: {
      outDir: `${__dirname}/grpc-pb`,
    },
    packages: {
      helloworld: {
        Greeter: {
          implementation: Hello,
        },
      },
      calculator: {
        Simple: {
          implementation: Calculator,
        },
        Complex: {
          implementation: Calculator,
        }
      },
    },
  },
});

rpcServer.once("grpc_server_started", async (payload) => {
  console.log("gRPC server started on %s:%d", payload.ip, payload.port);
});
