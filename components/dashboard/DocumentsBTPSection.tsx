'use client'

import { useState, useEffect } from 'react'
import { PlusCircle, X, FileText, Download } from 'lucide-react'

interface DOEDocument { nom: string; type: 'plan' | 'notice' | 'certificat' | 'photo'; ajouteLe: string }
interface DOEEntry {
  id: string; chantier: string; dateRemise: string
  documents: DOEDocument[]; statut: 'en_cours' | 'complet' | 'remis'
}

const REGLEMENTATIONS_FR = [
  { categorie: 'Couverture', nom: 'DTU 40.21', description: 'Couvertures en feuilles et bandes de zinc', annee: '2013' },
  { categorie: 'Plomberie', nom: 'DTU 60.11', description: 'Règles de calcul des installations de plomberie sanitaire', annee: '2013' },
  { categorie: 'Chauffage', nom: 'DTU 65.14', description: 'Exécution de planchers chauffants à eau chaude', annee: '2006' },
  { categorie: 'Thermique', nom: 'RE2020', description: 'Réglementation environnementale des bâtiments neufs', annee: '2022' },
  { categorie: 'Électricité', nom: 'NF C 15-100', description: 'Installations électriques basse tension', annee: '2015' },
  { categorie: 'Béton', nom: 'NF EN 206', description: 'Spécification, performances, production et conformité du béton', annee: '2014' },
]
const REGLEMENTATIONS_PT = [
  { categorie: 'Estruturas', nom: 'Eurocódigos', description: 'Normas europeias de projeto de estruturas', annee: '2010' },
  { categorie: 'Eletricidade', nom: 'RIEBT', description: 'Regras de instalações elétricas de baixa tensão', annee: '2006' },
  { categorie: 'Telecomunicações', nom: 'ITED', description: 'Infraestruturas de telecomunicações em edifícios', annee: '2019' },
  { categorie: 'Betão', nom: 'NP EN 206', description: 'Especificação, desempenho, produção e conformidade do betão', annee: '2013' },
]

const MODELES = [
  { nom: 'Contrat prestation B2C', categorie: 'Contrats' },
  { nom: 'Contrat prestation B2B', categorie: 'Contrats' },
  { nom: 'CCTP Toiture', categorie: 'CCTP' },
  { nom: 'CCTP Isolation ITE', categorie: 'CCTP' },
  { nom: 'Contrat sous-traitance', categorie: 'Contrats' },
  { nom: 'PV réception travaux', categorie: 'PV' },
  { nom: 'Attestation TVA réduite', categorie: 'Fiscal' },
]

const STATUT_COLORS: Record<string, string> = {
  en_cours: 'bg-amber-100 text-amber-700', complet: 'bg-green-100 text-green-700', remis: 'bg-blue-100 text-blue-700',
}
const STATUT_LABELS: Record<string, string> = { en_cours: 'En cours', complet: 'Complet', remis: 'Remis' }

export function DocumentsBTPSection({ artisan, locale = 'fr' }: { artisan: import('@/lib/types').Artisan; locale?: string }) {
  const userId = artisan?.id || 'anon'
  const [tab, setTab] = useState<'reglementation' | 'modeles' | 'doe'>('reglementation')
  const [doeList, setDoeList] = useState<DOEEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [doeForm, setDoeForm] = useState({ chantier: '', dateRemise: '', documents: [{ nom: '', type: 'plan' as DOEDocument['type'], ajouteLe: new Date().toISOString().split('T')[0] }] })

  useEffect(() => {
    try { setDoeList(JSON.parse(localStorage.getItem(`fixit_doe_${userId}`) || '[]')) } catch { /* */ }
  }, [userId])

  const saveDoe = (list: DOEEntry[]) => { setDoeList(list); localStorage.setItem(`fixit_doe_${userId}`, JSON.stringify(list)) }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const addDoe = () => {
    const entry: DOEEntry = {
      id: crypto.randomUUID(), chantier: doeForm.chantier, dateRemise: doeForm.dateRemise,
      documents: doeForm.documents.filter(d => d.nom.trim()), statut: 'en_cours',
    }
    saveDoe([entry, ...doeList])
    setDoeForm({ chantier: '', dateRemise: '', documents: [{ nom: '', type: 'plan', ajouteLe: new Date().toISOString().split('T')[0] }] })
    setShowModal(false)
  }

  const deleteDoe = (id: string) => saveDoe(doeList.filter(d => d.id !== id))
  const updateDoeStatut = (id: string, statut: DOEEntry['statut']) => saveDoe(doeList.map(d => d.id === id ? { ...d, statut } : d))

  const reglementations = locale === 'pt' ? REGLEMENTATIONS_PT : REGLEMENTATIONS_FR

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Documents BTP</h2>

      {/* Toast */}
      {toast && <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded text-sm z-50">{toast}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-gray-900">{reglementations.length}</p>
          <p className="text-sm text-gray-500">Réglementations</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-blue-600">{MODELES.length}</p>
          <p className="text-sm text-gray-500">Modèles</p>
        </div>
        <div className="bg-white rounded-md border p-4">
          <p className="text-base font-semibold text-amber-600">{doeList.length}</p>
          <p className="text-sm text-gray-500">DOE</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([['reglementation', 'Réglementation'], ['modeles', 'Modèles'], ['doe', 'DOE']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'reglementation' && (
        <div className="bg-white rounded-md border divide-y">
          {reglementations.map((r, i) => (
            <button key={i} onClick={() => showToast('Document ouvert')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
              <div>
                <span className="text-xs font-medium text-amber-600 uppercase">{r.categorie}</span>
                <p className="font-semibold text-gray-900">{r.nom}</p>
                <p className="text-sm text-gray-500">{r.description}</p>
              </div>
              <span className="text-xs text-gray-400">{r.annee}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'modeles' && (
        <div className="bg-white rounded-md border divide-y">
          {MODELES.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div>
                <span className="text-xs font-medium text-blue-600 uppercase">{m.categorie}</span>
                <p className="font-semibold text-gray-900">{m.nom}</p>
              </div>
              <button onClick={() => showToast('Téléchargé')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 flex items-center gap-1"><Download size={14} /> Télécharger</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'doe' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 text-sm font-medium flex items-center gap-1"><PlusCircle size={14} /> Nouveau DOE</button>
          </div>
          {doeList.length === 0 && <p className="text-gray-400 text-center py-8">Aucun DOE enregistré</p>}
          {doeList.map(doe => (
            <div key={doe.id} className="bg-white rounded-md border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{doe.chantier}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[doe.statut]}`}>{STATUT_LABELS[doe.statut]}</span>
                  <select value={doe.statut} onChange={e => updateDoeStatut(doe.id, e.target.value as DOEEntry['statut'])} className="text-xs border rounded px-1 py-0.5">
                    <option value="en_cours">En cours</option>
                    <option value="complet">Complet</option>
                    <option value="remis">Remis</option>
                  </select>
                  <button onClick={() => setConfirmDeleteId(doe.id)} className="text-red-400 hover:text-red-600 text-sm" aria-label="Supprimer ce document"><X size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-500">Remise : {doe.dateRemise || '—'}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {doe.documents.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{d.type}: {d.nom}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal DOE */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-md p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nouveau DOE</h3>
            <div className="space-y-3">
              <input placeholder="Chantier" value={doeForm.chantier} onChange={e => setDoeForm({ ...doeForm, chantier: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <input type="date" value={doeForm.dateRemise} onChange={e => setDoeForm({ ...doeForm, dateRemise: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-sm font-medium text-gray-700">Documents</p>
              {doeForm.documents.map((doc, idx) => (
                <div key={idx} className="flex gap-2">
                  <input placeholder="Nom du document" value={doc.nom} onChange={e => { const docs = [...doeForm.documents]; docs[idx] = { ...docs[idx], nom: e.target.value }; setDoeForm({ ...doeForm, documents: docs }) }} className="flex-1 border rounded px-2 py-1 text-sm" />
                  <select value={doc.type} onChange={e => { const docs = [...doeForm.documents]; docs[idx] = { ...docs[idx], type: e.target.value as DOEDocument['type'] }; setDoeForm({ ...doeForm, documents: docs }) }} className="border rounded px-2 py-1 text-sm">
                    <option value="plan">Plan</option>
                    <option value="notice">Notice</option>
                    <option value="certificat">Certificat</option>
                    <option value="photo">Photo</option>
                  </select>
                </div>
              ))}
              <button onClick={() => setDoeForm({ ...doeForm, documents: [...doeForm.documents, { nom: '', type: 'plan', ajouteLe: new Date().toISOString().split('T')[0] }] })} className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"><PlusCircle size={14} /> Ajouter un document</button>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={addDoe} disabled={!doeForm.chantier.trim()} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation suppression DOE */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-md p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Supprimer ce DOE ?</h3>
            <p className="text-sm text-gray-500 mb-4">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-2 border rounded text-sm">Annuler</button>
              <button onClick={() => { deleteDoe(confirmDeleteId); setConfirmDeleteId(null) }} className="flex-1 px-4 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
