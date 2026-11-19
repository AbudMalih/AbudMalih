import { THEME_KEY, applyThemePreference, readThemePreference, useThemePreference } from "@turvio/web-ui/ds";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** One theme preference for every control on the page (header switch, Settings, Admin menu). */
function Probe() {
  const [pref] = useThemePreference();
  return <span data-testid="pref">{pref}</span>;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("light"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

describe("theme preference", () => {
  it("applies and stores light, dark and follow-system", () => {
    applyThemePreference("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    applyThemePreference("system"); // the stubbed system prefers light
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(readThemePreference()).toBe("system");
    applyThemePreference("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("every control follows a change made elsewhere", () => {
    render(<Probe />);
    expect(screen.getByTestId("pref").textContent).toBe("dark");
    act(() => applyThemePreference("system"));
    expect(screen.getByTestId("pref").textContent).toBe("system");
  });
});
