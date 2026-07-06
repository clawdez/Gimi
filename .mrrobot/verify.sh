#!/usr/bin/env bash
# Self-proving verification for the Gimi Redbox build.
# Fails if typecheck, build, or unit tests fail — or if any stub still
# returns a fake `mock_` signature.
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

echo "==> Production build"
npm run build

echo "==> verify.sh PASSED"
