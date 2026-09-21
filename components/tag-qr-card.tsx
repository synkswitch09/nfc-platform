"use client";

import Image from "next/image";
import { Check, Copy, QrCode, Radio } from "lucide-react";
import { useState } from "react";

export function TagQrCard({ publicUrl, publicTagId, qrDataUrl }: { publicUrl: string; publicTagId: string; qrDataUrl: string }) {
  const [message, setMessage] = useState("");
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setMessage("Link copied"); }
    catch { setMessage("Could not copy the link"); }
  }
  return <section className="tag-identity-card"><header className="tag-identity-header"><span className="tag-identity-icon"><QrCode size={21} /></span><div><p>Your pet’s digital ID</p><h2>QR & tag</h2></div></header><div className="tag-qr-frame"><Image src={qrDataUrl} alt={`QR code for ${publicTagId}`} width={240} height={240} unoptimized /></div><div className="tag-link-row"><span title={publicUrl}>{publicUrl}</span><button type="button" className="text-button" onClick={copyLink}><Copy size={15} /> Copy</button></div>{message && <p className="tag-copy-status" role="status"><Check size={14} /> {message}</p>}<dl className="tag-identity-details"><div><dt>Public tag ID</dt><dd>{publicTagId}</dd></div></dl><p className="tag-identity-help"><Radio size={15} /> Your QR and NFC always open this same protected profile.</p></section>;
}
