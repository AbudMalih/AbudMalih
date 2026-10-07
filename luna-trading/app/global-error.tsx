"use client";

/**
 * Last-resort boundary (the root layout itself failed). Minimal, German,
 * self-contained; never shows error details.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#151619", color: "#ecebe6", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ padding: 24, maxWidth: 520 }}>
          <p style={{ color: "#c90216", letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" }}>Luna Trading GmbH</p>
          <h1 style={{ fontSize: 28, margin: "12px 0" }}>Etwas ist schiefgelaufen.</h1>
          <p style={{ color: "#b3b5ba", lineHeight: 1.6 }}>Die Seite konnte nicht geladen werden. Bitte versuchen Sie es erneut.</p>
          <p style={{ marginTop: 24, display: "flex", gap: 24 }}>
            <button type="button" onClick={reset} style={{ background: "none", border: "1px solid #6b6c71", color: "inherit", padding: "10px 16px", cursor: "pointer" }}>
              Erneut versuchen
            </button>
            {/* a full reload is intended here: the app shell itself failed */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "inherit", alignSelf: "center" }}>
              Zur Startseite
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
