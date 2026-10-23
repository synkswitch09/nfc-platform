"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Favourites = { slugs: string[]; ready: boolean; enabled: boolean; pending: boolean; error: string; toggle: (slug: string) => Promise<void> };
const FavouritesContext = createContext<Favourites | null>(null);
export function readFavouriteSlugs(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((slug): slug is string => typeof slug === "string" && slug.length > 0 && slug.length <= 100))].slice(0, 100) : [];
}

export function FavouritesProvider({ children, enabled, authenticated, accountKey }: { children: ReactNode; enabled: boolean; authenticated: boolean; accountKey: string }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const storage = `favourites:${window.location.host}`;
    const readLocal = () => { try { return readFavouriteSlugs(JSON.parse(localStorage.getItem(storage) ?? "[]")); } catch { return []; } };
    async function load() {
      if (!enabled) { if (active) setReady(true); return; }
      const guest = readLocal();
      if (!authenticated) { if (active) { setSlugs(guest); setReady(true); } return; }
      try {
        const response = await fetch("/api/account/favourites", guest.length ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs: guest }) } : undefined);
        if (!response.ok) throw new Error("Could not load your favourites. Reload to try again.");
        const data = await response.json();
        if (active) {
          setSlugs(readFavouriteSlugs(data.slugs));
          if (guest.length) { try { localStorage.removeItem(storage); } catch { /* Account favourites are still available. */ } }
        }
      } catch { if (active) setError("Could not load your favourites. Reload to try again."); }
      finally { if (active) setReady(true); }
    }
    void load();
    const sync = (event: StorageEvent) => { if (!authenticated && event.key === storage) setSlugs(readLocal()); };
    window.addEventListener("storage", sync);
    return () => { active = false; window.removeEventListener("storage", sync); };
  }, [enabled, authenticated, accountKey]);

  async function toggle(slug: string) {
    if (!ready || !enabled || busy.current) return;
    busy.current = true; setPending(true); setError("");
    const saved = !slugs.includes(slug);
    const next = saved ? readFavouriteSlugs([...slugs, slug]) : slugs.filter(item => item !== slug);
    try {
      if (authenticated) {
        const response = await fetch("/api/account/favourites", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, saved }) });
        if (!response.ok) throw new Error();
        setSlugs(readFavouriteSlugs((await response.json()).slugs));
      } else {
        localStorage.setItem(`favourites:${window.location.host}`, JSON.stringify(next));
        setSlugs(next);
      }
    } catch { setError("Could not update your favourites. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <FavouritesContext.Provider value={{ slugs, ready, enabled, pending, error, toggle }}>{children}</FavouritesContext.Provider>;
}
export function useFavourites() { return useContext(FavouritesContext); }
