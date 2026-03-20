'use client'

import { useState, useEffect } from 'react'

interface ItemLigne { designation: string; qty: number; unit: string; prixUnitaire: number }
interface BonCommande {
  id: string; reference: string; fournisseur: string; chantier: string
  items: ItemLigne[]; dateCommande: string; dateLivraisonPrevue: string
  statut: 'brouillon' | 'envoyé' | 'livré_partiel' | 'livré' | 'facturé'
}
interface Fournisseur {
  id: string; nom: string; siret: string; contactNom: string; contactEmail: string
  contactTel: string; adresse: string; specialite: string; note: number
}

const STATUTS_BC = ['brouillon', 'envoyé', 'livré_partiel', 'livré', 'facturé'] as const
const STATUT_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700', envoyé: 'bg-blue-100 text-blue-700',
  livré_partiel: 'bg-amber-100 text-amber-700', livré: 'bg-green-100 text-green-700',
  facturé: 'bg-purple-100 text-purple-700',
}
const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', envoyé: 'Envoyé', livré_partiel: 'Livré partiel',
  livré: 'Livré', facturé: 'Facturé',
}

function genRef(prefix: string, list: { reference: string }[]) {
  const year = new Date().getFullYear()
  const existing = list.filter(i => i.reference.startsWith(`${prefix}-${year}-`))
  const next = existing.length + 1
  return `${prefix}-${year}-${String(next).padStart(3, '0')}`
}

export function AchatsFournisseursSection({ artisan }: { artisan: any }) {
  const userId = artisan?.id || 'anon'
  const [tab, setTab] = useState<'commandes' | 'fournisseurs'>('commandes')
  const [commandes, setCommandes] = useState<BonCommande[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showFournisseurModal, setShowFournisseurModal] = useState(false)

  // BC form
  const [bcForm, setBcForm] = useState({ fournisseur: '', chantier: '', dateLivraisonPrevue: '', items: [{ designation: '', qty: 1, unit: 'u', prixUnitaire: 0 }] as ItemLigne[] })
  // Fournisseur form
  const [fForm, setFForm] = useState({ nom: '', siret: '', contactNom: '', contactEmail: '', contactTel: '', adresse: '', specialite: '', note: 3 })

  useEffect(() => {
    try { setCommandes(JSON.parse(localStorage.getItem(`fixit_achats_${userId}`) || '[]')) } catch { /* */ }
    try { setFournisseurs(JSON.parse(localStorage.getItem(`fixit_fournisseurs_${userId}`) || '[]')) } catch { /* */ }
  }, [userId])

  const saveCommandes = (c: BonCommande[]) => { setCommandes(c); localStorage.setItem(`fixit_achats_${userId}`, JSON.stringify(c)) }
  const saveFournisseurs = (f: Fournisseur[]) => { setFournisseurs(f); localStorage.setItem(`fixit_fournisseurs_${userId}`, JSON.stringify(f)) }

  const totalMontant = commandes.reduce((s, c) => s + c.items.reduce((a, i) => a + i.qty * i.prixUnitaire, 0), 0)
  const enAttente = commandes.filter(c => c.statut === 'envoyé' || c.statut === 'livré_partiel').length

  const addCommande = () => {
    const bc: BonCommande = {
      id: crypto.randomUUID(), reference: genRef('BC', commandes),
      fournisseur: bcForm.fournisseur, chantier: bcForm.chantier,
      items: bcForm.items.filter(i => i.designation.trim()),
      dateCommande: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: bcForm.dateLivraisonPrevue, statut: 'brouillon',
    }
    saveCommandes([bc, ...commandes])
    setBcForm({ fournisseur: '', chantier: '', dateLivraisonPrevue: '', items: [{ designation: '', qty: 1, unit: 'u', prixUnitaire: 0 }] })
    setShowModal(false)
  }

  const updateStatut = (id: string, statut: BonCommande['statut']) => {
    saveCommandes(commandes.map(c => c.id === id ? { ...c, statut } : c))
  }

  const deleteCommande = (id: string) => saveCommandes(commandes.filter(c => c.id !== id))

  const addFournisseur = () => {
    const f: Fournisseur = { id: crypto.randomUUID(), ...fForm }
    saveFournisseurs([f, ...fournisseurs])
    setFForm({ nom: '', siret: '', contactNom: '', contactEmail: '', contactTel: '', adresse: '', specialite: '', note: 3 })
    setShowFournisseurModal(false)
  }

  const deleteFournisseur = (id: string) => saveFournisseurs(fournisseurs.filter(f => f.id !== id))

  const updateItem = (idx: number, field: keyof ItemLigne, value: string | number) => {
    const items = [...bcForm.items]
    items[idx] = { ...items[idx], [field]: value }
    setBcForm({ ...bcForm, items })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Achats & Fournisseurs</h2>
        <button onClick={() => tab === 'commandes' ? setShowModal(true) : setShowFournisseurModal(true)} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">
          + {tab === 'commandes' ? 'Bon de commande' : 'Fournisseur'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-2xl font-bold text-gray-900">{commandes.length}</p>
          <p className="text-sm text-gray-500">Commandes</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-2xl font-bold text-amber-600">{totalMontant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
          <p className="text-sm text-gray-500">Montant total</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-2xl font-bold text-blue-600">{enAttente}</p>
          <p className="text-sm text-gray-500">En attente livraison</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['commandes', 'fournisseurs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'commandes' ? 'Bons de commande' : 'Fournisseurs'}
          </button>
        ))}
      </div>

      {tab === 'commandes' && (
        <div className="space-y-3">
          {commandes.length === 0 && <p className="text-gray-400 text-center py-8">Aucun bon de commande</p>}
          {commandes.map(bc => (
            <div key={bc.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-900">{bc.reference}</span>
                  <span className="ml-2 text-sm text-gray-500">{bc.fournisseur}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[bc.statut]}`}>{STATUT_LABELS[bc.statut]}</span>
                  <select value={bc.statut} onChange={e => updateStatut(bc.id, e.target.value as BonCommande['statut'])} className="text-xs border rounded px-1 py-0.5">
                    {STATUTS_BC.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                  </select>
                  <button onClick={() => deleteCommande(bc.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <span>Chantier : {bc.chantier}</span>
                <span className="ml-4">Livraison : {bc.dateLivraisonPrevue || '—'}</span>
                <span className="ml-4 font-medium">{bc.items.reduce((a, i) => a + i.qty * i.prixUnitaire, 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              <div className="mt-2 text-xs text-gray-400">{bc.items.map(i => `${i.designation} (${i.qty} ${i.unit})`).join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'fournisseurs' && (
        <div className="space-y-3">
          {fournisseurs.length === 0 && <p className="text-gray-400 text-center py-8">Aucun fournisseur</p>}
          {fournisseurs.map(f => (
            <div key={f.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{f.nom}</span>
                  <span className="ml-2 text-sm text-gray-500">{f.specialite}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-sm">{'★'.repeat(f.note)}{'☆'.repeat(5 - f.note)}</span>
                  <button onClick={() => deleteFournisseur(f.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {f.contactNom && <span>{f.contactNom}</span>}
                {f.contactEmail && <span className="ml-3">{f.contactEmail}</span>}
                {f.contactTel && <span className="ml-3">{f.contactTel}</span>}
              </div>
              {f.siret && <p className="text-xs text-gray-400 mt-1">SIRET : {f.siret}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal BC */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Nouveau bon de commande</h3>
            <div className="space-y-3">
              <input placeholder="Fournisseur" value={bcForm.fournisseur} onChange={e => setBcForm({ ...bcForm, fournisseur: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Chantier" value={bcForm.chantier} onChange={e => setBcForm({ ...bcForm, chantier: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={bcForm.dateLivraisonPrevue} onChange={e => setBcForm({ ...bcForm, dateLivraisonPrevue: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Articles</p>
                {bcForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input placeholder="Désignation" value={item.designation} onChange={e => updateItem(idx, 'designation', e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" />
                    <input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, 'qty', +e.target.value)} className="w-16 border rounded px-2 py-1 text-sm" />
                    <input placeholder="u" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-14 border rounded px-2 py-1 text-sm" />
                    <input type="number" min={0} step={0.01} value={item.prixUnitaire} onChange={e => updateItem(idx, 'prixUnitaire', +e.target.value)} className="w-24 border rounded px-2 py-1 text-sm" placeholder="Prix" />
                  </div>
                ))}
                <button onClick={() => setBcForm({ ...bcForm, items: [...bcForm.items, { designation: '', qty: 1, unit: 'u', prixUnitaire: 0 }] })} className="text-sm text-amber-600 hover:text-amber-700">+ Ajouter une ligne</button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={addCommande} disabled={!bcForm.fournisseur.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fournisseur */}
      {showFournisseurModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowFournisseurModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Nouveau fournisseur</h3>
            <div className="space-y-3">
              <input placeholder="Nom" value={fForm.nom} onChange={e => setFForm({ ...fForm, nom: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="SIRET" value={fForm.siret} onChange={e => setFForm({ ...fForm, siret: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Spécialité" value={fForm.specialite} onChange={e => setFForm({ ...fForm, specialite: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Contact - Nom" value={fForm.contactNom} onChange={e => setFForm({ ...fForm, contactNom: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Contact - Email" value={fForm.contactEmail} onChange={e => setFForm({ ...fForm, contactEmail: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Contact - Téléphone" value={fForm.contactTel} onChange={e => setFForm({ ...fForm, contactTel: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Adresse" value={fForm.adresse} onChange={e => setFForm({ ...fForm, adresse: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div>
                <label className="text-sm text-gray-600">Note : {fForm.note}/5</label>
                <input type="range" min={1} max={5} value={fForm.note} onChange={e => setFForm({ ...fForm, note: +e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowFournisseurModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={addFournisseur} disabled={!fForm.nom.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
