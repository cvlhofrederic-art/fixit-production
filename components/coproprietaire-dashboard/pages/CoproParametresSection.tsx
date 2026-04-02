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

interface ParamConfidentialite {
  notifEmail: boolean
  notifPush: boolean
  mailingAG: boolean
  alertesPaiement: boolean
  alertesTravaux: boolean
  resumeHebdo: boolean
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  locale: string
  profile: CoproProfile
  params: ParamConfidentialite
  setParams: React.Dispatch<React.SetStateAction<ParamConfidentialite>>
  saveProfile: () => void
  // The parent manages profile form + editProfile because saveProfile needs them
  editProfile: boolean
  setEditProfile: (v: boolean) => void
  profileForm: { nom: string; prenom: string; email: string; telephone: string }
  setProfileForm: React.Dispatch<React.SetStateAction<{ nom: string; prenom: string; email: string; telephone: string }>>
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproParametresSection({
  t, locale, profile, params, setParams, saveProfile,
  editProfile, setEditProfile, profileForm, setProfileForm,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Profil */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#0D1B2E] text-lg">{t.monProfil}</h2>
          {!editProfile && (
            <button
              onClick={() => {
                setProfileForm({ nom: profile.nom, prenom: profile.prenom, email: profile.email, telephone: profile.telephone })
                setEditProfile(true)
              }}
              className="text-xs text-[#C9A84C] hover:text-[#A8842A] font-medium"
            >
              {t.modifier}
            </button>
          )}
        </div>

        {!editProfile ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.nomComplet}</p>
              <p className="text-sm text-[#0D1B2E] font-medium">{profile.prenom} {profile.nom}</p>
            </div>
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.email}</p>
              <p className="text-sm text-[#0D1B2E]">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.telephone}</p>
              <p className="text-sm text-[#0D1B2E]">{profile.telephone}</p>
            </div>
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.immeuble}</p>
              <p className="text-sm text-[#0D1B2E]">{profile.immeuble}</p>
            </div>
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.localisation}</p>
              <p className="text-sm text-[#0D1B2E]">{t.bat} {profile.batiment} · {t.etage} {profile.etage} · {t.lot} {profile.numLot}</p>
            </div>
            <div>
              <p className="text-xs text-[#8A9BB0] font-medium">{t.tantièmesQuotePart}</p>
              <p className="text-sm text-[#0D1B2E]">{profile.tantiemes} / 10 000 ({profile.quotePart}%)</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.prenom}</label>
                <input
                  type="text"
                  value={profileForm.prenom}
                  onChange={e => setProfileForm({ ...profileForm, prenom: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.nom}</label>
                <input
                  type="text"
                  value={profileForm.nom}
                  onChange={e => setProfileForm({ ...profileForm, nom: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.email}</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A5E78] mb-1">{t.telephone}</label>
                <input
                  type="tel"
                  value={profileForm.telephone}
                  onChange={e => setProfileForm({ ...profileForm, telephone: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#E4DDD0] rounded-lg text-sm focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile} className="bg-[#0D1B2E] hover:bg-[#152338] text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                {t.enregistrer}
              </button>
              <button onClick={() => setEditProfile(false)} className="bg-white hover:bg-[#F7F4EE] text-[#4A5E78] text-sm font-medium px-4 py-2 rounded-lg border border-[#E4DDD0] transition">
                {t.annuler}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
        <h2 className="font-bold text-[#0D1B2E] text-lg mb-4">{t.prefsNotif}</h2>
        <div className="space-y-4">
          {[
            { key: 'notifEmail' as const, label: t.notifEmail, desc: t.notifEmailDesc },
            { key: 'notifPush' as const, label: t.notifPush, desc: t.notifPushDesc },
            { key: 'mailingAG' as const, label: t.mailingAG, desc: t.mailingAGDesc },
            { key: 'alertesPaiement' as const, label: t.alertesPaiement, desc: t.alertesPaiementDesc },
            { key: 'alertesTravaux' as const, label: t.alertesTravaux, desc: t.alertesTravauxDesc },
            { key: 'resumeHebdo' as const, label: t.resumeHebdo, desc: t.resumeHebdoDesc },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#0D1B2E]">{label}</p>
                <p className="text-xs text-[#8A9BB0]">{desc}</p>
              </div>
              <button
                onClick={() => setParams(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${params[key] ? 'bg-[#0D1B2E]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${params[key] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Export PDF */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
        <h2 className="font-bold text-[#0D1B2E] text-lg mb-4">{t.exportTelecharge}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => alert(locale === 'pt' ? 'A gerar o resumo anual em PDF...' : 'Génération du récapitulatif annuel en PDF...')}
            className="flex items-center gap-3 bg-[#F7F4EE] hover:bg-[#F7F4EE] border border-[#E4DDD0] rounded-lg p-4 transition text-left"
          >
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-sm font-medium text-[#0D1B2E]">{t.recapAnnuel}</p>
              <p className="text-xs text-[#8A9BB0]">{t.recapAnnuelDesc}</p>
            </div>
          </button>
          <button
            onClick={() => alert(locale === 'pt' ? 'A gerar o resumo de votos AG em PDF...' : 'Génération du récapitulatif votes AG en PDF...')}
            className="flex items-center gap-3 bg-[#F7F4EE] hover:bg-[#F7F4EE] border border-[#E4DDD0] rounded-lg p-4 transition text-left"
          >
            <span className="text-2xl">🗳️</span>
            <div>
              <p className="text-sm font-medium text-[#0D1B2E]">{t.mesVotesAG}</p>
              <p className="text-xs text-[#8A9BB0]">{t.mesVotesAGDesc}</p>
            </div>
          </button>
          <button
            onClick={() => alert(locale === 'pt' ? 'A gerar a declaração de condomínio em PDF...' : 'Génération de l\'attestation de copropriété en PDF...')}
            className="flex items-center gap-3 bg-[#F7F4EE] hover:bg-[#F7F4EE] border border-[#E4DDD0] rounded-lg p-4 transition text-left"
          >
            <span className="text-2xl">📜</span>
            <div>
              <p className="text-sm font-medium text-[#0D1B2E]">{t.attestationCopro}</p>
              <p className="text-xs text-[#8A9BB0]">{t.lot} {profile.numLot} · {profile.tantiemes} {t.tantiemes}</p>
            </div>
          </button>
          <button
            onClick={() => window.location.href = '/coproprietaire/portail'}
            className="flex items-center gap-3 bg-[#F7F4EE] hover:bg-[#F7F4EE] border border-[#E4DDD0] rounded-lg p-4 transition text-left"
          >
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm font-medium text-[#0D1B2E]">{t.portailSignalements}</p>
              <p className="text-xs text-[#8A9BB0]">{t.portailSignalementsDesc}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
