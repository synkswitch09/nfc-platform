"use client";
import { useId, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { ShopQuery } from '@/lib/kosykin-shop';
import { queryList } from '@/lib/kosykin-shop';
type Colour = { value: string; label: string; swatchHex: string | null };
export function KosykinShopFilters({ query, colours, priceCeiling, currency }: { query: ShopQuery; colours: Colour[]; priceCeiling: number; currency: string }) {
  const id = useId();
  const [minimum, setMinimum] = useState(query.min || '0');
  const [maximum, setMaximum] = useState(query.max || String(priceCeiling));
  return <div className="kosy-shop-filter-control">
    <button type="button" className="kosy-filter-trigger" popoverTarget={id}><SlidersHorizontal size={16} />Filter & sort</button>
    <div id={id} popover="auto" className="kosy-shop-filter-panel">
      <div className="kosy-filter-title"><strong>Filter & sort</strong><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close filters"><X size={18} /></button></div>
      <form action="/shop" method="get" key={JSON.stringify(query)}>
        {queryList(query.category).map(value => <input key={value} type="hidden" name="category" value={value} />)}
        <fieldset><legend>Sort by</legend>{[['featured','Featured'],['new','Newest'],['price-asc','Price: low to high'],['price-desc','Price: high to low']].map(([value,label]) => <label key={value}><input type="radio" name="sort" value={value} defaultChecked={(query.sort || 'featured') === value} />{label}</label>)}</fieldset>
        {colours.length > 0 && <fieldset><legend>Colour</legend><div className="kosy-filter-colours">{colours.map(colour => <label key={colour.value}><input type="checkbox" name="colour" value={colour.value} defaultChecked={queryList(query.colour).includes(colour.value)} /><span style={{ background: colour.swatchHex || '#ddd' }} />{colour.label}</label>)}</div></fieldset>}
        <fieldset><legend>Price range ({currency})</legend><div className="kosy-price-sliders"><label>Minimum price slider<input aria-label="Minimum price slider" type="range" min="0" max={priceCeiling} step="0.01" value={minimum} onChange={event => setMinimum(String(Math.min(Number(event.target.value), Number(maximum))))} /></label><label>Maximum price slider<input aria-label="Maximum price slider" type="range" min="0" max={priceCeiling} step="0.01" value={maximum} onChange={event => setMaximum(String(Math.max(Number(event.target.value), Number(minimum))))} /></label></div><div className="kosy-price-inputs"><label>Min<input name="min" type="number" min="0" max={maximum} step="0.01" value={minimum} onChange={event => setMinimum(event.target.value)} /></label><label>Max<input name="max" type="number" min={minimum || 0} step="0.01" value={maximum} onChange={event => setMaximum(event.target.value)} /></label></div></fieldset>
        <fieldset><legend>Availability</legend><label><input type="checkbox" name="availability" value="available" defaultChecked={query.availability === 'available'} />Available to order</label><label><input type="checkbox" name="sale" value="1" defaultChecked={query.sale === '1'} />On sale</label></fieldset>
        <div className="kosy-filter-actions"><a href={queryList(query.category).length ? `/shop?${new URLSearchParams(queryList(query.category).map(value => ['category', value]))}` : '/shop'}>Reset</a><button type="submit">Apply</button></div>
      </form>
    </div>
  </div>;
}
