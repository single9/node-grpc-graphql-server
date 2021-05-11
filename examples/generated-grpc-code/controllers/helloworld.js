const MyController = require('./my-controller.js');

class Hello extends MyController {
  constructor() {
    super();
    this.proto = proto.helloworld;
  }

  sayHello(call, callback) {
    const resp = new this.proto.HelloReply()
    resp.setMessage(`Hello ${call.request.getName()}`)
    return this.response(resp, callback);
  }

  sayHelloAgain(call, callback) {
    const resp = new this.proto.HelloReply()
    resp.setMessage(`Hello again ${call.request.getName()}`)
    return this.response(resp, callback);
  }
}

module.exports = Hello;
