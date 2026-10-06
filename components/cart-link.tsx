"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";

export function CartLink({
  label = "Cart",
  itemsLabel = "items",
  href = "/cart",
  iconOnly = false,
}: {
  label?: string;
  itemsLabel?: string;
  href?: string;
  iconOnly?: boolean;
}) {
  const { count } = useCart();
  const pathname = usePathname();
  const path = href.split(/[?#]/, 1)[0];
  const active = pathname === path;
  return (
    <Link
      href={href}
      className={`cart-link${active ? " active" : ""}${iconOnly ? " icon-only" : ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={`${label}: ${count} ${itemsLabel}`}
    >
      <ShoppingCart size={18} aria-hidden="true" /> {iconOnly ? <span className="sr-only">{label}</span> : label}
      {count > 0 && <span>{count}</span>}
    </Link>
  );
}
