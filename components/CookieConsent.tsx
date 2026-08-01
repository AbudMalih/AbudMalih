'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    const hasConsent = localStorage.getItem('cookie-consent')
    if (!hasConsent) {
      setIsVisible(true)
    }
  }, [])

  const handleAcceptAll = () => {
    const consent = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('cookie-consent', JSON.stringify(consent))
    setIsVisible(false)
  }

  const handleAcceptNecessary = () => {
    const consent = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('cookie-consent', JSON.stringify(consent))
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-deep-graphite border-t border-carbon text-off-white p-4 md:p-6 z-30">
      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Cookie-Einstellungen</h3>
            <p className="text-sm text-mid-grey mb-3">
              Wir verwenden Cookies, um Ihr Browsererlebnis zu verbessern. Notwendige Cookies sind immer aktiv.{' '}
              <Link href="/datenschutz" className="text-jarbou-red hover:underline">
                Mehr erfahren
              </Link>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <button
              onClick={handleAcceptNecessary}
              className="px-6 py-2 border border-mid-grey text-mid-grey hover:border-jarbou-red hover:text-jarbou-red rounded-sm transition-colors font-medium text-sm"
            >
              Nur notwendig
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-6 py-2 bg-jarbou-red text-white rounded-sm hover:bg-red-700 transition-colors font-medium text-sm"
            >
              Alle akzeptieren
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 hover:text-jarbou-red transition-colors"
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
