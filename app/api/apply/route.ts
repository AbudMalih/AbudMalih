import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendMail } from '@/lib/mailer'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateUploads } from '@/lib/upload-validation'

export const runtime = 'nodejs'

const CAREER_EMAIL = process.env.CAREER_EMAIL || 'karriere@jarbou-logistik.com'

const applicationSchema = z.object({
  type: z.enum(['job', 'initiative']),
  jobId: z.string().max(100).optional().or(z.literal('')),
  jobTitle: z.string().max(200).optional().or(z.literal('')),
  preferredRole: z.string().max(200).optional().or(z.literal('')),
  firstName: z.string().min(1, 'Vorname ist erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname ist erforderlich').max(100),
  email: z.string().email('Bitte eine gültige E-Mail-Adresse angeben').max(200),
  phone: z.string().min(5, 'Telefonnummer ist erforderlich').max(50),
  city: z.string().max(120).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
  startDate: z.string().max(30).optional().or(z.literal('')),
  drivingLicense: z.string().max(50).optional().or(z.literal('')),
  experience: z.string().max(5000).optional().or(z.literal('')),
  message: z.string().max(5000).optional().or(z.literal('')),
  privacy: z.literal('true', { message: 'Die Datenschutzerklärung muss akzeptiert werden' }),
})

function generateReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const limit = checkRateLimit(`apply:${ip}`)
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

  // Honeypot: real users never fill this hidden field
  if (formData.get('company_website_hp')) {
    return NextResponse.json({ ok: true, reference: generateReference('JL-APP') })
  }

  const fields = Object.fromEntries(
    Array.from(formData.entries()).filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>

  const parsed = applicationSchema.safeParse(fields)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const fieldLabels: Record<string, string> = {
      firstName: 'Vorname', lastName: 'Nachname', email: 'E-Mail-Adresse',
      phone: 'Telefonnummer', privacy: 'Datenschutz-Einwilligung',
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
  const reference = generateReference(d.type === 'initiative' ? 'JL-INI' : 'JL-APP')

  const lines = [
    d.type === 'initiative' ? 'NEUE INITIATIVBEWERBUNG' : 'NEUE BEWERBUNG',
    `Referenz: ${reference}`,
    '',
    d.jobTitle ? `Stelle: ${d.jobTitle}` : null,
    d.jobId ? `Stellen-ID: ${d.jobId}` : null,
    d.preferredRole ? `Gewünschte Rolle: ${d.preferredRole}` : null,
    `Name: ${d.firstName} ${d.lastName}`,
    `E-Mail: ${d.email}`,
    `Telefon: ${d.phone}`,
    d.city ? `Ort/PLZ: ${d.city}` : null,
    d.location ? `Bevorzugter Standort: ${d.location}` : null,
    d.startDate ? `Frühester Start: ${d.startDate}` : null,
    d.drivingLicense ? `Führerschein: ${d.drivingLicense}` : null,
    d.experience ? `\nErfahrung:\n${d.experience}` : null,
    d.message ? `\nNachricht:\n${d.message}` : null,
    '',
    `Anhänge: ${uploads.files.length > 0 ? uploads.files.map(f => f.filename).join(', ') : 'keine'}`,
    `Datenschutz-Einwilligung: ja (${new Date().toISOString()})`,
  ].filter((l): l is string => l !== null)

  try {
    await sendMail({
      to: CAREER_EMAIL,
      subject: `${d.type === 'initiative' ? 'Initiativbewerbung' : 'Bewerbung'}: ${d.firstName} ${d.lastName} (${reference})`,
      text: lines.join('\n'),
      replyTo: d.email,
      attachments: uploads.files,
    })
  } catch (err) {
    console.error('[apply] Mailversand fehlgeschlagen:', err)
    return NextResponse.json(
      { error: 'Die Bewerbung konnte nicht übermittelt werden. Bitte versuchen Sie es später erneut oder senden Sie eine E-Mail an ' + CAREER_EMAIL },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, reference })
}
