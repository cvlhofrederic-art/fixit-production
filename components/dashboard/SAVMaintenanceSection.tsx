'use client'

import { useState, useEffect } from 'react'

interface ContratMaintenance {
  id: string; reference: string; client: string
  type: 'annuel' | 'semestriel' | 'trimestriel' | 'ponctuel'
  montant: number; dateDebut: string; dateFin: string
  chantierOrigine: string; description: string
  statut: 'actif' | 'expiré' | 'résilié'
}
interface InterventionSAV {
  id: string; reference: string; client: string; contratRef: string
  description: string; dateIntervention: string; dureeHeures: number
  statut: 'planifié' | 'en_cours' | 'terminé' | 'facturé'; notes: string
}

const TYPE_LABELS: Record<string, string> = { annuel: 'Annuel', semestriel: 'Semestriel', trimestriel: 'Trimestriel', ponctuel: 'Ponctuel' }
const STATUT_CONTRAT_COLORS: Record<string, string> = {
  actif: 'bg-green-100 text-green-700', expiré: 'bg-red-100 text-red-700', résilié: 'bg-gray-100 text-gray-700',
}
const STATUT_SAV_COLORS: Record<string, string> = {
  planifié: 'bg-blue-100 text-blue-700', en_cours: 'bg-amber-100 text-amber-700',
  terminé: 'bg-green-100 text-green-700', facturé: 'bg-purple-100 text-purple-700',
}
const STATUT_SAV_LABELS: Record<string, string> = { planifié: 'Planifié', en_cours: 'En cours', terminé: 'Terminé', facturé: 'Facturé' }

function genRef(prefix: string, list: { reference: string }[]) {
  const year = new Date().getFullYear()
  const count = list.filter(i => i.reference.startsWith(`${prefix}-${year}-`)).length + 1
  return `${prefix}-${year}-${String(count).padStart(3, '0')}`
}

export function SAVMaintenanceSection({ artisan }: { artisan: import('@/lib/types').Artisan }) {
  const userId = artisan?.id || 'anon'
  const [tab, setTab] = useState<'contrats' | 'sav'>('contrats')
  const [contrats, setContrats] = useState<ContratMaintenance[]>([])
  const [savList, setSavList] = useState<InterventionSAV[]>([])
  const [showContratModal, setShowContratModal] = useState(false)
  const [showSavModal, setShowSavModal] = useState(false)

  const [cForm, setCForm] = useState({ client: '', type: 'annuel' as ContratMaintenance['type'], montant: 0, dateDebut: '', dateFin: '', chantierOrigine: '', description: '' })
  const [sForm, setSForm] = useState({ client: '', contratRef: '', description: '', dateIntervention: '', dureeHeures: 1, notes: '' })

  useEffect(() => {
    try { setContrats(JSON.parse(localStorage.getItem(`fixit_contrats_maintenance_${userId}`) || '[]')) } catch { /* */ }
    try { setSavList(JSON.parse(localStorage.getItem(`fixit_sav_${userId}`) || '[]')) } catch { /* */ }
  }, [userId])

  const saveContrats = (c: ContratMaintenance[]) => { setContrats(c); localStorage.setItem(`fixit_contrats_maintenance_${userId}`, JSON.stringify(c)) }
  const saveSav = (s: InterventionSAV[]) => { setSavList(s); localStorage.setItem(`fixit_sav_${userId}`, JSON.stringify(s)) }

  const contratsActifs = contrats.filter(c => c.statut === 'actif')
  const revenusRecurrents = contratsActifs.reduce((s, c) => s + c.montant, 0)
  const prochaineEcheance = contratsActifs.map(c => c.dateFin).filter(Boolean).sort()[0] || '—'

  const addContrat = () => {
    const c: ContratMaintenance = { id: crypto.randomUUID(), reference: genRef('CTR', contrats), ...cForm, statut: 'actif' }
    saveContrats([c, ...contrats])
    setCForm({ client: '', type: 'annuel', montant: 0, dateDebut: '', dateFin: '', chantierOrigine: '', description: '' })
    setShowContratModal(false)
  }

  const addSav = () => {
    const s: InterventionSAV = { id: crypto.randomUUID(), reference: genRef('SAV', savList), ...sForm, statut: 'planifié' }
    saveSav([s, ...savList])
    setSForm({ client: '', contratRef: '', description: '', dateIntervention: '', dureeHeures: 1, notes: '' })
    setShowSavModal(false)
  }

  const deleteContrat = (id: string) => saveContrats(contrats.filter(c => c.id !== id))
  const deleteSav = (id: string) => saveSav(savList.filter(s => s.id !== id))
  const updateContratStatut = (id: string, statut: ContratMaintenance['statut']) => saveContrats(contrats.map(c => c.id === id ? { ...c, statut } : c))
  const updateSavStatut = (id: string, statut: InterventionSAV['statut']) => saveSav(savList.map(s => s.id === id ? { ...s, statut } : s))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">SAV & Maintenance</h2>
        <button onClick={() => tab === 'contrats' ? setShowContratModal(true) : setShowSavModal(true)} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium">
          + {tab === 'contrats' ? 'Contrat' : 'Intervention SAV'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-green-600">{contratsActifs.length}</p>
          <p className="text-sm text-gray-500">Contrats actifs</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-amber-600">{revenusRecurrents.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
          <p className="text-sm text-gray-500">Revenus récurrents</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-blue-600">{prochaineEcheance}</p>
          <p className="text-sm text-gray-500">Prochaine échéance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([['contrats', 'Contrats'], ['sav', 'Interventions SAV']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'contrats' && (
        <div className="space-y-3">
          {contrats.length === 0 && <p className="text-gray-400 text-center py-8">Aucun contrat de maintenance</p>}
          {contrats.map(c => (
            <div key={c.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-900">{c.reference}</span>
                  <span className="ml-2 text-sm text-gray-500">{c.client}</span>
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{TYPE_LABELS[c.type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_CONTRAT_COLORS[c.statut]}`}>{c.statut.charAt(0).toUpperCase() + c.statut.slice(1)}</span>
                  <select value={c.statut} onChange={e => updateContratStatut(c.id, e.target.value as ContratMaintenance['statut'])} className="text-xs border rounded px-1 py-0.5">
                    <option value="actif">Actif</option>
                    <option value="expiré">Expiré</option>
                    <option value="résilié">Résilié</option>
                  </select>
                  <button onClick={() => deleteContrat(c.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <span>{c.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                <span className="ml-4">{c.dateDebut} → {c.dateFin}</span>
                {c.chantierOrigine && <span className="ml-4 text-gray-400">Chantier : {c.chantierOrigine}</span>}
              </div>
              {c.description && <p className="mt-1 text-sm text-gray-500">{c.description}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'sav' && (
        <div className="space-y-3">
          {savList.length === 0 && <p className="text-gray-400 text-center py-8">Aucune intervention SAV</p>}
          {savList.map(s => (
            <div key={s.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-900">{s.reference}</span>
                  <span className="ml-2 text-sm text-gray-500">{s.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_SAV_COLORS[s.statut]}`}>{STATUT_SAV_LABELS[s.statut]}</span>
                  <select value={s.statut} onChange={e => updateSavStatut(s.id, e.target.value as InterventionSAV['statut'])} className="text-xs border rounded px-1 py-0.5">
                    {Object.entries(STATUT_SAV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => deleteSav(s.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <span>{s.dateIntervention}</span>
                <span className="ml-4">{s.dureeHeures}h</span>
                {s.contratRef && <span className="ml-4 text-gray-400">Contrat : {s.contratRef}</span>}
              </div>
              <p className="mt-1 text-sm text-gray-500">{s.description}</p>
              {s.notes && <p className="mt-1 text-xs text-gray-400">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal Contrat */}
      {showContratModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowContratModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouveau contrat de maintenance</h3>
            <div className="space-y-3">
              <input placeholder="Client" value={cForm.client} onChange={e => setCForm({ ...cForm, client: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <select value={cForm.type} onChange={e => setCForm({ ...cForm, type: e.target.value as ContratMaintenance['type'] })} className="w-full border rounded px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" min={0} step={0.01} placeholder="Montant (EUR)" value={cForm.montant || ''} onChange={e => setCForm({ ...cForm, montant: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Début</label><input type="date" value={cForm.dateDebut} onChange={e => setCForm({ ...cForm, dateDebut: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">Fin</label><input type="date" value={cForm.dateFin} onChange={e => setCForm({ ...cForm, dateFin: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              </div>
              <input placeholder="Chantier d'origine" value={cForm.chantierOrigine} onChange={e => setCForm({ ...cForm, chantierOrigine: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <textarea placeholder="Description" value={cForm.description} onChange={e => setCForm({ ...cForm, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowContratModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addContrat} disabled={!cForm.client.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal SAV */}
      {showSavModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSavModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouvelle intervention SAV</h3>
            <div className="space-y-3">
              <input placeholder="Client" value={sForm.client} onChange={e => setSForm({ ...sForm, client: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <input placeholder="Référence contrat (optionnel)" value={sForm.contratRef} onChange={e => setSForm({ ...sForm, contratRef: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <textarea placeholder="Description" value={sForm.description} onChange={e => setSForm({ ...sForm, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={3} />
              <input type="date" value={sForm.dateIntervention} onChange={e => setSForm({ ...sForm, dateIntervention: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div><label className="text-xs text-gray-500">Durée (heures)</label><input type="number" min={0.5} step={0.5} value={sForm.dureeHeures} onChange={e => setSForm({ ...sForm, dureeHeures: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              <textarea placeholder="Notes" value={sForm.notes} onChange={e => setSForm({ ...sForm, notes: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSavModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addSav} disabled={!sForm.client.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
