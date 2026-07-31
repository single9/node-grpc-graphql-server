import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { buildASTSchema, parse } from 'graphql';
import converter from '../../src/converter/index';

describe('Test converter streaming RPC classification', () => {
  let sdl: string;

  beforeAll(() => {
    const packageDefinition = protoLoader.loadSync(
      `${process.cwd()}/test/sample/protos/streaming.proto`,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );
    const packageObjects = grpc.loadPackageDefinition(packageDefinition);

    sdl = converter(packageObjects, [
      {
        name: 'streaming',
        services: [{ name: 'StreamSvc' }],
      },
    ]);
  });

  it('produces SDL that parses cleanly', () => {
    expect(() => parse(sdl)).not.toThrow();
  });

  it('exposes the unary method as a query/mutate field, unchanged', () => {
    expect(sdl).toMatch(
      /type StreamSvc_query \{\s*Unary\(request: Req\): Res!\s*\}/,
    );
    expect(sdl).toMatch(
      /type StreamSvc_mutate \{\s*Unary\(request: Req\): Res!\s*\}/,
    );
  });

  it('exposes the server-streaming method as a flat Subscription field', () => {
    expect(sdl).toMatch(
      /extend type Subscription \{\s*streaming_StreamSvc_ServerStream\(request: Req\): Res!\s*\}/,
    );
  });

  it('does not expose the server-streaming method as a query or mutation', () => {
    const queryBlock = sdl.match(/type StreamSvc_query \{[\s\S]*?\}/)[0];
    const mutateBlock = sdl.match(/type StreamSvc_mutate \{[\s\S]*?\}/)[0];
    expect(queryBlock).not.toMatch(/ServerStream/);
    expect(mutateBlock).not.toMatch(/ServerStream/);
  });

  it('excludes client-streaming and bidi-streaming methods from GraphQL entirely', () => {
    expect(sdl).not.toMatch(/ClientStream/);
    expect(sdl).not.toMatch(/BidiStream/);
  });

  it('respects service.exclude for a streaming method', () => {
    const packageDefinition = protoLoader.loadSync(
      `${process.cwd()}/test/sample/protos/streaming.proto`,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );
    const packageObjects = grpc.loadPackageDefinition(packageDefinition);

    const excludedSdl = converter(packageObjects, [
      {
        name: 'streaming',
        services: [{ name: 'StreamSvc', exclude: ['ServerStream'] }],
      },
    ]);

    expect(excludedSdl).not.toMatch(/ServerStream/);
  });
});

describe('Test converter for a service with only a streaming method', () => {
  // examples/protos/streaming.proto's TickerSvc has exactly one method
  // (Watch), and it's server-streaming -- so the service contributes
  // nothing to Query/Mutation at all.
  it('omits Query/Mutation entirely instead of leaving a dangling reference', () => {
    const packageDefinition = protoLoader.loadSync(
      `${process.cwd()}/examples/protos/streaming.proto`,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );
    const packageObjects = grpc.loadPackageDefinition(packageDefinition);

    const sdl = converter(packageObjects, [
      { name: 'ticker', services: [{ name: 'TickerSvc' }] },
    ]);

    expect(sdl).not.toMatch(/extend type Query/);
    expect(sdl).not.toMatch(/extend type Mutation/);
    expect(sdl).toMatch(/extend type Subscription/);
    expect(() => buildASTSchema(parse(sdl))).not.toThrow();
  });
});
