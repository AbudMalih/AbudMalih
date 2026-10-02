import Link from "next/link";
import { COMPANY, NAV, LEGAL_NAV, BRANDS } from "@/content/site";
import { LunaLogo, Plus } from "@/components/brand/Logos";
import { formatLat, formatLon } from "@/lib/globe/geo";
import styles from "./Footer.module.css";

/**
 * Calm, paper-white corporate footer — the one surface where the official
 * logo sits natively on its intended light ground.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`frame ${styles.inner}`}>
        <div className={styles.top}>
          <Link href="/" aria-label="Luna Trading — Home" className={styles.logo} data-cursor="link">
            <LunaLogo height="100%" />
          </Link>
          <p className={styles.statement}>
            Global sourcing, import &amp; export, product and brand development, e-commerce and distribution — from {COMPANY.cityEn}
            <span className={styles.plusInline}>
              <Plus size={10} />
            </span>
            for Europe.
          </p>
        </div>

        <div className={styles.cols}>
          <div>
            <h2 className={`t-label ${styles.h}`}>Company</h2>
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
              {COMPANY.city}, {COMPANY.country}
              {COMPANY.email && (
                <>
                  <br />
                  <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                </>
              )}
            </address>
          </div>
          <nav aria-label="Footer">
            <h2 className={`t-label ${styles.h}`}>Navigate</h2>
            <ul className={styles.list}>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="link-line" data-cursor="link">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className={`t-label ${styles.h}`}>Owned brands</h2>
            <ul className={styles.list}>
              <li>
                <Link href={BRANDS.luviscent.internal} className="link-line" data-cursor="link">
                  {BRANDS.luviscent.name}
                  {BRANDS.luviscent.mark}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={`t-label ${styles.h}`}>Legal</h2>
            <ul className={styles.list}>
              {LEGAL_NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="link-line" data-cursor="link">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className="t-label">© {year} {COMPANY.legalName}</span>
          <span className="t-label t-mono">
            {formatLat(COMPANY.coordinates.lat)} &nbsp;{formatLon(COMPANY.coordinates.lon)}
          </span>
        </div>
      </div>
    </footer>
  );
}
