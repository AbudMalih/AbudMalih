import { Badge, Kpi } from "@turvio/web-ui";
import { AdminShell } from "../components/AdminShell";
import { listTenants } from "../lib/data";

export const dynamic = "force-dynamic";

const STATUS_TONE = { active: "success", trialing: "primary", past_due: "warning", suspended: "danger", cancelled: "neutral", incomplete: "warning" } as const;

export default function CompaniesPage() {
  const tenants = listTenants();
  return (
    <AdminShell current="/">
      <h1>Companies</h1>
      <div className="grid">
        <Kpi label="Tenants" value={tenants.length} />
        <Kpi label="Active subscriptions" value={tenants.filter((t) => t.subscription?.status === "active").length} />
        <Kpi label="In trial" value={tenants.filter((t) => t.subscription?.status === "trialing").length} />
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Company</th><th>Status</th><th>Plan</th><th>Billing</th><th>Drivers</th><th>Trial / period end</th></tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.org.id}>
                <td>
                  {t.org.name}
                  <div className="muted">{t.org.slug} · {t.org.countryCode}</div>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[t.org.status]}>{t.org.status}</Badge>
                  {!t.usable && <div><Badge tone="danger">blocked</Badge></div>}
                </td>
                <td>{t.plan?.name ?? "–"}</td>
                <td>{t.subscription ? `${t.subscription.interval === "month" ? "Monthly" : "Annual"} · ${t.subscription.seats} seats` : "–"}</td>
                <td>{t.activeDrivers} / {t.driverLimit ?? "∞"}</td>
                <td>{t.subscription?.trialEndsAt?.slice(0, 10) ?? t.subscription?.currentPeriodEnd.slice(0, 10) ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
