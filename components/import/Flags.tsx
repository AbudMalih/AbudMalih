/** National flags as small inline SVGs (official proportions simplified to 3:2). */
export function FlagCN({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#DE2910" />
      <g fill="#FFDE00">
        <polygon points="5,2 5.9,4.8 8.8,4.8 6.5,6.5 7.4,9.3 5,7.6 2.6,9.3 3.5,6.5 1.2,4.8 4.1,4.8" />
        <circle cx="10" cy="2" r="0.9" />
        <circle cx="12" cy="4" r="0.9" />
        <circle cx="12" cy="7" r="0.9" />
        <circle cx="10" cy="9" r="0.9" />
      </g>
    </svg>
  );
}
export function FlagDE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </svg>
  );
}
export function FlagEU({ className }: { className?: string }) {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [15 + Math.sin(a) * 6, 10 - Math.cos(a) * 6];
  });
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#003399" />
      {stars.map(([x, y], i) => (
        <circle
          key={i}
          cx={x.toFixed(2)}
          cy={y.toFixed(2)}
          r="0.8"
          fill="#FFCC00"
        />
      ))}
    </svg>
  );
}
