const { type: gqlType, block: gqlBlockType } = require('./graphql-type.js');
const GraphQlBlock = require('./graphql-block.js');

const rootQuery = new GraphQlBlock('type', 'Query');
const rootMutation = new GraphQlBlock('type', 'Mutation');

rootQuery.addField('_', { type: gqlType.String });
rootMutation.addField('_', { type: gqlType.String });

class GraphQLGenerator {
  constructor() {
    this.root = {
      query: rootQuery,
      mutation: rootMutation,
    };

    /** @type {Object.<string, GraphQlBlock>} */
    this.blocks = {};

    this.Query = new GraphQlBlock('type', 'Query', { extend: true });
    this.Mutation = new GraphQlBlock('type', 'Mutation', { extend: true });
  }

  /**
   * @param {string} name
   * @param {Object.<string, GraphQlBlock.GraphQlParam>} params
   * @param {GraphQlBlock.FieldResponseType} responseType
   */
  addToQuery(name, params, responseType) {
    return this.Query.addFieldWithParams(name, params, responseType);
  }

  /**
   * @param {string} name
   * @param {Object.<string, GraphQlBlock.GraphQlParam>} params
   * @param {GraphQlBlock.FieldResponseType} responseType
   */
  addToMutation(name, params, responseType) {
    return this.Mutation.addFieldWithParams(name, params, responseType);
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  createType(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(gqlBlockType.type, name, opts);
    return this.blocks[name];
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  createInput(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(gqlBlockType.input, name, opts);
    return this.blocks[name];
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  createEnum(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(gqlBlockType.enum, name, opts);
    return this.blocks[name];
  }

  get(name) {
    return this.blocks[name];
  }

  toGql() {
    let output = '';
    const blockKeys = Object.keys(this.blocks);

    if (this.Query.listFields().length < 1) throw new Error('Query must have at least one field');

    output += rootQuery.toGql();

    for (let i = 0; i < blockKeys.length; i++) {
      const block = this.blocks[blockKeys[i]];
      output += block.toGql();
    }

    if (this.Mutation.listFields().length > 0) {
      output += rootMutation.toGql();
      output += this.Mutation.toGql();
    }

    output += this.Query.toGql();

    return output;
  }
}

module.exports = GraphQLGenerator;
