import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { visibleProductBlocks, type ProductDetailConfig } from "@/lib/product-detail";

export function ProductDetailBlocks({ config }: { config: ProductDetailConfig }) {
  const blocks = visibleProductBlocks(config);
  return <>
    {blocks.highlights.length > 0 && <div className="pdp-highlights">{blocks.highlights.map((item, index) => <article key={index}><CategoryIcon name={item.icon} size={18} /><div><strong>{item.title}</strong>{item.text && <p>{item.text}</p>}</div></article>)}</div>}
    {blocks.video && <a className="pdp-video-card" href={blocks.video.url} target="_blank" rel="noopener noreferrer">
      {blocks.video.imageUrl && <span className="pdp-video-cover"><Image src={blocks.video.imageUrl} alt="" width={200} height={200} unoptimized /><Play size={24} aria-hidden="true" /></span>}
      <span><strong>{blocks.video.title}</strong>{blocks.video.text && <span>{blocks.video.text}</span>}<small>{blocks.video.ctaLabel || "Watch on Instagram"} <ArrowUpRight size={13} /></small></span>
    </a>}
    {blocks.sections.length > 0 && <div className="pdp-details">{blocks.sections.map((section, index) => <section key={index}><h2>{section.title}</h2><p>{section.text}</p></section>)}</div>}
  </>;
}
