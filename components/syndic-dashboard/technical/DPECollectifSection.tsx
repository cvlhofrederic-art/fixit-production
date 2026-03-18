'use client'

import { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClasseDPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

interface DPEImmeuble {
  id: string
  immeubleNom: string
  immeubleAdresse: string
  nbLots: number
  nbLotsClassesFG: number
  classeEnergie: ClasseDPE
  classeGES: ClasseDPE
  consommationKWh: number        // kWh/m²/an
  emissionsKgCO2: number         // kgCO2/m²/an
  dateDiagnostic: string
  dateExpiration: string
  diagnostiqueur: string
  recommandations: string
  lienPPPT?: string              // id du PPPT associé
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── Config DPE ───────────────────────────────────────────────────────────────

const CLASSE_CONFIG: Record<ClasseDPE, { label: string; bg: string; text: string; border: string; kwh: string }> = {
  A: { label: 'A', bg: 'bg-[#009a6e]', text: 'text-white', border: 'border-[#009a6e]', kwh: '≤ 70'   },
  B: { label: 'B', bg: 'bg-[#51b84b]', text: 'text-white', border: 'border-[#51b84b]', kwh: '71-110'  },
  C: { label: 'C', bg: 'bg-[#abce50]', text: 'text-white', border: 'border-[#abce50]', kwh: '111-180' },
  D: { label: 'D', bg: 'bg-[#f7e64b]', text: 'text-gray-800', border: 'border-[#f7e64b]', kwh: '181-250' },
  E: { label: 'E', bg: 'bg-[#f0b429]', text: 'text-white', border: 'border-[#f0b429]', kwh: '251-330' },
  F: { label: 'F', bg: 'bg-[#e8731a]', text: 'text-white', border: 'border-[#e8731a]', kwh: '331-420' },
  G: { label: 'G', bg: 'bg-[#d9231e]', text: 'text-white', border: 'border-[#d9231e]', kwh: '> 420'   },
}

const CLASSES: ClasseDPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const joursRestants = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

// Badge classe DPE (style officiel)
function ClasseBadge({ classe, size = 'md' }: { classe: ClasseDPE; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = CLASSE_CONFIG[classe]
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-sm' : size === 'lg' ? 'w-16 h-16 text-3xl font-black' : 'w-10 h-10 text-lg font-bold'
  return (
    <div className={`${cfg.bg} ${cfg.text} ${sizeClass} rounded-lg flex items-center justify-center font-bold shadow-sm`}>
      {classe}
    </div>
  )
}

// Échelle DPE mini
function EchelleDPE({ classe }: { classe: ClasseDPE }) {
  return (
    <div className="flex flex-col gap-0.5">
      {CLASSES.map(c => (
        <div key={c} className={`flex items-center gap-1.5 ${c === classe ? 'opacity-100' : 'opacity-25'}`}>
          <div className={`${CLASSE_CONFIG[c].bg} ${CLASSE_CONFIG[c].text} text-[10px] font-bold w-5 h-4 flex items-center justify-center rounded-sm`}>{c}</div>
          <div className={`${CLASSE_CONFIG[c].bg} rounded-r-sm h-4`} style={{ width: `${(CLASSES.indexOf(c) + 1) * 10 + 10}px` }} />
          {c === classe && <span className="text-[10px] font-bold text-gray-700">◀ {CLASSE_CONFIG[c].kwh} kWh/m²/an</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DPECollectifSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_dpe_collectif_${user.id}`

  const [dpes, setDpes]         = useState<DPEImmeuble[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<DPEImmeuble | null>(null)
  const [selected, setSelected] = useState<DPEImmeuble | null>(null)
  const [form, setForm]         = useState<Partial<DPEImmeuble>>({ classeEnergie: 'D', classeGES: 'D' })

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setDpes(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: DPEImmeuble[]) => {
    setDpes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ classeEnergie: 'D', classeGES: 'D', nbLots: 20, nbLotsClassesFG: 0 })
    setShowModal(true)
  }

  const openEdit = (dpe: DPEImmeuble) => {
    setEditing(dpe)
    setForm({ ...dpe })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.immeubleNom || !form.classeEnergie || !form.dateDiagnostic) return
    const now = new Date().toISOString()
    if (editing) {
      save(dpes.map(d => d.id === editing.id ? { ...editing, ...form, updatedAt: now } as DPEImmeuble : d))
    } else {
      const newDpe: DPEImmeuble = {
        id: crypto.randomUUID(),
        immeubleNom: form.immeubleNom!,
        immeubleAdresse: form.immeubleAdresse || '',
        nbLots: form.nbLots || 1,
        nbLotsClassesFG: form.nbLotsClassesFG || 0,
        classeEnergie: form.classeEnergie!,
        classeGES: form.classeGES || 'D',
        consommationKWh: form.consommationKWh || 0,
        emissionsKgCO2: form.emissionsKgCO2 || 0,
        dateDiagnostic: form.dateDiagnostic!,
        dateExpiration: form.dateExpiration || '',
        diagnostiqueur: form.diagnostiqueur || '',
        recommandations: form.recommandations || '',
        notes: form.notes,
        createdAt: now,
        updatedAt: now,
      }
      save([...dpes, newDpe])
    }
    setShowModal(false)
    setEditing(null)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:     dpes.length,
    conformes: dpes.filter(d => ['A', 'B', 'C', 'D'].includes(d.classeEnergie)).length,
    passoires: dpes.filter(d => ['F', 'G'].includes(d.classeEnergie)).length,
    expires:   dpes.filter(d => d.dateExpiration && joursRestants(d.dateExpiration) < 0).length,
    aRenouveler: dpes.filter(d => d.dateExpiration && joursRestants(d.dateExpiration) >= 0 && joursRestants(d.dateExpiration) <= 365).length,
  }), [dpes])

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚡ DPE Collectif</h1>
          <p className="text-sm text-gray-500 mt-0.5">Obligation légale depuis le 1er janvier 2026 — Toutes copropriétés</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          + Ajouter un DPE
        </button>
      </div>

      {/* Alerte légale */}
      <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-red-800 text-sm">Obligation légale depuis le 1er janvier 2026</p>
          <p className="text-red-700 text-sm mt-0.5">
            Le DPE Collectif est obligatoire pour toutes les copropriétés. Sans ce diagnostic,
            la responsabilité civile du syndic est engagée. Il doit être fourni au notaire lors de toute vente de lot et liaison obligatoire avec le PPPT.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'DPE enregistrés',    value: stats.total,        color: 'text-gray-900' },
          { label: 'Conformes (A à D)',   value: stats.conformes,    color: 'text-green-600' },
          { label: 'Passoires (F & G)',   value: stats.passoires,    color: stats.passoires > 0 ? 'text-red-600 font-black' : 'text-gray-900' },
          { label: 'Expirés',             value: stats.expires,      color: stats.expires > 0 ? 'text-red-600' : 'text-gray-900' },
          { label: 'À renouveler <1an',   value: stats.aRenouveler,  color: stats.aRenouveler > 0 ? 'text-orange-600' : 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {stats.expires > 0 && (
        <div className="mb-4 bg-red-100 border border-red-300 rounded-xl p-3 flex items-center gap-2">
          <span>🔴</span>
          <p className="text-sm text-red-700 font-semibold">{stats.expires} DPE expiré{stats.expires > 1 ? 's' : ''} — Action immédiate requise</p>
        </div>
      )}
      {stats.aRenouveler > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
          <span>🟠</span>
          <p className="text-sm text-orange-700">{stats.aRenouveler} DPE à renouveler dans l&apos;année</p>
        </div>
      )}

      {/* Liste DPE */}
      {dpes.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun DPE enregistré</h3>
          <p className="text-gray-400 text-sm mb-6">
            Commencez par saisir le DPE collectif de vos immeubles.<br />
            <span className="text-red-500 font-medium">Obligation légale depuis janvier 2026.</span>
          </p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            + Ajouter un DPE
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dpes.map(dpe => {
            const joursExp = dpe.dateExpiration ? joursRestants(dpe.dateExpiration) : null
            const estExpire = joursExp !== null && joursExp < 0
            const bientotExpire = joursExp !== null && joursExp >= 0 && joursExp <= 365
            const cfg = CLASSE_CONFIG[dpe.classeEnergie]

            return (
              <div
                key={dpe.id}
                className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer ${estExpire ? 'border-red-200' : bientotExpire ? 'border-orange-200' : 'border-gray-200'}`}
                onClick={() => setSelected(s => s?.id === dpe.id ? null : dpe)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{dpe.immeubleNom}</h3>
                    {dpe.immeubleAdresse && <p className="text-xs text-gray-400 truncate">{dpe.immeubleAdresse}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{dpe.nbLots} lots</p>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <ClasseBadge classe={dpe.classeEnergie} size="lg" />
                  </div>
                </div>

                {/* Consommation */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Consommation énergie</p>
                    <p className="font-bold text-gray-900">{dpe.consommationKWh > 0 ? `${dpe.consommationKWh} kWh/m²/an` : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Émissions GES</p>
                    <p className="font-bold text-gray-900">{dpe.emissionsKgCO2 > 0 ? `${dpe.emissionsKgCO2} kgCO₂/m²/an` : '—'}</p>
                  </div>
                </div>

                {/* Passoires thermiques */}
                {dpe.nbLotsClassesFG > 0 && (
                  <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <span className="text-red-500">🔴</span>
                    <p className="text-xs text-red-700 font-medium">{dpe.nbLotsClassesFG} lot{dpe.nbLotsClassesFG > 1 ? 's' : ''} classé{dpe.nbLotsClassesFG > 1 ? 's' : ''} F ou G</p>
                  </div>
                )}

                {/* Date expiration */}
                {dpe.dateExpiration && (
                  <div className={`mb-3 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium ${estExpire ? 'bg-red-100 text-red-700' : bientotExpire ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                    <span>{estExpire ? '🔴' : bientotExpire ? '🟠' : '✅'}</span>
                    {estExpire ? `Expiré depuis ${Math.abs(joursExp!)} j` : bientotExpire ? `Expire dans ${joursExp} j` : `Valide jusqu&apos;au ${formatDate(dpe.dateExpiration)}`}
                  </div>
                )}

                {/* Diagnostiqueur */}
                {dpe.diagnostiqueur && <p className="text-xs text-gray-400 mb-3">Diagnostiqueur : {dpe.diagnostiqueur}</p>}

                {/* Détail étendu */}
                {selected?.id === dpe.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3" onClick={e => e.stopPropagation()}>
                    <EchelleDPE classe={dpe.classeEnergie} />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Diagnostic le</span><p className="font-semibold">{formatDate(dpe.dateDiagnostic)}</p></div>
                      <div><span className="text-gray-400">Expiration</span><p className={`font-semibold ${estExpire ? 'text-red-600' : ''}`}>{dpe.dateExpiration ? formatDate(dpe.dateExpiration) : '—'}</p></div>
                      <div><span className="text-gray-400">Classe GES</span><p className="font-semibold flex items-center gap-1"><ClasseBadge classe={dpe.classeGES} size="sm" />{dpe.classeGES}</p></div>
                      <div><span className="text-gray-400">Lots F/G</span><p className={`font-semibold ${dpe.nbLotsClassesFG > 0 ? 'text-red-600' : ''}`}>{dpe.nbLotsClassesFG}/{dpe.nbLots}</p></div>
                    </div>

                    {dpe.recommandations && (
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">💡 Recommandations</p>
                        <p className="text-xs text-blue-800">{dpe.recommandations}</p>
                      </div>
                    )}

                    {dpe.notes && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600">{dpe.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setSelected(s => s?.id === dpe.id ? null : dpe)}
                    className="flex-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                  >
                    {selected?.id === dpe.id ? '▲ Réduire' : '▼ Détail'}
                  </button>
                  <button
                    onClick={() => openEdit(dpe)}
                    className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                    aria-label="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => { if (confirm('Supprimer ce DPE ?')) save(dpes.filter(d => d.id !== dpe.id)) }}
                    className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors"
                    aria-label="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal création / édition ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">{editing ? '✏️ Modifier le DPE' : '+ Nouveau DPE Collectif'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Fermer">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Immeuble */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Immeuble</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Résidence les Pins"
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
                    <input type="number" min={1} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nbLots || ''} onChange={e => setForm({ ...form, nbLots: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Dont classés F ou G</label>
                    <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nbLotsClassesFG || ''} onChange={e => setForm({ ...form, nbLotsClassesFG: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </section>

              {/* Classes énergétiques */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ Classes énergétiques *</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Classe Énergie</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {CLASSES.map(c => {
                        const cfg = CLASSE_CONFIG[c]
                        return (
                          <button key={c} onClick={() => setForm({ ...form, classeEnergie: c })} className={`w-9 h-9 rounded-lg font-bold text-lg transition-all ${cfg.bg} ${cfg.text} ${form.classeEnergie === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'opacity-40 hover:opacity-80'}`}>{c}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Classe GES (émissions)</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {CLASSES.map(c => {
                        const cfg = CLASSE_CONFIG[c]
                        return (
                          <button key={c} onClick={() => setForm({ ...form, classeGES: c })} className={`w-9 h-9 rounded-lg font-bold text-lg transition-all ${cfg.bg} ${cfg.text} ${form.classeGES === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'opacity-40 hover:opacity-80'}`}>{c}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Consommation (kWh/m²/an)</label>
                    <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.consommationKWh || ''} onChange={e => setForm({ ...form, consommationKWh: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Émissions (kgCO₂/m²/an)</label>
                    <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.emissionsKgCO2 || ''} onChange={e => setForm({ ...form, emissionsKgCO2: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </section>

              {/* Dates */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📅 Dates du diagnostic</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date du diagnostic *</label>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dateDiagnostic || ''} onChange={e => setForm({ ...form, dateDiagnostic: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date d&apos;expiration</label>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dateExpiration || ''} onChange={e => setForm({ ...form, dateExpiration: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nom du diagnostiqueur</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cabinet Diag Pro" value={form.diagnostiqueur || ''} onChange={e => setForm({ ...form, diagnostiqueur: e.target.value })} />
                  </div>
                </div>
              </section>

              {/* Recommandations */}
              <section>
                <label className="text-xs text-gray-500 mb-1 block">Recommandations de travaux</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Isolation toiture, remplacement chaudière, VMC double flux..." value={form.recommandations || ''} onChange={e => setForm({ ...form, recommandations: e.target.value })} />
              </section>

              <section>
                <label className="text-xs text-gray-500 mb-1 block">Notes internes</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Contexte, historique, observations..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </section>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!form.immeubleNom || !form.classeEnergie || !form.dateDiagnostic}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editing ? '💾 Enregistrer' : '✅ Créer le DPE'}
                </button>
                <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
