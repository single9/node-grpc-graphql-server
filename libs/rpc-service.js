const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const { EventEmitter } = require('events');
const protoLoader = require('@grpc/proto-loader');
const grpcToGraphQL = require('../converter/index.js');
const { recursiveGetPackage, replacePackageName, readProtofiles } = require('./tools.js');

const { RPC_CONFS = `${process.cwd()}/conf/rpc` } = process.env;

class RPCService extends EventEmitter {
  /**
   * Creates instance of RPC service.
   * @param {RPCServiceConstructorParams}  params
   * @param {protoLoader.Options}          opts
   */
  constructor({
    grpcServer, protoFile, packages, graphql,
  }, opts) {
    super();

    let _protoFile = protoFile;

    if (protoFile && (!Array.isArray(protoFile) && fs.statSync(protoFile).isDirectory())) {
      _protoFile = readProtofiles(protoFile);
    } else if (!protoFile) {
      _protoFile = readProtofiles(RPC_CONFS);
    }

    // load protobuf
    this.packageDefinition = protoLoader.loadSync(_protoFile, opts || {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    this.packages = packages;
    /** @type {gRPCServiceClients} */
    this.clients = {};
    this.grpcServer = grpcServer;
    /** @type {Object<string, grpc.GrpcObject|grpc.Client|grpc.ProtobufMessage>} */
    this.packageObject = {};
    this.graphql = graphql;

    if (packages) {
      // map object to array
      this.__init_packages_mapping();
      // do initialize
      this.init();
    }
  }

  /**
   * Initialize
   */
  init() {
    // main process
    if (Array.isArray(this.packages) === false) throw new Error('Unable to initialize');
    // load definitions from packages
    const packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
    if (this.grpcServer
      && (this.graphql === true || (this.graphql && this.graphql.enable === true))) {
      this.gqlSchema = grpcToGraphQL(packageDefinition, this.packages);
    }

    this.packages.forEach((pack) => {
      const packNames = pack.name.split('.');
      const packageName = replacePackageName(pack.name);
      const packageObject = recursiveGetPackage(packNames, packageDefinition);
      this.packageObject[packageName] = packageObject;

      if (this.grpcServer) {
        // gRPC server mode
        pack.services.forEach((service) => {
          this.grpcServer.addService(packageObject[service.name].service, service.implementation);
        });
      } else {
        throw new Error('Unable to initialize gRPC server');
      }
    });
  }

  __init_packages_mapping() {
    if (Array.isArray(this.packages) === false && (typeof this.packages === 'object')) {
      const newPackages = [];
      const packageKeys = Object.keys(this.packages);
      packageKeys.forEach((pack) => {
        const newServices = [];
        const servicesKeys = Object.keys(this.packages[pack]);
        servicesKeys.forEach((service) => {
          const serviceObj = { ...this.packages[pack][service] };
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
  }
}

module.exports = RPCService;

/**
 * @typedef {object} ServicesDescriptor
 * @property {string} name  service name
 * @property {string} [host='localhost']  (Client Only) service host (default: 'localhost')
 * @property {number} [port=50051]        (Client Only) service port (default: 50051)
 * @property {grpc.ServerCredentials}   [creds=grpc.credentials.createInsecure()]
 *                                        (Client Only) service server credentials
 *                                        (default: insecure)
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
