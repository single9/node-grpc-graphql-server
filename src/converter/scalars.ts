import { GraphQLScalarType, Kind, ValueNode } from 'graphql';

/**
 * Structural shape `@grpc/proto-loader` decodes `google.protobuf.Timestamp`
 * into (with `longs: String` configured, `seconds` arrives as a string).
 */
type StructuralTimestamp = { seconds: string | number; nanos: number };

function timestampFromIso(value: unknown): StructuralTimestamp {
  if (typeof value !== 'string') {
    throw new TypeError('DateTime must be an ISO 8601 string');
  }

  const ms = Date.parse(value);

  if (Number.isNaN(ms)) {
    throw new TypeError(
      `DateTime received an invalid ISO 8601 string: ${value}`,
    );
  }

  // `seconds` is floored, so `nanos` must be the non-negative remainder
  // (protobuf requires 0 <= nanos < 1e9) -- `ms % 1000` alone goes negative
  // for pre-1970 timestamps.
  const seconds = Math.floor(ms / 1000);

  return {
    seconds: String(seconds),
    nanos: (ms - seconds * 1000) * 1e6,
  };
}

export const GraphQLBytes = new GraphQLScalarType({
  name: 'Bytes',
  description:
    'Binary data (protobuf `bytes`), represented as a base64-encoded string.',
  serialize(value) {
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (value instanceof Uint8Array)
      return Buffer.from(value).toString('base64');
    if (typeof value === 'string') return value;
    throw new TypeError(`Bytes cannot serialize value: ${value}`);
  },
  parseValue(value) {
    if (typeof value !== 'string') {
      throw new TypeError('Bytes must be a base64-encoded string');
    }
    return Buffer.from(value, 'base64');
  },
  parseLiteral(ast: ValueNode) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError('Bytes must be a base64-encoded string');
    }
    return Buffer.from(ast.value, 'base64');
  },
});

export const GraphQLDateTime = new GraphQLScalarType({
  name: 'DateTime',
  description:
    'A point in time (protobuf `google.protobuf.Timestamp`), represented as an ISO 8601 string.',
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();

    if (value && typeof value === 'object' && 'seconds' in (value as object)) {
      const { seconds, nanos } = value as StructuralTimestamp;
      return new Date(
        Number(seconds) * 1000 + Number(nanos || 0) / 1e6,
      ).toISOString();
    }

    throw new TypeError(`DateTime cannot serialize value: ${value}`);
  },
  parseValue(value) {
    return timestampFromIso(value);
  },
  parseLiteral(ast: ValueNode) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError('DateTime must be an ISO 8601 string');
    }
    return timestampFromIso(ast.value);
  },
});

function parseJsonLiteral(
  ast: ValueNode,
  variables?: Record<string, any> | null,
): any {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT: {
      const value: Record<string, any> = {};
      ast.fields.forEach((field) => {
        value[field.name.value] = parseJsonLiteral(field.value, variables);
      });
      return value;
    }
    case Kind.LIST:
      return ast.values.map((value) => parseJsonLiteral(value, variables));
    case Kind.NULL:
      return null;
    case Kind.VARIABLE:
      return variables ? variables[ast.name.value] : undefined;
    default:
      return undefined;
  }
}

export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description:
    'Arbitrary JSON-serializable data. Used for protobuf well-known "dynamic" types (`Struct`, `Value`, `ListValue`, `Any`), which are recursive/`oneof`-based and cannot be modeled as static GraphQL SDL.',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast, variables) => parseJsonLiteral(ast, variables),
});

export const wellKnownScalars = {
  Bytes: GraphQLBytes,
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
};
