const { readDir } = require('../tools.js');

let controller = {};;

const controllerFiles = readDir(__dirname, '.js');
controllerFiles.forEach(file => {
  let controllerClass = require(file);
  if (('name' in controllerClass) === false) return;
  let name = controllerClass.name;
  controller[name] = new controllerClass();
});

module.exports = controller;
