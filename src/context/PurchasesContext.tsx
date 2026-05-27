"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/data/products";

interface Purchase {
  id: string;
  product_id: number;
  product_title: string;
  product_image: string;
  sale_price: string;
  created_at: string;
}

interface PurchasesContextValue {
  purchases: Purchase[];
  isOwned: (productId: number) => boolean;
  savePurchases: (products: Product[]) => Promise<void>;
  loading: boolean;
}

const PurchasesContext = createContext<PurchasesContextValue>({
  purchases: [],
  isOwned: () => false,
  savePurchases: async () => {},
  loading: true,
});

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) { setPurchases([]); setLoading(false); return; }

    supabase
      .from("purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPurchases(data ?? []);
        setLoading(false);
      });
  }, [user]);

  function isOwned(productId: number) {
    return purchases.some((p) => p.product_id === productId);
  }

  async function savePurchases(products: Product[]) {
    if (!user) return;
    const rows = products.map((p) => ({
      user_id: user.id,
      product_id: p.id,
      product_title: p.title,
      product_image: p.image,
      sale_price: p.salePrice,
    }));
    const { data } = await supabase.from("purchases").insert(rows).select();
    if (data) setPurchases((prev) => [...data, ...prev]);
  }

  return (
    <PurchasesContext.Provider value={{ purchases, isOwned, savePurchases, loading }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  return useContext(PurchasesContext);
}
