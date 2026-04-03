'use client'

import React, { useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { formatPrice } from '@/lib/utils'
import { type CoproProfile, type Quittance, QUITTANCES_DEMO, BAIL_DEMO } from '@/lib/copro-demo-data'

interface Props {
  profile: CoproProfile
}

export default function CoproQuittancesSection({ profile }: Props) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [quittances] = useState<Quittance[]>(QUITTANCES_DEMO)
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())
  const [anneeFilter, setAnneeFilter] = useState<string>('2026')

  const annees = [...new Set(quittances.map(q => q.mois.split('-')[0]))].sort((a, b) => Number(b) - Number(a))
  const filtered = quittances.filter(q => q.mois.startsWith(anneeFilter))

  const moisLabel = (mois: string) => {
    const [y, m] = mois.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })
  }

  const handleDownload = (q: Quittance) => {
    const texte = L ? `RECIBO DE RENDA — ${q.reference}
══════════════════════════════════════════
Senhorio : ${BAIL_DEMO.bailleur}
Inquilino : ${profile.prenom} ${profile.nom}
Alojamento : ${BAIL_DEMO.logement}
Período : ${moisLabel(q.mois)}
══════════════════════════════════════════
Renda base          : ${formatPrice(BAIL_DEMO.loyerBase)}
Encargos            : ${formatPrice(BAIL_DEMO.charges)}
──────────────────────────────────────────
TOTAL               : ${formatPrice(q.montant)}
══════════════════════════════════════════
Data de emissão : ${new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}
Referência : ${q.reference}

Este recibo atesta que a renda do mês de ${moisLabel(q.mois)}
foi devidamente recebida.

Feito em Lisboa, a ${new Date().toLocaleDateString(dateFmtLocale)}
Assinatura do senhorio : ${BAIL_DEMO.bailleur}` : `QUITTANCE DE LOYER — ${q.reference}
══════════════════════════════════════════
Bailleur : ${BAIL_DEMO.bailleur}
Locataire : ${profile.prenom} ${profile.nom}
Logement : ${BAIL_DEMO.logement}
Période : ${moisLabel(q.mois)}
══════════════════════════════════════════
Loyer net           : ${formatPrice(BAIL_DEMO.loyerBase)}
Charges             : ${formatPrice(BAIL_DEMO.charges)}
─────────────────────────────────────────
TOTAL               : ${formatPrice(q.montant)}
══════════════════════════════════════════
Date d'émission : ${new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}
Référence : ${q.reference}

Cette quittance atteste que le loyer du mois de ${moisLabel(q.mois)}
a bien été reçu.

Fait à Paris, le ${new Date().toLocaleDateString(dateFmtLocale)}
Signature du bailleur : ${BAIL_DEMO.bailleur}`

    const blob = new Blob([texte], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${q.reference}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(prev => new Set([...prev, q.id]))
  }

  const totalAnnee = filtered.reduce((s, q) => s + q.montant, 0)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Renda mensal' : 'Loyer mensuel'}</div>
          <div className="text-2xl font-black text-[#0D1B2E]">{formatPrice(BAIL_DEMO.loyerBase + BAIL_DEMO.charges)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{formatPrice(BAIL_DEMO.loyerBase)} + {formatPrice(BAIL_DEMO.charges)} {L ? 'encargos' : 'charges'}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">Total {anneeFilter}</div>
          <div className="text-2xl font-black text-[#C9A84C]">{formatPrice(totalAnnee)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{filtered.length} {L ? (filtered.length > 1 ? 'recibos' : 'recibo') : `quittance${filtered.length > 1 ? 's' : ''}`}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Próxima revisão' : 'Prochaine révision'}</div>
          <div className="text-xl font-black text-amber-600">
            {new Date(BAIL_DEMO.prochaineRevision).toLocaleDateString(dateFmtLocale, { month: 'short', year: 'numeric' })}
          </div>
          <div className="text-xs text-[#8A9BB0] mt-1">{L ? 'Índice IRL' : 'Indice IRL'}</div>
        </div>
      </div>

      {/* Filtre année */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-[#4A5E78]">{L ? 'Ano :' : 'Année :'}</div>
        <div className="flex gap-1">
          {annees.map(a => (
            <button key={a} onClick={() => setAnneeFilter(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${anneeFilter === a ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-[#4A5E78] hover:bg-[#F7F4EE]'}`}
            >{a}</button>
          ))}
        </div>
      </div>

      {/* Liste quittances */}
      <div className="space-y-3">
        {filtered.map(q => (
          <div key={q.id} className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-[rgba(201,168,76,0.15)] rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🧾</span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#0D1B2E]">{moisLabel(q.mois)}</div>
                <div className="text-xs text-[#8A9BB0] mt-0.5">{q.reference} · {L ? 'Emitido em' : 'Émise le'} {new Date(q.dateEmission).toLocaleDateString(dateFmtLocale)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="font-black text-[#0D1B2E]">{formatPrice(q.montant)}</div>
                {downloaded.has(q.id) && (
                  <div className="text-[10px] text-green-600 font-medium mt-0.5">{L ? '✓ Descarregado' : '✓ Téléchargée'}</div>
                )}
              </div>
              <button
                onClick={() => handleDownload(q)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition ${
                  downloaded.has(q.id)
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-[rgba(201,168,76,0.08)] border-[#C9A84C] text-[#A8842A] hover:bg-[rgba(201,168,76,0.15)]'
                }`}
              >
                {downloaded.has(q.id) ? '✓ OK' : (L ? '⬇ Descarregar' : '⬇ Télécharger')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Demande quittance */}
      <div className="bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl p-4 text-center">
        <div className="text-sm text-[#4A5E78] mb-2">{L ? 'Não encontra um recibo?' : 'Vous ne trouvez pas une quittance ?'}</div>
        <a
          href={`mailto:cabinet@dupont-immobilier.fr?subject=${L ? 'Pedido de recibo de renda' : 'Demande quittance de loyer'}`}
          className="text-sm text-[#C9A84C] hover:text-[#A8842A] font-semibold"
        >
          {L ? '📧 Contactar o gestor' : '📧 Contacter le gestionnaire'}
        </a>
      </div>
    </div>
  )
}
