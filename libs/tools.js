const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const grpcTools = `${process.cwd()}/node_modules/grpc-tools/bin/protoc.js`;
const allowResolverType = [
  'query',
  'mutate',
];

/**
 * Replace package name
 * @param {string} name Name
 */
function replacePackageName(name) {
  return (name.indexOf('.') !== -1 && name.replace(/\./g, '_')) || name;
}

/**
 *
 * @param {string} type Type
 * @param {RPCService.RPCServicePackages[]} packages
 */
function genResolverType(type, packages) {
  if (allowResolverType.indexOf(type) < 0) throw new Error(`Invalid type: ${type}`);

  const resolverObj = {};

  packages.forEach((pack) => {
    const serviceFn = {};

    pack.services.forEach((service) => {
      if (service[type] === false || service.grpcOnly) return;
      serviceFn[service.name] = () => service.implementation;
    });

    const packageName = replacePackageName(pack.name);

    if (!resolverObj[packageName] && Object.keys(serviceFn).length > 0) {
      resolverObj[packageName] = function resolverFn() {
        return serviceFn;
      };
    }
  });

  return resolverObj;
}

function genResolvers(packages) {
  const resolvers = {};
  const Query = genResolverType('query', packages);
  const Mutation = genResolverType('mutate', packages);

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
 * @param {object} _package    gRPC package object
 */
function recursiveGetPackage(packageNames, _package) {
  const name = packageNames.shift();
  const pkg = _package[name];
  if (packageNames.length > 0) {
    return recursiveGetPackage(packageNames, pkg);
  }
  return pkg;
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
  let files = protosFiles.filter((file) => path.extname(file) === extname)
    .map((file) => `${dir}/${file}`);

  const dirs = protosFiles.filter((file) => path.extname(file) !== extname)
    .map((file) => `${dir}/${file}`)
    .filter((file) => fs.statSync(file).isDirectory());

  if (dirs.length > 0) {
    dirs.forEach((_dir) => {
      files = files.concat(readDir(_dir, extname));
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

/**
 * Convert protobuf files into gRPC code
 *
 * @param {string} protoFilePath Path of protibufs file
 * @param {*}      outputDir     Path of output directory
 * @returns
 */
function genGrpcJs(protoFilePath, outputDir) {
  const isGrpcToolsExists = fs.existsSync(grpcTools);
  const isOutputDirExists = fs.existsSync(outputDir);

  if (!protoFilePath) throw new Error('protoFilePath is required');
  if (!isGrpcToolsExists) {
    console.warn('WARNING: `grpc-tools` is not intalled. I cannot convert your protobufs to grpc js module.');
    return undefined;
  }

  if (!isOutputDirExists) {
    fs.mkdirSync(outputDir);
  }

  const files = readDir(protoFilePath, '.proto');
  const args = [
    `--proto_path=${protoFilePath}`,
    `--js_out=import_style=commonjs,binary:${outputDir}`,
    `--grpc_out=grpc_js:${outputDir}`,
    ...files,
  ];
  const tools = spawnSync(grpcTools, args);

  if (tools.stderr && tools.stderr.length > 0) {
    throw new Error(tools.stderr.toString());
  }

  return readDir(outputDir, '.js');
}

module.exports = {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
  genResolverType,
  genResolvers,
  readDir,
  genGrpcJs,
};
