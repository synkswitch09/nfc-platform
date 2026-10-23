import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/site-header";
import { CartProvider } from "@/components/cart-provider";
import { FavouritesProvider } from "@/components/favourites-provider";
import { parseHeaderConfig } from "@/lib/site-chrome";
import { getSystemCopy } from "@/lib/i18n";
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));
function header(authenticated: boolean, enabled = true, showCart = true, logoUrl = "") {
  return renderToStaticMarkup(<CartProvider storageKey="test"><FavouritesProvider enabled={enabled} authenticated={authenticated} accountKey="test"><SiteHeader config={parseHeaderConfig({ logoUrl, showCart, accountHref: "/dashboard", signInHref: "/login", accountLabel: "My account", signInLabel: "Sign in" })} storeName="Kosykin" storeLogoUrl={null} kosykinLayout categories={[]} pages={[]} commerce nfcEnabled={false} authenticated={authenticated} copy={getSystemCopy("en-AU")} locale="en-AU" locales={[]} defaultLocale="en-AU" /></FavouritesProvider></CartProvider>);
}
it("retains the existing account destination while adding the favourites entry", () => {
  const signedIn = header(true);
  expect(signedIn).toContain('href="/dashboard"');
  expect(signedIn).toContain('href="/favourites"');
  expect(signedIn).not.toContain('href="/login"');
  const guest = header(false);
  expect(guest).toContain('href="/login"');
  expect(guest).toContain('href="/favourites"');
  expect(guest).not.toContain('href="/dashboard"');
});
it("honours existing disabled account features and cart visibility", () => {
  const html = header(false, false, false);
  expect(html).not.toContain('href="/favourites"');
  expect(html).not.toContain('href="/cart"');
  expect(html).toContain('href="/shop"');
});

it("keeps tenant-scoped CMS logos on their original media URL", () => {
  const logo = "/api/media/staging-kosykin-11111111-1111-4111-8111-111111111111.png";
  const html = header(false, true, true, logo);
  expect(html).toContain(`src="${logo}"`);
  expect(html).not.toContain("/_next/image?");
});
