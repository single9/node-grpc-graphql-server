#!/usr/bin/env node

const { RPCServer } = require('../index.js');

function init(protoFile, outDir) {
  return new RPCServer({
    grpc: {
      protoFile,
      generatedCode: {
        outDir,
      },
    },
  });
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
}

process.exit(0);
