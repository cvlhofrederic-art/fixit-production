'use client'

import React, { useState } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

type CoproPage = 'accueil' | 'documents' | 'paiements' | 'annonces' | 'signalement' | 'assemblees' | 'historique' | 'parametres' | 'assistant' | 'interventions_suivi' | 'mes_charges' | 'quittances' | 'mon_bail' | 'modules'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  profile: CoproProfile
  typesIntervention: string[]
  zonesCommunes: string[]
  setPage: (page: CoproPage) => void
  handleEnvoyerSignalement: () => void
  // Parent state bindings for the signalement form
  signalemType: string
  setSignalemType: (v: string) => void
  signalemDesc: string
  setSignalemDesc: (v: string) => void
  signalemUrgence: 'normale' | 'urgente' | 'planifiee'
  setSignalemUrgence: (v: 'normale' | 'urgente' | 'planifiee') => void
  signalemPartieCommune: boolean
  setSignalemPartieCommune: (v: boolean | ((prev: boolean) => boolean)) => void
  signalemZone: string
  setSignalemZone: (v: string) => void
  signalemEnvoye: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproSignalementSection({
  t, profile, typesIntervention, zonesCommunes, setPage, handleEnvoyerSignalement,
  signalemType, setSignalemType, signalemDesc, setSignalemDesc,
  signalemUrgence, setSignalemUrgence, signalemPartieCommune, setSignalemPartieCommune,
  signalemZone, setSignalemZone, signalemEnvoye,
}: Props) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#C9A84C] bg-[rgba(201,168,76,0.08)]">
          <h3 className="font-bold text-[#0D1B2E]">{t.nouveauSignalement}</h3>
          <p className="text-xs text-[#C9A84C] mt-0.5">{t.signalerProbleme}</p>
        </div>

        {signalemEnvoye ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-bold text-green-700">{t.signalementEnvoye}</h3>
            <p className="text-sm text-[#8A9BB0] mt-2">{t.signalementConfirm}</p>
            <button onClick={() => setPage('historique')} className="mt-4 text-sm text-[#C9A84C] hover:text-[#A8842A] font-medium">
              {t.voirHistorique}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">

            {/* Localisation auto */}
            <div className="bg-[rgba(201,168,76,0.08)] border border-[#C9A84C] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#A8842A] mb-2">{t.localisationAuto}</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-white border border-[#C9A84C] px-2 py-1 rounded-lg">🏢 {profile.immeuble}</span>
                {profile.batiment && <span className="text-xs bg-white border border-[#C9A84C] px-2 py-1 rounded-lg">{t.bat} {profile.batiment}</span>}
                {profile.etage && <span className="text-xs bg-white border border-[#C9A84C] px-2 py-1 rounded-lg">{t.etage} {profile.etage}</span>}
                {profile.numLot && <span className="text-xs bg-white border border-[#C9A84C] px-2 py-1 rounded-lg">{t.lot} {profile.numLot}</span>}
              </div>
            </div>

            {/* Toggle partie commune */}
            <div className="flex items-center justify-between p-3 border border-[#E4DDD0] rounded-xl">
              <div>
                <p className="text-sm font-semibold text-[#0D1B2E]">{t.partieCommune}</p>
                <p className="text-xs text-[#8A9BB0] mt-0.5">{t.partieCommuneDesc}</p>
              </div>
              <button
                onClick={() => { setSignalemPartieCommune((v: boolean) => !v); setSignalemZone('') }}
                className={`relative w-11 h-6 rounded-full transition-colors ${signalemPartieCommune ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${signalemPartieCommune ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Zone commune */}
            {signalemPartieCommune && (
              <div>
                <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.zoneConcernee}</label>
                <select
                  value={signalemZone}
                  onChange={e => setSignalemZone(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-orange-200 rounded-lg text-sm focus:border-orange-400 focus:outline-none bg-white"
                >
                  <option value="">{t.selectionnerZone}</option>
                  {zonesCommunes.map(z => <option key={z} value={z}>{z}</option>)}
                  <option value="Autre">{t.autrePreciser}</option>
                </select>
              </div>
            )}

            {/* Type d'intervention */}
            <div>
              <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.typeIntervention}</label>
              <select
                value={signalemType}
                onChange={e => setSignalemType(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none bg-white"
              >
                <option value="">{t.choisirType}</option>
                {typesIntervention.map(ti => <option key={ti} value={ti}>{ti}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.descriptionProbleme}</label>
              <textarea
                value={signalemDesc}
                onChange={e => setSignalemDesc(e.target.value)}
                placeholder={t.decrivezProbleme}
                rows={4}
                className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none resize-none"
              />
            </div>

            {/* Urgence */}
            <div>
              <label className="block text-xs font-medium text-[#4A5E78] mb-2">{t.niveauUrgence}</label>
              <div className="flex gap-2">
                {([
                  { val: 'normale' as const, label: t.urgenceNormale, desc: t.urgenceNormaleDesc },
                  { val: 'urgente' as const, label: t.urgenceUrgent, desc: t.urgenceUrgentDesc },
                  { val: 'planifiee' as const, label: t.urgencePlanifiee, desc: t.urgencePlanifieeDesc },
                ] as const).map(({ val, label, desc }) => (
                  <button
                    key={val}
                    onClick={() => setSignalemUrgence(val)}
                    className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-center transition ${
                      signalemUrgence === val
                        ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.08)]'
                        : 'border-[#E4DDD0] bg-white hover:border-[#E4DDD0]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#0D1B2E]">{label}</p>
                    <p className="text-xs text-[#8A9BB0]">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bouton envoi */}
            <button
              onClick={handleEnvoyerSignalement}
              disabled={!signalemType || !signalemDesc}
              className="w-full bg-[#0D1B2E] hover:bg-[#152338] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              {t.envoyerSignalement}
            </button>

            <p className="text-xs text-[#8A9BB0] text-center">
              {t.signalementTransmis}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
