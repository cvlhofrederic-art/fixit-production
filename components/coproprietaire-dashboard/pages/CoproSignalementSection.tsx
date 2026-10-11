'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import {
  DESCRIPTION_MIN_SIGNALEMENT, chargerMesSignalements, libelleStatutSignalement,
  type SignalementSuivi,
} from '@/lib/copro-signalement'

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
  handleEnvoyerSignalement: () => void | Promise<void>
  /** Envoi au syndic en cours (bouton désactivé). */
  signalemEnvoi?: boolean
  /** Incrémenté par la page après chaque envoi réussi : recharge « Mes signalements ». */
  versionMesSignalements?: number
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

// ─── Suivi : pastille par statut (statuts de syndic_signalements) ─────────────

const STYLE_STATUT: Record<string, { emoji: string; bg: string; color: string }> = {
  en_attente: { emoji: '📨', bg: 'bg-blue-100', color: 'text-blue-700' },
  acceptee:   { emoji: '👷', bg: 'bg-[rgba(201,168,76,0.15)]', color: 'text-[#A8842A]' },
  en_cours:   { emoji: '🔧', bg: 'bg-amber-100', color: 'text-amber-700' },
  terminee:   { emoji: '✅', bg: 'bg-green-100', color: 'text-green-700' },
  annulee:    { emoji: '❌', bg: 'bg-red-100', color: 'text-red-700' },
}

type EtatSuivi = 'chargement' | 'pret' | 'erreur' | 'trop_de_demandes' | 'sans_email'

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproSignalementSection({
  t, profile, typesIntervention, zonesCommunes, setPage, handleEnvoyerSignalement,
  signalemEnvoi = false, versionMesSignalements = 0,
  signalemType, setSignalemType, signalemDesc, setSignalemDesc,
  signalemUrgence, setSignalemUrgence, signalemPartieCommune, setSignalemPartieCommune,
  signalemZone, setSignalemZone, signalemEnvoye,
}: Props) {
  const locale = useLocale()
  const langue: 'fr' | 'pt' = locale === 'pt' ? 'pt' : 'fr'
  const dateFmtLocale = langue === 'pt' ? 'pt-PT' : 'fr-FR'

  const longueurDesc = signalemDesc.trim().length
  const descTropCourte = longueurDesc < DESCRIPTION_MIN_SIGNALEMENT
  const envoiImpossible = !signalemType || descTropCourte || signalemEnvoi

  // ── Mes signalements : au montage, après chaque envoi (versionMesSignalements), sur « Actualiser ».
  const [mesSignalements, setMesSignalements] = useState<SignalementSuivi[]>([])
  const [etatSuivi, setEtatSuivi] = useState<EtatSuivi>('chargement')
  const [chargementSuivi, setChargementSuivi] = useState(false)

  const chargerSuivi = useCallback(async (forcer: boolean) => {
    setChargementSuivi(true)
    const resultat = await chargerMesSignalements(profile.email, { forcer })
    setChargementSuivi(false)
    if (resultat.ok) {
      setMesSignalements(resultat.signalements)
      setEtatSuivi('pret')
      return
    }
    if (resultat.code === 'email_absent') {
      setEtatSuivi('sans_email')
      return
    }
    const etat: EtatSuivi = resultat.code === 'trop_de_demandes' ? 'trop_de_demandes' : 'erreur'
    setEtatSuivi(etat)
    if (forcer) toast.error(etat === 'trop_de_demandes' ? t.suiviTropDeDemandes : t.suiviIndisponible)
  }, [profile.email, t.suiviTropDeDemandes, t.suiviIndisponible])

  const versionAffichee = useRef(versionMesSignalements)
  useEffect(() => {
    const forcer = versionAffichee.current !== versionMesSignalements
    versionAffichee.current = versionMesSignalements
    void chargerSuivi(forcer)
  }, [chargerSuivi, versionMesSignalements])

  const dateSignalement = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="max-w-2xl space-y-6">
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
              <label htmlFor="copro-signalement-type" className="block text-xs font-medium text-[#4A5E78] mb-1">{t.typeIntervention}</label>
              <select
                id="copro-signalement-type"
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
              <label htmlFor="copro-signalement-description" className="block text-xs font-medium text-[#4A5E78] mb-1">{t.descriptionProbleme}</label>
              <textarea
                id="copro-signalement-description"
                value={signalemDesc}
                onChange={e => setSignalemDesc(e.target.value)}
                placeholder={t.decrivezProbleme}
                rows={4}
                aria-describedby="copro-signalement-description-aide"
                className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none resize-none"
              />
              {/* Minimum de 10 caractères (règle de la route) : message tant qu'il manque des caractères */}
              {longueurDesc > 0 && descTropCourte ? (
                <p id="copro-signalement-description-aide" className="text-xs text-amber-700 mt-1" role="status">
                  {t.descriptionEncore.replace('{n}', String(DESCRIPTION_MIN_SIGNALEMENT - longueurDesc))}
                </p>
              ) : (
                <p id="copro-signalement-description-aide" className="text-xs text-[#8A9BB0] mt-1">{t.descriptionMinimum}</p>
              )}
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
              onClick={() => { void handleEnvoyerSignalement() }}
              disabled={envoiImpossible}
              className="w-full bg-[#0D1B2E] hover:bg-[#152338] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              {signalemEnvoi ? t.signalementEnvoiEnCours : t.envoyerSignalement}
            </button>

            <p className="text-xs text-[#8A9BB0] text-center">
              {t.signalementTransmis}
            </p>
          </div>
        )}
      </div>

      {/* Mes signalements : suivi par le syndic (statut, prestataire missionné) */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4DDD0] flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#0D1B2E]">{t.mesSignalements}</h3>
            <p className="text-xs text-[#8A9BB0] mt-0.5">{t.mesSignalementsDesc}</p>
          </div>
          <button
            onClick={() => { void chargerSuivi(true) }}
            disabled={chargementSuivi || etatSuivi === 'sans_email'}
            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border bg-white text-[#4A5E78] border-[#E4DDD0] hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {chargementSuivi ? t.suiviChargement : t.actualiser}
          </button>
        </div>

        {etatSuivi === 'sans_email' && (
          <p className="px-5 py-6 text-sm text-[#8A9BB0] text-center">{t.suiviSansEmail}</p>
        )}
        {etatSuivi === 'chargement' && (
          <p className="px-5 py-6 text-sm text-[#8A9BB0] text-center">{t.suiviChargement}</p>
        )}
        {(etatSuivi === 'erreur' || etatSuivi === 'trop_de_demandes') && mesSignalements.length === 0 && (
          <p className="px-5 py-6 text-sm text-red-700 text-center">
            {etatSuivi === 'trop_de_demandes' ? t.suiviTropDeDemandes : t.suiviIndisponible}
          </p>
        )}
        {etatSuivi === 'pret' && mesSignalements.length === 0 && (
          <p className="px-5 py-6 text-sm text-[#8A9BB0] text-center">{t.aucunSignalement}</p>
        )}
        {etatSuivi !== 'sans_email' && mesSignalements.length > 0 && (
          <ul className="divide-y divide-[#E4DDD0]">
            {mesSignalements.map(s => {
              const style = STYLE_STATUT[s.statut] ?? STYLE_STATUT.en_attente
              const date = dateSignalement(s.createdAt)
              return (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#0D1B2E]">{s.typeIntervention}</div>
                      <div className="text-sm text-[#8A9BB0] truncate">{s.description}</div>
                      <div className="text-xs text-[#8A9BB0] mt-1">
                        {date}
                        {s.estPartieCommune && s.zoneSignalee ? ` · ${s.zoneSignalee}` : ''}
                        {s.priorite === 'urgente' ? ` · ${t.urgenceUrgent}` : ''}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 max-w-[45%] text-right text-xs font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
                      {style.emoji} {libelleStatutSignalement(s.statut, s.artisanAssigne, langue)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
