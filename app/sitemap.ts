import { MetadataRoute } from 'next'
import { publishedJobs } from '@/lib/data'

const BASE_URL = 'https://www.jarbou-logistik.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '',
    '/leistungen',
    '/fuer-unternehmen',
    '/qualitaet',
    '/ueber-uns',
    '/karriere',
    '/jobs',
    '/bewerbung',
    '/initiativbewerbung',
    '/kontakt',
    '/impressum',
    '/datenschutz',
  ].map(path => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : path === '/karriere' || path === '/jobs' ? 0.9 : 0.7,
  }))

  // Only confirmed active vacancies are listed; drafts/paused/closed are excluded
  const jobPages = publishedJobs.map(job => ({
    url: `${BASE_URL}/jobs/${job.id}`,
    lastModified: job.published ? new Date(job.published) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...jobPages]
}
