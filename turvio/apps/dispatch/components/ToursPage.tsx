"use client";

import { cn } from "@turvio/web-ui/ds";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "../lib/store";
import { ListView } from "./ListView";
import { ToursManager } from "./ToursManager";

const VIEWS = [
  { key: "day", label: "Day board", hint: "Live progress and finish times of the selected day" },
  { key: "all", label: "All tours", hint: "Any day, range or month – actions, bulk work and clean-up" },
  { key: "archived", label: "Archive", hint: "Archived tours – everything kept, searchable, exportable, restorable" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Tours: the live day board (unchanged) plus tour management and the archive. */
export function ToursPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { orgDefaults } = useDispatch();
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
        <div className="flex rounded-xl border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Tour views">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn("h-9 rounded-[10px] px-3.5 text-[13px] font-semibold text-muted transition-colors", view === v.key && "bg-surface text-ink shadow-xs")}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-[12.5px] text-muted">{current.hint}</span>
      </div>
      {view === "day" ? (
        <ListView />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{view === "archived" ? "Archived tours" : "All tours"}</h1>
          </div>
          <ToursManager key={view} archived={view === "archived" ? "only" : "exclude"} />
        </>
      )}
    </div>
  );
}
