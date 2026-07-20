export const RELEASE_SET_PACKAGES = /** @type {const} */ ([
  {
    name: '@tenkit/template-generator',
    root: 'packages/template-generator',
    artifactPrefix: 'tenkit-template-generator',
  },
  {
    name: '@tenkit/cli',
    root: 'packages/cli',
    artifactPrefix: 'tenkit-cli',
    internalDependency: '@tenkit/template-generator',
  },
  {
    name: 'create-tenkit',
    root: 'packages/create-tenkit',
    artifactPrefix: 'create-tenkit',
    internalDependency: '@tenkit/cli',
  },
]);

/** @param {string} name */
export function getReleaseSetPackage(name) {
  const releasePackage = RELEASE_SET_PACKAGES.find((candidate) => candidate.name === name);

  if (!releasePackage) {
    throw new Error(`Unknown Release Set package ${name}.`);
  }

  return releasePackage;
}
