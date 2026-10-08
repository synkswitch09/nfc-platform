"use client";

import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";

export type CartLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  personalisationChoice: "BASIC" | "PERSONALISED";
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
  removePurchased: (purchased: { key: string; quantity: number }[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
function lineKey(variantId: string, personalisationChoice: "BASIC" | "PERSONALISED", personalisation: Record<string, string>) {
  return `${variantId}:${personalisationChoice}:${JSON.stringify(Object.entries(personalisation).sort(([a], [b]) => a.localeCompare(b)))}`;
}

export function CartProvider({ children, storageKey,guestStorageKey,legacyStorageKey }: { children: React.ReactNode; storageKey: string;guestStorageKey?:string;legacyStorageKey?:string }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const revision=useRef<string|undefined>(undefined);const syncing=useRef(false);const hydrated=useRef(false);const [syncMessage,setSyncMessage]=useState("");
  useEffect(()=>{if(!ready || hydrated.current)return;hydrated.current=true;syncing.current=true;void fetch("/api/account/cart",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lines:lines.map(({variantId,quantity,personalisationChoice,personalisation})=>({variantId,quantity,personalisationChoice,personalisation}))})}).then(async response=>{if(!response.ok)return;const result=await response.json();revision.current=result.revision;setLines(result.lines);}).catch(()=>{}).finally(()=>{syncing.current=false;});},[ready,lines]);
  useEffect(()=>{if(!ready||!revision.current||syncing.current)return;const timer=setTimeout(()=>{void fetch("/api/account/cart",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({revision:revision.current,lines:lines.map(({variantId,quantity,personalisationChoice,personalisation})=>({variantId,quantity,personalisationChoice,personalisation}))})}).then(async response=>{if(response.ok)revision.current=(await response.json()).revision;else if(response.status===409)setSyncMessage("Your saved cart changed on another device. Reload this page to merge it.");}).catch(()=>setSyncMessage("Your cart is saved on this device. Reconnect to sync it to your account."));},500);return()=>clearTimeout(timer);},[lines,ready]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const own = JSON.parse(localStorage.getItem(storageKey) ?? (legacyStorageKey?localStorage.getItem(legacyStorageKey):null) ?? "[]");const guest=guestStorageKey?JSON.parse(localStorage.getItem(guestStorageKey)??"[]"):[];
        const stored=Array.isArray(own)&&Array.isArray(guest)?[...new Map([...guest,...own].map(line=>[line.key,line])).values()]:[];if(guestStorageKey)localStorage.removeItem(guestStorageKey);if(legacyStorageKey)localStorage.removeItem(legacyStorageKey);
        if (Array.isArray(stored)) setLines(stored.filter(line => line && typeof line.variantId === "string" && Number.isInteger(line.quantity)).map(line => ({ ...line, personalisationChoice: line.personalisationChoice === "PERSONALISED" ? "PERSONALISED" : "BASIC", personalisation: line.personalisation && typeof line.personalisation === "object" ? line.personalisation : {} })));
      } catch { localStorage.removeItem(storageKey); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey,guestStorageKey,legacyStorageKey]);
  useEffect(() => { if (ready) localStorage.setItem(storageKey, JSON.stringify(lines)); }, [lines, ready, storageKey]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    ready,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    add: input => setLines(current => {
      const key = lineKey(input.variantId, input.personalisationChoice, input.personalisation);
      const existing = current.find(line => line.key === key);
      return existing
        ? current.map(line => line.key === key ? { ...line, quantity: Math.min(10, line.quantity + input.quantity) } : line)
        : [...current, { ...input, key }];
    }),
    setQuantity: (key, quantity) => setLines(current => current.map(line => line.key === key ? { ...line, quantity: Math.max(1, Math.min(10, quantity)) } : line)),
    remove: key => setLines(current => current.filter(line => line.key !== key)),
    clear: () => setLines([]),
    removePurchased: purchased => setLines(current => current.flatMap(line => {
      const bought = purchased.find(item => item.key === line.key);
      if (!bought) return [line];
      const remaining = line.quantity - bought.quantity;
      return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
    })),
  }), [lines, ready]);

  return <CartContext.Provider value={value}>{syncMessage&&<p className="notice" role="status">{syncMessage}</p>}{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
