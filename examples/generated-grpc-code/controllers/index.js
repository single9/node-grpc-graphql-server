/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
const { readDir } = require('../../../dist/libs/tools.js');

const controller = {};
const controllerFiles = readDir(__dirname, '.js');

controllerFiles.forEach((file) => {
  const ControllerClass = require(file);
  if (('name' in ControllerClass) === false) return;
  const { name } = ControllerClass;
  const tmpClass = new ControllerClass();
  controller[name] = tmpClass;
});

module.exports = controller;
