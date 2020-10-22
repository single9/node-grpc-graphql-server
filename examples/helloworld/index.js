const app = require('express')();
const { RPCServer, Controller } = require('../../index.js');

class Hello extends Controller {
  SayHello(call, callback) {
    return this.response({
      message: 'Hello ' + call.request.name
    }, callback);
  }

  SayHelloAgain(call, callback) {
    return this.response({
      message: 'Hello again ' + call.request.name
    }, callback);
  }

  SayHelloReturnArray(call, callback) {
    return this.response({
      message: 'Hello ' + call.request.name + ', I returned an array for you!',
      list: call.request.list,
    }, callback);
  }

  SayHelloWithName(call, callback) {
    return this.response({
      message: 'Hello ' + call.request.name,
    }, callback);
  }

  SayIntArray(call, callback) {
    return this.response({
      nums: [1, 2, 3]
    }, callback);
  }

  SayNested(call, callback) {
    return this.response({
      x: {
        name: 'test x',
        c: {
          cname: 'from c',
          anums: [
            1, 2, 3, 4, 5, 6
          ],
          snums: 1.1234,
          d: {
            dname: 'to d',
          }
        },
      }
    }, callback);
  }
}

const methods = {
  hello: new Hello(),
};

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  graphql: true,
  protoFile: __dirname + '/../protos/hello.proto',
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
          implementation: methods.hello,
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
