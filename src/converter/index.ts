import Debug from 'debug';
import { GqlType } from './graphql-type';
import { GraphQLGenerator } from './graphql-generator';
import GraphQlBlock from './graphql-block';
import { recursiveGetPackage, replacePackageName } from '../libs/tools';
import { RPCServicePackages } from '../libs/rpc-service';

const debug = Debug('grpc-gql-server:converter');

type TypeField = {
  name?: string;
  type?: string;
  label?: string;
  typeName?: string;
};

/**
 * Finder
 * @param {[]} types
 * @param {*} returnType
 */
function finder(types: any[], returnType: any, input: string | any[]) {
  return types.find((val: any) => input.indexOf(val) > -1) && returnType;
}

// Finders
const typeFinders = [
  (input: any) => finder(['INT', 'FIXED'], GqlType.Int, input),
  (input: any) => finder(['FLOAT', 'DOUBLE'], GqlType.Float, input),
  (input: any) => finder(['STRING', 'BYTES'], GqlType.String, input),
  (input: any) => finder(['BOOL'], GqlType.Boolean, input),
];

/**
 * Find type (factory function)
 * @returns {string} Type function (`Number`|`String`|`Boolean`)
 */
function findType(input: string): string {
  for (let i = 0; i < typeFinders.length; i++) {
    const typeFinder = typeFinders[i].call(null, input);
    if (typeFinder) return typeFinder;
  }
  return undefined;
}

const Converter = {
  /**
   * Convert protobufType to GraphQL Type
   */
  type(protobufTypeField: TypeField) {
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

type ConvertOptions = {
  /** default: false */
  isInput?: boolean;
  /** default: false */
  isEnum?: boolean;
};

export default function converter(
  packageObjects: any,
  configs: RPCServicePackages[],
) {
  const gqlSchema = new GraphQLGenerator();

  function typeConverter(
    packageObj: { [x: string]: any },
    protobufMessageName: string,
    opts: ConvertOptions = {},
  ) {
    const { isInput = false, isEnum = false } = opts;
    const protobufMessage = packageObj[protobufMessageName];

    if (!protobufMessage) return;

    const messageType = protobufMessage.type;
    const typeField = messageType.field;
    const functions =
      (typeField &&
        typeField.map((field: { name: any }) => ({
          name: field.name,
          responseType: Converter.type(field),
        }))) ||
      (messageType.value &&
        messageType.value.map((val: { name: any }) => ({
          name: val.name,
        })));

    const __messageType =
      typeField &&
      typeField.filter(
        (field: { type: string }) => field.type === 'TYPE_MESSAGE',
      );
    const __enumType =
      typeField &&
      typeField.filter((field: { type: string }) => field.type === 'TYPE_ENUM');

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
          const fields =
            enumItem.value &&
            enumItem.value.map((val: { name: any }) => val.name);

          fields.forEach((field: any) => {
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

      functions.forEach((fn: { name?: any; responseType?: any }) => {
        const { responseType } = fn;

        if (messageType.enumType && responseType) {
          const findInBlockEnums = messageType.enumType.find(
            (val: { name: any }) => val.name === responseType.type,
          );

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

  configs.forEach((config: { name: any; services: any[] }) => {
    const packageKey = replacePackageName(config.name);
    const packageObj = recursiveGetPackage(
      packageKey.split('_'),
      packageObjects,
    );
    const packageObjKeys = Object.keys(packageObj);
    const queryTypeName = `${packageKey}_query`;
    const mutateTypeName = `${packageKey}_mutate`;

    for (let i = 0; i < packageObjKeys.length; i++) {
      let queryType: GraphQlBlock;
      let mutateType: GraphQlBlock;
      const protosType = packageObjKeys[i];
      if (!('service' in packageObj[protosType])) continue;

      const serviceConfig = config.services.find(
        (service: { name: string }) => service.name === protosType,
      );
      if (!serviceConfig) continue;

      serviceConfig.grpcOnly =
        serviceConfig.grpcOnly === undefined
          ? serviceConfig.mutate === false && serviceConfig.query === false
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

      const excludedTypes = serviceConfig.exclude;
      const queryFunctions = serviceConfig.query;
      const mutateFunctions = serviceConfig.mutate;
      const protoGqlTypeQuery = gqlSchema.createType(`${protosType}_query`);
      const protoGqlTypeMutate = gqlSchema.createType(`${protosType}_mutate`);

      for (let k = 0; k < serviceType.length; k++) {
        const service = serviceType[k];
        const params = {};

        if (excludedTypes && excludedTypes.indexOf(service.name) >= 0) {
          continue;
        }

        service.requestParams.forEach(
          (param: { name: string | number; type: any }) => {
            params[param.name] = {
              type: gqlSchema.get(param.type),
            };
          },
        );

        if (queryFunctions && queryFunctions.indexOf(service.name) >= 0) {
          debug(`Adding query function: ${service.name}`);
          protoGqlTypeQuery.addFieldWithParams(service.name, params, {
            type: gqlSchema.get(service.responseType),
          });
        } else if (
          mutateFunctions &&
          mutateFunctions.indexOf(service.name) >= 0
        ) {
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
        debug(
          `Adding mutate type -> ${protosType}: ${protoGqlTypeMutate.name}`,
        );
        mutateType.addField(protosType, {
          type: protoGqlTypeMutate,
        });
      }
    }
  });

  return gqlSchema.toGql();
}
