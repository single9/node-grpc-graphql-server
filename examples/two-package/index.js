const app = require('express')();
const { RPCServer } = require('../../index.js');
const { Calculator, Hello } = require('./controllers');

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  graphql: true,
  protoFile: __dirname + '/../protos/',
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
          implementation: Hello,
          mutate: false, // disable mutation in GraphQL
        }
      ]
    },
    {
      name: 'calculator',
      services: [
        {
          name: 'Simple',
          implementation: Calculator,
        },
        {
          name: 'Complex',
          implementation: Calculator,
          query: false, // disable query in GraphQL
        }
      ]
    },
  ]
});

if (rpcServer.gqlServer) {
  rpcServer.gqlServer.applyMiddleware({ app });
}

app.listen(3000, () => {
  console.log('Server started. http://localhost:3000');
});
