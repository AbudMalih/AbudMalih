'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { jobs, jobCategories, locations } from '@/lib/data'
import { Search, MapPin, Briefcase } from 'lucide-react'

export default function JobsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           locations.find(l => l.id === job.location)?.city.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = !selectedCategory || job.category === selectedCategory
      const matchesLocation = !selectedLocation || job.location === selectedLocation
      return job.status === 'open' && matchesSearch && matchesCategory && matchesLocation
    })
  }, [searchTerm, selectedCategory, selectedLocation])

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
              Offene Stellen
            </h1>
            <p className="text-xl text-mid-grey max-w-2xl">
              Finde eine Position, die zu dir passt. Von der Straße bis zur Standortleitung.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="bg-off-white py-12 md:py-16 sticky top-20 z-30 border-b border-light-grey">
        <div className="section-container">
          <div className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-mid-grey" size={20} />
              <input
                type="text"
                placeholder="Jobtitel oder Standort suchen"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              >
                <option value="">Alle Rollen</option>
                {jobCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              >
                <option value="">Alle Standorte</option>
                {locations.filter(l => l.active).map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Jobs List */}
      <section className="py-20 md:py-32 bg-white">
        <div className="section-container max-w-4xl">
          {filteredJobs.length > 0 ? (
            <div className="space-y-6">
              {filteredJobs.map((job, index) => {
                const location = locations.find(l => l.id === job.location)
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white border border-light-grey rounded-sm p-6 md:p-8 hover:border-jarbou-red hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start justify-between gap-6 mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-deep-graphite mb-2 group-hover:text-jarbou-red transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-sm text-mid-grey">
                          <div className="flex items-center gap-1">
                            <MapPin size={16} />
                            {location?.city}
                          </div>
                          <div className="flex items-center gap-1">
                            <Briefcase size={16} />
                            {job.type} • {job.schedule}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-jarbou-red bg-red-100 px-3 py-1 rounded-full flex-shrink-0">
                        {jobCategories.find(c => c.id === job.category)?.label}
                      </span>
                    </div>

                    <p className="text-mid-grey mb-6">{job.description}</p>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-mid-grey">
                        Veröffentlicht: {new Date(job.published).toLocaleDateString('de-DE')}
                      </p>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="px-6 py-2 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                      >
                        Details & Bewerbung →
                      </Link>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="text-center py-12"
            >
              <p className="text-lg text-mid-grey mb-4">
                Keine passende Stelle gefunden.
              </p>
              <Link
                href="/initiativbewerbung"
                className="text-jarbou-red hover:underline font-medium"
              >
                Bewirb dich initiativ →
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  )
}
