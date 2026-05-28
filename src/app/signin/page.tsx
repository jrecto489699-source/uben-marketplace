"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import UbenLogo from "@/components/UbenLogo";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function SignInPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already signed in, go home
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/";
    });
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    window.location.href = "/";
  }

  async function handleGoogleSignIn() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Force Google to always show the account picker so users can
        // choose a different account instead of auto-signing in.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setError(error.message);
  }

  async function handleFacebookSignIn() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // auth_type=reauthenticate forces Facebook to re-prompt
        // instead of silently using the last session.
        queryParams: { auth_type: "reauthenticate" },
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a href="/" className="flex justify-center mb-8">
          <UbenLogo variant="dark" size={40} />
        </a>

        <div className="bg-white rounded-2xl border border-border-muted p-8">
          <h1 className="font-serif text-2xl font-semibold text-ink mb-1 text-center">Welcome back</h1>
          <p className="text-sm text-ink-muted text-center mb-6">Sign in to your Uben account</p>

          {/* Social buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-full border border-border-muted text-sm font-medium text-ink hover:bg-card-hover transition-colors duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={handleFacebookSignIn}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-full border border-border-muted text-sm font-medium text-ink hover:bg-card-hover transition-colors duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border-muted" />
            <span className="text-xs text-ink-muted">or sign in with email</span>
            <div className="flex-1 h-px bg-border-muted" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div className="flex justify-end">
              <a href="#" className="text-xs text-ink-muted hover:text-ink underline">Forgot password?</a>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-sm text-ink-muted text-center">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-ink font-semibold hover:underline">Create one</a>
        </p>
      </div>
    </div>
  );
}
