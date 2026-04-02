'use client'

import React from 'react'
import { formatPrice, formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChargesMensuelles {
  id: string
  mois: string
  montant: number
  statut: 'payee' | 'en_attente' | 'en_retard'
  datePaiement?: string
  dateEcheance: string
}

interface Echeance {
  id: string
  type: 'paiement' | 'assemblee' | 'maintenance' | 'document'
  titre: string
  date: string
  description: string
  urgent: boolean
}

interface CoproNotification {
  id: string
  type: 'rappel' | 'alerte' | 'document' | 'message' | 'vote'
  titre: string
  message: string
  date: string
  lu: boolean
}

interface Annonce {
  id: string
  titre: string
  contenu: string
  date: string
  auteur: string
  importance: 'info' | 'important' | 'urgent'
  lu: boolean
}

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
  locale: string
  profile: CoproProfile
  chargesDuMois: ChargesMensuelles | undefined
  solde: number
  paiementsEnAttente: number
  notifNonLues: number
  echeances: Echeance[]
  notifications: CoproNotification[]
  annonces: Annonce[]
  setPage: (page: CoproPage) => void
  markNotifRead: (id: string) => void
  markAllNotifsRead: () => void
}

const ECHEANCE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  assemblee: '🏛️',
  maintenance: '🔧',
  document: '📄',
}

const NOTIF_TYPE_EMOJI: Record<string, string> = {
  rappel: '⏰',
  alerte: '⚠️',
  document: '📄',
  message: '💬',
  vote: '🗳️',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproAccueilSection({
  t, locale, profile, chargesDuMois, solde, paiementsEnAttente, notifNonLues,
  echeances, notifications, annonces, setPage, markNotifRead, markAllNotifsRead,
}: Props) {
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💶</span>
            <span className="text-xs text-[#8A9BB0] font-medium">{t.chargesDuMois}</span>
          </div>
          <p className="text-xl font-bold text-[#0D1B2E]">{formatPrice(chargesDuMois?.montant || 285)}</p>
          <p className="text-xs mt-1">
            {chargesDuMois?.statut === 'payee'
              ? <span className="text-green-600">{t.payee}</span>
              : <span className="text-amber-600">{t.enAttente}</span>
            }
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📊</span>
            <span className="text-xs text-[#8A9BB0] font-medium">{t.soldeAPayer}</span>
          </div>
          <p className={`text-xl font-bold ${solde > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPrice(solde)}</p>
          <p className="text-xs text-[#8A9BB0] mt-1">{paiementsEnAttente} {t.paiementsEnAttente}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏠</span>
            <span className="text-xs text-[#8A9BB0] font-medium">{t.tantiemes}</span>
          </div>
          <p className="text-xl font-bold text-[#0D1B2E]">{profile.tantiemes} / 10 000</p>
          <p className="text-xs text-[#C9A84C] mt-1">{t.quotePart} : {profile.quotePart}%</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔔</span>
            <span className="text-xs text-[#8A9BB0] font-medium">Notifications</span>
          </div>
          <p className="text-xl font-bold text-[#0D1B2E]">{notifNonLues}</p>
          <p className="text-xs text-[#8A9BB0] mt-1">{t.nonLues}</p>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setPage('signalement')} className="flex items-center gap-2 bg-[#0D1B2E] hover:bg-[#152338] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          {t.faireSignalement}
        </button>
        <button onClick={() => setPage('paiements')} className="flex items-center gap-2 bg-white hover:bg-[#F7F4EE] text-[#0D1B2E] text-sm font-medium px-4 py-2.5 rounded-lg border border-[#E4DDD0] transition">
          {t.mesPaiements}
        </button>
        <button onClick={() => setPage('documents')} className="flex items-center gap-2 bg-white hover:bg-[#F7F4EE] text-[#0D1B2E] text-sm font-medium px-4 py-2.5 rounded-lg border border-[#E4DDD0] transition">
          {t.mesDocuments}
        </button>
        <button onClick={() => setPage('assemblees')} className="flex items-center gap-2 bg-white hover:bg-[#F7F4EE] text-[#0D1B2E] text-sm font-medium px-4 py-2.5 rounded-lg border border-[#E4DDD0] transition">
          {t.voterAG}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Echeances */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
          <div className="px-5 py-4 border-b border-[#E4DDD0]">
            <h2 className="font-bold text-[#0D1B2E]">{t.prochainesEcheances}</h2>
          </div>
          <div className="divide-y divide-[#E4DDD0]">
            {echeances.sort((a, b) => a.date.localeCompare(b.date)).map(e => (
              <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                <span className="text-lg mt-0.5">{ECHEANCE_TYPE_EMOJI[e.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0D1B2E] truncate">{e.titre}</p>
                    {e.urgent && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{t.urgent}</span>}
                  </div>
                  <p className="text-xs text-[#8A9BB0]">{e.description}</p>
                  <p className="text-xs text-[#C9A84C] font-medium mt-0.5">{formatDate(e.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
          <div className="px-5 py-4 border-b border-[#E4DDD0] flex items-center justify-between">
            <h2 className="font-bold text-[#0D1B2E]">🔔 Notifications</h2>
            {notifNonLues > 0 && (
              <button onClick={markAllNotifsRead} className="text-xs text-[#C9A84C] hover:text-[#A8842A] font-medium">
                {t.toutMarquerLu}
              </button>
            )}
          </div>
          <div className="divide-y divide-[#E4DDD0]">
            {notifications.sort((a, b) => b.date.localeCompare(a.date)).map(n => (
              <div
                key={n.id}
                onClick={() => markNotifRead(n.id)}
                className={`px-5 py-3 flex items-start gap-3 cursor-pointer transition ${!n.lu ? 'bg-[rgba(201,168,76,0.08)]' : 'hover:bg-[#F7F4EE]'}`}
              >
                <span className="text-lg mt-0.5">{NOTIF_TYPE_EMOJI[n.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${!n.lu ? 'font-bold text-[#0D1B2E]' : 'font-medium text-[#4A5E78]'}`}>{n.titre}</p>
                    {!n.lu && <span className="w-2 h-2 bg-[#C9A84C] rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-[#8A9BB0] truncate">{n.message}</p>
                  <p className="text-xs text-[#8A9BB0] mt-0.5">{new Date(n.date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annonces recentes */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
        <div className="px-5 py-4 border-b border-[#E4DDD0] flex items-center justify-between">
          <h2 className="font-bold text-[#0D1B2E]">{t.dernieresAnnonces}</h2>
          <button onClick={() => setPage('annonces')} className="text-xs text-[#C9A84C] hover:text-[#A8842A] font-medium">
            {t.voirTout}
          </button>
        </div>
        <div className="divide-y divide-[#E4DDD0]">
          {annonces.slice(0, 3).map(a => (
            <div key={a.id} className="px-5 py-3 flex items-start gap-3">
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                a.importance === 'urgent' ? 'bg-red-100 text-red-700' :
                a.importance === 'important' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {a.importance === 'urgent' ? t.urgentLabel : a.importance === 'important' ? t.importantLabel : t.infoLabel}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!a.lu ? 'font-bold text-[#0D1B2E]' : 'font-medium text-[#4A5E78]'}`}>{a.titre}</p>
                <p className="text-xs text-[#8A9BB0] mt-0.5">{a.auteur} · {formatDate(a.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
