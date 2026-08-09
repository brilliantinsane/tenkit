const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
];

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

module.exports = {
  hooks: {
    beforePacking(manifest) {
      for (const field of dependencyFields) {
        const dependencies = manifest[field];

        if (dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies)) {
          manifest[field] = Object.fromEntries(
            Object.entries(dependencies).sort(([left], [right]) => compareNames(left, right)),
          );
        }
      }

      return manifest;
    },
  },
};
