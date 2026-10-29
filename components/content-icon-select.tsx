"use client";
import { useMemo, useState } from "react";
import type { SelectHTMLAttributes } from "react";
import { ContentLucideIcon } from "@/components/content-lucide-icon";
import { contentIconLabel, filterContentIcons, isContentIconKey } from "@/lib/content-icons";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange"> & {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  allowEmpty?: boolean; emptyLabel?: string; currentLabel?: string;
};
/** Complete searchable registry shared by products, categories, blocks and chrome. */
export function ContentIconSelect({ value, defaultValue = "sparkles", onValueChange, allowEmpty = false, emptyLabel = "None", currentLabel, ...props }: Props) {
  const [draft, setDraft] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const selected = value ?? draft;
  const known = isContentIconKey(selected);
  const matches = useMemo(() => filterContentIcons(query), [query]);
  const retainSelection = selected !== "" && !matches.includes(selected);
  return <div style={{ display: "grid", gap: 8 }}>
    <input type="search" aria-label="Search Lucide icons" placeholder="Search icons, e.g. BrushCleaning or package-open" value={query} disabled={props.disabled} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} onChange={event => setQuery(event.target.value)} />
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {known && <ContentLucideIcon name={selected} size={28} />}
      <select aria-label="Icon" {...props} value={selected} style={{ flex: 1, minWidth: 0 }} onChange={event => { setDraft(event.target.value); onValueChange?.(event.target.value); }}>
        {(allowEmpty || !selected) && <option value="">{emptyLabel}</option>}
        {retainSelection && <option value={selected}>{currentLabel || (known ? contentIconLabel(selected) : selected)} (current)</option>}
        <optgroup label="Lucide icons">{matches.map(key => <option key={key} value={key}>{contentIconLabel(key)}</option>)}</optgroup>
      </select>
    </div>
    {query && <small role="status">{matches.length} matching icons</small>}
  </div>;
}
