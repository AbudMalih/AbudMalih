/** Copy for the Leistungen / Services page. */
export type ServiceId = "sourcing" | "trade" | "development" | "brand" | "ecommerce" | "distribution";

export type ServiceChapter = {
  /** short name used on the route ("Import", "Marke") */
  stop: string;
  title: string;
  statement: string;
  body: string;
  focus: string[];
};

export type ServicesCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lead: string; scroll: string };
  /** the seven stops of the route, source → market */
  route: string[];
  model: { tag: string; title: string; intro: string; lines: Record<ServiceId, string>; jump: string };
  chapters: Record<ServiceId, ServiceChapter>;
  sourcing: { spec: string; rows: [string, string][]; origin: string };
  trade: { container: string; document: string; docRows: string[]; market: string };
  development: { process: string[] };
  brand: { positioning: string; axes: [string, string, string, string]; type: string; palette: string; pack: string };
  ecommerce: { flow: string[]; channels: string[]; platforms: string; groups: { store: string; marketplace: string } };
  distribution: { flow: string[]; destinations: string[] };
  payoff: { tag: string; title: string; body: string };
  luviscent: { tag: string; title1: string; title2: string; body: string; cta: string; brands: string };
  cta: { tag: string; h1: string; h2: string; lead: string; button: string; company: string };
};
