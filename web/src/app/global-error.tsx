"use client";

/** Last-resort fallback if the root layout itself fails. Plain, self-contained markup. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0b0c0e", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", display: "flex", alignItems: "center" }}>
        <main style={{ padding: "0 24px", maxWidth: 720, margin: "0 auto" }}>
          <p style={{ color: "#f0080f", fontWeight: 700, letterSpacing: 2 }}>{"// JARBOU"}</p>
          <h1 style={{ fontSize: 44, lineHeight: 1, textTransform: "uppercase", margin: "16px 0" }}>Hier ist etwas schiefgelaufen.</h1>
          <p style={{ color: "#bfc3c8", fontSize: 18, lineHeight: 1.5 }}>Bitte laden Sie die Seite neu oder versuchen Sie es in einigen Minuten erneut.</p>
          <button type="button" onClick={reset} style={{ marginTop: 24, minHeight: 48, padding: "0 24px", background: "#e3070e", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" }}>
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  );
}
