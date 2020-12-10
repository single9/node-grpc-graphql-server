const grpc = require('@grpc/grpc-js');
const grpcToGraphQL = require('../converter/index.js');
const { recursiveGetPackage, replacePackageName } = require('./tools.js');
const RPCService = require('./rpc-service.js');

class RPCClient extends RPCService {
  /**
   * Creates instance of RPC Client.
   * @param {ClientConstructorParams}      params
   * @param {protoLoader.Options}          opts 
   */
  constructor({protoFile, packages}, opts) {
    super({protoFile, packages}, opts);

    if (!(opts && opts.originalClass)) {
      return this.clients;
    }
  }

  init() {
    // main process
    if (Array.isArray(this.packages) === false) throw new Error('Unable to initialize');
    // load definitions from packages
    const packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
    if (this.grpcServer && (this.graphql === true || (this.graphql && this.graphql.enable === true))) {
      this.gqlSchema = grpcToGraphQL(packageDefinition, this.packages);
    }

    this.packages.forEach(pack => {
      const packNames = pack.name.split('.');
      const packageName = replacePackageName(pack.name);
      const packageObject = 
        this.packageObject[packageName] = recursiveGetPackage(packNames, packageDefinition);

      // gRPC client mode
      pack.services.forEach(service => {
        if (!this.clients[packageName]) {
          this.clients[packageName] = {};
        }
        service.host = service.host || 'localhost';
        service.port = service.port || '50051';
        const host = `${service.host}:${service.port}`;
        const serviceFunctionsKey = Object.keys(packageObject[service.name].service);
        const serviceClient = new packageObject[service.name](
          host || 'localhost:50051',
          service.creds || grpc.credentials.createInsecure()
        );
        const newFunctions = Object.assign({}, serviceClient);
        serviceFunctionsKey.forEach((fnName) => {
          // Promise the functions
          newFunctions[fnName] = (...args) => {
            // ensure passing an object to function. Because gRPC need.
            if (args.length === 0) {
              args[0] = {};
            }

            if (args.length === 1 && typeof args[0] !== 'function') {
              // wrap with promise if callback is not a function
              return new Promise((resolve, reject) => {
                serviceClient[fnName](args[0], (err, response) => {
                  if (err) {
                    const errDetails = {
                      error: err,
                      call: {
                        service: service.name,
                        function: fnName,
                        request: args[0],
                      },
                    };
                    this.emit('grpc_client_error', errDetails);
                    err.details = JSON.stringify(errDetails);
                    return reject(err);
                  }
                  resolve(response);
                });
              });
            } else {
              return serviceClient[fnName](...args);
            }
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
 */
