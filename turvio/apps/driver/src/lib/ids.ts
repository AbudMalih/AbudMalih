import * as Crypto from "expo-crypto";

/** RFC-4122 v4 id. Client-generated ids make offline creation idempotent on the server. */
export function uuid(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Fallback (tests / old runtimes): still v4-shaped, from Math.random.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
