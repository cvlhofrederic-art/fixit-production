import { getServerTranslation } from '@/lib/i18n/server'

export default async function CookiesPage() {
  const { t } = await getServerTranslation()

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('cookies.title')}</h1>
        <p className="text-gray-500 text-sm mb-8">{t('cookies.lastUpdate')}</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cookies.what.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('cookies.what.p1')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('cookies.used.title')}</h2>

            <div className="space-y-4">
              <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">{t('cookies.necessary.title')}</h3>
                  <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">{t('cookies.necessary.badge')}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('cookies.necessary.desc')}
                </p>
                <table className="mt-3 text-xs text-gray-600 w-full">
                  <thead><tr className="font-semibold text-gray-700"><td className="py-1">{t('cookies.table.name')}</td><td>{t('cookies.table.duration')}</td><td>{t('cookies.table.purpose')}</td></tr></thead>
                  <tbody>
                    <tr><td className="py-0.5 font-mono">sb-access-token</td><td>{t('cookies.table.session')}</td><td>{t('cookies.table.authSupabase')}</td></tr>
                    <tr><td className="py-0.5 font-mono">sb-refresh-token</td><td>{t('cookies.table.sevenDays')}</td><td>{t('cookies.table.keepSession')}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">{t('cookies.performance.title')}</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{t('cookies.performance.badge')}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('cookies.performance.desc')}
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">{t('cookies.personalization.title')}</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{t('cookies.personalization.badge')}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('cookies.personalization.desc')}
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <h3 className="font-bold text-gray-900">{t('cookies.advertising.title')}</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{t('cookies.advertising.badge')}</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {t('cookies.advertising.desc')}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cookies.rights.title')}</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              {t('cookies.rights.p1')}
            </p>
            <p className="text-gray-600 leading-relaxed mb-3">
              {t('cookies.rights.p2')}
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
              <li>{t('cookies.rights.chrome')}</li>
              <li>{t('cookies.rights.firefox')}</li>
              <li>{t('cookies.rights.safari')}</li>
              <li>{t('cookies.rights.edge')}</li>
            </ul>
            <p className="text-gray-500 text-sm mt-3">
              {t('cookies.rights.warning')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{t('cookies.contact.title')}</h2>
            <p className="text-gray-600 leading-relaxed">
              {t('cookies.contact.p1')}{' '}
              <a href="mailto:contact@vitfix.io" className="text-yellow hover:underline">
                contact@vitfix.io
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
