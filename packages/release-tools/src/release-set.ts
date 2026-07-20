export const RELEASE_SET_PACKAGES = [
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
] as const;

type ReleaseSetPackage = (typeof RELEASE_SET_PACKAGES)[number];
export type ReleaseSetPackageName = ReleaseSetPackage['name'];

export function getReleaseSetPackage(name: string): ReleaseSetPackage {
  const releasePackage = RELEASE_SET_PACKAGES.find((candidate) => candidate.name === name);

  if (!releasePackage) {
    throw new Error(`Unknown Release Set package ${name}.`);
  }

  return releasePackage;
}
