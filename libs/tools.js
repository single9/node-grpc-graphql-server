const fs = require('fs');
const path = require('path');
const allowResolverType = [
  'query',
  'mutate',
];

/**
 * 
 * @param {string} type Type
 * @param {RPCService.RPCServicePackages[]} packages 
 */
function genResolverType(type, packages) {
  if (allowResolverType.indexOf(type) < 0) throw new Error(`Invalid type: ${type}`);

  let resolverObj = {};

  packages.forEach(pack => {
    let serviceFn = {};

    pack.services.forEach(service => {
      if (service[type] === false || service.grpcOnly) return;
      serviceFn[service.name] = () => service.implementation;
    });

    const packageName = replacePackageName(pack.name);

    if (!resolverObj[packageName] && Object.keys(serviceFn).length > 0)
      resolverObj[packageName] = function() {
        return serviceFn;
      };
  });

  return resolverObj;
}

function genResolvers(packages) {
  let resolvers = {};
  let Query = genResolverType('query', packages);
  let Mutation = genResolverType('mutate', packages);

  if (Object.keys(Query).length > 0) {
    resolvers.Query = Query;
  }

  if (Object.keys(Mutation).length > 0) {
    resolvers.Mutation = Mutation;
  }

  return resolvers;
}

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
 * Read directory
 * @param {string} dir Path of directory
 * @param {string} extname Extension name
 */
function readDir(dir, extname) {
  if (!dir) throw new Error('`dir` must be specified.');
  if (!extname) throw new Error('`extname` must be specified.');
  if (fs.statSync(dir).isDirectory() === false) {
    return [dir];
  }

  const protosFiles = fs.readdirSync(dir);
  let files = protosFiles.filter(file => path.extname(file) === extname)
    .map(file => dir + '/' + file);

  let dirs = protosFiles.filter(file => path.extname(file) !== extname)
    .map(file => dir + '/' + file)
    .filter(file => fs.statSync(file).isDirectory());

  if (dirs.length > 0) {
    dirs.forEach(dir => {
      files = files.concat(readProtofiles(dir));
    });
  }
  return files;
}

/**
 * Read Protobuf files from directory
 * @param {string} protoFilePath Path of protobuf file or directory
 */
function readProtofiles(protoFilePath) {
  return readDir(protoFilePath, '.proto');
}

module.exports = {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
  genResolverType,
  genResolvers,
  readDir,
};
