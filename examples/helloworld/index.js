const app = require('express')();
const { RPCServer } = require('../../index.js');

function response (resData, callback) {
  // for gRPC
  if (typeof callback === 'function') {
    return callback(null, resData);
  }

  // for grapgql
  return new Promise((resolve, reject) => {
    resolve(resData);
  });
}

class Hello {
  SayHello(call, callback) {
    return response({
      message: 'Hello ' + call.request.name
    }, callback);
  }

  SayHelloAgain(call, callback) {
    return response({
      message: 'Hello again ' + call.request.name
    }, callback);
  }

  SayHelloReturnArray(call, callback) {
    return response({
      message: 'Hello ' + call.request.name + ', I returned an array for you!',
      list: call.request.list,
    }, callback);
  }

  SayHelloWithName(call, callback) {
    return response({
      message: 'Hello ' + call.request.name,
    }, callback);
  }

  SayIntArray(call, callback) {
    return response({
      nums: [1, 2, 3]
    }, callback);
  }

  SayNested(call, callback) {
    return response({
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
