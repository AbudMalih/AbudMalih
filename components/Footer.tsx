import Link from 'next/link'
import { contactInfo } from '@/lib/data'
import { Mail, Phone, MapPin } from 'lucide-react'
import Logo from './Logo'

interface FooterProps {
  logoSrc?: string | null
}

export default function Footer({ logoSrc }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-deep-graphite text-off-white">
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div>
            <div className="mb-6">
              <Logo officialSrc={logoSrc} />
            </div>
            <h3 className="sr-only">Jarbou Logistik</h3>
            <p className="text-sm text-mid-grey mb-4">
              Zuverlässige Logistiklösungen für Unternehmen in Deutschland.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-jarbou-red flex-shrink-0 mt-1" />
                <div className="text-mid-grey">
                  {contactInfo.address}<br />
                  {contactInfo.city}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-jarbou-red flex-shrink-0" />
                <a href={`tel:${contactInfo.phone}`} className="text-mid-grey hover:text-jarbou-red transition-colors">
                  {contactInfo.phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-jarbou-red flex-shrink-0" />
                <a href={`mailto:${contactInfo.email}`} className="text-mid-grey hover:text-jarbou-red transition-colors">
                  {contactInfo.email}
                </a>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold mb-4">Leistungen</h4>
            <ul className="space-y-2 text-sm text-mid-grey">
              <li><Link href="/leistungen#paketzustellung" className="hover:text-jarbou-red transition-colors">Paketzustellung</Link></li>
              <li><Link href="/leistungen#abholtouren" className="hover:text-jarbou-red transition-colors">Abholtouren</Link></li>
              <li><Link href="/leistungen#disposition" className="hover:text-jarbou-red transition-colors">Eigene Disposition</Link></li>
              <li><Link href="/leistungen#qualitaetsreporting" className="hover:text-jarbou-red transition-colors">Qualitätsreporting</Link></li>
              <li><Link href="/fuer-unternehmen" className="hover:text-jarbou-red transition-colors">Für Unternehmen</Link></li>
            </ul>
          </div>

          {/* Careers */}
          <div>
            <h4 className="font-bold mb-4">Karriere</h4>
            <ul className="space-y-2 text-sm text-mid-grey">
              <li><Link href="/karriere" className="hover:text-jarbou-red transition-colors">Karriere bei Jarbou</Link></li>
              <li><Link href="/jobs" className="hover:text-jarbou-red transition-colors">Offene Stellen</Link></li>
              <li><Link href="/jobs?category=driver" className="hover:text-jarbou-red transition-colors">Fahrer Jobs</Link></li>
              <li><Link href="/karriere#faq" className="hover:text-jarbou-red transition-colors">FAQ</Link></li>
              <li><a href={`mailto:${contactInfo.careerEmail}`} className="hover:text-jarbou-red transition-colors">Initiativbewerbung</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4">Rechtliches</h4>
            <ul className="space-y-2 text-sm text-mid-grey">
              <li><Link href="/impressum" className="hover:text-jarbou-red transition-colors">Impressum</Link></li>
              <li><Link href="/datenschutz" className="hover:text-jarbou-red transition-colors">Datenschutz</Link></li>
              <li><Link href="/cookies" className="hover:text-jarbou-red transition-colors">Cookie-Einstellungen</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-carbon pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-mid-grey">
            <p>&copy; {currentYear} Jarbou Logistik GmbH. Alle Rechte vorbehalten.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/impressum" className="hover:text-jarbou-red transition-colors">Impressum</Link>
              <Link href="/datenschutz" className="hover:text-jarbou-red transition-colors">Datenschutz</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
