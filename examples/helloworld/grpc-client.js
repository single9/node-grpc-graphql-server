const { RPCService } = require('../../index.js');
const rpcService = new RPCService({
  protoFile: __dirname + '/../protos/hello.proto',
  packages: [
    {
      name: 'helloworld',
      services: [
        {
          name: 'Greeter',
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
    console.log('no response');
});

rpcClient.helloworld.Greeter.sayHelloAgain({ name: 'test again' }, function (err, response) {
  if (response)
    console.log('Greeting again:', response.message);
  else
    console.log('no response');
});

rpcClient.helloworld.Greeter.SayNested({}, function (err, response) {
  if (response)
    console.log('SayNested:', response.x);
  else
    console.log('no response');
});
