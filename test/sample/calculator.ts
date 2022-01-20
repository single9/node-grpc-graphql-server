import { Controller } from '../../src';

export default class Calculator extends Controller {
  add(call, callback) {
    const res = {
      result: call.request.a + call.request.b,
    };
    return this.response(res, callback);
  }

  minus(call, callback) {
    const res = {
      result: call.request.a - call.request.b,
    };
    return this.response(res, callback);
  }

  sqrt(call, callback) {
    const res = {
      result: Math.sqrt(call.request.x),
    };
    return this.response(res, callback);
  }

  multiply(call, callback) {
    const res = {
      result: call.request.a * call.request.b,
    };
    return this.response(res, callback);
  }

  devide(call, callback) {
    const res = {
      result: call.request.a / call.request.b,
    };
    return this.response(res, callback);
  }
}
