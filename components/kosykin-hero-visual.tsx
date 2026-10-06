"use client";

import Image from "next/image";
import { useRef, type CSSProperties, type PointerEvent } from "react";

export function KosykinHeroVisual({ src, alt }: { src: string; alt: string }) {
  const visual = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    visual.current?.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
    visual.current?.style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
  }
  function reset() {
    visual.current?.style.setProperty("--tilt-x", "0deg");
    visual.current?.style.setProperty("--tilt-y", "0deg");
  }
  return (
    <div className="kosy-hero-visual" onPointerMove={move} onPointerLeave={reset}>
      <div className="kosy-hero-float"><div ref={visual} className="kosy-hero-object" style={{ "--tilt-x": "0deg", "--tilt-y": "0deg" } as CSSProperties}>
        <Image src={src} alt={alt} fill priority sizes="(max-width: 720px) 88vw, 48vw" unoptimized />
      </div></div>
    </div>
  );
}
