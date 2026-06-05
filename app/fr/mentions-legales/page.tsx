import type { Metadata } from 'next'
import { getServerTranslation } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Mentions légales | Vitfix',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://vitfix.io/fr/mentions-legales/' },
}

export default async function MentionsLegalesPage() {
  const { t } = await getServerTranslation()

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('legal.title')}</h1>
        <p className="text-gray-500 text-sm mb-8">
          {t('legal.subtitle')}
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.editor.title')}</h2>
            <ul className="space-y-2 text-sm">
              <li><strong>Dénomination :</strong> VITFIX</li>
              <li><strong>Forme juridique :</strong> Empresário em Nome Individual (entrepreneur individuel)</li>
              <li><strong>NIF :</strong> 276 873 297</li>
              <li><strong>Siège social :</strong> Portugal</li>
              <li><strong>Email :</strong> <a href="mailto:contact@vitfix.io" className="text-yellow hover:underline">contact@vitfix.io</a></li>
              <li><strong>Téléphone :</strong> <a href="tel:+351912014971" className="text-yellow hover:underline">+351 912 014 971</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.hosting.title')}</h2>
            <ul className="space-y-1 text-sm">
              <li><strong>{t('legal.hosting.company')} :</strong> Cloudflare, Inc.</li>
              <li><strong>{t('legal.hosting.address')} :</strong> 101 Townsend Street, San Francisco, CA 94107, {t('legal.hosting.country')}</li>
              <li><strong>Tél. :</strong> +1 (650) 319-8930</li>
              <li><strong>{t('legal.hosting.website')} :</strong> <a href="https://www.cloudflare.com" className="text-yellow hover:underline" target="_blank" rel="noopener noreferrer">cloudflare.com</a></li>
              <li><strong>Représentant UE (RGPD art. 27) :</strong> Cloudflare Ireland Ltd, 25/28 North Wall Quay, Dublin 1, Irlande</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.ip.title')}</h2>
            <p>
              {t('legal.ip.p1')}
            </p>
            <p className="mt-3">
              {t('legal.ip.p2')}
            </p>
            <p className="mt-3">
              {t('legal.ip.p3')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.trademark.title')}</h2>
            <p>
              {t('legal.trademark.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.liability.title')}</h2>
            <p>
              {t('legal.liability.p1')}
            </p>
            <p className="mt-3">
              {t('legal.liability.p2')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.links.title')}</h2>
            <p>
              {t('legal.links.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.data.title')}</h2>
            <p>
              {t('legal.data.p1')}
            </p>
            <p className="mt-3">
              {t('legal.data.p2')}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Email : <a href="mailto:dpo@vitfix.io" className="text-yellow hover:underline">dpo@vitfix.io</a></li>
            </ul>
            <p className="mt-3">
              {t('legal.data.p3')}{' '}
              <a href="https://www.cnil.fr" className="text-yellow hover:underline ml-1" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.law.title')}</h2>
            <p>
              {t('legal.law.p1')}
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
