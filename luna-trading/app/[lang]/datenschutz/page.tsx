import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import { LEGAL_ENTITY as L, PRIVACY_REVIEWED } from "@/content/legal";
import { getDictionary, isLocale, localePath, type Locale } from "@/content/i18n";
import { pageMetadata } from "@/lib/seo";
import s from "@/components/legal/Legal.module.css";

type P = { params: Promise<{ lang: string }> };

const DESCRIPTION: Record<Locale, string> = {
  de: "Datenschutzerklärung der Luna Trading GmbH: welche Daten diese Website verarbeitet, zu welchem Zweck und welche Rechte Sie haben.",
  en: "Privacy policy of Luna Trading GmbH: which data this website processes, for what purpose, and your rights.",
  ar: "سياسة الخصوصية لشركة Luna Trading GmbH: البيانات التي يعالجها هذا الموقع والغرض منها وحقوقكم.",
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return pageMetadata({ locale: lang, path: "/datenschutz", title: getDictionary(lang).legal.datenschutz, description: DESCRIPTION[lang], index: false });
}

/**
 * Datenschutzerklärung. Describes only what the website actually does
 * (audit, October 2026): static pages and the contact endpoint on Vercel,
 * no cookies, no browser storage, no analytics, no third-party requests,
 * self-hosted fonts. German in every locale (authoritative version).
 * Keep in sync with the architecture: mail provider, hosting, any new service.
 */
export default async function Page({ params }: P) {
  const locale = (await params).lang as Locale;
  const d = getDictionary(locale);
  return (
    <PageShell locale={locale} index="§" eyebrow={d.pages.legalEyebrow} title={d.legal.datenschutz} lead={d.pages.legalNote.datenschutz || undefined}>
      <div className={s.doc} lang="de" dir="ltr">
        <h2>1. Verantwortlicher</h2>
        <p>Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website ist:</p>
        <address>
          <span className={s.entity}>{L.name}</span>
          <br />
          {L.street}
          <br />
          {L.postalCode} {L.city}
          <br />
          {L.country}
          <br />
          E-Mail: <a href={`mailto:${L.email}`}>{L.email}</a>
        </address>
        <p>
          Weitere Angaben finden Sie im <Link href={localePath(locale, "/impressum")}>Impressum</Link>.
        </p>

        <h2>2. Das Wichtigste in Kürze</h2>
        <ul>
          <li>Diese Website setzt keine Cookies.</li>
          <li>Sie speichert keine Daten in Ihrem Browser (kein Local Storage, kein Session Storage, keine IndexedDB).</li>
          <li>Es werden keine Analyse-, Tracking- oder Werbedienste und keine Social-Media-Plugins eingesetzt.</li>
          <li>
            Es werden keine Inhalte von Drittanbietern eingebunden. Schriften, Bilder und Skripte werden ausschließlich von dem Server
            dieser Website geladen.
          </li>
          <li>Personenbezogene Daten verarbeiten wir nur, soweit dies für den Betrieb der Website und die Bearbeitung Ihrer Anfragen erforderlich ist.</li>
        </ul>

        <h2>3. Hosting und Server-Logdaten</h2>
        <p>
          Diese Website wird bei der Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, gehostet. Vercel verarbeitet die
          Daten als Auftragsverarbeiter in unserem Auftrag (Art. 28 DSGVO).
        </p>
        <p>
          Beim Aufruf der Website werden technisch notwendige Daten verarbeitet, die Ihr Browser automatisch übermittelt: IP-Adresse,
          Datum und Uhrzeit des Zugriffs, aufgerufene Adresse, Referrer-URL, Browsertyp und -version sowie Betriebssystem
          (User-Agent), HTTP-Statuscode und übertragene Datenmenge.
        </p>
        <p>
          Zweck ist die Auslieferung der Website sowie die Gewährleistung ihrer Stabilität und Sicherheit, insbesondere die Abwehr
          von Angriffen und Missbrauch. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in einem
          sicheren und funktionsfähigen Webangebot. Wir führen diese Daten nicht mit anderen Datenquellen zusammen und werten sie
          nicht zu Analyse- oder Werbezwecken aus. Die Speicherdauer der Logdaten richtet sich nach den Vorgaben von Vercel.
        </p>
        <p>
          Die Inhalte werden über das weltweite Servernetz (Content Delivery Network) von Vercel ausgeliefert. Serverseitige
          Funktionen dieser Website, insbesondere die Verarbeitung des Kontaktformulars, werden in einem Rechenzentrum in Frankfurt am
          Main ausgeführt. Da Vercel ein Unternehmen mit Sitz in den USA ist, kann eine Verarbeitung von Daten in den USA nicht
          ausgeschlossen werden. Eine solche Übermittlung stützt sich auf den Angemessenheitsbeschluss der Europäischen Kommission
          zum EU-US Data Privacy Framework, soweit der Anbieter danach zertifiziert ist, und im Übrigen auf die
          EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
        </p>

        <h2>4. Kontakt per E-Mail</h2>
        <p>
          Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre E-Mail-Adresse, Ihren Namen (sofern angegeben) und den Inhalt
          Ihrer Nachricht, um Ihre Anfrage zu bearbeiten und zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit
          Ihre Anfrage mit einem Vertrag oder dessen Anbahnung zusammenhängt, im Übrigen Art. 6 Abs. 1 lit. f DSGVO; unser
          berechtigtes Interesse liegt in der Beantwortung Ihrer Anfrage.
        </p>
        <p>
          Für den Empfang und die Speicherung von E-Mails setzen wir einen E-Mail-Dienstleister ein, der die Daten in unserem Auftrag
          verarbeitet.
        </p>

        <h2>5. Kontaktformular</h2>
        <p>
          Über das Kontaktformular können Sie uns eine Anfrage senden. Dabei verarbeiten wir die Angaben, die Sie eintragen: Name,
          Unternehmen (freiwillig), E-Mail-Adresse, Art der Anfrage und Nachricht. Pflichtfelder sind gekennzeichnet; ohne diese
          Angaben können wir Ihre Anfrage nicht bearbeiten. Alternativ können Sie uns jederzeit direkt per E-Mail schreiben.
        </p>
        <p>
          Die Angaben werden verschlüsselt an den Server dieser Website übertragen, dort auf Vollständigkeit geprüft und per E-Mail an{" "}
          {L.email} weitergeleitet. Die Website selbst speichert die Inhalte des Formulars nicht in einer Datenbank. Zweck und
          Rechtsgrundlagen entsprechen denen der Kontaktaufnahme per E-Mail (Abschnitt 4).
        </p>
        <h3>Schutz vor Missbrauch</h3>
        <p>
          Zum Schutz vor automatisierten Spam-Einsendungen verwenden wir ausschließlich eigene, technisch einfache Maßnahmen: ein für
          Menschen unsichtbares Feld, eine Prüfung der Zeit zwischen Aufruf und Absenden des Formulars sowie eine Prüfung, ob die
          Anfrage von dieser Website stammt. Um die Zahl der Einsendungen je Absender zu begrenzen, wird die IP-Adresse kurzzeitig im
          Arbeitsspeicher des Servers vorgehalten (höchstens zehn Minuten) und nicht dauerhaft gespeichert. Es werden keine
          Drittanbieter, keine Cookies und kein CAPTCHA eingesetzt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes
          Interesse liegt im Schutz des Formulars vor Missbrauch.
        </p>

        <h2>6. Speicherdauer von Anfragen</h2>
        <p>
          Wir speichern Ihre Anfrage, solange dies für die Bearbeitung Ihres Anliegens erforderlich ist. Ergibt sich daraus eine
          Geschäftsbeziehung oder unterliegen die Nachrichten gesetzlichen Aufbewahrungspflichten, insbesondere nach Handels- und
          Steuerrecht, bewahren wir sie für die Dauer dieser Pflichten auf. Im Übrigen löschen wir die Daten, sobald sie für den Zweck,
          zu dem sie erhoben wurden, nicht mehr erforderlich sind.
        </p>

        <h2>7. Cookies und Speicher im Browser</h2>
        <p>
          Diese Website setzt keine Cookies und legt keine Daten in Ihrem Browser ab.
        </p>
        <p>
          Damit Animationen und die 3D-Darstellung auf Ihrem Gerät flüssig laufen, prüft die Website ausschließlich lokal in Ihrem
          Browser die Bildschirmgröße, Ihre Einstellung für reduzierte Bewegung, die Eingabeart (Maus oder Touch) sowie die Zahl der
          Prozessorkerne und den ungefähren Arbeitsspeicher Ihres Geräts. Diese Werte dienen allein der Anpassung der Darstellung; sie
          werden weder gespeichert noch an uns oder Dritte übermittelt.
        </p>

        <h2>8. Schriftarten</h2>
        <p>
          Die auf dieser Website verwendeten Schriftarten sind lokal eingebunden und werden vom Server dieser Website geladen. Es
          besteht keine Verbindung zu Servern von Schriftanbietern wie Google Fonts.
        </p>

        <h2>9. Keine Analyse, kein Profiling</h2>
        <p>
          Wir setzen keine Werkzeuge zur Reichweitenmessung oder Nutzungsanalyse ein. Eine automatisierte Entscheidungsfindung
          einschließlich Profiling (Art. 22 DSGVO) findet nicht statt.
        </p>

        <h2>10. Verschlüsselung</h2>
        <p>Diese Website nutzt aus Sicherheitsgründen eine TLS-Verschlüsselung (HTTPS) für alle übertragenen Inhalte.</p>

        <h2>11. Ihre Rechte</h2>
        <p>Sie haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf:</p>
        <ul>
          <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO),</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
          <li>Löschung (Art. 17 DSGVO),</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO).</li>
        </ul>
        <p className={s.note}>
          <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Soweit wir Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO
          verarbeiten, können Sie dieser Verarbeitung aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit
          widersprechen.
        </p>
        <p>
          Zur Ausübung Ihrer Rechte genügt eine Nachricht an <a href={`mailto:${L.email}`}>{L.email}</a>.
        </p>
        <p>
          Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in
          dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Für uns zuständig
          ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.
        </p>

        <p className={s.stand}>Stand: {PRIVACY_REVIEWED}</p>
      </div>
    </PageShell>
  );
}
