import { getServerTranslation } from '@/lib/i18n/server'

export default async function ConfidentialitePage() {
  const { t } = await getServerTranslation()

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('privacy.title')}</h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.collection.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.collection.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.usage.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.usage.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li>{t('privacy.usage.item1')}</li>
              <li>{t('privacy.usage.item2')}</li>
              <li>{t('privacy.usage.item3')}</li>
              <li>{t('privacy.usage.item4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.protection.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.protection.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.rights.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.rights.intro')}
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
              <li><strong>{t('privacy.rights.access.label')}</strong> {t('privacy.rights.access.desc')}</li>
              <li><strong>{t('privacy.rights.rectification.label')}</strong> {t('privacy.rights.rectification.desc')}</li>
              <li><strong>{t('privacy.rights.erasure.label')}</strong> {t('privacy.rights.erasure.desc')}</li>
              <li><strong>{t('privacy.rights.portability.label')}</strong> {t('privacy.rights.portability.desc')}</li>
              <li><strong>{t('privacy.rights.opposition.label')}</strong> {t('privacy.rights.opposition.desc')}</li>
            </ul>
            <p className="text-gray-600 mt-3">
              {t('privacy.rights.contactInfo')} <strong>dpo@vitfix.io</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.cookies.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.cookies.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.retention.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.retention.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.contact.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('privacy.contact.p1')}
              <strong> dpo@vitfix.io</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
