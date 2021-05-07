const blockType = ['input', 'type', 'enum'];

function blockDataHelper(responseType, params, opts) {
  return {
    responseType,
    params,
    required: opts.required || false,
    repeated: opts.repeated || false,
  };
}

/**
 * GraphQL Block Definition
 */
class GraphQlBlock {
  /**
   * @param {'input'|'type'|'enum'} type
   * @param {string} name
   * @param {GraphQlBlockOptions} opts
   */
  constructor(type, name, opts = {}) {
    if (blockType.indexOf(type) === -1) throw new Error(`${type} is not supported`);

    this.name = name;
    this.type = type;
    /** @type {GraphQlBlockFields} */
    this.fields = {};
    this.isExtend = opts.extend || false;
  }

  /**
   * @param {string} name
   * @param {string} responseType
   * @param {AddFieldOptions} opts
   */
  addField(name, responseType, opts = {}) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);
    if (this.type !== 'enum' && !responseType) throw new Error(`field '${name}' requires response type`);

    this.fields[name] = (this.type === 'enum' && {}) || blockDataHelper(responseType, null, opts);
  }

  /**
   * @param {string} name
   * @param {Object.<string, GraphQlBlock>} params
   * @param {string} responseType
   * @param {AddFieldOptions} opts
   */
  addFieldWithParams(name, params, responseType, opts = {}) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);
    if ((params instanceof GraphQlBlock) === false) throw new Error('params is not an instance of GraphQlBlock');
    if (this.type === 'enum') throw new Error('enum is not support params ');

    Object.keys(params).forEach((key) => {
      if ((params[key] instanceof GraphQlBlock) === false) {
        throw new Error('params is not an instance of GraphQlBlock');
      }
    });

    this.fields[name] = blockDataHelper(responseType, params, opts);
  }

  /**
   * @param {string} name
   */
  getField(name) {
    return this.fields[name];
  }

  toJson() {
    return {
      name: this.name,
      type: this.type,
      fields: this.fields,
      isExtend: this.isExtend,
    };
  }

  /**
   * Convert to GraphQL string
   */
  toGql() {
    const type = `${(this.isExtend ? 'extend ' : '')}${this.type} ${this.name}`;
    const fieldKeys = Object.keys(this.fields);

    let tmp = `${type} {\n<desc>\n}\n`;
    let desc = '';

    for (let i = 0; i < fieldKeys.length; i++) {
      const fieldName = fieldKeys[i];
      const fieldData = this.fields[fieldName];

      let responseType = `${fieldData.responseType || ''}`;

      if (fieldData.repeated) {
        responseType = `[${responseType}]`;
      }

      if (fieldData.required) {
        responseType = `${responseType}!`;
      }

      desc += `  ${fieldName}${(responseType && `: ${responseType}`) || ''} ${((i !== fieldKeys.length - 1) && '\n') || ''}`;
    }

    tmp = tmp.replace('<desc>', desc);
    return tmp;
  }
}

module.exports = GraphQlBlock;

/**
 * @typedef {object} GraphQlBlockOptions
 * @property {bool} [extend]
 */

/**
 * @typedef {Object.<string, GraphQlBlockField>} GraphQlBlockFields
 */

/**
 * @typedef {object} GraphQlBlockField
 * @property {string} responseType
 * @property {boolean} required
 * @property {boolean} repeated
 */

/**
 * @typedef {object} AddFieldOptions
 * @property {}
 * @property {boolean} [required=false]
 * @property {boolean} [repeated=false]
 */
