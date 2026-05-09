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
