const should = require('should');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const { gql } = require('apollo-server-express');
const converter = require('../converter');

describe('Test converter', () => {
  it('should convert the protobuf object to GraphQL schema', (done) => {
    const packageDefinition = protoLoader.loadSync(__dirname + '/../examples/protos/hello.proto');
    const packageDefinitionObjects = grpc.loadPackageDefinition(packageDefinition);
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
    const gqlDefinition = gql`${gqlSchema}`;
    gqlDefinition.definitions.find(def => def.name.value === 'helloworld').should.be.Object();
    gqlDefinition.definitions.find(def => def.name.value === 'Greeter').should.be.Object();
    gqlSchema.should.be.String();
    done();
  });
});
