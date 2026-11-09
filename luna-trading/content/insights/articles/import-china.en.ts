import type { ArticleText } from "../types";
import { importChinaSources } from "./import-china.sources";

/**
 * English translation of "Import aus China nach Deutschland" (German
 * original in import-china.ts). Same facts, same review date, same sources.
 */
export const importChinaEn: ArticleText = {
  slug: "importing-from-china-to-germany",
  title: "Importing from China to Germany: Process, Costs and Documents",
  seoTitle: "Import from China: Process, Costs & Documents",
  description:
    "Importing from China to Germany step by step: suppliers, Incoterms, transport, customs, EORI, import VAT, product compliance and costs explained.",
  lead: "Importing goods from China combines purchasing, logistics, customs, tax and product law. This guide walks through the process up to goods that are ready for sale in Germany, explains the key obligations and lists the cost components that belong in every calculation.",
  keyPoints: [
    "Before the first import, your company needs an EORI number. It is free of charge, and since 1 October 2026 it is generally applied for through the German customs portal (Zoll-Portal).",
    "Customs duty and import VAT depend on the tariff classification of the goods and their customs value. Goods from China are usually subject to the normal third-country duty rate, and some goods also to anti-dumping or countervailing duties.",
    "Import VAT in Germany is 19 or 7 percent. Companies entitled to deduct input tax can usually reclaim it as input tax, but they have to pay it first.",
    "Product safety, CE marking, packaging law and product-specific rules are separate obligations. They must be met before the goods are sold.",
    "There are no fixed flat prices for an import. Costs depend on the goods, quantity, mode of transport, delivery terms and timing.",
  ],
  coverAlt:
    "A gantry crane lowers a container onto a truck trailer at a container terminal at dusk.",
  body: [
    { t: "h2", id: "ablauf", text: "The process at a glance" },
    {
      t: "p",
      text: "An import from China almost always follows the same steps. The order matters, because many decisions at the start determine costs and risks at the end.",
    },
    {
      t: "ol",
      items: [
        "Define the product and its requirements: specification, quality, quantity, packaging and the rules that apply to the product in the EU.",
        "Clarify classification and charges: tariff number, duty rate, possible anti-dumping or countervailing duties and import VAT.",
        "Find and check suppliers: compare offers, test samples, verify the company and its documents.",
        "Agree the contract and delivery terms: price, payment terms, quality criteria and Incoterms®.",
        "Production and quality control: follow production and inspect the goods before shipment.",
        "Organise transport: sea, rail or air freight, insurance and export clearance in China.",
        "Customs clearance in the EU: customs declaration, payment of duty and import VAT, release of the goods.",
        "Delivery and sale: transport to the warehouse, incoming goods inspection and start of sales.",
      ],
    },
    {
      t: "p",
      text: "How we organise these steps for our clients is shown on our page about [importing from China](/import#ablauf).",
    },

    {
      t: "h2",
      id: "anforderungen",
      text: "Clarify your requirements before you request offers",
    },
    {
      t: "p",
      text: "The most common reason for costly surprises is an unclear starting point. Before you contact suppliers, three questions should be answered.",
    },
    {
      t: "ul",
      items: [
        "What exactly is to be delivered? Material, dimensions, colours, tolerances, packaging and labelling belong in a written specification. It later becomes the basis of every quality check.",
        "Which rules apply to the product? Toys, electrical equipment, radio equipment and food contact materials each have their own EU rules. They determine which test reports and documents the manufacturer has to provide.",
        "How are the goods classified? The tariff number determines the duty rate and whether special measures such as anti-dumping duties apply. If you only clarify it when the goods arrive, you may be calculating with the wrong figures.",
      ],
    },

    { t: "h2", id: "lieferanten", text: "Finding and checking suppliers" },
    {
      t: "p",
      text: "Whether through trade fairs, industry contacts or sourcing platforms: an attractive offer says little about a supplier's reliability. These checks have proven useful.",
    },
    {
      t: "ul",
      items: [
        "Check company details: business licence, registered company name and business scope. Note whether you are dealing with the manufacturer itself or with a trading company.",
        "Order samples and approve them in writing: the approved sample becomes the benchmark for series production.",
        "Request evidence: test reports, conformity documents and material information that match the rules for your product. Check that the reports relate to the specific product and come from a traceable testing body.",
        "Check production and goods: an assessment of the manufacturer before placing the order and an inspection before shipment reduce the risk of paying for defective goods before they leave China.",
        "Conclude clear contracts: specification, quality criteria, delivery date, payment schedule and delivery terms should be agreed in writing.",
      ],
    },

    {
      t: "h2",
      id: "incoterms",
      text: "Incoterms: who pays what, and up to where?",
    },
    {
      t: "p",
      text: "The delivery term in the sales contract sets out which costs the supplier bears, who handles the formalities and when the risk passes to you. The applicable rules are the Incoterms® 2020 of the International Chamber of Commerce (ICC), with eleven rules. They govern neither the transfer of ownership nor payment. Both belong in the sales contract.",
    },
    {
      t: "table",
      caption: "Common terms when importing from China, simplified",
      head: ["Term", "What the supplier does", "What it means for you"],
      rows: [
        [
          "EXW (Ex Works)",
          "Makes the goods available at the factory",
          "You organise everything, including export from China. Usually impractical without a partner on site.",
        ],
        [
          "FCA (Free Carrier)",
          "Hands the goods to your carrier and handles export clearance",
          "You choose the forwarder and main carriage. According to the ICC, the appropriate term for containers and combined transport.",
        ],
        [
          "FOB (Free On Board)",
          "Delivers the goods loaded on board the vessel at the port of shipment, including export clearance",
          "Widely used, but less suitable for containers: the supplier bears the risk until loading, which it cannot influence at the terminal.",
        ],
        [
          "CIF / CIP",
          "Pays freight and insurance to the destination",
          "The risk still passes to you in the country of shipment.",
        ],
        [
          "DAP",
          "Delivers to the agreed place, not cleared for import",
          "You handle customs clearance and import charges.",
        ],
        [
          "DDP",
          "Delivers duty paid and cleared",
          "The supplier also bears the import charges in the EU. Check beforehand whether it can do this legally and in practice.",
        ],
      ],
    },
    {
      t: "p",
      text: "Important for your calculation: only compare offers on the same delivery term. A low ex-works price can end up more expensive than an FCA or FOB offer, because pre-carriage and export clearance in China come on top.",
    },

    { t: "h2", id: "transport", text: "Transport: sea, rail or air" },
    {
      t: "p",
      text: "The right mode of transport depends on the quantity, value, weight and deadline of the goods. The transit times below are non-binding guide values for the main carriage, not promised delivery times. Pre- and on-carriage, clearance, public holidays and port congestion can extend the actual duration considerably.",
    },
    {
      t: "table",
      caption:
        "Typical transit times for the main carriage, non-binding guide values",
      head: ["Mode", "Guide value", "Suitable for"],
      rows: [
        [
          "Sea freight",
          "about 30 to 45 days",
          "Large quantities and plannable goods, as a full container (FCL) or groupage (LCL)",
        ],
        [
          "Rail freight",
          "about 18 to 25 days",
          "Goods with a deadline, faster than sea and cheaper than air",
        ],
        [
          "Air freight",
          "about 3 to 7 days",
          "Samples, urgent orders and high-value, light products",
        ],
      ],
    },
    {
      t: "p",
      text: "Since 2025, the EU Import Control System ICS2 has covered all modes of transport: safety and security data, including a precise description of the goods, is sent to customs before the goods arrive. The carrier is primarily responsible, and in certain cases also the consignee in the EU. Give your forwarder complete and accurate information about the goods, otherwise clearance may be delayed. An overview of the modes of transport is also on our [import page](/import#imp-modes).",
    },

    {
      t: "h2",
      id: "eori",
      text: "Before your first import: the EORI number",
    },
    {
      t: "p",
      text: "Anyone who lodges customs declarations in the EU, or has them lodged, needs an EORI number (Economic Operators' Registration and Identification). It must be applied for in good time before the first activity covered by customs law.",
    },
    {
      t: "ul",
      items: [
        "The number is issued free of charge by the German Federal Customs Directorate General (Generalzolldirektion), Dresden office. Paid third-party services are not needed.",
        "Since 1 October 2026, the German customs portal (Zoll-Portal) has been mandatory for applications, changes and closure. Paper forms are only permitted in the fallback procedure, when the portal is unavailable.",
        "To register on the customs portal, your company needs an ELSTER login option, for example a certificate file. Setting it up can take time, so plan for it early.",
      ],
    },

    { t: "h2", id: "zollanmeldung", text: "The customs declaration" },
    {
      t: "p",
      text: "In Germany, customs declarations are lodged electronically through the ATLAS IT system. Most importers instruct a forwarder or customs service provider to do this. There are two forms of representation.",
    },
    {
      t: "ul",
      items: [
        "Direct representation: the service provider acts in your name and on your behalf. It needs a power of representation to do so.",
        "Indirect representation: the service provider acts in its own name but on your behalf. It is then itself held liable as declarant for the import charges and must keep the import documents available for audits.",
      ],
    },
    {
      t: "p",
      text: "In every case, the information about the goods must be correct. The most important item is the tariff number. Duty rates and special measures can be found in the German Electronic Customs Tariff (EZT-online) and in the EU's TARIC database. If the classification is unclear, you can apply to customs for Binding Tariff Information (BTI, German: vZTA). It is valid for three years and gives certainty for future imports, not for past ones.",
    },

    {
      t: "h2",
      id: "abgaben",
      text: "Calculating customs duty and import VAT",
    },
    { t: "h3", text: "The customs value" },
    {
      t: "p",
      text: "Customs duty is calculated on the customs value. In most cases this is the price paid or payable for the goods, plus the transport and insurance costs up to the place where the goods enter the EU. Transport costs within the EU are not included. For air freight, only a flat share of the freight costs is included, depending on the departure zone. If invoices and freight invoices show the sections clearly, the customs value can be documented cleanly.",
    },
    { t: "h3", text: "The duty rate" },
    {
      t: "p",
      text: "China was removed from the EU's Generalised Scheme of Preferences on 1 January 2015. Goods originating in China are therefore usually subject to the normal third-country duty rate, which varies widely by product. Some goods are also subject to anti-dumping or countervailing duties, in some cases at different rates per manufacturer. One example is electric bicycles from China: in January 2025 the EU extended the measures introduced in 2019 by five years. Always check the measures for your tariff number in TARIC before you order.",
    },
    {
      t: "note",
      title: "Since 1 July 2026: no more duty exemption up to EUR 150",
      text: "The former relief from import duties for consignments with a total value of up to EUR 150 was abolished with effect from 1 July 2026 (Regulation (EU) 2026/382). As a transitional measure from 1 July 2026 to 1 July 2028, a flat duty of EUR 3 per item applies instead to consignments with an intrinsic value of no more than EUR 150, but only under one of two conditions: the import is exempt from import VAT under the Import One-Stop Shop (IOSS), or the goods are contained in a postal consignment as defined in customs law. For the latter, according to German customs, what matters is that the goods are distance sales. German customs charges the EUR 3 per product category, that is, per item line of the customs declaration. Since 1 November 2026, a Union handling fee of EUR 2 per product category has also applied to distance-sale consignments. Commercial imports for your company are not covered by this flat rate and are cleared at the regular duty rate.",
    },
    { t: "h3", text: "Import VAT" },
    {
      t: "p",
      text: "In addition, customs collects import VAT (Einfuhrumsatzsteuer, EUSt). In Germany it is 19 percent or, for goods eligible for the reduced rate, 7 percent. The taxable amount is in principle the customs value, plus customs duty and other charges and the transport costs from the EU border to the first place of destination in the EU.",
    },
    {
      t: "p",
      text: "A worked example published by German customs shows how it works. The duty rate of 2 percent in it is fictitious.",
    },
    {
      t: "table",
      caption:
        "Worked example based on German customs (Zoll online), simplified. It does not replace a calculation for your goods.",
      head: ["Item", "Amount"],
      rows: [
        ["Ex-works invoice price", "€10,000.00"],
        ["+ Freight to Rotterdam", "€1,200.00"],
        ["= Customs value", "€11,200.00"],
        ["Customs duty (fictitious rate 2%)", "€224.00"],
        ["+ Transport from Rotterdam to Berlin", "€300.00"],
        ["= Taxable amount for import VAT", "€11,724.00"],
        ["Import VAT (19%)", "€2,227.56"],
      ],
    },
    {
      t: "p",
      text: "Companies entitled to deduct input tax can claim import VAT on goods imported for their business as input tax. The evidence is the import duty assessment notice. Until it is offset, however, the money is tied up. If customs has approved deferred payment, import VAT is only due on the 26th of the second month after the month of import. Whether a deferment account of your own is worthwhile depends on your import volume.",
    },

    {
      t: "h2",
      id: "produktpflichten",
      text: "Product obligations: what must be in place before sale",
    },
    {
      t: "p",
      text: "By importing, you often become the first party responsible for the product in the EU. The following obligations are separate from each other. Which of them apply depends on the goods and on the customer.",
    },
    { t: "h3", text: "General product safety (GPSR)" },
    {
      t: "p",
      text: "Since 13 December 2024, Regulation (EU) 2023/988 on general product safety (GPSR) has applied. It covers products intended for consumers or likely to be used by consumers, and works as a safety net: where EU law sets specific safety requirements for a product, the GPSR only applies to the aspects and risks not covered there.",
    },
    {
      t: "p",
      text: "For consumer products without specific EU harmonisation legislation, importers must, under Article 11 GPSR, among other things:",
    },
    {
      t: "ul",
      items: [
        "ensure before placing the product on the market that it is safe and that the manufacturer has drawn up technical documentation and marked the product and its contact details,",
        "state their name, registered trade name or registered trade mark and their postal and e-mail address on the product or, where that is not possible, on the packaging or in an accompanying document,",
        "include clear instructions and safety information in a language easily understood by consumers, as determined by the Member State concerned,",
        "keep a copy of the technical documentation available to market surveillance authorities for ten years,",
        "for a dangerous product, ensure corrective action without delay and inform the authorities through the Safety Business Gateway.",
      ],
    },
    {
      t: "p",
      text: "For all consumer products, including those with CE marking, the following also applies: anyone offering them online must state in the offer, among other things, the manufacturer, where applicable the responsible person in the EU, information identifying the product including a picture, and any warnings.",
    },
    { t: "h3", text: "CE marking" },
    {
      t: "p",
      text: "CE marking is not a general obligation. It applies only to products covered by certain EU harmonisation legislation, for example toys, many electrical products or radio equipment. For these products, the importer's obligations follow from the specific legislation instead of Article 11 GPSR. They follow a uniform EU model: before placing the product on the market, importers must ensure that the manufacturer has carried out the conformity assessment and drawn up the technical documentation, that the product bears the CE marking and that the required documents are enclosed. Here too, importers state their name and contact address on the product, or alternatively on the packaging or accompanying documents, and keep a copy of the declaration of conformity available to market surveillance.",
    },
    { t: "h3", text: "Packaging" },
    {
      t: "p",
      text: "Since 12 August 2026, the EU Packaging and Packaging Waste Regulation (PPWR) and the German Packaging Law Implementation Act (VerpackDG) have applied. They replaced the former German Packaging Act. For packaging in Germany, the responsible producer is usually the first company in the domestic supply chain. A company that has products made under its own brand is itself the producer under the brand principle. Producers must be registered in the LUCID packaging register, and for certain packaging, system participation and volume reporting are also required.",
    },
    { t: "h3", text: "Product-specific rules" },
    {
      t: "ul",
      items: [
        "Electrical and electronic equipment: anyone who first offers equipment from a third country in Germany is a producer under the German ElektroG and must register with stiftung ear before placing it on the market. Batteries have their own registration obligations, also with stiftung ear.",
        "Carbon Border Adjustment Mechanism (CBAM): for goods from the cement, iron and steel, aluminium, fertiliser, electricity and hydrogen sectors, the definitive period has applied since 1 January 2026. An importer who imports no more than 50 tonnes net mass of such goods in total in a calendar year, counted across all covered tariff numbers, is exempt from the obligations. This exemption does not apply to electricity and hydrogen. An importer who exceeds the threshold is subject to the obligations for all CBAM goods imported that year and may only import them as an authorised CBAM declarant. The first CBAM declaration, with the surrender of certificates for 2026, is due by 30 September 2027.",
        "Deforestation-free supply chains (EUDR): for cattle, cocoa, coffee, oil palm, rubber, soya and wood and certain products made from them, listed in Annex I of Regulation (EU) 2023/1115, due diligence obligations apply from 30 December 2026. The due diligence statement is submitted by the company that first places a product on the EU market. Micro and small enterprises established as such on 31 December 2024 only have to comply from 30 June 2027, except for wood products already covered by the EU Timber Regulation.",
        "Other rules: depending on the product, for example restrictions on chemicals or special requirements for food contact materials may also apply.",
      ],
    },
    {
      t: "p",
      text: "If the competent authorities find at import that documents or markings are missing or that a product presents a risk, they suspend the release of the goods. Product obligations therefore belong at the start of the project, not at the end.",
    },

    { t: "h2", id: "dokumente", text: "The key documents" },
    {
      t: "table",
      head: ["Document", "What it is for"],
      rows: [
        [
          "Commercial invoice",
          "The basis on which the customs value is declared. It should state the seller, buyer, description of the goods, quantity, price, currency and delivery term.",
        ],
        [
          "Customs value declaration",
          "Information that affects the customs value. Customs may waive it, for example if the customs value does not exceed EUR 20,000 per consignment.",
        ],
        [
          "Packing list",
          "Contents, weight and dimensions of each package. Important for transport, inspection and receipt of goods.",
        ],
        [
          "Transport document",
          "Bill of lading for sea freight, air waybill for air freight, consignment note for rail freight.",
        ],
        [
          "Proof of origin",
          "There is no preferential duty for goods from China. Proof of origin may still be needed, for example in connection with anti-dumping measures.",
        ],
        [
          "Conformity documents",
          "Declaration of conformity, test reports and technical documentation, where required for the product.",
        ],
        [
          "Power of representation",
          "For the customs declaration by a service provider in direct representation.",
        ],
        [
          "Payment and freight records",
          "Prove the price paid and the transport costs if customs requests evidence.",
        ],
      ],
    },
    {
      t: "p",
      text: "All documents required for the customs procedure must be available when the customs declaration is lodged and must be presented on request, even if ATLAS does not request them automatically.",
    },

    { t: "h2", id: "kosten", text: "Calculating costs realistically" },
    {
      t: "p",
      text: "There are no reliable flat prices for an import from China. What a shipment costs results from many individual items. Some are fixed in advance, others change with the market, the season and the course of the shipment. This overview helps you not to miss any item.",
    },
    {
      t: "table",
      caption: "Cost components and what they depend on",
      head: ["Cost component", "What it depends on"],
      rows: [
        [
          "Price of the goods",
          "Quantity, specification, material and negotiation",
        ],
        [
          "Samples and testing",
          "Type of product, number of samples, required test reports",
        ],
        [
          "Quality control before shipment",
          "Scope of the inspection and place of production",
        ],
        [
          "Pre-carriage and export in China",
          "Delivery term and distance to the port or terminal",
        ],
        [
          "Main carriage (sea, rail, air)",
          "Mode of transport, volume, weight and current market prices",
        ],
        ["Transport insurance", "Value of the goods and scope of cover"],
        ["Port and terminal charges", "Port, container type and dwell time"],
        [
          "Customs clearance by a service provider",
          "Number of item lines and effort of the declaration",
        ],
        [
          "Customs duty",
          "Tariff number, customs value, possible anti-dumping or countervailing duties",
        ],
        [
          "Import VAT",
          "Customs value, duty and transport costs. Usually deductible as input tax, but payable first",
        ],
        ["On-carriage to the warehouse", "Distance and type of delivery"],
        [
          "Storage and container demurrage",
          "Delays in clearance or collection",
        ],
        [
          "Registrations and licences",
          "Type of product, for example packaging, electrical equipment or batteries",
        ],
        [
          "Exchange rate and payments",
          "Currency, payment terms and bank charges",
        ],
      ],
    },
    {
      t: "p",
      text: "Also plan a buffer for delays. Waiting times at the port quickly cause extra costs. For an assessment of your specific shipment, use our [quote request form](/quote).",
    },

    {
      t: "h2",
      id: "fehler",
      text: "Common mistakes and how to avoid them",
    },
    {
      t: "ul",
      items: [
        "The tariff number is clarified too late. The calculation may then be wrong, and anti-dumping duties only become apparent at import.",
        "Offers are compared on different delivery terms. Convert all offers to the same basis.",
        "Product obligations are only checked after arrival. If documents, markings or registrations are missing, the goods may be held or may not be sold.",
        "The specification is only agreed verbally. Without written requirements and an approved sample, defects are hard to enforce.",
        "The invoice value is understated. An incorrect customs value leads to additional demands and trouble in later audits.",
        "Import VAT is missing from the cash flow plan. Even if it comes back as input tax, it has to be paid first.",
        "There is no time buffer. Public holidays in China, port congestion and inspections extend delivery times.",
      ],
    },

    { t: "h2", id: "fazit", text: "Conclusion" },
    {
      t: "p",
      text: "An import from China can be planned well if the basics come first: a clear specification, the correct tariff number, checked suppliers, suitable delivery terms and product obligations that are met. Clarifying these points before the first order makes your calculation more reliable and avoids most costly surprises.",
    },
    {
      t: "p",
      text: "Luna Trading supports companies from finding suppliers through quality control and transport to customs clearance. You can see which services we offer under [What we do](/what-we-do).",
    },
  ],
  sources: importChinaSources("en"),
};
