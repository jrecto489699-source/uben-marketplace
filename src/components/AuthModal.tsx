"use client";

import { X, LogIn } from "lucide-react";
import UbenLogo from "@/components/UbenLogo";

interface AuthModalProps {
  onClose: () => void;
  message?: string;
}

export default function AuthModal({ onClose, message = "Sign in to continue" }: AuthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-border-muted shadow-2xl p-8 flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink rounded-full hover:bg-card-hover transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="mb-4">
          <UbenLogo variant="dark" size={36} />
        </div>

        <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center mb-4">
          <LogIn size={22} className="text-ink" strokeWidth={1.75} />
        </div>

        <h2 className="font-serif text-xl font-semibold text-ink mb-2">Sign in required</h2>
        <p className="text-sm text-ink-muted mb-6">{message}</p>

        <div className="flex flex-col gap-3 w-full">
          <a
            href="/signin"
            className="w-full h-11 rounded-full bg-ink text-cream text-sm font-semibold flex items-center justify-center hover:bg-[#3a3a3a] transition-colors duration-200"
          >
            Sign in
          </a>
          <a
            href="/signup"
            className="w-full h-11 rounded-full border border-border-muted text-ink text-sm font-medium flex items-center justify-center hover:bg-card-hover transition-colors duration-200"
          >
            Create an account
          </a>
        </div>
      </div>
    </div>
  );
}
