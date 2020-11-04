const grpc = require('grpc');
const fs = require('fs');
const protoLoader = require('@grpc/proto-loader');
const grpcToGraphQL = require('../converter/index.js');
const { recursiveGetPackage, replacePackageName, readProtofiles } = require('./tools.js');
const { RPC_CONFS = process.cwd() + '/conf/rpc' } = process.env;

class RPCService {
  /**
   * Creates instance of RPC service.
   * @param {RPCServiceConstructorParams}  params
   * @param {protoLoader.Options}          opts 
   */
  constructor({ grpcServer, protoFile, packages, graphql }, opts) {
    if (protoFile && (!Array.isArray(protoFile) && fs.statSync(protoFile).isDirectory())) {
      protoFile = readProtofiles(protoFile);
    } else if (!protoFile) {
      protoFile = readProtofiles(RPC_CONFS);
    }

    // load protobuf
    this.packageDefinition = protoLoader.loadSync(protoFile, opts || {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    this.packages = packages;
    /** @type {gRPCServiceClients} */
    this.clients = {};
    this.grpcServer = grpcServer;
    /** @type {Object<string, grpc.GrpcObject|grpc.Client|grpc.ProtobufMessage>} */
    this.packageObject = {};
    this.graphql = graphql;

    if (packages) this.init();
  }

  /**
   * Initialize
   */
  init() {
    // map object to array
    if (Array.isArray(this.packages) === false && (typeof this.packages === 'object')) {
      let newPackages = [];
      let packageKeys = Object.keys(this.packages);
      packageKeys.forEach(pack => {
        let newServices = [];
        const servicesKeys = Object.keys(this.packages[pack]);
        servicesKeys.forEach(service => {
          let serviceObj = Object.assign({}, this.packages[pack][service]);
          serviceObj.name = service;
          newServices.push(serviceObj);
        });
        newPackages.push({
          name: pack,
          services: newServices,
        });
      });
      this.packages = newPackages;
    }

    // main process
    if (Array.isArray(this.packages)) {
      // load definitions from packages
      const packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
      if (this.grpcServer && this.graphql === true) {
        this.gqlSchema = grpcToGraphQL(packageDefinition, this.packages);
      }

      this.packages.forEach(pack => {
        const packNames = pack.name.split('.');
        const packageName = replacePackageName(pack.name);
        const packageObject = 
          this.packageObject[packageName] = recursiveGetPackage(packNames, packageDefinition);

        if (this.grpcServer) {
          // gRPC server mode
          pack.services.forEach(service => {
            this.grpcServer.addService(packageObject[service.name].service, service.implementation);
          });
        } else {
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
                  // wrap with promise if callback is unset
                  return new Promise((resolve, reject) => {
                    serviceClient[fnName](args[0], (err, response) => {
                      if (err) return reject(err);
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
        }
      });
    } else {
      throw new Error('Unable to initialize');
    }
  }
}

module.exports = RPCService;

/**
 * @typedef {object} ServicesDescriptor
 * @property {string}                   name  service name
 * @property {string}                   [host='localhost']  (Client Only) service host (default: 'localhost')
 * @property {number}                   [port=50051]        (Client Only) service port (default: 50051)
 * @property {grpc.ServerCredentials}   [creds=grpc.credentials.createInsecure()]  (Client Only) service server credentials (default: insecure)
 * @property {Object<string, function>} implementation      Service implementation (controller)
 * @property {boolean}                  [mutate=false]      (GraphQL mutatiom) Is it can be mutated?
 * @property {boolean}                  [query=true]        (GraphQL query)    Is it can be queried?
 * @property {boolean}                  [grpcOnly=false]    Only available on the gRPC
 */

/**
 * @typedef {object} RPCServicePackages
 * @property {string} name  Package name
 * @property {ServicesDescriptor[]} services
 */

/**
 * @typedef {object} RPCServiceConstructorParams
 * @property {grpc.Server}          [grpcServer]  gRPC Server instance
 * @property {string|string[]}      protoFile     gRPC protobuf files
 * @property {RPCServicePackages[]} packages      packages
 */

/**
 * gRPC Clients
 * @typedef {Object<string, gRPCServiceClientService>} gRPCServiceClients
 */

/**
 * gRPC Client Service
 * @typedef {Object<string, gRPCServiceClientServiceFn>} gRPCServiceClientService
 */

/**
 * gRPC Client Service Functions
 * @typedef {Object<string, ClientCallFunction>} gRPCServiceClientServiceFn
 */

/**
 * gRPC Client Service Function Call.
 * @callback ClientCallFunction
 * @param  {CallFunctionReq}      req
 * @param  {CallFunctionCallback} [callback]
 * @returns {Promise<any>|void} response
 */

/**
 * Function request
 * @typedef {object} CallFunctionReq
 */

/**
 * Function response
 * @callback CallFunctionCallback
 * @param {Error} err               Error Message
 * @param {any}   responseMessage   Response Message
 */