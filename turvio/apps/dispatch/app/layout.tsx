import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DispatchShell } from "../components/DispatchShell";
import { getDevSession, loadDispatchData } from "../lib/session";
import { DispatchProvider } from "../lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TURVIO Dispatch", template: "%s · TURVIO Dispatch" },
  description: "Smart Routes. Simple Deliveries.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

// Data is loaded and permission-scoped per request on the server.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const session = getDevSession();
  const base = loadDispatchData(session);
  return (
    <html lang="en" dir="ltr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <DispatchProvider
          base={base}
          session={{
            userName: session.user.name,
            email: session.user.email,
            role: session.membership.role,
            organizationName: session.organizationName,
            companyWide: session.companyWide,
          }}
        >
          <DispatchShell>{children}</DispatchShell>
        </DispatchProvider>
      </body>
    </html>
  );
}
