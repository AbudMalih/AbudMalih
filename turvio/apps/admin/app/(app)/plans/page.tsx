import { LimitName, PLAN_CATALOGUE, type Plan } from "@turvio/shared";
import { Badge, Card, CardHeader, PageHeader, cn } from "@turvio/web-ui/ds";
import { Building2, Check, Gauge, Minus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { createFormat, type MessageKey, type TFunction } from "../../../lib/i18n";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("plans.title") };
}

const FEATURES = ["optimization", "scanning", "dispatch", "reports", "api", "multi_depot"] as const;

function limitValue(p: Plan, l: LimitName, t: TFunction, num: (n: number) => string): string | null {
  const v = p.limits[l];
  if (v != null) return num(v);
  if (l === "max_drivers" && p.pricingModel === "per_driver") return t("plans.perSeat");
  return null;
}

/** The plan catalogue (packages/shared) the database and the API enforce, with its limits. */
export default async function PlansPage() {
  const { t, locale } = await serverT();
  const fmt = createFormat(locale);
  return (
    <>
      <PageHeader title={t("plans.title")} description={t("plans.description")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLAN_CATALOGUE.map((p) => (
          <Card key={p.code} interactive className={cn("relative flex flex-col p-5 g:p-4", p.code === "business" && "ring-1 ring-brand-200 g:ring-0")}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink g:text-[14px]">{p.name}</h2>
                {p.code === "business" && <Badge tone="brand">{t("plans.mostComplete")}</Badge>}
                {!p.active && <Badge tone="neutral">{t("plans.inactive")}</Badge>}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                {p.audience === "company" ? <Building2 className="size-3.5" /> : <UserRound className="size-3.5" />}
                {p.audience === "company" ? t("plans.forCompanies") : t("plans.forDrivers")}
              </p>
            </div>
            <p className="mt-3 text-xs text-muted">
              {p.pricingModel === "per_driver" ? t("plans.perDriver") : t("plans.flat")} · {t("plans.trial", { count: p.trialDays })}
            </p>

            <div className="my-5 h-px bg-line g:my-3" />

            <ul className="flex flex-col gap-2 text-[13px]">
              {FEATURES.map((f) => {
                const on = !!p.features[f];
                return (
                  <li key={f} className={cn("flex items-center gap-2", on ? "text-ink-2" : "text-subtle")}>
                    {on ? <Check className="size-4 text-success g:size-3.5 g:text-ink-2" aria-label={t("plans.included")} /> : <Minus className="size-4 g:size-3.5" aria-label={t("plans.notIncluded")} />}
                    {t(`plans.feature.${f}` as MessageKey)}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden g:mt-0">
        <CardHeader title={t("plans.limits")} description={t("plans.limitsDescription")} actions={<Gauge className="size-4 text-subtle" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="bg-surface-2/60 text-xs text-muted g:bg-transparent">
              <tr className="border-b border-line">
                <th scope="col" className="h-10 px-5 text-start font-medium g:h-9 g:px-4">{t("company.limit")}</th>
                {PLAN_CATALOGUE.map((p) => (
                  <th key={p.code} scope="col" className="h-10 px-5 text-start font-medium g:h-9 g:px-4">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LimitName.options.map((l) => (
                <tr key={l} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3 text-start font-medium text-ink-2 g:px-4 g:py-2 g:font-normal">
                    {t(`common.limit.${l}`)}
                  </th>
                  {PLAN_CATALOGUE.map((p) => {
                    const v = limitValue(p, l, t, (n) => fmt.number(n));
                    return (
                      <td key={p.code} className={cn("px-5 py-3 tabular g:px-4 g:py-2", v === null ? "text-muted" : "text-ink")}>
                        {v ?? t("common.unlimited")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
