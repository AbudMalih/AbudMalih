'use client'

import { motion } from 'framer-motion'
import { companyStats } from '@/lib/data'
import { TrendingUp, BarChart3, Zap } from 'lucide-react'

export default function QualitaetPage() {
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
              Daten sehen. Qualität steuern. Leistung verbessern.
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl">
              Durch tägliches Reporting, strukturierte Disposition und gezielte Tourenanalysen schaffen wir Transparenz und entwickeln unsere Leistung kontinuierlich weiter.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: TrendingUp,
                title: 'Tägliches Reporting',
                description: 'Automatisierte, aussagekräftige Berichte über Leistung, Qualität und Produktivität.',
              },
              {
                icon: BarChart3,
                title: 'Qualitätskennzahlen',
                description: 'Kontinuierliches Tracking von Abhol- und Zustellqualität sowie Routenproduktivität.',
              },
              {
                icon: Zap,
                title: 'KI-Analyse',
                description: 'Intelligente Auswertung von Leistungsdaten für Optimierungspotenziale.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white border border-light-grey rounded-sm p-8"
              >
                <item.icon className="text-jarbou-red mb-4" size={32} />
                <h3 className="text-xl font-bold text-deep-graphite mb-3">{item.title}</h3>
                <p className="text-mid-grey">{item.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Metrics */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-deep-graphite rounded-sm p-12 text-off-white"
          >
            <h2 className="text-2xl font-bold mb-8">Unsere Qualitätskennzahlen</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="text-4xl font-bold text-jarbou-red mb-2">{companyStats.pickupQuality}</div>
                <p className="text-mid-grey">Abholqualität</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-jarbou-red mb-2">{companyStats.deliveryQuality}</div>
                <p className="text-mid-grey">Zustellqualität</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-jarbou-red mb-2">{companyStats.stopsPerRoute}</div>
                <p className="text-mid-grey">Stopps pro Tour</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-jarbou-red mb-2">24/7</div>
                <p className="text-mid-grey">Monitoring</p>
              </div>
            </div>
            <p className="text-xs text-mid-grey mt-8 pt-8 border-t border-carbon">
              Beispielwerte aus internem Qualitätsreporting. Ergebnisse können je nach Standort, Auftrag und Zeitraum variieren.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-32 bg-deep-graphite">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-off-white mb-16"
          >
            Die vier Säulen unserer Qualitätssteuerung
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { num: '1', title: 'Erfassung', desc: 'Jedes Scanning, jeder Ort und jedes Zeitfenster wird dokumentiert.' },
              { num: '2', title: 'Analyse', desc: 'Automatische Auswertung auf Fehler, Abweichungen und Potenziale.' },
              { num: '3', title: 'Reporting', desc: 'Transparente Tagesberichte für Management und Partner.' },
              { num: '4', title: 'Optimierung', desc: 'Gezielte Maßnahmen basierend auf Daten, nicht Vermutungen.' },
            ].map((item, index) => (
              <motion.div
                key={item.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-carbon border border-carbon rounded-sm p-8"
              >
                <div className="text-4xl font-bold text-jarbou-red mb-4">{item.num}</div>
                <h3 className="text-xl font-bold text-off-white mb-3">{item.title}</h3>
                <p className="text-mid-grey">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
