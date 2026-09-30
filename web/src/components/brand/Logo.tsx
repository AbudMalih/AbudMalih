/* eslint-disable @next/next/no-img-element -- SVG brand asset, no raster optimisation needed */
import Link from "next/link";

const RATIO = 2748 / 764;

type Props = {
  variant?: "light" | "dark";
  height?: number;
  className?: string;
  /** Wrap in a home link. */
  link?: boolean;
};

/**
 * Official JARBOU Logistik GmbH logo (vectorised from the supplied file,
 * see /public/brand). `light` = white wordmark for dark backgrounds.
 */
export function Logo({ variant = "light", height = 36, className, link = false }: Props) {
  const img = (
    <img
      src={variant === "light" ? "/brand/jarbou-logo-white.svg" : "/brand/jarbou-logo.svg"}
      alt="JARBOU Logistik GmbH"
      width={Math.round(height * RATIO)}
      height={height}
      className={className}
      style={{ height, width: "auto" }}
      decoding="async"
    />
  );
  if (!link) return img;
  return (
    <Link href="/" aria-label="JARBOU Logistik GmbH – zur Startseite" className="inline-flex shrink-0">
      {img}
    </Link>
  );
}
