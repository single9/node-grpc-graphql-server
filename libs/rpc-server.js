const grpc = require('grpc');
const EventEmitter = require('events').EventEmitter;
const { ApolloServer, makeExecutableSchema, gql } = require('apollo-server-express');
const RPCService = require('./rpc-service.js');
const { genResolvers, readDir } = require('./tools.js');

class RPCServer extends EventEmitter {
  /**
   * Creates an instance of RPC Server
   * @param {ServerConstructorParams} param0 
   */
  constructor({protoFile, ip = '0.0.0.0', port = 50051, creds, graphql, packages}) {
    super();

    this.gqlServer = undefined;
    this.rpcService = new RPCService({
      protoFile,
      grpcServer: new grpc.Server(),
      packages,
      graphql,
    });

    this.rpcService.grpcServer.bind(ip + ':' + port, creds || grpc.ServerCredentials.createInsecure());
    this.rpcService.grpcServer.start();

    console.log('gRPC Server started %s:%d', ip, port);

    // GraphQL server is not running by default. Set `graphql` to enabled.
    if (((typeof graphql === 'boolean') && graphql !== true) || (graphql !== true && graphql.enable !== true)) {
      return this;
    }
    
    const { schemaPath, resolverPath } = graphql;

    const rootTypeDefs = `
      type Query{
        _: String
      }
      type Mutation {
        _: String
      }
    `;

    let auto = (graphql.auto !== undefined) ? graphql.auto: true;
    let registerTypes = [ rootTypeDefs ];
    let registerResolvers = [];
    
    if (schemaPath && resolverPath) {
      const schemas = readDir(schemaPath, '.js');
      const controllers = readDir(resolverPath, '.js');
      schemas.map( x => registerTypes.push(require(x)));
      controllers.map( x => registerResolvers.push(require(x)));
    }

    if (auto) {
      // Construct a schema, using GraphQL schema language from
      // protobuf to GraphQL converter
      const gqlSchema = this.rpcService.gqlSchema;
      if (!gqlSchema) {
        console.warn('GraphQL Server start failed due to missing schema.');
        return this;
      }
      // Provide resolver functions for your schema fields
      // This section will automatically generate functions and resolvers
      registerTypes.push(gql`${gqlSchema}`);
      registerResolvers.push(genResolvers(this.rpcService.packages));
    }

    const schema = makeExecutableSchema({
      typeDefs: registerTypes,
      resolvers: registerResolvers,
      logger: { log: e => console.log(e) }
    });

    this.gqlServer = new ApolloServer({schema});

    console.log('GraphQL Server is enabled.');
  }
}

module.exports = RPCServer;

/**
 * @typedef  {object} ServerConstructorParams
 * @property {string|string[]}               [protoFile]
 * @property {string}                        ip
 * @property {number}                        port
 * @property {GraphqlProperty|boolean}       [graphql]
 * @property {grpc.ServerCredentials}        [creds]
 * @property {RPCService.RPCServicePackages} packages
 */

/**
 * @typedef   {object} GraphqlProperty
 * @property  {boolean}   [enable=false]    Set to true to enable GraphQL
 * @property  {string}    [schemaPath]      Path of yours GraphQL schema (required if you want to create yours GraphQL)
 * @property  {string}    [resolverPath]    Path of yours GraphQL resolver (required if you want to create yours GraphQL)
 */
