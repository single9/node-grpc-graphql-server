import { GqlBlockType, GqlType } from './graphql-type.js';

const blockType = ['input', 'type', 'enum'];

export type GraphQlBlockOptions = {
  extend?: boolean;
};

export type GraphQlBlockFields = {
  [x: string]: GraphQlBlockField;
};

export type GraphQlBlockField = {
  responseType: string;
  nullable: boolean;
  repeated: boolean;
  params: { [x: string]: GraphQlParam };
};

export type GraphQlParam = {
  type: GraphQlBlock | keyof typeof GqlBlockType;
  /** default: false */
  nullable?: boolean;
  /** default: false */
  repeated?: boolean;
};

export type AddFieldOptions = {
  /** default: true */
  nullable?: boolean;
  /** default: false */
  repeated?: boolean;
};

export type FieldResponseType = {
  type: GraphQlBlock | keyof typeof GqlType;
  /** default: true */
  nullable?: boolean;
  /** default: false */
  repeated?: boolean;
};

export type RepeatedType = {
  /** default: true */
  nullable?: boolean;
};

/**
 * @param {FieldResponseType} responseType
 * @param {Object.<string, GraphQlParam>} params
 */
function blockDataHelper(
  responseType: FieldResponseType,
  params: { [s: string]: GraphQlParam },
) {
  let _responseType: FieldResponseType | string = responseType;
  const _gqlBlock = _responseType.type;
  const opts = _responseType;

  if (_gqlBlock instanceof GraphQlBlock) {
    _responseType = _gqlBlock.name;
  } else {
    _responseType = _gqlBlock;
  }

  const repeated =
    opts.repeated === true || typeof opts.repeated === 'object'
      ? opts.repeated
      : false;

  return {
    responseType: _responseType,
    params,
    repeated,
    nullable: opts.nullable && opts.nullable === true,
  };
}

/**
 * @param {string} responseName
 * @param {*} fieldData
 */
function labelHelper(responseName: string, fieldData: any) {
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
  name: string;
  type: string;
  fields: any = {};
  isExtend: boolean;

  constructor(
    type: 'input' | 'type' | 'enum',
    name: string,
    opts: GraphQlBlockOptions = {},
  ) {
    if (blockType.indexOf(type) === -1)
      throw new Error(`${type} is not supported`);

    this.name = name;
    this.type = type;
    /** @type {GraphQlBlockFields} */
    this.fields = {};
    this.isExtend = opts.extend || false;
  }

  addField(name: string, responseType?: FieldResponseType) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);
    if (this.type !== GqlBlockType.enum && !responseType)
      throw new Error(`field '${name}' requires response type`);

    this.fields[name] =
      (this.type === GqlBlockType.enum && {}) ||
      blockDataHelper(responseType, null);
  }

  addFieldWithParams(
    name: string,
    params: { [s: string]: GraphQlParam },
    responseType: FieldResponseType,
  ) {
    if (this.fields[name]) throw new Error(`field '${name}' already exists`);

    if (params) {
      Object.keys(params).forEach((key) => {
        const gqlBlock = params[key].type;

        if (
          gqlBlock instanceof GraphQlBlock === false &&
          typeof gqlBlock !== 'string'
        ) {
          throw new TypeError(
            `params['${key}'] is not an instance of GraphQlBlock or not a type of GraphQL`,
          );
        }

        if (
          typeof gqlBlock !== 'string' &&
          gqlBlock.type !== GqlBlockType.input &&
          gqlBlock.type !== GqlBlockType.enum
        ) {
          throw new TypeError(`params['${key}'] is not input or enum type`);
        }
      });
    }

    this.fields[name] = blockDataHelper(responseType, params);
  }

  getField(name: string) {
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

  toGql() {
    const type = `${this.isExtend ? 'extend ' : ''}${this.type} ${this.name}`;
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
          fieldParams += `${(j !== paramsKeys.length - 1 && ', ') || ''}`;
        }
      }

      desc += `  ${fieldName}${fieldParams && `(${fieldParams})`}${
        (responseType && `: ${responseType}`) || ''
      }`;
      desc += `${(i !== fieldKeys.length - 1 && '\n') || ''}`;
    }

    tmp = tmp.replace('<desc>', desc);
    return tmp;
  }

  listFields() {
    return Object.keys(this.fields).map((fieldName) => this.fields[fieldName]);
  }
}

export default GraphQlBlock;
