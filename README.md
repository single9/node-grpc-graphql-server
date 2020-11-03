gRPC GraphQL Server
===================

![test](https://github.com/single9/node-grpc-graphql-server/workflows/test/badge.svg?branch=master) ![npm](https://github.com/single9/node-grpc-graphql-server/workflows/npm/badge.svg)

Installation
-------------

    npm install express grpc @grpc/proto-loader apollo-server-express grpc-graphql-server

Usage
-----

### Server

Create a file named `hello.proto` and put it into directory `conf/rpc`.

The location of the file is specified by the environment `RPC_CONFS`. Default is `/conf/rpc`.

Also, you can modify it by pass `protoFile` to the constructor.

See `examples/helloworld`.

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
  // protoFile: __dirname + '/protos', // set the path of protobuf files.
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

See `examples/helloworld/grpc-client.js`.

```js
const { RPCClient } = require('grpc-graphql-server');
const rpcClient = new RPCClient({
  // protoFile: __dirname + '/protos', // Set this if your protobuf file doesn't located in the default directory.
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

async function main() {
  // call with callback
  rpcClient.helloworld.Greeter.SayHelloAgain({ name: 'test again' }, function (err, response) {
    if (err) return console.log('no response');
    console.log('Greeting again:', response.message);
  });

  // call with promise
  const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({ name: 'test' });
  const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested({});
  console.log('Greeting', sayHelloResponse.message);
  console.log(SayNestedResponse);
}

main();
```

### GraphQL

    npm install graphql-request graphql

#### Usage

```js
const { request, gql } = require('graphql-request');
 
const query = gql`
  {
    <package_name> {
      <service_name> {
        <function_name>(request: <request_parameters>) {
          <response_data_type>
        }
      }
    }
  }
`;
 
request('http://localhost:3000/graphql', query)
  .then((data) => console.log(data));
```

#### Example

See `examples/helloworld/graphql-client.js`.

```js
const { request, gql } = require('graphql-request');
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
 
request('http://localhost:3000/graphql', query)
  .then((data) => console.log(JSON.stringify(data)));
```

Notes
----------

### Package Name

If your package name is `topname.subname.v1`, it will replaced the `.` to `_`. So your new package 
name in the server will be `topname_subname_v1`.

#### Example of Client Usage

```js
rpcClient['topname_subname_v1'].<service_name>.method({ a: 1 }, function (err, response) {
  // ...
});

await rpcClient['topname_subname_v1'].<service_name>.method({ a: 1 });
```
