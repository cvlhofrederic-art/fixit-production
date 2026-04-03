'use client'

import React from 'react'
import { useLocale } from '@/lib/i18n/context'
import { toast } from 'sonner'
import type { Immeuble, Coproprio } from '@/components/syndic-dashboard/types'
import type { Page } from '@/components/syndic-dashboard/types'

interface DocPDFData {
  title?: string
  type?: string
  objet?: string
  destinataire?: {
    nom?: string
    prenom?: string
    immeuble?: string
    batiment?: string
    etage?: string | number
    porte?: string
    _all?: boolean
    [key: string]: unknown
  }
  corps?: string[]
  references?: string[]
  formule_politesse?: string
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SelectedCopro = any

interface PDFGenerationModalProps {
  showPdfModal: boolean
  pendingDocData: DocPDFData | null
  pdfSelectedImmeuble: string
  setPdfSelectedImmeuble: (v: string) => void
  pdfSelectedCopro: SelectedCopro
  setPdfSelectedCopro: (v: SelectedCopro) => void
  pdfObjet: string
  setPdfObjet: (v: string) => void
  pdfGenerating: boolean
  setPdfGenerating: (v: boolean) => void
  setShowPdfModal: (v: boolean) => void
  setPage: (page: Page) => void
  immeubles: Immeuble[]
  coproprios: Coproprio[]
  cabinetLogo: string | null
  syndicSignature: unknown
  generateMaxPDF: (docData: DocPDFData) => Promise<void>
}

export default function PDFGenerationModal({
  showPdfModal,
  pendingDocData,
  pdfSelectedImmeuble,
  setPdfSelectedImmeuble,
  pdfSelectedCopro,
  setPdfSelectedCopro,
  pdfObjet,
  setPdfObjet,
  pdfGenerating,
  setPdfGenerating,
  setShowPdfModal,
  setPage,
  immeubles,
  coproprios,
  cabinetLogo,
  syndicSignature,
  generateMaxPDF,
}: PDFGenerationModalProps) {
  const locale = useLocale()

  if (!showPdfModal || !pendingDocData) return null

  const isPt = locale === 'pt'
  const todayStr = new Date().toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const filteredCopros = pdfSelectedImmeuble
    ? coproprios.filter((c: Coproprio) => (c.immeuble || '').toLowerCase().includes(pdfSelectedImmeuble.toLowerCase()))
    : coproprios
  const docTypeLabel = (pendingDocData.title || pendingDocData.type || 'Document').replace(/_/g, ' ')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => !pdfGenerating && setShowPdfModal(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              📄 {isPt ? 'Gerar o documento' : 'Générer le document'}
            </h2>
            <button onClick={() => !pdfGenerating && setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {/* Type + Date */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-600">{isPt ? 'Tipo' : 'Type'} :</span>
              <span className="font-semibold text-gray-900">{docTypeLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-600">{isPt ? 'Data' : 'Date'} :</span>
              <span className="text-gray-800">{todayStr}</span>
            </div>
          </div>

          {/* Immeuble selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">🏢 {isPt ? 'Condomínio' : 'Immeuble'} *</label>
            <select
              value={pdfSelectedImmeuble}
              onChange={e => { setPdfSelectedImmeuble(e.target.value); setPdfSelectedCopro(null) }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white"
            >
              <option value="">{isPt ? '— Selecionar um condomínio —' : '— Sélectionner un immeuble —'}</option>
              {immeubles.map(im => <option key={im.id} value={im.nom}>{im.nom}{im.adresse ? ` — ${im.adresse}` : ''}</option>)}
            </select>
          </div>

          {/* Destinataire selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">👤 {isPt ? 'Destinatário' : 'Destinataire'} *</label>
            <select
              value={pdfSelectedCopro ? JSON.stringify(pdfSelectedCopro) : ''}
              onChange={e => { try { setPdfSelectedCopro(e.target.value ? JSON.parse(e.target.value) : null) } catch { setPdfSelectedCopro(null) } }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm bg-white"
              disabled={!pdfSelectedImmeuble}
            >
              <option value="">{!pdfSelectedImmeuble ? (isPt ? 'Selecione primeiro um condomínio' : 'Sélectionnez d\'abord un immeuble') : (isPt ? '— Selecionar um destinatário —' : '— Sélectionner un destinataire —')}</option>
              {pdfSelectedImmeuble && ['convocation_ag', 'appel_charges', 'convocation', 'assemblee'].some(t => (pendingDocData.type || '').toLowerCase().includes(t)) && (
                <option value={JSON.stringify({ _all: true, nom: isPt ? 'Todos os condóminos' : 'Tous les copropriétaires', prenom: '' })}>
                  {isPt ? '👥 Todos os condóminos' : '👥 Tous les copropriétaires'}
                </option>
              )}
              {filteredCopros.map((c: Coproprio, idx: number) => {
                const label = `${c.prenomProprietaire || ''} ${c.nomProprietaire || ''}`.trim()
                const details: string[] = []
                if (c.batiment) details.push(`${isPt ? 'Bl.' : 'Bât.'} ${c.batiment}`)
                if (c.etage) details.push(`${c.etage}${isPt ? 'º' : 'e'} ${isPt ? 'andar' : 'ét.'}`)
                if (c.numeroPorte) details.push(`${isPt ? 'Porta' : 'Porte'} ${c.numeroPorte}`)
                return (
                  <option key={idx} value={JSON.stringify(c)}>
                    {label}{details.length > 0 ? ` — ${details.join(', ')}` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Objet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">📝 {isPt ? 'Assunto' : 'Objet'}</label>
            <input
              type="text"
              value={pdfObjet}
              onChange={e => setPdfObjet(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm"
              placeholder={isPt ? 'Assunto do documento...' : 'Objet du document...'}
            />
          </div>

          {/* Status indicators */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span>{cabinetLogo ? '✅' : '⚠️'}</span>
              <span className="text-gray-700">Logo :</span>
              {cabinetLogo ? (
                <span className="text-green-600 font-medium">{isPt ? 'Configurado' : 'Configuré'}</span>
              ) : (
                <button onClick={() => { setShowPdfModal(false); setPage('parametres') }} className="text-amber-600 font-medium hover:underline">
                  {isPt ? 'Não configurado → Configurar' : 'Non configuré → Configurer'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>{syndicSignature ? '✅' : '⚠️'}</span>
              <span className="text-gray-700">{isPt ? 'Assinatura' : 'Signature'} :</span>
              {syndicSignature ? (
                <span className="text-green-600 font-medium">{isPt ? 'Configurada' : 'Configurée'}</span>
              ) : (
                <button onClick={() => { setShowPdfModal(false); setPage('parametres') }} className="text-amber-600 font-medium hover:underline">
                  {isPt ? 'Não configurada → Mon Profil' : 'Non configurée → Mon Profil'}
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowPdfModal(false)}
              disabled={pdfGenerating}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            >
              {isPt ? 'Cancelar' : 'Annuler'}
            </button>
            <button
              onClick={async () => {
                if (!pdfSelectedImmeuble) { toast.error(isPt ? 'Selecione um condomínio' : 'Sélectionnez un immeuble'); return }
                if (!pdfSelectedCopro) { toast.error(isPt ? 'Selecione um destinatário' : 'Sélectionnez un destinataire'); return }
                setPdfGenerating(true)
                try {
                  const mergedDocData = { ...pendingDocData }
                  if (pdfObjet) mergedDocData.objet = pdfObjet
                  const copro = pdfSelectedCopro
                  if (copro && !copro._all) {
                    mergedDocData.destinataire = {
                      ...(mergedDocData.destinataire || {}),
                      nom: copro.nomProprietaire || copro.nom || '',
                      prenom: copro.prenomProprietaire || copro.prenom || '',
                      immeuble: pdfSelectedImmeuble,
                      batiment: copro.batiment || '',
                      etage: copro.etage || '',
                      porte: copro.numeroPorte || copro.porte || '',
                    }
                  } else if (copro?._all) {
                    mergedDocData.destinataire = {
                      ...(mergedDocData.destinataire || {}),
                      nom: copro.nom,
                      prenom: '',
                      immeuble: pdfSelectedImmeuble,
                    }
                  }
                  await generateMaxPDF(mergedDocData)
                  setShowPdfModal(false)
                } catch (err) {
                  console.error('[PDF Modal] Error:', err)
                  toast.error(isPt ? 'Erro ao gerar o PDF' : 'Erreur lors de la génération du PDF')
                } finally {
                  setPdfGenerating(false)
                }
              }}
              disabled={pdfGenerating || !pdfSelectedImmeuble || !pdfSelectedCopro}
              className="px-6 py-2.5 text-sm font-bold text-white bg-[#0D1B2E] hover:bg-[#152338] rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfGenerating ? (
                <><span className="animate-spin">⏳</span> {isPt ? 'A gerar...' : 'Génération...'}</>
              ) : (
                <>📄 {isPt ? 'Gerar o PDF' : 'Générer le PDF'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
