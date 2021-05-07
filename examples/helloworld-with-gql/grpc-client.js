const { RPCClient } = require('../../index.js');

const rpcClient = new RPCClient({
  protoFile: `${__dirname}/../protos/hello.proto`,
  packages: {
    helloworld: {
      Greeter: {
        port: 50052, // set client connetc to port 50052
      },
    },
  },
});

async function main() {
  // call with callback
  rpcClient.helloworld.Greeter.SayHelloAgain({ name: 'test again' }, (err, response) => {
    if (err) {
      console.log('no response');
      return;
    }
    console.log('Greeting again:', response.message);
  });

  // call with promise
  const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({ name: 'test' });
  const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested({});
  console.log('Greeting', sayHelloResponse.message);
  console.log(SayNestedResponse);
}

main();
