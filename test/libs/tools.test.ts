import * as fs from 'fs';
import * as tools from '../../src/libs/tools';

describe('Test libs/tools', () => {
  // beforeAll(() => {

  // })

  it('should read directories', () => {
    const results = tools.readDir(`${__dirname}/../../examples`, 'js');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBeTruthy();
  });

  it('should return empty array because of path is not directory', () => {
    const result = tools.readDir(`${__dirname}/tools.test.ts`, '.js');
    expect(result).toEqual([`${__dirname}/tools.test.ts`]);
  });

  it('should throw error if path or extname is not specified', () => {
    expect(() => tools.readDir(null as unknown as string, '.js')).toThrowError(
      '`dir` must be specified.',
    );

    expect(() => tools.readDir('test', null as unknown as string)).toThrowError(
      '`extname` must be specified.',
    );
  });

  it('should generated gRPC JS code', () => {
    const output = `${__dirname}/tmp`;

    tools.genGrpcJs(`${__dirname}/../../examples/protos`, output);

    const files = tools.readDir(output, '.js');

    expect(Array.isArray(files)).toBeTruthy();
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate resolver', () => {
    const result = tools.genResolvers([
      {
        name: 'test',
        services: [
          {
            name: 'good',
            implementation: {
              test: () => {
                return true;
              },
            },
          },
        ],
      },
    ]);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('Query');
    expect(result).toHaveProperty('Mutation');
  });

  it('should generate resolver without Query', () => {
    const result = tools.genResolvers([
      {
        name: 'test',
        services: [
          {
            name: 'good',
            query: false,
            implementation: {
              test: () => {
                return true;
              },
            },
          },
        ],
      },
    ]);

    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('Query');
    expect(result).toHaveProperty('Mutation');
  });

  it('should generate resolver without Mutation', () => {
    const result = tools.genResolvers([
      {
        name: 'test',
        services: [
          {
            name: 'good',
            mutate: false,
            implementation: {
              test: () => {
                return true;
              },
            },
          },
        ],
      },
    ]);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('Query');
    expect(result).not.toHaveProperty('Mutation');
  });

  it('should not  resolver without Mutation', () => {
    expect(() => {
      tools.genResolverType('abc', [
        {
          name: 'test',
          services: [
            {
              name: 'good',
              mutate: false,
              implementation: {
                test: () => {
                  return true;
                },
              },
            },
          ],
        },
      ]);
    }).toThrow('Invalid type: abc');
  });

  it('should recursive get package data from name', () => {
    const name = 'sub.main.v1';
    const result = tools.recursiveGetPackage(name.split('.'), {
      sub: {
        main: {
          v1: {
            data1: 1,
            data2: 2,
          },
        },
      },
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('data1', 1);
    expect(result).toHaveProperty('data2', 2);
  });

  it('should read protobuf files', () => {
    const result = tools.readProtofiles(`${__dirname}/../../examples/protos`);
    expect(result).toBeDefined();
  });

  it('should convert hyphens to camel case', () => {
    const result = tools.hyphensToCamelCase('good-sample');
    expect(result).toBe('goodSample');
  });

  it('should convert hyphens to camel case and uppercase first letter', () => {
    const result = tools.hyphensToCamelCase('good-sample', true);
    expect(result).toBe('GoodSample');
  });

  afterAll(() => {
    fs.rmSync(`${__dirname}/tmp`, { recursive: true });
  });
});
