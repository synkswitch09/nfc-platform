import { KosykinPromotions } from "@/components/kosykin-promotions";
import type { BannerGroup } from "@/lib/store-experience";
export function SharedBanners({
  groups,
  position,
}: {
  groups: BannerGroup[];
  position: BannerGroup["shopPosition"];
}) {
  return groups
    .filter((group) => group.shop && group.shopPosition === position)
    .map((group) => (
      <section
        className="kosy-shop-promotions shared-banner-group"
        key={group.id}
        aria-label={group.name}
      >
        <KosykinPromotions slides={group.slides} />
      </section>
    ));
}
