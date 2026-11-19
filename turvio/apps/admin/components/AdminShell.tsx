"use client";

import { AppShell, MenuItem, MenuLabel, MenuSeparator, useThemePreference, type NavGroup, type ThemePreference } from "@turvio/web-ui/ds";
import { Building2, Check, CreditCard, LayoutGrid, ScrollText, Server, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { api, savePreferences } from "../lib/api";
import { EN_T, LOCALE_NAMES, LOCALES, isLocale, type Locale, type MessageKey, type TFunction } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { signOut, useAdminSession } from "../lib/session";

/*
 * Navigation follows the approved Admin prototype (design/next/admin), limited to what TURVIO Admin
 * really is: platform administration. Every entry is its own route, rendered inside this shell
 * (mounted once in app/(app)/layout.tsx) and reached by client-side navigation.
 */
const NAV: { group: MessageKey; items: { href: string; label: MessageKey; icon: NavGroup["items"][number]["icon"]; shortcut: string }[] }[] = [
  { group: "shell.group.operations", items: [{ href: "/", label: "shell.nav.overview", icon: LayoutGrid, shortcut: "1" }] },
  {
    group: "shell.group.management",
    items: [
      { href: "/companies", label: "shell.nav.companies", icon: Building2, shortcut: "2" },
      { href: "/plans", label: "shell.nav.plans", icon: CreditCard, shortcut: "3" },
    ],
  },
  {
    group: "shell.group.platform",
    items: [
      { href: "/system", label: "shell.nav.system", icon: Server, shortcut: "4" },
      { href: "/activity", label: "shell.nav.audit", icon: ScrollText, shortcut: "5" },
      { href: "/admins", label: "shell.nav.admins", icon: ShieldCheck, shortcut: "6" },
    ],
  },
];

export function navGroups(t: TFunction = EN_T): NavGroup[] {
  return NAV.map((g) => ({ label: t(g.group), items: g.items.map((i) => ({ href: i.href, label: t(i.label), icon: i.icon, shortcut: i.shortcut })) }));
}
/** English navigation (tests). */
export const GROUPS: NavGroup[] = navGroups();
const ROUTES = NAV.flatMap((g) => g.items);

const NextLink = ({ children, ...p }: { href: string; className?: string; onClick?: () => void; "aria-current"?: "page"; children: ReactNode }) => (
  <Link {...p} prefetch>
    {children}
  </Link>
);

/**
 * Appearance and language in the account menu. Appearance follows every other theme control (the
 * header switch included); both choices are saved on the account (best effort, shared with Dispatch).
 */
export function AccountChoices() {
  const { t, locale, setLocale } = useI18n();
  const [pref, setPref] = useThemePreference("dark");
  const themes: [ThemePreference, MessageKey][] = [
    ["system", "shell.theme.system"],
    ["light", "shell.theme.light"],
    ["dark", "shell.theme.dark"],
  ];
  const pickLocale = (l: Locale) => {
    if (l === locale) return;
    setLocale(l);
    void savePreferences({ language: l });
  };
  return (
    <>
      <MenuSeparator />
      <MenuLabel>{t("shell.appearance")}</MenuLabel>
      {themes.map(([c, label]) => (
        <MenuItem
          key={c}
          onSelect={(e) => {
            e.preventDefault();
            setPref(c);
            void savePreferences({ theme: c });
          }}
          icon={pref === c ? <Check /> : <span className="size-4" />}
          aria-checked={pref === c}
          role="menuitemradio"
        >
          {t(label)}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuLabel>{t("shell.language")}</MenuLabel>
      {LOCALES.map((l) => (
        <MenuItem key={l} onSelect={(e) => (e.preventDefault(), pickLocale(l))} icon={l === locale ? <Check /> : <span className="size-4" />} aria-checked={l === locale} role="menuitemradio">
          <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>
            {LOCALE_NAMES[l]}
          </span>
        </MenuItem>
      ))}
    </>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const session = useAdminSession();
  const { t, locale, setLocale } = useI18n();
  const groups = useMemo(() => navGroups(t), [t]);

  // Warm every route once, so the first switch is as fast as the next ones.
  useEffect(() => {
    for (const r of ROUTES) router.prefetch(r.href);
  }, [router]);

  // A language saved on the account (e.g. chosen in Dispatch) wins over this browser's cookie.
  useEffect(() => {
    api<{ language: string | null }>("GET", "/v1/me/preferences")
      .then((p) => {
        if (isLocale(p?.language) && p.language !== locale) setLocale(p.language);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: 1–6 switch pages (ignored while typing or with modifiers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(el.tagName)))) return;
      const r = ROUTES.find((x) => x.shortcut === e.key);
      if (r && r.href !== pathname) router.push(r.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return (
    <AppShell
      product={t("shell.product")}
      productShort={t("shell.productShort")}
      groups={groups}
      current={pathname}
      user={{ name: session.name, email: session.email, role: t("shell.role") }}
      environment={session.environment ?? undefined}
      onSignOut={() => void signOut()}
      navigate={(href) => router.push(href)}
      linkComponent={NextLink}
      onThemeChange={(theme) => void savePreferences({ theme })}
      userMenuExtra={<AccountChoices />}
    >
      {children}
    </AppShell>
  );
}
