import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl font-bold text-[#FFC107] mb-4">404</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Page non trouv&eacute;e</h1>
        <p className="text-gray-600 mb-8">
          D&eacute;sol&eacute;, la page que vous recherchez n&apos;existe pas ou a &eacute;t&eacute; d&eacute;plac&eacute;e.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-8 py-3 rounded-lg font-semibold transition"
          >
            Retour &agrave; l&apos;accueil
          </Link>
          <Link
            href="/recherche"
            className="border-2 border-[#FFC107] text-[#FFC107] hover:bg-[#FFF9E6] px-8 py-3 rounded-lg font-semibold transition"
          >
            Trouver un artisan
          </Link>
        </div>
      </div>
    </div>
  )
}
