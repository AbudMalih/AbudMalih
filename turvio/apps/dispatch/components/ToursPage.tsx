"use client";

import { cn } from "@turvio/web-ui/ds";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { ListView } from "./ListView";
import { ToursManager } from "./ToursManager";

const VIEWS = [
  { key: "day", label: "tours.view.day", hint: "tours.view.dayHint" },
  { key: "all", label: "tours.view.all", hint: "tours.view.allHint" },
  { key: "archived", label: "tours.view.archived", hint: "tours.view.archivedHint" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Tours: the live day board (unchanged) plus tour management and the archive. */
export function ToursPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { orgDefaults } = useDispatch();
  const t = useT();
  const raw = params?.get("view") ?? orgDefaults?.toursView ?? null;
  const view: View = raw === "all" || raw === "archived" ? raw : "day";
  const setView = (v: View) => {
    const p = new URLSearchParams(params?.toString() ?? "");
    p.set("view", v);
    router.replace(`${pathname ?? "/list"}${p.size ? `?${p}` : ""}`);
  };
  const current = VIEWS.find((v) => v.key === view)!;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-surface-2 p-0.5" role="tablist" aria-label={t("tours.view.aria")}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn("h-9 rounded-[10px] px-3.5 text-[13px] font-semibold text-muted transition-colors", view === v.key && "bg-surface text-ink shadow-xs")}
            >
              {t(v.label)}
            </button>
          ))}
        </div>
        <span className="text-[12.5px] text-muted">{t(current.hint)}</span>
      </div>
      {view === "day" ? (
        <ListView />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{view === "archived" ? t("tours.view.archivedTitle") : t("tours.view.all")}</h1>
          </div>
          <ToursManager key={view} archived={view === "archived" ? "only" : "exclude"} />
        </>
      )}
    </div>
  );
}
