import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "./supabase";
import { NewItemInput, Receipt, Rental, RentalItem } from "./types";

// Server-side data layer backed by Supabase (schema `gimi`).

type ItemRow = {
  id: string;
  name: string;
  brand: string;
  model: string;
  condition: number;
  description: string;
  image_url: string;
  daily_rate: number | string;
  retail_price: number | string;
  overage_multiplier: number | string;
  status: RentalItem["status"];
  owner: string;
  owner_id: string | null;
  renter: string | null;
  renter_id: string | null;
  rental_start: string | null;
  rental_days: number | null;
  category: string;
  trust_score: number;
  created_at: string;
};

type RentalRow = {
  id: string;
  item_id: string;
  renter: string;
  user_id: string | null;
  rental_days: number;
  daily_rate: number | string;
  amount_usd: number | string;
  status: Rental["status"];
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_status: string | null;
  overage_payment_intent_id: string | null;
  overage_amount_usd: number | string | null;
  rental_start: string;
  returned_at: string | null;
  created_at: string;
};

type ReceiptRow = {
  id: string;
  rental_id: string;
  memo_hash: string;
  tx_signature: string;
  explorer_url: string;
  cluster: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const ms = (t: string | null): number | null => (t ? new Date(t).getTime() : null);

function itemFromRow(r: ItemRow): RentalItem {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    condition: r.condition,
    description: r.description,
    imageUrl: r.image_url,
    dailyRate: Number(r.daily_rate),
    retailPrice: Number(r.retail_price),
    overageMultiplier: Number(r.overage_multiplier),
    status: r.status,
    owner: r.owner,
    ownerId: r.owner_id ?? null,
    renter: r.renter ?? undefined,
    renterId: r.renter_id ?? null,
    rentalStart: ms(r.rental_start) ?? undefined,
    rentalDays: r.rental_days ?? undefined,
    category: r.category,
    trustScore: r.trust_score,
    createdAt: ms(r.created_at) ?? 0,
  };
}

function rentalFromRow(r: RentalRow): Rental {
  return {
    id: r.id,
    itemId: r.item_id,
    renter: r.renter,
    userId: r.user_id ?? null,
    rentalDays: r.rental_days,
    dailyRate: Number(r.daily_rate),
    amountUsd: Number(r.amount_usd),
    status: r.status,
    stripeCustomerId: r.stripe_customer_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    stripePaymentStatus: r.stripe_payment_status,
    overagePaymentIntentId: r.overage_payment_intent_id,
    overageAmountUsd: r.overage_amount_usd == null ? null : Number(r.overage_amount_usd),
    rentalStart: ms(r.rental_start) ?? 0,
    returnedAt: ms(r.returned_at),
    createdAt: ms(r.created_at) ?? 0,
  };
}

function receiptFromRow(r: ReceiptRow): Receipt {
  return {
    id: r.id,
    rentalId: r.rental_id,
    memoHash: r.memo_hash,
    txSignature: r.tx_signature,
    explorerUrl: r.explorer_url,
    cluster: r.cluster,
    payload: r.payload,
    createdAt: ms(r.created_at) ?? 0,
  };
}

export function createStore(db: SupabaseClient) {
  return {
    async getItems(): Promise<RentalItem[]> {
      const { data, error } = await db
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`getItems failed: ${error.message}`);
      return (data as ItemRow[]).map(itemFromRow);
    },

    async getItem(id: string): Promise<RentalItem | undefined> {
      const { data, error } = await db.from("items").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getItem failed: ${error.message}`);
      return data ? itemFromRow(data as ItemRow) : undefined;
    },

    async addItem(input: NewItemInput): Promise<RentalItem> {
      const row = {
        name: input.name,
        brand: input.brand,
        model: input.model ?? "",
        condition: input.condition ?? 7,
        description: input.description ?? "",
        category: input.category,
        daily_rate: input.dailyRate ?? 15,
        retail_price: input.retailPrice ?? 500,
        overage_multiplier: 1.5,
        status: "available",
        image_url:
          input.imageUrl ??
          "https://images.unsplash.com/photo-1560472355-536de3962603?w=400&h=300&fit=crop",
        owner: input.owner ?? "",
        owner_id: input.ownerId ?? null,
        trust_score: 50,
      };
      const { data, error } = await db.from("items").insert(row).select("*").single();
      if (error) throw new Error(`addItem failed: ${error.message}`);
      return itemFromRow(data as ItemRow);
    },

    async rentItem(id: string, renter: string, days: number, renterId?: string | null): Promise<RentalItem> {
      // Only flips an *available* item; returns undefined data if already rented.
      const { data, error } = await db
        .from("items")
        .update({
          status: "rented",
          renter,
          renter_id: renterId ?? null,
          rental_start: new Date().toISOString(),
          rental_days: days,
        })
        .eq("id", id)
        .eq("status", "available")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`rentItem failed: ${error.message}`);
      if (!data) throw new Error("Item is not available");
      return itemFromRow(data as ItemRow);
    },

    async returnItem(id: string): Promise<RentalItem> {
      const { data, error } = await db
        .from("items")
        .update({ status: "available", renter: null, renter_id: null, rental_start: null, rental_days: null })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`returnItem failed: ${error.message}`);
      return itemFromRow(data as ItemRow);
    },

    async createRental(input: {
      itemId: string;
      renter: string;
      userId?: string | null;
      rentalDays: number;
      dailyRate: number;
      amountUsd: number;
      stripeCustomerId?: string | null;
      stripePaymentIntentId?: string | null;
      stripePaymentStatus?: string | null;
    }): Promise<Rental> {
      const row = {
        item_id: input.itemId,
        renter: input.renter,
        user_id: input.userId ?? null,
        rental_days: input.rentalDays,
        daily_rate: input.dailyRate,
        amount_usd: input.amountUsd,
        status: "active",
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
        stripe_payment_status: input.stripePaymentStatus ?? null,
      };
      const { data, error } = await db.from("rentals").insert(row).select("*").single();
      if (error) throw new Error(`createRental failed: ${error.message}`);
      return rentalFromRow(data as RentalRow);
    },

    async listRentals(): Promise<Rental[]> {
      // With an RLS-scoped client this returns only the caller's rentals.
      const { data, error } = await db
        .from("rentals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listRentals failed: ${error.message}`);
      return (data as RentalRow[]).map(rentalFromRow);
    },

    async listReceipts(): Promise<Receipt[]> {
      const { data, error } = await db
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listReceipts failed: ${error.message}`);
      return (data as ReceiptRow[]).map(receiptFromRow);
    },

    async getRental(id: string): Promise<Rental | undefined> {
      const { data, error } = await db.from("rentals").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getRental failed: ${error.message}`);
      return data ? rentalFromRow(data as RentalRow) : undefined;
    },

    async updateRental(
      id: string,
      patch: {
        status?: Rental["status"];
        returnedAt?: number;
        overagePaymentIntentId?: string | null;
        overageAmountUsd?: number | null;
      }
    ): Promise<Rental> {
      const row: Record<string, unknown> = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.returnedAt !== undefined) row.returned_at = new Date(patch.returnedAt).toISOString();
      if (patch.overagePaymentIntentId !== undefined)
        row.overage_payment_intent_id = patch.overagePaymentIntentId;
      if (patch.overageAmountUsd !== undefined) row.overage_amount_usd = patch.overageAmountUsd;
      const { data, error } = await db.from("rentals").update(row).eq("id", id).select("*").single();
      if (error) throw new Error(`updateRental failed: ${error.message}`);
      return rentalFromRow(data as RentalRow);
    },

    async addReceipt(input: {
      rentalId: string;
      memoHash: string;
      txSignature: string;
      explorerUrl: string;
      cluster?: string;
      payload: Record<string, unknown>;
    }): Promise<Receipt> {
      const row = {
        rental_id: input.rentalId,
        memo_hash: input.memoHash,
        tx_signature: input.txSignature,
        explorer_url: input.explorerUrl,
        cluster: input.cluster ?? "devnet",
        payload: input.payload,
      };
      const { data, error } = await db.from("receipts").insert(row).select("*").single();
      if (error) throw new Error(`addReceipt failed: ${error.message}`);
      return receiptFromRow(data as ReceiptRow);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

let defaultStore: Store | null = null;

export function getStore(): Store {
  if (!defaultStore) defaultStore = createStore(getServiceClient());
  return defaultStore;
}
