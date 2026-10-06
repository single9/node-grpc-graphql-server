import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { parse } from 'graphql';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { readProtofiles } from '../../src/libs/tools';
import converter from '../../src/converter/index';

describe('Test converter', () => {
  let packageDefinition: protoLoader.PackageDefinition | PackageDefinition;
  let packageDefinitionObjects: grpc.GrpcObject;

  beforeAll(() => {
    packageDefinition = protoLoader.loadSync(
      readProtofiles(process.cwd() + '/examples/protos'),
    );
    packageDefinitionObjects = grpc.loadPackageDefinition(packageDefinition);
  });

  it('should convert the helloworld protobuf object to GraphQL schema', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          },
        ],
      },
    ]);

    const gqlDefinition = parse(gqlSchema);

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'helloworld_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Greeter_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'calculator_query',
      ),
    ).toBeUndefined();

    expect(gqlSchema).not.toBeUndefined();
    done();
  });

  it('should convert the multiple protobuf object to GraphQL schema', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          },
        ],
      },
      {
        name: 'calculator',
        services: [
          {
            name: 'Simple',
          },
        ],
      },
    ]);

    const gqlDefinition = parse(gqlSchema);

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'helloworld_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Greeter_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'calculator_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'calculator_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Simple_query',
      ),
    ).toBeTruthy();
    done();
  });

  it('should convert the multiple protobuf object and disable caculator query', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          },
        ],
      },
      {
        name: 'calculator',
        services: [
          {
            name: 'Simple',
            query: false,
          },
          {
            name: 'complex',
            query: false,
          },
        ],
      },
    ]);

    const gqlDefinition = parse(gqlSchema);

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'helloworld_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Greeter_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'calculator_query',
      ),
    ).toBeUndefined();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Simple_query',
      ),
    ).toBeTruthy();

    done();
  });

  it('should not throw when query/mutate is set to boolean true', (done) => {
    expect(() =>
      converter(packageDefinitionObjects, [
        {
          name: 'helloworld',
          services: [
            {
              name: 'Greeter',
              mutate: true,
            },
          ],
        },
      ]),
    ).not.toThrow();
    done();
  });

  it('should support query/mutate as an allow-list of method names', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
            query: ['SayHello'],
            mutate: ['SayHello'],
          },
        ],
      },
    ]);

    const gqlDefinition = parse(gqlSchema);

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Greeter_query',
      ),
    ).toBeTruthy();

    expect(
      gqlDefinition.definitions.find(
        (def) => def['name']['value'] === 'Greeter_mutate',
      ),
    ).toBeTruthy();
    done();
  });
});
