'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PPPTTravaux {
  id: string
  annee: number
  categorie: string
  description: string
  coutHT: number
  statut: 'prevu' | 'en_cours' | 'realise' | 'reporte'
  notes?: string
}

interface PPPT {
  id: string
  immeubleNom: string
  immeubleAdresse: string
  nbLots: number
  anneeConstruction: number
  statutGlobal: 'preparation' | 'soumis_ag' | 'approuve' | 'en_cours' | 'archive'
  dateValidationAG?: string
  travaux: PPPTTravaux[]
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

const CATEGORIES = [
  { key: 'structure',        label: 'Structure / Gros œuvre',        icon: '🏗️' },
  { key: 'ravalement',       label: 'Ravalement / Façades',          icon: '🧱' },
  { key: 'toiture',          label: 'Toiture / Étanchéité',          icon: '🏠' },
  { key: 'parties_communes', label: 'Parties communes',              icon: '🚪' },
  { key: 'equipements',      label: 'Équipements techniques',        icon: '⚙️' },
  { key: 'accessibilite',    label: 'Accessibilité PMR',             icon: '♿' },
  { key: 'securite',         label: 'Sécurité / Incendie',          icon: '🔥' },
  { key: 'energie',          label: 'Rénovation énergétique',        icon: '⚡' },
  { key: 'numerique',        label: 'Infrastructure numérique',      icon: '📡' },
  { key: 'autres',           label: 'Autres travaux',                icon: '🔧' },
]

const STATUTS_GLOBAL = {
  preparation: { label: 'En préparation',       dot: 'bg-yellow-400',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  soumis_ag:   { label: 'Soumis en AG',          dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200'       },
  approuve:    { label: 'Approuvé en AG',         dot: 'bg-green-400',   badge: 'bg-green-50 text-green-700 border-green-200'    },
  en_cours:    { label: 'En cours d\'exécution', dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  archive:     { label: 'Archivé',                dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-500 border-gray-200'       },
}

const STATUTS_TRAVAUX = {
  prevu:    { label: 'Prévu',    color: 'bg-blue-50 text-blue-600'   },
  en_cours: { label: 'En cours', color: 'bg-orange-50 text-orange-600' },
  realise:  { label: 'Réalisé',  color: 'bg-green-50 text-green-600' },
  reporte:  { label: 'Reporté',  color: 'bg-gray-50 text-gray-500'   },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPPPTObligation(nbLots: number, anneeConstruction: number) {
  const age = CURRENT_YEAR - anneeConstruction
  if (age < 15) return { required: false, reason: `Immeuble de moins de 15 ans (${age} ans) — PPPT non requis` }
  if (nbLots > 200) return { required: true, reason: `+200 lots — obligation légale depuis le 1er janvier 2023` }
  if (nbLots > 50)  return { required: true, reason: `51-200 lots — obligation légale depuis le 1er janvier 2024` }
  return { required: true, reason: `Tous immeubles >15 ans — obligation légale depuis le 1er janvier 2025` }
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const budgetTotal = (plan: PPPT) => plan.travaux.reduce((s, t) => s + t.coutHT, 0)

const avancement = (plan: PPPT) => {
  if (!plan.travaux.length) return 0
  return Math.round((plan.travaux.filter(t => t.statut === 'realise').length / plan.travaux.length) * 100)
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PPPTSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_pppt_${user.id}`

  const [plans, setPlans]               = useState<PPPT[]>([])
  const [showModal, setShowModal]        = useState(false)
  const [editing, setEditing]            = useState<PPPT | null>(null)
  const [selectedPlan, setSelectedPlan]  = useState<PPPT | null>(null)

  // Formulaire PPPT
  const [form, setForm]                  = useState<Partial<PPPT>>({})
  const [travaux, setTravaux]            = useState<PPPTTravaux[]>([])
  const [showAddTravaux, setShowAddTravaux] = useState(false)
  const [travauxForm, setTravauxForm]    = useState<Partial<PPPTTravaux>>({ annee: CURRENT_YEAR, statut: 'prevu' })
  const [activeDetailTab, setActiveDetailTab] = useState<'plan' | 'recap'>('plan')

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setPlans(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const savePlans = (updated: PPPT[]) => {
    setPlans(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // ── Sauvegarde formulaire ────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ statutGlobal: 'preparation', nbLots: 50, anneeConstruction: 2000 })
    setTravaux([])
    setShowAddTravaux(false)
    setShowModal(true)
  }

  const openEdit = (plan: PPPT) => {
    setEditing(plan)
    setForm({ ...plan })
    setTravaux([...plan.travaux])
    setShowAddTravaux(false)
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.immeubleNom?.trim()) return
    const now = new Date().toISOString()
    if (editing) {
      savePlans(plans.map(p => p.id === editing.id
        ? { ...editing, ...form, travaux, updatedAt: now } as PPPT
        : p
      ))
    } else {
      const newPlan: PPPT = {
        id: crypto.randomUUID(),
        immeubleNom: form.immeubleNom!,
        immeubleAdresse: form.immeubleAdresse || '',
        nbLots: form.nbLots || 1,
        anneeConstruction: form.anneeConstruction || 2000,
        statutGlobal: form.statutGlobal || 'preparation',
        dateValidationAG: form.dateValidationAG,
        notes: form.notes,
        travaux,
        createdAt: now,
        updatedAt: now,
      }
      savePlans([...plans, newPlan])
    }
    setShowModal(false)
    setEditing(null)
  }

  const handleAddTravaux = () => {
    if (!travauxForm.description?.trim() || !travauxForm.annee) return
    const t: PPPTTravaux = {
      id: crypto.randomUUID(),
      annee: travauxForm.annee!,
      categorie: travauxForm.categorie || 'autres',
      description: travauxForm.description!,
      coutHT: travauxForm.coutHT || 0,
      statut: travauxForm.statut || 'prevu',
      notes: travauxForm.notes,
    }
    setTravaux(prev => [...prev, t])
    setTravauxForm({ annee: CURRENT_YEAR, statut: 'prevu' })
    setShowAddTravaux(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce PPPT ?')) savePlans(plans.filter(p => p.id !== id))
  }

  // ── Stats globales ────────────────────────────────────────────────────────────

  const totalBudget   = plans.reduce((s, p) => s + budgetTotal(p), 0)
  const countApprouves = plans.filter(p => p.statutGlobal === 'approuve' || p.statutGlobal === 'en_cours').length
  const countEnCours  = plans.filter(p => p.statutGlobal === 'preparation' || p.statutGlobal === 'soumis_ag').length

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏗️ Plan Pluriannuel de Travaux</h1>
          <p className="text-sm text-gray-500 mt-0.5">Obligation légale — Article 14-2 Loi ÉLAN 2022</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          + Nouveau PPPT
        </button>
      </div>

      {/* Alerte légale */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-amber-800 text-sm">Rappel légal — Loi ÉLAN 2022</p>
          <p className="text-amber-700 text-sm mt-0.5">
            Le PPPT est obligatoire depuis le 1er jan. 2023 (+200 lots), 2024 (51-200 lots) et 2025 (tous immeubles &gt;15 ans).
            Il couvre un horizon de 10 ans et doit être adopté en assemblée générale.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'PPPT créés',         value: plans.length,   color: 'text-gray-900' },
          { label: 'Approuvés en AG',     value: countApprouves, color: 'text-green-600' },
          { label: 'En préparation',      value: countEnCours,   color: 'text-yellow-600' },
          { label: 'Budget portefeuille', value: totalBudget > 0 ? formatEur(totalBudget) : '—', color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste des PPPT */}
      {plans.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">🏗️</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun PPPT créé</h3>
          <p className="text-gray-400 text-sm mb-6">
            Commencez par créer le Plan Pluriannuel de Travaux<br />pour vos immeubles qui l&apos;exigent légalement.
          </p>
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            + Créer un PPPT
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => {
            const oblig    = getPPPTObligation(plan.nbLots, plan.anneeConstruction)
            const avct     = avancement(plan)
            const budget   = budgetTotal(plan)
            const statut   = STATUTS_GLOBAL[plan.statutGlobal]

            // Mini chart budgétaire par année
            const budgetByYear = plan.travaux.reduce((acc, t) => {
              acc[t.annee] = (acc[t.annee] || 0) + t.coutHT
              return acc
            }, {} as Record<number, number>)
            const years     = Object.keys(budgetByYear).map(Number).sort()
            const maxBudget = Math.max(...Object.values(budgetByYear), 1)

            return (
              <div key={plan.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{plan.immeubleNom}</h3>
                    {plan.immeubleAdresse && <p className="text-xs text-gray-400 truncate">{plan.immeubleAdresse}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{plan.nbLots} lots · Construit en {plan.anneeConstruction}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ml-2 flex-shrink-0 ${statut.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
                    {statut.label}
                  </span>
                </div>

                {/* Obligation légale */}
                <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${oblig.required ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                  {oblig.required ? '⚖️' : '✅'} {oblig.reason}
                </div>

                {/* Budget */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Budget total</span>
                  <span className="font-bold text-gray-900">{budget > 0 ? formatEur(budget) : '—'}</span>
                </div>

                {/* Avancement */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Avancement ({plan.travaux.filter(t => t.statut === 'realise').length}/{plan.travaux.length} travaux)</span>
                    <span className="text-xs font-semibold text-gray-700">{avct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${avct}%` }} />
                  </div>
                </div>

                {/* Mini chart */}
                {years.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Répartition sur 10 ans</p>
                    <div className="flex items-end gap-0.5 h-10">
                      {years.slice(0, 12).map(y => (
                        <div key={y} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className={`w-full rounded-t-sm transition-all ${y === CURRENT_YEAR ? 'bg-blue-500' : y < CURRENT_YEAR ? 'bg-green-400' : 'bg-blue-200'}`}
                            style={{ height: `${Math.max((budgetByYear[y] / maxBudget) * 100, 8)}%` }}
                            title={`${y} : ${formatEur(budgetByYear[y])}`}
                          />
                          <span className="text-[9px] text-gray-400">{String(y).slice(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="flex-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                  >
                    👁️ Voir le plan
                  </button>
                  <button
                    onClick={() => openEdit(plan)}
                    className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors"
                    aria-label="Supprimer ce PPPT"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal détail plan ───────────────────────────────────────────────────── */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedPlan(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPlan.immeubleNom}</h2>
                <p className="text-sm text-gray-500">PPPT · {selectedPlan.travaux.length} travaux · {formatEur(budgetTotal(selectedPlan))}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">🖨️ Imprimer</button>
                <button onClick={() => setSelectedPlan(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Fermer">✕</button>
              </div>
            </div>

            <div className="p-6">
              {/* Info immeuble */}
              <div className="grid grid-cols-4 gap-4 mb-6 bg-gray-50 rounded-xl p-4">
                <div><p className="text-xs text-gray-400">Lots</p><p className="font-bold">{selectedPlan.nbLots}</p></div>
                <div><p className="text-xs text-gray-400">Construction</p><p className="font-bold">{selectedPlan.anneeConstruction}</p></div>
                <div><p className="text-xs text-gray-400">Statut</p><span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUTS_GLOBAL[selectedPlan.statutGlobal].badge}`}>{STATUTS_GLOBAL[selectedPlan.statutGlobal].label}</span></div>
                <div><p className="text-xs text-gray-400">Date AG</p><p className="font-bold text-sm">{selectedPlan.dateValidationAG || '—'}</p></div>
              </div>

              {/* Onglets */}
              <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
                {(['plan', 'recap'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveDetailTab(tab)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeDetailTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'plan' ? '📋 Plan annuel' : '📊 Récapitulatif'}
                  </button>
                ))}
              </div>

              {/* Onglet Plan */}
              {activeDetailTab === 'plan' && (
                <div>
                  {/* Futurs */}
                  {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + i).map(year => {
                    const yearTravaux = selectedPlan.travaux.filter(t => t.annee === year)
                    if (!yearTravaux.length) return null
                    const yearBudget = yearTravaux.reduce((s, t) => s + t.coutHT, 0)
                    return (
                      <div key={year} className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold text-sm px-3 py-0.5 rounded-full ${year === CURRENT_YEAR ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{year}</span>
                          <span className="font-bold text-gray-900">{formatEur(yearBudget)}</span>
                        </div>
                        <div className="space-y-2">
                          {yearTravaux.map(t => {
                            const cat = CATEGORIES.find(c => c.key === t.categorie)
                            return (
                              <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                                <span className="text-xl">{cat?.icon || '🔧'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm">{t.description}</p>
                                  <p className="text-xs text-gray-400">{cat?.label}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS_TRAVAUX[t.statut].color}`}>{STATUTS_TRAVAUX[t.statut].label}</span>
                                <span className="font-bold text-gray-900 text-sm flex-shrink-0">{formatEur(t.coutHT)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Passés */}
                  {selectedPlan.travaux.filter(t => t.annee < CURRENT_YEAR).length > 0 && (
                    <div className="mt-4 opacity-70">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Travaux antérieurs</p>
                      {selectedPlan.travaux.filter(t => t.annee < CURRENT_YEAR).sort((a, b) => b.annee - a.annee).map(t => {
                        const cat = CATEGORIES.find(c => c.key === t.categorie)
                        return (
                          <div key={t.id} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-2">
                            <span className="text-xl">{cat?.icon || '🔧'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-700 text-sm">{t.description}</p>
                              <p className="text-xs text-gray-400">{t.annee} · {cat?.label}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Réalisé</span>
                            <span className="font-bold text-gray-700 text-sm flex-shrink-0">{formatEur(t.coutHT)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {selectedPlan.travaux.length === 0 && (
                    <div className="text-center py-12 text-gray-400">Aucun travail planifié dans ce PPPT.</div>
                  )}
                </div>
              )}

              {/* Onglet Récapitulatif */}
              {activeDetailTab === 'recap' && (
                <div className="space-y-4">
                  {/* Avancement */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-700 text-sm">Avancement global</span>
                      <span className="font-bold text-gray-900">{avancement(selectedPlan)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${avancement(selectedPlan)}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span>{selectedPlan.travaux.filter(t => t.statut === 'realise').length} réalisé(s)</span>
                      <span>{selectedPlan.travaux.filter(t => t.statut === 'en_cours').length} en cours</span>
                      <span>{selectedPlan.travaux.filter(t => t.statut === 'prevu').length} prévu(s)</span>
                    </div>
                  </div>

                  {/* Par catégorie */}
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-700 text-sm mb-3">Répartition par catégorie</h4>
                    <div className="space-y-2.5">
                      {CATEGORIES.map(cat => {
                        const catT = selectedPlan.travaux.filter(t => t.categorie === cat.key)
                        if (!catT.length) return null
                        const catBudget = catT.reduce((s, t) => s + t.coutHT, 0)
                        const pct = (catBudget / Math.max(budgetTotal(selectedPlan), 1)) * 100
                        return (
                          <div key={cat.key} className="flex items-center gap-3">
                            <span className="text-lg w-6 flex-shrink-0">{cat.icon}</span>
                            <span className="text-sm text-gray-600 w-40 truncate flex-shrink-0">{cat.label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-gray-900 w-24 text-right flex-shrink-0">{formatEur(catBudget)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                      <span className="font-bold text-gray-700">Total PPPT</span>
                      <span className="font-bold text-gray-900">{formatEur(budgetTotal(selectedPlan))}</span>
                    </div>
                  </div>

                  {/* Par année */}
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-700 text-sm mb-3">Répartition par année</h4>
                    {Array.from({ length: 10 }, (_, i) => CURRENT_YEAR + i).map(year => {
                      const yearT = selectedPlan.travaux.filter(t => t.annee === year)
                      if (!yearT.length) return null
                      const yb = yearT.reduce((s, t) => s + t.coutHT, 0)
                      return (
                        <div key={year} className="flex items-center gap-3 mb-2">
                          <span className={`text-xs w-10 font-bold ${year === CURRENT_YEAR ? 'text-blue-600' : 'text-gray-500'}`}>{year}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${year === CURRENT_YEAR ? 'bg-blue-500' : 'bg-blue-300'}`} style={{ width: `${(yb / Math.max(budgetTotal(selectedPlan), 1)) * 100}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-24 text-right">{formatEur(yb)}</span>
                        </div>
                      )
                    })}
                  </div>

                  {selectedPlan.notes && (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-yellow-700 mb-1">Notes</p>
                      <p className="text-sm text-yellow-800">{selectedPlan.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Création / Édition ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">{editing ? '✏️ Modifier le PPPT' : '+ Nouveau PPPT'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Fermer">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Immeuble */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Immeuble</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nom de l&apos;immeuble *</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Résidence les Pins"
                      value={form.immeubleNom || ''}
                      onChange={e => setForm({ ...form, immeubleNom: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12 rue des Fleurs, 75001 Paris"
                      value={form.immeubleAdresse || ''}
                      onChange={e => setForm({ ...form, immeubleAdresse: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nombre de lots</label>
                    <input
                      type="number" min={1}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.nbLots || ''}
                      onChange={e => setForm({ ...form, nbLots: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Année de construction</label>
                    <input
                      type="number" min={1800} max={CURRENT_YEAR}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.anneeConstruction || ''}
                      onChange={e => setForm({ ...form, anneeConstruction: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Badge obligation */}
                {!!form.nbLots && !!form.anneeConstruction && (() => {
                  const oblig = getPPPTObligation(form.nbLots!, form.anneeConstruction!)
                  return (
                    <div className={`mt-2 text-xs px-3 py-2 rounded-xl ${oblig.required ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                      {oblig.required ? '⚖️' : '✅'} {oblig.reason}
                    </div>
                  )
                })()}
              </section>

              {/* Statut */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Statut du plan</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Statut</label>
                    <select
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.statutGlobal || 'preparation'}
                      onChange={e => setForm({ ...form, statutGlobal: e.target.value as PPPT['statutGlobal'] })}
                    >
                      {Object.entries(STATUTS_GLOBAL).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date validation AG</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.dateValidationAG || ''}
                      onChange={e => setForm({ ...form, dateValidationAG: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Travaux */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">🔨 Travaux planifiés ({travaux.length})</h3>
                  <button
                    onClick={() => setShowAddTravaux(v => !v)}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                  >
                    {showAddTravaux ? 'Annuler' : '+ Ajouter'}
                  </button>
                </div>

                {/* Formulaire ajout travaux */}
                {showAddTravaux && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Année</label>
                        <input
                          type="number" min={CURRENT_YEAR - 5} max={CURRENT_YEAR + 15}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                          value={travauxForm.annee || CURRENT_YEAR}
                          onChange={e => setTravauxForm({ ...travauxForm, annee: parseInt(e.target.value) || CURRENT_YEAR })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Catégorie</label>
                        <select
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                          value={travauxForm.categorie || ''}
                          onChange={e => setTravauxForm({ ...travauxForm, categorie: e.target.value })}
                        >
                          <option value="">Choisir...</option>
                          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Description *</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                        placeholder="Ex: Réfection complète de la toiture..."
                        value={travauxForm.description || ''}
                        onChange={e => setTravauxForm({ ...travauxForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Coût estimatif HT (€)</label>
                        <input
                          type="number" min={0}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                          value={travauxForm.coutHT || ''}
                          onChange={e => setTravauxForm({ ...travauxForm, coutHT: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Statut</label>
                        <select
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                          value={travauxForm.statut || 'prevu'}
                          onChange={e => setTravauxForm({ ...travauxForm, statut: e.target.value as PPPTTravaux['statut'] })}
                        >
                          {Object.entries(STATUTS_TRAVAUX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddTravaux}
                        disabled={!travauxForm.description?.trim() || !travauxForm.annee}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        Ajouter ce travail
                      </button>
                    </div>
                  </div>
                )}

                {travaux.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    Aucun travail planifié — cliquez sur &quot;+ Ajouter&quot;
                  </div>
                ) : (
                  <div className="space-y-2">
                    {travaux.sort((a, b) => a.annee - b.annee).map(t => {
                      const cat = CATEGORIES.find(c => c.key === t.categorie)
                      return (
                        <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                          <span>{cat?.icon || '🔧'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                            <p className="text-xs text-gray-400">{t.annee} · {cat?.label}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUTS_TRAVAUX[t.statut].color}`}>{STATUTS_TRAVAUX[t.statut].label}</span>
                          <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatEur(t.coutHT)}</span>
                          <button
                            onClick={() => setTravaux(prev => prev.filter(x => x.id !== t.id))}
                            className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                            aria-label="Supprimer ce travail"
                          >✕</button>
                        </div>
                      )
                    })}
                    <div className="flex justify-between px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold">
                      <span className="text-gray-600">Budget total estimatif HT</span>
                      <span className="text-gray-900">{formatEur(travaux.reduce((s, t) => s + t.coutHT, 0))}</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Notes */}
              <section>
                <label className="text-xs text-gray-500 mb-1 block">Notes / Observations</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Contexte, références aux diagnostics, observations..."
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </section>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!form.immeubleNom?.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editing ? '💾 Enregistrer les modifications' : '✅ Créer le PPPT'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
