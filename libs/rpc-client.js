const RPCService = require('./rpc-service.js');

class RPCClient extends RPCService {
  /**
   * Creates instance of RPC Client.
   * @param {ClientConstructorParams}      params
   * @param {protoLoader.Options}          opts 
   */
  constructor({protoFile, packages}, opts) {
    super({protoFile, packages}, opts);
    return this.clients;
  }
}

/**
 * Creates instance of RPC Client.
 * @param {ClientConstructorParams} param0 
 * @param {protoLoader.Options} opts 
 */
module.exports = RPCClient;

/**
 * @typedef  {object} ClientConstructorParams
 * @property {string|string[]}               [protoFile]
 * @property {RPCService.RPCServicePackages} packages
 */
