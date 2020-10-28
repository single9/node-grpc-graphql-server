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
 * Read Protobuf files from directory
 * @param {string} dirpath Protobuf file directory
 */
function readProtofiles(dirpath) {
  const protosFiles = fs.readdirSync(dirpath);
  let files = protosFiles.filter(file => path.extname(file) === '.proto')
    .map(file => dirpath + '/' + file);

  let dirs = protosFiles.filter(file => path.extname(file) !== '.proto')
    .map(file => dirpath + '/' + file)
    .filter(file => fs.statSync(file).isDirectory());

  if (dirs.length > 0) {
    dirs.forEach(dir => {
      files = files.concat(readProtofiles(dir));
    });
  }
  return files;
}

module.exports = {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
  genResolverType,
  genResolvers,
};
