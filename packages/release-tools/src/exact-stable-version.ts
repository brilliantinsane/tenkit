type ExactStableVersionParts = readonly [major: string, minor: string, patch: string];

const EXACT_STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseExactStableVersion(version: string): ExactStableVersionParts | undefined {
  const match = EXACT_STABLE_VERSION_PATTERN.exec(version);

  if (!match) {
    return undefined;
  }

  return [match[1], match[2], match[3]];
}
