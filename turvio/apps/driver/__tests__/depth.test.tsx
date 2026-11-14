/**
 * Android rendering regression guard for gradient buttons/cards (TURVIO NEXT).
 * Android's `elevation` ignores shadowOpacity/Radius/Offset, paints the shadow in `shadowColor` at full
 * strength and shows it through transparent views – which produced violet blocks/extensions around
 * gradient buttons. All depth now goes through glow()/lift() in theme.ts.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { Button, HeroAction } from "../src/components/ui";
import { glow, lift } from "../src/theme";

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
