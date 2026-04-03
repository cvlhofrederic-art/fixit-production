'use client'

import { useState, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

type Signalement = {
  id: string; immeuble: string; demandeurNom: string; demandeurRole: string
  demandeurEmail: string; demandeurTelephone: string; typeIntervention: string
  description: string; priorite: 'urgente' | 'haute' | 'normale' | 'basse'
  statut: 'en_attente' | 'en_cours' | 'traite' | 'rejete'
  batiment: string; etage: string; numLot: string; estPartieCommune: boolean
  zoneSignalee: string; artisanAssigne: string; createdAt: string; updatedAt: string
  messages: { id: string; auteur: string; role: string; texte: string; createdAt: string }[]
}

const PRIORITE_COLORS: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  haute: 'bg-orange-100 text-orange-700',
  normale: 'bg-blue-100 text-blue-700',
  basse: 'bg-gray-100 text-gray-500',
}
const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  en_cours: 'bg-blue-100 text-blue-700',
  traite: 'bg-green-100 text-green-700',
  rejete: 'bg-gray-100 text-gray-500',
}
const STATUT_LABELS: Record<string, string> = {
  en_attente: '⏳ En attente',
  en_cours: '🔄 En cours',
  traite: '✅ Traité',
  rejete: '⛔ Rejeté',
}
const PRIORITE_LABELS: Record<string, string> = {
  urgente: '🔴 Urgente',
  haute: '🟠 Haute',
  normale: '🔵 Normale',
  basse: '⚪ Basse',
}

export default function ExtranetSection({ user, userRole }: { user: User; userRole: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const uid = user?.id || 'demo'

  type Coproprietaire = { id: string; nom: string; email: string; lot: string; tantieme: number; telephone: string; solde: number; dateAdhesion: string; accesActif: boolean }

  // ── Copros state ──
  const [copros, setCopros] = useState<Coproprietaire[]>(() => { try { return JSON.parse(localStorage.getItem(`fixit_copros_${uid}`) || '[]') } catch { return [] } })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', lot: '', tantieme: '', telephone: '', solde: '' })
  const [showInvite, setShowInvite] = useState<Coproprietaire | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Tabs ──
  const [activeSection, setActiveSection] = useState<'copros' | 'signalements'>('copros')

  // ── Signalements state ──
  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [loadingSignalements, setLoadingSignalements] = useState(false)
  const [signalementError, setSignalementError] = useState('')
  const [selected, setSelected] = useState<Signalement | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [filterPriorite, setFilterPriorite] = useState<string>('all')

  const save = (u: Coproprietaire[]) => { setCopros(u); localStorage.setItem(`fixit_copros_${uid}`, JSON.stringify(u)) }
  const handleAdd = () => {
    if (!form.nom.trim()) return
    const c: Coproprietaire = { id: Date.now().toString(), nom: form.nom, email: form.email, lot: form.lot, tantieme: parseFloat(form.tantieme) || 0, telephone: form.telephone, solde: parseFloat(form.solde) || 0, dateAdhesion: new Date().toISOString().split('T')[0], accesActif: true }
    save([...copros, c])
    setShowModal(false)
    setForm({ nom: '', email: '', lot: '', tantieme: '', telephone: '', solde: '' })
  }
  const toggleAcces = (id: string) => { save(copros.map(c => c.id === id ? { ...c, accesActif: !c.accesActif } : c)) }

  const totalSolde = copros.reduce((s, c) => s + c.solde, 0)
  const enRetard = copros.filter(c => c.solde < 0).length

  // ── Fetch signalements ──
  const fetchSignalements = async () => {
    setLoadingSignalements(true)
    setSignalementError('')
    try {
      const res = await fetch('/api/syndic/signalements')
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      setSignalements(data.signalements || [])
    } catch {
      setSignalementError('Impossible de charger les demandes. Vérifiez votre connexion.')
    } finally {
      setLoadingSignalements(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'signalements') fetchSignalements()
  }, [activeSection])

  // ── Update statut ──
  const handleUpdateStatut = async (id: string, statut: string) => {
    setUpdatingId(id)
    try {
      await fetch('/api/syndic/signalements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, statut }),
      })
      setSignalements(prev => prev.map(s => s.id === id ? { ...s, statut: statut as any } : s))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut: statut as any } : null)
    } catch {}
    setUpdatingId(null)
  }

  // ── Send message ──
  const handleSendReply = async () => {
    if (!selected || !replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch('/api/syndic/signalements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalementId: selected.id, auteur: user?.email || 'Gestionnaire', role: 'gestionnaire', texte: replyText.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMsg = { id: data.message?.id || Date.now().toString(), auteur: user?.email || 'Gestionnaire', role: 'gestionnaire', texte: replyText.trim(), createdAt: new Date().toISOString() }
        setSignalements(prev => prev.map(s => s.id === selected.id ? { ...s, messages: [...s.messages, newMsg] } : s))
        setSelected(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : null)
        setReplyText('')
      }
    } catch {}
    setSendingReply(false)
  }

  const filtered = signalements.filter(s =>
    (filterStatut === 'all' || s.statut === filterStatut) &&
    (filterPriorite === 'all' || s.priorite === filterPriorite)
  )
  const pending = signalements.filter(s => s.statut === 'en_attente').length

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-5 border-b-2 border-[#C9A84C] shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">👥 Extranet Copropriétaires</h1>
          <p className="text-sm text-gray-500">Registre · Accès portail · Demandes d'intervention</p>
        </div>
        {activeSection === 'copros' && (
          <button onClick={() => setShowModal(true)} className="bg-[#0D1B2E] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#152338]">+ Copropriétaire</button>
        )}
        {activeSection === 'signalements' && (
          <button onClick={fetchSignalements} disabled={loadingSignalements} className="bg-[#0D1B2E] text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-[#152338] disabled:opacity-60">{loadingSignalements ? '⏳' : '🔄 Actualiser'}</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b flex">
        <button onClick={() => setActiveSection('copros')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeSection === 'copros' ? 'border-[#C9A84C] text-[#C9A84C]' : 'border-transparent text-gray-500'}`}>
          👥 Copropriétaires {copros.length > 0 && <span className="ml-1 bg-[#F7F4EE] text-[#0D1B2E] text-xs px-1.5 rounded-full">{copros.length}</span>}
        </button>
        <button onClick={() => setActiveSection('signalements')} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeSection === 'signalements' ? 'border-[#C9A84C] text-[#C9A84C]' : 'border-transparent text-gray-500'}`}>
          🔔 Demandes d'intervention
          {pending > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending}</span>}
        </button>
      </div>

      {/* ── COPROPRIÉTAIRES ── */}
      {activeSection === 'copros' && (
        <div className="p-6 lg:p-8">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-[#C9A84C]"><div className="text-sm text-gray-500">Copropriétaires</div><div className="text-3xl font-bold text-[#C9A84C]">{copros.length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Accès actifs</div><div className="text-3xl font-bold text-green-600">{copros.filter(c => c.accesActif).length}</div></div>
            <div className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 ${totalSolde >= 0 ? 'border-green-400' : 'border-red-400'}`}><div className="text-sm text-gray-500">Solde global</div><div className={`text-3xl font-bold ${totalSolde >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalSolde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400"><div className="text-sm text-gray-500">En retard</div><div className="text-3xl font-bold text-red-600">{enRetard}</div></div>
          </div>

          {copros.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-5xl mb-4">👥</div><h3 className="text-xl font-bold mb-2">Registre vide</h3><p className="text-gray-500 mb-6">Ajoutez vos copropriétaires pour leur donner accès au portail</p><button onClick={() => setShowModal(true)} className="bg-[#0D1B2E] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#152338]">+ Premier copropriétaire</button></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F4EE] text-gray-500 uppercase text-xs"><tr><th className="px-5 py-3 text-left">Copropriétaire</th><th className="px-5 py-3 text-left">Lot</th><th className="px-5 py-3 text-right">Tantièmes</th><th className="px-5 py-3 text-right">Solde</th><th className="px-5 py-3 text-center">Accès</th><th className="px-5 py-3 text-center">Actions</th></tr></thead>
                <tbody>
                  {copros.map(c => (
                    <tr key={c.id} className="border-t hover:bg-[#F7F4EE]">
                      <td className="px-5 py-4"><div className="font-semibold">{c.nom}</div><div className="text-xs text-gray-500">{c.email}</div></td>
                      <td className="px-5 py-4 text-gray-600">{c.lot || '—'}</td>
                      <td className="px-5 py-4 text-right">{c.tantieme}</td>
                      <td className={`px-5 py-4 text-right font-bold ${c.solde < 0 ? 'text-red-600' : 'text-green-600'}`}>{c.solde.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</td>
                      <td className="px-5 py-4 text-center"><button onClick={() => toggleAcces(c.id)} className={`px-3 py-1 rounded-full text-xs font-bold ${c.accesActif ? 'bg-green-100 text-green-700' : 'bg-[#F7F4EE] text-gray-500'}`}>{c.accesActif ? '✅ Actif' : '⏸ Inactif'}</button></td>
                      <td className="px-5 py-4 text-center"><button onClick={() => setShowInvite(c)} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1.5 rounded-lg hover:bg-[#E4DDD0] font-semibold">📧 Inviter</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 bg-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-5">
            <h3 className="font-bold text-[#0D1B2E] mb-2">🌐 Portail Copropriétaires</h3>
            <p className="text-sm text-[#C9A84C] mb-3">Chaque copropriétaire peut accéder à son espace personnel pour consulter ses charges, PV d'AG et documents.</p>
            <div className="flex gap-2">
              <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail`} className="flex-1 bg-white border-2 border-[#E4DDD0] rounded-xl px-4 py-2 text-sm font-mono" />
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/coproprietaire/portail`); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${copied ? 'bg-green-500 text-white' : 'bg-[#0D1B2E] text-white hover:bg-[#152338]'}`}>{copied ? '✅ Copié' : '📋 Copier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEMANDES D'INTERVENTION ── */}
      {activeSection === 'signalements' && (
        <div className="p-6 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-amber-400"><div className="text-sm text-gray-500">En attente</div><div className="text-3xl font-bold text-amber-600">{signalements.filter(s => s.statut === 'en_attente').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-400"><div className="text-sm text-gray-500">En cours</div><div className="text-3xl font-bold text-blue-600">{signalements.filter(s => s.statut === 'en_cours').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400"><div className="text-sm text-gray-500">Urgentes</div><div className="text-3xl font-bold text-red-600">{signalements.filter(s => s.priorite === 'urgente' && s.statut !== 'traite').length}</div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-400"><div className="text-sm text-gray-500">Traitées</div><div className="text-3xl font-bold text-green-600">{signalements.filter(s => s.statut === 'traite').length}</div></div>
          </div>

          {/* Filtres */}
          {signalements.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <div className="flex gap-1 flex-wrap">
                {['all', 'en_attente', 'en_cours', 'traite', 'rejete'].map(st => (
                  <button key={st} onClick={() => setFilterStatut(st)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filterStatut === st ? 'bg-[#0D1B2E] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {st === 'all' ? 'Tous statuts' : STATUT_LABELS[st]}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {['all', 'urgente', 'haute', 'normale', 'basse'].map(p => (
                  <button key={p} onClick={() => setFilterPriorite(p)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filterPriorite === p ? 'bg-[#C9A84C] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {p === 'all' ? 'Toutes priorités' : PRIORITE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {loadingSignalements ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center"><div className="text-4xl mb-3 animate-pulse">⏳</div><p className="text-gray-500">Chargement des demandes...</p></div>
          ) : signalementError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <p className="text-red-700 font-semibold mb-3">⚠️ {signalementError}</p>
              <button onClick={fetchSignalements} className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-red-700">Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">🔔</div>
              <h3 className="text-xl font-bold mb-2">{signalements.length === 0 ? 'Aucune demande reçue' : 'Aucun résultat'}</h3>
              <p className="text-gray-500">{signalements.length === 0 ? "Les demandes d'intervention des copropriétaires apparaîtront ici." : 'Essayez de modifier vos filtres.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => (
                <div key={s.id} onClick={() => { setSelected(s); setReplyText('') }} className="bg-white rounded-2xl shadow-sm p-5 cursor-pointer hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold">{s.typeIntervention || 'Intervention'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITE_COLORS[s.priorite]}`}>{PRIORITE_LABELS[s.priorite]}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUT_COLORS[s.statut]}`}>{STATUT_LABELS[s.statut]}</span>
                        {s.messages.length > 0 && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">💬 {s.messages.length} message{s.messages.length > 1 ? 's' : ''}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{s.description}</p>
                      <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                        {s.immeuble && <span>🏢 {s.immeuble}</span>}
                        {s.demandeurNom && <span>👤 {s.demandeurNom}</span>}
                        {s.numLot && <span>🏠 Lot {s.numLot}</span>}
                        {s.batiment && <span>🏗️ Bât. {s.batiment}{s.etage ? ` — Ét. ${s.etage}` : ''}</span>}
                        {s.estPartieCommune && <span className="text-blue-600 font-semibold">Partie commune</span>}
                        <span>📅 {new Date(s.createdAt).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={s.statut}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); handleUpdateStatut(s.id, e.target.value) }}
                        disabled={updatingId === s.id}
                        className="text-xs border-2 border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#C9A84C] disabled:opacity-60"
                      >
                        <option value="en_attente">⏳ En attente</option>
                        <option value="en_cours">🔄 En cours</option>
                        <option value="traite">✅ Traité</option>
                        <option value="rejete">⛔ Rejeté</option>
                      </select>
                      <button onClick={e => { e.stopPropagation(); setSelected(s); setReplyText('') }} className="text-xs bg-[#F7F4EE] text-[#0D1B2E] px-2 py-1.5 rounded-lg hover:bg-[#E4DDD0] font-semibold text-center">💬 Répondre</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL COPRO ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">👤 Nouveau copropriétaire</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Nom complet *</label><input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Jean Dupont" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              <div><label className="block text-sm font-semibold mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jean.dupont@email.com" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Lot</label><input value={form.lot} onChange={e => setForm({...form, lot: e.target.value})} placeholder="Apt 12" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Tantièmes</label><input type="number" value={form.tantieme} onChange={e => setForm({...form, tantieme: e.target.value})} placeholder="250" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Téléphone</label><input value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
                <div><label className="block text-sm font-semibold mb-1">Solde (€)</label><input type="number" value={form.solde} onChange={e => setForm({...form, solde: e.target.value})} placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none" /></div>
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">Annuler</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338]">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL INVITE ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">📧 Inviter {showInvite.nom}</h2></div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Envoyez ce message à votre copropriétaire pour lui donner accès au portail :</p>
              <div className="bg-[#F7F4EE] rounded-xl p-4 text-sm font-mono whitespace-pre-line border border-gray-200">
                {`Bonjour ${showInvite.nom},\n\nVotre syndic vous invite à accéder à votre espace copropriétaire en ligne sur Vitfix Pro.\n\nVotre lien d'accès :\n${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail\n\nLot : ${showInvite.lot || 'N/A'}\nEmail : ${showInvite.email || 'À compléter'}\n\nCordialement,\nVotre Syndic`}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`Bonjour ${showInvite!.nom},\n\nVotre syndic vous invite à accéder à votre espace copropriétaire Vitfix Pro.\n${typeof window !== 'undefined' ? window.location.origin : ''}/coproprietaire/portail\n\nLot : ${showInvite!.lot}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition ${copied ? 'bg-green-500 text-white' : 'bg-[#0D1B2E] text-white hover:bg-[#152338]'}`}>{copied ? '✅ Copié !' : '📋 Copier le message'}</button>
            </div>
            <div className="p-6 border-t"><button onClick={() => setShowInvite(null)} className="w-full py-2.5 border-2 border-gray-200 rounded-xl font-semibold hover:bg-[#F7F4EE]">Fermer</button></div>
          </div>
        </div>
      )}

      {/* ── MODAL SIGNALEMENT DÉTAIL ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{selected.typeIntervention || "Demande d'intervention"}</h2>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PRIORITE_COLORS[selected.priorite]}`}>{PRIORITE_LABELS[selected.priorite]}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUT_COLORS[selected.statut]}`}>{STATUT_LABELS[selected.statut]}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Fermer" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Infos demandeur */}
              <div className="bg-[#F7F4EE] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Demandeur</span><div className="font-semibold">{selected.demandeurNom || '—'}</div></div>
                <div><span className="text-gray-500">Rôle</span><div className="font-semibold">{selected.demandeurRole || '—'}</div></div>
                {selected.demandeurEmail && <div><span className="text-gray-500">Email</span><div className="font-semibold">{selected.demandeurEmail}</div></div>}
                {selected.demandeurTelephone && <div><span className="text-gray-500">Téléphone</span><div className="font-semibold">{selected.demandeurTelephone}</div></div>}
                {selected.immeuble && <div><span className="text-gray-500">Immeuble</span><div className="font-semibold">{selected.immeuble}</div></div>}
                {selected.numLot && <div><span className="text-gray-500">Lot</span><div className="font-semibold">{selected.numLot}</div></div>}
                {selected.batiment && <div><span className="text-gray-500">Bâtiment / Étage</span><div className="font-semibold">{selected.batiment}{selected.etage ? ` — Ét. ${selected.etage}` : ''}</div></div>}
                {selected.zoneSignalee && <div><span className="text-gray-500">Zone</span><div className="font-semibold">{selected.zoneSignalee}</div></div>}
                {selected.estPartieCommune && <div className="col-span-2"><span className="text-blue-600 font-semibold">📌 Partie commune</span></div>}
                <div className="col-span-2"><span className="text-gray-500">Reçue le</span><div className="font-semibold">{new Date(selected.createdAt).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div></div>
              </div>

              {/* Description */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-2">Description</h3>
                <p className="text-sm bg-white border border-gray-200 rounded-xl p-4">{selected.description || 'Aucune description.'}</p>
              </div>

              {/* Changer statut */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-2">Changer le statut</h3>
                <div className="flex gap-2 flex-wrap">
                  {(['en_attente', 'en_cours', 'traite', 'rejete'] as const).map(st => (
                    <button key={st} onClick={() => handleUpdateStatut(selected.id, st)} disabled={updatingId === selected.id || selected.statut === st} className={`px-3 py-2 rounded-xl text-xs font-bold transition ${selected.statut === st ? STATUT_COLORS[st] + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-2 border-gray-200 hover:bg-[#F7F4EE]'} disabled:opacity-50`}>
                      {STATUT_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread messages */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-3">Messages ({selected.messages.length})</h3>
                {selected.messages.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Aucun échange pour l'instant.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selected.messages.map(m => (
                      <div key={m.id} className={`p-3 rounded-xl text-sm ${m.role === 'gestionnaire' ? 'bg-[#0D1B2E] text-white ml-8' : 'bg-[#F7F4EE] text-gray-800 mr-8'}`}>
                        <div className="font-semibold text-xs mb-1 opacity-70">{m.auteur} · {new Date(m.createdAt).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
                        <p>{m.texte}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase mb-2">Répondre</h3>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="Votre réponse au copropriétaire..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#C9A84C] outline-none resize-none text-sm"
                />
                <button onClick={handleSendReply} disabled={!replyText.trim() || sendingReply} className="mt-2 w-full py-2.5 bg-[#0D1B2E] text-white rounded-xl font-semibold text-sm hover:bg-[#152338] disabled:opacity-60">
                  {sendingReply ? '⏳ Envoi...' : '📤 Envoyer la réponse'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
