'use client'

import React from 'react'
import { useLocale } from '@/lib/i18n/context'
import { formatPrice } from '@/lib/utils'
import { type CoproProfile, BAIL_DEMO } from '@/lib/copro-demo-data'

interface Props {
  profile: CoproProfile
}

export default function CoproMonBailSection({ profile: _profile }: Props) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'
  const bail = BAIL_DEMO

  const anciennete = () => {
    const months = Math.floor((Date.now() - new Date(bail.dateDebut).getTime()) / (30.44 * 86400000))
    const years = Math.floor(months / 12)
    const rem = months % 12
    if (years === 0) return `${months} ${L ? 'meses' : 'mois'}`
    return `${years} ${L ? (years > 1 ? 'anos' : 'ano') : `an${years > 1 ? 's' : ''}`}${rem > 0 ? ` ${rem} ${L ? 'meses' : 'mois'}` : ''}`
  }

  const loyerRevise = () => {
    const ratio = bail.indiceActuel / bail.indiceRef
    return Math.round(bail.loyerBase * ratio * 100) / 100
  }

  const hausse = loyerRevise() - bail.loyerBase
  const pctHausse = Math.round((hausse / bail.loyerBase) * 1000) / 10

  const daysToRevision = Math.ceil((new Date(bail.prochaineRevision).getTime() - Date.now()) / 86400000)

  return (
    <div className="space-y-6">
      {/* Alerte révision */}
      {daysToRevision <= 90 && daysToRevision >= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-amber-800">{L ? `Revisão de renda em ${daysToRevision} dias` : `Révision de loyer dans ${daysToRevision} jours`}</div>
            <div className="text-sm text-amber-700 mt-0.5">
              {L ? 'Revisão prevista em' : 'Révision prévue le'} {new Date(bail.prochaineRevision).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}.
              {L ? 'Nova renda estimada :' : 'Nouveau loyer estimé :'} <span className="font-bold">{formatPrice(loyerRevise())}</span> (+{formatPrice(hausse)} / +{pctHausse}%)
            </div>
          </div>
        </div>
      )}

      {/* Infos bail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Données clés */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm space-y-4">
          <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2">{L ? '📜 Informações do contrato' : '📜 Informations bail'}</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Data de início' : 'Date de début'}</span>
              <span className="font-semibold">{new Date(bail.dateDebut).toLocaleDateString(dateFmtLocale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Duração / Tipo' : 'Durée / Type'}</span>
              <span className="font-semibold">{bail.duree} {L ? 'meses · Contrato residencial' : 'mois · Bail résidentiel'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Antiguidade' : 'Ancienneté'}</span>
              <span className="font-semibold text-[#C9A84C]">{anciennete()}</span>
            </div>
            {bail.dateFin && (
              <div className="flex justify-between">
                <span className="text-[#8A9BB0]">{L ? 'Fim do contrato' : 'Fin de bail'}</span>
                <span className="font-semibold">{new Date(bail.dateFin).toLocaleDateString(dateFmtLocale)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Pré-aviso' : 'Préavis'}</span>
              <span className="font-semibold">{bail.preavis} {L ? 'meses' : 'mois'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Área' : 'Surface'}</span>
              <span className="font-semibold">{bail.surface} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Alojamento' : 'Logement'}</span>
              <span className="font-semibold text-right max-w-[55%]">{bail.logement}</span>
            </div>
          </div>
        </div>

        {/* Financier */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm space-y-4">
          <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2">{L ? '💶 Financeiro' : '💶 Financier'}</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Renda sem encargos' : 'Loyer hors charges'}</span>
              <span className="font-semibold">{formatPrice(bail.loyerBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Encargos forfetários' : 'Charges forfaitaires'}</span>
              <span className="font-semibold">{formatPrice(bail.charges)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E4DDD0] pt-2">
              <span className="font-bold text-[#4A5E78]">{L ? 'Total mensal' : 'Total mensuel'}</span>
              <span className="font-black text-[#0D1B2E]">{formatPrice(bail.loyerBase + bail.charges)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A9BB0]">{L ? 'Caução' : 'Dépôt de garantie'}</span>
              <span className="font-semibold">{formatPrice(bail.depot)}</span>
            </div>
          </div>

          {/* Révision IRL */}
          <div className="bg-[rgba(201,168,76,0.08)] border border-[#C9A84C] rounded-xl p-3 mt-2">
            <div className="text-xs font-bold text-[#A8842A] mb-2">{L ? '📊 Revisão' : '📊 Révision'} {bail.indexation.toUpperCase()}</div>
            <div className="space-y-1.5 text-xs text-[#A8842A]">
              <div className="flex justify-between">
                <span>{L ? 'Índice de referência' : 'Indice de référence'}</span>
                <span className="font-bold">{bail.indiceRef}</span>
              </div>
              <div className="flex justify-between">
                <span>{L ? 'Índice atual' : 'Indice actuel'}</span>
                <span className="font-bold">{bail.indiceActuel}</span>
              </div>
              <div className="flex justify-between border-t border-[#C9A84C] pt-1.5">
                <span className="font-bold">{L ? 'Renda revista estimada' : 'Loyer révisé estimé'}</span>
                <span className="font-black text-[#0D1B2E]">{formatPrice(loyerRevise())} <span className="text-[10px]">(+{pctHausse}%)</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bailleur */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm">
        <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2 mb-4">{L ? '🏢 Senhorio / Gestor' : '🏢 Bailleur / Gestionnaire'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">🏢</span>
              <div><div className="text-xs text-[#8A9BB0]">{L ? 'Senhorio' : 'Bailleur'}</div><div className="font-semibold">{bail.bailleur}</div></div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">📍</span>
              <div><div className="text-xs text-[#8A9BB0]">{L ? 'Morada' : 'Adresse'}</div><div className="font-semibold">{bail.bailleurAdresse}</div></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#8A9BB0] w-5 flex-shrink-0">📞</span>
              <div>
                <div className="text-xs text-[#8A9BB0]">{L ? 'Telefone' : 'Téléphone'}</div>
                <a href={`tel:${bail.bailleurPhone.replace(/\s/g, '')}`} className="font-semibold text-[#C9A84C] hover:text-[#A8842A]">{bail.bailleurPhone}</a>
              </div>
            </div>
            {bail.agence && (
              <div className="flex items-start gap-2">
                <span className="text-[#8A9BB0] w-5 flex-shrink-0">🏪</span>
                <div><div className="text-xs text-[#8A9BB0]">{L ? 'Agência' : 'Agence'}</div><div className="font-semibold">{bail.agence}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendrier bail */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] p-5 shadow-sm">
        <div className="font-bold text-[#0D1B2E] text-sm border-b border-[#E4DDD0] pb-2 mb-4">{L ? '📅 Datas importantes' : '📅 Échéances importantes'}</div>
        <div className="space-y-3">
          {[
            { label: L ? 'Última revisão de renda' : 'Dernière révision loyer', date: bail.derniereRevision, icon: '✅', color: 'text-green-600' },
            { label: L ? 'Próxima revisão IRL' : 'Prochaine révision IRL', date: bail.prochaineRevision, icon: daysToRevision <= 90 ? '⚠️' : '📅', color: daysToRevision <= 90 ? 'text-amber-600' : 'text-[#4A5E78]' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>{item.icon}</span>
                <span className="text-[#4A5E78]">{item.label}</span>
              </div>
              <span className={`text-sm font-bold ${item.color}`}>
                {new Date(item.date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span>📋</span>
              <span className="text-[#4A5E78]">{L ? 'Data de pré-aviso (em caso de saída)' : 'Date préavis (si départ)'}</span>
            </div>
            <span className="text-sm font-bold text-[#4A5E78]">
              {bail.preavis} {L ? 'meses antes do fim' : 'mois avant la fin'}
            </span>
          </div>
        </div>
      </div>

      {/* Signalement locataire */}
      <div className="bg-[rgba(201,168,76,0.08)] border border-[#C9A84C] rounded-xl p-4">
        <div className="font-bold text-[#0D1B2E] mb-2">{L ? '🔧 Reportar um problema ao senhorio' : '🔧 Signaler un problème au bailleur'}</div>
        <p className="text-sm text-[#A8842A] mb-3">{L ? 'Fuga, avaria, obras urgentes — contacte diretamente o seu gestor.' : 'Fuite, panne, travaux urgents — contactez directement votre gestionnaire.'}</p>
        <div className="flex gap-2">
          <a href={`tel:${bail.bailleurPhone.replace(/\s/g, '')}`}
            className="flex-1 text-center py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white text-sm font-bold rounded-xl transition">
            {L ? '📞 Ligar' : '📞 Appeler'}
          </a>
          <a href={`mailto:cabinet@dupont-immobilier.fr?subject=${L ? 'Ocorrência - Problema no alojamento' : 'Signalement - Problème logement'}`}
            className="flex-1 text-center py-2.5 bg-white border border-[#C9A84C] text-[#A8842A] text-sm font-bold rounded-xl hover:bg-[rgba(201,168,76,0.08)] transition">
            📧 Email
          </a>
        </div>
      </div>
    </div>
  )
}
