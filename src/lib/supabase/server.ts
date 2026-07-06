import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { AuthedUser } from "@/lib/rentflow";

// Per-request, cookie-session Supabase client using the PUBLIC anon key.
// Queries through this client are RLS-enforced as the signed-in user.
export async function createServerSupabase(): Promise<SupabaseClient> {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  if (!url || !anon) {
    throw new Error(
      "Auth not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    db: { schema: "gimi" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — the proxy session refresh handles it.
        }
      },
    },
  }) as unknown as SupabaseClient;
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: AuthedUser | null;
}

// getUser() validates the JWT against the auth server — never trust client input.
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return { supabase, user: null };
  return { supabase, user: { id: data.user.id, email: data.user.email } };
}
