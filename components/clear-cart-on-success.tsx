"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";

export function ClearCartOnSuccess({ paid }: { paid: boolean }) {
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
      if (Array.isArray(purchased) && purchased.every(item => typeof item.key === "string" && Number.isInteger(item.quantity))) removePurchased(purchased);
    } finally { sessionStorage.removeItem("commerce-checkout-cart"); }
  }, [paid, ready, removePurchased]);
  return null;
}
