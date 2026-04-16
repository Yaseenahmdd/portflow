"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tap, toggle, success as hapticSuccess, destructive as hapticError } from "@/lib/haptics";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        hapticError();
        setError(signInError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        hapticError();
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    }

    hapticSuccess();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <section className="glass-card glow w-full p-6 sm:p-8">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-text-muted">Portflow</div>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-text-primary">
              {mode === "login" ? "Sign in" : "Create account"}
            </h2>
          </div>

          {error && (
            <div className="mt-6 rounded-[1.2rem] border border-accent-loss/20 bg-accent-loss-bg px-4 py-3 text-sm text-accent-loss">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-text-muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-[1.2rem] border border-black/8 bg-white px-4 py-3.5 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
              />
            </div>

            <div>
              <label className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-text-muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full rounded-[1.2rem] border border-black/8 bg-white px-4 py-3.5 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
              />
            </div>

            <button
              type="submit"
              onClick={tap}
              disabled={loading}
              className="w-full rounded-full bg-accent-violet px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (mode === "login" ? "Signing in" : "Creating account") : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 border-t border-white/6 pt-5">
            <button
              type="button"
              onClick={() => {
                toggle();
                setMode((current) => (current === "login" ? "signup" : "login"));
                setError("");
              }}
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
