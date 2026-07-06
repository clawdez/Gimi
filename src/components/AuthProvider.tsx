"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authAvailable: boolean;
  openSignIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  authAvailable: false,
  openSignIn: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getBrowserSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authAvailable: Boolean(supabase),
        openSignIn: () => setModalOpen(true),
        signOut,
      }}
    >
      {children}
      {modalOpen && <SignInModal onClose={() => setModalOpen(false)} />}
    </AuthContext.Provider>
  );
}

function SignInModal({ onClose }: { onClose: () => void }) {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !emailValid) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="signin-modal"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Sign in to Gimi</h2>
            <p className="text-sm text-gray-500 mt-1">
              No passwords. We&apos;ll email you a magic link.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!supabase ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
            Sign-in is not configured in this environment.
          </div>
        ) : sent ? (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-4 text-sm text-green-400" data-testid="magic-link-sent">
            Check your inbox — we sent a sign-in link to <span className="font-medium">{email.trim()}</span>.
            You can close this window; you&apos;ll be signed in after clicking the link.
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="signin-email"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!emailValid || sending}
              data-testid="signin-submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold transition-all disabled:opacity-50"
            >
              {sending ? "Sending link..." : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
