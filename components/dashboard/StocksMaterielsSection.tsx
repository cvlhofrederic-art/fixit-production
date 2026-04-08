'use client'

import { useState, useEffect } from 'react'

interface Materiel {
  id: string; nom: string
  categorie: 'outillage' | 'véhicule' | 'engin' | 'échafaudage' | 'autre'
  marque: string; reference: string
  etat: 'neuf' | 'bon' | 'usé' | 'HS'
  localisation: string; dateAchat: string; valeur: number; notes: string
}
interface Consommable {
  id: string; nom: string
  categorie: 'fixation' | 'étanchéité' | 'peinture' | 'électricité' | 'plomberie' | 'autre'
  unite: string; quantiteEnStock: number; seuilAlerte: number
  prixUnitaire: number; fournisseur: string
}

const CAT_MATERIEL = ['outillage', 'véhicule', 'engin', 'échafaudage', 'autre'] as const
const CAT_CONSO = ['fixation', 'étanchéité', 'peinture', 'électricité', 'plomberie', 'autre'] as const
const ETATS = ['neuf', 'bon', 'usé', 'HS'] as const
const ETAT_COLORS: Record<string, string> = {
  neuf: 'bg-green-100 text-green-700', bon: 'bg-blue-100 text-blue-700',
  usé: 'bg-amber-100 text-amber-700', HS: 'bg-red-100 text-red-700',
}

export function StocksMaterielsSection({ artisan }: { artisan: import('@/lib/types').Artisan }) {
  const userId = artisan?.id || 'anon'
  const [tab, setTab] = useState<'materiel' | 'consommables'>('materiel')
  const [materiels, setMateriels] = useState<Materiel[]>([])
  const [consommables, setConsommables] = useState<Consommable[]>([])
  const [showMaterielModal, setShowMaterielModal] = useState(false)
  const [showConsoModal, setShowConsoModal] = useState(false)

  const [mForm, setMForm] = useState({ nom: '', categorie: 'outillage' as Materiel['categorie'], marque: '', reference: '', etat: 'neuf' as Materiel['etat'], localisation: 'Dépôt', dateAchat: '', valeur: 0, notes: '' })
  const [cForm, setCForm] = useState({ nom: '', categorie: 'fixation' as Consommable['categorie'], unite: 'u', quantiteEnStock: 0, seuilAlerte: 5, prixUnitaire: 0, fournisseur: '' })

  useEffect(() => {
    try { setMateriels(JSON.parse(localStorage.getItem(`fixit_materiel_${userId}`) || '[]')) } catch { /* */ }
    try { setConsommables(JSON.parse(localStorage.getItem(`fixit_consommables_${userId}`) || '[]')) } catch { /* */ }
  }, [userId])

  const saveMateriels = (m: Materiel[]) => { setMateriels(m); localStorage.setItem(`fixit_materiel_${userId}`, JSON.stringify(m)) }
  const saveConsommables = (c: Consommable[]) => { setConsommables(c); localStorage.setItem(`fixit_consommables_${userId}`, JSON.stringify(c)) }

  const surChantier = materiels.filter(m => m.localisation !== 'Dépôt' && m.etat !== 'HS').length
  const auDepot = materiels.filter(m => m.localisation === 'Dépôt' && m.etat !== 'HS').length
  const hs = materiels.filter(m => m.etat === 'HS').length

  const addMateriel = () => {
    saveMateriels([{ id: crypto.randomUUID(), ...mForm }, ...materiels])
    setMForm({ nom: '', categorie: 'outillage', marque: '', reference: '', etat: 'neuf', localisation: 'Dépôt', dateAchat: '', valeur: 0, notes: '' })
    setShowMaterielModal(false)
  }

  const addConsommable = () => {
    saveConsommables([{ id: crypto.randomUUID(), ...cForm }, ...consommables])
    setCForm({ nom: '', categorie: 'fixation', unite: 'u', quantiteEnStock: 0, seuilAlerte: 5, prixUnitaire: 0, fournisseur: '' })
    setShowConsoModal(false)
  }

  const deleteMateriel = (id: string) => saveMateriels(materiels.filter(m => m.id !== id))
  const deleteConsommable = (id: string) => saveConsommables(consommables.filter(c => c.id !== id))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Stocks & Matériel</h2>
        <button onClick={() => tab === 'materiel' ? setShowMaterielModal(true) : setShowConsoModal(true)} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium">
          + {tab === 'materiel' ? 'Matériel' : 'Consommable'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-gray-900">{materiels.length}</p>
          <p className="text-sm text-gray-500">Total matériel</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-blue-600">{surChantier}</p>
          <p className="text-sm text-gray-500">Sur chantier</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-green-600">{auDepot}</p>
          <p className="text-sm text-gray-500">Au dépôt</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-red-600">{hs}</p>
          <p className="text-sm text-gray-500">HS</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([['materiel', 'Matériel'], ['consommables', 'Consommables']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'materiel' && (
        <div className="space-y-3">
          {materiels.length === 0 && <p className="text-gray-400 text-center py-4">Aucun matériel enregistré</p>}
          {materiels.map(m => (
            <div key={m.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{m.nom}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{m.categorie}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAT_COLORS[m.etat]}`}>{m.etat}</span>
                </div>
                <button onClick={() => deleteMateriel(m.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
              </div>
              <div className="text-sm text-gray-600">
                {m.marque && <span>{m.marque} {m.reference}</span>}
                <span className="ml-4">Loc. : {m.localisation}</span>
                {m.valeur > 0 && <span className="ml-4">{m.valeur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>}
              </div>
              {m.notes && <p className="mt-1 text-xs text-gray-400">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'consommables' && (
        <div className="space-y-3">
          {consommables.length === 0 && <p className="text-gray-400 text-center py-4">Aucun consommable enregistré</p>}
          {consommables.map(c => {
            const lowStock = c.quantiteEnStock <= c.seuilAlerte
            return (
              <div key={c.id} className={`bg-white rounded-md border p-4 hover:shadow-sm transition-shadow ${lowStock ? 'border-amber-300 bg-amber-50' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{c.nom}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{c.categorie}</span>
                    {lowStock && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Stock bas</span>}
                  </div>
                  <button onClick={() => deleteConsommable(c.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{c.quantiteEnStock} {c.unite}</span>
                  <span className="ml-2 text-gray-400">(seuil : {c.seuilAlerte})</span>
                  {c.prixUnitaire > 0 && <span className="ml-4">{c.prixUnitaire.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}/{c.unite}</span>}
                  {c.fournisseur && <span className="ml-4 text-gray-400">{c.fournisseur}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Matériel */}
      {showMaterielModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowMaterielModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">Nouveau matériel</h3>
            <div className="space-y-3">
              <input placeholder="Nom" value={mForm.nom} onChange={e => setMForm({ ...mForm, nom: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={mForm.categorie} onChange={e => setMForm({ ...mForm, categorie: e.target.value as Materiel['categorie'] })} className="border rounded px-3 py-2 text-sm">
                  {CAT_MATERIEL.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <select value={mForm.etat} onChange={e => setMForm({ ...mForm, etat: e.target.value as Materiel['etat'] })} className="border rounded px-3 py-2 text-sm">
                  {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Marque" value={mForm.marque} onChange={e => setMForm({ ...mForm, marque: e.target.value })} className="border rounded px-3 py-2 text-sm" />
                <input placeholder="Référence" value={mForm.reference} onChange={e => setMForm({ ...mForm, reference: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              </div>
              <input placeholder="Localisation (ex: Dépôt, Chantier X)" value={mForm.localisation} onChange={e => setMForm({ ...mForm, localisation: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Date d&apos;achat</label><input type="date" value={mForm.dateAchat} onChange={e => setMForm({ ...mForm, dateAchat: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">Valeur (EUR)</label><input type="number" min={0} step={0.01} value={mForm.valeur || ''} onChange={e => setMForm({ ...mForm, valeur: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              </div>
              <textarea placeholder="Notes" value={mForm.notes} onChange={e => setMForm({ ...mForm, notes: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowMaterielModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addMateriel} disabled={!mForm.nom.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consommable */}
      {showConsoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowConsoModal(false)}>
          <div className="bg-white rounded-md p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">Nouveau consommable</h3>
            <div className="space-y-3">
              <input placeholder="Nom" value={cForm.nom} onChange={e => setCForm({ ...cForm, nom: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <select value={cForm.categorie} onChange={e => setCForm({ ...cForm, categorie: e.target.value as Consommable['categorie'] })} className="w-full border rounded px-3 py-2 text-sm">
                {CAT_CONSO.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-500">Unité</label><input value={cForm.unite} onChange={e => setCForm({ ...cForm, unite: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">Quantité</label><input type="number" min={0} value={cForm.quantiteEnStock} onChange={e => setCForm({ ...cForm, quantiteEnStock: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500">Seuil alerte</label><input type="number" min={0} value={cForm.seuilAlerte} onChange={e => setCForm({ ...cForm, seuilAlerte: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Prix unitaire</label><input type="number" min={0} step={0.01} value={cForm.prixUnitaire || ''} onChange={e => setCForm({ ...cForm, prixUnitaire: +e.target.value })} className="w-full border rounded px-3 py-2 text-sm" /></div>
                <input placeholder="Fournisseur" value={cForm.fournisseur} onChange={e => setCForm({ ...cForm, fournisseur: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowConsoModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addConsommable} disabled={!cForm.nom.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
