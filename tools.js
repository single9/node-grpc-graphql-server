function recursiveGetPackage(packageNames, __package) {
  const name = packageNames.shift();
  __package = __package[name];
  if (packageNames.length > 0) {
    return recursiveGetPackage(packageNames, __package);
  } else {
    return __package;
  }
}

function replacePackageName(name) {
  return name.indexOf('.') !== -1 && name.replace(/\./g, '_') || name;
}

module.exports = {
  recursiveGetPackage,
  replacePackageName,
};
