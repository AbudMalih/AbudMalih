'use client'

import { motion } from 'framer-motion'
import { companyTimeline, companyValues } from '@/lib/data'

export default function CompanyStorySection() {
  return (
    <section className="bg-deep-graphite py-20 md:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-off-white mb-4">
            Vom Start-up zum starken Logistikpartner.
          </h2>
          <p className="text-lg text-mid-grey">
            Seit 2020 bauen wir an einer Logistik, die Qualität in den Mittelpunkt stellt.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {companyTimeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-carbon border border-carbon rounded-sm p-6 hover:border-jarbou-red transition-colors"
              >
                <div className="text-3xl font-bold text-jarbou-red mb-3">{item.year}</div>
                <h3 className="text-lg font-bold text-off-white mb-2">{item.title}</h3>
                <p className="text-sm text-mid-grey">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="border-t border-carbon pt-16"
        >
          <h3 className="text-2xl font-bold text-off-white mb-12 text-center">
            Wofür wir stehen
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {companyValues.map((value, index) => (
              <motion.div
                key={value.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-jarbou-red rounded-full flex items-center justify-center flex-shrink-0 font-bold text-deep-graphite">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-off-white mb-2">{value.title}</h4>
                    <p className="text-mid-grey">{value.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
