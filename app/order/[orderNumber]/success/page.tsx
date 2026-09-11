import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ClearCartOnSuccess } from "@/components/clear-cart-on-success";
import { getCurrentUser } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getCurrentStorefront } from "@/lib/storefront";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false, follow: false } };
export default async function OrderSuccessPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ orderNumber }, query, user, store] = await Promise.all([params, searchParams, getCurrentUser(), getCurrentStorefront()]);
  const tokenHash = query.token ? sha256(query.token) : undefined;
  const order = await db.order.findFirst({
    where: { storeId: store.id, orderNumber, OR: [user ? { userId: user.id } : { id: "00000000-0000-0000-0000-000000000000" }, tokenHash ? { claimTokenHash: tokenHash, claimExpiresAt: { gt: new Date() } } : { id: "00000000-0000-0000-0000-000000000000" }] },
    include: { items: true },
  });
  if (!order) notFound();
  const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: order.currency });
  const claimUrl = query.token ? `/claim-order?order=${encodeURIComponent(order.orderNumber)}&claim=${encodeURIComponent(query.token)}` : null;
  const registerUrl = query.token ? `/register?order=${encodeURIComponent(order.orderNumber)}&claim=${encodeURIComponent(query.token)}` : "/register";
  const socialNext = claimUrl ? `?next=${encodeURIComponent(claimUrl)}` : "";

  return <section className="section compact-section order-success"><ClearCartOnSuccess /><CheckCircle2 size={54} /><p className="eyebrow">Payment received</p><h1 className="page-title">Thank you, {order.customerName?.split(" ")[0] ?? "your order is confirmed"}.</h1><p className="lead">We’ll prepare your personalised product and send updates to {order.guestEmail ?? user?.email}.</p>
    <div className="card receipt"><div><span>Order</span><strong>{order.orderNumber}</strong></div><div><span>Status</span><strong>{order.status}</strong></div>{order.items.map(item => <div key={item.id}><span>{item.productName} · {item.variantName} × {item.quantity}</span><strong>{money.format(item.unitPriceCents * item.quantity / 100)}</strong></div>)}<div className="receipt-total"><span>Total</span><strong>{money.format(order.totalCents / 100)}</strong></div></div>
    {!order.userId && claimUrl && <div className="post-purchase"><p className="eyebrow">Next step</p><h2>Create an account to manage your {store.displayName} purchase</h2><p>Your purchase is complete. A free account keeps this order and its available product controls in one place.</p><div className="actions"><Link className="button" href={registerUrl}>Create account with email</Link><a className="button secondary" href={`/api/auth/oauth/google/start${socialNext}`}>Continue with Google</a><a className="button secondary" href={`/api/auth/oauth/apple/start${socialNext}`}>Continue with Apple</a><Link className="button secondary" href={claimUrl}>I already have an account</Link></div><p className="fine-print">The order is linked only after the signed-in email matches the verified checkout email and this private claim token.</p></div>}
    {order.userId && <Link className="button" href="/dashboard">View my products</Link>}
  </section>;
}
