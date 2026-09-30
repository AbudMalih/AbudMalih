import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { CookieSettingsButton } from "@/components/layout/CookieConsent";
import { company } from "@/content/company";
import { footerNav, legalNav } from "@/content/navigation";

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-ink text-steel-300">
      <div className="shell grid gap-14 py-16 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-4">
          <Logo height={40} />
          <p className="mt-8 max-w-xs text-sm leading-relaxed">{company.subclaim}</p>
          <p className="mt-6 text-sm">
            Bewerbungen:{" "}
            <a className="text-white underline underline-offset-4 hover:text-red" href={`mailto:${company.email.careers}`}>
              {company.email.careers}
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8">
          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="eyebrow text-white">{group.title}</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="transition-colors hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-label="Rechtliches">
            <h2 className="eyebrow text-white">Rechtlich</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton />
              </li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-6 text-xs text-steel-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {company.legalName}</p>
          <p className="font-mono uppercase tracking-[0.14em]">Seit {company.founded}</p>
        </div>
      </div>
    </footer>
  );
}
