'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import BusinessEnquiryForm from '@/components/forms/BusinessEnquiryForm'

const processSteps = [
  { step: '1', title: 'Bedarf verstehen', description: 'Wir hören aktiv zu und verstehen Ihre Anforderungen.' },
  { step: '2', title: 'Standort prüfen', description: 'Wir prüfen Standort und Volumen für Machbarkeit.' },
  { step: '3', title: 'Leistungsmodell entwickeln', description: 'Gemeinsam konzipieren wir die beste Lösung.' },
  { step: '4', title: 'Team und Flotte planen', description: 'Wir dimensionieren Team und Fahrzeuge richtig.' },
  { step: '5', title: 'Prozesse implementieren', description: 'Strukturierte Einführung mit Ihrem Unternehmen.' },
  { step: '6', title: 'Leistung messen', description: 'Transparentes Reporting und kontinuierliche Optimierung.' },
]

export default function FuerUnternehmenPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-deep-graphite text-off-white py-20 md:py-32">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Ein Partner, der Verantwortung übernimmt.
            </h1>
            <p className="text-xl text-mid-grey mb-8">
              Wir unterstützen Logistikunternehmen mit qualifizierten Teams, eigener Disposition, moderner Flotte und datenbasierter Qualitätssteuerung.
            </p>
            <Link
              href="#form"
              className="inline-flex items-center gap-2 px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
            >
              Logistikprojekt anfragen <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-deep-graphite mb-16 text-center"
          >
            Unser Projektprozess
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {processSteps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white border border-light-grey rounded-sm p-8 hover:border-jarbou-red transition-colors"
              >
                <div className="text-4xl font-bold text-jarbou-red mb-4">{item.step}</div>
                <h3 className="text-xl font-bold text-deep-graphite mb-3">{item.title}</h3>
                <p className="text-mid-grey">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Jarbou */}
      <section className="py-20 md:py-32 bg-deep-graphite">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-off-white mb-16"
          >
            Warum Jarbou
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              'Operative Stärke mit echtem Know-how',
              'Qualitätsgesteuerung, nicht Kostenoptimierung',
              'Transparentes Reporting',
              'Eigene Disposition und Flottenmanagement',
              'Flexible Skalierung für Ihr Wachstum',
              'Partnerschaftlicher Ansatz',
            ].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <CheckCircle2 className="text-jarbou-red flex-shrink-0 mt-1" size={24} />
                <p className="text-lg text-off-white font-medium">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="form" className="py-20 md:py-32 bg-off-white">
        <div className="section-container max-w-4xl mx-auto">
          <BusinessEnquiryForm />
        </div>
      </section>
    </div>
  )
}
