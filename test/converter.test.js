require('should');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { gql } = require('apollo-server-express');
const converter = require('../converter');
const { readProtofiles } = require('../libs/tools');

describe('Test converter', () => {
  let packageDefinition, packageDefinitionObjects;

  before(() => {
    packageDefinition = protoLoader.loadSync(readProtofiles(__dirname + '/../examples/protos'));
    packageDefinitionObjects = grpc.loadPackageDefinition(packageDefinition);
  });

  it('should convert the helloworld protobuf object to GraphQL schema', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          }
        ]
      }
    ]);
    gqlSchema.should.be.String();

    const gqlDefinition = gql`${gqlSchema}`;
    should(gqlDefinition.definitions.find(def => def.name.value === 'helloworld_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'Greeter_query')).be.Object();
    should((gqlDefinition.definitions.find(def => def.name.value === 'calculator_query') === undefined)).be.True();
    should(gqlSchema).be.String();
    done();
  });

  it('should convert the multiple protobuf object to GraphQL schema', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          }
        ]
      },
      {
        name: 'calculator',
        services: [
          {
            name: 'Simple',
          }
        ]
      }
    ]);
    gqlSchema.should.be.String();

    const gqlDefinition = gql`${gqlSchema}`;
    should(gqlDefinition.definitions.find(def => def.name.value === 'helloworld_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'Greeter_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'calculator_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'Simple_query')).be.Object();
    done();
  });

  it('should convert the multiple protobuf object and disable caculator query', (done) => {
    const gqlSchema = converter(packageDefinitionObjects, [
      {
        name: 'helloworld',
        services: [
          {
            name: 'Greeter',
          }
        ]
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
        ]
      }
    ]);
    gqlSchema.should.be.String();

    const gqlDefinition = gql`${gqlSchema}`;
    should(gqlDefinition.definitions.find(def => def.name.value === 'helloworld_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'Greeter_query')).be.Object();
    should(gqlDefinition.definitions.find(def => def.name.value === 'calculator_query')).be.Undefined();
    should(gqlDefinition.definitions.find(def => def.name.value === 'Simple_query')).should.be.Object();
    done();
  });
});
