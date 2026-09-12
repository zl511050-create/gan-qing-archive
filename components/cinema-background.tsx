"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function CinemaBackground({ src }: { src: string }) {
  const [layers, setLayers] = useState<[string, string]>([src, src]);
  const [activeLayer, setActiveLayer] = useState(0);
  const currentSrc = useRef(src);

  useEffect(() => {
    if (currentSrc.current === src) return;
    const nextLayer = activeLayer === 0 ? 1 : 0;
    setLayers((current) => {
      const next: [string, string] = [...current];
      next[nextLayer] = src;
      return next;
    });
    const frame = window.requestAnimationFrame(() => setActiveLayer(nextLayer));
    currentSrc.current = src;
    return () => window.cancelAnimationFrame(frame);
  }, [activeLayer, src]);

  return (
    <div className="global-cinema-bg" aria-hidden="true">
      <Image className="global-base-layer" src="/assets/global-your-name-bg.jpeg" alt="" fill sizes="100vw" priority />
      {layers.map((layer, index) => (
        <Image
          className={`global-theme-layer${activeLayer === index ? " is-active" : ""}`}
          src={layer}
          alt=""
          fill
          sizes="100vw"
          key={index}
        />
      ))}
      <div className="global-cinema-filter" />
    </div>
  );
}
