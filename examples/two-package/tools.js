const fs = require('fs');
const path = require('path');

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
  readProtofiles,
  readDir,
};
