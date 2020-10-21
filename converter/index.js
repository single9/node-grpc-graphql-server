const toGqlTypes = require('./types.js');

let tmplQuery = 
`type Query {
  {{FnDesc}}
}\n`;

let tmplMutation = 
`type Mutation {
  {{FnDesc}}
}`;

let tmplCustomType = 
`type {{TypeName}} {
  {{TypeDesc}}
}\n`;

let tmplCustomInput = 
`input {{TypeName}} {
  {{TypeDesc}}
}\n`;

/**
 * Generate function description schema with GraphQL language
 *
 * @param {*} functions
 * @returns
 */
function genGqlFunctionDescribe(functions) {
  let fnDesc = [];
  functions.forEach(fn => {
    let {name, requestParams, responseType} = fn;
    requestParams = requestParams && requestParams.map(param => 
      `${param.name}: ${param.required && param.type + '!' || param.type}`);
    fnDesc.push(
      `${name} ${requestParams && '(' + requestParams.join(',') + ')' || ''}: ${responseType}`);
  });

  return fnDesc.join('\n\ \ ');
}

/**
 * Generate the query schema with GraphQL language
 * @param {[]} functions 
 */
function genGqlQuery(functions) {
  let fnDesc = genGqlFunctionDescribe(functions);
  return tmplQuery.replace('{{FnDesc}}', fnDesc);
}

/**
 * Generate the mutation schema with GraphQL language
 * @param {[]} functions 
 */
function genGqlMutation(functions) {
  let fnDesc = genGqlFunctionDescribe(functions);
  return tmplMutation.replace('{{FnDesc}}', fnDesc);
}

function genGqlType(types) {
  let gqlTypes = [];

  types.forEach(type => {
    let {name, functions} = type;
    let typeDesc = genGqlFunctionDescribe(functions);
    const customType = (type.isInput && tmplCustomInput || tmplCustomType)
      .replace('{{TypeName}}', name)
      .replace('{{TypeDesc}}', typeDesc);

    gqlTypes.push(customType);
  });

  return gqlTypes.join('\n');
}

function converter(packageObjects, configs) {
  const packageKeys = Object.keys(packageObjects);
  let convertedTypes = [];
  let gqlQueryPackages = [];
  let gqlMutationPackages = [];
  let gqlTypes = '';

  function typeConverter(packageObj, protobufMessageName, isInput = false) {
    let result = '';
    const protobufMessage = packageObj[protobufMessageName];
    
    if (!protobufMessage) return '';

    const messageType = protobufMessage.type;
    const typeField = messageType.field;

    if (!protobufMessage) return '';

    const typeName = messageType.name;
    const functions = typeField.map(field => {
      return {
        name: field.name,
        responseType: toGqlTypes(field),
      };
    });
    let __messageType = typeField && typeField.filter(field => field.type === 'TYPE_MESSAGE');

    if (__messageType) {
      for (let messageItem of __messageType) {
        result += typeConverter(packageObj, messageItem.typeName);
      }
    }

    if (typeName && convertedTypes.indexOf(typeName) === -1) {
      result += genGqlType([
        {
          isInput: isInput,
          name: messageType.name,
          functions: functions,
        },
      ]);
      convertedTypes.push(typeName);
    }

    return result;
  }

  packageKeys.forEach(packageKey => {
    let gqlServiceType = '';
    for (let protosType in packageObjects[packageKey]) {
      const packageObj = packageObjects[packageKey];

      if (!('service' in packageObj[protosType])) continue;
      let config = configs.find(conf => conf.name === packageKey);

      // ignore undefined service
      if (!config) continue;

      config = config.services.find(service => service.name === protosType);
      config.grpcOnly = config.grpcOnly === undefined && (config.mutate === false && config.query === false);
      // package type
      if (config.grpcOnly) return;

      if (config.query !== false) {
        gqlQueryPackages.push({
          name: packageKey,
          responseType: packageKey,
        });
      }

      if (config.mutate !== false) {
        gqlMutationPackages.push({
          name: packageKey,
          responseType: packageKey,
        });
      }

      let serviceType = [];
      // service type
      gqlTypes += genGqlType([
        {
          name: packageKey,
          functions: [
            {
              name: protosType,
              responseType: protosType,
            },
          ],
        },
      ]);

      const serviceKeys = Object.keys(packageObj[protosType].service);

      for (let i = 0; i < serviceKeys.length; i++) {
        let service = serviceKeys[i];
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
            }
          ],
          responseType: responseType.name,
        });

        // req (input) type
        gqlTypes += typeConverter(packageObj, requestType.name, true);
        // res
        gqlTypes += typeConverter(packageObj, responseType.name);
      }

      gqlServiceType = (genGqlFunctionDescribe(serviceType));
      gqlTypes += tmplCustomType.replace('{{TypeName}}', protosType).replace('{{TypeDesc}}', gqlServiceType);
    }
  });
  const querySchema = gqlQueryPackages.length > 0 && genGqlQuery(gqlQueryPackages) || '';
  const mutationSchema = gqlMutationPackages.length > 0 && genGqlMutation(gqlMutationPackages) || '';
  return gqlTypes + querySchema + mutationSchema;
}

module.exports = converter;
