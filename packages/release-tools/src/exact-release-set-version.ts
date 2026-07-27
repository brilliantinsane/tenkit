import { parseExactStableVersion } from './exact-stable-version';

export type ExactReleaseSetVersion =
  | {
      channel: 'stable';
      version: string;
      targetVersion: string;
    }
  | {
      channel: 'rc';
      version: string;
      targetVersion: string;
      ordinal: number;
    };

const EXACT_RELEASE_CANDIDATE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-rc\.([1-9]\d*)$/;

export function parseExactReleaseSetVersion(version: string): ExactReleaseSetVersion | undefined {
  if (parseExactStableVersion(version)) {
    return {
      channel: 'stable',
      version,
      targetVersion: version,
    };
  }

  const match = EXACT_RELEASE_CANDIDATE_VERSION_PATTERN.exec(version);

  if (!match) {
    return undefined;
  }

  const ordinal = Number(match[4]);

  if (!Number.isSafeInteger(ordinal)) {
    return undefined;
  }

  return {
    channel: 'rc',
    version,
    targetVersion: `${match[1]}.${match[2]}.${match[3]}`,
    ordinal,
  };
}
