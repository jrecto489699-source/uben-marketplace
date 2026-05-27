"use client";

import { useState } from "react";
import { ShoppingCart, Trash2, X, CreditCard, Check, Lock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/context/CartContext";

function discountPct(sale: string, original: string) {
  const s = parseFloat(sale.replace(/[^0-9.]/g, ""));
  const o = parseFloat(original.replace(/[^0-9.]/g, ""));
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

function formatCard(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

type PaymentMethod = "card" | "paypal" | "gcash";
type CheckoutStep = "method" | "details" | "success";

function CheckoutModal({ total, onClose }: { total: number; onClose: () => void }) {
  const [step, setStep] = useState<CheckoutStep>("method");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { items, removeFromCart } = useCart();

  function handlePay() {
    if (method === "card") {
      if (!name || cardNumber.replace(/\s/g, "").length < 16 || expiry.length < 5 || cvv.length < 3) return;
    }
    if (!email) return;
    setStep("success");
    // Clear cart after "payment"
    items.forEach((i) => removeFromCart(i.product.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-cream rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border-muted">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink">
              {step === "success" ? "Order Confirmed!" : "Checkout"}
            </h2>
            {step !== "success" && (
              <p className="text-xs text-ink-muted mt-0.5">Total: <span className="font-semibold text-ink">${total.toFixed(2)}</span></p>
            )}
          </div>
          {step !== "success" && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-card-hover transition-colors duration-200">
              <X size={16} strokeWidth={2} className="text-ink-muted" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">

          {/* ── Step: Success ── */}
          {step === "success" && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-sale-green/10 flex items-center justify-center mb-4">
                <Check size={28} strokeWidth={2.5} className="text-sale-green" />
              </div>
              <p className="font-serif text-2xl font-semibold text-ink mb-2">Thank you!</p>
              <p className="text-sm text-ink-muted mb-1">Your payment was successful.</p>
              <p className="text-sm text-ink-muted mb-6">Your downloads have been sent to your email.</p>
              <button
                onClick={onClose}
                className="px-8 py-2.5 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Step: Payment method ── */}
          {step === "method" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase mb-3">Select payment method</p>

              {/* Credit / Debit Card */}
              <button
                onClick={() => setMethod("card")}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                  method === "card" ? "border-ink bg-white shadow-sm" : "border-border-muted bg-white/50 hover:border-ink/40"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${method === "card" ? "bg-ink" : "bg-card-hover"}`}>
                  <CreditCard size={16} strokeWidth={1.75} className={method === "card" ? "text-cream" : "text-ink-muted"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink mb-1.5">Credit / Debit Card</p>
                  <div className="flex items-center gap-1.5">
                    {/* Visa */}
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-[#1A1F71] text-white text-[9px] font-black tracking-wider">VISA</span>
                    {/* Mastercard */}
                    <span className="inline-flex items-center h-5 rounded overflow-hidden border border-border-muted bg-white px-0.5 gap-0.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-[#EB001B] opacity-90" />
                      <span className="w-3.5 h-3.5 rounded-full bg-[#F79E1B] opacity-90 -ml-1.5" />
                    </span>
                    {/* Amex */}
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-[#2E77BC] text-white text-[8px] font-bold tracking-wide">AMEX</span>
                    {/* JCB */}
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-[#003087] text-white text-[8px] font-bold tracking-wide">JCB</span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${method === "card" ? "border-ink bg-ink" : "border-border-muted"}`}>
                  {method === "card" && <div className="w-1.5 h-1.5 rounded-full bg-cream" />}
                </div>
              </button>

              {/* PayPal */}
              <button
                onClick={() => setMethod("paypal")}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                  method === "paypal" ? "border-ink bg-white shadow-sm" : "border-border-muted bg-white/50 hover:border-ink/40"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#003087] flex items-center justify-center shrink-0">
                  <span className="text-white text-[11px] font-black italic tracking-tight">P<span className="text-[#009CDE]">P</span></span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">PayPal</p>
                  <p className="text-xs text-ink-muted">Pay via your PayPal account</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${method === "paypal" ? "border-ink bg-ink" : "border-border-muted"}`}>
                  {method === "paypal" && <div className="w-1.5 h-1.5 rounded-full bg-cream" />}
                </div>
              </button>

              {/* GCash */}
              <button
                onClick={() => setMethod("gcash")}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                  method === "gcash" ? "border-ink bg-white shadow-sm" : "border-border-muted bg-white/50 hover:border-ink/40"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-[#007DFE] flex items-center justify-center shrink-0">
                  <span className="text-white text-[11px] font-black tracking-tight">G</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">GCash</p>
                  <p className="text-xs text-ink-muted">Pay via GCash wallet</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${method === "gcash" ? "border-ink bg-ink" : "border-border-muted"}`}>
                  {method === "gcash" && <div className="w-1.5 h-1.5 rounded-full bg-cream" />}
                </div>
              </button>

              {/* Email field (all methods) */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Email for download link</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full h-11 px-4 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors duration-200"
                />
              </div>

              <button
                onClick={() => method === "card" ? setStep("details") : handlePay()}
                disabled={!email}
                className="w-full h-12 mt-2 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200"
              >
                {method === "card" ? "Continue to Card Details" : `Pay $${total.toFixed(2)}`}
              </button>
            </div>
          )}

          {/* ── Step: Card details ── */}
          {step === "details" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase mb-3">Card details</p>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Cardholder name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name on card"
                  className="w-full h-11 px-4 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors duration-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-muted">Card number</label>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-[#1A1F71] text-white text-[8px] font-black tracking-wider">VISA</span>
                    <span className="inline-flex items-center h-4 rounded overflow-hidden border border-border-muted bg-white px-0.5 gap-0">
                      <span className="w-3 h-3 rounded-full bg-[#EB001B] opacity-90" />
                      <span className="w-3 h-3 rounded-full bg-[#F79E1B] opacity-90 -ml-1" />
                    </span>
                    <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-[#2E77BC] text-white text-[7px] font-bold tracking-wide">AMEX</span>
                    <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-[#003087] text-white text-[7px] font-bold tracking-wide">JCB</span>
                  </div>
                </div>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCard(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full h-11 px-4 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors duration-200 tracking-wider"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Expiry</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    className="w-full h-11 px-4 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors duration-200"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    className="w-full h-11 px-4 rounded-xl border border-border-muted bg-white text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors duration-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep("method")}
                  className="h-12 px-5 rounded-full border border-border-muted text-sm font-medium text-ink hover:border-ink hover:bg-card-hover transition-colors duration-200"
                >
                  Back
                </button>
                <button
                  onClick={handlePay}
                  disabled={!name || cardNumber.replace(/\s/g, "").length < 16 || expiry.length < 5 || cvv.length < 3}
                  className="flex-1 h-12 rounded-full bg-ink text-cream text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#3a3a3a] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200"
                >
                  <Lock size={13} strokeWidth={2} />
                  Pay ${total.toFixed(2)}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { items, removeFromCart, cartCount } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);

  const subtotal = items.reduce((sum, { product }) => {
    return sum + parseFloat(product.salePrice.replace(/[^0-9.]/g, ""));
  }, 0);

  const savings = items.reduce((sum, { product }) => {
    const sale = parseFloat(product.salePrice.replace(/[^0-9.]/g, ""));
    const orig = parseFloat(product.originalPrice.replace(/[^0-9.]/g, ""));
    return sum + (orig - sale);
  }, 0);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            Your Cart
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </p>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <ShoppingCart size={28} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-2xl text-ink mb-2">Your cart is empty</p>
              <p className="text-sm text-ink-muted mb-6">
                Add some products to get started.
              </p>
              <a
                href="/all"
                className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                Browse products
              </a>
            </div>
          )}

          {items.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-8">

              {/* Cart items */}
              <div className="flex-1 space-y-4">
                {items.map(({ product }) => {
                  const pct = discountPct(product.salePrice, product.originalPrice);
                  return (
                    <div
                      key={product.id}
                      className="flex gap-4 p-4 bg-white rounded-2xl border border-border-muted"
                    >
                      <a href={`/product/${product.id}`} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-20 h-20 rounded-xl object-cover bg-card-hover"
                        />
                      </a>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                        <a href={`/product/${product.id}`}>
                          <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 hover:underline underline-offset-2 mb-1">
                            {product.title}
                          </h3>
                        </a>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold text-sale-green">{product.salePrice}</span>
                          <span className="text-xs text-ink-muted line-through">{product.originalPrice}</span>
                          {pct !== null && (
                            <span className="text-[10px] font-bold text-sale-green">{pct}% off</span>
                          )}
                        </div>
                        {product.instantDownload && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-[#134A4F] bg-[#134A4F]/10 px-2 py-0.5 rounded-full">
                            Instant Download
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center">
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order summary */}
              <div className="lg:w-80 shrink-0">
                <div className="bg-white border border-border-muted rounded-2xl p-6 sticky top-24">
                  <h2 className="font-serif text-lg font-semibold text-ink mb-4">Order Summary</h2>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-ink-muted">
                      <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-sale-green font-medium">
                        <span>You save</span>
                        <span>−${savings.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-ink-muted">
                      <span>Delivery</span>
                      <span className="text-sale-green font-medium">Free</span>
                    </div>
                  </div>

                  <div className="border-t border-border-muted pt-4 mb-5">
                    <div className="flex justify-between font-semibold text-ink text-base">
                      <span>Total</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full h-12 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] active:scale-[0.98] transition-all duration-200 mb-3"
                  >
                    Proceed to Checkout
                  </button>
                  <a
                    href="/all"
                    className="block text-center text-xs text-ink-muted hover:text-ink underline underline-offset-2 transition-colors duration-200"
                  >
                    Continue shopping
                  </a>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
      <Footer />

      {showCheckout && (
        <CheckoutModal total={subtotal} onClose={() => setShowCheckout(false)} />
      )}
    </>
  );
}
