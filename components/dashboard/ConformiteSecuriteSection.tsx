'use client'

import { useState, useEffect } from 'react'

interface Habilitation {
  id: string; employe: string
  type: 'électrique_B1' | 'électrique_B2' | 'hauteur' | 'amiante' | 'CACES' | 'SST' | 'autre'
  organisme: string; dateObtention: string; dateExpiration: string
}
interface PPSPS {
  id: string; chantier: string; dateRedaction: string; redacteurNom: string
  risquesIdentifies: string; mesuresPrevention: string
  statut: 'brouillon' | 'validé' | 'transmis'
}
interface RegistreEntry {
  id: string; date: string
  type: 'accident' | 'incident' | 'presque_accident' | 'inspection'
  description: string; chantier: string
  gravite: 'mineur' | 'moyen' | 'grave'
  actionsCorrectives: string; statut: 'ouvert' | 'en_cours' | 'clôturé'
}

const TYPES_HAB = ['électrique_B1', 'électrique_B2', 'hauteur', 'amiante', 'CACES', 'SST', 'autre'] as const
const TYPES_HAB_LABELS: Record<string, string> = {
  électrique_B1: 'Électrique B1', électrique_B2: 'Électrique B2', hauteur: 'Travail en hauteur',
  amiante: 'Amiante', CACES: 'CACES', SST: 'SST', autre: 'Autre',
}
const PPSPS_STATUTS = ['brouillon', 'validé', 'transmis'] as const
const PPSPS_COLORS: Record<string, string> = { brouillon: 'bg-gray-100 text-gray-700', validé: 'bg-green-100 text-green-700', transmis: 'bg-blue-100 text-blue-700' }
const REGISTRE_TYPES = ['accident', 'incident', 'presque_accident', 'inspection'] as const
const REGISTRE_TYPE_LABELS: Record<string, string> = { accident: 'Accident', incident: 'Incident', presque_accident: 'Presque accident', inspection: 'Inspection' }
const GRAVITE_COLORS: Record<string, string> = { mineur: 'bg-green-100 text-green-700', moyen: 'bg-amber-100 text-amber-700', grave: 'bg-red-100 text-red-700' }
const REG_STATUT_COLORS: Record<string, string> = { ouvert: 'bg-red-100 text-red-700', en_cours: 'bg-amber-100 text-amber-700', clôturé: 'bg-green-100 text-green-700' }
const REG_STATUT_LABELS: Record<string, string> = { ouvert: 'Ouvert', en_cours: 'En cours', clôturé: 'Clôturé' }

function habilitationStatut(dateExpiration: string): { label: string; color: string } {
  if (!dateExpiration) return { label: 'Valide', color: 'bg-green-100 text-green-700' }
  const exp = new Date(dateExpiration)
  const now = new Date()
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return { label: 'Expiré', color: 'bg-red-100 text-red-700' }
  if (diff < 30) return { label: 'Expire bientôt', color: 'bg-amber-100 text-amber-700' }
  return { label: 'Valide', color: 'bg-green-100 text-green-700' }
}

export function ConformiteSecuriteSection({ artisan }: { artisan: import('@/lib/types').Artisan }) {
  const userId = artisan?.id || 'anon'
  const [tab, setTab] = useState<'habilitations' | 'ppsps' | 'registre'>('habilitations')
  const [habilitations, setHabilitations] = useState<Habilitation[]>([])
  const [ppspsList, setPpspsList] = useState<PPSPS[]>([])
  const [registre, setRegistre] = useState<RegistreEntry[]>([])
  const [showHabModal, setShowHabModal] = useState(false)
  const [showPpspsModal, setShowPpspsModal] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)

  const [hForm, setHForm] = useState({ employe: '', type: 'électrique_B1' as Habilitation['type'], organisme: '', dateObtention: '', dateExpiration: '' })
  const [pForm, setPForm] = useState({ chantier: '', dateRedaction: '', redacteurNom: '', risquesIdentifies: '', mesuresPrevention: '' })
  const [rForm, setRForm] = useState({ date: '', type: 'incident' as RegistreEntry['type'], description: '', chantier: '', gravite: 'mineur' as RegistreEntry['gravite'], actionsCorrectives: '' })

  useEffect(() => {
    try { setHabilitations(JSON.parse(localStorage.getItem(`fixit_habilitations_${userId}`) || '[]')) } catch { /* */ }
    try { setPpspsList(JSON.parse(localStorage.getItem(`fixit_ppsps_${userId}`) || '[]')) } catch { /* */ }
    try { setRegistre(JSON.parse(localStorage.getItem(`fixit_registre_securite_${userId}`) || '[]')) } catch { /* */ }
  }, [userId])

  const saveHab = (h: Habilitation[]) => { setHabilitations(h); localStorage.setItem(`fixit_habilitations_${userId}`, JSON.stringify(h)) }
  const savePpsps = (p: PPSPS[]) => { setPpspsList(p); localStorage.setItem(`fixit_ppsps_${userId}`, JSON.stringify(p)) }
  const saveRegistre = (r: RegistreEntry[]) => { setRegistre(r); localStorage.setItem(`fixit_registre_securite_${userId}`, JSON.stringify(r)) }

  const valides = habilitations.filter(h => habilitationStatut(h.dateExpiration).label === 'Valide').length
  const expirantBientot = habilitations.filter(h => habilitationStatut(h.dateExpiration).label === 'Expire bientôt').length
  const expires = habilitations.filter(h => habilitationStatut(h.dateExpiration).label === 'Expiré').length

  const addHab = () => {
    saveHab([{ id: crypto.randomUUID(), ...hForm }, ...habilitations])
    setHForm({ employe: '', type: 'électrique_B1', organisme: '', dateObtention: '', dateExpiration: '' })
    setShowHabModal(false)
  }
  const addPpsps = () => {
    savePpsps([{ id: crypto.randomUUID(), ...pForm, statut: 'brouillon' }, ...ppspsList])
    setPForm({ chantier: '', dateRedaction: '', redacteurNom: '', risquesIdentifies: '', mesuresPrevention: '' })
    setShowPpspsModal(false)
  }
  const addRegistre = () => {
    saveRegistre([{ id: crypto.randomUUID(), ...rForm, statut: 'ouvert' }, ...registre])
    setRForm({ date: '', type: 'incident', description: '', chantier: '', gravite: 'mineur', actionsCorrectives: '' })
    setShowRegModal(false)
  }

  const deleteHab = (id: string) => saveHab(habilitations.filter(h => h.id !== id))
  const deletePpsps = (id: string) => savePpsps(ppspsList.filter(p => p.id !== id))
  const deleteRegistre = (id: string) => saveRegistre(registre.filter(r => r.id !== id))
  const updatePpspsStatut = (id: string, statut: PPSPS['statut']) => savePpsps(ppspsList.map(p => p.id === id ? { ...p, statut } : p))
  const updateRegStatut = (id: string, statut: RegistreEntry['statut']) => saveRegistre(registre.map(r => r.id === id ? { ...r, statut } : r))

  const getAddButton = () => {
    if (tab === 'habilitations') return { onClick: () => setShowHabModal(true), label: 'Habilitation' }
    if (tab === 'ppsps') return { onClick: () => setShowPpspsModal(true), label: 'PPSPS' }
    return { onClick: () => setShowRegModal(true), label: 'Événement' }
  }
  const addBtn = getAddButton()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Conformité & Sécurité</h2>
        <button onClick={addBtn.onClick} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium">+ {addBtn.label}</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-gray-900">{habilitations.length}</p>
          <p className="text-sm text-gray-500">Habilitations</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-green-600">{valides}</p>
          <p className="text-sm text-gray-500">Valides</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-amber-600">{expirantBientot}</p>
          <p className="text-sm text-gray-500">Expirant bientôt</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-red-600">{expires}</p>
          <p className="text-sm text-gray-500">Expirées</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([['habilitations', 'Habilitations'], ['ppsps', 'PPSPS'], ['registre', 'Registre']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'habilitations' && (
        <div className="space-y-3">
          {habilitations.length === 0 && <p className="text-gray-400 text-center py-8">Aucune habilitation enregistrée</p>}
          {habilitations.map(h => {
            const s = habilitationStatut(h.dateExpiration)
            return (
              <div key={h.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{h.employe}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{TYPES_HAB_LABELS[h.type]}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                  </div>
                  <button onClick={() => deleteHab(h.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
                <div className="text-sm text-gray-600">
                  <span>{h.organisme}</span>
                  <span className="ml-4">Obtenue : {h.dateObtention}</span>
                  <span className="ml-4">Expire : {h.dateExpiration || '—'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'ppsps' && (
        <div className="space-y-3">
          {ppspsList.length === 0 && <p className="text-gray-400 text-center py-8">Aucun PPSPS enregistré</p>}
          {ppspsList.map(p => (
            <div key={p.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{p.chantier}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PPSPS_COLORS[p.statut]}`}>{p.statut.charAt(0).toUpperCase() + p.statut.slice(1)}</span>
                  <select value={p.statut} onChange={e => updatePpspsStatut(p.id, e.target.value as PPSPS['statut'])} className="text-xs border rounded px-1 py-0.5">
                    {PPSPS_STATUTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <button onClick={() => deletePpsps(p.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <span>Rédigé par : {p.redacteurNom}</span>
                <span className="ml-4">{p.dateRedaction}</span>
              </div>
              {p.risquesIdentifies && <p className="mt-1 text-sm text-gray-500">Risques : {p.risquesIdentifies.slice(0, 100)}{p.risquesIdentifies.length > 100 ? '...' : ''}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'registre' && (
        <div className="space-y-3">
          {registre.length === 0 && <p className="text-gray-400 text-center py-8">Aucun événement enregistré</p>}
          {registre.map(r => (
            <div key={r.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{r.date}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{REGISTRE_TYPE_LABELS[r.type]}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${GRAVITE_COLORS[r.gravite]}`}>{r.gravite}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REG_STATUT_COLORS[r.statut]}`}>{REG_STATUT_LABELS[r.statut]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select value={r.statut} onChange={e => updateRegStatut(r.id, e.target.value as RegistreEntry['statut'])} className="text-xs border rounded px-1 py-0.5">
                    {Object.entries(REG_STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => deleteRegistre(r.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <p className="text-sm text-gray-600">{r.description}</p>
              {r.chantier && <p className="text-xs text-gray-400 mt-1">Chantier : {r.chantier}</p>}
              {r.actionsCorrectives && <p className="text-xs text-gray-500 mt-1">Actions : {r.actionsCorrectives}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal Habilitation */}
      {showHabModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHabModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouvelle habilitation</h3>
            <div className="space-y-3">
              <input placeholder="Employé" value={hForm.employe} onChange={e => setHForm({ ...hForm, employe: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <select value={hForm.type} onChange={e => setHForm({ ...hForm, type: e.target.value as Habilitation['type'] })} className="w-full border rounded px-3 py-2 text-sm">
                {TYPES_HAB.map(t => <option key={t} value={t}>{TYPES_HAB_LABELS[t]}</option>)}
              </select>
              <input placeholder="Organisme de formation" value={hForm.organisme} onChange={e => setHForm({ ...hForm, organisme: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Date obtention</label><input type="date" value={hForm.dateObtention} onChange={e => setHForm({ ...hForm, dateObtention: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">Date expiration</label><input type="date" value={hForm.dateExpiration} onChange={e => setHForm({ ...hForm, dateExpiration: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowHabModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addHab} disabled={!hForm.employe.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PPSPS */}
      {showPpspsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPpspsModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouveau PPSPS</h3>
            <div className="space-y-3">
              <input placeholder="Chantier" value={pForm.chantier} onChange={e => setPForm({ ...pForm, chantier: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <input placeholder="Rédacteur" value={pForm.redacteurNom} onChange={e => setPForm({ ...pForm, redacteurNom: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div><label className="text-xs text-gray-500">Date rédaction</label><input type="date" value={pForm.dateRedaction} onChange={e => setPForm({ ...pForm, dateRedaction: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              <textarea placeholder="Risques identifiés" value={pForm.risquesIdentifies} onChange={e => setPForm({ ...pForm, risquesIdentifies: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
              <textarea placeholder="Mesures de prévention" value={pForm.mesuresPrevention} onChange={e => setPForm({ ...pForm, mesuresPrevention: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPpspsModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addPpsps} disabled={!pForm.chantier.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registre */}
      {showRegModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRegModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouvel événement sécurité</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Date</label><input type="date" value={rForm.date} onChange={e => setRForm({ ...rForm, date: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <select value={rForm.type} onChange={e => setRForm({ ...rForm, type: e.target.value as RegistreEntry['type'] })} className="border rounded px-3 py-2 text-sm">
                  {REGISTRE_TYPES.map(t => <option key={t} value={t}>{REGISTRE_TYPE_LABELS[t]}</option>)}
                </select>
                <select value={rForm.gravite} onChange={e => setRForm({ ...rForm, gravite: e.target.value as RegistreEntry['gravite'] })} className="border rounded px-3 py-2 text-sm">
                  <option value="mineur">Mineur</option>
                  <option value="moyen">Moyen</option>
                  <option value="grave">Grave</option>
                </select>
              </div>
              <input placeholder="Chantier" value={rForm.chantier} onChange={e => setRForm({ ...rForm, chantier: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <textarea placeholder="Description" value={rForm.description} onChange={e => setRForm({ ...rForm, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
              <textarea placeholder="Actions correctives" value={rForm.actionsCorrectives} onChange={e => setRForm({ ...rForm, actionsCorrectives: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRegModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addRegistre} disabled={!rForm.description.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
