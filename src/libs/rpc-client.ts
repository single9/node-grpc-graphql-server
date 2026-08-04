import * as grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { recursiveGetPackage, replacePackageName } from './tools';
import RPCService, {
  gRPCServiceClients,
  RPCServiceGrpcParams,
} from './rpc-service';

export type ClientConstructorParams = {
  protoFile?: string | string[];
  packages: RPCServiceGrpcParams['packages'];
};

export type InitRPCClientParams = ClientConstructorParams & {
  /**
   * Return the `RPCClient` instance itself instead of its `.clients` map.
   * Needed to listen for events (e.g. `grpc_client_error`), which are
   * emitted on the instance, not on the per-service function map.
   */
  originalClass?: boolean;
};

/**
 * Builds a `grpc.Metadata` from the `{ metadata: [[key, value], ...] }`
 * convenience shape accepted throughout this wrapper's call options.
 */
function buildMetadataFromOpts(opts: any): grpc.Metadata {
  const metadata = new grpc.Metadata();

  if (opts && opts.metadata && Array.isArray(opts.metadata)) {
    opts.metadata.forEach((iMeta: string[]) => {
      metadata.set(iMeta[0], iMeta[1]);
    });
  }

  return metadata;
}

export class RPCClient extends RPCService {
  /**
   * Creates instance of RPC Client.
   * @param {ClientConstructorParams}      params
   * @param {protoLoader.Options}          opts
   */
  constructor(
    { protoFile, packages }: ClientConstructorParams,
    opts?: protoLoader.Options,
  ) {
    super({ grpc: { protoFile, packages } }, opts);
  }

  init() {
    // main process
    if (Array.isArray(this.packages) === false)
      throw new Error('Unable to initialize');
    // load definitions from packages
    const packageDefinition = grpc.loadPackageDefinition(
      this.packageDefinition,
    );

    this.packages.forEach((pack) => {
      const packNames = pack.name.split('.');
      const packageName = replacePackageName(pack.name);
      const packageObject = recursiveGetPackage(packNames, packageDefinition);
      this.packageObject[packageName] = packageObject;

      // gRPC client mode
      pack.services.forEach((service) => {
        const _service = service;
        if (!this.clients[packageName]) {
          this.clients[packageName] = {};
        }
        _service.host = _service.host || 'localhost';
        _service.port = _service.port || 50051;
        const host = `${_service.host}:${_service.port}`;
        const serviceFunctionsKey = Object.keys(
          packageObject[_service.name].service,
        );
        const serviceClient = new packageObject[_service.name](
          host || 'localhost:50051',
          _service.creds || grpc.credentials.createInsecure(),
        );

        const newFunctions = { ...serviceClient };

        Object.assign(newFunctions, {
          close: serviceClient.close.bind(serviceClient),
          getChannel: serviceClient.getChannel.bind(serviceClient),
        });

        const emitClientError = (err: any, request: any, fnName: string) => {
          const errDetails = {
            error: err,
            call: { service: _service.name, function: fnName, request },
          };
          this.emit('grpc_client_error', errDetails);
          err.call = errDetails.call;
        };

        serviceFunctionsKey.forEach((fnName) => {
          const methodDescriptor = packageObject[_service.name].service[fnName];

          if (
            methodDescriptor.requestStream &&
            methodDescriptor.responseStream
          ) {
            // Bidi-streaming: no initial request argument at the gRPC level
            // (both sides are opened via the returned duplex stream) and no
            // single final response to promise-ify -- just return the
            // native `ClientDuplexStream`.
            newFunctions[fnName] = (opts?: {
              metadata?: Array<[string, any]>;
            }) => {
              const metadata = buildMetadataFromOpts(opts);
              const call = serviceClient[fnName](metadata);
              call.on('error', (err: any) =>
                emitClientError(err, undefined, fnName),
              );
              return call;
            };
            return;
          }

          if (methodDescriptor.requestStream) {
            // Client-streaming: request is sent via `call.write()`/`call.end()`
            // on the returned `ClientWritableStream`, not as an argument here.
            // gRPC always requires a callback for the single final response;
            // if the caller doesn't supply one, auto-wire a Promise and
            // attach it directly onto the returned stream (`.then`/`.catch`/
            // `.finally`), so the same value supports both
            // `call.write(x); call.end();` and `const res = await call;`.
            newFunctions[fnName] = (
              opts?:
                | { metadata?: Array<[string, any]> }
                | ((err: any, response: any) => void),
              callback?: (err: any, response: any) => void,
            ) => {
              let _opts = opts;
              let _callback = callback;

              if (typeof _opts === 'function') {
                _callback = _opts;
                _opts = undefined;
              }

              const metadata = buildMetadataFromOpts(_opts);

              if (typeof _callback === 'function') {
                return serviceClient[fnName](
                  metadata,
                  (err: any, response: any) => {
                    if (err) emitClientError(err, undefined, fnName);
                    _callback(err, response);
                  },
                );
              }

              let resolveFn: (value: any) => void;
              let rejectFn: (reason: any) => void;
              const promise = new Promise((resolve, reject) => {
                resolveFn = resolve;
                rejectFn = reject;
              });

              const call = serviceClient[fnName](
                metadata,
                (err: any, response: any) => {
                  if (err) {
                    emitClientError(err, undefined, fnName);
                    rejectFn(err);
                    return;
                  }
                  resolveFn(response);
                },
              );

              call.then = promise.then.bind(promise);
              call.catch = promise.catch.bind(promise);
              call.finally = promise.finally.bind(promise);
              return call;
            };
            return;
          }

          if (methodDescriptor.responseStream) {
            // Server-streaming: no callback at the gRPC level -- returns a
            // `ClientReadableStream` immediately, which already supports
            // `.on('data'/'end'/'error')` and `for await` natively (it's a
            // Node `Readable`); no promise wrapping makes sense for multiple
            // values over time.
            newFunctions[fnName] = (
              request?: any,
              opts?: { metadata?: Array<[string, any]> },
            ) => {
              const metadata = buildMetadataFromOpts(opts);
              const call = serviceClient[fnName](request || {}, metadata);
              call.on('error', (err: any) =>
                emitClientError(err, request, fnName),
              );
              return call;
            };
            return;
          }

          // Unary -- unchanged.
          newFunctions[fnName] = (...args) => {
            // ensure passing an object to function. Because gRPC need.
            const _args = args;
            const firstArg = _args.shift() || {};

            if (typeof firstArg === 'function') {
              return serviceClient[fnName]({}, firstArg);
            }

            // add metadata
            const metadata = new grpc.Metadata();
            if (
              _args[0] &&
              _args[0].metadata &&
              Array.isArray(_args[0].metadata)
            ) {
              const inputMetadata = _args[0].metadata;
              inputMetadata.forEach((iMeta: string[]) => {
                metadata.set(iMeta[0], iMeta[1]);
              });
              _args[0] = metadata;
            }

            const newArgs = [firstArg, ..._args];
            if (typeof newArgs[newArgs.length - 1] !== 'function') {
              // wrap with promise if callback is not a function
              return new Promise((resolve, reject) => {
                serviceClient[fnName](firstArg, metadata, (err, response) => {
                  if (err) {
                    emitClientError(err, args[0], fnName);
                    reject(err);
                    return;
                  }
                  resolve(response);
                });
              });
            }
            return serviceClient[fnName](...newArgs);
          };
        });
        // map functions
        this.clients[packageName][service.name] = newFunctions;
      });
    });
  }
}

export function initRPCClient(
  params: InitRPCClientParams & { originalClass: true },
  opts?: protoLoader.Options,
): RPCClient;
export function initRPCClient(
  params: ClientConstructorParams,
  opts?: protoLoader.Options,
): gRPCServiceClients;
export function initRPCClient(
  { protoFile, packages, originalClass }: InitRPCClientParams,
  opts?: protoLoader.Options,
): RPCClient | gRPCServiceClients {
  const rpcClient = new RPCClient({ protoFile, packages }, opts);
  return originalClass ? rpcClient : rpcClient.clients;
}
