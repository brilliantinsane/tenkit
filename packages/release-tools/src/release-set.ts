export const RELEASE_SET_PACKAGES = [
  {
    name: '@tenkit/types',
    root: 'packages/types',
    artifactPrefix: 'tenkit-types',
    internalDependencies: [],
    requiredArtifactPaths: [
      'package/package.json',
      'package/README.md',
      'package/dist/setup-type-definitions.mjs',
      'package/dist/setup-type-definitions.d.mts',
      'package/dist/styling-definitions.mjs',
      'package/dist/styling-definitions.d.mts',
    ],
  },
  {
    name: '@tenkit/template-generator',
    root: 'packages/template-generator',
    artifactPrefix: 'tenkit-template-generator',
    internalDependencies: ['@tenkit/types'],
    requiredArtifactPaths: [
      'package/package.json',
      'package/README.md',
      'package/dist/index.mjs',
      'package/dist/index.d.mts',
      'package/dist/generator.mjs',
      'package/dist/generator.d.mts',
      'package/dist/writer.mjs',
      'package/dist/writer.d.mts',
      'package/dist/local-proof.mjs',
      'package/dist/local-proof.d.mts',
      'package/templates/shared/AGENTS.md.hbs',
    ],
  },
  {
    name: '@tenkit/cli',
    root: 'packages/cli',
    artifactPrefix: 'tenkit-cli',
    internalDependencies: ['@tenkit/types', '@tenkit/template-generator'],
    requiredArtifactPaths: [
      'package/package.json',
      'package/README.md',
      'package/dist/index.mjs',
      'package/dist/index.d.mts',
    ],
  },
  {
    name: 'create-tenkit',
    root: 'packages/create-tenkit',
    artifactPrefix: 'create-tenkit',
    internalDependencies: ['@tenkit/cli'],
    requiredArtifactPaths: [
      'package/package.json',
      'package/README.md',
      'package/dist/index.mjs',
      'package/dist/index.d.mts',
    ],
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
