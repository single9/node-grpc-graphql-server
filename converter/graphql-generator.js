const { type: gqlType } = require('./graphql-type.js');
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

    this.addToQuery = (...args) => this.Query.addFieldWithParams(...args);
    this.addToMutation = (...args) => this.Mutation.addFieldWithParams(...args);
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock} block
   * @param {GraphQlBlock.AddFieldOptions} [opts]
   */
  addToMutation(name, block, opts = {}) {
    // TODO: Support params
    if ((block instanceof GraphQlBlock) === false) throw new Error('Unknown block');
    if (block.type !== 'type') throw new Error('Unsupport block type');

    this.extendQuery.addFieldWithParams(name, block.name, opts);
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  addType(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock('type', name, opts);
    return this.blocks[name];
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  addInput(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock('input', name, opts);
    return this.blocks[name];
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  addEnum(name, opts = {}) {
    if (this.blocks[name]) throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock('input', name, opts);
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
