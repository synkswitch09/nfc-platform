import type { Metadata } from "next";
import { SupportPortal } from "@/components/support-portal";
import { getCurrentStorefront } from "@/lib/storefront";
import { supportIdentity } from "@/lib/support-access";
import { parseAccountConfig } from "@/lib/account-config";
import { parseSupportConfig } from "@/lib/support-config";
export const metadata: Metadata = { title: "Help & requests", robots: { index: false, follow: false } };
export default async function SupportPage() {
  const store = await getCurrentStorefront(), identity = await supportIdentity(store), config = parseAccountConfig(store.accountConfig), support = parseSupportConfig(store.accountConfig);
  return <section className="section compact-section"><h1>Help & requests</h1><SupportPortal verified={Boolean(identity)} account={Boolean(identity?.userId)} guestEnabled={support.guestEnabled} topics={config.requestTopics} helpText={config.helpText} responseDays={support.firstResponseBusinessDays} /></section>;
}
