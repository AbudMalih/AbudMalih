'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function InitiativbewerbungPage() {
  return (
    <div className="bg-off-white min-h-screen py-12 md:py-20">
      <div className="section-container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-4">Initiativbewerbung</h1>
          <p className="text-lg text-mid-grey mb-8">
            Keine passende Stelle gefunden? Zeig uns, wo du Jarbou verstärken möchtest.
          </p>

          <div className="bg-white border border-light-grey rounded-sm p-8 md:p-12">
            <p className="text-mid-grey mb-6">
              Wir sind immer auf der Suche nach talentierten Menschen, die unser Team verstärken möchten. Wenn Sie sich nicht auf eine bestimmte Stelle bewerben möchten, können Sie sich gerne initiativ bei uns melden.
            </p>

            <p className="text-mid-grey mb-8">
              Bitte senden Sie Ihren Lebenslauf, ein Anschreiben und eine kurze Beschreibung Ihrer Interessen an:
            </p>

            <div className="bg-deep-graphite text-off-white rounded-sm p-8 mb-8">
              <p className="font-bold mb-2">Jarbou Logistik GmbH</p>
              <p className="text-mid-grey mb-4">Careers Team</p>
              <p className="mb-2">
                <a href="mailto:karriere@jarbou-logistik.de" className="text-jarbou-red hover:underline">
                  karriere@jarbou-logistik.de
                </a>
              </p>
              <p>
                <a href="tel:+49 170 7272725" className="text-jarbou-red hover:underline">
                  +49 170 7272725
                </a>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/jobs"
                className="flex-1 px-6 py-3 border-2 border-jarbou-red text-jarbou-red font-bold rounded-sm hover:bg-jarbou-red hover:text-white transition-colors text-center"
              >
                Offene Stellen ansehen
              </Link>
              <Link
                href="/karriere"
                className="flex-1 px-6 py-3 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-center"
              >
                Mehr über Jarbou
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
