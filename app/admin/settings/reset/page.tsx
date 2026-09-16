import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreResetForm } from "@/components/store-reset-form";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreResetPreview } from "@/lib/store-reset";

export default async function StoreResetPage() {
  const context = await requireAdminPageContext();
  if (!canManageStore(context)) notFound();
  const preview = await getStoreResetPreview(context.store.id);
  return <div>
    <Link href="/admin/settings" className="admin-back">← Store settings</Link>
    <div className="admin-heading"><div><p className="admin-kicker">System · {context.store.displayName}</p><h1>Start fresh</h1><p>Reset this store&apos;s test catalog and operational history without affecting other stores.</p></div></div>
    <StoreResetForm storeName={context.store.displayName} currency={context.store.currency} preview={preview} />
  </div>;
}
