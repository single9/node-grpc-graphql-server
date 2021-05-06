const MyController = require('./my-controller.js');

class Calculator extends MyController {
  constructor() {
    super();
    this.proto = proto.calculator;
  }

  add(call, callback) {
    const req = call.request;
    const a = req.getA();
    const b = req.getB();
    const resp = new this.proto.CalculatorResponse();
    resp.setResult(a + b);
    return this.response(resp, callback);
  }

  sqrt(call, callback) {
    const req = call.request;
    const x = req.getX();
    const resp = new this.proto.CalculatorResponse();
    resp.setResult(Math.sqrt(x));
    return this.response(resp, callback);
  }
}

module.exports = Calculator;
