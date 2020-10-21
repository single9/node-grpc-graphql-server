gRPC GraphQL Server
===================

![npm publish](https://github.com/single9/node-grpc-graphql-server/workflows/Node.js%20Package/badge.svg)

Installation
-------------

    npm install grpc @grpc/proto-loader apollo-server-express grpc-graphql-server

Usage
-----

### Server

Create a file named `hello.proto` and put it into directory `conf/rpc`.

The location of the file is specified by the environment `RPC_CONFS`. Default is `/conf/rpc`.

```
syntax = "proto3";

package helloworld;

// The greeting service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply) {}
  // Sends another greeting
  rpc SayHelloAgain (HelloRequest) returns (HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}
```

Create a file named index.js. This is your server.

```js
const app = require('express')();
const RPCServer = require('grpc-graphql-server').RPCServer;

function response (resData, callback) {
  // for gRPC
  if (typeof callback === 'function') {
    return callback(null, resData);
  }

  // for grapgql
  return new Promise((resolve, reject) => {
    resolve(resData)
  })
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
}

const methods = {
  hello: new Hello(),
};

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  // protoFile: __dirname + '/protos/hello.proto', // set the protobuf file path. (string|string[])
  graphql: true,     // Set true to enable GrpahQL because it's not enabled by default.
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
          implementation: methods.hello,
          mutate: false,
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
```

### Client

```js
const RPCServer = require('grpc-graphql-server').RPCService;
const rpcService = new RPCService({
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
          // port: 50052,  // Uncomment this to set gRPC client port to 50052
        }
      ]
    },
  ]
});

const rpcClient = rpcService.clients;

rpcClient.helloworld.Greeter.sayHello({ name: 'test' }, function (err, response) {
  if (response)
    console.log('Greeting :', response.message);
  else
    console.log('no response')
});

rpcClient.helloworld.Greeter.sayHelloAgain({ name: 'test again' }, function (err, response) {
  if (response)
    console.log('Greeting again:', response.message);
  else
    console.log('no response')
});
```
