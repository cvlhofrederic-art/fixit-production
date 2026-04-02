import type { Metadata } from 'next'
import { getServerTranslation } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Conditions générales | Vitfix',
  robots: { index: false, follow: true },
}

export default async function CGUPage() {
  const { t } = await getServerTranslation()

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('cgu.title')}
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          {t('cgu.lastUpdate')}
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* Preamble */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.preamble.title')}</h2>
            <p>
              {t('cgu.preamble.p1')}
            </p>
            <p className="mt-3">
              {t('cgu.preamble.p2')}
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.preamble.law1')}</li>
              <li>{t('cgu.preamble.law2')}</li>
              <li>{t('cgu.preamble.law3')}</li>
              <li>{t('cgu.preamble.law4')}</li>
              <li>{t('cgu.preamble.law5')}</li>
            </ul>
          </section>

          {/* Article 1 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art1.title')}</h2>
            <ul className="space-y-2 text-sm">
              <li><strong>{t('cgu.art1.platform.label')}</strong> {t('cgu.art1.platform.desc')}</li>
              <li><strong>{t('cgu.art1.user.label')}</strong> {t('cgu.art1.user.desc')}</li>
              <li><strong>{t('cgu.art1.client.label')}</strong> {t('cgu.art1.client.desc')}</li>
              <li><strong>{t('cgu.art1.artisan.label')}</strong> {t('cgu.art1.artisan.desc')}</li>
              <li><strong>{t('cgu.art1.service.label')}</strong> {t('cgu.art1.service.desc')}</li>
              <li><strong>{t('cgu.art1.booking.label')}</strong> {t('cgu.art1.booking.desc')}</li>
              <li><strong>{t('cgu.art1.account.label')}</strong> {t('cgu.art1.account.desc')}</li>
            </ul>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art2.title')}</h2>
            <p>{t('cgu.art2.p1')}</p>
            <p className="mt-3">{t('cgu.art2.p2')}</p>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art3.title')}</h2>
            <h3 className="font-semibold text-gray-900 mb-2">{t('cgu.art3.sub1.title')}</h3>
            <p>{t('cgu.art3.sub1.p1')}</p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">{t('cgu.art3.sub2.title')}</h3>
            <p>{t('cgu.art3.sub2.p1')}</p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">{t('cgu.art3.sub3.title')}</h3>
            <p>{t('cgu.art3.sub3.p1')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art3.sub3.req1')}</li>
              <li>{t('cgu.art3.sub3.req2')}</li>
              <li>{t('cgu.art3.sub3.req3')}</li>
            </ul>
            <p className="mt-3">{t('cgu.art3.sub3.p2')}</p>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art4.title')}</h2>
            <p>{t('cgu.art4.p1')}</p>
            <p className="mt-3">{t('cgu.art4.p2')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art4.item1')}</li>
              <li>{t('cgu.art4.item2')}</li>
              <li>{t('cgu.art4.item3')}</li>
              <li>{t('cgu.art4.item4')}</li>
            </ul>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art5.title')}</h2>
            <h3 className="font-semibold text-gray-900 mb-2">{t('cgu.art5.sub1.title')}</h3>
            <p>{t('cgu.art5.sub1.p1')}</p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">{t('cgu.art5.sub2.title')}</h3>
            <p>{t('cgu.art5.sub2.p1')}</p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">{t('cgu.art5.sub3.title')}</h3>
            <p>{t('cgu.art5.sub3.p1')}</p>
            <h3 className="font-semibold text-gray-900 mb-2 mt-4">{t('cgu.art5.sub4.title')}</h3>
            <p>{t('cgu.art5.sub4.p1')}</p>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art6.title')}</h2>
            <p>{t('cgu.art6.intro')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art6.item1')}</li>
              <li>{t('cgu.art6.item2')}</li>
              <li>{t('cgu.art6.item3')}</li>
              <li>{t('cgu.art6.item4')}</li>
              <li>{t('cgu.art6.item5')}</li>
              <li>{t('cgu.art6.item6')}</li>
              <li>{t('cgu.art6.item7')}</li>
              <li>{t('cgu.art6.item8')}</li>
            </ul>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art7.title')}</h2>
            <p>{t('cgu.art7.intro')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art7.item1')}</li>
              <li>{t('cgu.art7.item2')}</li>
              <li>{t('cgu.art7.item3')}</li>
              <li>{t('cgu.art7.item4')}</li>
              <li>{t('cgu.art7.item5')}</li>
            </ul>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art8.title')}</h2>
            <p>{t('cgu.art8.p1')}</p>
            <p className="mt-3">{t('cgu.art8.p2')}</p>
            <p className="mt-3">{t('cgu.art8.p3')}</p>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art9.title')}</h2>
            <p>{t('cgu.art9.p1')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art9.item1')}</li>
              <li>{t('cgu.art9.item2')}</li>
              <li>{t('cgu.art9.item3')}</li>
            </ul>
            <p className="mt-3">{t('cgu.art9.p2')}</p>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art10.title')}</h2>
            <p>{t('cgu.art10.p1')}</p>
            <p className="mt-3">{t('cgu.art10.p2')}</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>{t('cgu.art10.right1')}</li>
              <li>{t('cgu.art10.right2')}</li>
              <li>{t('cgu.art10.right3')}</li>
              <li>{t('cgu.art10.right4')}</li>
              <li>{t('cgu.art10.right5')}</li>
              <li>{t('cgu.art10.right6')}</li>
            </ul>
            <p className="mt-3">
              {t('cgu.art10.p3')}{' '}
              <a href="mailto:dpo@vitfix.io" className="text-yellow hover:underline">dpo@vitfix.io</a>.
              {' '}{t('cgu.art10.p4')}{' '}
              (<a href="https://www.cnil.fr" className="text-yellow hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
            </p>
            <p className="mt-3">
              {t('cgu.art10.p5')}{' '}
              <a href="/confidentialite" className="text-yellow hover:underline">{t('cgu.art10.privacyLink')}</a>.
            </p>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art11.title')}</h2>
            <p>{t('cgu.art11.p1')}</p>
            <p className="mt-3">{t('cgu.art11.p2')}</p>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art12.title')}</h2>
            <p>{t('cgu.art12.p1')}</p>
            <p className="mt-3">
              {t('cgu.art12.p2')}{' '}
              <a href="https://ec.europa.eu/consumers/odr" className="text-yellow hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art13.title')}</h2>
            <p>{t('cgu.art13.p1')}</p>
            <p className="mt-3">{t('cgu.art13.p2')}</p>
            <p className="mt-3">{t('cgu.art13.p3')}</p>
          </section>

          {/* Article 14 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.art14.title')}</h2>
            <p>{t('cgu.art14.p1')}</p>
            <p className="mt-3">{t('cgu.art14.p2')}</p>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-100 pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cgu.contact.title')}</h2>
            <p>{t('cgu.contact.intro')}</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li><strong>Vitfix SAS</strong></li>
              <li>{t('cgu.contact.email')} <a href="mailto:contact@vitfix.io" className="text-yellow hover:underline">contact@vitfix.io</a></li>
              <li>{t('cgu.contact.dpo')} <a href="mailto:dpo@vitfix.io" className="text-yellow hover:underline">dpo@vitfix.io</a></li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
