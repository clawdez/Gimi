# Deploying Gimi to Vercel (gimi.vercel.app)

Gimi is a Next.js 16 app. Every rental charges a **Stripe TEST-mode** card and
mints a **Solana devnet** memo receipt. There is no live-money path: the server
refuses non-`sk_test_` Stripe keys and any Solana cluster other than devnet at
boot (`src/instrumentation.ts` → `src/lib/env.ts`).

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables.

### Critical — the server refuses to boot without these

| Variable | Source | Mode |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL (e.g. `https://<ref>.supabase.co`) | n/a |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key. Public by design; safe in the browser — RLS enforces access | n/a |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` key. **Server-only secret** — bypasses RLS; never expose to the browser, never prefix with `NEXT_PUBLIC_` | n/a |

Fallbacks accepted: `RECCO_SUPABASE_URL` for the URL, `RECCO_SUPABASE_SERVICE_KEY`
for the service key (shared "recco" project naming).

### Solana devnet receipts

| Variable | Source | Mode |
| --- | --- | --- |
| `SOLANA_CLUSTER` | Literal `devnet`. Optional (defaults to `devnet`); any other value refuses to boot | devnet only |
| `GIMI_SOLANA_KEYPAIR` | JSON array of the signer's secret key (contents of `.keys/gimi-devnet-keypair.json`, generated locally by `solana-keygen` or first local run). Devnet-only signer, funded by airdrop — holds no real value, but treat as a secret anyway | devnet only |

Without `GIMI_SOLANA_KEYPAIR` the serverless runtime generates an ephemeral
unfunded keypair per cold start; rentals still succeed but receipts report
`receiptError` until it is set.

### Stripe — optional, TEST mode only

The app degrades gracefully without these: `/api/card/*` and `/api/rent` return
503 `payment_not_configured` and the UI shows a "Payment not configured" banner.

| Variable | Source | Mode |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → Secret key **with "Test mode" toggled ON**. Must start with `sk_test_`; live keys are refused at boot | TEST only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page → Publishable key. Must start with `pk_test_`; live keys are refused | TEST only |

Test card for demos: `4242 4242 4242 4242`, any future expiry, any CVC.

## Supabase project setup (one-time)

1. Apply migrations to the project (they are idempotent):
   ```sh
   supabase link --project-ref <ref>
   supabase db push
   ```
   This creates the isolated `gimi` schema, auth columns (`owner_id`,
   `renter_id`, `user_id`), RLS policies, and the demo inventory seed.
2. Expose the `gimi` schema to the API: Dashboard → Settings → API →
   "Exposed schemas" → add `gimi`.
3. Auth → URL Configuration:
   - Site URL: `https://gimi.vercel.app`
   - Redirect URLs: `https://gimi.vercel.app/auth/callback`
4. Auth → Providers → Email: enable, passwordless (magic link) is the default.
   No SMTP config is needed for low volume (Supabase's built-in sender), but
   production email should configure custom SMTP.

## Deploy

```sh
vercel --prod   # or connect the repo and push
```

The production build (`next build`) and boot-time validation both fail fast
with a list of any missing/invalid vars, so a misconfigured deploy dies loudly
instead of half-working.

## What is intentionally NOT configurable

- **Solana mainnet** — `SOLANA_CLUSTER` other than `devnet` throws.
- **Stripe live mode** — non-`sk_test_`/`pk_test_` keys throw.
- Receipts are proofs (sha256 of rental facts in a devnet memo), not payments.
