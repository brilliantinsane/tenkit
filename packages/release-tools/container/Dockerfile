# Canonical image shared by Draft and local Release Verification.
# The base digest is the official Ubuntu 24.04 multi-platform manifest resolved
# from Docker Hub on 2026-07-20. Toolchain versions are supplied from the
# reviewed source commit by run-release-container.ts.
FROM ubuntu:24.04@sha256:4fbb8e6a8395de5a7550b33509421a2bafbc0aab6c06ba2cef9ebffbc7092d90

ARG NODE_VERSION
ARG NPM_VERSION
ARG PNPM_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  curl --fail --location --silent --show-error \
    --output /tmp/node.tar.xz \
    "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"; \
  tar --extract --xz --file /tmp/node.tar.xz --directory /usr/local --strip-components=1; \
  rm /tmp/node.tar.xz; \
  npm install --global "npm@${NPM_VERSION}" "pnpm@${PNPM_VERSION}"; \
  test "$(node --version)" = "v${NODE_VERSION}"; \
  test "$(npm --version)" = "${NPM_VERSION}"; \
  test "$(pnpm --version)" = "${PNPM_VERSION}"

COPY container/pack-release-set.sh /usr/local/bin/

RUN chmod 0555 /usr/local/bin/pack-release-set.sh \
  && useradd --create-home verifier

USER verifier
WORKDIR /workspace
