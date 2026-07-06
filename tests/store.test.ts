import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStore } from "@/lib/store";
import { createFakeSupabase } from "./helpers/fakeSupabase";

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "1",
  name: "Callaway Rogue ST Max Irons",
  brand: "Callaway",
  model: "Rogue ST Max",
  condition: 7,
  description: "irons",
  image_url: "https://example.com/golf.jpg",
  daily_rate: "20",
  retail_price: "1800",
  overage_multiplier: "1.5",
  status: "available",
  owner: "7xKX...m3Qp",
  renter: null,
  rental_start: null,
  rental_days: null,
  category: "Sports",
  trust_score: 92,
  created_at: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

function makeStore(seed: Record<string, Record<string, unknown>[]>) {
  const fake = createFakeSupabase(seed);
  return { store: createStore(fake as unknown as SupabaseClient), fake };
}

describe("store (Supabase data layer)", () => {
  it("getItems maps snake_case rows to RentalItem", async () => {
    const { store } = makeStore({ items: [itemRow()] });
    const items = await store.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "1",
      name: "Callaway Rogue ST Max Irons",
      imageUrl: "https://example.com/golf.jpg",
      dailyRate: 20,
      retailPrice: 1800,
      overageMultiplier: 1.5,
      status: "available",
      trustScore: 92,
    });
    expect(items[0].createdAt).toBe(new Date("2026-07-01T00:00:00.000Z").getTime());
  });

  it("getItem returns undefined for missing id", async () => {
    const { store } = makeStore({ items: [itemRow()] });
    expect(await store.getItem("nope")).toBeUndefined();
  });

  it("addItem persists with defaults and returns the new item", async () => {
    const { store, fake } = makeStore({ items: [] });
    const item = await store.addItem({ name: "Ladder", brand: "Werner", category: "Tools" });
    expect(item.status).toBe("available");
    expect(item.dailyRate).toBe(15);
    expect(item.trustScore).toBe(50);
    expect(fake.tables.items).toHaveLength(1);
    expect(fake.tables.items[0].name).toBe("Ladder");
  });

  it("rentItem flips an available item to rented", async () => {
    const { store, fake } = makeStore({ items: [itemRow()] });
    const item = await store.rentItem("1", "renter@example.com", 3);
    expect(item.status).toBe("rented");
    expect(item.renter).toBe("renter@example.com");
    expect(item.rentalDays).toBe(3);
    expect(fake.tables.items[0].status).toBe("rented");
  });

  it("rentItem refuses an already-rented item", async () => {
    const { store } = makeStore({ items: [itemRow({ status: "rented", renter: "other" })] });
    await expect(store.rentItem("1", "renter@example.com", 3)).rejects.toThrow(/not available/);
  });

  it("returnItem makes the item available again", async () => {
    const { store } = makeStore({
      items: [itemRow({ status: "rented", renter: "r@x.com", rental_days: 2 })],
    });
    const item = await store.returnItem("1");
    expect(item.status).toBe("available");
    expect(item.renter).toBeUndefined();
  });

  it("createRental + getRental + updateRental round-trip", async () => {
    const { store } = makeStore({ rentals: [] });
    const rental = await store.createRental({
      itemId: "1",
      renter: "r@x.com",
      rentalDays: 3,
      dailyRate: 20,
      amountUsd: 60,
      stripeCustomerId: "cus_test",
      stripePaymentIntentId: "pi_test",
      stripePaymentStatus: "succeeded",
    });
    expect(rental.status).toBe("active");
    expect(rental.amountUsd).toBe(60);

    const fetched = await store.getRental(rental.id);
    expect(fetched?.stripePaymentIntentId).toBe("pi_test");

    const updated = await store.updateRental(rental.id, {
      status: "returned_late",
      returnedAt: Date.now(),
      overagePaymentIntentId: "pi_over",
      overageAmountUsd: 30,
    });
    expect(updated.status).toBe("returned_late");
    expect(updated.overageAmountUsd).toBe(30);
  });

  it("addReceipt persists the on-chain proof", async () => {
    const { store, fake } = makeStore({ receipts: [] });
    const receipt = await store.addReceipt({
      rentalId: "r1",
      memoHash: "ab".repeat(32),
      txSignature: "5".repeat(87),
      explorerUrl: "https://explorer.solana.com/tx/x?cluster=devnet",
      payload: { itemId: "1" },
    });
    expect(receipt.cluster).toBe("devnet");
    expect(receipt.txSignature).not.toMatch(/^mock_/);
    expect(fake.tables.receipts).toHaveLength(1);
  });
});
