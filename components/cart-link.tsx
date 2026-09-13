"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartLink({ label = "Cart", itemsLabel = "items", href = "/cart" }: { label?: string; itemsLabel?: string; href?: string }) {
  const { count } = useCart();
  return <Link href={href} className="cart-link" aria-label={`${label}: ${count} ${itemsLabel}`}><ShoppingCart size={18} aria-hidden="true" /> {label}{count > 0 && <span>{count}</span>}</Link>;
}
