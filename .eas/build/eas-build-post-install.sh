#!/bin/bash
set -euo pipefail

# EAS runs from apps/mobile. We need pnpm to install from the monorepo root
# so that expo-router and all workspace dependencies are properly hoisted.
MONOREPO_ROOT="$(git rev-parse --show-toplevel)"
echo "Running pnpm install from monorepo root: $MONOREPO_ROOT"
cd "$MONOREPO_ROOT"
pnpm install --frozen-lockfile
