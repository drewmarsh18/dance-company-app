#!/bin/bash
set -euo pipefail

echo "=== EAS POST-INSTALL HOOK: running pnpm install from monorepo root ==="
MONOREPO_ROOT="$(git rev-parse --show-toplevel)"
echo "Monorepo root: $MONOREPO_ROOT"
cd "$MONOREPO_ROOT"
pnpm install --no-frozen-lockfile
echo "=== EAS POST-INSTALL HOOK: done ==="
