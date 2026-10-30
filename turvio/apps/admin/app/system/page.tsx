import { Badge } from "@turvio/web-ui";
import { AdminShell } from "../../components/AdminShell";

const CHECKS: { name: string; state: "off" | "dev" | "todo"; note: string }[] = [
  { name: "Stripe Billing", state: "off", note: "Payments intentionally disabled. Plans/subscriptions are managed manually." },
  { name: "Supabase Auth", state: "todo", note: "Schema, RLS and API token verification ready; login UI not yet connected." },
  { name: "Optimizer (OR-Tools)", state: "dev", note: "Runs as an internal service; travel times are straight-line estimates unless OSRM_URL is set." },
  { name: "Routing engine (OSRM)", state: "todo", note: "Self-hosted OSRM with Germany extract planned." },
  { name: "Carrier integrations (e.g. DHL)", state: "off", note: "Not connected. Requires written authorization before any integration." },
];

export default function SystemPage() {
  return (
    <AdminShell current="/system">
      <h1>System</h1>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Component</th><th>State</th><th>Notes</th></tr></thead>
          <tbody>
            {CHECKS.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td>
                  <Badge tone={c.state === "off" ? "neutral" : c.state === "dev" ? "primary" : "warning"}>
                    {c.state === "off" ? "disabled" : c.state === "dev" ? "development" : "not yet implemented"}
                  </Badge>
                </td>
                <td className="muted">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
