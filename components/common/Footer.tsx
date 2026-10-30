'use client'

import { useTranslation, useLocale } from '@/lib/i18n/context'
import { LIENS_ENTETE_PIED } from '@/lib/i18n/liens-entete-pied'
import LocaleLink from '@/components/common/LocaleLink'

// Liens rendus seulement en FR et PT : plan du site ; hub des villes (phase 1 SEO PT, point 1.8) et hubs de section
// (phase 4), pour PT seulement. Liens rendus dans toutes les langues : lib/i18n/liens-entete-pied.ts.
const localePaths = {
  sitemap:      { fr: '/plan-du-site', pt: '/mapa-do-site' },
  cities:       { fr: '/ville', pt: '/cidade' },
  services:     { fr: '/services', pt: '/servicos' },
  urgency:      { fr: '/urgence', pt: '/urgencia' },
  nearMe:       { fr: '/pres-de-chez-moi', pt: '/perto-de-mim' },
} as const

export default function Footer() {
  const { t } = useTranslation()
  const locale = useLocale()
  const lp = (key: keyof typeof localePaths) => localePaths[key][locale as keyof (typeof localePaths)[typeof key]] || localePaths[key]['fr']

  return (
    <footer className="bg-dark pt-14 pb-8 px-[5%] text-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-12 mb-12">
          {/* Brand */}
          <div>
            <LocaleLink href="/" className="font-display font-extrabold text-[1.4rem] text-white no-underline inline-flex items-center gap-1.5 mb-3.5">
              <span className="text-yellow">VIT</span>FIX
            </LocaleLink>
            <p className="text-[0.85rem] leading-relaxed max-w-[220px]">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Particuliers */}
          <div>
            <h2 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.forIndividuals')}
            </h2>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.recherche[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.findArtisan')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/#how" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.howItWorks')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.tarifs[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.pricing')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.avis[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.reviews')}
                </LocaleLink>
              </li>
              {locale === 'pt' && (
                <>
                  <li>
                    <LocaleLink href={lp('services')} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                      Todos os serviços
                    </LocaleLink>
                  </li>
                  <li>
                    <LocaleLink href={lp('urgency')} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                      Urgência
                    </LocaleLink>
                  </li>
                  <li>
                    <LocaleLink href={lp('nearMe')} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                      Perto de mim
                    </LocaleLink>
                  </li>
                  <li>
                    <LocaleLink href={lp('cities')} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                      Cidades cobertas
                    </LocaleLink>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Artisans */}
          <div>
            <h2 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.forArtisans')}
            </h2>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.devenirPartenaire[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.becomePartner')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.offresPro[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.offers')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.connexion[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.login')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.faqPro[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.faq')}
                </LocaleLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h2 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.legal')}
            </h2>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.mentionsLegales[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.legalNotice')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.cgu[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.terms')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.confidentialite[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.privacy')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.cookies[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.cookies')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href={LIENS_ENTETE_PIED.contact[locale]} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.contact')}
                </LocaleLink>
              </li>
              {(locale === 'fr' || locale === 'pt') && (
                <li>
                  <LocaleLink href={lp('sitemap')} className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                    {locale === 'pt' ? 'Mapa do site' : 'Plan du site'}
                  </LocaleLink>
                </li>
              )}
              {locale === 'pt' && (
                <li>
                  <a href="https://www.livroreclamacoes.pt/" target="_blank" rel="noopener noreferrer"
                    className="text-white/40 hover:text-white transition text-sm no-underline">
                    {t('footer.livroReclamacoes')}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/8 pt-6 flex items-center justify-between text-[0.82rem] flex-wrap gap-3">
          <span>{t('footer.copyright')}</span>
          <div className="flex items-center gap-3">
            {locale === 'pt' && <span className="text-white/30">NIF 276 873 297</span>}
            <span>{locale === 'fr' ? '🇫🇷' : '🇵🇹'} {locale === 'fr' ? 'Fran\u00e7ais' : 'Portugu\u00eas'}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
