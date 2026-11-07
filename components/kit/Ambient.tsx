import { useId, type CSSProperties, type ReactNode } from "react";
import a from "./Ambient.module.css";

/**
 * Ambient visuals: they move in place (not with the scroll) and stop
 * completely under prefers-reduced-motion. Used to fill the empty side of
 * text-only sections: a turning wire globe with the Cologne to China lane,
 * a slowly rotating carton, and a photo that drifts very gently.
 */

type Tone = "dark" | "light";

const MERIDIANS = [0, 1, 2, 3, 4, 5];
const LATS = [-60, -30, 0, 30, 60];

export function Globe({
  tone = "dark",
  label,
  className = "",
}: {
  tone?: Tone;
  label?: ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glow = `g${uid}`;
  const lane = `l${uid}`;
  const orbit = `o${uid}`;
  return (
    <div
      className={`${a.wrap} ${tone === "light" ? a.light : ""} ${className}`}
      aria-hidden="true"
    >
      <div className={a.float}>
        <svg viewBox="0 0 400 400" className={a.globe}>
          <defs>
            <radialGradient id={glow} cx="38%" cy="32%" r="70%">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="150" className={a.disc} />
          <circle cx="200" cy="200" r="150" fill={`url(#${glow})`} />
          <circle cx="200" cy="200" r="150" className={a.rim} />
          {LATS.map((lat) => {
            const rad = (lat * Math.PI) / 180;
            const rx = 150 * Math.cos(rad);
            return (
              <ellipse
                key={lat}
                cx="200"
                cy={200 - 150 * Math.sin(rad)}
                rx={rx}
                ry={rx * 0.16}
                className={a.lat}
              />
            );
          })}
          {MERIDIANS.map((i) => (
            <ellipse
              key={i}
              cx="200"
              cy="200"
              rx="150"
              ry="150"
              className={a.meridian}
              style={{ animationDelay: `${-i * 3}s` } as CSSProperties}
            />
          ))}
          {/* the lane: Cologne to the Chinese coast */}
          <path id={lane} d="M138 150 Q 214 40 292 182" className={a.lane} />
          <circle cx="138" cy="150" r="4.5" className={a.pin} />
          <circle cx="138" cy="150" r="4.5" className={a.pulse} />
          <circle cx="292" cy="182" r="4.5" className={a.pin} />
          <circle
            cx="292"
            cy="182"
            r="4.5"
            className={`${a.pulse} ${a.pulseLate}`}
          />
          <g className={a.packet}>
            <rect x="-7" y="-4" width="14" height="8" rx="1.5">
              <animateMotion
                dur="7s"
                repeatCount="indefinite"
                rotate="auto"
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="linear"
              >
                <mpath href={`#${lane}`} />
              </animateMotion>
            </rect>
          </g>
          {/* orbit */}
          <g transform="rotate(-16 200 200)">
            <ellipse
              id={orbit}
              cx="200"
              cy="200"
              rx="188"
              ry="46"
              className={a.orbit}
            />
            <circle r="3.5" className={a.sat}>
              <animateMotion dur="16s" repeatCount="indefinite">
                <mpath href={`#${orbit}`} />
              </animateMotion>
            </circle>
          </g>
        </svg>
      </div>
      {label && <p className={a.label}>{label}</p>}
    </div>
  );
}

export function Carton({
  tone = "dark",
  label,
  className = "",
}: {
  tone?: Tone;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${a.wrap} ${tone === "light" ? a.light : ""} ${className}`}
      aria-hidden="true"
    >
      <div className={a.scene}>
        <div className={a.float}>
          <div className={a.cube}>
            <div className={`${a.face} ${a.front}`}>
              <span className={a.mark} />
            </div>
            <div className={`${a.face} ${a.back}`} />
            <div className={`${a.face} ${a.right}`}>
              <span className={a.lines} />
            </div>
            <div className={`${a.face} ${a.left}`} />
            <div className={`${a.face} ${a.top}`}>
              <span className={a.tape} />
            </div>
            <div className={`${a.face} ${a.bottom}`} />
          </div>
        </div>
        <div className={a.shadow} />
      </div>
      {label && <p className={a.label}>{label}</p>}
    </div>
  );
}

export function Photo({
  src,
  alt,
  caption,
  note,
  className = "",
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <figure className={`${a.photo} ${className}`}>
      <img
        src={`/story/${src}-1600.webp`}
        srcSet={`/story/${src}-960.webp 960w, /story/${src}-1600.webp 1600w`}
        sizes="(max-width: 900px) 100vw, 640px"
        alt={alt}
        width={1600}
        height={1195}
        loading="lazy"
        decoding="async"
      />
      {note && <span className={a.note}>{note}</span>}
      {caption && <figcaption className={a.caption}>{caption}</figcaption>}
    </figure>
  );
}

/** A 3D box built from six faces; size via CSS vars on the element. */
function Box({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={`${a.box} ${className}`} style={style}>
      <div className={`${a.bf} ${a.bFront}`}>{children}</div>
      <div className={`${a.bf} ${a.bBack}`} />
      <div className={`${a.bf} ${a.bRight}`} />
      <div className={`${a.bf} ${a.bLeft}`} />
      <div className={`${a.bf} ${a.bTop}`} />
      <div className={`${a.bf} ${a.bBottom}`} />
    </div>
  );
}

/** Quote: a crane slowly sets a Luna container onto the stack. */
export function Containers({
  label,
  className = "",
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${a.wrap} ${className}`} aria-hidden="true">
      <div className={a.yard}>
        <div className={a.orbitCam}>
          <div className={a.ground} />
          <Box className={`${a.ctr} ${a.ctrA}`} />
          <Box className={`${a.ctr} ${a.ctrB}`} />
          <Box className={`${a.ctr} ${a.ctrC}`} />
          <div className={a.lift}>
            <div className={a.cable} />
            <div className={a.spreader} />
            <Box className={`${a.ctr} ${a.ctrRed}`}>
              <span className={a.ctrMark} />
            </Box>
          </div>
        </div>
      </div>
      {label && <p className={a.label}>{label}</p>}
    </div>
  );
}

/** Contact: a gyroscope of rings around the Luna plus, signals in orbit. */
export function Gyro({
  label,
  className = "",
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${a.wrap} ${className}`} aria-hidden="true">
      <div className={a.gyroStage}>
        <div className={a.float}>
          <div className={a.gyro}>
            <div className={`${a.ring} ${a.ring1}`}>
              <i />
            </div>
            <div className={`${a.ring} ${a.ring2}`}>
              <i />
            </div>
            <div className={`${a.ring} ${a.ring3}`}>
              <i />
            </div>
            <div className={a.core}>
              <span className={a.coreMark} />
            </div>
          </div>
        </div>
      </div>
      {label && <p className={a.label}>{label}</p>}
    </div>
  );
}
