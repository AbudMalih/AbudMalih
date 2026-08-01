'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { jobs, locations, jobCategories } from '@/lib/data'
import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function ApplicationForm() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')
  const preselectedJob = jobs.find(j => j.id === jobId)

  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    jobId: jobId || '',
    location: '',
    startDate: '',
    fullTime: true,
    drivingLicense: '',
    experience: '',
    cv: '',
    privacy: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Application submitted:', formData)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white border-2 border-jarbou-red rounded-sm p-12 text-center"
      >
        <CheckCircle2 className="w-16 h-16 text-jarbou-red mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-deep-graphite mb-4">
          Deine Bewerbung ist unterwegs.
        </h2>
        <p className="text-mid-grey mb-8">
          Vielen Dank, dass du dich bei Jarbou Logistik beworben hast. Unser Recruiting-Team prüft deine Angaben und meldet sich bei dir.
        </p>
        <div className="bg-light-grey rounded-sm p-6 text-left mb-8">
          <p className="text-sm font-medium text-deep-graphite mb-2">
            Referenznummer: JL-APP-{Date.now().toString().slice(-8)}
          </p>
          <p className="text-sm text-mid-grey">
            Bestätigung an: {formData.email}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
        >
          Zur Startseite
        </button>
      </motion.div>
    )
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white border border-light-grey rounded-sm p-8 md:p-12 space-y-6"
    >
      {/* Job Selection */}
      <div>
        <label className="block text-sm font-medium text-deep-graphite mb-2">
          Gewünschte Stelle *
        </label>
        <select
          name="jobId"
          required
          value={formData.jobId}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
        >
          <option value="">Bitte wählen...</option>
          {jobs.filter(j => j.status === 'open').map(job => (
            <option key={job.id} value={job.id}>
              {job.title} - {locations.find(l => l.id === job.location)?.city}
            </option>
          ))}
        </select>
      </div>

      {/* Personal Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            Vorname *
          </label>
          <input
            type="text"
            name="firstName"
            required
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            Nachname *
          </label>
          <input
            type="text"
            name="lastName"
            required
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            E-Mail *
          </label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            Telefon *
          </label>
          <input
            type="tel"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
      </div>

      {/* Location & Start */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            Bevorzugter Standort *
          </label>
          <select
            name="location"
            required
            value={formData.location}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          >
            <option value="">Bitte wählen...</option>
            {locations.filter(l => l.active && l.recruiting).map(loc => (
              <option key={loc.id} value={loc.id}>{loc.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-deep-graphite mb-2">
            Frühestmöglicher Start
          </label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
      </div>

      {/* Qualifications */}
      <div>
        <label className="block text-sm font-medium text-deep-graphite mb-2">
          Führerschein
        </label>
        <select
          name="drivingLicense"
          value={formData.drivingLicense}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
        >
          <option value="">Bitte wählen...</option>
          <option value="keine">Keinen</option>
          <option value="b">Klasse B</option>
          <option value="c">Klasse C</option>
          <option value="c1">Klasse C1</option>
        </select>
      </div>

      {/* Experience */}
      <div>
        <label className="block text-sm font-medium text-deep-graphite mb-2">
          Kurze Beschreibung Ihrer Erfahrung
        </label>
        <textarea
          name="experience"
          value={formData.experience}
          onChange={handleChange}
          placeholder="Erzählen Sie uns kurz von Ihrer relevanten Erfahrung..."
          className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none h-24"
        ></textarea>
      </div>

      {/* Privacy Consent */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="privacy"
          required
          checked={formData.privacy}
          onChange={handleChange}
          className="w-5 h-5 accent-jarbou-red mt-1 flex-shrink-0"
        />
        <span className="text-mid-grey text-sm">
          Ich akzeptiere die <a href="/datenschutz" className="text-jarbou-red hover:underline">Datenschutzerklärung</a> und erlaube Jarbou, mich zu kontaktieren. *
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        className="w-full px-6 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-lg"
      >
        Bewerbung absenden
      </button>
    </motion.form>
  )
}
