import { GqlType, GqlBlockType } from './graphql-type.js';
import GraphQlBlock, {
  FieldResponseType,
  GraphQlBlockOptions,
  GraphQlParam,
} from './graphql-block.js';

const rootQuery = new GraphQlBlock('type', 'Query');
const rootMutation = new GraphQlBlock('type', 'Mutation');
const rootSubscription = new GraphQlBlock('type', 'Subscription');

rootQuery.addField('_', { type: GqlType.String });
rootMutation.addField('_', { type: GqlType.String });
rootSubscription.addField('_', { type: GqlType.String });

export class GraphQLGenerator {
  root: { query: GraphQlBlock; mutation: GraphQlBlock };
  blocks: any = {};
  Query: GraphQlBlock;
  Mutation: GraphQlBlock;
  Subscription: GraphQlBlock;
  constructor() {
    this.root = {
      query: rootQuery,
      mutation: rootMutation,
    };

    /** @type {Object.<string, GraphQlBlock>} */
    this.blocks = {};

    this.Query = new GraphQlBlock('type', 'Query', { extend: true });
    this.Mutation = new GraphQlBlock('type', 'Mutation', { extend: true });
    this.Subscription = new GraphQlBlock('type', 'Subscription', {
      extend: true,
    });
  }

  /**
   * Add to GraphQL Query
   */
  addToQuery(
    name: string,
    params: { [s: string]: GraphQlParam },
    responseType: FieldResponseType,
  ) {
    return this.Query.addFieldWithParams(name, params, responseType);
  }

  /**
   * Add to GraphQL Mutation
   */
  addToMutation(
    name: string,
    params: { [s: string]: GraphQlParam },
    responseType: FieldResponseType,
  ) {
    return this.Mutation.addFieldWithParams(name, params, responseType);
  }

  /**
   * Add to GraphQL Subscription
   */
  addToSubscription(
    name: string,
    params: { [s: string]: GraphQlParam },
    responseType: FieldResponseType,
  ) {
    return this.Subscription.addFieldWithParams(name, params, responseType);
  }

  /**
   * Create GraphQL Type type
   */
  createType(name: string, opts: GraphQlBlockOptions = {}) {
    if (this.blocks[name])
      throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(GqlBlockType.type, name, opts);
    return this.blocks[name];
  }

  /**
   * Create GraphQL Input type
   */
  createInput(name: string, opts: GraphQlBlockOptions = {}) {
    if (this.blocks[name])
      throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(GqlBlockType.input, name, opts);
    return this.blocks[name];
  }

  /**
   * Create GraphQL Enum type
   */
  createEnum(name: string, opts: GraphQlBlockOptions = {}) {
    if (this.blocks[name])
      throw new Error(`GraphQlBlock ${name} already exists`);
    this.blocks[name] = new GraphQlBlock(GqlBlockType.enum, name, opts);
    return this.blocks[name];
  }

  /**
   * Get GraphQl Block by given name
   */
  get(name: string): GraphQlBlock {
    return this.blocks[name];
  }

  /**
   * Convert into GraphQL Schema
   */
  toGql() {
    let output = '';
    const blockKeys = Object.keys(this.blocks);

    output += rootQuery.toGql();
    output += rootMutation.toGql();
    output += rootSubscription.toGql();

    for (let i = 0; i < blockKeys.length; i++) {
      const block = this.blocks[blockKeys[i]];

      if (Object.keys(block.fields).length > 0) {
        output += block.toGql();
      }
    }

    if (this.Mutation.listFields().length > 0) {
      output += this.Mutation.toGql();
    }

    if (this.Query.listFields().length > 0) {
      output += this.Query.toGql();
    }

    if (this.Subscription.listFields().length > 0) {
      output += this.Subscription.toGql();
    }

    return output;
  }
}
