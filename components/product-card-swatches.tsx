import Link from "next/link";
type ColourOption = { type: string; values: { id: string; value: string; label: string; swatchHex: string | null }[] };
export function ProductCardSwatches({ product }: { product: { slug: string; name: string; options?: ColourOption[] } }) {
  const colours = product.options?.find(option => option.type === "COLOUR")?.values ?? [];
  const extra = colours.length - 3;
  return <div className="kosy-product-swatches" aria-label="Available colours">{colours.slice(0, 3).map(colour => <Link href={`/products/${product.slug}?colour=${encodeURIComponent(colour.value)}`} key={colour.id} title={colour.label} aria-label={`View ${product.name} in ${colour.label}`} style={{ backgroundColor: colour.swatchHex || undefined }} />)}{extra > 0 && <span aria-label={`${extra} more ${extra === 1 ? "colour" : "colours"}`}>+{extra}</span>}</div>;
}
