import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { RPCServicePackages } from './rpc-service';

const grpcTools = `${process.cwd()}/node_modules/grpc-tools/bin/protoc.js`;
const allowResolverType = ['query', 'mutate'];

interface IGqlResolver {
  (parent?: any, args?: any, context?: any, info?: any): any;
}

export type GenGrpcJsOpts = {
  outputType: 'grpc_js' | 'generate_package_definition';
};

/**
 * Replace package name
 */
function replacePackageName(name: string) {
  return (name.indexOf('.') !== -1 && name.replace(/\./g, '_')) || name;
}

/**
 * Generate resolvers
 */
function genResolverType(type: string, packages: RPCServicePackages[]) {
  if (allowResolverType.indexOf(type) < 0)
    throw new Error(`Invalid type: ${type}`);

  const resolverObj: {
    [x: string]: IGqlResolver;
  } = {};

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

function genResolvers(packages: RPCServicePackages[]) {
  const resolvers: {
    Query?: { [x: string]: IGqlResolver };
    Mutation?: { [x: string]: IGqlResolver };
  } = {};
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
 * @param packageNames Package name
 * @param _package     gRPC package object
 */
function recursiveGetPackage(packageNames: string[], _package: object) {
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
function readDir(dir: string, extname: string) {
  if (!dir) throw new Error('`dir` must be specified.');
  if (!extname) throw new Error('`extname` must be specified.');
  if (fs.statSync(dir).isDirectory() === false) {
    return [dir];
  }

  const protosFiles = fs.readdirSync(dir);
  let files = protosFiles
    .filter((file) => path.extname(file) === extname)
    .map((file) => `${dir}/${file}`);

  const dirs = protosFiles
    .filter((file) => path.extname(file) !== extname)
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
function readProtofiles(protoFilePath: string) {
  return readDir(protoFilePath, '.proto');
}

function hyphensToCamelCase(str: string, upperCaseFirstChar?: boolean) {
  const arr = str.split(/[_-]/);
  let newStr = '';
  for (let i = upperCaseFirstChar === true ? 0 : 1; i < arr.length; i++) {
    newStr += arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
  }
  return upperCaseFirstChar === true ? newStr : arr[0] + newStr;
}

function checkGrpcTools() {
  const isGrpcToolsExists = fs.existsSync(grpcTools);

  if (!isGrpcToolsExists) {
    throw new Error(
      'WARNING: `grpc-tools` is not intalled. I cannot convert your protobufs to grpc js module.',
    );
  }
}

/**
 * Convert protobuf files into gRPC code
 *
 * @param protoFilePath Path of protibufs file
 * @param outputDir     Path of output directory
 * @param opts          Options for generating grpc js
 */
function genGrpcJs(
  protoFilePath: string,
  outputDir: string,
  opts?: GenGrpcJsOpts,
) {
  checkGrpcTools();
  if (!outputDir) throw new Error('outDir is required');

  const baseOutputDir = path.resolve(outputDir);
  const isBaseOutputDirExists = fs.existsSync(baseOutputDir);

  if (!protoFilePath) throw new Error('protoFilePath is required');
  if (!isBaseOutputDirExists) fs.mkdirSync(baseOutputDir);

  const outputType = (opts && opts.outputType) || 'generate_package_definition';
  const files = readProtofiles(protoFilePath);
  const args = [
    `--proto_path=${protoFilePath}`,
    `--js_out=import_style=commonjs,binary:${baseOutputDir}`,
    `--grpc_out=${outputType}:${baseOutputDir}`,
    ...files,
  ];
  const tools = spawnSync(grpcTools, args);

  if (tools.stderr && tools.stderr.length > 0) {
    throw new Error(tools.stderr.toString());
  }

  const result = {
    outputType,
    services: readDir(baseOutputDir, '.js').filter(
      (val) => val.search(/_grpc_pb.js$/) >= 0,
    ),
    messages: readDir(baseOutputDir, '.js').filter(
      (val) => val.search(/_pb.js$/) >= 0,
    ),
  };

  const indexModuleName = [];
  const writeIndexFile = (
    data: string | NodeJS.ArrayBufferView,
    flag?: string,
  ) => {
    fs.writeFileSync(`${baseOutputDir}/index.js`, data, { flag });
  };

  writeIndexFile('// GENERATED CODE -- DO NOT EDIT!\n/* eslint-disable */\n\n');

  for (let i = 0; i < result.services.length; i++) {
    const service = result.services[i];
    const moduleName = hyphensToCamelCase(path.basename(service, '.js'));
    indexModuleName.push(moduleName);
    writeIndexFile(
      `const ${moduleName} = require('./${path.relative(
        baseOutputDir,
        service,
      )}');\n`,
      'a+',
    );
  }

  // generate grpc module index file
  let tempExportStr = '\nmodule.exprts = {\n\tproto,\n<exports>\n};\n';
  let exportModule = '';

  for (let i = 0; i < indexModuleName.length; i++) {
    const name = indexModuleName[i];
    exportModule += `\t${name},${
      (i !== indexModuleName.length - 1 && '\n') || ''
    }`;
  }

  tempExportStr = tempExportStr.replace('<exports>', exportModule);
  writeIndexFile(tempExportStr, 'a+');

  return result;
}

function getGrpcJsFiles(grpcJsFileDir) {
  checkGrpcTools();
  if (!grpcJsFileDir) throw new Error('grpcJsFileDir is required');

  const baseGrpcJsFileDir = path.resolve(grpcJsFileDir);
  const isBaseGrpcJsFileDirExists = fs.existsSync(baseGrpcJsFileDir);

  if (!isBaseGrpcJsFileDirExists) fs.mkdirSync(baseGrpcJsFileDir);

  return {
    services: readDir(baseGrpcJsFileDir, '.js').filter(
      (val) => val.search(/_grpc_pb.js$/) >= 0,
    ),
    messages: readDir(baseGrpcJsFileDir, '.js').filter(
      (val) => val.search(/_pb.js$/) >= 0,
    ),
  };
}

export {
  recursiveGetPackage,
  replacePackageName,
  readProtofiles,
  genResolverType,
  genResolvers,
  readDir,
  genGrpcJs,
  getGrpcJsFiles,
  hyphensToCamelCase,
};
