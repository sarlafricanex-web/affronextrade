"use client";

import { useState, useEffect, useRef } from "react";

const IMAGES = [
  { src: "/images/boat-in-harbor-algeria.jpg", alt: "Boat in harbor, Algeria, 1853" },
  { src: "/images/cherchell-harbour-01.jpg", alt: "Port de Cherchell, Algerie" },
  { src: "/images/sunrise-from-algeria-port.jpg", alt: "Lever de soleil depuis un port algerien" },
  { src: "/images/ripe-and-dry-dates-fruit-bunches.jpg", alt: "Grappes de dattes sur palmier" },
];

export function HeroCrossfade() {
  const [active, setActive] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setActive((cur) => {
        prev.current = cur;
        return (cur + 1) % IMAGES.length;
      });
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const next = (active + 1) % IMAGES.length;
  const visible = new Set([active, prev.current, next]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "var(--ink)" }}>
      {IMAGES.map((img, i) => (
        visible.has(i) && (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            width={1920}
            height={1440}
            loading={i === active ? "eager" : "lazy"}
            decoding={i === active ? "sync" : "async"}
            className="hero-image"
            style={{ opacity: i === active ? 1 : 0 }}
          />
        )
      ))}
    </div>
  );
}
