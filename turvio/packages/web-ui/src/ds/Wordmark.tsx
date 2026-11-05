import { cn } from "./cn";

/**
 * Official TURVIO logo (raster derivatives of the supplied brand files, see
 * turvio/branding). Apps serve them from /brand/*. Never stretch: only the
 * height is set, the width follows the intrinsic aspect ratio.
 */
const LOCKUP = { light: "/brand/turvio-lockup-light.png", dark: "/brand/turvio-lockup-dark.png", ratio: 720 / 127 };
const MARK = { light: "/brand/turvio-mark-light.png", dark: "/brand/turvio-mark-dark.png", ratio: 317 / 256 };

export function TurvioMark({ size = 24, tone = "light", className }: { size?: number; tone?: "light" | "dark"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={MARK[tone]} alt="TURVIO" width={Math.round(size * MARK.ratio)} height={size} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}

export function TurvioLockup({ height = 20, tone = "light", className }: { height?: number; tone?: "light" | "dark"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOCKUP[tone]} alt="TURVIO" width={Math.round(height * LOCKUP.ratio)} height={height} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}

/** Logo + product name. Collapsed shows the symbol only. */
export function Wordmark({ product, collapsed = false, tone = "light", className }: { product?: string; collapsed?: boolean; tone?: "light" | "dark"; className?: string }) {
  if (collapsed) return <TurvioMark size={22} tone={tone} className={className} />;
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <TurvioLockup height={19} tone={tone} />
      {product && (
        <>
          <span className={cn("h-4 w-px shrink-0", tone === "dark" ? "bg-white/20" : "bg-line-strong")} aria-hidden="true" />
          <span className={cn("truncate text-[13px] font-medium", tone === "dark" ? "text-white/70" : "text-muted")}>{product}</span>
        </>
      )}
    </div>
  );
}
