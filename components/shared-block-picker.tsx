"use client";
import { useEffect, useState } from "react";
export function SharedBlockPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { fetch("/api/admin/storefront/experience").then(r => r.ok ? r.json() : null).then(data => setGroups(data?.groups ?? [])).catch(() => undefined); }, []);
  return <label className="field">Reuse a shared banner group<select value={value} onChange={e => onChange(e.target.value)}><option value="">Use this section's own content</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><small>Shared content is edited under Storefront → Shared banners, gifts & reviews. Move this section to choose its position.</small></label>;
}
