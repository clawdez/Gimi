#!/usr/bin/env bash
# E2E: production build + local Supabase stack + Playwright.
# Requires the supabase CLI (docker) — starts the stack if it isn't running.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.local/share/supabase:$PATH"

if ! supabase status >/dev/null 2>&1; then
  echo "==> starting local Supabase stack"
  supabase start
fi

eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export SOLANA_CLUSTER="devnet"

echo "==> production build"
npx next build

echo "==> playwright e2e (production server on :3000)"
npx playwright test "$@"
