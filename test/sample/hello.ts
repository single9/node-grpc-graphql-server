import { Controller } from '../../src';

export default class Hello extends Controller {
  SayHello(call: { request: { name: any } }, callback: any) {
    return this.response(
      {
        message: `Hello ${call.request.name}`,
      },
      callback,
    );
  }

  SayHelloAgain(call: { request: { name: any } }, callback: any) {
    return this.response(
      {
        message: `Hello again ${call.request.name}`,
      },
      callback,
    );
  }

  SayHelloReturnArray(
    call: { request: { name: any; list: any } },
    callback: any,
  ) {
    return this.response(
      {
        message: `Hello ${call.request.name}, I returned an array for you!`,
        list: call.request.list,
      },
      callback,
    );
  }

  SayHelloWithName(call: { request: { name: any } }, callback: any) {
    return this.response(
      {
        message: `Hello ${call.request.name}`,
      },
      callback,
    );
  }

  SayIntArray(call: any, callback: any) {
    return this.response(
      {
        nums: [1, 2, 3],
      },
      callback,
    );
  }

  SayNested(call: any, callback: any) {
    return this.response(
      {
        x: {
          name: 'test x',
          c: {
            cname: 'from c',
            anums: [1, 2, 3, 4, 5, 6],
            snums: 1.1234,
            d: {
              dname: 'to d in',
            },
          },
          d: {
            dname: 'to d out',
          },
        },
      },
      callback,
    );
  }
}
