"use client";

import { Heart } from "lucide-react";
import { useFavourites } from "@/components/favourites-provider";

export function FavouriteButton({ slug, iconOnly = false }: { slug: string; iconOnly?: boolean }) {
  const favourites = useFavourites();
  if (!favourites?.enabled) return null;
  const saved = favourites.slugs.includes(slug);
  const label = saved ? "Remove from favourites" : "Save to favourites";
  return <span className={iconOnly ? "favourite-control icon-only" : "favourite-control"}>
    <button type="button" className={iconOnly ? "favourite-icon-button" : "text-button"} aria-label={label} title={label} aria-pressed={saved} disabled={!favourites.ready || favourites.pending} onClick={() => void favourites.toggle(slug)}>
      <Heart size={19} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{!iconOnly && (saved ? "Saved to favourites" : "Save to favourites")}
    </button>
    {favourites.error && <span role="status" className="favourite-error">{favourites.error}</span>}
  </span>;
}
