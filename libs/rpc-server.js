const grpc = require('grpc');
const EventEmitter = require('events').EventEmitter;
const { ApolloServer, gql } = require('apollo-server-express');
const RPCService = require('./rpc-service.js');
const { genResolvers } = require('./tools.js');

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
    if (graphql !== true) return this;
    // Construct a schema, using GraphQL schema language from
    // protobuf to GraphQL converter
    const typeDefs = gql`${this.rpcService.gqlSchema}`;
    // Provide resolver functions for your schema fields
    // This section will automatically generate functions and resolvers
    let resolvers = genResolvers(packages);
    this.gqlServer = new ApolloServer({ typeDefs, resolvers });

    console.log('GraphQL Server is enabled.');
  }
}

module.exports = RPCServer;

/**
 * @typedef  {object} ServerConstructorParams
 * @property {string|string[]}               [protoFile]
 * @property {string}                        ip
 * @property {number}                        port
 * @property {boolean}                       [graphql=true]
 * @property {grpc.ServerCredentials}        [creds]
 * @property {RPCService.RPCServicePackages} packages
 */
