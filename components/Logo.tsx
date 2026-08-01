export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/*
        PLACEHOLDER: Replace with official Jarbou Logistik logo
        Expected: Logo file at /public/logo.svg or /public/logo.png
        The logo should display:
        - Two red diagonal slashes (#F20D18)
        - "JARBOU" text
        - "LOGISTIK GMBH" underneath

        The placeholder below uses SVG to show where the logo will be.
        Once the official logo asset is available, replace this component
        with an Image component pointing to the actual logo file.
      */}
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Placeholder: Two red slashes */}
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
