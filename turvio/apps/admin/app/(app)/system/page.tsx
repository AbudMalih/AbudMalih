import { Badge, Card, PageHeader, cn, type BadgeTone } from "@turvio/web-ui/ds";
import { CreditCard, Database, KeyRound, Map, Route, ShieldCheck, Unplug, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { AdminShell } from "../../../components/AdminShell";

export const metadata: Metadata = { title: "System status" };

type State = "ready" | "dev" | "todo" | "off";

const STATE: Record<State, { label: string; tone: BadgeTone }> = {
  ready: { label: "Ready", tone: "success" },
  dev: { label: "Development", tone: "brand" },
  todo: { label: "Not yet connected", tone: "warning" },
  off: { label: "Disabled", tone: "neutral" },
};

const COMPONENTS: { name: string; icon: LucideIcon; state: State; note: string }[] = [
  { name: "Tenant isolation", icon: ShieldCheck, state: "ready", note: "Row Level Security on every table, composite tenant keys, API tenant checks. Covered by automated tests." },
  { name: "Database schema", icon: Database, state: "dev", note: "Migrations ready; Supabase project (EU region) not provisioned yet." },
  { name: "Authentication", icon: KeyRound, state: "todo", note: "API verifies Supabase tokens. Login screens and MFA for platform admins are the next milestone." },
  { name: "Route optimizer", icon: Route, state: "dev", note: "OR-Tools service. Travel times are straight-line estimates until a routing engine (OSRM) is configured." },
  { name: "Maps & geocoding", icon: Map, state: "todo", note: "Production tile and geocoding provider not chosen. Public OSM tiles are for development only." },
  { name: "Stripe Billing", icon: CreditCard, state: "off", note: "Payments intentionally disabled. Subscriptions are managed manually." },
  { name: "Carrier integrations (e.g. DHL)", icon: Unplug, state: "off", note: "Not connected. Requires written authorization before any integration." },
];

export default function SystemPage() {
  return (
    <AdminShell crumbs={[{ label: "Platform", href: "/" }, { label: "System status" }]}>
      <PageHeader title="System status" description="Readiness of platform components. This is a static checklist maintained with the code, not live monitoring." />
      <Card className="divide-y divide-line">
        {COMPONENTS.map((c) => {
          const Icon = c.icon;
          const s = STATE[c.state];
          return (
            <div key={c.name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2/60 text-ink-2")}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{c.name}</div>
                <p className="mt-0.5 text-[13px] text-muted">{c.note}</p>
              </div>
              <Badge tone={s.tone} dot className="self-start sm:self-center">
                {s.label}
              </Badge>
            </div>
          );
        })}
      </Card>
    </AdminShell>
  );
}
