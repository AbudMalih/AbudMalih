import { LimitName, PLAN_CATALOGUE, type Plan } from "@turvio/shared";
import { Badge, Card, CardHeader, PageHeader, cn } from "@turvio/web-ui/ds";
import { Building2, Check, Gauge, Minus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { AdminShell } from "../../components/AdminShell";

export const metadata: Metadata = { title: "Plans & limits" };

const LIMIT_LABEL: Record<LimitName, string> = {
  max_drivers: "Drivers",
  max_dispatchers: "Dispatchers",
  max_depots: "Depots",
  max_vehicles: "Vehicles",
  max_stops_per_month: "Stops / month",
};

const FEATURE_LABEL: Record<string, string> = {
  optimization: "Route optimization",
  scanning: "Parcel scanning",
  dispatch: "Dispatch dashboard",
  reports: "Reports & exports",
  api: "API access",
  multi_depot: "Multi-depot",
};

function limitValue(p: Plan, l: LimitName) {
  const v = p.limits[l];
  if (v != null) return v.toLocaleString("en");
  if (l === "max_drivers" && p.pricingModel === "per_driver") return "Per seat";
  return "Unlimited";
}

const ALL_FEATURES = Object.keys(FEATURE_LABEL);

export default function PlansPage() {
  return (
    <AdminShell crumbs={[{ label: "Platform", href: "/" }, { label: "Plans & limits" }]}>
      <PageHeader
        title="Plans & limits"
        description="The plan catalogue enforced by the database and the API. Prices are intentionally not configured yet; payments are disabled."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_CATALOGUE.map((p) => (
          <Card key={p.code} interactive className={cn("relative flex flex-col p-5", p.code === "business" && "ring-1 ring-brand-200")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{p.name}</h2>
                  {p.code === "business" && <Badge tone="brand">Most complete</Badge>}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                  {p.audience === "company" ? <Building2 className="size-3.5" /> : <UserRound className="size-3.5" />}
                  {p.audience === "company" ? "For companies" : "For individual drivers"}
                </p>
              </div>
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-muted">{p.code}</code>
            </div>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-subtle">Price not set</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {p.pricingModel === "per_driver" ? "Per driver seat" : "Flat rate"} · monthly or annual · {p.trialDays}-day trial
            </p>

            <div className="my-5 h-px bg-line" />

            <ul className="flex flex-col gap-2 text-[13px]">
              {ALL_FEATURES.map((f) => {
                const on = !!p.features[f];
                return (
                  <li key={f} className={cn("flex items-center gap-2", on ? "text-ink-2" : "text-subtle")}>
                    {on ? <Check className="size-4 text-success" /> : <Minus className="size-4" />}
                    {FEATURE_LABEL[f]}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Limits" description="Effective limit = tenant override → purchased seats (per-driver plans) → plan value." actions={<Gauge className="size-4 text-subtle" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="bg-surface-2/60 text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="h-10 px-5 text-start font-medium">Limit</th>
                {PLAN_CATALOGUE.map((p) => (
                  <th key={p.code} scope="col" className="h-10 px-5 text-start font-medium">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LimitName.options.map((l) => (
                <tr key={l} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3 text-start font-medium text-ink-2">{LIMIT_LABEL[l]}</th>
                  {PLAN_CATALOGUE.map((p) => {
                    const v = limitValue(p, l);
                    return (
                      <td key={p.code} className={cn("px-5 py-3 tabular", v === "Unlimited" ? "text-muted" : "text-ink")}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
