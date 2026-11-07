"use client";

import { useRef, useEffect, useCallback } from "react";

export function PanoramaScroll({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const posRef = useRef({ current: 50, target: 50 });
  const rafRef = useRef<number>(0);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    const pos = posRef.current;
    pos.current = lerp(pos.current, pos.target, 0.04);

    if (imgRef.current) {
      const maxShift = 60;
      const offset = ((pos.current - 50) / 50) * maxShift;
      imgRef.current.style.transform = `translateX(${-offset}px)`;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      posRef.current.target = Math.max(0, Math.min(100, x));
    };

    const handleTouchMove = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      posRef.current.target = Math.max(0, Math.min(100, x));
    };

    const handleMouseLeave = () => {
      posRef.current.target = 50;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className="panorama-container relative overflow-hidden aspect-[2/1] md:aspect-auto md:h-full cursor-grab"
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="h-full object-cover will-change-transform"
        style={{ width: "130%", maxWidth: "none" }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
