"use client";

import { Link } from "@/i18n/navigation";
import { type ComponentProps } from "react";

type Variant = "primary" | "secondary" | "outline" | "light";

const VARIANTS: Record<Variant, { bg: string; color: string; border?: string; arrowBg: string; arrowColor: string }> = {
  primary: {
    bg: "var(--accent)",
    color: "white",
    arrowBg: "rgba(255,255,255,0.2)",
    arrowColor: "white",
  },
  secondary: {
    bg: "var(--ink)",
    color: "var(--ground)",
    arrowBg: "rgba(255,255,255,0.15)",
    arrowColor: "var(--ground)",
  },
  outline: {
    bg: "transparent",
    color: "var(--ink)",
    border: "1px solid var(--field-b)",
    arrowBg: "var(--field-a)",
    arrowColor: "var(--ink)",
  },
  light: {
    bg: "var(--ground)",
    color: "var(--ink)",
    arrowBg: "var(--field-a)",
    arrowColor: "var(--ink)",
  },
};

export function ArrowButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: ComponentProps<typeof Link>["href"];
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const v = VARIANTS[variant];

  return (
    <Link
      href={href}
      className={`arrow-btn group inline-flex items-center gap-0 text-sm font-semibold ${className}`}
      style={{
        background: v.bg,
        color: v.color,
        border: v.border || "none",
      }}
    >
      <span className="arrow-btn-label">{children}</span>
      <span
        className="arrow-btn-icon"
        style={{ background: v.arrowBg }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={v.arrowColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="13 6 19 12 13 18" />
        </svg>
      </span>
    </Link>
  );
}
