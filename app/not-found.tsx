import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-off-white min-h-screen flex items-center justify-center py-20">
      <div className="section-container text-center">
        <div className="text-8xl font-bold text-jarbou-red mb-4">404</div>
        <h1 className="text-4xl font-bold text-deep-graphite mb-6">
          Seite nicht gefunden
        </h1>
        <p className="text-lg text-mid-grey mb-8 max-w-md mx-auto">
          Die von Ihnen gesuchte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-4 bg-jarbou-red text-white font-bold rounded-sm hover:bg-red-700 transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  )
}
