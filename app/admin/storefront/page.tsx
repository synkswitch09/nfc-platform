import Link from "next/link";
import { Home, PanelBottom, PanelTop, PawPrint } from "lucide-react";
import { requireAdminPageContext } from "@/lib/admin";

const areas = [
  {
    href: "/admin/storefront/header",
    title: "Header",
    description:
      "Logo, navigation, category menu, actions, ordering and colours.",
    icon: PanelTop,
  },
  {
    href: "/admin/storefront/home",
    title: "Home",
    description:
      "Page identity, SEO, structured sections, media and translations.",
    icon: Home,
  },
  {
    href: "/admin/storefront/footer",
    title: "Footer",
    description:
      "Logo, legal links, custom links, social channels and colours.",
    icon: PanelBottom,
  },
  {
    href: "/admin/storefront/pet-profile",
    title: "Pet profile",
    description: "Mobile scan card labels, colours, size and lost-mode message.",
    icon: PawPrint,
  },
];

export default async function AdminStorefrontPage() {
  await requireAdminPageContext();
  return (
    <div>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Content</p>
          <h1>Storefront</h1>
          <p>
            Edit the global storefront areas without mixing them with system
            settings.
          </p>
        </div>
      </div>
      <section className="admin-card-grid">
        {areas.map(({ href, title, description, icon: Icon }) => (
          <Link className="admin-action-card" href={href} key={href}>
            <Icon size={24} />
            <strong>{title}</strong>
            <span>{description}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
