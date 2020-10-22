const grpc = require('grpc');
const fs = require('fs');
const protoLoader = require('@grpc/proto-loader');
const grpcToGraphQL = require('./converter/index.js');
const { recursiveGetPackage, replacePackageName, readProtofiles } = require('./tools.js');
const { RPC_CONFS = process.cwd() + '/conf/rpc' } = process.env;

class RPCService {
  /**
   * Creates instance of RPC service.
   * @param {RPCServiceConstructorParams}  params
   * @param {protoLoader.Options}          opts 
   */
  constructor({ grpcServer, protoFile, packages }, opts) {
    if (protoFile && (!Array.isArray(protoFile) && fs.statSync(protoFile).isDirectory())) {
      protoFile = readProtofiles(protoFile);
    } else if (!protoFile) {
      protoFile = readProtofiles(RPC_CONFS);
    }

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

    if (packages) this.init();
  }

  init() {
    if (Array.isArray(this.packages)) {
      const packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
      if (this.grpcServer) {
        this.gqlSchema = grpcToGraphQL(packageDefinition, this.packages);
      }

      this.packages.forEach(pack => {
        const packNames = pack.name.split('.');
        const packageName = replacePackageName(pack.name);
        const packageObject = 
          this.packageObject[packageName] = recursiveGetPackage(packNames, packageDefinition);

        // gRPC server mode
        if (this.grpcServer) {
          pack.services.forEach(service => {
            this.grpcServer.addService(packageObject[service.name].service, service.implementation);
          });
        } else {
          pack.services.forEach(service => {
            if (!this.clients[packageName]) {
              this.clients[packageName] = {};
            }
            service.host = service.host || 'localhost';
            service.port = service.port || '50051';
            const host = `${service.host}:${service.port}`;
            this.clients[packageName][service.name] = new packageObject[service.name](
              host || 'localhost:50051',
              service.creds || grpc.credentials.createInsecure()
            );
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
 * gRPC Client Service Functions Call
 * @typedef {function(CallFunctionReq, CallFunctionRes)} ClientCallFunction
 */

/**
 * Function request
 * @typedef {object} CallFunctionReq
 */

/**
 * Function response
 * @callback CallFunctionRes
 * @param {Error} err               Error Message
 * @param {any}   responseMessage   Response Message
 */