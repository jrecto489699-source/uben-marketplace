import type { CSSProperties } from "react";

type Variant = "dark" | "brand" | "light";

interface UbenLogoProps {
  variant?: Variant;
  /** Circle diameter in px. Named shortcuts: xs=24, sm=32, md=44, lg=56, xl=72 */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Render only the circle mark — for favicons, app icons, tight spaces */
  iconOnly?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const NAMED_SIZES = { xs: 24, sm: 32, md: 44, lg: 56, xl: 72 } as const;

const PALETTE: Record<Variant, { circle: string; u: string; wordmark: string }> = {
  dark:  { circle: "#1a1a1a", u: "#ffffff", wordmark: "#1a1a1a" },
  brand: { circle: "#B8873A", u: "#ffffff", wordmark: "#B8873A" },
  light: { circle: "#ffffff", u: "#1a1a1a", wordmark: "#ffffff" },
};

const FONT = "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export default function UbenLogo({
  variant = "dark",
  size = "md",
  iconOnly = false,
  className,
  style,
  "aria-label": ariaLabel,
}: UbenLogoProps) {
  const d = typeof size === "number" ? size : NAMED_SIZES[size];
  const r = d / 2;
  const colors = PALETTE[variant];

  // U glyph — cap-height targets ~48% of circle diameter
  // Inter Medium cap/em ≈ 0.73 → fontSize = (d * 0.48) / 0.73 ≈ d * 0.657
  const uSize = Math.round(d * 0.66);

  // "ben" — same cap-height as U so they read as one word
  const benSize = uSize;

  // Gap between mark edge and wordmark start
  const gap = Math.round(d * 0.22);

  // Estimate "ben" advance width (Inter Medium: b≈0.61, e≈0.55, n≈0.60 em)
  // letter-spacing nudges it slightly tighter; add 10% safety margin
  const benWidth = Math.round(benSize * 1.76 * 1.08);

  const svgW = iconOnly ? d : d + gap + benWidth;

  return (
    <svg
      width={svgW}
      height={d}
      viewBox={`0 0 ${svgW} ${d}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel ?? (iconOnly ? "Uben mark" : "Uben")}
      role="img"
    >
      {/* ── Circle mark ── */}
      <circle cx={r} cy={r} r={r} fill={colors.circle} />

      {/* ── U glyph ── */}
      <text
        x={r}
        y={r}
        textAnchor="middle"
        dominantBaseline="central"
        fill={colors.u}
        fontSize={uSize}
        fontWeight="500"
        letterSpacing="-1"
        style={{ fontFamily: FONT }}
      >
        U
      </text>

      {/* ── "ben" wordmark ── */}
      {!iconOnly && (
        <text
          x={d + gap}
          y={r}
          textAnchor="start"
          dominantBaseline="central"
          fill={colors.wordmark}
          fontSize={benSize}
          fontWeight="500"
          letterSpacing="-0.5"
          style={{ fontFamily: FONT }}
        >
          ben
        </text>
      )}
    </svg>
  );
}
