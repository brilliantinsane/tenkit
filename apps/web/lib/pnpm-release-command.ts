const PNPM_LATEST_PACKAGE_SPEC = "tenkit@latest"

// Remove this release-specific module after pnpm resolves v0.2.0 through @latest.
export const PNPM_TEMPORARY_RELEASE_VERSION = "0.2.0"
export const PNPM_LATEST_SAFE_AT = Date.parse("2026-07-16T14:11:38.000Z")

const PNPM_PINNED_PACKAGE_SPEC = `tenkit@${PNPM_TEMPORARY_RELEASE_VERSION}`

export function resolvePnpmReleaseCommand(command: string, now: number) {
  const isTemporarilyPinned =
    now < PNPM_LATEST_SAFE_AT && command.includes(PNPM_LATEST_PACKAGE_SPEC)

  return {
    command: isTemporarilyPinned
      ? command.replace(PNPM_LATEST_PACKAGE_SPEC, PNPM_PINNED_PACKAGE_SPEC)
      : command,
    isTemporarilyPinned,
  }
}
