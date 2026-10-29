"use client";
import { useId } from "react";
import { ContentLucideIcon } from "@/components/content-lucide-icon";
import { contentIconKeys, contentIconLabel, lucideIconKey, lucideIconSource } from "@/lib/content-icons";
export function StorefrontIconSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const key = lucideIconKey(value);
  return <label className="field" htmlFor={id}>{label} — Lucide icon
    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {key && <ContentLucideIcon name={key} size={28} />}
      <select id={id} value={value} style={{ flex: 1, minWidth: 0 }} onChange={event => onChange(event.target.value)}>
        <option value="">Use default</option>
        {value && !key && <option value={value}>Current uploaded icon</option>}
        {contentIconKeys.map(name => <option key={name} value={lucideIconSource(name)}>{contentIconLabel(name)}</option>)}
      </select>
    </span>
  </label>;
}
