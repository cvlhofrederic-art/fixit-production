import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Column 1 - VITFIX */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">{'\u26A1'}</span>
              <span className="text-2xl font-bold text-[#FFC107]">VITFIX</span>
            </div>
            <p className="text-gray-500 mb-4">
              La plateforme de r&eacute;servation d&apos;artisans la plus simple de France.
            </p>
            <ul className="space-y-3 text-gray-500">
              <li>
                <Link href="/a-propos" className="hover:text-[#FFC107] transition">
                  &Agrave; propos
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#FFC107] transition">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-[#FFC107] transition">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2 - Pour les particuliers */}
          <div>
            <h3 className="font-bold mb-4 text-[#FFC107]">Pour les particuliers</h3>
            <ul className="space-y-3 text-gray-500">
              <li>
                <Link href="/recherche" className="hover:text-[#FFC107] transition">
                  Trouver un artisan
                </Link>
              </li>
              <li>
                <Link href="/#comment" className="hover:text-[#FFC107] transition">
                  Comment &ccedil;a marche
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="hover:text-[#FFC107] transition">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/avis" className="hover:text-[#FFC107] transition">
                  Avis clients
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 - Pour les artisans */}
          <div>
            <h3 className="font-bold mb-4 text-[#FFC107]">Pour les artisans</h3>
            <ul className="space-y-3 text-gray-500">
              <li>
                <Link href="/pro/register" className="hover:text-[#FFC107] transition">
                  Devenir artisan partenaire
                </Link>
              </li>
              <li>
                <Link href="/pro/login" className="hover:text-[#FFC107] transition">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/pro/tarifs" className="hover:text-[#FFC107] transition">
                  Nos offres
                </Link>
              </li>
              <li>
                <Link href="/pro/faq" className="hover:text-[#FFC107] transition">
                  FAQ Artisans
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 - Legal */}
          <div>
            <h3 className="font-bold mb-4 text-[#FFC107]">L&eacute;gal</h3>
            <ul className="space-y-3 text-gray-500">
              <li>
                <Link href="/mentions-legales" className="hover:text-[#FFC107] transition">
                  Mentions l&eacute;gales
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="hover:text-[#FFC107] transition">
                  CGU
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="hover:text-[#FFC107] transition">
                  Politique de confidentialit&eacute;
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-[#FFC107] transition">
                  Gestion des cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-10 pt-8 text-center text-gray-500">
          <p>&copy; 2026 VITFIX - Tous droits r&eacute;serv&eacute;s</p>
        </div>
      </div>
    </footer>
  )
}
