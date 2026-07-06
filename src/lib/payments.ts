import Stripe from "stripe";

// Redbox payment layer: link a card once (SetupIntent), then charge the saved
// card off_session for rentals and late-return overages. STRIPE TEST MODE ONLY.

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function assertTestKey(key: string): void {
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refusing non-test Stripe key: TEST mode only, never live keys.");
  }
}

export interface LinkedCard {
  customerId: string;
  paymentMethodId: string;
  brand: string;
  last4: string;
}

export function createPayments(stripe: Stripe) {
  async function ensureCustomer(email: string): Promise<Stripe.Customer> {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0];
    return stripe.customers.create({ email });
  }

  async function getLinkedCard(email: string): Promise<LinkedCard | null> {
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data[0];
    if (!customer) return null;
    const pms = await stripe.paymentMethods.list({ customer: customer.id, type: "card" });
    const preferred = customer.invoice_settings?.default_payment_method;
    const pm =
      pms.data.find((p) => p.id === preferred) ?? pms.data[0];
    if (!pm || !pm.card) return null;
    return {
      customerId: customer.id,
      paymentMethodId: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
    };
  }

  return {
    ensureCustomer,
    getLinkedCard,

    async createCardSetupIntent(email: string): Promise<{ clientSecret: string; customerId: string }> {
      const customer = await ensureCustomer(email);
      const intent = await stripe.setupIntents.create({
        customer: customer.id,
        usage: "off_session",
        payment_method_types: ["card"],
      });
      if (!intent.client_secret) throw new Error("SetupIntent missing client_secret");
      return { clientSecret: intent.client_secret, customerId: customer.id };
    },

    async finalizeCardLink(setupIntentId: string): Promise<LinkedCard> {
      const intent = await stripe.setupIntents.retrieve(setupIntentId);
      if (intent.status !== "succeeded") {
        throw new Error(`Card link not complete: SetupIntent status is ${intent.status}`);
      }
      const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      const paymentMethodId =
        typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
      if (!customerId || !paymentMethodId) throw new Error("SetupIntent missing customer or payment method");
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      return {
        customerId,
        paymentMethodId,
        brand: pm.card?.brand ?? "card",
        last4: pm.card?.last4 ?? "????",
      };
    },

    async chargeSavedCard(input: {
      customerId: string;
      paymentMethodId: string;
      amountUsd: number;
      description: string;
      metadata?: Record<string, string>;
    }): Promise<{ paymentIntentId: string; status: string; amountUsd: number }> {
      if (!(input.amountUsd > 0)) throw new Error("Charge amount must be positive");
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(input.amountUsd * 100),
        currency: "usd",
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        off_session: true,
        confirm: true,
        description: input.description,
        metadata: input.metadata,
      });
      return { paymentIntentId: intent.id, status: intent.status, amountUsd: input.amountUsd };
    },
  };
}

export type Payments = ReturnType<typeof createPayments>;

let defaultPayments: Payments | null = null;

// Returns null when Stripe keys are absent — callers must surface a
// clearly-labeled "payment not configured" state instead of crashing.
export function getPayments(): Payments | null {
  if (!isStripeConfigured()) return null;
  if (!defaultPayments) {
    const key = process.env.STRIPE_SECRET_KEY as string;
    assertTestKey(key);
    defaultPayments = createPayments(new Stripe(key));
  }
  return defaultPayments;
}
