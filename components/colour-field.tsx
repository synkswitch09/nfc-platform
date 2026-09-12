"use client";

export function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return <label className="field colour-field">{label}<span><input type="color" value={valid ? value : "#ffffff"} onChange={event => onChange(event.target.value)} /><input value={value} placeholder="#RRGGBB" pattern="#[0-9A-Fa-f]{6}" maxLength={7} onChange={event => onChange(event.target.value)} /></span></label>;
}
