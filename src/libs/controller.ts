export class Controller {
  response(
    data: any,
    callback: (err: Error, data: any) => void,
  ): void | Promise<any> {
    let err = (data instanceof Error && data) || null;

    if (typeof callback === 'function') {
      // stringify error message because gRPC callback only contains error message.
      err =
        err && new Error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
      return callback(err, data);
    }

    // for graphgql
    return new Promise((resolve, reject) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  }
}
