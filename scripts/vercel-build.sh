#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[vercel-build] monorepo root: $ROOT"

pnpm --filter @nexus/shared build
pnpm --filter @nexus/api build
pnpm --filter @nexus/web build
node scripts/vercel-prepare.mjs

WEB_DIST="$ROOT/packages/web/dist"
WEB_PUBLIC="$ROOT/packages/web/public"

if [[ ! -f "$WEB_DIST/index.html" ]]; then
  echo "[vercel-build] ERROR: missing $WEB_DIST/index.html"
  exit 1
fi

if [[ ! -f "$WEB_PUBLIC/index.html" ]]; then
  echo "[vercel-build] ERROR: missing $WEB_PUBLIC/index.html"
  exit 1
fi

echo "[vercel-build] OK dist + public ready for Vercel (option A: output dist or public)"
