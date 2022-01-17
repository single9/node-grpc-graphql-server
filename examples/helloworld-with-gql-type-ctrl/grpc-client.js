const { initRPCClient } = require('../..');

const rpcClient = initRPCClient({
  protoFile: `${__dirname}/../protos/hello.proto`,
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
        },
      ],
    },
  ],
});

async function main() {
  // call with callback
  rpcClient.helloworld.Greeter.SayHelloAgain({ name: 'test again' }, (err, response) => {
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
