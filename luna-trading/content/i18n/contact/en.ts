import type { ContactCopy } from "./types";

const en: ContactCopy = {
  meta: {
    title: "Contact",
    description:
      "Contact Luna Trading GmbH in Cologne. Email info@luna-trading.de or send us a short inquiry.",
  },
  hero: {
    eyebrow: "Contact",
    h1a: "Let’s talk",
    h1b: "business.",
    lead: "Products, sourcing, brands, e-commerce or trade: let’s talk about what comes next.",
  },
  direct: {
    tag: "Direct",
    title: "Write to us.",
  },
  inquiry: {
    title: "Start a conversation",
    typeLegend: "Topic of your inquiry",
    types: {
      business: "Business & sourcing",
      brand: "Brand & product",
      supplier: "Supplier / manufacturer",
      general: "General inquiry",
    },
  },
  fields: {
    name: "Name",
    company: "Company",
    email: "Email",
    message: "Message",
    optional: "optional",
    required: "required",
  },
  errors: {
    summary: "Please check the highlighted details.",
    required: "Please fill in this field.",
    nameRequired: "Please enter your name.",
    emailRequired: "Please enter your email address.",
    messageRequired: "Please tell us briefly what it is about.",
    email: "Please check the email address.",
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
