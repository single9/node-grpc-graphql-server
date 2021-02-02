const app = require('express')();
const { RPCServer } = require('../../index.js');
const Hello = require('./controllers/helloworld.js');

const methods = {
  hello: new Hello(),
};

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  graphql: true,
  protoFile: `${__dirname}/../protos/hello.proto`,
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
});

if (rpcServer.gqlServer) {
  rpcServer.gqlServer.applyMiddleware({ app });
}

app.listen(3000, () => {
  console.log('Server started. http://localhost:3000');
});
