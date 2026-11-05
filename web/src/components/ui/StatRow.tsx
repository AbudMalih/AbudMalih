import { stats } from "@/content/company";

/**
 * The four verified company figures, rendered in full on the server and
 * shown immediately (no count-up).
 */
export function StatRow({ className = "" }: { className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4 ${className}`}>
      {stats.map((s) => (
        <div key={s.id} className="flex flex-col border-t border-white/20 pt-5">
          <dt className="eyebrow order-2 mt-3 text-steel-300">{s.label}</dt>
          <dd className="order-1 text-[clamp(3rem,7.5vw,7rem)] font-bold leading-none tracking-[-0.045em] tabular-nums text-white">
            {s.value}
            {s.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
