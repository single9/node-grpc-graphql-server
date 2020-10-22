require('should');
const grpc = require('grpc');
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
    gqlDefinition.definitions.find(def => def.name.value === 'helloworld').should.be.Object();
    gqlDefinition.definitions.find(def => def.name.value === 'Greeter').should.be.Object();
    (gqlDefinition.definitions.find(def => def.name.value === 'calculator') === undefined).should.be.True();
    gqlSchema.should.be.String();
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
            name: 'Calculator',
          }
        ]
      }
    ]);
    gqlSchema.should.be.String();

    const gqlDefinition = gql`${gqlSchema}`;
    gqlDefinition.definitions.find(def => def.name.value === 'helloworld').should.be.Object();
    gqlDefinition.definitions.find(def => def.name.value === 'Greeter').should.be.Object();
    gqlDefinition.definitions.find(def => def.name.value === 'calculator').should.be.Object();
    gqlDefinition.definitions.find(def => def.name.value === 'Calculator').should.be.Object();
    done();
  });
});
