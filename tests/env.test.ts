import { describe, expect, it } from "vitest";
import {
  solanaCluster,
  stripeSecretKey,
  validateServerEnv,
} from "@/lib/env";

const GOOD: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

describe("validateServerEnv", () => {
  it("passes with all critical vars present and no Stripe", () => {
    const report = validateServerEnv(GOOD);
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    // Stripe absent is graceful degrade, not an error.
    expect(report.stripeConfigured).toBe(false);
  });

  it("fails fast listing every missing critical var", () => {
    const report = validateServerEnv({});
    expect(report.ok).toBe(false);
    const vars = report.problems.map((p) => p.name);
    expect(vars).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(vars).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(vars).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("accepts legacy RECCO_* fallbacks for url and service key", () => {
    const report = validateServerEnv({
      RECCO_SUPABASE_URL: "http://127.0.0.1:54321",
      RECCO_SUPABASE_SERVICE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(report.ok).toBe(true);
  });

  it("refuses a live Stripe secret key", () => {
    const report = validateServerEnv({ ...GOOD, STRIPE_SECRET_KEY: "sk_live_123" });
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.name === "STRIPE_SECRET_KEY")).toBe(true);
  });

  it("refuses a live Stripe publishable key", () => {
    const report = validateServerEnv({
      ...GOOD,
      STRIPE_SECRET_KEY: "sk_test_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_123",
    });
    expect(report.ok).toBe(false);
    expect(
      report.problems.some((p) => p.name === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    ).toBe(true);
  });

  it("accepts Stripe TEST keys and reports payments configured", () => {
    const report = validateServerEnv({
      ...GOOD,
      STRIPE_SECRET_KEY: "sk_test_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
    });
    expect(report.ok).toBe(true);
    expect(report.stripeConfigured).toBe(true);
  });

  it("refuses any Solana cluster other than devnet", () => {
    const report = validateServerEnv({ ...GOOD, SOLANA_CLUSTER: "mainnet-beta" });
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.name === "SOLANA_CLUSTER")).toBe(true);
  });
});

describe("stripeSecretKey", () => {
  it("returns null when unset (graceful degrade)", () => {
    expect(stripeSecretKey({})).toBeNull();
  });
  it("returns a test key", () => {
    expect(stripeSecretKey({ STRIPE_SECRET_KEY: "sk_test_abc" })).toBe("sk_test_abc");
  });
  it("throws on a non-test key", () => {
    expect(() => stripeSecretKey({ STRIPE_SECRET_KEY: "sk_live_abc" })).toThrow(/test/i);
  });
});

describe("solanaCluster", () => {
  it("defaults to devnet", () => {
    expect(solanaCluster({})).toBe("devnet");
  });
  it("throws on mainnet", () => {
    expect(() => solanaCluster({ SOLANA_CLUSTER: "mainnet-beta" })).toThrow(/devnet/);
  });
});
