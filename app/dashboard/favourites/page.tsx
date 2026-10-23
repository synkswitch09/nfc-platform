import { redirect } from "next/navigation";
// Keep existing account bookmarks while sharing the same live favourites view.
export default function FavouritesPage() { redirect("/favourites"); }
