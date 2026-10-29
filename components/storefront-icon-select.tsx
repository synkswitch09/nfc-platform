"use client";
import { useId } from "react";
import { ContentIconSelect } from "@/components/content-icon-select";
import { lucideIconKey, lucideIconSource } from "@/lib/content-icons";
export function StorefrontIconSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const key = lucideIconKey(value);
  return <div className="field"><label htmlFor={id}>{label} — Lucide icon</label>
    <ContentIconSelect id={id} value={key || value} allowEmpty emptyLabel="Use default" currentLabel={!key && value ? "Current uploaded icon" : undefined} onValueChange={name => onChange(name ? lucideIconSource(name) : "")} />
  </div>;
}
