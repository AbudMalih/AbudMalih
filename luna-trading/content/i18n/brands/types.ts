/** Copy for the owned-brand chapter of one brand (keyed by brand id). */
export type OwnedBrandCopy = {
  owner: string; // "Eigenmarke der Luna Trading GmbH"
  category: string; // "Raumduft"
  statement: string;
  cta: string;
  /** product-world area: categories only, never invented products */
  world: {
    tag: string;
    title1: string;
    title2: string;
    intro: string;
    categories: { id: string; name: string; note: string }[];
    collection: string; // label above the category that has products
    areas: string; // label for the list of brand areas
    productAlt: string; // alt text prefix for product images
  };
};

export type BrandsCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lead: string; luna: string; brand: string };
  principle: {
    tag: string;
    title1: string;
    title2: string;
    pillars: { name: string; line: string }[];
    foundation: string;
    services: string[];
  };
  /** captions for the passage between Luna Trading and a brand world */
  passage: { from: string; to: string; back: string };
  brands: Record<string, OwnedBrandCopy>;
  system: { tag: string; title1: string; title2: string; body: string; link: string };
  cta: { tag: string; h1: string; h2: string; lead: string; button: string; company: string };
};
