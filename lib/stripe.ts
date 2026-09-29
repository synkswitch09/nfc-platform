import Stripe from "stripe";
import { getRuntimeConfig } from "@/lib/config";

export function getStripe() {
  const key = getRuntimeConfig().stripe.secretKey;
  if (!key) return null;
  return new Stripe(key);
}
