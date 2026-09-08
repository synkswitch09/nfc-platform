import type { Metadata } from "next";
import Link from "next/link";
import { ClaimOrderForm } from "@/components/claim-order-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Link your order", robots: { index: false, follow: false } };

export default async function ClaimOrderPage({ searchParams }: { searchParams: Promise<{ order?: string; claim?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!params.order || !params.claim) return <section className="auth-shell"><div className="auth-card"><h1>Invalid order link</h1><p className="muted">This link is incomplete or has expired.</p></div></section>;
  const returnTo = `/claim-order?order=${encodeURIComponent(params.order)}&claim=${encodeURIComponent(params.claim)}`;
  return <section className="auth-shell"><div className="auth-card"><p className="eyebrow">Order {params.order}</p><h1>Manage your NFC products</h1><p className="muted">Link this guest purchase to a verified account. The order number alone is never enough to claim it.</p>{user ? <ClaimOrderForm orderNumber={params.order} claimToken={params.claim} /> : <div className="actions"><Link className="button" href={`/login?next=${encodeURIComponent(returnTo)}`}>Sign in</Link><Link className="button secondary" href={`/register?order=${encodeURIComponent(params.order)}&claim=${encodeURIComponent(params.claim)}`}>Create account</Link></div>}</div></section>;
}
