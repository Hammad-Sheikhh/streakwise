#!/usr/bin/env bash
# Netlify "ignore" command: exit 0 = skip the build, exit 1 = build.
# Builds are skipped only when every changed file is under docs/ or is Markdown (SPEC §B14.1).

# No previous build to compare with (first deploy, or a retry of the same commit): build.
if [ -z "${CACHED_COMMIT_REF:-}" ] || [ "${CACHED_COMMIT_REF}" = "${COMMIT_REF:-}" ]; then
  exit 1
fi

# The previous commit isn't in this (possibly shallow) clone: build to be safe.
if ! git cat-file -e "${CACHED_COMMIT_REF}^{commit}" 2>/dev/null; then
  exit 1
fi

# `git diff --quiet` exits 0 when nothing outside docs/Markdown changed (skip), 1 otherwise (build).
git diff --quiet "${CACHED_COMMIT_REF}" "${COMMIT_REF}" -- . \
  ':(exclude,glob)docs/**' \
  ':(exclude,glob)**/*.md'
