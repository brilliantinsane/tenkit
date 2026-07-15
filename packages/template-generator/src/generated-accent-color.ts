export type GeneratedAccentColor = `#${string}`;

export function normalizeGeneratedAccentColor(
  value: string | undefined,
): GeneratedAccentColor | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toUpperCase() as GeneratedAccentColor;
  }

  throw new Error(
    `Invalid generated accent color ${JSON.stringify(value)}. Expected a six-digit hex color such as "#208AEF".`,
  );
}
