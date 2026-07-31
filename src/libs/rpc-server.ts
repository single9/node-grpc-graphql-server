import fs from 'fs';
import * as http from 'http';
import * as grpc from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import RPCService, { RPCServiceGrpcParams, ParamGraphql } from './rpc-service';
import { genResolvers, readDir } from './tools';
import { wellKnownScalars } from '../converter/scalars';
import { genSubscriptionResolvers } from './streaming';

type GqlConfigs = {
  logger: any;
  formatError: any;
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
    introspection: undefined,
    apolloConfig: undefined,
    logger: undefined,
  };
}

export class RPCServer extends EventEmitter {
  gqlServer: any;
  /**
   * Context function from `graphql.context`. Apollo Server 4 no longer
   * accepts `context` in its constructor, so pass this yourself to
   * `expressMiddleware(rpcServer.gqlServer, { context: rpcServer.gqlContext })`.
   */
  gqlContext: (() => any) | undefined;
  rpcService: RPCService;
  port: any;
  forceShutdown: () => any;
  tryShutdown: () => Promise<unknown>;
  gqlConfigs: GqlConfigs;
  /**
   * `PubSubEngine` backing server-streaming RPCs exposed as GraphQL
   * Subscriptions. Only set if the schema actually has a `Subscription`
   * field (i.e. at least one server-streaming RPC was converted).
   */
  pubsub: any;

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
      introspection,
      apolloConfig,
      logger,
      pubsub,
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
    const { ApolloServer } = require('@apollo/server');
    const { gqlSchema } = this.rpcService;
    registerTypes.push(gqlSchema);

    if (auto) {
      // Provide resolver functions for your schema fields
      // This section will automatically generate functions and resolvers
      registerResolvers.push(genResolvers(this.rpcService.packages));
    }

    // The converter only emits `scalar X` declarations for well-known
    // scalars (Bytes/DateTime/JSON) that are actually referenced by the
    // generated schema — mirror that here, since `makeExecutableSchema`
    // throws if a resolver is supplied for a scalar the schema doesn't
    // declare.
    const usedScalarResolvers = Object.keys(wellKnownScalars).reduce(
      (acc, scalarName) => {
        if (new RegExp(`\\bscalar ${scalarName}\\b`).test(gqlSchema)) {
          acc[scalarName] = wellKnownScalars[scalarName];
        }
        return acc;
      },
      {},
    );

    if (Object.keys(usedScalarResolvers).length > 0) {
      registerResolvers.push(usedScalarResolvers);
    }

    // The converter only emits `extend type Subscription { ... }` when at
    // least one server-streaming RPC was converted; only stand up a PubSub
    // and its resolvers in that case.
    if (/extend type Subscription \{/.test(gqlSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PubSub } = require('graphql-subscriptions');
      this.pubsub = pubsub || new PubSub();

      if (auto) {
        registerResolvers.push(
          genSubscriptionResolvers(
            this.rpcService.packages,
            this.rpcService.packageObject,
            this.pubsub,
          ),
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { makeExecutableSchema } = require('@graphql-tools/schema');

    this.gqlConfigs = {
      logger,
      formatError,
      introspection,
    };

    this.gqlConfigs.schema = makeExecutableSchema({
      typeDefs: registerTypes,
      resolvers: registerResolvers,
      logger,
      // The auto-generated Query/Mutation resolvers (`genResolvers`) are
      // built per-package from the config, independently of the schema the
      // converter actually emits -- a package whose only service(s)
      // contribute nothing to Query/Mutation (e.g. entirely
      // server-streaming) still gets an (unreachable, harmless) resolver
      // entry for it. Warn instead of hard-failing on that specific,
      // narrow mismatch rather than crashing server startup over a
      // resolver nothing will ever call.
      resolverValidationOptions: { requireResolversToMatchSchema: 'warn' },
    });

    this.gqlConfigs = Object.assign(this.gqlConfigs, apolloConfig);
    this.gqlContext = context;
    this.gqlServer = new ApolloServer(this.gqlConfigs);
  }

  /**
   * Wire up GraphQL Subscriptions over WebSocket (`graphql-ws`), attached to
   * an `http.Server` you already own — the same one you get back from
   * `app.listen()`. Apollo Server 4 dropped built-in subscription transport,
   * so this is required for any `Subscription` fields (server-streaming
   * RPCs) to be reachable; the HTTP endpoint alone can't serve them.
   *
   * Mirrors the existing "bring your own Express app, call
   * `expressMiddleware` yourself" pattern used for the HTTP endpoint.
   */
  useSubscriptions(httpServer: http.Server, opts: { path?: string } = {}) {
    if (!this.gqlConfigs || !this.gqlConfigs.schema) {
      throw new Error('GraphQL is not enabled');
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { WebSocketServer } = require('ws');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useServer } = require('graphql-ws/use/ws');

    const wsServer = new WebSocketServer({
      server: httpServer,
      path: opts.path || '/graphql',
    });

    return useServer(
      { schema: this.gqlConfigs.schema, context: this.gqlContext },
      wsServer,
    );
  }
}

export type ServerConstructorParams = {
  ip?: string;
  port?: number;
  grpc: RPCServiceGrpcParams;
  graphql?: boolean | ParamGraphql;
  creds?: grpc.ServerCredentials;
};
