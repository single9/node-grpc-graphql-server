const { block: gqlBlockType } = require('./graphql-type.js');

const blockType = ['input', 'type', 'enum'];

/**
 * @param {FieldResponseType} responseType
 */
function blockDataHelper(responseType, params) {
  let _responseType = responseType;
  const _gqlBlock = _responseType.type;
  const opts = _responseType;

  // eslint-disable-next-line no-use-before-define
  if (_gqlBlock instanceof GraphQlBlock === true) {
    _responseType = _gqlBlock.name;
  } else {
    _responseType = _gqlBlock;
  }

  const repeated = (opts.repeated === true || typeof opts.repeated === 'object') ? opts.repeated : false;

  return {
    responseType: _responseType,
    params,
    repeated,
    nullable: opts.nullable && opts.nullable === true,
  };
}

function labelHelper(responseName, fieldData) {
  let tmp = `${responseName || ''}`;

  if (fieldData.nullable === false) {
    tmp = `${tmp}!`;
  }

  if (fieldData.repeated) {
    tmp = `[${tmp}]${(fieldData.repeated.nullable === false && '!') || ''}`;
  }

  return tmp;
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
   * @param {FieldResponseType} responseType
   */
  addField(name, responseType) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);
    if (this.type !== gqlBlockType.enum && !responseType) throw new Error(`field '${name}' requires response type`);

    this.fields[name] = (this.type === gqlBlockType.enum && {})
      || blockDataHelper(responseType, null);
  }

  /**
   * @param {string} name
   * @param {Object.<string, GraphQlParam>} params
   * @param {FieldResponseType} responseType
   */
  addFieldWithParams(name, params, responseType) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);
    // if (this.type === 'enum') throw new Error('enum is not support params ');

    if (params) {
      Object.keys(params).forEach((key) => {
        const gqlBlock = params[key].type;

        if ((gqlBlock instanceof GraphQlBlock) === false && typeof gqlBlock !== 'string') {
          throw new TypeError(`params['${key}'] is not an instance of GraphQlBlock or not a type of GraphQL`);
        }

        if (typeof gqlBlock !== 'string' && gqlBlock.type !== gqlBlockType.input && gqlBlock.type !== gqlBlockType.enum) {
          throw new TypeError(`params['${key}'] is not input or enum type`);
        }
      });
    }

    this.fields[name] = blockDataHelper(responseType, params);
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

      let fieldParams = '';
      const responseType = labelHelper(fieldData.responseType, fieldData);

      if (fieldData.params) {
        const { params } = fieldData;
        const paramsKeys = Object.keys(params);

        for (let j = 0; j < paramsKeys.length; j++) {
          const param = params[paramsKeys[j]];
          const paramType = param.type;
          const tmpParam = labelHelper(paramType.name || paramType, param);

          fieldParams += `${paramsKeys[j]}: ${tmpParam}`;
          fieldParams += `${((j !== paramsKeys.length - 1) && ', ') || ''}`;
        }
      }

      desc += `  ${fieldName}${fieldParams && `(${fieldParams})`}${(responseType && `: ${responseType}`) || ''}`;
      desc += `${((i !== fieldKeys.length - 1) && '\n') || ''}`;
    }

    tmp = tmp.replace('<desc>', desc);
    return tmp;
  }

  listFields() {
    return Object.keys(this.fields).map((fieldName) => this.fields[fieldName]);
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
 * @property {boolean} nullable
 * @property {boolean} repeated
 * @property {Object.<string, GraphQlParam>} params
 */

/**
 * @typedef {object} GraphQlParam
 * @property {gqlBlockType|GraphQlBlock} type
 * @property {boolean} [nullable=false]
 * @property {boolean} [repeated=false]
 */

/**
 * @typedef {object} AddFieldOptions
 * @property {boolean} [nullable=true]
 * @property {boolean|RepeatedType} [repeated=false]
 */

/**
 * @typedef {object} FieldResponseType
 * @property {gqlBlockType|GraphQlBlock} type
 * @property {boolean|RepeatedType} [repeated=false]
 * @property {boolean} [nullable=true]
 */

/**
 * @typedef {object} RepeatedType
 * @property {boolean} [nullable = true]
 */
