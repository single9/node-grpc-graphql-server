
const { Controller } = require('../../../index.js');

class Calculator extends Controller {
  add(call, callback) {
    let res = {
      result: call.request.a + call.request.b
    };
    return this.response(res, callback);
  }

  minus(call, callback) {
    let res = {
      result: call.request.a - call.request.b
    };
    return this.response(res, callback);
  }

  sqrt(call, callback) {
    let res = {
      result: Math.sqrt(call.request.x)
    };
    return this.response(res, callback);
  }

  multiply(call, callback) {
    let res = {
      result: call.request.a * call.request.b
    };
    return this.response(res, callback);
  }

  devide(call, callback) {
    let res = {
      result: call.request.a / call.request.b
    };
    return this.response(res, callback);
  }
}

module.exports = Calculator;
