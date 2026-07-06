import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { assertTestKey, createPayments, getPayments, isStripeConfigured } from "@/lib/payments";

function makeFakeStripe() {
  const customer = {
    id: "cus_1",
    email: "r@x.com",
    invoice_settings: { default_payment_method: "pm_1" },
  };
  const pm = { id: "pm_1", card: { brand: "visa", last4: "4242" } };
  return {
    customers: {
      list: vi.fn().mockResolvedValue({ data: [customer] }),
      create: vi.fn().mockResolvedValue(customer),
      update: vi.fn().mockResolvedValue(customer),
    },
    paymentMethods: {
      list: vi.fn().mockResolvedValue({ data: [pm] }),
      retrieve: vi.fn().mockResolvedValue(pm),
    },
    setupIntents: {
      create: vi.fn().mockResolvedValue({ id: "seti_1", client_secret: "seti_1_secret" }),
      retrieve: vi.fn().mockResolvedValue({
        id: "seti_1",
        status: "succeeded",
        customer: "cus_1",
        payment_method: "pm_1",
      }),
    },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: "pi_1", status: "succeeded" }),
    },
  };
}

describe("payments (Stripe, TEST mode)", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("assertTestKey rejects live keys", () => {
    expect(() => assertTestKey("sk_live_abc")).toThrow(/TEST mode only/);
    expect(() => assertTestKey("sk_test_abc")).not.toThrow();
  });

  it("degrades gracefully when Stripe is not configured", () => {
    expect(isStripeConfigured()).toBe(false);
    expect(getPayments()).toBeNull();
  });

  it("createCardSetupIntent reuses an existing customer and returns a client secret", async () => {
    const fake = makeFakeStripe();
    const payments = createPayments(fake as unknown as Stripe);
    const result = await payments.createCardSetupIntent("r@x.com");
    expect(result).toEqual({ clientSecret: "seti_1_secret", customerId: "cus_1" });
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(fake.setupIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", usage: "off_session" })
    );
  });

  it("createCardSetupIntent creates the customer when none exists", async () => {
    const fake = makeFakeStripe();
    fake.customers.list.mockResolvedValue({ data: [] });
    const payments = createPayments(fake as unknown as Stripe);
    await payments.createCardSetupIntent("new@x.com");
    expect(fake.customers.create).toHaveBeenCalledWith({ email: "new@x.com" });
  });

  it("finalizeCardLink sets the default payment method and returns card details", async () => {
    const fake = makeFakeStripe();
    const payments = createPayments(fake as unknown as Stripe);
    const card = await payments.finalizeCardLink("seti_1");
    expect(card).toEqual({ customerId: "cus_1", paymentMethodId: "pm_1", brand: "visa", last4: "4242" });
    expect(fake.customers.update).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_1" },
    });
  });

  it("finalizeCardLink rejects an incomplete SetupIntent", async () => {
    const fake = makeFakeStripe();
    fake.setupIntents.retrieve.mockResolvedValue({ id: "seti_1", status: "requires_payment_method" });
    const payments = createPayments(fake as unknown as Stripe);
    await expect(payments.finalizeCardLink("seti_1")).rejects.toThrow(/not complete/);
  });

  it("getLinkedCard returns null when no customer or card exists", async () => {
    const fake = makeFakeStripe();
    fake.customers.list.mockResolvedValue({ data: [] });
    const payments = createPayments(fake as unknown as Stripe);
    expect(await payments.getLinkedCard("r@x.com")).toBeNull();
  });

  it("chargeSavedCard charges USD as cents, off_session and confirmed", async () => {
    const fake = makeFakeStripe();
    const payments = createPayments(fake as unknown as Stripe);
    const result = await payments.chargeSavedCard({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      amountUsd: 60,
      description: "Gimi rental",
    });
    expect(result).toEqual({ paymentIntentId: "pi_1", status: "succeeded", amountUsd: 60 });
    expect(fake.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 6000,
        currency: "usd",
        customer: "cus_1",
        payment_method: "pm_1",
        off_session: true,
        confirm: true,
      })
    );
  });

  it("chargeSavedCard rejects non-positive amounts", async () => {
    const payments = createPayments(makeFakeStripe() as unknown as Stripe);
    await expect(
      payments.chargeSavedCard({
        customerId: "cus_1",
        paymentMethodId: "pm_1",
        amountUsd: 0,
        description: "x",
      })
    ).rejects.toThrow(/positive/);
  });
});
