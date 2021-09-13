const debug = require('debug')('grpc-gql-server:converter');
const { type: gqlType } = require('./graphql-type.js');
const GraphQLGenerator = require('./graphql-generator.js');
const { recursiveGetPackage, replacePackageName } = require('../libs/tools.js');

/**
 * Finder
 * @param {[]} types
 * @param {*} returnType
 */
function finder(types, returnType, input) {
  return types.find((val) => input.indexOf(val) > -1) && returnType;
}

// Finders
const typeFinders = [
  (input) => finder(['INT', 'FIXED'], gqlType.Int, input),
  (input) => finder(['FLOAT', 'DOUBLE'], gqlType.Float, input),
  (input) => finder(['STRING', 'BYTES'], gqlType.String, input),
  (input) => finder(['BOOL'], gqlType.Boolean, input),
];

/**
 * Find type (factory function)
 * @param {string} input
 * @returns {string} Type function (`Number`|`String`|`Boolean`)
 */
function findType(input) {
  for (let i = 0; i < typeFinders.length; i++) {
    const typeFinder = typeFinders[i].call(null, input);
    if (typeFinder) return typeFinder;
  }
  return undefined;
}

const Converter = {
  /**
  * Convert protobufType to GraphQL Type
  * @param {TypeField} protobufTypeField
  */
  type(protobufTypeField) {
    const { label } = protobufTypeField;
    const protobufType = protobufTypeField.type;
    const type = findType(protobufType);
    const myType = type || protobufTypeField.typeName;
    const repeated = label === 'LABEL_REPEATED';
    const required = label === 'LABEL_REQUIRED';

    if (!myType) {
      throw new Error('Unknown response type');
    }

    return {
      type: myType,
      required,
      repeated,
    };
  },
};

function converter(packageObjects, configs) {
  const gqlSchema = new GraphQLGenerator();

  function typeConverter(packageObj, protobufMessageName, opts = {}) {
    const { isInput = false, isEnum = false } = opts;
    const protobufMessage = packageObj[protobufMessageName];

    if (!protobufMessage) return;

    const messageType = protobufMessage.type;
    const typeField = messageType.field;
    // const typeName = messageType.name;
    const functions = (typeField && typeField.map((field) => ({
      name: field.name,
      responseType: Converter.type(field),
    }))) || (messageType.value && messageType.value.map((val) => ({
      name: val.name,
    })));

    const __messageType = typeField && typeField.filter((field) => field.type === 'TYPE_MESSAGE');
    const __enumType = typeField && typeField.filter((field) => field.type === 'TYPE_ENUM');

    if (__messageType) {
      for (let i = 0; i < __messageType.length; i++) {
        const messageItem = __messageType[i];
        typeConverter(packageObj, messageItem.typeName, { isInput });
      }
    }

    if (__enumType) {
      for (let i = 0; i < __enumType.length; i++) {
        const messageItem = __enumType[i];
        typeConverter(packageObj, messageItem.typeName, { isEnum: true });
      }
    }

    if (messageType.enumType) {
      for (let i = 0; i < messageType.enumType.length; i++) {
        const enumItem = messageType.enumType[i];
        const enumTypeName = `${protobufMessageName}_${enumItem.name}`;

        if (!gqlSchema.get(enumTypeName)) {
          const enumBlock = gqlSchema.createEnum(enumTypeName);
          const fields = enumItem.value && enumItem.value.map((val) => val.name);

          fields.forEach((field) => {
            enumBlock.addField(field);
          });
        }

        enumItem.newTypeName = enumTypeName;
      }
    }

    let gqlBlock = gqlSchema.get(protobufMessageName);

    if (!gqlBlock) {
      if (isInput) gqlBlock = gqlSchema.createInput(protobufMessageName);
      else if (isEnum) gqlBlock = gqlSchema.createEnum(protobufMessageName);
      else gqlBlock = gqlSchema.createType(protobufMessageName);

      functions.forEach((fn) => {
        const { responseType } = fn;

        if (messageType.enumType && responseType) {
          const findInBlockEnums = messageType.enumType
            .find((val) => val.name === responseType.type);

          if (findInBlockEnums) {
            responseType.type = findInBlockEnums.newTypeName;
          }
        }

        if (isEnum) {
          gqlBlock.addField(fn.name);
        } else {
          if (!gqlSchema.get(responseType.type)) {
            typeConverter(packageObj, responseType.type);
          }

          gqlBlock.addField(fn.name, responseType);
        }
      });
    }
  }

  configs.forEach((config) => {
    const packageKey = replacePackageName(config.name);
    const packageObj = recursiveGetPackage(packageKey.split('_'), packageObjects);
    const packageObjKeys = Object.keys(packageObj);
    const queryTypeName = `${packageKey}_query`;
    const mutateTypeName = `${packageKey}_mutate`;

    for (let i = 0; i < packageObjKeys.length; i++) {
      /** @type {GraphQlBlock} */
      let queryType;
      /** @type {GraphQlBlock} */
      let mutateType;
      const protosType = packageObjKeys[i];
      if (!('service' in packageObj[protosType])) continue;

      const serviceConfig = config.services.find((service) => service.name === protosType);
      if (!serviceConfig) continue;

      serviceConfig.grpcOnly = serviceConfig.grpcOnly === undefined
        ? (serviceConfig.mutate === false && serviceConfig.query === false)
        : serviceConfig.grpcOnly;

      if (serviceConfig.grpcOnly) continue;
      if (serviceConfig.query !== false) {
        queryType = gqlSchema.get(queryTypeName);

        if (!queryType) {
          queryType = gqlSchema.createType(queryTypeName);
          gqlSchema.addToQuery(packageKey, null, {
            type: queryType,
          });
        }
      }

      if (serviceConfig.mutate !== false) {
        mutateType = gqlSchema.get(mutateTypeName);

        if (!mutateType) {
          mutateType = gqlSchema.createType(mutateTypeName);
          gqlSchema.addToMutation(packageKey, null, {
            type: mutateType,
          });
        }
      }

      // service type
      const serviceType = [];
      const serviceKeys = Object.keys(packageObj[protosType].service);

      for (let j = 0; j < serviceKeys.length; j++) {
        const service = serviceKeys[j];
        const serviceName = service;
        const serviceObj = packageObj[protosType].service[service];
        const requestType = serviceObj.requestType.type;
        const responseType = serviceObj.responseType.type;

        serviceType.push({
          name: serviceName,
          requestParams: [
            {
              name: 'request',
              type: requestType.name,
            },
          ],
          responseType: responseType.name,
        });

        typeConverter(packageObj, requestType.name, { isInput: true });
        typeConverter(packageObj, responseType.name);
      }

      const queryFunctions = serviceConfig.query;
      const mutateFunctions = serviceConfig.mutate;
      const protoGqlTypeQuery = gqlSchema.createType(`${protosType}_query`);
      const protoGqlTypeMutate = gqlSchema.createType(`${protosType}_mutate`);

      for (let k = 0; k < serviceType.length; k++) {
        const service = serviceType[k];
        const params = {};

        service.requestParams.forEach((param) => {
          params[param.name] = {
            type: gqlSchema.get(param.type),
          };
        });

        if (queryFunctions && queryFunctions.indexOf(service.name) >= 0) {
          debug(`Adding query function: ${service.name}`);
          protoGqlTypeQuery.addFieldWithParams(service.name, params, {
            type: gqlSchema.get(service.responseType),
          });
        } else if (mutateFunctions && mutateFunctions.indexOf(service.name) >= 0) {
          debug(`Adding mutate function: ${service.name}`);
          protoGqlTypeMutate.addFieldWithParams(service.name, params, {
            type: gqlSchema.get(service.responseType),
          });
        } else {
          debug(`Adding query & mutate function: ${service.name}`);
          protoGqlTypeQuery.addFieldWithParams(service.name, params, {
            type: gqlSchema.get(service.responseType),
          });
          protoGqlTypeMutate.addFieldWithParams(service.name, params, {
            type: gqlSchema.get(service.responseType),
          });
        }
      }

      if (queryType) {
        debug(`Adding query type -> ${protosType}: ${protoGqlTypeQuery.name}`);
        queryType.addField(protosType, {
          type: protoGqlTypeQuery,
        });
      }

      if (mutateType) {
        debug(`Adding mutate type -> ${protosType}: ${protoGqlTypeMutate.name}`);
        mutateType.addField(protosType, {
          type: protoGqlTypeMutate,
        });
      }
    }
  });

  return gqlSchema.toGql();
}

module.exports = converter;

/**
 * @typedef {object} TypeField
 * @property {string} name
 * @property {string} type
 * @property {string} label
 */
