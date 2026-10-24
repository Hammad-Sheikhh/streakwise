#!/usr/bin/env bash
# Vercel "Ignored Build Step" (see ignoreCommand in vercel.json): exit 0 = skip the build,
# exit 1 = build. Builds are skipped only when every changed file is under docs/ or is Markdown,
# same rule the Netlify ignore script enforced (SPEC §B14.1). Vercel sets both variables.

# No previous build to compare with (first deploy): build.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  exit 1
fi

# The previous commit isn't in this (possibly shallow) clone: build to be safe.
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi

# `git diff --quiet` exits 0 when nothing outside docs/Markdown changed (skip), 1 otherwise (build).
git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA:-HEAD}" -- . \
  ':(exclude,glob)docs/**' \
  ':(exclude,glob)**/*.md'
