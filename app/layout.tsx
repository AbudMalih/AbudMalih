import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CookieConsent from '@/components/CookieConsent'
import { officialLogoDarkSurfaceSrc } from '@/lib/assets'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.jarbou-logistik.com'),
  title: 'Jarbou Logistik – Zuverlässige Logistiklösungen in Deutschland',
  description: 'Logistikpartner für Unternehmen und Arbeitgeber. Qualitätsgesteuerter Paketversand, eigene Disposition und moderne Flotte in Erfurt und deutschlandweit.',
  keywords: 'Logistik, Paketzustellung, CEP, Erfurt, Deutschland, Kurierservice, Fahrer Jobs',
  authors: [{ name: 'Jarbou Logistik GmbH' }],
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://www.jarbou-logistik.com',
    title: 'Jarbou Logistik – Zuverlässige Logistiklösungen',
    description: 'Logistikpartner für Unternehmen und Arbeitgeber in Deutschland',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Jarbou Logistik',
      },
    ],
  },
  robots: 'index, follow',
  alternates: {
    languages: {
      de: 'https://www.jarbou-logistik.com',
      en: 'https://www.jarbou-logistik.com/en',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Header and footer sit on dark surfaces → prefer the white-text variant
  const logoSrc = officialLogoDarkSurfaceSrc()

  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F20D18" />
      </head>
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Jarbou Logistik GmbH',
              url: 'https://www.jarbou-logistik.com',
              foundingDate: '2020-10',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Erfurter Landstraße 50a',
                postalCode: '99095',
                addressLocality: 'Erfurt',
                addressCountry: 'DE',
              },
              telephone: '+49 170 7272725',
            }),
          }}
        />
        <Header logoSrc={logoSrc} />
        <main>
          {children}
        </main>
        <Footer logoSrc={logoSrc} />
        <CookieConsent />
      </body>
    </html>
  )
}
