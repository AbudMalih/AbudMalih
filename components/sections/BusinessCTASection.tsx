'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function BusinessCTASection() {
  return (
    <section className="bg-off-white py-20 md:py-32">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-deep-graphite rounded-sm overflow-hidden"
        >
          <div className="p-12 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-off-white mb-6">
              Sie suchen einen zuverlässigen operativen Logistikpartner?
            </h2>

            <p className="text-lg text-mid-grey mb-12 max-w-2xl mx-auto">
              Beschreiben Sie uns Ihren Bedarf. Unser Team prüft Standort, Volumen, Leistungsumfang und geplanten Start und meldet sich persönlich bei Ihnen.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/fuer-unternehmen#form"
                className="px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-lg inline-flex items-center gap-2"
              >
                Projekt anfragen <ArrowRight size={20} />
              </Link>
              <Link
                href="/leistungen"
                className="px-8 py-4 border-2 border-mid-grey text-off-white font-bold rounded-sm hover:border-jarbou-red hover:text-jarbou-red transition-colors text-lg"
              >
                Leistungen ansehen
              </Link>
            </div>
          </div>

          {/* Decorative element */}
          <div className="hidden md:block absolute -top-32 -right-32 w-64 h-64 opacity-10">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="50" y1="20" x2="150" y2="180" stroke="#F20D18" strokeWidth="8" />
              <line x1="150" y1="20" x2="50" y2="180" stroke="#F20D18" strokeWidth="8" />
            </svg>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
