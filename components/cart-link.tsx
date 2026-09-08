"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartLink() {
  const { count } = useCart();
  return <Link href="/cart" className="cart-link" aria-label={`Cart with ${count} items`}><ShoppingBag size={18} /> Cart{count > 0 && <span>{count}</span>}</Link>;
}
