'use client'

import { motion } from 'framer-motion'
import { companyTimeline, companyValues, contactInfo } from '@/lib/data'

export default function UeberUnsPage() {
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
              Vom Start-up zum starken Logistikpartner.
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl">
              Seit 2020 bauen wir an einer Logistik, die Qualität in den Mittelpunkt stellt.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-deep-graphite mb-16"
          >
            Unser Weg
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {companyTimeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white border border-light-grey rounded-sm p-8 hover:border-jarbou-red transition-colors"
              >
                <div className="text-3xl font-bold text-jarbou-red mb-3">{item.year}</div>
                <h3 className="text-lg font-bold text-deep-graphite mb-2">{item.title}</h3>
                <p className="text-sm text-mid-grey">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-32 bg-deep-graphite">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-off-white mb-16"
          >
            Wofür wir stehen
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {companyValues.map((value, index) => (
              <motion.div
                key={value.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-carbon border border-carbon rounded-sm p-8"
              >
                <div className="w-12 h-12 bg-jarbou-red rounded-full flex items-center justify-center font-bold text-deep-graphite mb-4">
                  {index + 1}
                </div>
                <h3 className="text-xl font-bold text-off-white mb-3">{value.title}</h3>
                <p className="text-mid-grey">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-deep-graphite mb-8">Jarbou Logistik GmbH</h2>
            <p className="text-lg text-mid-grey mb-8">
              {contactInfo.address}<br />
              {contactInfo.city}, {contactInfo.country}
            </p>
            <p className="text-mid-grey mb-4">
              Tel: <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline">{contactInfo.phone}</a>
            </p>
            <p className="text-mid-grey">
              Email: <a href={`mailto:${contactInfo.email}`} className="text-jarbou-red hover:underline">{contactInfo.email}</a>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
