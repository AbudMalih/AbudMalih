/**
 * Official brand assets — rendered exactly as supplied.
 * The Luna Trading logo is designed for light grounds (black "trading"),
 * so on dark grounds it is always presented on a paper plate rather than
 * being recoloured. Replace with an approved reverse version when available.
 */
type LunaProps = { height?: number | string; className?: string; plate?: boolean; priority?: boolean };

export function LunaLogo({ height = 22, className, plate = false, priority }: LunaProps) {
  const img = (
    <img
      src="/brand/luna-trading-logo-trim.webp"
      alt="Luna Trading"
      width={1856}
      height={492}
      style={{ height, width: "auto" }}
      className={plate ? undefined : className}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
    />
  );
  if (!plate) return img;
  return <span className={`luna-plate ${className ?? ""}`}>{img}</span>;
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

/** The Luna "+" as a pure geometric glyph (proportions from the logo: arm ≈ 0.42 of size). */
export function Plus({ size = 12, color = "var(--luna-red)", className, weight }: { size?: number; color?: string; className?: string; weight?: number }) {
  const w = weight ?? Math.max(1, Math.round(size * 0.2));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true" focusable="false">
      <rect x={0} y={(size - w) / 2} width={size} height={w} fill={color} />
      <rect x={(size - w) / 2} y={0} width={w} height={size} fill={color} />
    </svg>
  );
}
