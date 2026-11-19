import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuContent, MenuTrigger, applyThemePreference } from "@turvio/web-ui/ds";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountChoices } from "../components/AdminShell";
import { I18nRoot } from "../components/I18nRoot";
import { useI18n } from "../lib/i18n/client";
import { mockFetch, path, type Call } from "./fetch";

let lang: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "tv_lang" && lang ? { value: lang } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/" }));
vi.mock("../app/fonts", () => ({ inter: { variable: "f-inter" }, jakarta: { variable: "f-jakarta" }, plexArabic: { variable: "f-plex" } }));
vi.mock("../app/globals.css", () => ({}));

describe("root layout: language and direction from the tv_lang cookie", () => {
  for (const [cookie, l, dir] of [
    [undefined, "en", "ltr"],
    ["de", "de", "ltr"],
    ["ar", "ar", "rtl"],
    ["xx", "en", "ltr"],
  ] as const) {
    it(`${cookie ?? "no cookie"} → lang=${l} dir=${dir}`, async () => {
      lang = cookie;
      const { default: RootLayout } = await import("../app/layout");
      const html = (await RootLayout({ children: null })) as ReactElement<{ lang: string; dir: string }>;
      expect(html.props.lang).toBe(l);
      expect(html.props.dir).toBe(dir);
    });
  }
});

function Probe() {
  const { t } = useI18n();
  return <p>{t("shell.nav.companies")}</p>;
}

let calls: Call[];
beforeEach(() => {
  calls = mockFetch((c) => (path(c) === "/v1/me/preferences" ? { body: {} } : undefined));
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

function menu() {
  return render(
    <I18nRoot locale="en">
      <Probe />
      <Menu>
        <MenuTrigger>account</MenuTrigger>
        <MenuContent>
          <AccountChoices />
        </MenuContent>
      </Menu>
    </I18nRoot>,
  );
}

describe("account menu", () => {
  it("switching to Arabic turns the page right-to-left, sets the cookie and saves the preference", async () => {
    const user = userEvent.setup();
    menu();
    expect(document.documentElement.dir).toBe("ltr");
    await user.click(screen.getByText("account"));
    await user.click(await screen.findByRole("menuitemradio", { name: "العربية" }));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByText("الشركات")).toBeTruthy();
    expect(document.cookie).toContain("tv_lang=ar");
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ language: "ar" }));
  });

  it("the Appearance check mark follows the header theme switch, and a choice is saved", async () => {
    const user = userEvent.setup();
    menu();
    act(() => applyThemePreference("light")); // e.g. the header switch
    await user.click(screen.getByText("account"));
    expect((await screen.findByRole("menuitemradio", { name: "Light" })).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Dark" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("menuitemradio", { name: "Follow system" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ theme: "system" }));
    expect(localStorage.getItem("turvio-theme")).toBe("system");
    expect(screen.getByRole("menuitemradio", { name: "Follow system" }).getAttribute("aria-checked")).toBe("true");
  });
});
