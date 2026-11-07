"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({
  value,
  suffix = "",
  duration = 1800,
}: {
  value: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");
  const [started, setStarted] = useState(false);

  const numericPart = parseInt(value.replace(/[^0-9]/g, ""), 10);
  const prefix = value.match(/^[^0-9]*/)?.[0] || "";
  const valueSuffix = value.match(/[^0-9]*$/)?.[0] || "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || isNaN(numericPart)) {
      if (started) setDisplay(value);
      return;
    }

    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * numericPart);
      setDisplay(`${prefix}${current}${valueSuffix}`);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [started, numericPart, prefix, valueSuffix, value, duration]);

  return (
    <span ref={ref} className="counter-value">
      {display}{suffix}
    </span>
  );
}
