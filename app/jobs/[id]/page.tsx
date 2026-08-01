'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { publishedJobs, locations, jobCategories, contactInfo } from '@/lib/data'
import { useParams } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function JobDetailPage() {
  const params = useParams()
  const jobId = params.id as string
  // Only jobs with status 'active' AND confirmed:true are publicly reachable.
  // Drafts, paused and closed roles fall through to the notice below.
  const job = publishedJobs.find(j => j.id === jobId)
  const location = job?.location ? locations.find(l => l.id === job.location) : null
  const category = job ? jobCategories.find(c => c.id === job.category) : null

  if (!job) {
    return (
      <div className="bg-off-white min-h-screen py-20 flex items-center">
        <div className="section-container text-center max-w-xl mx-auto">
          <div className="flex justify-center gap-1.5 mb-8" aria-hidden="true">
            <div className="w-1.5 h-12 bg-jarbou-red" style={{ transform: 'skewX(-20deg)' }}></div>
            <div className="w-1.5 h-12 bg-jarbou-red" style={{ transform: 'skewX(-20deg)' }}></div>
          </div>
          <h1 className="text-3xl font-bold text-deep-graphite mb-4">
            Diese Stelle ist derzeit nicht veröffentlicht.
          </h1>
          <p className="text-mid-grey mb-8">
            Die Position wurde geschlossen, pausiert oder ist noch nicht freigegeben. Du kannst uns trotzdem gerne eine Initiativbewerbung senden.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/initiativbewerbung"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
            >
              Initiativ bewerben <ArrowRight size={18} />
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-deep-graphite text-deep-graphite font-bold rounded-sm hover:bg-deep-graphite hover:text-off-white transition-colors"
            >
              Zu den offenen Stellen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // JobPosting structured data – generated ONLY for active, confirmed
  // vacancies (drafts never reach this point). Optional fields are added
  // only when the values have been provided and approved.
  const jobPostingSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Jarbou Logistik GmbH',
      sameAs: 'https://www.jarbou-logistik.com',
    },
    ...(job.published ? { datePosted: job.published } : {}),
    ...(job.expiryDate ? { validThrough: job.expiryDate } : {}),
    ...(job.schedule ? { employmentType: job.schedule === 'Vollzeit' ? 'FULL_TIME' : 'PART_TIME' } : {}),
    ...(location
      ? {
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: location.city,
              addressCountry: 'DE',
            },
          },
        }
      : {}),
  }

  return (
    <div className="bg-off-white min-h-screen py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />
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
                  <span className="font-medium">{location?.city ?? 'Standort auf Anfrage'}</span>
                  {job.type && <span className="font-medium">{job.type}</span>}
                  {job.schedule && <span className="font-medium">{job.schedule}</span>}
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
              <section>
                <h2 className="text-2xl font-bold text-deep-graphite mb-4">Überblick</h2>
                <p className="text-mid-grey leading-relaxed">{job.description}</p>
              </section>

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
                {job.experienceNote && (
                  <p className="text-sm text-mid-grey mt-4 italic">{job.experienceNote}</p>
                )}
              </section>

              {job.benefits && job.benefits.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-deep-graphite mb-6">Das erwartet dich</h2>
                  <ul className="space-y-3">
                    {job.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 bg-jarbou-red rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-mid-grey">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white border border-light-grey rounded-sm p-6">
                <h3 className="font-bold text-deep-graphite mb-4">Überblick</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Standort</p>
                    <p className="text-deep-graphite font-medium">{location?.city ?? 'Auf Anfrage'}</p>
                  </div>
                  {job.type && (
                    <div>
                      <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Beschäftigungstyp</p>
                      <p className="text-deep-graphite font-medium">{job.type}</p>
                    </div>
                  )}
                  {job.schedule && (
                    <div>
                      <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Arbeitszeit</p>
                      <p className="text-deep-graphite font-medium">{job.schedule}</p>
                    </div>
                  )}
                  {job.startDate && (
                    <div>
                      <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Start</p>
                      <p className="text-deep-graphite font-medium">
                        {new Date(job.startDate).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  )}
                  {job.salary && (
                    <div>
                      <p className="text-mid-grey text-xs uppercase tracking-wide font-medium">Vergütung</p>
                      <p className="text-deep-graphite font-medium">{job.salary}</p>
                    </div>
                  )}
                </div>
              </div>

              <Link
                href={`/bewerbung?job=${job.id}`}
                className="block w-full px-6 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-center text-lg"
              >
                Jetzt bewerben
              </Link>

              {/* Related Jobs */}
              {publishedJobs.filter(j => j.id !== job.id && j.category === job.category).length > 0 && (
                <div className="bg-deep-graphite text-off-white rounded-sm p-6">
                  <h3 className="font-bold mb-4">Ähnliche Stellen</h3>
                  <div className="space-y-3 text-sm">
                    {publishedJobs
                      .filter(j => j.id !== job.id && j.category === job.category)
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
              )}

              {/* Recruiting contact */}
              <div className="bg-white border border-light-grey rounded-sm p-6 text-sm">
                <h3 className="font-bold text-deep-graphite mb-2">Fragen zur Stelle?</h3>
                <a href={`mailto:${contactInfo.careerEmail}`} className="text-jarbou-red hover:underline block mb-1">
                  {contactInfo.careerEmail}
                </a>
                <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline block">
                  {contactInfo.phone}
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
