// Boot-time environment validation: the server refuses to start with missing
// CRITICAL vars (Supabase, Solana) or non-TEST Stripe keys. See DEPLOY.md.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnv } = await import("@/lib/env");
    assertServerEnv();
  }
}
