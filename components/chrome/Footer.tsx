"use client";

import Link from "next/link";
import { COMPANY, NAV, LEGAL_NAV, BRANDS } from "@/content/site";
import { LunaLogo } from "@/components/brand/Logos";
import { formatLat, formatLon } from "@/lib/globe/coords";
import { useI18n } from "@/content/i18n/I18nProvider";
import styles from "./Footer.module.css";

/**
 * Calm, paper-white corporate footer: the one surface where the master
 * logo sits natively on its intended light ground.
 */
export default function Footer() {
  const { dict, href } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`frame ${styles.inner}`}>
        <div className={styles.top}>
          <Link href={href("/")} aria-label={dict.a11y.home} className={styles.logo} data-cursor="link">
            <span className={styles.logoPaper}>
              <LunaLogo variant="master" height="100%" lazy />
            </span>
            {/* a page may ask for the graphite footer (Kontakt); the reverse logo serves it */}
            <span className={styles.logoGraphite} aria-hidden="true">
              <LunaLogo variant="reverse" height="100%" lazy />
            </span>
          </Link>
          <p className={styles.statement}>{dict.footer.statement}</p>
        </div>

        <div className={styles.cols}>
          <div>
            <h2 className={`t-label ${styles.h}`}>{dict.footer.company}</h2>
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
              {COMPANY.email && (
                <>
                  <br />
                  <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                </>
              )}
            </address>
          </div>
          <nav aria-label={dict.a11y.footerNav}>
            <h2 className={`t-label ${styles.h}`}>{dict.footer.navigate}</h2>
            <ul className={styles.list}>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={href(n.href)} className="link-line" data-cursor="link">
                    {dict.nav[n.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className={`t-label ${styles.h}`}>{dict.footer.owned}</h2>
            <ul className={styles.list}>
              <li>
                <Link href={href(BRANDS.luviscent.internal)} className="link-line" data-cursor="link" lang="en">
                  {BRANDS.luviscent.name}
                  {BRANDS.luviscent.mark}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={`t-label ${styles.h}`}>{dict.footer.legal}</h2>
            <ul className={styles.list}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link href={href(n.href)} className="link-line" data-cursor="link">
                    {dict.legal[n.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className="t-label">
            © {year} {COMPANY.legalName}
          </span>
          <span className="t-label t-mono" dir="ltr">
            {formatLat(COMPANY.coordinates.lat)} &nbsp;{formatLon(COMPANY.coordinates.lon)}
          </span>
        </div>
      </div>
    </footer>
  );
}
