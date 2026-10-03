"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";

export function ClearCartOnSuccess({ paid, orderId }: { paid: boolean; orderId: string }) {
  const { removePurchased, ready } = useCart();
  const router = useRouter();
  useEffect(() => {
    if (paid || !sessionStorage.getItem("commerce-checkout-cart")) return;
    const timer = window.setInterval(() => router.refresh(), 3000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [paid, router]);
  useEffect(() => {
    if (!paid || !ready) return;
    const stored = sessionStorage.getItem("commerce-checkout-cart");
    if (!stored) return;
    try {
      const purchased = JSON.parse(stored);
      if (purchased.orderId !== orderId) return;
      if (Array.isArray(purchased.lines) && purchased.lines.every((item: { key: unknown; quantity: unknown }) => typeof item.key === "string" && Number.isInteger(item.quantity))) removePurchased(purchased.lines);
    } catch { sessionStorage.removeItem("commerce-checkout-cart"); return; }
    sessionStorage.removeItem("commerce-checkout-cart");
  }, [paid, ready, removePurchased, orderId]);
  return null;
}
