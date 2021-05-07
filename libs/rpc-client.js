const grpc = require('@grpc/grpc-js');
const { recursiveGetPackage, replacePackageName } = require('./tools.js');
const RPCService = require('./rpc-service.js');

class RPCClient extends RPCService {
  /**
   * Creates instance of RPC Client.
   * @param {ClientConstructorParams}      params
   * @param {protoLoader.Options}          opts
   */
  constructor({ protoFile, packages, originalClass }, opts) {
    super({ grpc: { protoFile, packages } }, opts);

    if (!originalClass) {
      return this.clients;
    }
  }

  init() {
    // main process
    if (Array.isArray(this.packages) === false) throw new Error('Unable to initialize');
    // load definitions from packages
    const packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);

    this.packages.forEach((pack) => {
      const packNames = pack.name.split('.');
      const packageName = replacePackageName(pack.name);
      const packageObject = recursiveGetPackage(packNames, packageDefinition);
      this.packageObject[packageName] = packageObject;

      // gRPC client mode
      pack.services.forEach((service) => {
        const _service = service;
        if (!this.clients[packageName]) {
          this.clients[packageName] = {};
        }
        _service.host = _service.host || 'localhost';
        _service.port = _service.port || '50051';
        const host = `${_service.host}:${_service.port}`;
        const serviceFunctionsKey = Object.keys(packageObject[_service.name].service);
        const serviceClient = new packageObject[_service.name](
          host || 'localhost:50051',
          _service.creds || grpc.credentials.createInsecure(),
        );
        const newFunctions = { ...serviceClient };
        serviceFunctionsKey.forEach((fnName) => {
          // Promise the functions
          newFunctions[fnName] = (...args) => {
            // ensure passing an object to function. Because gRPC need.
            const _args = args;
            const firstArg = _args.shift() || {};

            if (typeof firstArg === 'function') {
              return serviceClient[fnName]({}, firstArg);
            }

            // add metadata
            const metadata = new grpc.Metadata();
            if ((_args[0] && _args[0].metadata) && Array.isArray(_args[0].metadata)) {
              const inputMetadata = _args[0].metadata;
              inputMetadata.forEach((iMeta) => {
                metadata.set(...iMeta);
              });
              _args[0] = metadata;
            }

            const newArgs = [firstArg, ..._args];
            if (typeof newArgs[(newArgs.length - 1)] !== 'function') {
              // wrap with promise if callback is not a function
              return new Promise((resolve, reject) => {
                serviceClient[fnName](firstArg, metadata, (err, response) => {
                  if (err) {
                    const _err = err;
                    const errDetails = {
                      error: _err,
                      call: {
                        service: _service.name,
                        function: fnName,
                        request: args[0],
                      },
                    };
                    this.emit('grpc_client_error', errDetails);
                    // add call to error object
                    _err.call = errDetails.call;
                    reject(_err);
                    return;
                  }
                  resolve(response);
                });
              });
            }
            return serviceClient[fnName](...newArgs);
          };
        });
        // map functions
        this.clients[packageName][service.name] = newFunctions;
      });
    });
  }
}

module.exports = RPCClient;

/**
 * @typedef  {object} ClientConstructorParams
 * @property {string|string[]}               [protoFile]
 * @property {RPCService.RPCServicePackages} packages
 * @property {boolean}  originalClass Return class instance of RPC Client.
 *                      This is useful if you want more feature, such as events.
 */
