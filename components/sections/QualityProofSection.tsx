'use client'

import { motion } from 'framer-motion'
import { companyStats } from '@/lib/data'
import { BarChart3 } from 'lucide-react'

export default function QualityProofSection() {
  const qualityMetrics = [
    { label: 'Abholqualität', value: '98.8%', benchmark: '100%' },
    { label: 'Zustellqualität', value: '96%', benchmark: '100%' },
    { label: 'Stopps pro Tour', value: '46.8', benchmark: '~45 (Ziel)' },
  ]

  const features = [
    'Tägliches Reporting',
    'Eigene Disposition',
    'Scanning-Qualität',
    'Zeitfenster-Monitoring',
    'ADR-konforme Abläufe',
    'Kontinuierliche Optimierung',
  ]

  return (
    <section className="bg-deep-graphite py-20 md:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          className="mb-16 max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-off-white mb-4">
            Qualität ist kein Versprechen. Sie ist messbar.
          </h2>
          <p className="text-lg text-mid-grey">
            Durch tägliches Reporting, strukturierte Disposition und gezielte Tourenanalysen schaffen wir Transparenz und entwickeln unsere Leistung kontinuierlich weiter.
          </p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {qualityMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-carbon border border-carbon rounded-sm p-8"
            >
              <p className="text-sm text-mid-grey mb-2">{metric.label}</p>
              <div className="text-4xl font-bold text-jarbou-red mb-4">{metric.value}</div>
              {/* Simple bar */}
              <div className="bg-carbon rounded-full h-2 mb-3">
                <div
                  className="bg-gradient-to-r from-jarbou-red to-jarbou-red rounded-full h-2"
                  style={{
                    width: metric.value === '98.8%' ? '99%' : metric.value === '96%' ? '96%' : '94%',
                  }}
                ></div>
              </div>
              <p className="text-xs text-mid-grey">{metric.benchmark}</p>
            </motion.div>
          ))}
        </div>

        {/* Features grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-carbon border border-carbon rounded-sm p-8 md:p-12"
        >
          <div className="flex items-center gap-3 mb-8">
            <BarChart3 className="text-jarbou-red flex-shrink-0" size={32} />
            <h3 className="text-2xl font-bold text-off-white">Wie wir Qualität steuern</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-1 h-1 bg-jarbou-red rounded-full flex-shrink-0"></div>
                <p className="text-off-white font-medium">{feature}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-mid-grey mt-8 pt-8 border-t border-carbon">
            Beispielwerte aus internem Qualitätsreporting. Ergebnisse können je nach Standort, Auftrag und Zeitraum variieren.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
