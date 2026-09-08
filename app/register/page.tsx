import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default function RegisterPage() { return <section className="auth-shell"><div className="auth-card"><h1>Create account</h1><p className="muted">Your products and private details stay under your control.</p><Suspense><AuthForm mode="register" /></Suspense></div></section>; }
