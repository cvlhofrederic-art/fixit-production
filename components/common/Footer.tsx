'use client'

import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'

export default function Footer() {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <footer className="bg-dark pt-14 pb-8 px-[5%] text-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-12" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}>
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
            <h4 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.forIndividuals')}
            </h4>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href="/recherche" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.findArtisan')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/#how" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.howItWorks')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/tarifs" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.pricing')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/avis" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.reviews')}
                </LocaleLink>
              </li>
            </ul>
          </div>

          {/* Artisans */}
          <div>
            <h4 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.forArtisans')}
            </h4>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href="/pro/register" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.becomePartner')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/pro/tarifs" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.offers')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/pro/login" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.login')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/pro/faq" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.faq')}
                </LocaleLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display text-[0.85rem] font-bold text-white uppercase tracking-[0.08em] mb-4">
              {t('footer.legal')}
            </h4>
            <ul className="list-none flex flex-col gap-2.5">
              <li>
                <LocaleLink href="/mentions-legales" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.legalNotice')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/cgu" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.terms')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/confidentialite" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.privacy')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/cookies" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.cookies')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink href="/contact" className="text-white/50 no-underline text-[0.88rem] hover:text-white transition-colors">
                  {t('footer.contact')}
                </LocaleLink>
              </li>
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
          <span>{locale === 'fr' ? '🇫🇷' : '🇵🇹'} {locale === 'fr' ? 'Fran\u00e7ais' : 'Portugu\u00eas'}</span>
        </div>
      </div>
    </footer>
  )
}
