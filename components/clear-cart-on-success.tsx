"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-provider";

export function ClearCartOnSuccess() {
  const { clear } = useCart();
  useEffect(() => {
    if (sessionStorage.getItem("tapkin-clear-cart-on-success") === "true") {
      clear();
      sessionStorage.removeItem("tapkin-clear-cart-on-success");
    }
  }, [clear]);
  return null;
}
