'use client'

import { motion } from 'framer-motion'
import { contactInfo } from '@/lib/data'

export default function ImpressumPage() {
  return (
    <div className="bg-off-white min-h-screen py-20 md:py-32">
      <div className="section-container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-12">Impressum</h1>

          <div className="space-y-8 text-mid-grey">
            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Angaben gemäß § 5 TMG</h2>
              <p className="font-bold">{contactInfo.company}</p>
              <p>{contactInfo.address}</p>
              <p>{contactInfo.city}, {contactInfo.country}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Kontakt</h2>
              <p>E-Mail: <a href={`mailto:${contactInfo.email}`} className="text-jarbou-red hover:underline">{contactInfo.email}</a></p>
              <p>Telefon: <a href={`tel:${contactInfo.phone}`} className="text-jarbou-red hover:underline">{contactInfo.phone}</a></p>
              <p>Website: <a href={`https://${contactInfo.website}`} className="text-jarbou-red hover:underline">{contactInfo.website}</a></p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
              <p>{contactInfo.company}</p>
              <p>{contactInfo.address}</p>
              <p>{contactInfo.city}, {contactInfo.country}</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Haftungsausschluss</h2>
              <p>
                Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Korrektheit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8–10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Urheberrecht</h2>
              <p>
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des Autors oder Urhebers bzw. Seitenbetreibers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">Hinweis zur Datenschutz</h2>
              <p>
                Informationen zur Verarbeitung Ihrer personenbezogenen Daten finden Sie in unserer <a href="/datenschutz" className="text-jarbou-red hover:underline">Datenschutzerklärung</a>.
              </p>
            </section>
          </div>

          <p className="text-xs text-mid-grey mt-12 pt-12 border-t border-light-grey">
            Hinweis: Diese Impressum-Vorlage ist ein Beispiel und sollte vor der Veröffentlichung durch einen Rechtsanwalt geprüft werden. Bitte beachten Sie auch die geltenden Gesetze und Vorschriften für Ihr Unternehmen.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
