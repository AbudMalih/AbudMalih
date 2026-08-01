'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { companyStats } from '@/lib/data'

function StatCounter({ value, label }: { value: string | number; label: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!isInView) return

    // Extract numeric value
    const numericValue = typeof value === 'string'
      ? parseInt(value.replace(/[^0-9]/g, '')) || 0
      : value

    let start = 0
    const end = numericValue
    const duration = 2000
    const increment = end / (duration / 16)

    const interval = setInterval(() => {
      start += increment
      if (start >= end) {
        setDisplayValue(end)
        clearInterval(interval)
      } else {
        setDisplayValue(Math.floor(start))
      }
    }, 16)

    return () => clearInterval(interval)
  }, [isInView, value])

  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="text-4xl md:text-5xl font-bold text-jarbou-red mb-2">
        {typeof value === 'string' && value.startsWith('+') && '+'}
        {displayValue}
        {typeof value === 'string' && value.includes('%') && '%'}
        {typeof value === 'string' && value.includes('€') && ' Mio. €'}
      </div>
      <p className="text-sm md:text-base text-mid-grey font-medium">{label}</p>
    </motion.div>
  )
}

export default function StatisticsSection() {
  return (
    <section className="bg-off-white py-20 md:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-deep-graphite mb-4">
            Jarbou in Zahlen
          </h2>
          <p className="text-lg text-mid-grey max-w-2xl mx-auto">
            Gegründet 2020. Heute ein etablierter Logistikpartner mit echtem operativem Gewicht.
          </p>
        </motion.div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8">
          <StatCounter value={2020} label="Gegründet" />
          <StatCounter value={companyStats.employees} label="Mitarbeitende" />
          <StatCounter value={companyStats.vehicles} label="Fahrzeuge" />
          <StatCounter value={companyStats.locations} label="Standorte" />
          <StatCounter value={companyStats.revenue} label="Jahresumsatz" />
          <StatCounter value={companyStats.growth} label="Wachstum seit 2020" />
          <StatCounter value={companyStats.pickupQuality} label="Abholqualität" />
          <StatCounter value={companyStats.deliveryQuality} label="Zustellqualität" />
        </div>

        {/* Context note */}
        <motion.div
          className="text-center text-xs text-mid-grey mt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <p>Leistungswerte gemäß internem Qualitätsreporting, Zeitraum Februar–Mai 2026.</p>
          <p className="mt-2 text-xs">
            Hinweis: Statistiken sollten vor Publikation durch Administratoren überprüft und genehmigt werden.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
