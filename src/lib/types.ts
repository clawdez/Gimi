export interface RentalItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  condition: number; // 1-10
  description: string;
  imageUrl: string;
  dailyRate: number; // USD
  retailPrice: number; // full retail price for backstop
  overageMultiplier: number; // e.g. 1.5
  status: "available" | "rented" | "overdue";
  owner: string; // wallet address
  renter?: string;
  rentalStart?: number; // unix timestamp
  rentalDays?: number;
  category: string;
  trustScore: number;
  createdAt: number;
}

export interface Rental {
  id: string;
  itemId: string;
  renter: string; // renter id (email for MVP)
  rentalDays: number;
  dailyRate: number;
  amountUsd: number;
  status: "active" | "returned" | "returned_late";
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripePaymentStatus?: string | null;
  overagePaymentIntentId?: string | null;
  overageAmountUsd?: number | null;
  rentalStart: number; // unix ms
  returnedAt?: number | null;
  createdAt: number;
}

export interface Receipt {
  id: string;
  rentalId: string;
  memoHash: string;
  txSignature: string;
  explorerUrl: string;
  cluster: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface NewItemInput {
  name: string;
  brand: string;
  model?: string;
  condition?: number;
  description?: string;
  category: string;
  dailyRate?: number;
  retailPrice?: number;
  imageUrl?: string;
  owner?: string;
}

export interface ChatMessage {
  role: "agent" | "user";
  content: string;
  options?: string[];
}

export interface TrustProfile {
  address: string;
  score: number;
  totalRentals: number;
  onTimeReturns: number;
  avgRating: number;
}
