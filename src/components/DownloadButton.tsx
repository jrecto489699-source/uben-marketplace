"use client";

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";

interface Props {
  purchaseId: string;
  productTitle: string;
}

export default function DownloadButton({ purchaseId, productTitle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    // Open the tab synchronously — Safari blocks window.open() after await
    const win = window.open("", "_blank");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/download/${purchaseId}`);
      const data = await res.json();

      if (!res.ok) {
        win?.close();
        setError(data.error || "Download failed. Please try again.");
        return;
      }

      if (win) win.location.href = data.url;
      else window.location.href = data.url; // fallback
    } catch {
      win?.close();
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-1.5">
      <button
        onClick={handleDownload}
        disabled={loading}
        aria-label={`Download ${productTitle}`}
        className="flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-cream text-xs font-semibold hover:bg-[#3a3a3a] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200 whitespace-nowrap"
      >
        {loading ? (
          <Loader2 size={13} strokeWidth={2} className="animate-spin" />
        ) : (
          <Download size={13} strokeWidth={2} />
        )}
        {loading ? "Preparing…" : "Download"}
      </button>

      {error && (
        <div className="flex items-center gap-1 text-[11px] text-red-600 max-w-[160px] text-right leading-tight">
          <AlertCircle size={10} strokeWidth={2} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
