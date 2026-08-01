interface LogoProps {
  /** Set from the server when /public/logo.svg (or logo.png) exists. */
  officialSrc?: string | null
}

/**
 * Renders the official Jarbou Logistik logo when the asset exists in /public
 * (auto-detected server-side, see lib/assets.ts). Until the official file is
 * provided, a clearly-structured wordmark fallback is shown so a broken-image
 * icon can never appear. The official logo is never redrawn, cropped or
 * recolored — it is rendered as delivered, height-constrained only.
 */
export default function Logo({ officialSrc }: LogoProps) {
  if (officialSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={officialSrc}
        alt="Jarbou Logistik GmbH"
        className="h-10 md:h-12 w-auto"
      />
    )
  }

  return (
    <div className="flex items-center gap-3">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        <line x1="12" y1="10" x2="22" y2="30" stroke="#F20D18" strokeWidth="3" strokeLinecap="round" />
        <line x1="22" y1="10" x2="32" y2="30" stroke="#F20D18" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="flex flex-col leading-tight">
        <span className="text-lg font-bold text-off-white">JARBOU</span>
        <span className="text-xs font-medium text-mid-grey">LOGISTIK GMBH</span>
      </div>
    </div>
  )
}
