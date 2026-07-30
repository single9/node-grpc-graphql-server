#!/usr/bin/env node

const { genGrpcJs } = require('..');

function init(protoFile, outDir) {
  if (!protoFile || !outDir) {
    throw new Error('Usage: grpc-graphql-server init <proto_dir> <out_dir>');
  }
  return genGrpcJs(protoFile, outDir);
}

const { argv } = process;
const command = argv[2];

if (!command) throw new Error('Missing command');

switch (command) {
  case 'init':
    init(argv[3], argv[4]);
    break;
  default:
    console.log(`Unknown command: ${command}`);
    process.exit(1);
}
