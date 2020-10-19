const grpc = require('grpc');
const EventEmitter = require('events').EventEmitter;
const { ApolloServer, gql } = require('apollo-server-express');
const RPCService = require('./rpc-service.js');

class RPCServer extends EventEmitter {
  /**
   * Creates an instance of RPC Server
   * @param {ServerConstructorParams} param0 
   */
  constructor({ip = '0.0.0.0', port = 50051, creds, graphql, packages}) {
    super();

    this.gqlServer = undefined;
    this.rpcService = new RPCService({
      grpcServer: new grpc.Server(),
      packages
    });

    this.rpcService.grpcServer.bind(ip + ':' + port, creds || grpc.ServerCredentials.createInsecure());
    this.rpcService.grpcServer.start();

    console.log('gRPC Server started %s:%d', ip, port);

    if (graphql !== true) return this;
    // Construct a schema, using GraphQL schema language from
    // protobuf to GraphQL converter
    const typeDefs = gql`${this.rpcService.gqlSchema}`;
    // Provide resolver functions for your schema fields
    // This section will automatically generate functions via packages
    let Query = {};
    packages.forEach(pack => {
      let serviceFn = {};

      pack.services.forEach(service => {
        if (service.query === false || service.grpcOnly) return;
        serviceFn[service.name] = () => service.implementation;
      });

      if (!Query[pack.name] && Object.keys(serviceFn).length > 0)
        Query[pack.name] = function() {
          return serviceFn;
        };
    });

    let Mutation = {};
    packages.forEach(pack => {
      let serviceFn = {};

      pack.services.forEach(service => {
        if (service.mutate === false || service.grpcOnly) return;
        serviceFn[service.name] = () => service.implementation;
      });

      if (!Mutation[pack.name] && Object.keys(serviceFn).length > 0)
        Mutation[pack.name] = function() {
          return serviceFn;
        };
    });

    let resolvers = {};
    if (Object.keys(Query).length > 0) {
      resolvers.Query = Query;
    }

    if (Object.keys(Mutation).length > 0) {
      resolvers.Mutation = Mutation;
    }

    this.gqlServer = new ApolloServer({ typeDefs, resolvers });

    console.log('GraphQL Server is enabled.');
  }
}

module.exports = RPCServer;

/**
 * @typedef  {object} ServerConstructorParams
 * @property {string}                        ip
 * @property {number}                        port
 * @property {boolean}                       [graphql=true]
 * @property {grpc.ServerCredentials}        [creds]
 * @property {RPCService.RPCServicePackages} packages
 */
