/** Inline link markup in copy: [words](/canonical-path#anchor). Shared by server and client code. */
export const LINK_TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** The text without link markup (metadata, structured data, aria). */
export const plainText = (text: string) => text.replace(LINK_TOKEN, "$1");
