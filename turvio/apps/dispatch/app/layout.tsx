import "@turvio/web-ui/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "TURVIO Dispatch",
  description: "Smart Routes. Simple Deliveries.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
