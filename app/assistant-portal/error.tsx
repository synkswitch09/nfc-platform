"use client";
import Link from "next/link";
export default function AssistantErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <section className="ai-card ai-prose"><h1>This page couldn't load.</h1><p>Please try again. If it keeps happening, open the Help centre.</p><div className="ai-actions"><button className="ai-button" onClick={reset}>Try again</button><Link className="ai-button ai-secondary" href="/help">Open help</Link></div></section>;}
