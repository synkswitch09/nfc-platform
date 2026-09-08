import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() { return <section className="auth-shell"><div className="auth-card"><h1>Create account</h1><p className="muted">Your products and private details stay under your control.</p><Suspense><AuthForm mode="register" /></Suspense></div></section>; }
