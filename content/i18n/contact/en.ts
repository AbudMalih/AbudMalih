import type { ContactCopy } from "./types";

const en: ContactCopy = {
  meta: {
    title: "Contact",
    description:
      "Contact Luna Trading GmbH in Cologne: email info@luna-trading.de or send a short inquiry about trade, sourcing, product development, brands, e-commerce and distribution.",
  },
  hero: {
    eyebrow: "Contact",
    h1a: "Let’s talk",
    h1b: "business.",
    lead: "Products, sourcing, brands, e-commerce or trade: let’s talk about what comes next.",
    you: "Your business",
    luna: "Luna Trading",
  },
  direct: {
    tag: "Direct",
    title: "Write to us.",
    note: "For any inquiry, no form needed.",
    reply: "We will get back to you as soon as possible.",
  },
  inquiry: {
    tag: "Inquiry",
    title: "What is it about?",
    typeLegend: "Topic of your inquiry",
    types: {
      trade: "Trade & sourcing",
      development: "Product development",
      brand: "Brand & private label",
      ecommerce: "E-commerce",
      distribution: "Distribution",
      supplier: "Suppliers & manufacturers",
      general: "General inquiry",
    },
  },
  fields: {
    name: "Name",
    company: "Company",
    email: "Email",
    website: "Website",
    message: "Message",
    optional: "optional",
    required: "required",
    hint: {
      default: "What do you have, what are you looking for, which market is it about?",
      supplier: "A few words on your company, your products and your markets.",
    },
  },
  errors: {
    summary: "Please check the highlighted details.",
    required: "Please fill in this field.",
    nameRequired: "Please enter your name.",
    emailRequired: "Please enter your email address.",
    messageRequired: "Please tell us briefly what it is about.",
    email: "Please check the email address.",
    url: "Please check the website address.",
    long: "This text is too long.",
    short: "Please write a few more words.",
  },
  privacy: {
    text: "We use your details solely to handle your inquiry.",
    link: "Privacy policy",
  },
  submit: { idle: "Send inquiry", sending: "Sending" },
  failure: {
    title: "Your message could not be sent.",
    text: "Please email us directly. Your details remain in the form.",
    retry: "Try again",
    rate: "Too many requests in a short time. Please try again in a few minutes.",
  },
  success: {
    tag: "Inquiry sent",
    h1: "Thank you.",
    h2: "Your message has reached us.",
    text: "We will get back to you as soon as possible.",
    again: "Another inquiry",
  },
  closing: { line: "Cologne · Germany" },
};

export default en;
