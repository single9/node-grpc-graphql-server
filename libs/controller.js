class Controller {
  response(data, callback) {
    let err = (data instanceof Error) && data || null;
  
    if (typeof callback === 'function') {
      return callback(err, data);
    }
  
    // for graphgql
    return new Promise((resolve, reject) => {
      if (err) return reject(err);
      resolve(data);
    });
  }
}

module.exports = Controller;
