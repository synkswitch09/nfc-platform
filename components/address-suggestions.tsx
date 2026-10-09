"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { AustralianAddressSuggestion } from "@/lib/geoapify";

export function AddressSuggestions({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: AustralianAddressSuggestion["address"]) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AustralianAddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const cache = useRef(new Map<string, AustralianAddressSuggestion[]>());
  useEffect(() => {
    const text = query.trim();
    setSuggestions([]); setActive(-1); setStatus("");
    if (text.length < 4) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const previous = cache.current.get(text);
      if (previous) { setSuggestions(previous); return; }
      setStatus("Looking for Australian addresses…");
      try {
        const response = await fetch("/api/address-suggestions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: controller.signal, referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("Unavailable");
        const result = await response.json();
        if (controller.signal.aborted) return;
        const next = Array.isArray(result.suggestions) ? result.suggestions as AustralianAddressSuggestion[] : [];
        if (cache.current.size > 20) cache.current.clear();
        cache.current.set(text, next); setSuggestions(next);
        setStatus(next.length ? `${next.length} suggestions. Choose one, then check your address.` : "No suggestions found. Continue entering your address manually.");
      } catch {
        if (!controller.signal.aborted) setStatus("Suggestions are unavailable. You can enter your address manually.");
      }
    }, 450);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query]);
  function select(suggestion: AustralianAddressSuggestion) {
    setQuery(""); setSuggestions([]); setActive(-1);
    onSelect(suggestion.address);
  }
  return <div className="address-suggestions" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setQuery(""); setSuggestions([]); }
  }}>
    <label className="field" htmlFor={id}>Street address</label>
    <input id={id} name="line1" value={value} minLength={3} maxLength={160} required autoComplete="address-line1" role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls={`${id}-options`} aria-describedby={`${id}-help`} aria-activedescendant={active >= 0 && suggestions[active] ? `${id}-option-${active}` : undefined}
      onChange={event => { onChange(event.target.value); setQuery(event.target.value); setSuggestions([]); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setQuery(""); setSuggestions([]); }
        if (!suggestions.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1)); }
        if (event.key === "Enter" && active >= 0) { event.preventDefault(); select(suggestions[active]); }
      }} />
    <ul id={`${id}-options`} role="listbox" aria-label="Australian address suggestions" hidden={!suggestions.length}>
      {suggestions.map((suggestion, index) => <li key={`${suggestion.id}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => select(suggestion)}>{suggestion.label}</li>)}
    </ul>
    <p className="fine-print" id={`${id}-help`}>Type at least four characters to search Australian addresses. Suggestions send the address you type to Geoapify. You can always edit every field. <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
    <span className="fine-print" role="status" aria-live="polite">{status}</span>
  </div>;
}
