'use client'

import { useTranslation, useLocale } from '@/lib/i18n/context'
import DevisFactureForm from '@/components/DevisFactureForm'

interface DevisSectionProps {
  artisan: any
  services: any[]
  bookings: any[]
  savedDocuments: any[]
  setSavedDocuments: (docs: any[]) => void
  showDevisForm: boolean
  setShowDevisForm: (v: boolean) => void
  convertingDevis: any
  setConvertingDevis: (v: any) => void
  convertDevisToFacture: (doc: any) => void
}

export default function DevisSection({
  artisan, services, bookings, savedDocuments, setSavedDocuments,
  showDevisForm, setShowDevisForm, convertingDevis, setConvertingDevis,
  convertDevisToFacture,
}: DevisSectionProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const refreshDocuments = () => {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    setSavedDocuments([...docs, ...drafts])
  }

  if (showDevisForm) {
    return (
      <DevisFactureForm artisan={artisan} services={services} bookings={bookings} initialDocType="devis"
        initialData={convertingDevis}
        onBack={() => { setShowDevisForm(false); setConvertingDevis(null); refreshDocuments() }}
        onSave={() => { setConvertingDevis(null); refreshDocuments() }}
      />
    )
  }

  const devisDocs = savedDocuments.filter(d => d.docType === 'devis')

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`📄 ${t('proDash.devis.title')}`} subtitle={t('proDash.devis.subtitle')} actionLabel={t('proDash.devis.nouveauDevis')} onAction={() => setShowDevisForm(true)} />
      <div className="p-6 lg:p-8">
        {/* Compteurs */}
        {devisDocs.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-[#2C3E50]">{devisDocs.length}</div>
              <div className="text-xs text-gray-500">{t('proDash.devis.totalDevis')}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-blue-600">{devisDocs.filter(d => d.status === 'envoye').length}</div>
              <div className="text-xs text-gray-500">{t('proDash.devis.envoyes')}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-amber-600">{devisDocs.filter(d => d.status !== 'envoye').length}</div>
              <div className="text-xs text-gray-500">{t('proDash.devis.nonEnvoyes')}</div>
            </div>
          </div>
        )}

        {/* Liste des devis */}
        <div className="space-y-3">
          {devisDocs.sort((a, b) => new Date(b.savedAt || b.docDate).getTime() - new Date(a.savedAt || a.docDate).getTime()).map((doc, i) => {
            const totalHT = doc.lines?.reduce((s: number, l: any) => s + (l.totalHT || 0), 0) || 0
            return (
              <div key={`saved-dev-${i}`} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition border border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-[#FFC107] text-gray-900 text-xs font-bold px-2.5 py-1 rounded-lg">{doc.docNumber}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${doc.status === 'envoye' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-orange-700 border border-amber-200'}`}>
                        {doc.status === 'envoye' ? `✅ ${t('proDash.devis.envoye')}` : `⏳ ${t('proDash.devis.nonEnvoye')}`}
                      </span>
                      {doc.sentAt && (
                        <span className="text-[10px] text-gray-400">
                          {t('proDash.devis.envoyeLe')} {new Date(doc.sentAt).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })} {t('proDash.common.a')} {new Date(doc.sentAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {doc.docTitle && <p className="font-semibold text-[#2C3E50] mb-1">{doc.docTitle}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>{'👤'} {doc.clientName || t('proDash.devis.clientNonRenseigne')}</span>
                      <span>{'📅'} {doc.docDate ? new Date(doc.docDate).toLocaleDateString(dateLocale) : '-'}</span>
                      {doc.docValidity && <span>{'⏱️'} {t('proDash.devis.validite')} : {doc.docValidity}{t('proDash.common.jours')}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-[#2C3E50]">{totalHT.toFixed(2)} €</div>
                    <div className="text-xs text-gray-500">{t('proDash.common.ht')}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button onClick={() => { setConvertingDevis(doc); setShowDevisForm(true) }}
                    className="bg-white text-gray-600 border-2 border-gray-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                    {'✏️'} {t('proDash.devis.modifier')}
                  </button>
                  <button onClick={() => convertDevisToFacture(doc)}
                    className="bg-[#FFC107] text-gray-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FFD54F] shadow-sm transition text-sm">
                    {'🧾'} {t('proDash.devis.convertirFacture')}
                  </button>
                  {doc.status !== 'envoye' && (
                    <button onClick={() => {
                      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                      const now = new Date().toISOString()
                      const updDocs = docs.map((d: any) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                      const updDrafts = drafts.map((d: any) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                      localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                      localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                      setSavedDocuments([...updDocs, ...updDrafts])
                    }}
                      className="bg-green-50 text-green-700 border-2 border-green-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-green-100 transition text-sm">
                      {'✅'} {t('proDash.devis.marquerEnvoye')}
                    </button>
                  )}
                  {doc.clientEmail && (
                    <button onClick={() => {
                      const subject = encodeURIComponent(`${t('proDash.devis.title')} ${doc.docNumber} — ${artisan?.company_name || 'Fixit'}`)
                      const body = encodeURIComponent(`${locale === 'pt' ? 'Olá' : 'Bonjour'} ${doc.clientName || ''},\n\n${locale === 'pt' ? `Segue em anexo o seu orçamento N.º${doc.docNumber} no valor de ${totalHT.toFixed(2)} € s/ IVA.` : `Veuillez trouver ci-joint votre devis N°${doc.docNumber} d'un montant de ${totalHT.toFixed(2)} € HT.`}\n\n${locale === 'pt' ? 'Com os melhores cumprimentos' : 'Cordialement'},\n${artisan?.company_name || ''}${artisan?.phone ? '\n' + artisan.phone : ''}`)
                      window.open(`mailto:${doc.clientEmail}?subject=${subject}&body=${body}`)
                      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                      const now = new Date().toISOString()
                      const updDocs = docs.map((d: any) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                      const updDrafts = drafts.map((d: any) => d.docNumber === doc.docNumber ? { ...d, status: 'envoye', sentAt: now } : d)
                      localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                      localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                      setSavedDocuments([...updDocs, ...updDrafts])
                    }}
                      className="bg-blue-50 text-blue-700 border-2 border-blue-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-100 transition text-sm">
                      {'📧'} {t('proDash.devis.envoyerEmail')}
                    </button>
                  )}
                  <button onClick={() => {
                    if (!confirm(`${t('proDash.devis.supprimerDevisConfirm')} ${doc.docNumber} ?`)) return
                    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                    const updDocs = docs.filter((d: any) => d.docNumber !== doc.docNumber)
                    const updDrafts = drafts.filter((d: any) => d.docNumber !== doc.docNumber)
                    localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(updDocs))
                    localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(updDrafts))
                    setSavedDocuments([...updDocs, ...updDrafts])
                  }}
                    className="bg-white text-red-500 border-2 border-red-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-50 transition text-sm ml-auto">
                    {'🗑️'}
                  </button>
                </div>
              </div>
            )
          })}
          {devisDocs.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">{'📄'}</div>
              <p className="font-semibold text-lg text-gray-700 mb-2">{t('proDash.devis.aucunDevis')}</p>
              <p className="text-sm text-gray-500 mb-5">{t('proDash.devis.creerPremierDevis')}</p>
              <button onClick={() => setShowDevisForm(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                {t('proDash.devis.creerDevis')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onAction}
        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
        {actionLabel}
      </button>
    </div>
  )
}
