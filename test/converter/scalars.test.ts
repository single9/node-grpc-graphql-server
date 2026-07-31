import {
  Kind,
  valueFromASTUntyped,
  parseValue as parseValueNode,
} from 'graphql';
import {
  GraphQLBytes,
  GraphQLDateTime,
  GraphQLJSON,
} from '../../src/converter/scalars';

function astFor(literal: string) {
  return parseValueNode(literal);
}

describe('GraphQLBytes', () => {
  it('serializes a Buffer to base64', () => {
    const buf = Buffer.from('hello', 'utf8');
    expect(GraphQLBytes.serialize(buf)).toBe(buf.toString('base64'));
  });

  it('serializes a Uint8Array to base64', () => {
    const arr = new Uint8Array([104, 105]); // "hi"
    expect(GraphQLBytes.serialize(arr)).toBe('aGk=');
  });

  it('throws when serializing a non-buffer, non-string value', () => {
    expect(() => GraphQLBytes.serialize(42)).toThrow(TypeError);
  });

  it('parses a base64 string value into a Buffer', () => {
    const result = GraphQLBytes.parseValue('aGk=') as Buffer;
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString('utf8')).toBe('hi');
  });

  it('throws when parsing a non-string value', () => {
    expect(() => GraphQLBytes.parseValue(123)).toThrow(TypeError);
  });

  it('parses a string literal into a Buffer', () => {
    const result = GraphQLBytes.parseLiteral(astFor('"aGk="'), {}) as Buffer;
    expect(result.toString('utf8')).toBe('hi');
  });

  it('throws when parsing a non-string literal', () => {
    expect(() => GraphQLBytes.parseLiteral(astFor('123'), {})).toThrow(
      TypeError,
    );
  });
});

describe('GraphQLDateTime', () => {
  const iso = '2024-01-15T10:30:00.000Z';

  it('serializes a Date instance to ISO 8601', () => {
    expect(GraphQLDateTime.serialize(new Date(iso))).toBe(iso);
  });

  it('serializes an ISO string to a normalized ISO string', () => {
    expect(GraphQLDateTime.serialize(iso)).toBe(iso);
  });

  it('serializes a structural {seconds, nanos} Timestamp to ISO 8601', () => {
    const seconds = Math.floor(Date.parse(iso) / 1000);
    expect(
      GraphQLDateTime.serialize({ seconds: String(seconds), nanos: 0 }),
    ).toBe(iso);
  });

  it('throws when serializing an unsupported value', () => {
    expect(() => GraphQLDateTime.serialize(42)).toThrow(TypeError);
  });

  it('parses an ISO string into a structural {seconds, nanos} Timestamp', () => {
    const result = GraphQLDateTime.parseValue(iso) as {
      seconds: string;
      nanos: number;
    };
    expect(result.seconds).toBe(String(Math.floor(Date.parse(iso) / 1000)));
    expect(result.nanos).toBe(0);
  });

  it('throws when parsing an invalid ISO string', () => {
    expect(() => GraphQLDateTime.parseValue('not-a-date')).toThrow(TypeError);
  });

  it('throws when parsing a non-string value', () => {
    expect(() => GraphQLDateTime.parseValue(42)).toThrow(TypeError);
  });

  it('parses a string literal into a structural Timestamp', () => {
    const result = GraphQLDateTime.parseLiteral(astFor(`"${iso}"`), {}) as {
      seconds: string;
    };
    expect(result.seconds).toBe(String(Math.floor(Date.parse(iso) / 1000)));
  });

  it('throws when parsing a non-string literal', () => {
    expect(() => GraphQLDateTime.parseLiteral(astFor('123'), {})).toThrow(
      TypeError,
    );
  });

  it('round-trips through serialize(parseValue(x))', () => {
    const roundTripped = GraphQLDateTime.serialize(
      GraphQLDateTime.parseValue(iso),
    );
    expect(roundTripped).toBe(iso);
  });
});

describe('GraphQLJSON', () => {
  it('serializes and parses values as identity', () => {
    const value = { a: 1, b: ['x', 'y'], c: null };
    expect(GraphQLJSON.serialize(value)).toBe(value);
    expect(GraphQLJSON.parseValue(value)).toBe(value);
  });

  it('parses an object literal', () => {
    const result = GraphQLJSON.parseLiteral(
      astFor('{ a: 1, b: "two", c: true, d: null }'),
      {},
    );
    expect(result).toEqual({ a: 1, b: 'two', c: true, d: null });
  });

  it('parses a list literal', () => {
    const result = GraphQLJSON.parseLiteral(astFor('[1, 2, "three"]'), {});
    expect(result).toEqual([1, 2, 'three']);
  });

  it('resolves a variable literal from the variables map', () => {
    const ast = {
      kind: Kind.VARIABLE,
      name: { kind: Kind.NAME, value: 'foo' },
    } as const;
    expect(GraphQLJSON.parseLiteral(ast as any, { foo: 'bar' })).toBe('bar');
  });

  it('is consistent with graphql-js AST value extraction for scalars', () => {
    expect(valueFromASTUntyped(astFor('42'))).toBe(42);
  });
});
