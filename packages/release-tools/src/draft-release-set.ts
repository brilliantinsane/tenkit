import { resolve } from 'node:path';

import { reproduceReleaseSet as reproduceCanonicalReleaseSet } from './reproduce-release-set';

type BuildDraftReleaseSetInput = {
  workspaceRoot: string;
  sourceSha: string;
  version: string;
  reproduceReleaseSet?: typeof reproduceCanonicalReleaseSet;
};

export async function buildDraftReleaseSet(input: BuildDraftReleaseSetInput) {
  const reproduction = await (input.reproduceReleaseSet ?? reproduceCanonicalReleaseSet)({
    repositoryRoot: input.workspaceRoot,
    outputRoot: resolve(input.workspaceRoot, 'release-artifacts'),
    sourceSha: input.sourceSha,
    version: input.version,
  });

  return {
    sourceSha: reproduction.sourceSha,
    version: reproduction.version,
    packages: reproduction.packages,
  };
}
