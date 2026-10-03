import { KEYCHAIN_FONTS, keychainFontOutlines, type KeychainFont } from "@/lib/keychain";

// Render the same outlines used to produce the printable 3D letters.
export function KeychainFontSample({ font }: { font: string }) {
  if (!(font in KEYCHAIN_FONTS)) return <strong>{font}</strong>;
  const glyphs = keychainFontOutlines(font as KeychainFont).glyphs;
  let cursor = 0;
  const paths = [..."Name"].flatMap(letter => {
    const glyph = glyphs[letter];
    if (!glyph) return [];
    const offset = cursor;
    cursor += glyph.advance;
    return glyph.paths.map(points => `M${points.map(([x, y]) => `${x + offset},${y}`).join("L")}Z`);
  });
  return <svg className="keychain-font-sample" viewBox={`0 0 ${cursor} 1850`} aria-hidden="true" preserveAspectRatio="xMidYMid meet"><g transform="translate(0 1590) scale(1 -1)" fill="currentColor" fillRule="evenodd"><path d={paths.join(" ")} /></g></svg>;
}

export function KeyringSample({ value, imageUrl }: { value: string; imageUrl: string | null }) {
  if (imageUrl) return <span className="keyring-custom-image" style={{ backgroundImage: `url("${imageUrl.replaceAll('"', "%22")}")` }} aria-hidden="true" />;
  const colour = value.includes("gold") ? (value.includes("rose") ? "#c8816e" : "#c8a14c") : "#a5aab0";
  return <svg className="keyring-sample" viewBox="0 0 64 70" fill="none" stroke={colour} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <circle cx="32" cy="21" r={value === "split-ring" ? "15" : "11"} />
    {value === "split-ring" ? <><circle cx="32" cy="21" r="12" strokeWidth="1" /><path d="M32 36v10" /><circle cx="32" cy="52" r="5" /></> : <><path d="M32 32v12m-6 0h12m-9 0v8c-6 6-3 12 3 12s9-6 3-12v-8" /><path d="M35 52l5 5" strokeWidth="1.5" /></>}
  </svg>;
}
