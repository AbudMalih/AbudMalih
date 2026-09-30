/** Upload rules shared by the client (FileDrop) and the server (API routes). */
export const FILE_RULES = {
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxFiles: 5,
  /** Extensions → accepted MIME types. */
  types: {
    pdf: ["application/pdf"],
    doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
  } as Record<string, string[]>,
};

export const ACCEPT_ATTR = ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const ACCEPT_LABEL = "PDF, Word, JPG oder PNG · max. 10 MB je Datei";

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Client-side check. Returns a German error or null. */
export function checkFile(file: { name: string; size: number }): string | null {
  if (!FILE_RULES.types[extensionOf(file.name)]) return `„${file.name}“: Dateityp nicht erlaubt (${ACCEPT_LABEL}).`;
  if (file.size > FILE_RULES.maxFileBytes) return `„${file.name}“ ist größer als 10 MB.`;
  if (file.size === 0) return `„${file.name}“ ist leer.`;
  return null;
}

/** Server-side magic-byte check – the extension alone is not trusted. */
export function sniffMatches(ext: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (ext) {
    case "pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
    case "jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "docx":
      return starts(0x50, 0x4b, 0x03, 0x04); // zip container
    case "doc":
      return starts(0xd0, 0xcf, 0x11, 0xe0); // OLE2
    default:
      return false;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
