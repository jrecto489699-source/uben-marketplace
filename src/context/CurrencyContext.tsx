"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type Currency = "USD" | "EUR" | "PHP";

export const CURRENCIES = [
  { code: "USD" as Currency, symbol: "$",  flag: "🇺🇸", label: "USD",  rate: 1     },
  { code: "EUR" as Currency, symbol: "€",  flag: "🇪🇺", label: "EUR",  rate: 0.92  },
  { code: "PHP" as Currency, symbol: "₱",  flag: "🇵🇭", label: "PHP",  rate: 56    },
];

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (usdPriceStr: string) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  formatPrice: (s) => s,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  useEffect(() => {
    const saved = localStorage.getItem("uben_currency") as Currency | null;
    if (saved && CURRENCIES.find((c) => c.code === saved)) {
      setCurrencyState(saved);
    }
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    localStorage.setItem("uben_currency", c);
  }

  function formatPrice(usdPriceStr: string): string {
    const amount = parseFloat(usdPriceStr.replace(/[^0-9.]/g, ""));
    if (isNaN(amount)) return usdPriceStr;
    const info = CURRENCIES.find((c) => c.code === currency)!;
    const converted = amount * info.rate;
    const formatted =
      currency === "PHP"
        ? Math.round(converted).toLocaleString("en-PH")
        : Math.round(converted).toString();
    return `${info.symbol}${formatted}`;
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
