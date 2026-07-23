type ExactStableVersionParts = readonly [major: string, minor: string, patch: string];

const EXACT_STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseExactStableVersion(version: string): ExactStableVersionParts | undefined {
  const match = EXACT_STABLE_VERSION_PATTERN.exec(version);

  if (!match) {
    return undefined;
  }

  return [match[1], match[2], match[3]];
}

export function compareExactStableVersions(left: string, right: string): number {
  const leftParts = parseExactStableVersion(left);
  const rightParts = parseExactStableVersion(right);

  if (!leftParts || !rightParts) {
    throw new Error('Release Set version comparison requires exact stable versions.');
  }

  for (const index of [0, 1, 2] as const) {
    const difference = Number(leftParts[index]) - Number(rightParts[index]);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}
