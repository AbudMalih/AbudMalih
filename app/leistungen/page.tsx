'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { services } from '@/lib/data'
import { ArrowRight } from 'lucide-react'

export default function LeistungenPage() {
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
              Leistungen mit operativer Verantwortung.
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl">
              Von der Zustellung über die Disposition bis zur datenbasierten Qualitätssteuerung: Wir schaffen klare Prozesse für verlässliche Leistung.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Details */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {services.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                id={service.id}
                className="border border-light-grey rounded-sm p-8 hover:border-jarbou-red transition-colors"
              >
                <div className="h-1 w-12 bg-jarbou-red mb-6"></div>
                <h3 className="text-2xl font-bold text-deep-graphite mb-3">
                  {service.title}
                </h3>
                <p className="text-sm text-mid-grey font-medium mb-4 uppercase tracking-wide">
                  {service.category}
                </p>
                <p className="text-mid-grey mb-6">
                  {service.description}
                </p>
                <Link
                  href="/fuer-unternehmen"
                  className="text-jarbou-red font-medium inline-flex items-center gap-2 hover:gap-3 transition-all"
                >
                  Bedarf besprechen <ArrowRight size={16} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-deep-graphite py-16 md:py-24">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-off-white mb-8">
              Passt eine Leistung nicht perfekt? Wir schaffen Lösungen.
            </h2>
            <Link
              href="/fuer-unternehmen"
              className="inline-flex items-center gap-2 px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
            >
              Logistikbedarf anfragen <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
