'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Upload, X } from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function BusinessEnquiryForm() {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    companyName: '',
    website: '',
    industry: '',
    contact: '',
    position: '',
    email: '',
    phone: '',
    location: '',
    services: [] as string[],
    projectLocation: '',
    sites: '',
    volume: '',
    routes: '',
    vehicles: '',
    startDate: '',
    duration: '',
    workHours: '',
    needsPersonnel: '',
    needsDispatch: '',
    needsADR: '',
    challenges: '',
    description: '',
    privacy: false,
  })

  const totalSteps = 5

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement
      if (name === 'services') {
        setFormData(prev => ({
          ...prev,
          services: target.checked
            ? [...prev.services, value]
            : prev.services.filter(s => s !== value)
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: target.checked
        }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
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
    if (step < totalSteps) {
      setStep(step + 1)
      return
    }

    setServerError(null)
    setSubmitting(true)

    try {
      const body = new FormData()
      body.set('companyName', formData.companyName)
      body.set('website', formData.website)
      body.set('industry', formData.industry)
      body.set('contact', formData.contact)
      body.set('position', formData.position)
      body.set('email', formData.email)
      body.set('phone', formData.phone)
      body.set('services', formData.services.join(', '))
      body.set('projectLocation', formData.projectLocation)
      body.set('sites', formData.sites)
      body.set('volume', formData.volume)
      body.set('routes', formData.routes)
      body.set('vehicles', formData.vehicles)
      body.set('startDate', formData.startDate)
      body.set('needsPersonnel', formData.needsPersonnel)
      body.set('needsDispatch', formData.needsDispatch)
      body.set('needsADR', formData.needsADR)
      body.set('challenges', formData.challenges)
      body.set('description', formData.description)
      body.set('privacy', String(formData.privacy))
      files.forEach(f => body.append('documents', f))

      const res = await fetch('/api/business-inquiry', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) {
        setServerError(data.error || 'Die Anfrage konnte nicht übermittelt werden.')
        return
      }

      setReference(data.reference)
      setSubmitted(true)
    } catch {
      setServerError('Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-off-white rounded-sm p-12 md:p-16 text-center border-2 border-jarbou-red"
      >
        <CheckCircle2 className="w-16 h-16 text-jarbou-red mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-deep-graphite mb-4">
          Vielen Dank. Ihre Anfrage ist bei uns angekommen.
        </h2>
        <p className="text-mid-grey mb-8">
          Unser Team prüft Ihre Angaben und meldet sich schnellstmöglich persönlich bei Ihnen.
        </p>
        <div className="bg-light-grey rounded-sm p-6 text-left mb-8">
          <p className="text-sm font-medium text-deep-graphite mb-2">
            Referenznummer: {reference}
          </p>
          <p className="text-sm text-mid-grey">
            Unser Team meldet sich persönlich bei Ihnen unter {formData.email}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
        >
          Zurück zur Startseite
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-deep-graphite mb-4">
          Logistikbedarf anfragen
        </h2>
        <p className="text-lg text-mid-grey max-w-2xl mx-auto">
          Beantworten Sie einige kurze Fragen. Dadurch können wir Ihren Bedarf gezielt prüfen und schneller mit einer passenden Lösung antworten.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-12">
        <div className="flex justify-between mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i + 1}
              className={`h-2 flex-1 mx-1 rounded-full transition-colors ${
                i + 1 <= step ? 'bg-jarbou-red' : 'bg-light-grey'
              }`}
            ></div>
          ))}
        </div>
        <p className="text-sm text-mid-grey text-center">
          Schritt {step} von {totalSteps}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
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
        {/* Step 1: Company */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-deep-graphite mb-8">Unternehmensdetails</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input
                type="text"
                name="companyName"
                placeholder="Unternehmensname *"
                required
                value={formData.companyName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="url"
                name="website"
                placeholder="Website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="industry"
                placeholder="Branche *"
                required
                value={formData.industry}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="contact"
                placeholder="Ansprechpartner *"
                required
                value={formData.contact}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="position"
                placeholder="Position"
                value={formData.position}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="email"
                name="email"
                placeholder="E-Mail *"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="tel"
                name="phone"
                placeholder="Telefonnummer *"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
            </div>
          </motion.div>
        )}

        {/* Step 2: Services */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-deep-graphite mb-8">Benötigte Leistungen</h3>
            <div className="space-y-4">
              {[
                'Paketzustellung',
                'Abholtouren',
                'CEP-Dienstleistungen',
                'Express-Touren',
                'Eigene Disposition',
                'Tourenplanung',
                'Standortmanagement',
                'Flottenmanagement',
                'Qualitätsreporting',
                'ADR / Gefahrgut',
                'Sonstiger Bedarf',
              ].map(service => (
                <label key={service} className="flex items-center gap-3 cursor-pointer p-3 border border-light-grey rounded-sm hover:border-jarbou-red transition-colors">
                  <input
                    type="checkbox"
                    name="services"
                    value={service}
                    checked={formData.services.includes(service)}
                    onChange={handleChange}
                    className="w-5 h-5 accent-jarbou-red"
                  />
                  <span className="text-mid-grey">{service}</span>
                </label>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Project Details */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-deep-graphite mb-8">Projektdetails</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input
                type="text"
                name="projectLocation"
                placeholder="Projektstandort oder Region *"
                required
                value={formData.projectLocation}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="number"
                name="sites"
                placeholder="Anzahl Standorte"
                value={formData.sites}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="volume"
                placeholder="Tägliches Sendungs-/Stoppvolumen"
                value={formData.volume}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="routes"
                placeholder="Benötigte Touren"
                value={formData.routes}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="text"
                name="vehicles"
                placeholder="Benötigte Fahrzeugarten"
                value={formData.vehicles}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
              <input
                type="date"
                name="startDate"
                placeholder="Geplanter Projektstart"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
              />
            </div>
          </motion.div>
        )}

        {/* Step 4: Requirements */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-deep-graphite mb-8">Anforderungen</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <select
                  name="needsPersonnel"
                  value={formData.needsPersonnel}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
                >
                  <option value="">Wird Personal benötigt?</option>
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                </select>
              </label>
              <label className="flex items-center gap-3">
                <select
                  name="needsDispatch"
                  value={formData.needsDispatch}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
                >
                  <option value="">Wird Disposition benötigt?</option>
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                </select>
              </label>
              <label className="flex items-center gap-3">
                <select
                  name="needsADR"
                  value={formData.needsADR}
                  onChange={handleChange}
                  className="flex-1 px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none"
                >
                  <option value="">Sind ADR-Leistungen erforderlich?</option>
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                </select>
              </label>
              <textarea
                name="challenges"
                placeholder="Aktuelle Herausforderungen"
                value={formData.challenges}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none h-24"
              ></textarea>
              <textarea
                name="description"
                placeholder="Detaillierte Projektbeschreibung *"
                required
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-light-grey rounded-sm focus:border-jarbou-red focus:outline-none h-24"
              ></textarea>
            </div>
          </motion.div>
        )}

        {/* Step 5: Documents & Consent */}
        {step === totalSteps && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-bold text-deep-graphite mb-8">Dokumente & Bestätigung</h3>

            {/* Documents */}
            <div>
              <span className="block text-sm font-medium text-deep-graphite mb-2">
                Projektunterlagen (optional)
              </span>
              <p className="text-xs text-mid-grey mb-3">
                Ausschreibung, Leistungsbeschreibung, Tourendaten, Forecast. PDF, DOCX, XLSX oder CSV, max. 10 MB pro Datei, max. 5 Dateien.
              </p>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-light-grey rounded-sm p-6 cursor-pointer hover:border-jarbou-red transition-colors">
                <Upload size={20} className="text-jarbou-red" />
                <span className="text-mid-grey font-medium">Dateien auswählen</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.xlsx,.csv"
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
              <span className="text-mid-grey">
                Ich akzeptiere die <a href="/datenschutz" className="text-jarbou-red hover:underline">Datenschutzerklärung</a> und erlaube Jarbou, mich zu kontaktieren. *
              </span>
            </label>
          </motion.div>
        )}

        {/* Server error */}
        {serverError && (
          <div role="alert" className="border border-jarbou-red bg-red-50 text-jarbou-red rounded-sm px-4 py-3 text-sm font-medium">
            {serverError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 pt-8">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 border border-light-grey text-deep-graphite font-bold rounded-sm hover:border-jarbou-red transition-colors flex-1 md:flex-none"
            >
              Zurück
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors flex-1 md:flex-none ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Wird übermittelt…' : step === totalSteps ? 'Anfrage sicher übermitteln' : 'Weiter'}
          </button>
        </div>
      </form>
    </motion.div>
  )
}
