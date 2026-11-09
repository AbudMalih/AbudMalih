"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COMPANY, NAV, LEGAL_NAV, BRANDS, CONTACT_EMAIL } from "@/content/site";
import { LunaLogo } from "@/components/brand/Logos";
import { formatLat, formatLon } from "@/lib/globe/coords";
import { useI18n } from "@/content/i18n/I18nProvider";
import { FlagDE } from "@/components/import/Flags";
import LanguageSelector from "./LanguageSelector";
import styles from "./Footer.module.css";

/** Cologne's local time, updated each minute (computed locally, nothing is requested). */
function useCologneTime(locale: string) {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(
      locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "de-DE",
      { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" },
    );
    const tick = () => setT(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [locale]);
  return t;
}

/**
 * The closing room of every page, in the site's dark style: an invitation
 * with the direct actions, then the index (company, navigation, own brand,
 * language, legal), then the signature line with Cologne's coordinates and
 * a way back to the top.
 */
export default function Footer() {
  const { dict, href, locale, insights } = useI18n();
  const year = new Date().getFullYear();
  const time = useCologneTime(locale);
  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });

  return (
    <footer className={styles.footer} data-tone="dark">
      <div className={`frame ${styles.inner}`}>
        {/* brand row: who we are, and the two direct actions */}
        <div className={styles.invite}>
          <div className={styles.brandRow}>
            <Link
              href={href("/")}
              aria-label={dict.a11y.home}
              className={styles.logo}
              data-cursor="link"
            >
              <LunaLogo height="100%" lazy />
            </Link>
            <p className={styles.statement}>{dict.footer.statement}</p>
          </div>
          <div className={styles.actions}>
            <Link
              href={href("/contact")}
              className={styles.btnRed}
              data-cursor="invert"
            >
              {dict.nav.cta}
              <span className={styles.badge} aria-hidden="true" />
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={styles.btnGhost}
              dir="ltr"
              data-cursor="link"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* the index */}
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <h2 className={styles.h}>{dict.footer.company}</h2>
            <address className={styles.addr}>
              {COMPANY.legalName}
              <br />
              {COMPANY.street && (
                <>
                  {COMPANY.street}
                  <br />
                </>
              )}
              {COMPANY.postalCode ? `${COMPANY.postalCode} ` : ""}
              {dict.company.place}
            </address>
            <div className={styles.place}>
              <FlagDE className={styles.flag} />
              <span>
                <small>{dict.footer.localTime}</small>
                <span>
                  {dict.company.city}
                  {time && (
                    <>
                      {" · "}
                      <time dir="ltr">{time}</time>
                    </>
                  )}
                </span>
              </span>
            </div>
            {/* social profiles: visual placeholders only, no links until the
                official profile URLs exist (hidden from assistive technology
                so no non-existent account is announced) */}
            <div className={styles.social} aria-hidden="true">
              <SocialIcon name="linkedin" />
              <SocialIcon name="instagram" />
              <SocialIcon name="facebook" />
            </div>
          </div>

          <nav aria-label={dict.a11y.footerNav} className={styles.col}>
            <h2 className={styles.h}>{dict.footer.navigate}</h2>
            <ul className={styles.list}>
              {NAV.filter(
                (n) => n.key !== "insights" || insights.includes(locale),
              ).map((n) => (
                <li key={n.href}>
                  <Link
                    href={href(n.href)}
                    className={styles.link}
                    data-cursor="link"
                  >
                    {dict.nav[n.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.col}>
            <h2 className={styles.h}>{dict.footer.owned}</h2>
            <ul className={styles.list}>
              <li>
                <Link
                  href={href(BRANDS.luviscent.internal)}
                  className={styles.link}
                  data-cursor="link"
                  lang="en"
                  dir="ltr"
                >
                  {BRANDS.luviscent.name}
                  {BRANDS.luviscent.mark}
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.col}>
            <h2 className={styles.h}>{dict.footer.language}</h2>
            <div className={styles.lang}>
              <LanguageSelector />
            </div>
            <h2 className={styles.h} style={{ marginTop: 28 }}>
              {dict.footer.legal}
            </h2>
            <ul className={styles.list}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={href(n.href)}
                    className={styles.link}
                    data-cursor="link"
                  >
                    {dict.legal[n.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* the signature line */}
        <div className={styles.bottom}>
          <span>
            © {year} {COMPANY.legalName}
          </span>
          <span className={styles.coords} dir="ltr">
            <i className={styles.plus} aria-hidden="true" />
            {formatLat(COMPANY.coordinates.lat)} &nbsp;
            {formatLon(COMPANY.coordinates.lon)}
          </span>
          <button
            type="button"
            onClick={toTop}
            className={styles.top}
            data-cursor="link"
          >
            {dict.footer.top}
            <span className={styles.topArrow} aria-hidden="true" />
          </button>
        </div>

        {/* development credit (same wording in every language) */}
        <p className={styles.credit} lang="en" dir="ltr">
          Developed by{" "}
          <a
            href="https://lunapact.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.creditLink}
            data-cursor="link"
          >
            Lunapact Technologies
          </a>
        </p>
      </div>
    </footer>
  );
}

/** Monochrome outline marks, drawn to match the footer (not interactive). */
function SocialIcon({ name }: { name: "linkedin" | "instagram" | "facebook" }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.socialIcon} focusable="false">
      {name === "linkedin" && (
        <>
          <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="4.2" />
          <path d="M7.6 10.6v6.2M11.2 16.8v-6.2M11.2 13.6c0-1.9 1.1-3.1 2.7-3.1s2.5 1.1 2.5 3v3.3" />
          <circle cx="7.6" cy="7.7" r="0.9" className={styles.socialFill} />
        </>
      )}
      {name === "instagram" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5.2" />
          <circle cx="12" cy="12" r="4.1" />
          <circle cx="17.3" cy="6.7" r="0.9" className={styles.socialFill} />
        </>
      )}
      {name === "facebook" && (
        <>
          <circle cx="12" cy="12" r="9.2" />
          <path d="M13 21.1v-7.6h2.4M10.6 13.5h4.8M13 21.1V9.9c0-1.4.8-2.2 2.2-2.2h1.2" />
        </>
      )}
    </svg>
  );
}
