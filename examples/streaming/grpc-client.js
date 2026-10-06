// `initRPCClient`/`RPCClient` (this library's client wrapper) only supports
// unary calls today -- it always wraps a method as a single
// request/response, which doesn't fit a server-streaming call. Streaming
// RPCs are still fully usable over plain gRPC, just via `@grpc/grpc-js`
// directly, as below (or from any other language's gRPC client).
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync(`${__dirname}/../protos/streaming.proto`, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);

const client = new proto.ticker.TickerSvc(
  'localhost:50051',
  grpc.credentials.createInsecure(),
);

const call = client.Watch({ symbol: 'ACME', count: 5 });

call.on('data', (tick) => console.log('tick:', tick));
call.on('end', () => console.log('stream ended'));
call.on('error', (err) => console.error('stream error:', err));
