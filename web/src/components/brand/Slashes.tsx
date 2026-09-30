import type { SVGProps } from "react";

/** Exact slash geometry from the logo, normalised to its own box. */
export const SLASH_VIEWBOX = "0 0 453 366";
export const SLASH_A = "M196 0H274L78 366H0Z";
export const SLASH_B = "M375 0H453L257 366H179Z";

/** The two red slashes – the JARBOU signature mark. Decorative by default. */
export function Slashes({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={SLASH_VIEWBOX} className={className} aria-hidden="true" focusable="false" {...rest}>
      <path d={SLASH_A} fill="currentColor" />
      <path d={SLASH_B} fill="currentColor" />
    </svg>
  );
}
