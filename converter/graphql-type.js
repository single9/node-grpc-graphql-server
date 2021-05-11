/** @enum {string} */
const block = Object.freeze({
  scalar: 'scalar',
  type: 'type',
  input: 'input',
  enum: 'enum',
});

/** @enum {string} */
const type = Object.freeze({
  Int: 'Int',
  Float: 'Float',
  String: 'String',
  Boolean: 'Boolean',
  ID: 'ID',
});

module.exports = {
  block,
  type,
};
