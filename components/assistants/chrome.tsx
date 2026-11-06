import Link from "next/link";
import { headers } from "next/headers";
import { ArrowUpRight } from "lucide-react";
import { assistantConfig } from "@/lib/assistants/config";
export async function AssistantChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = assistantConfig(),
    path = (await headers()).get("x-admin-path") || "",
    consolePage = ["/account", "/ai-assistants"].includes(path);
  if (consolePage)
    return (
      <div className="ai-shell ai-console-shell">
        <main className="ai-main">{children}</main>
      </div>
    );
  return (
    <div className="ai-shell">
      <header className="ai-header">
        <Link href="/" className="ai-brand">
          <span className="ai-brand-mark" aria-hidden="true">
            t/
          </span>
          <span>{config.name}</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/plans">Plans</Link>
          <Link href="/help">Help</Link>
          <Link className="ai-button" href="/account">
            Your workspace <ArrowUpRight size={14} />
          </Link>
        </nav>
      </header>
      <main className="ai-main">{children}</main>
      <footer className="ai-footer">
        <div>
          <Link href="/" className="ai-brand">
            <span className="ai-brand-mark" aria-hidden="true">
              t/
            </span>
            {config.name}
          </Link>
          <p>Made for the business you’re building.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/faq">FAQs</Link>
          <Link href="/help">Help centre</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <small>Tapkin · Business tools</small>
      </footer>
    </div>
  );
}
