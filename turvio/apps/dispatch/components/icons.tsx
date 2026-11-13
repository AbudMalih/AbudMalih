// Icons for the TURVIO NEXT Dispatch UI: lucide icons plus the prototype's own steering-wheel glyph
// (design/next/dispatch/app.js, "drivers"), drawn in lucide's stroke style.
import type { LucideProps } from "lucide-react";

export { AlertTriangle, CircleCheck, PackageCheck, PackageOpen, Route } from "lucide-react";

export function Steering({ size = 24, strokeWidth = 2, className, ...rest }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 14.5V21M9.6 11.3 3.5 9.5M14.4 11.3l6.1-1.8" />
    </svg>
  );
}
