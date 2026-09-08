import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() { return <section className="auth-shell"><div className="auth-card"><h1>Welcome back</h1><p className="muted">Manage your tags, profiles and orders.</p><Suspense><AuthForm mode="login" /></Suspense></div></section>; }
