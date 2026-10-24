import { getCurrentStorefront } from "@/lib/storefront";
import { publicBannerGroups } from "@/lib/store-experience";
import { KosykinPromotions } from "@/components/kosykin-promotions";
export async function SharedBannerReference({ groupId }: { groupId: string }) {
  const store = await getCurrentStorefront();
  const group = (await publicBannerGroups(store.id)).find(group => group.id === groupId);
  return group ? <section className="kosy-home-section shared-banner-group" aria-label={group.name}><KosykinPromotions slides={group.slides} /></section> : null;
}
