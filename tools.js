const fs = require('fs');

/**
 * Get package data
 * @param {string} packageNames Package name
 * @param {object} __package    gRPC package object
 */
function recursiveGetPackage(packageNames, __package) {
  const name = packageNames.shift();
  __package = __package[name];
  if (packageNames.length > 0) {
    return recursiveGetPackage(packageNames, __package);
  } else {
    return __package;
  }
}

/**
 * Replace package name
 * @param {string} name Name
 */
function replacePackageName(name) {
  return name.indexOf('.') !== -1 && name.replace(/\./g, '_') || name;
}

/**
 * Read Protobuf files from directory
 * @param {string} dirpath Protobuf file directory
 */
function readProtofiles(dirpath) {
  const protosFiles = fs.readdirSync(dirpath);
  return protosFiles.map(file => dirpath + '/' + file);
}

module.exports = {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
};
