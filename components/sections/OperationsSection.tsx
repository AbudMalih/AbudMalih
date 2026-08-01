'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const stages = [
  {
    id: 'pickup',
    title: 'Abholung',
    description: 'Pünktlich starten, vollständig scannen und sauber übergeben.',
  },
  {
    id: 'route',
    title: 'Route',
    description: 'Touren effizient planen, Zeitfenster überwachen und flexibel reagieren.',
  },
  {
    id: 'delivery',
    title: 'Zustellung',
    description: 'Sendungen zuverlässig, sicher und nachvollziehbar zustellen.',
  },
  {
    id: 'quality',
    title: 'Qualität',
    description: 'Leistung täglich dokumentieren, auswerten und verbessern.',
  },
]

export default function OperationsSection() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const lineWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <section ref={containerRef} className="bg-off-white py-20 md:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-deep-graphite mb-4">
            So arbeitet Jarbou
          </h2>
          <p className="text-lg text-mid-grey">
            Vier Phasen, ein Versprechen: Qualität auf jeder Etappe.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Progress line */}
          <motion.div
            className="hidden md:block absolute top-0 left-0 h-1 bg-jarbou-red"
            style={{ width: lineWidth }}
          ></motion.div>

          {/* Stages */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Number circle */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-jarbou-red text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {index + 1}
                  </div>
                  <h3 className="text-2xl font-bold text-deep-graphite">{stage.title}</h3>
                </div>

                {/* Description */}
                <p className="text-mid-grey text-base leading-relaxed">
                  {stage.description}
                </p>

                {/* Arrow to next (desktop only) */}
                {index < stages.length - 1 && (
                  <div className="hidden md:block absolute -bottom-12 -right-4 text-jarbou-red text-2xl">
                    →
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
