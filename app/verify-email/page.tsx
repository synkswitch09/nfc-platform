import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmailVerificationForm } from "@/components/email-verification-form";
import { getSessionUser } from "@/lib/auth";
import { getCurrentStorefront } from "@/lib/storefront";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string; sent?: string }> }) {
  const { token, next, sent } = await searchParams;
  if (token) redirect(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  const [user, store] = await Promise.all([getSessionUser(), getCurrentStorefront()]);
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/dashboard");
  return <section className="auth-shell"><div className="auth-card"><h1>Verify your email</h1><EmailVerificationForm email={user.email} storeName={store.displayName} next={next} initialSent={sent !== "0"} /></div></section>;
}
