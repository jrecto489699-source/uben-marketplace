"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import UbenLogo from "@/components/UbenLogo";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";

export default function SignUpPage() {
  const supabase = createClient();
  const [step, setStep] = useState<"register" | "verify">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("verify");
  }

  async function handleGoogleSignUp() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function handleFacebookSignUp() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <a href="/" className="inline-block mb-8">
            <UbenLogo variant="dark" size={40} />
          </a>
          <div className="bg-white rounded-2xl border border-border-muted p-8">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-green-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-ink mb-2">Check your email</h1>
            <p className="text-sm text-ink-muted mb-1">We sent a confirmation link to</p>
            <p className="text-sm font-semibold text-ink mb-6">{email}</p>
            <p className="text-xs text-ink-muted">Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.</p>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            Already confirmed?{" "}
            <a href="/signin" className="text-ink font-semibold hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a href="/" className="flex justify-center mb-8">
          <UbenLogo variant="dark" size={40} />
        </a>

        <div className="bg-white rounded-2xl border border-border-muted p-8">
          <h1 className="font-serif text-2xl font-semibold text-ink mb-1 text-center">Create your account</h1>
          <p className="text-sm text-ink-muted text-center mb-6">Join Uben and start downloading today</p>

          {/* Social buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={handleGoogleSignUp}
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
              onClick={handleFacebookSignUp}
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
            <span className="text-xs text-ink-muted">or register with email</span>
            <div className="flex-1 h-px bg-border-muted" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
            {/* Full name */}
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Full name"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            {/* Email */}
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

            {/* Password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Password (min. 6 characters)"
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

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-ink-muted text-center mt-4">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline hover:text-ink">Terms</a> and{" "}
            <a href="#" className="underline hover:text-ink">Privacy Policy</a>.
          </p>
        </div>

        <p className="mt-6 text-sm text-ink-muted text-center">
          Already have an account?{" "}
          <a href="/signin" className="text-ink font-semibold hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
