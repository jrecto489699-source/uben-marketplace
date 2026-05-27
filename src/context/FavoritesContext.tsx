"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface FavoritesCtx {
  favoriteIds: number[];
  toggleFavorite: (id: number) => void;
  isFavorited: (id: number) => boolean;
  favoriteCount: number;
}

const FavoritesContext = createContext<FavoritesCtx>({
  favoriteIds: [],
  toggleFavorite: () => {},
  isFavorited: () => false,
  favoriteCount: 0,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("uben_favorites");
      if (saved) setFavoriteIds(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("uben_favorites", JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  function toggleFavorite(id: number) {
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const isFavorited = (id: number) => favoriteIds.includes(id);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, toggleFavorite, isFavorited, favoriteCount: favoriteIds.length }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
