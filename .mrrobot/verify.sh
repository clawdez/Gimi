#!/usr/bin/env bash
# Self-proving verification for the Gimi production build.
# Gates: no mock_ stubs, typecheck, unit tests, production build with a real
# env contract, and (unless SKIP_E2E=1) migrations + headless browser E2E
# covering magic-link auth, listing, Stripe TEST rent, and RLS refusals.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Guard: no mock_ signatures in src/"
if grep -rn "mock_" src/; then
  echo "FAIL: found mock_ stub signatures in src/ — the integrations must be real."
  exit 1
fi
echo "OK: no mock_ stubs."

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests (Supabase, Stripe, Solana all mocked)"
npm test

if [ "${SKIP_E2E:-0}" = "1" ]; then
  echo "==> Production build (E2E skipped via SKIP_E2E=1)"
  npm run build
else
  export PATH="$HOME/.local/share/supabase:$PATH"
  if ! command -v supabase >/dev/null; then
    echo "FAIL: supabase CLI not found — install it or run with SKIP_E2E=1."
    exit 1
  fi

  echo "==> Local Supabase: apply migrations + seed (auth, RLS, demo inventory)"
  if ! supabase status >/dev/null 2>&1; then
    supabase start
  fi
  supabase db reset

  echo "==> Production build + headless E2E (auth, listing, rent, RLS)"
  ./.mrrobot/e2e.sh
fi

echo "==> verify.sh PASSED"
