import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { parse } from 'graphql';
import converter from '../../src/converter/index';

// grpc-tools bundles the `google/protobuf/*.proto` well-known-type sources
// used by these fixtures; it's already a devDependency here.
const includeDirs = [`${process.cwd()}/node_modules/grpc-tools/bin`];
const loaderOpts: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs,
};

describe('Test converter type coverage', () => {
  let sdl: string;

  beforeAll(() => {
    const packageDefinition = protoLoader.loadSync(
      `${process.cwd()}/test/sample/protos/coverage.proto`,
      loaderOpts,
    );
    const packageObjects = grpc.loadPackageDefinition(packageDefinition);

    sdl = converter(packageObjects, [
      {
        name: 'coverage',
        services: [{ name: 'ItemSvc' }],
      },
    ]);
  });

  it('produces SDL that parses cleanly', () => {
    expect(() => parse(sdl)).not.toThrow();
  });

  it('maps `bytes` to the Bytes scalar, not String', () => {
    expect(sdl).toMatch(/scalar Bytes/);
    expect(sdl).toMatch(/payload: Bytes!/);
  });

  it('maps 64-bit integer fields to String (not Int, to avoid precision loss)', () => {
    expect(sdl).toMatch(/big: String!/);
    expect(sdl).toMatch(/ubig: String!/);
  });

  it('resolves a message nested inside another message to a real registered type', () => {
    expect(sdl).toMatch(/type Item_Inner \{\s*note: String!\s*\}/);
    expect(sdl).toMatch(/inner: Item_Inner!/);
    expect(sdl).toMatch(/many_inner: \[Item_Inner!\]/);
  });

  it('resolves a `map<string, string>` field to a real registered entry type', () => {
    expect(sdl).toMatch(
      /type Item_Tags \{\s*key: String!\s*value: String!\s*\}/,
    );
    expect(sdl).toMatch(/tags: \[Item_Tags!\]/);
  });

  it('maps `google.protobuf.Timestamp` to the DateTime scalar', () => {
    expect(sdl).toMatch(/scalar DateTime/);
    expect(sdl).toMatch(/created_at: DateTime!/);
  });

  it('registers the response type as a GraphQL `type`, not `input`, even when a differently-named request type is used', () => {
    expect(sdl).toMatch(/type Item \{/);
    expect(sdl).not.toMatch(/input Item \{/);
  });

  it('throws a clear error instead of producing invalid SDL when a well-known type is used directly as an RPC request/response type', () => {
    const packageDefinition = protoLoader.loadSync(
      `${process.cwd()}/test/sample/protos/well-known-direct.proto`,
      loaderOpts,
    );
    const packageObjects = grpc.loadPackageDefinition(packageDefinition);

    expect(() =>
      converter(packageObjects, [
        {
          name: 'coverageErr',
          services: [{ name: 'PingSvc' }],
        },
      ]),
    ).toThrow(/Unknown type reference 'Empty'/);
  });
});
