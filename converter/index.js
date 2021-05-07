const toGqlTypes = require('./types.js');
const { recursiveGetPackage, replacePackageName } = require('../libs/tools.js');

const tmplQuery = `extend type Query {
  {{FnDesc}}
}\n`;

const tmplMutation = `extend type Mutation {
  {{FnDesc}}
}`;

const tmplCustomType = `type {{TypeName}} {
  {{TypeDesc}}
}\n`;

const tmplCustomInput = `input {{TypeName}} {
  {{TypeDesc}}
}\n`;

const tmplEnumType = `enum {{TypeName}} {
  {{TypeDesc}}
}\n`;

/**
 * Generate function description schema with GraphQL language
 *
 * @param {GqlFunctionDescribe[]} functions
 */
function genGqlFunctionDescribe(functions) {
  const fnDesc = [];
  functions.forEach((fn) => {
    let { requestParams } = fn;
    const { name, responseType } = fn;

    requestParams = requestParams && requestParams.map((param) => `${param.name}: ${(param.required && `${param.type}!`) || param.type}`);

    const fieldName = `${name}${(requestParams && `(${requestParams.join(',')})`) || ''}`;
    fnDesc.push(
      (responseType && `${fieldName}: ${responseType}`) || `${fieldName}`,
    );
  });

  return fnDesc.join('\n  ');
}

/**
 * Generate the query schema with GraphQL language
 * @param {GqlFunctionDescribe[]} functions
 */
function genGqlQuery(functions) {
  const fnDesc = genGqlFunctionDescribe(functions);
  return tmplQuery.replace('{{FnDesc}}', fnDesc);
}

/**
 * Generate the mutation schema with GraphQL language
 * @param {GqlFunctionDescribe[]} functions
 */
function genGqlMutation(functions) {
  const fnDesc = genGqlFunctionDescribe(functions);
  return tmplMutation.replace('{{FnDesc}}', fnDesc);
}

/**
 * @param {GenGqlTypeParams[]} types
 */
function genGqlType(types) {
  const gqlTypes = [];

  types.forEach((type) => {
    const {
      isInput, isEnum, name, functions,
    } = type;
    const typeDesc = genGqlFunctionDescribe(functions);
    const customType = ((isInput && tmplCustomInput) || (isEnum && tmplEnumType) || tmplCustomType)
      .replace('{{TypeName}}', name)
      .replace('{{TypeDesc}}', `${typeDesc}`);

    gqlTypes.push(customType);
  });

  return gqlTypes.join('\n');
}

/**
 * Converter
 * @param {*} packageObjects
 * @param {[]} configs
 */
function converter(packageObjects, configs) {
  const convertedTypes = [];
  const gqlQueryPackages = [];
  const gqlMutationPackages = [];
  const gqlPackageRoot = [];
  let gqlTypes = '';

  function typeConverter(packageObj, protobufMessageName, opts = {}) {
    let result = '';
    const { isInput = false, isEnum = false } = opts;
    const protobufMessage = packageObj[protobufMessageName];

    if (!protobufMessage) return '';

    const messageType = protobufMessage.type;
    const typeField = messageType.field;
    const typeName = messageType.name;
    const functions = (typeField && typeField.map((field) => ({
      name: field.name,
      responseType: toGqlTypes(field),
    }))) || (messageType.value && messageType.value.map((val) => ({
      name: val.name,
    })));

    const __messageType = typeField && typeField.filter((field) => field.type === 'TYPE_MESSAGE');
    const __enumType = typeField && typeField.filter((field) => field.type === 'TYPE_ENUM');

    if (__messageType) {
      for (let i = 0; i < __messageType.length; i++) {
        const messageItem = __messageType[i];
        result += typeConverter(packageObj, messageItem.typeName, { isInput });
      }
    }

    if (__enumType) {
      for (let i = 0; i < __enumType.length; i++) {
        const messageItem = __enumType[i];
        result += typeConverter(packageObj, messageItem.typeName, { isEnum: true });
      }
    }

    if (messageType.enumType) {
      for (let i = 0; i < messageType.enumType.length; i++) {
        const enumItem = messageType.enumType[i];
        const enumType = genGqlType([
          {
            isEnum: true,
            name: enumItem.name,
            functions: (enumItem.value && enumItem.value.map((val) => ({
              name: val.name,
            }))),
          },
        ]);
        result += enumType;
      }
    }

    if (typeName && convertedTypes.indexOf(typeName) === -1) {
      result += genGqlType([
        {
          isInput,
          isEnum,
          name: messageType.name,
          functions,
        },
      ]);
      convertedTypes.push(typeName);
    }

    return result;
  }

  function pushToPackageRoot(name, protosType) {
    // package type
    let gqlPackageRootIndex = gqlPackageRoot.findIndex((pkg) => pkg.name === name);
    if (gqlPackageRootIndex === -1) {
      gqlPackageRootIndex = (gqlPackageRoot.push({
        name,
        functions: [],
      })) - 1; // retuen the index
    }

    // protosType = grpc serviceName
    gqlPackageRoot[gqlPackageRootIndex].functions.push({
      name: protosType,
      responseType: protosType,
    });
  }

  configs.forEach((config) => {
    const packageKey = replacePackageName(config.name);
    const packageObj = recursiveGetPackage(packageKey.split('_'), packageObjects);
    const packageObjKeys = Object.keys(packageObj);
    let gqlServiceType = '';

    packageObjKeys.forEach((protosType) => {
      if (!('service' in packageObj[protosType])) return;
      const serviceConfig = config.services.find((service) => service.name === protosType);
      if (!serviceConfig) return;

      serviceConfig.grpcOnly = serviceConfig.grpcOnly === undefined
        ? (serviceConfig.mutate === false && serviceConfig.query === false)
        : serviceConfig.grpcOnly;

      if (serviceConfig.grpcOnly) return;

      /**
       * This section will generate `packageKey_query` and `packageKey_mutate` type
       */
      const gqlQueryPackagesIndex = gqlQueryPackages.findIndex((pkg) => pkg.name === packageKey);
      if (gqlQueryPackagesIndex === -1 && serviceConfig.query !== false) {
        gqlQueryPackages.push({
          name: packageKey,
          responseType: `${packageKey}_query`,
        });
      }

      const gqlMutationPackagesIndex = gqlMutationPackages
        .findIndex((pkg) => pkg.name === packageKey);

      if (gqlMutationPackagesIndex === -1 && serviceConfig.mutate !== false) {
        gqlMutationPackages.push({
          name: packageKey,
          responseType: `${packageKey}_mutate`,
        });
      }

      if (serviceConfig.query !== false) pushToPackageRoot(`${packageKey}_query`, protosType);

      if (serviceConfig.mutate !== false) pushToPackageRoot(`${packageKey}_mutate`, protosType);

      // service type
      const serviceType = [];
      const serviceKeys = Object.keys(packageObj[protosType].service);

      for (let i = 0; i < serviceKeys.length; i++) {
        const service = serviceKeys[i];
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

        // req (input) type
        gqlTypes += typeConverter(packageObj, requestType.name, { isInput: true });
        // res
        gqlTypes += typeConverter(packageObj, responseType.name);
      }

      gqlServiceType = (genGqlFunctionDescribe(serviceType));
      gqlTypes += tmplCustomType.replace('{{TypeName}}', protosType).replace('{{TypeDesc}}', gqlServiceType);
    });
  });

  const pkgSchema = (gqlPackageRoot.length > 0 && genGqlType(gqlPackageRoot)) || '';
  const querySchema = (gqlQueryPackages.length > 0 && genGqlQuery(gqlQueryPackages)) || '';
  const mutationSchema = (gqlMutationPackages.length > 0 && genGqlMutation(gqlMutationPackages)) || '';
  const combinedSchema = pkgSchema + gqlTypes + querySchema + mutationSchema;
  return (combinedSchema.length > 0 && combinedSchema) || undefined;
}

module.exports = converter;

/**
 * @typedef {object} GenGqlTypeParams
 * @property {string} name
 * @property {GqlFunctionDescribe[]} functions
 */

/**
 * @typedef {object} GqlFunctionDescribe
 * @property {string} name
 * @property {string} responseType
 * @property {RequestParams[]} requestParams
 */

/**
 * @typedef {object} RequestParams
 * @property {string}  name
 * @property {string}  type
 * @property {boolean} required
 */
