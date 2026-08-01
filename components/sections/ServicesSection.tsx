'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { services } from '@/lib/data'
import { ArrowRight } from 'lucide-react'

export default function ServicesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const existing = acc.find(g => g.category === service.category)
    if (existing) {
      existing.services.push(service)
    } else {
      acc.push({ category: service.category, services: [service] })
    }
    return acc
  }, [] as Array<{ category: string; services: typeof services }>)

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
            Operative Stärke entlang der letzten Meile
          </h2>
          <p className="text-lg text-mid-grey">
            Von der Zustellung über die Disposition bis zur datenbasierten Qualitätssteuerung: Wir schaffen klare Prozesse für verlässliche Leistung.
          </p>
        </motion.div>

        {/* Services by Category */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {groupedServices.map((group) => (
            <motion.div
              key={group.category}
              variants={itemVariants}
              className="bg-carbon border border-carbon rounded-sm overflow-hidden hover:border-jarbou-red transition-colors"
            >
              <div className="h-2 bg-jarbou-red"></div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-off-white mb-6">{group.category}</h3>
                <ul className="space-y-4">
                  {group.services.map((service) => (
                    <li key={service.id} className="flex items-start gap-3">
                      <div className="w-1 h-1 bg-jarbou-red mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-semibold text-off-white">{service.title}</p>
                        <p className="text-xs text-mid-grey mt-1">{service.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/leistungen"
                  className="inline-flex items-center gap-2 text-jarbou-red hover:gap-3 transition-all mt-6 font-medium text-sm"
                >
                  Mehr erfahren <ArrowRight size={16} />
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
