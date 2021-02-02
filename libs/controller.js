/* eslint-disable class-methods-use-this */

class Controller {
  /**
   * Response
   * @param {*} data Data
   * @param {function} [callback] Callback function
   * @returns {void|Promise<any>}
   */
  response(data, callback) {
    let err = ((data instanceof Error) && data) || null;

    if (typeof callback === 'function') {
      // stringify error message because gRPC callback only contains error message.
      err = err && new Error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
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

module.exports = Controller;
