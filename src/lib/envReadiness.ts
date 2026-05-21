export type EnvReadinessLevel = "required" | "recommended" | "optional";

export interface EnvReadinessCheck {
  key: string;
  level: EnvReadinessLevel;
  configured: boolean;
  purpose: string;
}

export function getEnvReadiness() {
  const checks: EnvReadinessCheck[] = [
    {
      key: "NEXT_PUBLIC_PRIVY_APP_ID",
      level: "required",
      configured: hasEnv("NEXT_PUBLIC_PRIVY_APP_ID"),
      purpose: "Wallet login and Privy transaction modal.",
    },
    {
      key: "SUPABASE_URL",
      level: "required",
      configured: hasEnv("SUPABASE_URL") || hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
      purpose: "Durable listings, rental sessions, intents, receipts, and notifications.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      level: "required",
      configured: hasEnv("SUPABASE_SERVICE_ROLE_KEY") || hasEnv("SUPABASE_SERVICE_KEY"),
      purpose: "Server-side Supabase writes. Must not be public.",
    },
    {
      key: "MOONPAY_COMMERCE_CHECKOUT_URL or MOONPAY_COMMERCE_API_URL + MOONPAY_COMMERCE_API_KEY",
      level: "recommended",
      configured:
        hasEnv("MOONPAY_COMMERCE_CHECKOUT_URL") ||
        (hasEnv("MOONPAY_COMMERCE_API_URL") && hasEnv("MOONPAY_COMMERCE_API_KEY")),
      purpose: "Card-funded rental checkout.",
    },
    {
      key: "MOONPAY_COMMERCE_WEBHOOK_SECRET",
      level: "recommended",
      configured: hasEnv("MOONPAY_COMMERCE_WEBHOOK_SECRET"),
      purpose: "Verify provider payment webhooks.",
    },
    {
      key: "ELEVENLABS_AGENT_ID + ELEVENLABS_API_KEY",
      level: "recommended",
      configured: hasEnv("ELEVENLABS_AGENT_ID") && hasEnv("ELEVENLABS_API_KEY"),
      purpose: "Voice/chat agent conversation token.",
    },
    {
      key: "LIFI_INTEGRATOR",
      level: "optional",
      configured: hasEnv("LIFI_INTEGRATOR"),
      purpose: "LI.FI quote attribution.",
    },
    {
      key: "SOLANA_RPC_URL",
      level: "optional",
      configured: hasEnv("SOLANA_RPC_URL"),
      purpose: "Custom Solana devnet RPC; defaults to public devnet RPC.",
    },
  ];
  const missingRequired = checks.filter((check) => check.level === "required" && !check.configured);
  const missingRecommended = checks.filter((check) => check.level === "recommended" && !check.configured);

  return {
    ok: missingRequired.length === 0,
    productionReady: missingRequired.length === 0 && missingRecommended.length === 0,
    checks,
    missingRequired: missingRequired.map((check) => check.key),
    missingRecommended: missingRecommended.map((check) => check.key),
  };
}

function hasEnv(key: string) {
  return Boolean(process.env[key]?.trim());
}
