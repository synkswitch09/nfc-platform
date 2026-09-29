import { Suspense } from "react";
import { notFound } from "next/navigation";
import { StoreCapability } from "@prisma/client";
import { getCurrentStorefront, hasStoreCapability } from "@/lib/storefront";
import type { Metadata } from "next";
import { ActivateForm } from "@/components/activate-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Activate tag", robots: { index: false, follow: false } };

export default async function ActivatePage() { const store = await getCurrentStorefront(); if (!hasStoreCapability(store, StoreCapability.NFC)) notFound(); await requireUser(); return <section className="auth-shell"><div className="auth-card"><h1>Activate your tag</h1><p className="muted">Enter the public Tag ID and the separate activation code included with your order.</p><Suspense><ActivateForm /></Suspense></div></section>; }
