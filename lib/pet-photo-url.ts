// New cache key for pre-privacy responses; deployed CDN caches still need purge.
export function petPhotoUrl(value: string) {
  return value.startsWith("/api/media/") ? `${value.split("?")[0]}?privacy=1` : "";
}
