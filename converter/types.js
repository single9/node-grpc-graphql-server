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
  (input) => finder(['INT', 'FIXED'], 'Int', input),
  (input) => finder(['FLOAT', 'DOUBLE'], 'Float', input),
  (input) => finder(['STRING', 'BYTES'], 'String', input),
  (input) => finder(['BOOL'], 'Boolean', input),
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

/**
 * Convert protobufType to GraphQL Type
 * @param {TypeField} protobufTypeField
 */
function convertType(protobufTypeField) {
  const { label } = protobufTypeField;
  const protobufType = protobufTypeField.type;
  const gqlType = findType(protobufType);
  let myType = gqlType || protobufTypeField.typeName;

  switch (label) {
    case 'LABEL_OPTIONAL':
      // myType = gqlType;
      break;
    case 'LABEL_REPEATED':
      myType = `[${myType}]`;
      break;
    case 'LABEL_REQUIRED':
      myType = `${myType}!`;
      break;
    default:
      // do nothing
      break;
  }
  return myType;
}

module.exports = convertType;

/**
 * @typedef {object} TypeField
 * @property {string} name
 * @property {string} type
 * @property {string} label
 */
