import { Controller } from '../../src';

export default class BytesEcho extends Controller {
  EchoBytes(call: { request: { data: Buffer } }, callback: any) {
    return this.response(
      {
        data: call.request.data,
      },
      callback,
    );
  }
}
