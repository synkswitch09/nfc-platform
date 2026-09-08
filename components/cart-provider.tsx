"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  personalisation: Record<string, string>;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "tapkind-cart-v1";

function lineKey(variantId: string, personalisation: Record<string, string>) {
  return `${variantId}:${JSON.stringify(Object.entries(personalisation).sort(([a], [b]) => a.localeCompare(b)))}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(stored)) setLines(stored.filter(line => line && typeof line.variantId === "string" && Number.isInteger(line.quantity)));
      } catch { localStorage.removeItem(STORAGE_KEY); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); }, [lines, ready]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    ready,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    add: input => setLines(current => {
      const key = lineKey(input.variantId, input.personalisation);
      const existing = current.find(line => line.key === key);
      return existing
        ? current.map(line => line.key === key ? { ...line, quantity: Math.min(10, line.quantity + input.quantity) } : line)
        : [...current, { ...input, key }];
    }),
    setQuantity: (key, quantity) => setLines(current => current.map(line => line.key === key ? { ...line, quantity: Math.max(1, Math.min(10, quantity)) } : line)),
    remove: key => setLines(current => current.filter(line => line.key !== key)),
    clear: () => setLines([]),
  }), [lines, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
