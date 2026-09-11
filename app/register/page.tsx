import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getCurrentStorefront } from "@/lib/storefront";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function RegisterPage() { const store = await getCurrentStorefront(); return <section className="auth-shell"><div className="auth-card"><h1>Create account</h1><p className="muted">Your {store.displayName} products and private details stay under your control.</p><Suspense><AuthForm mode="register" storeName={store.displayName} /></Suspense></div></section>; }
