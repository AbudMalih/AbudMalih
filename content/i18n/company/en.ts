import type { CompanyCopy } from "./types";

const en: CompanyCopy = {
  meta: {
    title: "Company",
    description:
      "Luna Trading GmbH in Cologne connects international trade with product development, brand building, e-commerce and distribution.",
  },
  hero: {
    eyebrow: "Company",
    h1a: "Trade connects.",
    h1b: "We build on it.",
    lead: "Luna Trading GmbH connects international trade with product development, brand building, e-commerce and distribution. Based in Cologne, oriented towards the European market.",
    layers: ["Trade", "Product", "Brand", "E-commerce", "Distribution"],
    base: "Luna Trading GmbH · Cologne",
  },
  profile: {
    tag: "The company",
    name: "Luna Trading GmbH",
    city: "Cologne",
    country: "Germany",
    statement: "A trading company that connects products with markets.",
    body: "Luna Trading is not tied to one product category. The company brings sourcing, product development, brand building and sales together in one shared commercial structure.",
    areasTag: "Orientation",
    areas: ["International trade", "Product development", "Brands", "E-commerce", "Distribution"],
  },
  idea: {
    tag: "The idea",
    title1: "Buying and selling",
    title2: "is no longer enough.",
    body: "Today a product needs more than a supplier and a buyer. It needs a clear specification, an identity, digital channels and reliable distribution. That is why these disciplines sit within one company.",
    before: "Then",
    beforeSteps: ["Buy", "Sell"],
    now: "Now",
    nowSteps: ["Source", "Product", "Identity", "Commerce", "Market"],
    pairs: [
      ["Trade", "Product"],
      ["Product", "Brand"],
      ["Brand", "E-commerce"],
      ["E-commerce", "Distribution"],
    ],
    final: "Luna Trading",
  },
  principles: {
    tag: "How we work",
    title: "What makes the structure different.",
    items: [
      { title: "One commercial view of the whole.", body: "Sourcing, product, brand and sales are assessed together, not one after another." },
      { title: "Designed from the product. Tested against the market.", body: "What a product requires and what its market requires belong at the same table." },
      { title: "Physical and digital.", body: "Goods move in the real world, and more and more of them are sold digitally. We work in both." },
      { title: "Build what the market can support.", body: "Ranges and brands grow at the pace that demand and structure allow." },
    ],
  },
  pd: {
    tag: "Physical + Digital",
    title1: "Two worlds.",
    title2: "One connection.",
    lead: "Not a traditional wholesaler. Not a pure e-commerce company. Luna Trading connects the physical flow of goods with digital commerce.",
    physical: { name: "Physical trade", items: ["Product", "Packaging", "Container", "Movement", "Distribution"] },
    digital: { name: "Digital commerce", items: ["Online store", "Marketplace", "Data", "Customer", "Commerce"] },
    note: "The same goods. The same responsibility. From the physical flow of goods to the digital market.",
  },
  base: {
    tag: "Location",
    title1: "Cologne.",
    title2: "Germany.",
    body: "Cologne is our base and our point of origin. From here we connect international sourcing with the European market, through cross-border trade, digital channels and distribution structures.",
    rings: [
      { name: "Cologne", note: "Base" },
      { name: "Europe", note: "Market" },
      { name: "International", note: "Sourcing" },
    ],
  },
  standards: {
    tag: "Responsibility",
    title1: "Trade is more",
    title2: "than movement.",
    body: "A product sold in Europe has to be prepared for that market. This work starts long before anything ships.",
    doc: "Market preparation",
    rows: [
      { name: "Product requirements", line: "Material, finish and use clearly defined." },
      { name: "Documentation", line: "Commercial and technical documents complete." },
      { name: "Labelling", line: "Packaging and information suited to the target market." },
      { name: "Market readiness", line: "Market requirements considered before sale." },
      { name: "Commercial structure", line: "Prices, channels and processes in order." },
    ],
  },
  brand: {
    tag: "From company to brand",
    title: "The structure gives rise to brands of its own.",
    chain: ["Luna Trading", "Owned brands"],
    body: "LUVISCENT® is the first owned brand of Luna Trading GmbH: home fragrance, built on the same chain of sourcing, development, brand and commerce.",
    link: "Discover our brands",
  },
  bridges: {
    tag: "Continue",
    what: { kicker: "What we do", label: "Our services" },
    build: { kicker: "What we build", label: "Our brands" },
  },
  facts: {
    tag: "Company information",
    rows: [
      { k: "Company", v: "Luna Trading GmbH" },
      { k: "Based in", v: "Cologne" },
      { k: "Country", v: "Germany" },
      { k: "Coordinates", v: "50.94° N · 6.96° E" },
    ],
    legal: "Legal information in the Impressum",
  },
  direction: {
    tag: "Direction",
    title1: "Built to grow",
    title2: "with what it carries.",
    body: "We are building a commercial platform that can grow with the products and brands it supports. Step by step, carried by the market.",
    lines: ["More products", "More owned brands", "More connected commerce"],
  },
  cta: {
    tag: "Contact",
    h1: "Let’s do",
    h2: "business.",
    lead: "Whether you are a manufacturer, supplier or trading partner: let’s talk about products, markets and new opportunities.",
    button: "Get in touch",
    more: "Our services",
  },
};

export default en;
