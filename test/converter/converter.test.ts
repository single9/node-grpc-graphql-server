import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { gql } from 'apollo-server-express';
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

    const gqlDefinition = gql`
      ${gqlSchema}
    `;

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

    const gqlDefinition = gql`
      ${gqlSchema}
    `;

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

    const gqlDefinition = gql`
      ${gqlSchema}
    `;

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
});
