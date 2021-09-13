# gRPC GraphQL Server

![test](https://github.com/single9/node-grpc-graphql-server/workflows/test/badge.svg?branch=master) ![npm](https://github.com/single9/node-grpc-graphql-server/workflows/npm/badge.svg)

## Installation

    npm install express @grpc/proto-loader apollo-server-express grpc-graphql-server

### (Optional) gRPC JS runtime library

Install [grpc-tools](https://github.com/grpc/grpc-node/tree/master/packages/grpc-tools) to generates gRPC JS runtime library

    npm i -D grpc-tools

And install [google-protobuf](https://www.npmjs.com/package/google-protobuf) for google's protobuf runtime library.

    npm i google-protobuf

## Usage

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
const app = require("express")();
const RPCServer = require("grpc-graphql-server").RPCServer;

function response(resData, callback) {
  // for gRPC
  if (typeof callback === "function") {
    return callback(null, resData);
  }

  // for grapgql
  return new Promise((resolve, reject) => {
    resolve(resData);
  });
}

class Hello {
  SayHello(call, callback) {
    return response(
      {
        message: "Hello " + call.request.name,
      },
      callback
    );
  }

  SayHelloAgain(call, callback) {
    return response(
      {
        message: "Hello again " + call.request.name,
      },
      callback
    );
  }
}

const methods = {
  hello: new Hello(),
};

const rpcServer = new RPCServer({
  // port: 50052,    // uncomment to set gRPC port on 50052
  graphql: true, // Set true to enable GrpahQL because it's not enabled by default.
  grpc: {
    // protoFile: __dirname + '/protos/hello.proto', // set the protobuf file path.
    packages: [
      {
        name: "helloworld",
        services: [
          {
            name: "Greeter",
            implementation: methods.hello,
            mutate: false, // set true to add this service to the mutation
            // also you can set individual function of service to specified type.
            // It will be added to the type you specified.
            //mutate: [
            //  "SayHello"
            //]
          },
        ],
      },
    ],
  }
});

rpcServer.once("grpc_server_started", async (payload) => {
  console.log("gRPC server started at " + payload);
});

if (rpcServer.gqlServer) {
  rpcServer.gqlServer.applyMiddleware({ app });
}

app.listen(3000, () => {
  console.log("Server started. http://localhost:3000");
});
```

packages can also be like this:

```js
const rpcServer = new RPCServer({
  ...
  grpc: {
    packages: {
      helloworld: { // package name
        Greeter: {  // service name
          implementation: methods.hello, // implementation
        },
      },
    },
  },
  ...
});
```

### Client

See `examples/helloworld/grpc-client.js`.

```js
const { RPCClient } = require("grpc-graphql-server");
const rpcClient = new RPCClient({
  // protoFile: __dirname + '/protos', // Set this if your protobuf file doesn't located in the default directory.
  packages: [
    {
      name: "helloworld",
      services: [
        {
          name: "Greeter",
          // port: 50052,  // Uncomment this to set gRPC client port to 50052
        },
      ],
    },
  ],
});

async function main() {
  // call with callback
  rpcClient.helloworld.Greeter.SayHelloAgain(
    { name: "test again" },
    function (err, response) {
      if (err) return console.log("no response");
      console.log("Greeting again:", response.message);
    }
  );

  // call with promise
  const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({
    name: "test",
  });
  const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested({});
  console.log("Greeting", sayHelloResponse.message);
  console.log(SayNestedResponse);
}

main();
```

packages can also be like this:

```js
const rpcClient = new RPCClient({
  ...
  packages: {
    helloworld: { // package name
      Greeter: {  // service name
        //port: 50051, // gRPC service port number
      },
    },
  },
  ...
});
```

### gRPC Metadata

**Since Version 0.3.14**

If you want to add metadata to your gRPC call, just pass `metadata` to the function.

```
{
  metadata: [
    ['metadata_key', 'value']
  ]
}
```
#### Add Metadata to Client

```js
// call with callback and metadata
rpcClient.helloworld.Greeter.SayHello({ name: 'test' }, { metadata: [['time', Date.now()]] }, (err, response) => {
    if (err) return console.log('no response');
    console.log('Greeting:', response.message);
  });

// call with promise and metadata
const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({ name: 'test' }, { metadata: [['time', Date.now()]] });
```

**Get Metadata in Server**

Get metadata by `call.metadata`. This is a Map object so we can get the metadata very easily.

```js
class Hello extends Controller {
  SayHello(call, callback) {
    // get metadata from grpc call
    console.log(call.metadata.get('time'))
    return this.response({
      message: `Hello ${call.request.name}`,
    }, callback);
  }
}
```

### GraphQL

    npm install graphql-request graphql

#### Usage

```js
const { request, gql } = require("graphql-request");

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

request("http://localhost:3000/graphql", query).then((data) =>
  console.log(data)
);
```

#### Example

See `examples/helloworld/graphql-client.js`.

```js
const { request, gql } = require("graphql-request");
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

request("http://localhost:3000/graphql", query).then((data) =>
  console.log(JSON.stringify(data))
);
```

### Manually GraphQL Schema and Resolver

This package generates GraphQL schema and resolver from gRPC protocol buffers by default. Now you can
specify your own GraphQL schema and resolver to the server.

Thanks to [w4567892015](https://github.com/w4567892015) with [PR#4](https://github.com/single9/node-grpc-graphql-server/pull/4).

#### Usage

```js
const rpcServer = new RPCServer({
  ...
  graphql: {
    enable: true,   // Set true to enable GrpahQL because it's not enabled by default.
    // auto: false, // Set false to disable default GraphQL generator if you don't need.
    schemaPath: 'path/to/your/graphql/schema.js',
    resolverPath: 'path/to/your/graphql/resolver.js',
    // apolloConfig: { // other config you want to configure
    //   tracing: true
    //}
  },
  ...
});
```

#### Context

We use [ApolloServer](https://www.apollographql.com/) to build our GraphQL server. It provides `context` argument for passing things
that any resolver might need, like authentication, databases, etc.

Ref: ([The context argument - ApolloServer](https://www.apollographql.com/docs/apollo-server/data/resolvers/#the-context-argument))

```js
const rpcServer = new RPCServer({
  ...
  graphql: {
    ...
    context: async ({ req }) => {
      console.log(req);
    }
  },
  ...
});
```

##### Example

**Server**

See `examples/helloworld-alt`.

```js
const rpcServer = new RPCServer({
  protoFile: __dirname + "/protos/hello.proto", // set the protobuf file path. (string|string[])
  graphql: {
    enable: true, // Set true to enable GrpahQL because it's not enabled by default.
    schemaPath: path.join(__dirname, "./schema"),
    resolverPath: path.join(__dirname, "./controllers/graphql"),
  },
  grpc: {
    packages: [
      {
        name: "helloworld",
        services: [
          {
            name: "Greeter",
            implementation: methods.hello,
            mutate: false,
          },
        ],
      },
    ],
  },
});
```

## Events

**Since Version 0.3.1**

We add events to let you can handle more, such as client errors.

**Usage**

Only client need.

```js
const client = new RPCClient({
  originalClass: true,
});

client.om("grpc_client_error", (err) => console.log(err));
```

### Event: Server

**grpc_server_started**

Fired when grpc server is started.

- Payload
  - ip: server ip
  - port: server port

### Event: Client

**grpc_client_error**

Fired when grpc client got error.

- Payload
  - error: gRPC errors ([Status Response Codes](https://developers.google.com/maps-booking/reference/grpc-api/status_codes))
  - call:
    - service: Service Name
    - functionName: Function name
    - request: Function request parameters

## Notes

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

# Generate gRPC JS runtime library

**Since Version 0.4.x**

**NOTE:** GraphQL and generated gRPC runtime library cannot be used at the same time.Maybe one day I will found a better way to do.

If you want to use generated js runtime library for server side, you should install `grpc-tools` and run the command below:

    ./node_modules/grpc-graphql-server/bin/index.js init <proto_files_dir> <grpc_js_out_dir>

e.g.

    ./node_modules/grpc-graphql-server/bin/index.js ./protos/ ./grpc

## Server

```js
const rpcServer = new RPCServer({
  grpc: {
    protoFile: `${__dirname}/protos/`,
    // Add this to read the generated code
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
```

You can see details on `example/generated-grpc-code`

# Migration from v0.3.x

## gRPC

We move the grpc parameters form constructor root to `grpc` object. This change only affect `RPCServer`.

**v0.3.x**

```js
const rpcServer = new RPCServer({
  packages: [
    {
      name: "helloworld",
      services: [
        {
          name: "Greeter",
        },
      ],
    },
  ],
});
```

**v0.4.x**

```js
const rpcServer = new RPCServer({
  grpc: { // we move it inside this object
    packages: [
      {
        name: "helloworld",
        services: [
          {
            name: "Greeter",
          },
        ],
      },
    ],
  },
});
```
