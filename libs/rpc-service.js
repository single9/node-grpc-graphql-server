/* eslint-disable global-require */
const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const { EventEmitter } = require('events');
const protoLoader = require('@grpc/proto-loader');
const grpcToGraphQL = require('../converter/index.js');
const {
  recursiveGetPackage, replacePackageName, readProtofiles, genGrpcJs, getGrpcJsFiles,
} = require('./tools.js');

class RPCService extends EventEmitter {
  /**
   * Creates instance of RPC service.
   * @param {RPCServiceConstructorParams}  params
   * @param {protoLoader.Options}          opts
   */
  constructor({
    grpc: grpcParams, graphql,
  }, opts) {
    super();

    const {
      server: grpcServer, protoFile, packages, extServices, generatedCode,
    } = grpcParams;

    this.extServices = extServices || [];
    this.packages = packages;
    /** @type {gRPCServiceClients} */
    this.clients = {};
    this.grpcServer = grpcServer;
    /** @type {Object<string, grpc.GrpcObject|grpc.Client|grpc.ProtobufMessage>} */
    this.packageObject = {};
    this.graphql = graphql;

    let _protoFile = protoFile;

    if (graphql && generatedCode) {
      throw new Error('GraphQL and generated gRPC code cannot be used at the same time.');
    }

    if (protoFile && (!Array.isArray(protoFile) && fs.statSync(protoFile).isDirectory())) {
      _protoFile = readProtofiles(protoFile);
      // generate grpc js code
      if (!graphql && generatedCode) {
        let grpcCodeFiles;

        if (!generatedCode.outDir) throw new Error('outDir is required');
        if (!packages) {
          grpcCodeFiles = genGrpcJs(protoFile, generatedCode.outDir);

          // define generated service
          this.generatedGrpcService = {};
          // require all generated grpc js module
          grpcCodeFiles.services.forEach((grpcFile) => {
          // eslint-disable-next-line import/no-dynamic-require
            const tmpService = require(grpcFile);
            this.generatedGrpcService = Object.assign(this.generatedGrpcService, tmpService);
          });
          return undefined;
        }

        grpcCodeFiles = getGrpcJsFiles(generatedCode.outDir);
        // define generated service
        this.generatedGrpcService = {};
        // require all generated grpc js module
        grpcCodeFiles.services.forEach((grpcFile) => {
          // eslint-disable-next-line import/no-dynamic-require
          const tmpService = require(grpcFile);
          this.generatedGrpcService = Object.assign(this.generatedGrpcService, tmpService);
        });
      }
    } else if (!protoFile) {
      throw new Error('No proto file provided');
    } else {
      throw new Error('The provided proto file format is invalid');
    }

    // load protobuf
    this.packageDefinition = protoLoader.loadSync(_protoFile, opts || {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    if (packages) {
      // map object to array
      this.__init_packages_mapping();
      // do initialize
      this.init();
    } else {
      throw new Error('No packages definition provided');
    }
  }

  /**
   * Initialize
   */
  init() {
    // main process
    if (this.graphql && Array.isArray(this.packages) === false) throw new Error('Unable to initialize');
    // load definitions from packages
    let packageDefinition;

    if (this.generatedGrpcService) {
      packageDefinition = grpc.loadPackageDefinition(this.generatedGrpcService);
    } else {
      packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
    }

    if (this.grpcServer && !(this.generatedGrpcService)
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
        // If service implementation is missing, give it an empty object.
        pack.services.forEach((service) => {
          this.grpcServer.addService(
            packageObject[service.name].service, (service.implementation || Object.create({})),
          );
        });

        // add additional service that is not defined in the package
        if (this.extServices) {
          this.extServices.forEach((item) => {
            this.grpcServer.addService(item.service, item.implementation);
          });
        }
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
 * @property {RPCServiceGrpcParams}     grpc          gRPC params
 * @property {boolean|ParamGraphql}     [graphql]     graphql configuration
 */

/**
 * @typedef {object} RPCServiceGrpcParams
 * @property {string|string[]}          protoFile     gRPC protobuf files
 * @property {RPCServicePackages[]}     packages      packages
 * @property {grpc.Server}              [server]      gRPC Server instance
 * @property {ParamExtService[]}        [extServices]   External service
 * @property {GrpcJsOutputParams}       [generatedCode] If set, generate the gRPC JS code
 *                                                     and use it as grpc server definitions
 */

/**
 * @typedef {object} GrpcJsOutputParams
 * @property {string} outDir          gRPC JS code output directory
 */

/**
 * @typedef {object} ParamGraphql
 * @property {boolean} enable  Enable GraphQL (default: false)
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

/**
 * Add service that is not defined in the package
 *
 * @typedef {object} ParamExtService
 * @property {grpc.ServiceDefinition} service
 * @property {grpc.UntypedServiceImplementation} implementation
 */
