'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
import ApplicationForm from '@/components/forms/ApplicationForm'

export default function BewerbungPage() {
  return (
    <div className="bg-off-white min-h-screen py-12 md:py-20">
      <div className="section-container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-4">Bewerbung</h1>
          <p className="text-lg text-mid-grey mb-12">
            Bewerben Sie sich in wenigen Minuten. Wir freuen uns auf Sie!
          </p>

          <Suspense fallback={<div className="text-mid-grey">Formular wird geladen…</div>}>
            <ApplicationForm />
          </Suspense>
        </motion.div>
      </div>
    </div>
  )
}
