import Link from "next/link";

export default function NotFoundPage() { return <section className="auth-shell"><div className="auth-card"><p className="eyebrow">404</p><h1>Page not found</h1><p className="muted">This address may be incorrect, unavailable or intentionally private.</p><Link className="button" href="/">Return home</Link></div></section>; }
