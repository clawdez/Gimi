import { describe, expect, it, vi } from "vitest";
import type { Payments } from "@/lib/payments";
import type { ReceiptMinter } from "@/lib/receipts";
import type { Store } from "@/lib/store";
import { executeRent, executeReturn, MS_PER_DAY, RentFlowError } from "@/lib/rentflow";
import type { Rental, RentalItem } from "@/lib/types";

const NOW = 1751760000000;

const item: RentalItem = {
  id: "1",
  name: "Callaway Rogue ST Max Irons",
  brand: "Callaway",
  model: "Rogue ST Max",
  condition: 7,
  description: "",
  imageUrl: "",
  dailyRate: 20,
  retailPrice: 1800,
  overageMultiplier: 1.5,
  status: "available",
  owner: "o",
  category: "Sports",
  trustScore: 92,
  createdAt: NOW - 3 * MS_PER_DAY,
};

const activeRental: Rental = {
  id: "rental-1",
  itemId: "1",
  renter: "r@x.com",
  rentalDays: 3,
  dailyRate: 20,
  amountUsd: 60,
  status: "active",
  rentalStart: NOW - 3 * MS_PER_DAY,
  createdAt: NOW - 3 * MS_PER_DAY,
};

function makeStore(overrides: Partial<Record<keyof Store, unknown>> = {}): Store {
  return {
    getItems: vi.fn(),
    getItem: vi.fn().mockResolvedValue(item),
    addItem: vi.fn(),
    rentItem: vi.fn().mockResolvedValue({ ...item, status: "rented" }),
    returnItem: vi.fn().mockResolvedValue({ ...item, status: "available" }),
    createRental: vi.fn().mockImplementation(async (input) => ({
      ...activeRental,
      ...input,
      id: "rental-1",
    })),
    getRental: vi.fn().mockResolvedValue(activeRental),
    updateRental: vi.fn().mockImplementation(async (_id, patch) => ({ ...activeRental, ...patch })),
    addReceipt: vi.fn().mockImplementation(async (input) => ({
      id: "receipt-1",
      rentalId: input.rentalId,
      memoHash: input.memoHash,
      txSignature: input.txSignature,
      explorerUrl: input.explorerUrl,
      cluster: "devnet",
      payload: input.payload,
      createdAt: NOW,
    })),
    ...overrides,
  } as Store;
}

function makePayments(overrides: Partial<Record<keyof Payments, unknown>> = {}): Payments {
  return {
    ensureCustomer: vi.fn(),
    getLinkedCard: vi.fn().mockResolvedValue({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      brand: "visa",
      last4: "4242",
    }),
    createCardSetupIntent: vi.fn(),
    finalizeCardLink: vi.fn(),
    chargeSavedCard: vi
      .fn()
      .mockImplementation(async ({ amountUsd }) => ({
        paymentIntentId: "pi_1",
        status: "succeeded",
        amountUsd,
      })),
    ...overrides,
  } as Payments;
}

function makeMinter(overrides: Partial<Record<keyof ReceiptMinter, unknown>> = {}): ReceiptMinter {
  return {
    signerAddress: "FakeSigner1111111111111111111111111111111111",
    ensureFunds: vi.fn().mockResolvedValue(undefined),
    mint: vi.fn().mockImplementation(async () => ({
      memoHash: "a".repeat(64),
      txSignature: "DEVNETSIG",
      explorerUrl: "https://explorer.solana.com/tx/DEVNETSIG?cluster=devnet",
      cluster: "devnet" as const,
    })),
    ...overrides,
  } as ReceiptMinter;
}

describe("executeRent (Redbox flow)", () => {
  it("charges dailyRate × days, persists the rental, mints a devnet receipt", async () => {
    const store = makeStore();
    const payments = makePayments();
    const minter = makeMinter();

    const result = await executeRent(
      { store, payments, minter, now: () => NOW },
      { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
    );

    expect(payments.chargeSavedCard).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 60, customerId: "cus_1", paymentMethodId: "pm_1" })
    );
    expect(store.rentItem).toHaveBeenCalledWith("1", "r@x.com", 3);
    expect(store.createRental).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 60, stripePaymentIntentId: "pi_1" })
    );
    expect(minter.mint).toHaveBeenCalledWith({
      itemId: "1",
      renter: "r@x.com",
      amountUsd: 60,
      rentalDays: 3,
      timestamp: NOW,
    });
    expect(result.receipt?.explorerUrl).toContain("cluster=devnet");
    expect(result.charge).toMatchObject({ brand: "visa", last4: "4242", amountUsd: 60 });

    // The proof layer must be real: no mock_ signatures anywhere in the result.
    expect(JSON.stringify(result)).not.toContain("mock_");
  });

  it("fails with payment_not_configured when Stripe keys are absent", async () => {
    await expect(
      executeRent(
        { store: makeStore(), payments: null, minter: makeMinter() },
        { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
      )
    ).rejects.toMatchObject({ code: "payment_not_configured" });
  });

  it("fails with card_not_linked when the renter has no saved card", async () => {
    const payments = makePayments({ getLinkedCard: vi.fn().mockResolvedValue(null) });
    await expect(
      executeRent(
        { store: makeStore(), payments, minter: makeMinter() },
        { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
      )
    ).rejects.toMatchObject({ code: "card_not_linked" });
  });

  it("fails with item_not_available for rented items", async () => {
    const store = makeStore({
      getItem: vi.fn().mockResolvedValue({ ...item, status: "rented" }),
    });
    await expect(
      executeRent(
        { store, payments: makePayments(), minter: makeMinter() },
        { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
      )
    ).rejects.toMatchObject({ code: "item_not_available" });
  });

  it("rolls the item back to available when the charge fails", async () => {
    const store = makeStore();
    const payments = makePayments({
      chargeSavedCard: vi.fn().mockRejectedValue(new Error("card_declined")),
    });
    await expect(
      executeRent(
        { store, payments, minter: makeMinter() },
        { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
      )
    ).rejects.toMatchObject({ code: "charge_failed" });
    expect(store.returnItem).toHaveBeenCalledWith("1");
    expect(store.createRental).not.toHaveBeenCalled();
  });

  it("keeps the paid rental and reports receiptError when devnet minting fails", async () => {
    const store = makeStore();
    const minter = makeMinter({ mint: vi.fn().mockRejectedValue(new Error("devnet down")) });
    const result = await executeRent(
      { store, payments: makePayments(), minter },
      { itemId: "1", renterEmail: "r@x.com", rentalDays: 3 }
    );
    expect(result.rental.id).toBe("rental-1");
    expect(result.receipt).toBeNull();
    expect(result.receiptError).toContain("devnet down");
    expect(store.returnItem).not.toHaveBeenCalled();
  });
});

describe("executeReturn (Redbox overage)", () => {
  it("returns on time with no overage charge", async () => {
    const store = makeStore();
    const payments = makePayments();
    const result = await executeReturn(
      { store, payments, now: () => activeRental.rentalStart + 2 * MS_PER_DAY },
      { rentalId: "rental-1" }
    );
    expect(result.extraDays).toBe(0);
    expect(result.overage).toBeNull();
    expect(payments.chargeSavedCard).not.toHaveBeenCalled();
    expect(result.rental.status).toBe("returned");
    expect(store.returnItem).toHaveBeenCalledWith("1");
  });

  it("charges dailyRate × overageMultiplier × extraDays when late", async () => {
    const store = makeStore();
    const payments = makePayments();
    // rented for 3 days, returned after 5 → 2 extra days → 20 × 1.5 × 2 = 60
    const result = await executeReturn(
      { store, payments, now: () => activeRental.rentalStart + 5 * MS_PER_DAY },
      { rentalId: "rental-1" }
    );
    expect(result.extraDays).toBe(2);
    expect(payments.chargeSavedCard).toHaveBeenCalledWith(
      expect.objectContaining({ amountUsd: 60 })
    );
    expect(result.rental.status).toBe("returned_late");
    expect(store.updateRental).toHaveBeenCalledWith(
      "rental-1",
      expect.objectContaining({ overagePaymentIntentId: "pi_1", overageAmountUsd: 60 })
    );
  });

  it("rejects returning a non-active rental", async () => {
    const store = makeStore({
      getRental: vi.fn().mockResolvedValue({ ...activeRental, status: "returned" }),
    });
    await expect(
      executeReturn({ store, payments: makePayments() }, { rentalId: "rental-1" })
    ).rejects.toMatchObject({ code: "rental_not_active" });
  });

  it("requires payments when a late return needs an overage charge", async () => {
    const store = makeStore();
    await expect(
      executeReturn(
        { store, payments: null, now: () => activeRental.rentalStart + 5 * MS_PER_DAY },
        { rentalId: "rental-1" }
      )
    ).rejects.toMatchObject({ code: "payment_not_configured" });
    expect(store.returnItem).not.toHaveBeenCalled();
  });
});

describe("RentFlowError", () => {
  it("carries a machine-readable code", () => {
    const err = new RentFlowError("card_not_linked", "x");
    expect(err.code).toBe("card_not_linked");
    expect(err).toBeInstanceOf(Error);
  });
});
