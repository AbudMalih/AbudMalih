'use client'

import { motion } from 'framer-motion'
import { locations } from '@/lib/data'
import Link from 'next/link'

export default function LocationsSection() {
  const activeLocations = locations.filter(l => l.active)

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
            Unsere Standorte in Deutschland
          </h2>
          <p className="text-lg text-mid-grey">
            Präsent an 7 Standorten. Mit lokaler Verantwortung, operativer Nähe und deutschlandweiter Reichweite.
          </p>
        </motion.div>

        {/* Locations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {activeLocations.map((location, index) => (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.05 }}
              viewport={{ once: true }}
              className={`border rounded-sm p-6 transition-all hover:border-jarbou-red ${
                location.recruiting
                  ? 'border-jarbou-red bg-carbon'
                  : 'border-carbon bg-deep-graphite'
              }`}
            >
              <h3 className="text-xl font-bold text-off-white mb-2">{location.city}</h3>
              <p className="text-sm text-mid-grey mb-4">{location.state}</p>

              {location.recruiting && (
                <div className="mb-4 pb-4 border-b border-carbon">
                  <span className="text-xs font-bold text-jarbou-red bg-red-950 px-3 py-1 rounded-full">
                    Wir rekrutieren
                  </span>
                </div>
              )}

              {location.roles && location.roles.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-mid-grey font-medium mb-2">Gesuchte Positionen:</p>
                  <div className="flex flex-wrap gap-2">
                    {location.roles.map((role) => (
                      <span key={role} className="text-xs bg-carbon px-2 py-1 rounded text-off-white">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/jobs?location=${location.id}`}
                className="text-jarbou-red hover:underline text-sm font-medium"
              >
                Offene Stellen →
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Map placeholder */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-carbon border border-carbon rounded-sm h-96 flex items-center justify-center overflow-hidden"
        >
          <div className="text-center">
            <p className="text-mid-grey mb-4">Interaktive Deutschlandkarte</p>
            <p className="text-xs text-mid-grey">
              (Placeholder für Google Maps oder ähnliche Integration)
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
