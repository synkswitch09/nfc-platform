import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import { StoreCapability } from "@prisma/client";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage() { const store = await getCurrentStorefront(); const nfc = hasStoreCapability(store, StoreCapability.NFC); return <section className="auth-shell"><div className="auth-card"><h1>Welcome back</h1><p className="muted">Manage your {nfc ? "connected products, profiles and " : ""}orders with {store.displayName}.</p><Suspense><AuthForm mode="login" storeName={store.displayName} /></Suspense></div></section>; }
