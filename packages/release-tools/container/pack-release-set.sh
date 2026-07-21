#!/usr/bin/env bash

set -euo pipefail

workspace_root=/workspace
artifact_root=/artifacts
# The reviewed source commit owns this graph; never accept package roots from the host checkout.
package_names=('@tenkit/template-generator' '@tenkit/cli' 'create-tenkit')
package_roots=('packages/template-generator' 'packages/cli' 'packages/create-tenkit')

export CI=true
export INIT_CWD="$workspace_root"
export LC_ALL=C
export SOURCE_DATE_EPOCH=0
export TZ=UTC

exact_version() {
  local value="${1#v}"
  local description="$2"

  if [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "$description must specify one exact major.minor.patch version." >&2
    return 1
  fi

  printf '%s' "$value"
}

run_quietly() {
  local log
  log="$(mktemp)"

  if ! "$@" >"$log" 2>&1; then
    cat "$log" >&2
    rm -f "$log"
    return 1
  fi

  rm -f "$log"
}

if (( $# != 0 )); then
  echo 'pack-release-set.sh does not accept arguments.' >&2
  exit 2
fi

: "${TENKIT_RELEASE_VERSION:?}"
: "${TENKIT_NODE_VERSION:?}"
: "${TENKIT_NPM_VERSION:?}"
: "${TENKIT_PNPM_VERSION:?}"

cd "$workspace_root"

source_node="$(exact_version "$(tr -d '[:space:]' < .nvmrc)" '.nvmrc')"
source_npm="$(exact_version "$(tr -d '[:space:]' < .npm-version)" '.npm-version')"
package_manager="$(npm pkg get packageManager --workspaces=false)"
package_manager="${package_manager#\"}"
package_manager="${package_manager%\"}"

if [[ ! "$package_manager" =~ ^pnpm@([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo 'package.json#packageManager must pin one exact pnpm major.minor.patch version.' >&2
  exit 1
fi

source_pnpm="${BASH_REMATCH[1]}"
expected_node="$(exact_version "$TENKIT_NODE_VERSION" 'TENKIT_NODE_VERSION')"
expected_npm="$(exact_version "$TENKIT_NPM_VERSION" 'TENKIT_NPM_VERSION')"
expected_pnpm="$(exact_version "$TENKIT_PNPM_VERSION" 'TENKIT_PNPM_VERSION')"

if [[ "$source_node" != "$expected_node" || \
      "$source_npm" != "$expected_npm" || \
      "$source_pnpm" != "$expected_pnpm" ]]; then
  echo 'Release Set source toolchain pins changed after container selection.' >&2
  exit 1
fi

actual_node="$(node --version)"
actual_node="${actual_node#v}"

if [[ "$actual_node" != "$expected_node" ]]; then
  echo "Release Set container requires Node $expected_node, found $actual_node." >&2
  exit 1
fi

actual_npm="$(npm --version)"
actual_pnpm="$(pnpm --version)"

if [[ "$actual_npm" != "$expected_npm" ]]; then
  echo "Release Set container requires npm $expected_npm, found $actual_npm." >&2
  exit 1
fi

if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
  echo "Release Set container requires pnpm $expected_pnpm, found $actual_pnpm." >&2
  exit 1
fi

install_filters=()

for package_name in "${package_names[@]}"; do
  install_filters+=(--filter "${package_name}...")
done

run_quietly pnpm install --frozen-lockfile --ignore-scripts "${install_filters[@]}"
release_version="$(exact_version "$TENKIT_RELEASE_VERSION" 'TENKIT_RELEASE_VERSION')"

for index in "${!package_names[@]}"; do
  package_name="${package_names[index]}"
  package_root="${package_roots[index]}"
  actual_name="$(npm pkg get name --prefix "$package_root" --workspaces=false)"
  actual_name="${actual_name#\"}"
  actual_name="${actual_name%\"}"

  if [[ "$actual_name" != "$package_name" ]]; then
    echo "Expected package metadata for $package_name." >&2
    exit 1
  fi

  run_quietly npm pkg set "version=$release_version" --prefix "$package_root" --workspaces=false
done

for package_name in "${package_names[@]}"; do
  run_quietly pnpm --filter "$package_name" pack --pack-destination "$artifact_root"
done
