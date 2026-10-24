"use client";
import Link from "next/link";
import { FolderHeart } from "lucide-react";
import { useFavourites } from "@/components/favourites-provider";
import { StorefrontIcon } from '@/components/storefront-icon';
export function FavouritesLink({ href }: { href: string }) {
  const favourites = useFavourites();
  if (!favourites?.enabled) return null;
  return <Link className="favourites-link" href={href} aria-label={`Favourites${favourites.ready && favourites.slugs.length ? ` (${favourites.slugs.length})` : ""}`} title="Favourites">
    <StorefrontIcon name="favourites" size={21} fallback={<FolderHeart size={21} aria-hidden="true" />} />
    {favourites.ready && favourites.slugs.length > 0 && <span className="favourites-count" aria-hidden="true">{favourites.slugs.length}</span>}
  </Link>;
}
