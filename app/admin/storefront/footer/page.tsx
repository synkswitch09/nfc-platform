import Link from "next/link";
import { StorefrontChromeForm } from "@/components/storefront-chrome-form";
import { canManageStore, requireAdminPageContext } from "@/lib/admin";
import { getStoreSettings } from "@/lib/settings";
import { notFound } from "next/navigation";

export default async function AdminStorefrontFooterPage() {
  const context = await requireAdminPageContext();
  if (!canManageStore(context)) notFound();
  const settings = await getStoreSettings(context.store);
  return (
    <div>
      <Link className="admin-back" href="/admin/storefront">
        ← Storefront
      </Link>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content · Storefront</p>
          <h1>Footer</h1>
          <p>
            Manage legal, custom and social links independently from the header.
          </p>
        </div>
        <Link className="button secondary" href="/" target="_blank">
          Preview
        </Link>
      </div>
      <StorefrontChromeForm
        area="footer"
        footer={settings.footerConfig}
        socialLinks={settings.socialLinks}
      />
    </div>
  );
}
