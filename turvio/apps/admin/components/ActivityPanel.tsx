import { Avatar, Card, CardHeader, EmptyState, cn } from "@turvio/web-ui/ds";
import { ArrowRightLeft, CircleAlert, Hourglass, Inbox, UserPlus, Building2, CircleX, type LucideIcon } from "lucide-react";
import { formatRelative, type ActivityEvent, type ActivityKind } from "../lib/platform";

const KIND: Record<ActivityKind, { icon: LucideIcon; tone: string; label: string }> = {
  registration: { icon: Building2, tone: "bg-brand-50 text-brand-600", label: "New company" },
  plan_change: { icon: ArrowRightLeft, tone: "bg-nx-violet-soft text-nx-violet-text", label: "Subscription change" },
  trial_ending: { icon: Hourglass, tone: "bg-warning-soft text-warning-ink", label: "Trial ending" },
  trial_expired: { icon: Hourglass, tone: "bg-danger-soft text-danger-ink", label: "Trial expired" },
  invitation: { icon: UserPlus, tone: "bg-success-soft text-success-ink", label: "Invitation" },
  payment_failed: { icon: CircleAlert, tone: "bg-danger-soft text-danger-ink", label: "Payment issue" },
  cancellation: { icon: CircleX, tone: "bg-surface-2 text-muted", label: "Cancellation" },
};

export function ActivityPanel({ events, now }: { events: ActivityEvent[]; now: Date }) {
  return (
    <Card className="flex flex-col" id="activity">
      <CardHeader title="Platform activity" description="From the audit log: companies, subscriptions, members, invitations" />
      {events.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No recent activity" />
      ) : (
        <ol className="grid grid-cols-1 gap-x-8 px-5 py-2 lg:grid-cols-2 2xl:grid-cols-1">
          {events.map((e, i) => {
            const k = KIND[e.kind];
            const Icon = k.icon;
            return (
              <li key={e.id} className="relative flex gap-3 py-3">
                {i < events.length - 1 && <span className="absolute start-[15px] top-11 bottom-0 w-px bg-line lg:hidden 2xl:block" aria-hidden="true" />}
                <span className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", k.tone)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{e.detail}</span>
                    <time dateTime={e.at} className="shrink-0 text-2xs text-subtle">
                      {formatRelative(e.at, now)}
                    </time>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <Avatar name={e.orgName} size="sm" square className="size-4 text-[8px]" />
                    <span className="truncate">{e.orgName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{k.label}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
