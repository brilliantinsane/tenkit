import { resolve } from 'node:path';

import { parseExactReleaseSetVersion } from './exact-release-set-version';
import { reproduceReleaseSet as reproduceCanonicalReleaseSet } from './reproduce-release-set';

type BuildDraftReleaseSetInput = {
  workspaceRoot: string;
  sourceSha: string;
  version: string;
  reproduceReleaseSet?: typeof reproduceCanonicalReleaseSet;
};

export async function buildDraftReleaseSet(input: BuildDraftReleaseSetInput) {
  if (!parseExactReleaseSetVersion(input.version)) {
    throw new Error('Draft build requires one exact Stable or RC version.');
  }

  const reproduction = await (input.reproduceReleaseSet ?? reproduceCanonicalReleaseSet)({
    repositoryRoot: input.workspaceRoot,
    outputRoot: resolve(input.workspaceRoot, 'release-artifacts'),
    sourceSha: input.sourceSha,
    version: input.version,
  });

  if (reproduction.sourceSha !== input.sourceSha || reproduction.version !== input.version) {
    throw new Error('Canonical reproduction returned a different Release Set identity.');
  }

  return {
    sourceSha: reproduction.sourceSha,
    version: reproduction.version,
    packages: reproduction.packages,
  };
}
