'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const roleGroups = [
  {
    title: 'Auf der Straße',
    description: 'Fahrer und Kuriere',
    href: '/jobs?category=driver',
    icon: '🚚',
  },
  {
    title: 'In der Disposition',
    description: 'Disponenten',
    href: '/jobs?category=dispatch',
    icon: '📍',
  },
  {
    title: 'Im Teammanagement',
    description: 'Team- und Standortleiter',
    href: '/jobs?category=team-lead',
    icon: '👥',
  },
  {
    title: 'In Qualität & Reporting',
    description: 'Qualitätsfachkräfte',
    href: '/jobs?category=quality',
    icon: '📊',
  },
]

export default function CareerTeaserSection() {
  return (
    <section className="bg-off-white py-20 md:py-32">
      <div className="section-container">
        {/* Header */}
        <motion.div
          className="mb-16 text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-deep-graphite mb-6">
            Menschen bewegen Logistik.
          </h2>
          <p className="text-lg text-mid-grey mb-8">
            Ob auf der Route, in der Disposition oder in der Qualitätssteuerung: Bei Jarbou zählt, wie du jeden Tag anpackst.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/jobs"
              className="px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              Offene Stellen entdecken <ArrowRight size={20} />
            </Link>
            <Link
              href="/bewerbung"
              className="px-8 py-4 border-2 border-deep-graphite text-deep-graphite font-bold rounded-sm hover:bg-deep-graphite hover:text-off-white transition-colors"
            >
              Direkt bewerben
            </Link>
          </div>
        </motion.div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roleGroups.map((group, index) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white border border-light-grey rounded-sm p-8 hover:border-jarbou-red hover:shadow-lg transition-all group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{group.icon}</div>
              <h3 className="text-lg font-bold text-deep-graphite mb-2">{group.title}</h3>
              <p className="text-sm text-mid-grey mb-6">{group.description}</p>
              <Link
                href={group.href}
                className="text-jarbou-red font-medium text-sm inline-flex items-center gap-2 group-hover:gap-3 transition-all"
              >
                Mehr erfahren <ArrowRight size={16} />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
