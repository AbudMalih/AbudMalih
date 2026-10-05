import type { BrandMedia } from "@/components/ui/BrandMediaSlot";
import { BRANDS } from "@/content/site";

/**
 * Owned brands of Luna Trading GmbH, in page order. The Marken page renders
 * one chapter per entry (passage in, brand scene, brand world, passage out),
 * so a further brand is added here (plus its copy under
 * content/i18n/brands/*.ts → brands[id]) without redesigning the page.
 * Only real brands belong here: no placeholders, no announced slots.
 */
/** An approved product image, filed under one of the brand's categories. */
export type BrandProduct = { id: string; category: string; src: string; width: number; height: number; tone: "dark" | "light" };

export type OwnedBrand = {
  id: string;
  /** official name and mark, never restyled */
  name: string;
  mark: string;
  /** official claim and its language (kept unchanged in every locale) */
  claim: string;
  claimLang: string;
  /** external brand site once live; otherwise the page links to the brand world */
  url: string | null;
  /** the brand's own ground: the passage blends Luna mineral into these */
  palette: { ground: string; deep: string; world: string; light: string; accent: string; ink: string };
  /** approved product photography; the hero stands in the lit niche */
  media: { hero: BrandMedia | null; products: BrandProduct[] };
};

export const OWNED_BRANDS: OwnedBrand[] = [
  {
    id: "luviscent",
    name: BRANDS.luviscent.name,
    mark: BRANDS.luviscent.mark,
    claim: BRANDS.luviscent.claim,
    claimLang: "de",
    url: BRANDS.luviscent.url,
    palette: {
      ground: "#0a1b15",
      deep: "#05110d",
      world: "#0d221b",
      light: "#e8dcc0",
      accent: "#d4c19b",
      ink: "#f1ece2",
    },
    media: {
      hero: { type: "image", src: "/brand/luviscent/diffuser-tower.webp", alt: "LUVISCENT", width: 778, height: 1400 },
      products: [
        { id: "box", category: "machines", src: "/brand/luviscent/diffuser-box.webp", width: 1124, height: 945, tone: "dark" },
        { id: "lamp", category: "machines", src: "/brand/luviscent/diffuser-lamp.webp", width: 1185, height: 1171, tone: "light" },
        { id: "ribbed", category: "machines", src: "/brand/luviscent/diffuser-ribbed.webp", width: 328, height: 882, tone: "light" },
        { id: "cylinder", category: "machines", src: "/brand/luviscent/diffuser-cylinder.webp", width: 281, height: 536, tone: "dark" },
      ],
    },
  },
];
