'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function CookiesPage() {
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('cookie-consent')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPreferences({
          necessary: true,
          analytics: !!parsed.analytics,
          marketing: !!parsed.marketing,
        })
      } catch {
        // ignore invalid stored consent
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      ...preferences,
      necessary: true,
      timestamp: new Date().toISOString(),
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="bg-off-white min-h-screen py-20 md:py-32">
      <div className="section-container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-4">Cookie-Einstellungen</h1>
          <p className="text-lg text-mid-grey mb-12">
            Verwalten Sie hier Ihre Cookie-Präferenzen. Notwendige Cookies sind für den Betrieb der Website erforderlich und können nicht deaktiviert werden.
          </p>

          <div className="space-y-6 mb-12">
            <div className="bg-white border border-light-grey rounded-sm p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-deep-graphite mb-1">Notwendige Cookies</h3>
                <p className="text-sm text-mid-grey">Erforderlich für Grundfunktionen der Website.</p>
              </div>
              <input type="checkbox" checked disabled className="w-5 h-5 accent-jarbou-red" />
            </div>

            <div className="bg-white border border-light-grey rounded-sm p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-deep-graphite mb-1">Analyse-Cookies</h3>
                <p className="text-sm text-mid-grey">Helfen uns, die Nutzung der Website zu verstehen. Keine personenbezogenen Formulardaten.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                className="w-5 h-5 accent-jarbou-red"
              />
            </div>

            <div className="bg-white border border-light-grey rounded-sm p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-deep-graphite mb-1">Marketing-Cookies</h3>
                <p className="text-sm text-mid-grey">Werden nur mit Ihrer ausdrücklichen Einwilligung gesetzt.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                className="w-5 h-5 accent-jarbou-red"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
          >
            Einstellungen speichern
          </button>

          {saved && (
            <p className="mt-4 text-jarbou-red font-medium">Ihre Einstellungen wurden gespeichert.</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
