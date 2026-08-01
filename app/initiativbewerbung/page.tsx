'use client'

import { motion } from 'framer-motion'
import InitiativeForm from '@/components/forms/InitiativeForm'
import { contactInfo } from '@/lib/data'

export default function InitiativbewerbungPage() {
  return (
    <div className="bg-off-white min-h-screen py-12 md:py-20">
      <div className="section-container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-4">
            Keine passende Stelle gefunden?
          </h1>
          <p className="text-lg text-mid-grey mb-12">
            Zeig uns, wo du Jarbou verstärken möchtest. Wir prüfen, welche Position und welcher Standort zu dir passen könnten.
          </p>

          <InitiativeForm />

          <p className="text-sm text-mid-grey mt-8 text-center">
            Fragen? Schreib uns an{' '}
            <a href={`mailto:${contactInfo.careerEmail}`} className="text-jarbou-red hover:underline">
              {contactInfo.careerEmail}
            </a>{' '}
            oder ruf an unter{' '}
            <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline">
              {contactInfo.phone}
            </a>.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
