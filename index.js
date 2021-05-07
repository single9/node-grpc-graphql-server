const grpc = require('@grpc/grpc-js');
const RPCServer = require('./libs/rpc-server.js');
const RPCService = require('./libs/rpc-service.js');
const RPCClient = require('./libs/rpc-client.js');
const Controller = require('./libs/controller.js');

module.exports = {
  RPCServer,
  RPCService,
  Controller,
  RPCClient,
  /** @type {grpc} */
  grpc,
};
