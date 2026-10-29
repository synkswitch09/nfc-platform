"use client";
import { useState } from "react";
import type { SelectHTMLAttributes } from "react";
import { ContentLucideIcon } from "@/components/content-lucide-icon";
import { contentIconKeys, contentIconLabel } from "@/lib/content-icons";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange"> & {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
};
/** A single picker for products, category identity and reusable landing content. */
export function ContentIconSelect({ value, defaultValue = "sparkles", onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState(defaultValue);
  const selected = value ?? draft;
  const known = contentIconKeys.some(key => key === selected);
  return <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <ContentLucideIcon name={selected} size={28} />
    <select {...props} value={selected} style={{ flex: 1, minWidth: 0 }} onChange={event => { setDraft(event.target.value); onValueChange?.(event.target.value); }}>
      {!known && <option value={selected}>{selected || "None"} (current)</option>}
      <optgroup label="Lucide icons">{contentIconKeys.map(key => <option key={key} value={key}>{contentIconLabel(key)}</option>)}</optgroup>
    </select>
  </span>;
}
