'use client'

import { motion } from 'framer-motion'

export default function DatenschutzPage() {
  return (
    <div className="bg-off-white min-h-screen py-20 md:py-32">
      <div className="section-container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-deep-graphite mb-12">Datenschutzerklärung</h1>

          <div className="space-y-8 text-mid-grey">
            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">1. Datenschutz auf einen Blick</h2>
              <p>
                Die Betreiber dieser Seiten nehmen den Schutz Ihrer personenbezogenen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">2. Allgemeine Hinweise</h2>
              <p>
                Personenbezogene Daten sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen. Eine identifizierbare natürliche Person ist eine Person, die direkt oder indirekt, insbesondere mittels Zuordnung zu einer Kennung wie eines Namens, einer Kennnummer, Standortdaten, einer Online-Kennung oder zu einem oder mehreren besonderen Merkmalen, identifiziert werden kann.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">3. Datenerfassung auf unserer Website</h2>
              <h3 className="text-lg font-bold text-deep-graphite mb-3 mt-4">Kontaktformulare</h3>
              <p>
                Wenn Sie uns ein Kontaktformular übermitteln, werden die von Ihnen angegebenen Daten zu dem Zweck gespeichert, um Ihre Anfrage zu bearbeiten. Diese Daten werden nicht an Dritte weitergegeben.
              </p>

              <h3 className="text-lg font-bold text-deep-graphite mb-3 mt-4">Cookies</h3>
              <p>
                Unsere Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Gerät gespeichert werden und die es uns ermöglichen, Sie bei der nächsten Nutzung unserer Website wiederzuerkennen. Sie können die Speicherung von Cookies in Ihren Browser-Einstellungen deaktivieren.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">4. Bewerbungsformulare</h2>
              <p>
                Wenn Sie sich über unser Bewerbungsformular bei Jarbou Logistik bewerben, speichern wir Ihre personenbezogenen Daten zur Bearbeitung Ihrer Bewerbung. Ihre Daten werden nicht an Dritte weitergegeben. Nach Abschluss des Bewerbungsprozesses werden Ihre Daten gemäß geltender Vorschriften gelöscht.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">5. Ihre Rechte</h2>
              <p>
                Sie haben jederzeit das Recht, von uns Auskunft über Ihre personenbezogenen Daten zu erhalten, diese zu korrigieren, zu löschen oder deren Verarbeitung zu beschränken. Um diese Rechte auszuüben, kontaktieren Sie uns bitte unter den im Impressum angegebenen Kontaktdaten.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-deep-graphite mb-4">6. Kontakt und Beschwerden</h2>
              <p>
                Wenn Sie Bedenken bezüglich unserer Datenschutzpraktiken haben, kontaktieren Sie uns bitte unter den im Impressum angegebenen Kontaktdaten. Sie haben zudem das Recht, sich bei einer Datenschutzbehörde zu beschweren.
              </p>
            </section>

            <p className="text-xs text-mid-grey mt-12 pt-12 border-t border-light-grey">
              Hinweis: Diese Datenschutzerklärung ist ein Beispiel und sollte vor der Veröffentlichung durch einen Rechtsanwalt, insbesondere mit Expertise im Datenschutz (DSGVO), geprüft und angepasst werden.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
