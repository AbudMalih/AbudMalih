'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'

interface HeaderProps {
  logoSrc?: string | null
}

export default function Header({ logoSrc }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'Startseite', href: '/' },
    { label: 'Leistungen', href: '/leistungen' },
    { label: 'Für Unternehmen', href: '/fuer-unternehmen' },
    { label: 'Qualität', href: '/qualitaet' },
    { label: 'Über uns', href: '/ueber-uns' },
    { label: 'Karriere', href: '/karriere' },
    { label: 'Kontakt', href: '/kontakt' },
  ]

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-deep-graphite/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0" aria-label="Jarbou Logistik – Startseite">
            <Logo officialSrc={logoSrc} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isScrolled
                    ? 'text-off-white hover:text-jarbou-red'
                    : 'text-off-white hover:text-jarbou-red'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/kontakt"
              className="text-sm font-medium text-off-white hover:text-jarbou-red transition-colors"
            >
              Logistik anfragen
            </Link>
            <Link
              href="/karriere"
              className="px-6 py-2 bg-jarbou-red text-white text-sm font-bold rounded-sm hover:bg-red-700 transition-colors"
            >
              Jetzt bewerben
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-off-white hover:text-jarbou-red transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-carbon pb-4">
            <div className="flex flex-col gap-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-off-white hover:text-jarbou-red transition-colors font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-carbon pt-4 flex flex-col gap-3">
                <Link
                  href="/karriere"
                  className="w-full px-4 py-3 bg-jarbou-red text-white font-bold rounded-sm text-center hover:bg-red-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Jetzt bewerben
                </Link>
                <Link
                  href="/kontakt"
                  className="w-full px-4 py-3 border border-jarbou-red text-jarbou-red font-bold rounded-sm text-center hover:bg-jarbou-red hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Logistik anfragen
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
