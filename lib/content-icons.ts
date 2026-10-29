import installedIconNames from "@/lib/lucide-icon-names.json";
/** Older CMS aliases stay valid; new choices come from the complete installed Lucide registry. */
export const legacyContentIconKeys = ["business", "paw", "image-pen", "message", "refresh", "share"] as const;
export const contentIconKeys = [...new Set([...installedIconNames, ...legacyContentIconKeys])].sort() as [string, ...string[]];
const knownKeys = new Set<string>(contentIconKeys);
export type ContentIconKey = typeof contentIconKeys[number];
export function contentIconLabel(key: string) {
  return key.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
export function filterContentIcons(query: string): string[] {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const search = normalise(query);
  return contentIconKeys.filter(key => normalise(key).includes(search));
}
export function isContentIconKey(key: string): boolean { return knownKeys.has(key); }
export function lucideIconSource(key: string): string { return `lucide:${key}`; }
export function lucideIconKey(source: string): ContentIconKey | null {
  if (!source.startsWith("lucide:")) return null;
  const key = source.slice(7);
  return knownKeys.has(key) ? key : null;
}
