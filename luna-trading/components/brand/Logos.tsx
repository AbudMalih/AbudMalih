/**
 * Official brand assets.
 *  - "master":  the supplied logo, untouched (light grounds: footer, print).
 *  - "reverse": digital reverse-colour application of the same wordmark for
 *    dark surfaces. Geometry, proportions and anti-aliasing are identical to
 *    the master. Only colour is mapped: luna → light metallic grey,
 *    trading → near-white, "+" → original Luna red. Transparent, no plate.
 *    Generated from the master by scripts/build-reverse-logo.sh.
 */
type LunaProps = { height?: number | string; className?: string; variant?: "reverse" | "master"; priority?: boolean; lazy?: boolean };

export function LunaLogo({ height = 22, className, variant = "reverse", priority, lazy }: LunaProps) {
  return (
    <img
      src={variant === "reverse" ? "/brand/luna-trading-logo-reverse.webp" : "/brand/luna-trading-logo-trim.webp"}
      alt="Luna Trading"
      width={1856}
      height={492}
      style={{ height, width: "auto" }}
      className={className}
      fetchPriority={priority ? "high" : undefined}
      loading={lazy ? "lazy" : undefined}
      decoding="async"
      draggable={false}
    />
  );
}

export function LuviscentLogo({ width = "100%", className }: { width?: number | string; className?: string }) {
  return (
    <img
      src="/brand/luviscent-logo.png"
      alt="LUVISCENT®"
      width={1537}
      height={173}
      style={{ width, height: "auto" }}
      className={className}
      decoding="async"
      draggable={false}
    />
  );
}

/** The Luna "+" as a pure geometric glyph. */
export function Plus({ size = 12, color = "var(--luna-red)", className, weight }: { size?: number; color?: string; className?: string; weight?: number }) {
  const w = weight ?? Math.max(1, Math.round(size * 0.2));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true" focusable="false">
      <rect x={0} y={(size - w) / 2} width={size} height={w} fill={color} />
      <rect x={(size - w) / 2} y={0} width={w} height={size} fill={color} />
    </svg>
  );
}
