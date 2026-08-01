'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { jobCategories, locations, contactInfo } from '@/lib/data'
import { CheckCircle2, Upload, X } from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function InitiativeForm() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    preferredRole: '',
    location: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    drivingLicense: '',
    startDate: '',
    experience: '',
    message: '',
    privacy: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServerError(null)
    const selected = Array.from(e.target.files || [])
    for (const f of selected) {
      if (f.size > MAX_FILE_SIZE) {
        setServerError(`Die Datei „${f.name}“ ist größer als 10 MB.`)
        return
      }
    }
    setFiles(prev => [...prev, ...selected].slice(0, 5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setSubmitting(true)

    try {
      const body = new FormData()
      body.set('type', 'initiative')
      body.set('preferredRole', formData.preferredRole)
      body.set('location', locations.find(l => l.id === formData.location)?.city || formData.location)
      body.set('firstName', formData.firstName)
      body.set('lastName', formData.lastName)
      body.set('email', formData.email)
      body.set('phone', formData.phone)
      body.set('drivingLicense', formData.drivingLicense)
      body.set('startDate', formData.startDate)
      body.set('experience', formData.experience)
      body.set('message', formData.message)
      body.set('privacy', String(formData.privacy))
      files.forEach(f => body.append('documents', f))

      const res = await fetch('/api/apply', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        setServerError(data.error || 'Die Bewerbung konnte nicht übermittelt werden.')
        return
      }

      setReference(data.reference)
      setSubmitted(true)
    } catch {
      setServerError('Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.')
    } finally {
      setSubmitting(false)
    }
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
          Deine Initiativbewerbung ist unterwegs.
        </h2>
        <p className="text-mid-grey mb-8">
          Wir prüfen, welche Position und welcher Standort zu dir passen könnten, und melden uns bei dir.
        </p>
        <div className="bg-light-grey rounded-sm p-6 text-left mb-8">
          <p className="text-sm font-medium text-deep-graphite mb-2">
            Referenznummer: {reference}
          </p>
          <p className="text-sm text-mid-grey">
            Kontakt bei Rückfragen: {contactInfo.careerEmail}
          </p>
        </div>
        <Link
          href="/jobs"
          className="inline-block px-6 py-3 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
        >
          Offene Stellen ansehen
        </Link>
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
      {/* Honeypot – hidden from real users, catches bots */}
      <input
        type="text"
        name="company_website_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        onChange={() => {}}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="ini-role" className="block text-sm font-medium text-deep-graphite mb-2">
            Gewünschte Rolle *
          </label>
          <select
            id="ini-role"
            name="preferredRole"
            required
            value={formData.preferredRole}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          >
            <option value="">Bitte wählen...</option>
            {jobCategories.map(cat => (
              <option key={cat.id} value={cat.label}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ini-location" className="block text-sm font-medium text-deep-graphite mb-2">
            Bevorzugter Standort *
          </label>
          <select
            id="ini-location"
            name="location"
            required
            value={formData.location}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          >
            <option value="">Bitte wählen...</option>
            {locations.filter(l => l.active).map(loc => (
              <option key={loc.id} value={loc.id}>{loc.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ini-firstname" className="block text-sm font-medium text-deep-graphite mb-2">
            Vorname *
          </label>
          <input
            id="ini-firstname"
            type="text"
            name="firstName"
            required
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ini-lastname" className="block text-sm font-medium text-deep-graphite mb-2">
            Nachname *
          </label>
          <input
            id="ini-lastname"
            type="text"
            name="lastName"
            required
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ini-email" className="block text-sm font-medium text-deep-graphite mb-2">
            E-Mail *
          </label>
          <input
            id="ini-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ini-phone" className="block text-sm font-medium text-deep-graphite mb-2">
            Telefon *
          </label>
          <input
            id="ini-phone"
            type="tel"
            name="phone"
            required
            autoComplete="tel"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ini-license" className="block text-sm font-medium text-deep-graphite mb-2">
            Führerschein
          </label>
          <select
            id="ini-license"
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
        <div>
          <label htmlFor="ini-start" className="block text-sm font-medium text-deep-graphite mb-2">
            Verfügbar ab
          </label>
          <input
            id="ini-start"
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="ini-exp" className="block text-sm font-medium text-deep-graphite mb-2">
          Deine Erfahrung
        </label>
        <textarea
          id="ini-exp"
          name="experience"
          value={formData.experience}
          onChange={handleChange}
          placeholder="Erzähl uns kurz von deiner relevanten Erfahrung..."
          className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none h-24"
        ></textarea>
      </div>

      <div>
        <label htmlFor="ini-msg" className="block text-sm font-medium text-deep-graphite mb-2">
          Kurze Nachricht
        </label>
        <textarea
          id="ini-msg"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Wo möchtest du Jarbou verstärken?"
          className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none h-24"
        ></textarea>
      </div>

      {/* Documents */}
      <div>
        <span className="block text-sm font-medium text-deep-graphite mb-2">
          Lebenslauf & Dokumente (optional)
        </span>
        <p className="text-xs text-mid-grey mb-3">
          PDF, DOC, DOCX, JPG oder PNG, max. 10 MB pro Datei, max. 5 Dateien.
        </p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-light-grey rounded-sm p-6 cursor-pointer hover:border-jarbou-red transition-colors">
          <Upload size={20} className="text-jarbou-red" />
          <span className="text-mid-grey font-medium">Dateien auswählen oder fotografieren</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between bg-light-grey rounded-sm px-4 py-2 text-sm">
                <span className="truncate text-deep-graphite">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`${f.name} entfernen`}
                  className="text-mid-grey hover:text-jarbou-red transition-colors flex-shrink-0 ml-3"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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

      {serverError && (
        <div role="alert" className="border border-jarbou-red bg-red-50 text-jarbou-red rounded-sm px-4 py-3 text-sm font-medium">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors text-lg disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Wird übermittelt…' : 'Initiativbewerbung absenden'}
      </button>
    </motion.form>
  )
}
