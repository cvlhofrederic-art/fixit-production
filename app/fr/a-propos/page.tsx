'use client'

import { useTranslation } from '@/lib/i18n/context'
import Button from '@/components/ui/Button'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

export default function AProposPage() {
  const { t } = useTranslation()
  useScrollAnimation()

  return (
    <div className="min-h-screen bg-warm-gray py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-12 fade-up">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-4xl font-display font-extrabold text-dark"><span className="text-yellow">VIT</span>FIX</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-dark mb-4">
            {t('about.hero.title')}
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            {t('about.hero.subtitle')}
          </p>
        </div>

        {/* Our story */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 fade-up">
          <h2 className="text-2xl font-display font-extrabold tracking-tight text-dark mb-4">{t('about.story.title')}</h2>
          <p className="text-text-muted leading-relaxed mb-4">
            {t('about.story.p1')}
          </p>
          <p className="text-text-muted leading-relaxed">
            {t('about.story.p2')}
          </p>
        </div>

        {/* Values */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 fade-up">
          <h2 className="text-2xl font-display font-extrabold tracking-tight text-dark mb-6">{t('about.values.title')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">{'🔍'}</div>
              <h3 className="font-display font-bold text-dark mb-2">{t('about.values.transparency.title')}</h3>
              <p className="text-text-muted text-sm">
                {t('about.values.transparency.desc')}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">{'⚡'}</div>
              <h3 className="font-display font-bold text-dark mb-2">{t('about.values.speed.title')}</h3>
              <p className="text-text-muted text-sm">
                {t('about.values.speed.desc')}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">{'🛡️'}</div>
              <h3 className="font-display font-bold text-dark mb-2">{t('about.values.trust.title')}</h3>
              <p className="text-text-muted text-sm">
                {t('about.values.trust.desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gradient-to-r from-yellow to-yellow-light rounded-2xl p-8 mb-8 fade-up">
          <h2 className="text-2xl font-display font-extrabold tracking-tight text-dark mb-6 text-center">{t('about.stats.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-display font-bold text-dark">500+</div>
              <div className="text-dark/80 text-sm mt-1">{t('about.stats.artisans')}</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-dark">10 000+</div>
              <div className="text-dark/80 text-sm mt-1">{t('about.stats.interventions')}</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-dark">16</div>
              <div className="text-dark/80 text-sm mt-1">{t('about.stats.trades')}</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-dark">4,8/5</div>
              <div className="text-dark/80 text-sm mt-1">{t('about.stats.rating')}</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center fade-up flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="lg" href="/fr/recherche">
            {t('about.cta.findArtisan')}
          </Button>
          <Button variant="outline" size="lg" href="/contact">
            {t('about.cta.contactUs')}
          </Button>
        </div>
      </div>
    </div>
  )
}
