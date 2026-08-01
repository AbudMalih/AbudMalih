import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendMail } from '@/lib/mailer'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateUploads } from '@/lib/upload-validation'

export const runtime = 'nodejs'

const inquirySchema = z.object({
  companyName: z.string().min(1, 'Unternehmensname ist erforderlich').max(200),
  website: z.string().max(300).optional().or(z.literal('')),
  industry: z.string().min(1, 'Branche ist erforderlich').max(200),
  contact: z.string().min(1, 'Ansprechpartner ist erforderlich').max(200),
  position: z.string().max(200).optional().or(z.literal('')),
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben').max(200),
  phone: z.string().min(5, 'Telefonnummer ist erforderlich').max(50),
  services: z.string().max(2000).optional().or(z.literal('')),
  projectLocation: z.string().min(1, 'Projektstandort ist erforderlich').max(300),
  sites: z.string().max(20).optional().or(z.literal('')),
  volume: z.string().max(200).optional().or(z.literal('')),
  routes: z.string().max(200).optional().or(z.literal('')),
  vehicles: z.string().max(300).optional().or(z.literal('')),
  startDate: z.string().max(30).optional().or(z.literal('')),
  needsPersonnel: z.string().max(10).optional().or(z.literal('')),
  needsDispatch: z.string().max(10).optional().or(z.literal('')),
  needsADR: z.string().max(10).optional().or(z.literal('')),
  challenges: z.string().max(5000).optional().or(z.literal('')),
  description: z.string().min(1, 'Projektbeschreibung ist erforderlich').max(10000),
  privacy: z.literal('true', { message: 'Die Datenschutzerklärung muss akzeptiert werden' }),
})

function generateReference(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `JL-B2B-${Date.now().toString(36).toUpperCase()}-${rand}`
}

export async function POST(request: NextRequest) {
  const recipient = process.env.BUSINESS_INQUIRY_EMAIL
  if (!recipient && process.env.NODE_ENV === 'production') {
    console.error('[business-inquiry] BUSINESS_INQUIRY_EMAIL ist nicht gesetzt.')
    return NextResponse.json(
      { error: 'Der Anfrage-Service ist derzeit nicht verfügbar. Bitte kontaktieren Sie uns telefonisch.' },
      { status: 503 }
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = checkRateLimit(`inquiry:${ip}`)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Zu viele Anfragen. Bitte versuchen Sie es in ${Math.ceil(limit.retryAfterSeconds / 60)} Minuten erneut.` },
      { status: 429 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  // Honeypot
  if (formData.get('company_website_hp')) {
    return NextResponse.json({ ok: true, reference: generateReference() })
  }

  const fields = Object.fromEntries(
    Array.from(formData.entries()).filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>

  const parsed = inquirySchema.safeParse(fields)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const fieldLabels: Record<string, string> = {
      companyName: 'Unternehmensname', industry: 'Branche', contact: 'Ansprechpartner',
      email: 'E-Mail-Adresse', phone: 'Telefonnummer', projectLocation: 'Projektstandort',
      description: 'Projektbeschreibung', privacy: 'Datenschutz-Einwilligung',
    }
    const message = issue && issue.message && !['Invalid input', 'Required'].includes(issue.message)
      ? issue.message
      : `Bitte prüfen Sie das Feld „${fieldLabels[String(issue?.path[0])] || String(issue?.path[0] ?? 'Eingabe')}“.`
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const files = formData.getAll('documents').filter((f): f is File => f instanceof File)
  const uploads = await validateUploads(files)
  if (!uploads.ok) {
    return NextResponse.json({ error: uploads.error }, { status: 400 })
  }

  const d = parsed.data
  const reference = generateReference()

  const lines = [
    'NEUE LOGISTIK-ANFRAGE (B2B)',
    `Referenz: ${reference}`,
    '',
    `Unternehmen: ${d.companyName}`,
    d.website ? `Website: ${d.website}` : null,
    `Branche: ${d.industry}`,
    `Ansprechpartner: ${d.contact}${d.position ? ` (${d.position})` : ''}`,
    `E-Mail: ${d.email}`,
    `Telefon: ${d.phone}`,
    '',
    d.services ? `Benötigte Leistungen: ${d.services}` : null,
    `Projektstandort/Region: ${d.projectLocation}`,
    d.sites ? `Anzahl Standorte: ${d.sites}` : null,
    d.volume ? `Tägliches Volumen: ${d.volume}` : null,
    d.routes ? `Benötigte Touren: ${d.routes}` : null,
    d.vehicles ? `Fahrzeugarten: ${d.vehicles}` : null,
    d.startDate ? `Geplanter Start: ${d.startDate}` : null,
    d.needsPersonnel ? `Personal benötigt: ${d.needsPersonnel}` : null,
    d.needsDispatch ? `Disposition benötigt: ${d.needsDispatch}` : null,
    d.needsADR ? `ADR erforderlich: ${d.needsADR}` : null,
    d.challenges ? `\nAktuelle Herausforderungen:\n${d.challenges}` : null,
    `\nProjektbeschreibung:\n${d.description}`,
    '',
    `Anhänge: ${uploads.files.length > 0 ? uploads.files.map(f => f.filename).join(', ') : 'keine'}`,
    `Datenschutz-Einwilligung: ja (${new Date().toISOString()})`,
  ].filter((l): l is string => l !== null)

  try {
    await sendMail({
      to: recipient || 'dev-fallback@localhost',
      subject: `Logistik-Anfrage: ${d.companyName} (${reference})`,
      text: lines.join('\n'),
      replyTo: d.email,
      attachments: uploads.files,
    })
  } catch (err) {
    console.error('[business-inquiry] Mailversand fehlgeschlagen:', err)
    return NextResponse.json(
      { error: 'Die Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns telefonisch.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, reference })
}
