'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { faqs, contactInfo } from '@/lib/data'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const hireSteps = [
  { step: '1', title: 'Bewerbung', desc: 'Ihre Bewerbung wird geprüft.' },
  { step: '2', title: 'Telefonat', desc: '15–20 Min. Kennenlernen.' },
  { step: '3', title: 'Gespräch', desc: '30–45 Min. Vertiefung.' },
  { step: '4', title: 'Praktischer Einblick', desc: 'Ride-along oder Kurztest.' },
  { step: '5', title: 'Angebot', desc: 'Vertragsbesprechung.' },
  { step: '6', title: 'Einarbeitung', desc: 'Strukturiertes Onboarding.' },
]

export default function KarrierePage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  return (
    <div>
      {/* Hero */}
      <section className="bg-deep-graphite text-off-white py-20 md:py-32">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Deine Leistung bewegt uns.
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl mb-8">
              Bei Jarbou zählt nicht nur dein Lebenslauf. Entscheidend ist, wie zuverlässig du anpackst, Verantwortung übernimmst und gemeinsam mit deinem Team Leistung lieferst.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/jobs"
                className="px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-center"
              >
                Offene Stellen ansehen
              </Link>
              <Link
                href="/bewerbung"
                className="px-8 py-4 border-2 border-jarbou-red text-jarbou-red font-bold rounded-sm hover:bg-jarbou-red hover:text-white transition-colors text-center"
              >
                In 3 Minuten bewerben
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Hiring Process */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-deep-graphite mb-16"
          >
            Unser Bewerbungsprozess
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hireSteps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white border border-light-grey rounded-sm p-8 hover:border-jarbou-red transition-colors"
              >
                <div className="text-4xl font-bold text-jarbou-red mb-3">{item.step}</div>
                <h3 className="text-lg font-bold text-deep-graphite mb-2">{item.title}</h3>
                <p className="text-mid-grey">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="text-center text-mid-grey mt-12"
          >
            Der Prozess läuft oft schnell ab. Oft erhalten Sie innerhalb weniger Tage eine Rückmeldung.
          </motion.p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 md:py-32 bg-deep-graphite">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-off-white mb-16"
          >
            Warum Jarbou
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              'Unbefristete Beschäftigung bei vielen Positionen',
              'Moderner Fuhrpark',
              'Strukturierte Einarbeitung',
              'Persönliche Ansprechpartner',
              'Entwicklungsmöglichkeiten',
              'Standorte deutschlandweit',
            ].map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <div className="w-6 h-6 bg-jarbou-red rounded-full flex-shrink-0 mt-1"></div>
                <p className="text-off-white font-medium">{benefit}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-mid-grey mt-12">
            Leistungen, Vertragsbedingungen und Zusatzangebote können je nach Position und Standort variieren.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-32 bg-off-white">
        <div className="section-container max-w-2xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-deep-graphite mb-12"
          >
            Häufig gestellte Fragen
          </motion.h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="border border-light-grey rounded-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-light-grey transition-colors"
                >
                  <h3 className="font-bold text-deep-graphite">{faq.question}</h3>
                  <ChevronDown
                    size={20}
                    className={`text-jarbou-red flex-shrink-0 transition-transform ${
                      expandedFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-6 border-t border-light-grey bg-off-white"
                  >
                    <p className="text-mid-grey">{faq.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 md:py-32 bg-deep-graphite">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-off-white mb-8">Fragen? Wir sind für dich da.</h2>
            <p className="text-mid-grey mb-6">
              Unser Recruiting-Team antwortet gerne auf deine Fragen.
            </p>
            <p className="text-lg mb-4">
              <a
                href={`mailto:${contactInfo.careerEmail}`}
                className="text-jarbou-red hover:underline font-medium"
              >
                {contactInfo.careerEmail}
              </a>
            </p>
            <p className="text-lg">
              <a
                href={`tel:${contactInfo.phone}`}
                className="text-jarbou-red hover:underline font-medium"
              >
                {contactInfo.phone}
              </a>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
