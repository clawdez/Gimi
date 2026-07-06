import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side only. Uses the service-role key against the isolated `gimi` schema.
let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.RECCO_SUPABASE_URL;
  const key = process.env.RECCO_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Supabase not configured: set RECCO_SUPABASE_URL and RECCO_SUPABASE_SERVICE_KEY");
  }
  client = createClient(url, key, {
    db: { schema: "gimi" },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
  return client;
}
