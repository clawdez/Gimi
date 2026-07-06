import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the magic-link email. Supports both
// PKCE (?code=) and token-hash (?token_hash=&type=) verification.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "email";

  // Open-redirect guard: only same-site paths.
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createServerSupabase();
  let message = "Invalid or expired sign-in link";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
    message = error.message;
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, req.url));
    message = error.message;
  }

  const errUrl = new URL("/", req.url);
  errUrl.searchParams.set("auth_error", message);
  return NextResponse.redirect(errUrl);
}
