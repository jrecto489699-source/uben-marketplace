"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface CategoryCtx {
  active: string;
  setActive: (category: string) => void;
}

const CategoryContext = createContext<CategoryCtx>({
  active: "Printables",
  setActive: () => {},
});

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("Printables");
  return (
    <CategoryContext.Provider value={{ active, setActive }}>
      {children}
    </CategoryContext.Provider>
  );
}

export const useCategory = () => useContext(CategoryContext);
