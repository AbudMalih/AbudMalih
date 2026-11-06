/**
 * Items shared into TURVIO from other apps (WhatsApp, Gallery, Messages …).
 * Phase B connects this to the native share handling; until then nothing is shared.
 */
export type SharedItem = { kind: "image"; uri: string } | { kind: "text"; text: string };

export async function consumeSharedItems(): Promise<SharedItem[]> {
  return [];
}
