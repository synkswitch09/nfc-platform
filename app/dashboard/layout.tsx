import type { Metadata } from "next";
import Link from "next/link";
import {getCurrentUser} from "@/lib/auth";
import {getCurrentStorefront} from "@/lib/storefront";
import {parseAccountConfig} from "@/lib/account-config";
import {claimVerifiedGuestOrders} from "@/lib/customer-account";
export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const [user,store]=await Promise.all([getCurrentUser(),getCurrentStorefront()]);if(!user)return children;
 await claimVerifiedGuestOrders(user,store.id);const config=parseAccountConfig(store.accountConfig);
 const links=[["/dashboard","Overview"],["/dashboard/orders","Orders"],["/dashboard/points","Points"],["/dashboard/account","Details & addresses"],["/dashboard/security","Security"],["/dashboard/privacy","Privacy & preferences"],...(config.favouritesEnabled?[["/dashboard/favourites","Favourites"]]:[]),...(config.notificationsEnabled?[["/dashboard/notifications","Notifications"]]:[]),...(config.helpEnabled?[["/dashboard/help","Help & requests"]]:[])];
 return <><nav className="account-nav" aria-label="Account">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>{children}</>;
}
