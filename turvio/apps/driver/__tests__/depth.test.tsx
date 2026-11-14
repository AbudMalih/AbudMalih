/**
 * Android rendering regression guard for gradient buttons/cards (TURVIO NEXT).
 * Android's `elevation` ignores shadowOpacity/Radius/Offset, paints the shadow in `shadowColor` at full
 * strength and shows it through transparent views – which produced violet blocks/extensions around
 * gradient buttons. All depth now goes through glow()/lift() in theme.ts.
 */
import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { Button, HeroAction } from "../src/components/ui";
import { glow, lift } from "../src/theme";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// Node built-ins via jest's require (the app's tsconfig has no Node types).
declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync, readdirSync, statSync } = require("fs") as { readFileSync: (p: string, e: string) => string; readdirSync: (p: string) => string[]; statSync: (p: string) => { isDirectory(): boolean } };
const { join } = require("path") as { join: (...p: string[]) => string };
const SRC = join(__dirname, "..", "src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));

function asPlatform(os: "android" | "ios", fn: () => void | Promise<void>) {
  const original = Platform.OS;
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  return Promise.resolve(fn()).finally(() => Object.defineProperty(Platform, "OS", { configurable: true, get: () => original }));
}

const flat = (testID: string) => {
  const node = screen.getByTestId(testID);
  const style = typeof node.props.style === "function" ? node.props.style({ pressed: false }) : node.props.style;
  return StyleSheet.flatten(style) as Record<string, unknown>;
};

describe("depth effects", () => {
  it("only theme.ts defines shadows or elevation, and no SVG RadialGradient is used", () => {
    for (const f of files(SRC)) {
      if (f.endsWith("theme.ts")) continue;
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect({ f, hit: /\b(elevation|shadowColor|shadowOpacity|shadowRadius)\s*:/.test(code) }).toEqual({ f, hit: false });
      expect({ f, hit: /RadialGradient/.test(code) }).toEqual({ f, hit: false });
    }
  });

  it("glow is iOS/web only; lift uses elevation on Android only for opaque surfaces", async () => {
    await asPlatform("android", () => {
      expect(glow("#6F55FF")).toEqual({});
      expect(lift(2, { opaque: false })).toEqual({});
      expect(lift(2, { opaque: true })).toEqual({ elevation: 4 });
    });
    await asPlatform("ios", () => {
      expect(glow("#6F55FF")).toMatchObject({ shadowColor: "#6F55FF", shadowOpacity: 0.45 });
      expect(lift(2, { opaque: false }).elevation).toBeUndefined();
    });
  });

  it.each(["primary", "success"] as const)("gradient %s button on Android: opaque rounded base, no border, no elevation or coloured shadow", async (variant) => {
    await asPlatform("android", async () => {
      await render(<Button label="Start tour" variant={variant} size="lg" onPress={() => {}} testID="b" />);
      const st = flat("b");
      expect(st.elevation).toBeUndefined();
      expect(st.shadowColor).toBeUndefined();
      expect(st.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i); // opaque, matches the gradient
      expect(st.borderWidth).toBe(0);
      expect(st.overflow).toBe("hidden");
      expect(st.borderRadius).toBe(18);
    });
  });

  it("hero action on Android has the same safe surface; iOS keeps the violet glow", async () => {
    await asPlatform("android", async () => {
      await render(<HeroAction title="Scan" icon="scan" tone="primary" onPress={() => {}} testID="h" />);
      const st = flat("h");
      expect(st.elevation).toBeUndefined();
      expect(st.borderWidth).toBe(0);
      expect(st.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
    });
    await asPlatform("ios", async () => {
      await render(<HeroAction title="Scan" icon="scan" tone="primary" onPress={() => {}} testID="h2" />);
      expect(flat("h2").shadowColor).toBe("#6F55FF");
    });
  });
});

describe("Android: one solid background per surface (no SVG gradient layers)", () => {
  // Lazy imports so the Platform override applies to module-level code too.
  const json = (r: { toJSON: () => unknown }) => JSON.stringify(r.toJSON());
  type Node = { type: string; props: Record<string, unknown>; children?: (Node | string)[] | null };
  const walk = (n: Node | string | null | undefined, fn: (n: Node) => void) => {
    if (!n || typeof n === "string") return;
    fn(n);
    for (const ch of n.children ?? []) walk(ch, fn);
  };

  it("GradientFill renders nothing on Android and the gradient on iOS", async () => {
    const { GradientFill, GRADIENTS } = require("../src/components/ui");
    await asPlatform("android", async () => {
      const r = await render(<GradientFill colors={GRADIENTS.violet} radius={18} />);
      expect(r.toJSON()).toBeNull();
    });
    await asPlatform("ios", async () => {
      const r = await render(<GradientFill colors={GRADIENTS.violet} radius={18} />);
      expect(json(r)).toMatch(/RNSVG/);
    });
  });

  it.each(["primary", "success"] as const)("%s button on Android is a single solid view with no SVG", async (variant) => {
    await asPlatform("android", async () => {
      const r = await render(<Button label="Start tour" variant={variant} size="lg" onPress={() => {}} testID="b" />);
      expect(json(r)).not.toMatch(/RNSVG/);
      expect(flat("b").backgroundColor).toBe(variant === "primary" ? "#6F55FF" : "#2CD9A0");
    });
  });

  it("Today on Android: route card, Start tour and Scan parcels have no SVG or overlay layers", async () => {
    const { useTourStore } = require("../src/store/tourStore");
    const { DARK, LIGHT } = require("../src/theme");
    await asPlatform("android", async () => {
      useTourStore.getState().resetData();
      useTourStore.getState().setLocale("en");
      const HomeScreen = require("../src/app/(tabs)/index").default;
      const r = await render(<HomeScreen />);
      expect(json(r)).not.toMatch(/RNSVG/);
      const hero = StyleSheet.flatten(r.getByTestId("active-tour").props.style) as Record<string, unknown>;
      expect([DARK.heroSolid, LIGHT.heroSolid]).toContain(hero.backgroundColor);
      // No absolutely positioned layer anywhere on Today (each surface paints exactly one background).
      walk(r.toJSON() as Node, (n) => {
        const st = StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;
        expect({ testID: n.props.testID, position: st?.position }).not.toEqual(expect.objectContaining({ position: "absolute" }));
      });
      for (const tile of r.getAllByTestId("hero-stat")) {
        const st = StyleSheet.flatten(tile.props.style) as Record<string, unknown>;
        expect(st.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });
});

describe("app-wide guard: gradients only through the Android-safe path", () => {
  const sources = files(SRC).map((f) => ({ f, code: readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "") }));

  it("SVG gradients exist only in the shared GradientLayer and the iOS branch of the route card", () => {
    const using = sources.filter((s) => /\bLinearGradient\b|\bRadialGradient\b/.test(s.code)).map((s) => s.f.replace(SRC, "src"));
    expect(using.sort()).toEqual(["src/app/(tabs)/index.tsx", "src/components/ui.tsx"]);
    const index = sources.find((s) => s.f.endsWith("(tabs)/index.tsx"))!.code;
    // The route card returns its solid Android version before any SVG is created.
    expect(index.indexOf("if (solidSurfaces())")).toBeGreaterThan(-1);
    expect(index.indexOf("if (solidSurfaces())")).toBeLessThan(index.indexOf("<Svg"));
  });

  it("every view that hosts a GradientFill also takes the solid gradientSurface() background", () => {
    for (const s of sources) {
      const fills = (s.code.match(/<GradientFill\b/g) ?? []).length;
      if (!fills || s.f.endsWith("components/ui.tsx")) continue;
      expect({ f: s.f, surfaces: (s.code.match(/gradientSurface\(/g) ?? []).length >= fills }).toEqual({ f: s.f, surfaces: true });
    }
    const ui = sources.find((s) => s.f.endsWith("components/ui.tsx"))!.code;
    expect((ui.match(/<GradientFill\b/g) ?? []).length).toBe((ui.match(/gradientSurface\(v\.gradient|gradientSurface\(GRADIENTS/g) ?? []).length);
  });
});
