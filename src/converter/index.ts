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

/** Scalar names for the custom scalars this converter can emit. */
const SCALAR_BYTES = 'Bytes';
const SCALAR_DATETIME = 'DateTime';
const SCALAR_JSON = 'JSON';
const CUSTOM_SCALARS = [SCALAR_BYTES, SCALAR_DATETIME, SCALAR_JSON];

/**
 * Protobuf wire type -> GraphQL scalar. 64-bit integer variants map to
 * `String` (not `Int`) to avoid silent precision loss above 2^31; proto-loader
 * is configured with `longs: String` for the same reason (see rpc-service.ts).
 */
const PROTO_SCALAR_TYPES: { [protobufType: string]: string } = {
  TYPE_INT32: GqlType.Int,
  TYPE_SINT32: GqlType.Int,
  TYPE_SFIXED32: GqlType.Int,
  TYPE_UINT32: GqlType.Int,
  TYPE_FIXED32: GqlType.Int,
  TYPE_INT64: GqlType.String,
  TYPE_SINT64: GqlType.String,
  TYPE_SFIXED64: GqlType.String,
  TYPE_UINT64: GqlType.String,
  TYPE_FIXED64: GqlType.String,
  TYPE_FLOAT: GqlType.Float,
  TYPE_DOUBLE: GqlType.Float,
  TYPE_STRING: GqlType.String,
  TYPE_BYTES: SCALAR_BYTES,
  TYPE_BOOL: GqlType.Boolean,
};

/**
 * Well-known protobuf message types that don't get converted structurally.
 * `Struct`/`Value`/`ListValue`/`Any` are recursive/`oneof`-based "arbitrary
 * data" types by design and can't be modeled as static GraphQL SDL; `Empty`
 * has no fields to model at all.
 */
const WELL_KNOWN_SCALARS: { [qualifiedTypeName: string]: string } = {
  'google.protobuf.Timestamp': SCALAR_DATETIME,
  'google.protobuf.Empty': GqlType.Boolean,
  'google.protobuf.Struct': SCALAR_JSON,
  'google.protobuf.Value': SCALAR_JSON,
  'google.protobuf.ListValue': SCALAR_JSON,
  'google.protobuf.Any': SCALAR_JSON,
};

const Converter = {
  /**
   * Convert protobufType to GraphQL Type
   */
  type(protobufTypeField: TypeField) {
    const { label } = protobufTypeField;
    const protobufType = protobufTypeField.type;
    const myType =
      PROTO_SCALAR_TYPES[protobufType] || protobufTypeField.typeName;
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

type TypeResolution =
  | { kind: 'scalar'; scalarName: string }
  | { kind: 'message'; registeredName: string; packageObj: any };

/**
 * Resolve a message-typed field's `typeName` to where its GraphQL type
 * actually lives. `typeName` alone doesn't say whether it's a type nested
 * inside the message currently being converted (this also covers the
 * synthetic map-entry type protoc generates for `map<K,V>` fields), a
 * top-level sibling in the same package, a well-known protobuf type with a
 * fixed scalar mapping, or a fully-qualified cross-package reference.
 */
function resolveType(
  packageObjects: any,
  packageObj: { [x: string]: any },
  parentMessageType: any,
  parentRegisteredName: string,
  typeName: string,
): TypeResolution {
  if (WELL_KNOWN_SCALARS[typeName]) {
    return { kind: 'scalar', scalarName: WELL_KNOWN_SCALARS[typeName] };
  }

  const nestedMessage =
    parentMessageType &&
    parentMessageType.nestedType &&
    parentMessageType.nestedType.find(
      (nested: { name: string }) => nested.name === typeName,
    );

  if (nestedMessage) {
    const registeredName = `${parentRegisteredName}_${typeName}`;
    return {
      kind: 'message',
      registeredName,
      packageObj: { [registeredName]: { type: nestedMessage } },
    };
  }

  if (packageObj[typeName]) {
    return { kind: 'message', registeredName: typeName, packageObj };
  }

  if (typeName.indexOf('.') !== -1) {
    const resolved = recursiveGetPackage(typeName.split('.'), packageObjects);

    if (resolved) {
      const registeredName = replacePackageName(typeName);
      return {
        kind: 'message',
        registeredName,
        packageObj: { [registeredName]: resolved },
      };
    }
  }

  throw new Error(
    `Unknown type reference '${typeName}' from message '${parentRegisteredName}'`,
  );
}

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

    // Resolve every TYPE_MESSAGE field's typeName up front: it may point at a
    // type nested inside this very message (including a `map<K,V>` field's
    // synthetic entry type), a well-known protobuf type with a fixed scalar
    // mapping, or a cross-package type. `Converter.type()` above only knows
    // the raw (possibly ambiguous or unqualified) `typeName`, so field
    // response types get rewritten below once resolution has run.
    const messageTypeRenames = new Map<string, string>();

    if (__messageType) {
      for (let i = 0; i < __messageType.length; i++) {
        const messageItem = __messageType[i];
        const resolution = resolveType(
          packageObjects,
          packageObj,
          messageType,
          protobufMessageName,
          messageItem.typeName,
        );

        if (resolution.kind === 'scalar') {
          messageTypeRenames.set(messageItem.typeName, resolution.scalarName);
        } else {
          if (resolution.registeredName !== messageItem.typeName) {
            messageTypeRenames.set(
              messageItem.typeName,
              resolution.registeredName,
            );
          }
          typeConverter(resolution.packageObj, resolution.registeredName, {
            isInput,
          });
        }
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

        if (responseType && messageTypeRenames.has(responseType.type)) {
          responseType.type = messageTypeRenames.get(responseType.type);
        }

        if (responseType && CUSTOM_SCALARS.indexOf(responseType.type) >= 0) {
          gqlSchema.useScalar(responseType.type);
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

      // An RPC's request/response type is always a same-package sibling in
      // every case observed in practice. proto-loader fully resolves it to a
      // constructor object rather than a `typeName` string, so — unlike a
      // field's type — there's no fully-qualified name available to detect a
      // well-known/cross-package type directly used as an RPC signature type
      // (e.g. `rpc Get(google.protobuf.Empty) returns (...)`); that's a known
      // limitation, surfaced as a clear error rather than silently corrupting
      // the schema. Wrap such a type in a message field instead, where full
      // resolution (see `resolveType`) applies.
      const convertRpcMessageType = (resolvedType: any, isInput: boolean) => {
        const typeName = resolvedType.type.name;

        if (!packageObj[typeName]) {
          throw new Error(
            `Unknown type reference '${typeName}' used directly as an RPC ` +
              'request/response type (well-known/cross-package types are ' +
              'only resolvable as message fields, not as the RPC signature ' +
              'type itself)',
          );
        }

        typeConverter(packageObj, typeName, { isInput });
        return typeName;
      };

      for (let j = 0; j < serviceKeys.length; j++) {
        const service = serviceKeys[j];
        const serviceName = service;
        const serviceObj = packageObj[protosType].service[service];
        const requestTypeName = convertRpcMessageType(
          serviceObj.requestType,
          true,
        );
        const responseTypeName = convertRpcMessageType(
          serviceObj.responseType,
          false,
        );

        serviceType.push({
          name: serviceName,
          requestParams: [
            {
              name: 'request',
              type: requestTypeName,
            },
          ],
          responseType: responseTypeName,
        });
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
              type: gqlSchema.getTypeRef(param.type),
            };
          },
        );

        if (
          Array.isArray(queryFunctions) &&
          queryFunctions.indexOf(service.name) >= 0
        ) {
          debug(`Adding query function: ${service.name}`);
          protoGqlTypeQuery.addFieldWithParams(service.name, params, {
            type: gqlSchema.getTypeRef(service.responseType),
          });
        } else if (
          Array.isArray(mutateFunctions) &&
          mutateFunctions.indexOf(service.name) >= 0
        ) {
          debug(`Adding mutate function: ${service.name}`);
          protoGqlTypeMutate.addFieldWithParams(service.name, params, {
            type: gqlSchema.getTypeRef(service.responseType),
          });
        } else {
          debug(`Adding query & mutate function: ${service.name}`);
          protoGqlTypeQuery.addFieldWithParams(service.name, params, {
            type: gqlSchema.getTypeRef(service.responseType),
          });
          protoGqlTypeMutate.addFieldWithParams(service.name, params, {
            type: gqlSchema.getTypeRef(service.responseType),
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
