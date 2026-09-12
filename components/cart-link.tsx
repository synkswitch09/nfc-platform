"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartLink() {
  const { count } = useCart();
  return <Link href="/cart" className="cart-link" aria-label={`Cart with ${count} items`}><ShoppingCart size={18} aria-hidden="true" /> Cart{count > 0 && <span>{count}</span>}</Link>;
}
