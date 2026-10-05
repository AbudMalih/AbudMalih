export type CompanyCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lead: string; layers: string[]; base: string };
  profile: { tag: string; name: string; city: string; country: string; statement: string; body: string; areasTag: string; areas: string[] };
  idea: {
    tag: string;
    title1: string;
    title2: string;
    body: string;
    before: string;
    beforeSteps: [string, string];
    now: string;
    nowSteps: string[];
    pairs: [string, string][];
    final: string;
  };
  principles: { tag: string; title: string; items: { title: string; body: string }[] };
  pd: {
    tag: string;
    title1: string;
    title2: string;
    lead: string;
    physical: { name: string; items: string[] };
    digital: { name: string; items: string[] };
    note: string;
  };
  base: { tag: string; title1: string; title2: string; body: string; rings: { name: string; note: string }[] };
  standards: { tag: string; title1: string; title2: string; body: string; doc: string; rows: { name: string; line: string }[] };
  brand: { tag: string; title: string; chain: [string, string]; body: string; link: string };
  bridges: { tag: string; what: { kicker: string; label: string }; build: { kicker: string; label: string } };
  facts: { tag: string; rows: { k: string; v: string }[]; legal: string };
  direction: { tag: string; title1: string; title2: string; body: string; lines: string[] };
  cta: { tag: string; h1: string; h2: string; lead: string; button: string; more: string };
};
