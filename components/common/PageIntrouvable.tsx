import Link from 'next/link'

// Contenu de la page 404 : app/global-not-found.tsx (URL sans route, langue de la requête), app/(commun)/not-found.tsx
// (notFound() d'une page commune, locale du cookie) et app/{pt,fr,en,nl,es}/not-found.tsx (locale du dossier).
const TEXTES = {
  pt: {
    title: 'Página não encontrada',
    desc: 'Desculpe, a página que procura não existe ou foi movida.',
    home: 'Voltar ao início',
    search: 'Encontrar profissional',
    homeHref: '/pt/',
    searchHref: '/pt/pesquisar/',
  },
  fr: {
    title: 'Page non trouvée',
    desc: "Désolé, la page que vous recherchez n'existe pas ou a été déplacée.",
    home: "Retour à l'accueil",
    search: 'Trouver un artisan',
    homeHref: '/fr/',
    searchHref: '/fr/recherche/',
  },
  en: {
    title: 'Page not found',
    desc: 'Sorry, the page you are looking for does not exist or has been moved.',
    home: 'Back to home',
    search: 'Find a professional',
    homeHref: '/en/',
    searchHref: '/en/',
  },
}

export default function PageIntrouvable({ locale }: { locale: string }) {
  const t = TEXTES[locale as keyof typeof TEXTES] || TEXTES.en

  return (
    <div className="min-h-screen bg-warm-gray flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-[7rem] font-display font-extrabold text-yellow leading-none mb-2">404</div>
        <h1 className="text-3xl font-display font-bold text-dark mb-4">
          {t.title}
        </h1>
        <p className="text-text-muted mb-8">
          {t.desc}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={t.homeHref}
            className="bg-yellow hover:bg-yellow-light text-dark px-8 py-3 rounded-full font-display font-bold transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)] hover:-translate-y-0.5"
          >
            {t.home}
          </Link>
          <Link
            href={t.searchHref}
            className="border-[1.5px] border-dark text-dark hover:bg-dark hover:text-white px-8 py-3 rounded-full font-semibold transition-all"
          >
            {t.search}
          </Link>
        </div>
      </div>
    </div>
  )
}
