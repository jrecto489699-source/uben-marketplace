"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { X, Lock, Check, Download, Loader2, CreditCard } from "lucide-react";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/data/products";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const CARD_STYLE = {
  base: {
    fontSize: "14px",
    color: "#222222",
    fontFamily: "Inter, system-ui, sans-serif",
    "::placeholder": { color: "#999999" },
  },
  invalid: { color: "#e53e3e" },
};

// ── Payment form (inside <Elements>) ─────────────────────────────────────────
function PaymentForm({
  product,
  onSuccess,
  onClose,
}: {
  product: Product;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { savePurchases } = usePurchases();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const price = parseFloat(product.salePrice.replace(/[^0-9.]/g, ""));

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    try {
      // Create payment intent
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: price }),
      });
      const { clientSecret, error: apiError } = await res.json();
      if (apiError) { setError(apiError); setLoading(false); return; }

      // Confirm card payment
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) return;

      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: { email: user?.email ?? "" },
        },
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed. Please try again.");
        setLoading(false);
        return;
      }

      // Save purchase to Supabase and get the purchase ID
      setDownloading(true);
      const saved = await savePurchases([product]);
      const purchase = saved[0];

      if (purchase?.id) {
        // Trigger automatic download — window.location.href is reliable
        // after async operations (no popup blocker issues)
        const dlRes = await fetch(`/api/download/${purchase.id}`);
        const dlData = await dlRes.json();
        if (dlRes.ok && dlData.url) {
          window.open(dlData.url, "_blank", "noopener,noreferrer");
        }
      }

      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setDownloading(false);
    }
  }

  const busy = loading || downloading;

  return (
    <div className="space-y-4">
      {/* Order summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.title}
          className="w-12 h-12 rounded-lg object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink truncate">{product.title}</p>
          <p className="text-[11px] text-ink-muted">Digital download · PDF</p>
        </div>
        <span className="text-sm font-bold text-sale-green shrink-0">{product.salePrice}</span>
      </div>

      <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">Card details</p>

      {/* Card number */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">Card number</label>
        <div className="p-3.5 rounded-xl border border-border-muted bg-white focus-within:border-ink transition-colors">
          <CardNumberElement options={{ style: CARD_STYLE }} />
        </div>
      </div>

      {/* Expiry + CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1.5">Expiry date</label>
          <div className="p-3.5 rounded-xl border border-border-muted bg-white focus-within:border-ink transition-colors">
            <CardExpiryElement options={{ style: CARD_STYLE }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1.5">Security code</label>
          <div className="p-3.5 rounded-xl border border-border-muted bg-white focus-within:border-ink transition-colors">
            <CardCvcElement options={{ style: CARD_STYLE }} />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <Lock size={11} strokeWidth={2} />
        Payments secured by Stripe
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          disabled={busy}
          className="h-12 px-5 rounded-full border border-border-muted text-sm font-medium text-ink hover:border-ink hover:bg-card-hover disabled:opacity-40 transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          onClick={handlePay}
          disabled={busy || !stripe}
          className="flex-1 h-12 rounded-full bg-ink text-cream text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200"
        >
          {busy ? (
            <>
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              {downloading ? "Preparing download…" : "Processing…"}
            </>
          ) : (
            <>
              <Lock size={13} strokeWidth={2} />
              {"Pay " + product.salePrice + " · Download"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
export default function InstantCheckoutModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!done ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-md bg-cream rounded-3xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border-muted">
          <h2 className="font-serif text-xl font-semibold text-ink">
            {done ? "Download Ready!" : "Instant Download"}
          </h2>
          {!done && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-card-hover transition-colors duration-200">
              <X size={16} strokeWidth={2} className="text-ink-muted" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {done ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-sale-green/10 flex items-center justify-center mb-4">
                <Check size={28} strokeWidth={2.5} className="text-sale-green" />
              </div>
              <p className="font-serif text-2xl font-semibold text-ink mb-2">Thank you!</p>
              <p className="text-sm text-ink-muted mb-1">Payment successful. Your download started automatically.</p>
              <p className="text-sm text-ink-muted mb-6">
                Find it anytime in{" "}
                <a href="/downloads" className="font-medium text-ink underline underline-offset-2">My Downloads</a>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full border border-border-muted text-sm font-medium text-ink hover:bg-card-hover transition-colors duration-200"
                >
                  Close
                </button>
                <a
                  href="/downloads"
                  className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors duration-200"
                >
                  <Download size={13} strokeWidth={2} />
                  My Downloads
                </a>
              </div>
            </div>
          ) : (
            /* ── Payment form ── */
            <Elements stripe={stripePromise}>
              <PaymentForm
                product={product}
                onSuccess={() => setDone(true)}
                onClose={onClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
