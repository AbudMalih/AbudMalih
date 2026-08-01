'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function FinalCTASection() {
  return (
    <section className="bg-off-white py-20 md:py-32">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Business */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-deep-graphite rounded-sm p-12 flex flex-col justify-between"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-off-white mb-6">
                Sie benötigen eine Logistiklösung?
              </h2>
              <p className="text-mid-grey mb-8">
                Kontaktieren Sie unser Team und erfahren Sie, wie Jarbou Ihr Logistikpartner sein kann.
              </p>
            </div>

            <Link
              href="/fuer-unternehmen"
              className="inline-flex items-center gap-2 px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors w-full justify-center"
            >
              Projekt anfragen <ArrowRight size={20} />
            </Link>
          </motion.div>

          {/* Right: Career */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-jarbou-red rounded-sm p-12 flex flex-col justify-between"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Du möchtest mit uns wachsen?
              </h2>
              <p className="text-white/90 mb-8">
                Finde offene Stellen oder bewirb dich initiativ. Deine Leistung bewegt uns.
              </p>
            </div>

            <Link
              href="/karriere"
              className="inline-flex items-center gap-2 px-8 py-4 bg-deep-graphite text-jarbou-red font-bold rounded-sm hover:bg-black transition-colors w-full justify-center"
            >
              Jetzt bewerben <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
