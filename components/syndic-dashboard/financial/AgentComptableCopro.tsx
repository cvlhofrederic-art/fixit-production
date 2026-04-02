'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { Immeuble } from '../types'
import { LeaAvatar } from '@/components/common/RobotAvatars'
import { useTranslation, useLocale } from '@/lib/i18n/context'

interface CoproLot {
  numero: string
  proprietaire: string
  tantieme: number
  etage?: string
  surface?: number
}
interface CoproEcriture {
  date: string
  journal: string
  libelle: string
  debit: number
  credit: number
  compte: string
}
interface CoproAppel {
  statut: string
  periode: string
  totalBudget: number
}
interface CoproBudget {
  immeuble: string
  annee: number
  postes: Array<{ nom: string; montant: number }>
}

export default function AgentComptableCopro({
  immeubles, selectedImmeubleId, setSelectedImmeubleId,
  lots, ecritures, appels, budgets,
}: {
  immeubles: Immeuble[]
  selectedImmeubleId: string
  setSelectedImmeubleId: (id: string) => void
  lots: CoproLot[]
  ecritures: CoproEcriture[]
  appels: CoproAppel[]
  budgets: CoproBudget[]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const imm = immeubles.find(i => i.id === selectedImmeubleId) || immeubles[0] || null

  type Msg = { role: 'user' | 'assistant'; content: string }
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const SUGGESTIONS = [
    'Explique la règle de répartition des charges de cette copropriété',
    'Comment voter ces travaux selon le règlement ? (majorité requise)',
    'Quel est le montant du fonds de travaux obligatoire ?',
    'Génère un appel de charges trimestriel pour cette copro',
    'Y a-t-il des incohérences dans le journal comptable ?',
    'Quelles sont les dépenses dépassant le budget prévisionnel ?',
    'Rédige un courrier de relance impayé conforme à la loi Alur',
    'Quelles charges sont récupérables sur les locataires ?',
    'Synthèse comptable pour l\'assemblée générale',
  ]

  // Construire le contexte comptable pour Léa (envoyé au backend)
  const buildLeaContext = () => {
    const totalTantiemes = lots.reduce((s: number, l: CoproLot) => s + (l.tantieme || 0), 0)
    const totalDebit = ecritures.reduce((s: number, e: CoproEcriture) => s + (e.debit || 0), 0)
    const totalCredit = ecritures.reduce((s: number, e: CoproEcriture) => s + (e.credit || 0), 0)

    return {
      immeuble: imm ? {
        nom: imm.nom, adresse: imm.adresse, codePostal: imm.codePostal, ville: imm.ville,
        typeImmeuble: imm.typeImmeuble, nbLots: imm.nbLots, anneeConstruction: imm.anneeConstruction,
        budgetAnnuel: imm.budgetAnnuel, depensesAnnee: imm.depensesAnnee,
        pctBudget: imm.budgetAnnuel > 0 ? Math.round((imm.depensesAnnee / imm.budgetAnnuel) * 100) : 0,
        reglementTexte: imm.reglementTexte, reglementChargesRepartition: imm.reglementChargesRepartition,
        reglementMajoriteAG: imm.reglementMajoriteAG, reglementFondsTravaux: imm.reglementFondsTravaux,
        reglementFondsRoulementPct: imm.reglementFondsRoulementPct,
      } : null,
      lots: lots.map((l: CoproLot) => ({ numero: l.numero, proprietaire: l.proprietaire, tantieme: l.tantieme, etage: l.etage, surface: l.surface })),
      totalTantiemes,
      ecritures: ecritures.slice(0, 30).map((e: CoproEcriture) => ({ date: e.date, journal: e.journal, libelle: e.libelle, debit: e.debit, credit: e.credit, compte: e.compte })),
      ecrituresStats: { totalDebit, totalCredit, solde: totalCredit - totalDebit },
      appels: appels.map((a: CoproAppel) => ({ statut: a.statut, periode: a.periode, totalBudget: a.totalBudget })),
      budgets: budgets.map((b: CoproBudget) => ({ immeuble: b.immeuble, annee: b.annee, postes: b.postes })),
    }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session: leaSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/syndic/lea-comptable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaSession?.access_token}` },
        body: JSON.stringify({
          message: userMsg.content,
          syndic_context: buildLeaContext(),
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.response || data.reply || 'Désolé, une erreur est survenue.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur de connexion à l\'IA.' }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const hasReglement = !!(imm?.reglementTexte || imm?.reglementChargesRepartition || imm?.reglementMajoriteAG)

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl">
      {/* Header + sélecteur immeuble */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-[#0D1B2E] flex items-center gap-2"><LeaAvatar size={28} /> Agent Comptable Léa <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full font-medium">IA</span></h2>
            <p className="text-sm text-gray-500 mt-0.5">Analyse le règlement de copropriété et les données comptables pour répondre à vos questions</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Copropriété :</label>
            <select
              value={selectedImmeubleId}
              onChange={e => setSelectedImmeubleId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
            >
              {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
          </div>
        </div>

        {/* Badge règlement */}
        {imm && (
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${hasReglement ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {hasReglement ? (
              <>✅ Règlement chargé — {imm.reglementPdfNom || 'Texte saisi'}
                {imm.reglementDateMaj && <span className="text-gray-500 font-normal ml-1">· MàJ {new Date(imm.reglementDateMaj).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
              </>
            ) : (
              <>⚠️ Aucun règlement de copropriété pour <strong>{imm.nom}</strong> — Ajoutez-le dans la fiche immeuble pour des réponses précises</>
            )}
          </div>
        )}
      </div>

      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
            <div><LeaAvatar size={64} /></div>
            <div>
              <p className="font-bold text-gray-800 text-lg">Bonjour, je suis Léa !</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md">Je suis votre assistante comptable IA spécialisée en copropriété. Je connais le règlement de <strong>{imm?.nom || 'votre copropriété'}</strong> et toutes vos données comptables.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setInput(s)} className="text-left text-xs bg-[#F7F4EE] hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-200 px-3 py-2 rounded-xl transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${msg.role === 'user' ? 'bg-orange-400 text-white' : 'bg-gradient-to-br from-[#C9A84C] to-[#F0D898] text-white'}`}>
                  {msg.role === 'user' ? '👤' : <LeaAvatar size={20} />}
                </div>
                <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#F7F4EE]0 text-white rounded-tr-sm' : 'bg-[#F7F4EE] text-gray-800 border border-gray-200 rounded-tl-sm'}`}
                  dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F7F4EE]0 to-[#152338] flex items-center justify-center flex-shrink-0 overflow-hidden"><LeaAvatar size={28} /></div>
                <div className="bg-[#F7F4EE] border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Saisie */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex-shrink-0">
        {messages.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {SUGGESTIONS.slice(0, 4).map((s, i) => (
              <button key={i} onClick={() => setInput(s)} className="text-xs bg-[#F7F4EE] hover:bg-orange-50 hover:text-orange-700 px-2.5 py-1 rounded-full transition border border-transparent hover:border-orange-200">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            rows={2}
            placeholder={`Posez une question sur ${imm?.nom || 'la copropriété'}… (règlement, charges, AG, impayés…)`}
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-400 outline-none resize-none"
          />
          <div className="flex flex-col gap-1">
            <button onClick={send} disabled={!input.trim() || loading}
              className="flex-1 bg-[#C9A84C] hover:bg-[#C9A84C] disabled:opacity-40 text-white px-5 rounded-xl font-bold text-sm transition">
              Envoyer
            </button>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="text-xs text-gray-500 hover:text-gray-600 text-center">Effacer</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
