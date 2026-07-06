"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Browser client for auth only (magic-link sign-in, session, sign-out).
// Uses the PUBLIC anon key — the service-role key never reaches the browser.
export function getBrowserSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  client = createBrowserClient(url, anon) as unknown as SupabaseClient;
  return client;
}
