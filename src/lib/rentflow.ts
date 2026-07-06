import type { Payments } from "./payments";
import type { ReceiptMinter } from "./receipts";
import type { Store } from "./store";
import type { Receipt, Rental } from "./types";

// Redbox flow orchestration, dependency-injected so it is unit-testable
// with mocked Supabase / Stripe / Solana.

export const MS_PER_DAY = 86_400_000;

export class RentFlowError extends Error {
  constructor(
    public code:
      | "payment_not_configured"
      | "card_not_linked"
      | "item_not_found"
      | "item_not_available"
      | "rental_not_found"
      | "rental_not_active"
      | "forbidden"
      | "charge_failed",
    message: string
  ) {
    super(message);
  }
}

export interface RentDeps {
  store: Store;
  payments: Payments | null;
  minter: ReceiptMinter;
  now?: () => number;
}

export interface RentResult {
  rental: Rental;
  charge: { paymentIntentId: string; status: string; amountUsd: number; brand: string; last4: string };
  receipt: Receipt | null;
  receiptError?: string;
}

export interface AuthedUser {
  id: string;
  email: string;
}

export async function executeRent(
  deps: RentDeps,
  input: { itemId: string; renter: AuthedUser; rentalDays: number }
): Promise<RentResult> {
  const { store, payments, minter } = deps;
  const now = deps.now ?? Date.now;

  if (!payments) {
    throw new RentFlowError("payment_not_configured", "Payments are not configured");
  }

  const item = await store.getItem(input.itemId);
  if (!item) throw new RentFlowError("item_not_found", "Item not found");
  if (item.status !== "available") {
    throw new RentFlowError("item_not_available", "Item is not available");
  }

  const card = await payments.getLinkedCard(input.renter.email);
  if (!card) throw new RentFlowError("card_not_linked", "Link a card before renting");

  const amountUsd = item.dailyRate * input.rentalDays;

  // Reserve the item first (atomic status flip), then charge; roll back on failure.
  await store.rentItem(item.id, input.renter.email, input.rentalDays, input.renter.id);

  let charge;
  try {
    charge = await payments.chargeSavedCard({
      customerId: card.customerId,
      paymentMethodId: card.paymentMethodId,
      amountUsd,
      description: `Gimi rental: ${item.name} × ${input.rentalDays} day(s)`,
      metadata: { itemId: item.id, renter: input.renter.email },
    });
  } catch (e) {
    await store.returnItem(item.id);
    throw new RentFlowError("charge_failed", `Card charge failed: ${(e as Error).message}`);
  }

  const rental = await store.createRental({
    itemId: item.id,
    renter: input.renter.email,
    userId: input.renter.id,
    rentalDays: input.rentalDays,
    dailyRate: item.dailyRate,
    amountUsd,
    stripeCustomerId: card.customerId,
    stripePaymentIntentId: charge.paymentIntentId,
    stripePaymentStatus: charge.status,
  });

  // On-chain proof layer (devnet memo). A flaky devnet must not undo a paid rental.
  let receipt: Receipt | null = null;
  let receiptError: string | undefined;
  try {
    await minter.ensureFunds();
    const minted = await minter.mint({
      itemId: item.id,
      renter: input.renter.email,
      amountUsd,
      rentalDays: input.rentalDays,
      timestamp: now(),
    });
    receipt = await store.addReceipt({
      rentalId: rental.id,
      memoHash: minted.memoHash,
      txSignature: minted.txSignature,
      explorerUrl: minted.explorerUrl,
      cluster: minted.cluster,
      payload: {
        itemId: item.id,
        renter: input.renter.email,
        amountUsd,
        rentalDays: input.rentalDays,
      },
    });
  } catch (e) {
    receiptError = (e as Error).message;
  }

  return {
    rental,
    charge: { ...charge, brand: card.brand, last4: card.last4 },
    receipt,
    receiptError,
  };
}

export interface ReturnResult {
  rental: Rental;
  extraDays: number;
  overage: { paymentIntentId: string; status: string; amountUsd: number } | null;
}

export async function executeReturn(
  deps: Pick<RentDeps, "store" | "payments" | "now">,
  input: { rentalId: string; requester: AuthedUser }
): Promise<ReturnResult> {
  const { store, payments } = deps;
  const now = deps.now ?? Date.now;

  const rental = await store.getRental(input.rentalId);
  if (!rental) throw new RentFlowError("rental_not_found", "Rental not found");
  if (rental.status !== "active") {
    throw new RentFlowError("rental_not_active", "Rental is not active");
  }
  // Only the renter may return. Legacy rentals (pre-auth) match on email.
  const isRenter = rental.userId
    ? rental.userId === input.requester.id
    : rental.renter === input.requester.email;
  if (!isRenter) {
    throw new RentFlowError("forbidden", "This rental belongs to another account");
  }

  const item = await store.getItem(rental.itemId);
  if (!item) throw new RentFlowError("item_not_found", "Item not found");

  const daysUsed = Math.ceil((now() - rental.rentalStart) / MS_PER_DAY);
  const extraDays = Math.max(0, daysUsed - rental.rentalDays);

  let overage: ReturnResult["overage"] = null;
  if (extraDays > 0) {
    // Redbox model: late returns are charged at dailyRate × overageMultiplier × extraDays.
    if (!payments) {
      throw new RentFlowError("payment_not_configured", "Payments are not configured");
    }
    const card = await payments.getLinkedCard(rental.renter);
    if (!card) throw new RentFlowError("card_not_linked", "No linked card for overage charge");
    const amountUsd = rental.dailyRate * item.overageMultiplier * extraDays;
    try {
      overage = await payments.chargeSavedCard({
        customerId: card.customerId,
        paymentMethodId: card.paymentMethodId,
        amountUsd,
        description: `Gimi late return: ${item.name} × ${extraDays} extra day(s)`,
        metadata: { rentalId: rental.id, itemId: item.id },
      });
    } catch (e) {
      throw new RentFlowError("charge_failed", `Overage charge failed: ${(e as Error).message}`);
    }
  }

  const updated = await store.updateRental(rental.id, {
    status: extraDays > 0 ? "returned_late" : "returned",
    returnedAt: now(),
    overagePaymentIntentId: overage?.paymentIntentId ?? null,
    overageAmountUsd: overage?.amountUsd ?? null,
  });
  await store.returnItem(rental.itemId);

  return { rental: updated, extraDays, overage };
}
