/* eslint-disable @typescript-eslint/no-var-requires */
import * as grpc from '@grpc/grpc-js';
import fs from 'fs';
import Debug from 'debug';
import { EventEmitter } from 'events';
import * as protoLoader from '@grpc/proto-loader';
import grpcToGraphQL from '../converter/index';
import {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
  genGrpcJs,
  getGrpcJsFiles,
} from './tools';

const debug = Debug('grpc-gql-server:rpc-service');

export interface ServicesDescriptor {
  /** Service name */
  name: string;
  /** Service implementation (controller) */
  implementation:
    | any
    | {
        [x: string]: (
          call: grpc.Call,
          callback: (err: Error, data: any) => void,
        ) => void;
      };
  /** (GraphQL mutation) Is it can be mutated? default: false */
  mutate?: boolean;
  /** (GraphQL query) Is it can be queried? default: true */
  query?: boolean;
  grpcOnly?: boolean;
}

export interface ClientServicesDescriptor {
  /** Service name */
  name?: string;
  /** Service host (default: 'localhost') */
  host?: string;
  /** Service port (default: 50051) */
  port?: number;
  /** Service server credentials (default: insecure) */
  creds?: grpc.ServerCredentials;
}

export type PackageDescriptorObj = {
  [packageName: string]: {
    [serviceName: string]: ServicesDescriptor & { name?: string };
  };
};

export type ClientPackageDescriptorObj = {
  [packageName: string]: {
    [serviceName: string]: ClientServicesDescriptor;
  };
};

export type RPCServicePackages = {
  /** Package name */
  name: string;
  services: ServicesDescriptor[] | ClientServicesDescriptor[];
};

export type RPCServiceConstructorParams = {
  /** gRPC params */
  grpc: RPCServiceGrpcParams;
  /** GraphQL configuration */
  graphql?: boolean | ParamGraphql;
};

export type RPCServiceGrpcParams = {
  /** gRPC protobuf files */
  protoFile: string | string[];
  /** packages */
  packages:
    | PackageDescriptorObj
    | ClientPackageDescriptorObj
    | RPCServicePackages[];
  /** gRPC Server instance */
  server?: grpc.Server;
  /** External service */
  extServices?: ParamExtService[];
  /** If set, generate the gRPC JS code and use it as grpc server definitions */
  generatedCode?: GrpcJsOutputParams;
};

export type GrpcJsOutputParams = {
  /** gRPC JS code output directory */
  outDir: string;
};

export type ParamGraphql = {
  /** Set to true to enable GraphQL */
  enable: boolean;
  /** Path of yours GraphQL schemas */
  schemaPath?: string | string[];
  resolverPath?: string | string[];
  context?: () => any;
  formatError?: (error: any) => any;
  introspection?: any;
  /** Logger for GraphQL server */
  logger?: any;
  /**
   * Reference: https://www.apollographql.com/docs/apollo-server/testing/graphql-playground/#configuring-playground
   */
  playground?: boolean | Playground;
  /** Reference to `ApolloServerExpress.ApolloServerExpressConfig` */
  apolloConfig?: any;
  auto?: boolean;
};

/**
 * gRPC Clients
 */
export type gRPCServiceClients = {
  [x: string]: gRPCServiceClientService;
};

/**
 * gRPC Client Service
 */
export type gRPCServiceClientService = {
  [x: string]: gRPCServiceClientServiceFn;
};

/**
 * gRPC Client Service Functions
 */
export type gRPCServiceClientServiceFn = {
  [x: string]: ClientCallFunction;
} & {
  /** Close the channel. This has the same functionality as the existing grpc.Client.prototype.close */
  close: () => grpc.Channel['close'];
  getChannel: () => grpc.Client['getChannel'];
};

/**
 * gRPC Client Service Function Call.
 */
interface ClientCallFunction {
  (req?: object, callback?: CallFunctionCallback): Promise<any>;
}

/**
 * Function response
 */
interface CallFunctionCallback {
  (err: Error, responseMessage: any): void;
}

/**
 * Add service that is not defined in the package
 */
type ParamExtService = {
  service: grpc.ServiceDefinition;
  implementation: grpc.UntypedServiceImplementation;
};

type Playground = {
  settings?: any;
  tabs?: any[];
};

type PackageObject = {
  [x: string]: grpc.GrpcObject | grpc.Client;
};

export class RPCService extends EventEmitter {
  extServices: any;
  packages: any;
  clients: gRPCServiceClients;
  grpcServer: any;
  packageObject: PackageObject;
  graphql: any;
  generatedGrpcService: any;
  packageDefinition: protoLoader.PackageDefinition;
  gqlSchema: any;

  constructor(
    { grpc: grpcParams, graphql }: RPCServiceConstructorParams,
    opts?: protoLoader.Options,
  ) {
    super();

    const {
      server: grpcServer,
      protoFile,
      packages,
      extServices,
      generatedCode,
    } = grpcParams;

    this.extServices = extServices || [];
    this.packages = packages;
    this.clients = {};
    this.grpcServer = grpcServer;
    /** @type {Object<string, grpc.GrpcObject|grpc.Client|grpc.ProtobufMessage>} */
    this.packageObject = {};
    this.graphql = graphql;

    let _protoFile = protoFile;

    if (graphql && generatedCode) {
      throw new Error(
        'GraphQL and generated gRPC code cannot be used at the same time.',
      );
    }

    if (
      protoFile &&
      !Array.isArray(protoFile) &&
      fs.statSync(protoFile).isDirectory()
    ) {
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
            const tmpService = require(grpcFile);
            this.generatedGrpcService = Object.assign(
              this.generatedGrpcService,
              tmpService,
            );
          });
          return undefined;
        }

        grpcCodeFiles = getGrpcJsFiles(generatedCode.outDir);
        // define generated service
        this.generatedGrpcService = {};
        // require all generated grpc js module
        grpcCodeFiles.services.forEach((grpcFile) => {
          const tmpService = require(grpcFile);
          this.generatedGrpcService = Object.assign(
            this.generatedGrpcService,
            tmpService,
          );
        });
      }
    } else if (!protoFile) {
      throw new Error('No proto file provided');
    }

    // load protobuf
    this.packageDefinition = protoLoader.loadSync(
      _protoFile,
      opts || {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );

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
    if (this.graphql && Array.isArray(this.packages) === false)
      throw new Error('Unable to initialize');
    // load definitions from packages
    let packageDefinition;

    if (this.generatedGrpcService) {
      packageDefinition = grpc.loadPackageDefinition(this.generatedGrpcService);
    } else {
      packageDefinition = grpc.loadPackageDefinition(this.packageDefinition);
    }

    if (
      this.grpcServer &&
      !this.generatedGrpcService &&
      (this.graphql === true || (this.graphql && this.graphql.enable === true))
    ) {
      this.gqlSchema = grpcToGraphQL(packageDefinition, this.packages);
      debug('%s', this.gqlSchema);
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
            packageObject[service.name].service,
            service.implementation || {},
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
    if (
      Array.isArray(this.packages) === false &&
      typeof this.packages === 'object'
    ) {
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

export default RPCService;
