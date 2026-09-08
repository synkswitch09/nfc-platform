import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "NFC guides", description: "Practical guides to NFC pet tags, privacy and safe information sharing in Australia.", alternates: { canonical: "/guides" } };

const guides = [{ slug: "how-nfc-pet-tags-work", title: "How NFC pet tags work", summary: "What happens when someone taps a smart pet tag, what the chip stores, and how to use one safely.", date: "2026-09-08" }];

export default function GuidesPage() {
  return <section className="section compact-section"><div className="section-head"><span className="eyebrow"><BookOpen size={16} /> NFC knowledge</span><h1 className="page-title">Practical guides for safer connections.</h1><p className="lead">Evidence-minded explanations for Australians choosing and using NFC products.</p></div><div className="grid">{guides.map(guide => <article className="card" key={guide.slug}><p className="eyebrow">Guide · {new Date(guide.date).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}</p><h2>{guide.title}</h2><p>{guide.summary}</p><Link className="button secondary" href={`/guides/${guide.slug}`}>Read guide <ArrowRight size={16} /></Link></article>)}</div></section>;
}
