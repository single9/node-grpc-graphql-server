import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import RPCService, {
  RPCServiceGrpcParams,
  ParamGraphql,
} from './rpc-service.js';
import { genResolvers, readDir } from './tools.js';

type GqlConfigs = {
  logger: any;
  context: any;
  formatError: any;
  playground: any;
  introspection: any;
  schema?: any;
};

function initDefaultGqlConfigs(): ParamGraphql {
  return {
    enable: true,
    schemaPath: undefined,
    resolverPath: undefined,
    context: undefined,
    formatError: undefined,
    playground: undefined,
    introspection: undefined,
    apolloConfig: undefined,
    logger: undefined,
  };
}

export class RPCServer extends EventEmitter {
  gqlServer: any;
  rpcService: RPCService;
  port: any;
  forceShutdown: () => any;
  tryShutdown: () => Promise<unknown>;
  gqlConfigs: GqlConfigs;

  constructor({
    ip = '0.0.0.0',
    port = 50051,
    creds,
    graphql,
    grpc: grpcParams,
  }: ServerConstructorParams) {
    super();

    const _grpcParams = { ...grpcParams, server: new grpc.Server() };

    this.gqlServer = undefined;
    this.rpcService = new RPCService({
      grpc: _grpcParams,
      graphql,
    });

    this.rpcService.grpcServer.bindAsync(
      `${ip}:${port}`,
      creds || grpc.ServerCredentials.createInsecure(),
      (err: any, grpcPort: any) => {
        if (err) throw err;
        this.rpcService.grpcServer.start();
        this.port = grpcPort;
        this.emit('grpc_server_started', { ip, port: grpcPort });
      },
    );

    this.forceShutdown = () => this.rpcService.grpcServer.forceShutdown();
    this.tryShutdown = () =>
      new Promise<void>((resolve, reject) => {
        this.rpcService.grpcServer.tryShutdown((err: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

    // GraphQL server is not running by default. Set `graphql` to enabled.
    if (
      graphql === undefined ||
      (typeof graphql === 'boolean' && graphql !== true) ||
      (typeof graphql === 'object' && graphql.enable !== true)
    ) {
      return this;
    }

    if (graphql === true) {
      graphql = initDefaultGqlConfigs();
    }

    const {
      schemaPath,
      resolverPath,
      context,
      formatError,
      playground,
      introspection,
      apolloConfig,
      logger,
    } = graphql;

    const auto = graphql.auto !== undefined ? graphql.auto : true;
    const registerTypes = [];
    const registerResolvers = [];

    if (schemaPath && resolverPath) {
      /* eslint-disable global-require */
      let schemasGraphql: string[];
      let schemasJs: string[];
      let controllers: string[];

      if (Array.isArray(schemaPath)) {
        schemasJs = [];
        schemasGraphql = [];
        schemaPath.forEach((schema) => {
          schemasJs = schemasJs.concat(readDir(schema, '.js'));
          schemasGraphql = schemasGraphql.concat(readDir(schema, '.graphql'));
        });
      } else {
        schemasJs = readDir(schemaPath, '.js');
        schemasGraphql = readDir(schemaPath, '.graphql');
      }

      if (Array.isArray(resolverPath)) {
        controllers = [];
        resolverPath.forEach((resolver) => {
          controllers = controllers.concat(readDir(resolver, '.js'));
        });
      } else {
        controllers = readDir(resolverPath, '.js');
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      schemasJs.forEach((x) => registerTypes.push(require(x)));
      schemasGraphql.forEach((x) =>
        registerTypes.push(fs.readFileSync(x, { encoding: 'utf8' })),
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      controllers.forEach((x) => registerResolvers.push(require(x)));
    }

    // Construct a schema, using GraphQL schema language from
    // protobuf to GraphQL converter
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ApolloServerExpress = require('apollo-server-express');
    const { ApolloServer, gql } = ApolloServerExpress;
    const { gqlSchema } = this.rpcService;
    registerTypes.push(
      gql`
        ${gqlSchema}
      `,
    );

    if (auto) {
      // Provide resolver functions for your schema fields
      // This section will automatically generate functions and resolvers
      registerResolvers.push(genResolvers(this.rpcService.packages));
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { makeExecutableSchema } = require('@graphql-tools/schema');

    this.gqlConfigs = {
      logger,
      context,
      formatError,
      playground,
      introspection,
    };

    this.gqlConfigs.schema = makeExecutableSchema({
      typeDefs: registerTypes,
      resolvers: registerResolvers,
      logger,
    });

    this.gqlConfigs = Object.assign(this.gqlConfigs, apolloConfig);
    this.gqlServer = new ApolloServer(this.gqlConfigs);
  }
}

export type ServerConstructorParams = {
  ip: string;
  port: number;
  grpc: RPCServiceGrpcParams;
  graphql?: boolean | ParamGraphql;
  creds: grpc.ServerCredentials;
};
