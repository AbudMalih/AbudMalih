import { LimitName } from "@turvio/shared";
import { Badge } from "@turvio/web-ui";
import { AdminShell } from "../../components/AdminShell";
import { plans } from "../../lib/data";

const money = (cents: number, currency: string) => (cents === 0 ? "not set" : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100));

export default function PlansPage() {
  return (
    <AdminShell current="/plans">
      <h1>Plans &amp; limits</h1>
      <p className="muted">Prices are placeholders until pricing is decided. Limits are enforced by the database and the API.</p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th><th>Audience</th><th>Pricing</th><th>Monthly</th><th>Annual</th><th>Trial</th>
              {LimitName.options.map((l) => <th key={l}>{l.replace("max_", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.code}>
                <td>{p.name} <div className="muted">{p.code}</div></td>
                <td>{p.audience === "company" ? "Company" : "Individual driver"}</td>
                <td><Badge tone="primary">{p.pricingModel === "per_driver" ? "per driver" : "flat"}</Badge></td>
                <td>{money(p.monthlyAmountCents, p.currency)}</td>
                <td>{money(p.annualAmountCents, p.currency)}</td>
                <td>{p.trialDays} days</td>
                {LimitName.options.map((l) => (
                  <td key={l}>{p.limits[l] ?? (l === "max_drivers" && p.pricingModel === "per_driver" ? "seats" : "∞")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
