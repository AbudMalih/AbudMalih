import type { ReactNode } from "react";

export const TAGLINE = "Smart Routes. Simple Deliveries.";

export interface NavItem {
  href: string;
  label: string;
}

/** App shell with sidebar navigation. `current` marks the active link. */
export function Shell(props: { product: string; nav: NavItem[]; current: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <strong>TURVIO</strong>
          <span>{props.product}</span>
        </div>
        {props.nav.map((item) => (
          <a key={item.href} className="nav-link" href={item.href} aria-current={item.href === props.current ? "page" : undefined}>
            {item.label}
          </a>
        ))}
        <div className="sidebar-footer">{props.footer ?? TAGLINE}</div>
      </nav>
      <main className="main">{props.children}</main>
    </div>
  );
}

export type Tone = "neutral" | "primary" | "success" | "danger" | "warning";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={tone === "neutral" ? "badge" : `badge badge-${tone}`}>{children}</span>;
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
