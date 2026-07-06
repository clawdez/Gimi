// Environment contract. CRITICAL vars (Supabase, Solana) fail fast at boot;
// Stripe stays optional so the app degrades gracefully until TEST keys land.

export interface EnvProblem {
  name: string;
  reason: string;
}

export interface EnvReport {
  ok: boolean;
  problems: EnvProblem[];
  stripeConfigured: boolean;
}

type Env = Record<string, string | undefined>;

export function supabaseUrl(env: Env = process.env): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_URL ?? env.RECCO_SUPABASE_URL;
}

export function supabaseAnonKey(env: Env = process.env): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function supabaseServiceKey(env: Env = process.env): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY ?? env.RECCO_SUPABASE_SERVICE_KEY;
}

// TEST mode only — a present-but-live key is a hard error, never a fallback.
export function stripeSecretKey(env: Env = process.env): string | null {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Live keys are refused.");
  }
  return key;
}

export function stripePublishableKey(env: Env = process.env): string | null {
  const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!key.startsWith("pk_test_")) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a TEST key (pk_test_...). Live keys are refused."
    );
  }
  return key;
}

export function solanaCluster(env: Env = process.env): "devnet" {
  const cluster = env.SOLANA_CLUSTER ?? "devnet";
  if (cluster !== "devnet") {
    throw new Error(`SOLANA_CLUSTER must be devnet (got "${cluster}"). Mainnet is refused.`);
  }
  return cluster;
}

export function validateServerEnv(env: Env = process.env): EnvReport {
  const problems: EnvProblem[] = [];

  if (!supabaseUrl(env)) {
    problems.push({ name: "NEXT_PUBLIC_SUPABASE_URL", reason: "missing (Supabase project URL)" });
  }
  if (!supabaseAnonKey(env)) {
    problems.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      reason: "missing (required for magic-link auth and RLS-scoped reads)",
    });
  }
  if (!supabaseServiceKey(env)) {
    problems.push({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      reason: "missing (server-only key for the payment/receipt flow)",
    });
  }

  try {
    solanaCluster(env);
  } catch (e) {
    problems.push({ name: "SOLANA_CLUSTER", reason: (e as Error).message });
  }

  let stripeConfigured = false;
  try {
    stripeConfigured = stripeSecretKey(env) !== null;
  } catch (e) {
    problems.push({ name: "STRIPE_SECRET_KEY", reason: (e as Error).message });
  }
  try {
    stripePublishableKey(env);
  } catch (e) {
    problems.push({ name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", reason: (e as Error).message });
  }

  return { ok: problems.length === 0, problems, stripeConfigured };
}

export function assertServerEnv(env: Env = process.env): void {
  const report = validateServerEnv(env);
  if (!report.ok) {
    const lines = report.problems.map((p) => `  - ${p.name}: ${p.reason}`);
    throw new Error(`Environment validation failed:\n${lines.join("\n")}\nSee DEPLOY.md.`);
  }
}
