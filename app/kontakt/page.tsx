'use client'

import { motion } from 'framer-motion'
import { contactInfo } from '@/lib/data'
import { Mail, Phone, MapPin } from 'lucide-react'
import Link from 'next/link'

export default function KontaktPage() {
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
              Kontakt
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl">
              Haben Sie Fragen? Unser Team beantwortet diese gerne.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-20 md:py-32 bg-off-white">
        <div className="section-container max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Business */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white border border-light-grey rounded-sm p-8"
            >
              <h3 className="text-xl font-bold text-deep-graphite mb-6">Logistik anfragen</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="text-jarbou-red flex-shrink-0 mt-1" size={20} />
                  <a href={`mailto:${contactInfo.email}`} className="text-jarbou-red hover:underline">
                    {contactInfo.email}
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="text-jarbou-red flex-shrink-0 mt-1" size={20} />
                  <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline">
                    {contactInfo.phone}
                  </a>
                </div>
              </div>
              <Link
                href="/fuer-unternehmen"
                className="mt-6 inline-block px-6 py-2 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors w-full text-center"
              >
                Anfrage stellen
              </Link>
            </motion.div>

            {/* Career */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white border border-light-grey rounded-sm p-8"
            >
              <h3 className="text-xl font-bold text-deep-graphite mb-6">Karriere</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="text-jarbou-red flex-shrink-0 mt-1" size={20} />
                  <a href={`mailto:${contactInfo.careerEmail}`} className="text-jarbou-red hover:underline">
                    {contactInfo.careerEmail}
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="text-jarbou-red flex-shrink-0 mt-1" size={20} />
                  <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline">
                    {contactInfo.phone}
                  </a>
                </div>
              </div>
              <Link
                href="/jobs"
                className="mt-6 inline-block px-6 py-2 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors w-full text-center"
              >
                Stellen ansehen
              </Link>
            </motion.div>

            {/* General */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white border border-light-grey rounded-sm p-8"
            >
              <h3 className="text-xl font-bold text-deep-graphite mb-6">Zentrale</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-jarbou-red flex-shrink-0 mt-1" size={20} />
                  <div className="text-mid-grey text-sm">
                    {contactInfo.address}<br />
                    {contactInfo.city}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-deep-graphite text-off-white rounded-sm p-12 text-center"
          >
            <h2 className="text-2xl font-bold mb-4">{contactInfo.company}</h2>
            <p className="text-mid-grey mb-2">{contactInfo.address}</p>
            <p className="text-mid-grey">{contactInfo.city}, {contactInfo.country}</p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
