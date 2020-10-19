// Finders
let typeFinders = [
  (input) => finder(['INT', 'FIXED'], 'Int', input),
  (input) => finder(['FLOAT', 'DOUBLE'], 'Float', input),
  (input) => finder(['STRING', 'BYTES'], 'String', input),
  (input) => finder(['BOOL'], 'Boolean', input),
];

/**
 * Finder
 * @param {[]} types 
 * @param {*} returnType 
 */
function finder(types, returnType, input) {
  return types.find((val) => input.indexOf(val) > -1) && returnType;
}

/**
 * Find type (factory function) 
 * @param {string} input 
 * @returns {string} Type function (`Number`|`String`|`Boolean`)
 */
function findType(input) {
  for (let i = 0; i < typeFinders.length; i++) {
    let typeFinder = typeFinders[i].call(null, input);
    if (typeFinder) return typeFinder;
  }
}

/**
 * Convert protobufType to GraphQL Type
 * @param {string} protobufType 
 */
function convertType(protobufType) {
  return findType(protobufType);
}

module.exports = convertType;
