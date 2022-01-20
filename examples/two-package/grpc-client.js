const { initRPCClient } = require('../..');

const rpcClient = initRPCClient({
  protoFile: `${__dirname}/../protos/`,
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
        },
      ],
    },
    {
      name: 'calculator',
      services: [
        {
          name: 'Simple',
        },
        {
          name: 'Complex',
        },
      ],
    },
  ],
});

async function main() {
  // call with callback
  rpcClient.helloworld.Greeter.SayHelloAgain({ name: 'test again' }, (err, response) => {
    if (err) return console.log('no response', err);
    console.log('Greeting again:', response.message);
  });

  // call with promise
  const sayHelloResponse = await rpcClient.helloworld.Greeter.SayHello({ name: 'test' });
  // const SayNestedResponse = await rpcClient.helloworld.Greeter.SayNested({});
  console.log('Greeting', sayHelloResponse);
  // console.log(SayNestedResponse);

  // const added = await rpcClient.calculator.Simple.add({ a: 1, b: 5 });
  // console.log('add:', added);

  // const sqrt = await rpcClient.calculator.Complex.sqrt({ x: 2 });
  // console.log('sqrt:', sqrt);
}

main().catch(console.error);
