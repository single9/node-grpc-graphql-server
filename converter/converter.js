const GraphQlBlock = require('./graphql-block.js');

const rootQuery = new GraphQlBlock('type', 'Query');
const rootMutation = new GraphQlBlock('type', 'Mutation');

class Converter {
  constructor() {
    this.root = {
      query: rootQuery,
      mutation: rootMutation,
    };

    /** @type {Object.<string, GraphQlBlock>} */
    this.blocks = {};

    this.extendQuery = new GraphQlBlock('type', 'Query', { extend: true });
    this.extendMutation = new GraphQlBlock('type', 'Mutation', { extend: true });

    this.addToQuery = this.extendQuery.addField;
    this.addToMutation = this.extendMutation.addField;
  }

  /**
   * @param {string} name
   * @param {GraphQlBlock} block
   * @param {GraphQlBlock.AddFieldOptions} [opts]
   */
  addToQuery(name, block, opts = {}) {
    // TODO: Support params
    if ((block instanceof GraphQlBlock) === false) throw new Error('Unknown block');
    if (block.type !== 'type') throw new Error('Unsupport block type');

    this.extendQuery.addField(name, block.name, opts);
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

    this.extendQuery.addField(name, block.name, opts);
  }

  /**
   * @param {string} type
   * @param {string} name
   * @param {GraphQlBlock.GraphQlBlockOptions} opts
   */
  addBlock(type, name, opts = {}) {
    this.blocks[name] = new GraphQlBlock(type, name, opts);
    return this.blocks[name];
  }

  toGql() {
    let output = '';
    const blockKeys = Object.keys(this.blocks);

    output += rootQuery.toGql() + rootMutation.toGql();
    output += this.extendQuery.toGql() + this.extendMutation.toGql();

    for (let i = 0; i < blockKeys.length; i++) {
      const block = this.blocks[blockKeys[i]];
      output += block.toGql();
    }

    return output;
  }
}

module.exports = Converter;
