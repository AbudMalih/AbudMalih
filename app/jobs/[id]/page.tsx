'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { jobs, locations, jobCategories } from '@/lib/data'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function JobDetailPage() {
  const params = useParams()
  const jobId = params.id as string
  const job = jobs.find(j => j.id === jobId)
  const location = job ? locations.find(l => l.id === job.location) : null
  const category = job ? jobCategories.find(c => c.id === job.category) : null

  if (!job || !location) {
    return (
      <div className="bg-off-white min-h-screen py-20 flex items-center">
        <div className="section-container text-center">
          <h1 className="text-3xl font-bold text-deep-graphite mb-6">Stelle nicht gefunden</h1>
          <Link href="/jobs" className="text-jarbou-red hover:underline font-medium">
            Zurück zu den offenen Stellen →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-off-white min-h-screen py-12">
      <div className="section-container max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Back Button */}
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-jarbou-red hover:gap-3 transition-all font-medium mb-12"
          >
            <ArrowLeft size={20} />
            Zurück zu den Stellen
          </Link>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-start justify-between gap-6 mb-4">
              <div className="flex-1">
                <h1 className="text-4xl md:text-5xl font-bold text-deep-graphite mb-4">
                  {job.title}
                </h1>
                <div className="flex flex-wrap gap-4 text-mid-grey">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{location.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{job.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{job.schedule}</span>
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-jarbou-red bg-red-100 px-4 py-2 rounded-full flex-shrink-0">
                {category?.label}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-12">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">
              {/* Description */}
              <section>
                <h2 className="text-2xl font-bold text-deep-graphite mb-4">Überblick</h2>
                <p className="text-mid-grey leading-relaxed">{job.description}</p>
              </section>

              {/* Responsibilities */}
              <section>
                <h2 className="text-2xl font-bold text-deep-graphite mb-6">Aufgaben</h2>
                <ul className="space-y-3">
                  {job.responsibilities.map((resp) => (
                    <li key={resp} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-jarbou-red rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-mid-grey">{resp}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Requirements */}
              <section>
                <h2 className="text-2xl font-bold text-deep-graphite mb-6">Anforderungen</h2>
                <ul className="space-y-3">
                  {job.requirements.map((req) => (
                    <li key={req} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-jarbou-red rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-mid-grey">{req}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Benefits */}
              <section>
                <h2 className="text-2xl font-bold text-deep-graphite mb-6">Das erwartet Sie</h2>
                <ul className="space-y-3">
                  {job.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-jarbou-red rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-mid-grey">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Info */}
              <div className="bg-white border border-light-grey rounded-sm p-6">
                <h3 className="font-bold text-deep-graphite mb-4">Überblick</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Standort</p>
                    <p className="text-deep-graphite font-medium">{location.city}</p>
                  </div>
                  <div>
                    <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Beschäftigungstyp</p>
                    <p className="text-deep-graphite font-medium">{job.type}</p>
                  </div>
                  <div>
                    <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Arbeitszeit</p>
                    <p className="text-deep-graphite font-medium">{job.schedule}</p>
                  </div>
                  <div>
                    <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Start</p>
                    <p className="text-deep-graphite font-medium">
                      {new Date(job.startDate).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <Link
                href={`/bewerbung?job=${job.id}`}
                className="w-full px-6 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-center text-lg"
              >
                Jetzt bewerben
              </Link>

              {/* Related Jobs */}
              <div className="bg-deep-graphite text-off-white rounded-sm p-6">
                <h3 className="font-bold mb-4">Ähnliche Stellen</h3>
                <div className="space-y-3 text-sm">
                  {jobs
                    .filter(j => j.id !== job.id && j.category === job.category && j.status === 'open')
                    .slice(0, 3)
                    .map(j => (
                      <Link
                        key={j.id}
                        href={`/jobs/${j.id}`}
                        className="block text-jarbou-red hover:underline font-medium"
                      >
                        {j.title}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
