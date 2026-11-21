import Link from "next/link";

const EXP = [
  ["/lab/globe", "01", "Globus"],
  ["/lab/type", "02", "Typografie"],
  ["/lab/story", "03", "Story"],
  ["/lab/nav", "04", "Navigation"],
  ["/lab/components", "05", "Komponenten"],
] as const;

/** Small floating bar to move between the experiments. */
export default function LabBar({ current }: { current?: string }) {
  return (
    <nav className="labbar" aria-label="Lab">
      <Link href="/lab" className="tag">LAB</Link>
      {EXP.map(([href, n, label]) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined} aria-label={`${n} ${label}`}>
          {n}
          <span className={current === href ? "" : "hideSm"}> {label}</span>
        </Link>
      ))}
    </nav>
  );
}
