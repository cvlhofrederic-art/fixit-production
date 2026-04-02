'use client'

import { useState, useMemo, useEffect } from 'react'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface BibliothequeSectionProps {
  artisan: import('@/lib/types').Artisan
  orgRole?: OrgRole
  navigateTo: (page: string) => void
}

interface BiblioItem {
  id: number
  nom: string
  type: 'ouvrage' | 'materiau' | 'mo'
  unite: string
  rev: number
  marge: number
  corps?: string   // corps de métier (pro_societe)
}

// Items par défaut artisan
const INITIAL_ARTISAN: BiblioItem[] = [
  { id: 1,  nom: 'Fuite robinet — diagnostic + réparation', type: 'ouvrage',  unite: 'forfait', rev: 45,   marge: 80 },
  { id: 2,  nom: 'Débouchage canalisation',                 type: 'ouvrage',  unite: 'forfait', rev: 60,   marge: 100 },
  { id: 3,  nom: 'Pose carrelage sol',                      type: 'ouvrage',  unite: 'm²',      rev: 18,   marge: 50 },
  { id: 4,  nom: 'Robinet mitigeur cuisine',                type: 'materiau', unite: 'unité',   rev: 28,   marge: 40 },
  { id: 5,  nom: 'Câble électrique 2.5mm²',                type: 'materiau', unite: 'ml',      rev: 1.2,  marge: 35 },
  { id: 6,  nom: "Main-d'œuvre plombier",                   type: 'mo',       unite: 'heure',   rev: 35,   marge: 50 },
  { id: 7,  nom: "Main-d'œuvre électricien",                type: 'mo',       unite: 'heure',   rev: 38,   marge: 50 },
  { id: 8,  nom: 'Peinture acrylique mat',                  type: 'ouvrage',  unite: 'm²',      rev: 8,    marge: 60 },
  { id: 9,  nom: 'Joint torique 40mm',                      type: 'materiau', unite: 'unité',   rev: 0.80, marge: 200 },
  { id: 10, nom: 'Tableau électrique NF C15-100',           type: 'ouvrage',  unite: 'forfait', rev: 320,  marge: 60 },
]

// Items par défaut pro_societe — BTP
const INITIAL_SOCIETE: BiblioItem[] = [
  { id: 1,  nom: 'Terrassement — déblai/remblai',          type: 'ouvrage',  unite: 'm³',      rev: 22,   marge: 45,  corps: 'VRD / Gros œuvre' },
  { id: 2,  nom: 'Béton de fondation C25/30',              type: 'materiau', unite: 'm³',      rev: 145,  marge: 30,  corps: 'Gros œuvre' },
  { id: 3,  nom: 'Maçonnerie parpaing 20cm',               type: 'ouvrage',  unite: 'm²',      rev: 38,   marge: 50,  corps: 'Gros œuvre' },
  { id: 4,  nom: "Armatures acier HA ø12",                 type: 'materiau', unite: 'kg',      rev: 1.1,  marge: 35,  corps: 'Gros œuvre' },
  { id: 5,  nom: 'Enduit de façade projeté',               type: 'ouvrage',  unite: 'm²',      rev: 24,   marge: 55,  corps: 'Second œuvre' },
  { id: 6,  nom: 'Doublage laine de verre 100mm',          type: 'ouvrage',  unite: 'm²',      rev: 18,   marge: 50,  corps: 'Second œuvre' },
  { id: 7,  nom: 'Carrelage grès cérame 60×60',            type: 'materiau', unite: 'm²',      rev: 28,   marge: 40,  corps: 'Second œuvre' },
  { id: 8,  nom: 'Charpente bois — pose',                  type: 'ouvrage',  unite: 'm²',      rev: 55,   marge: 50,  corps: 'Charpente / Couverture' },
  { id: 9,  nom: 'Tuile canal terre cuite',                type: 'materiau', unite: 'unité',   rev: 1.8,  marge: 35,  corps: 'Charpente / Couverture' },
  { id: 10, nom: "Main-d'œuvre chef d'équipe",             type: 'mo',       unite: 'heure',   rev: 42,   marge: 60,  corps: 'Équipe' },
  { id: 11, nom: "Main-d'œuvre compagnon",                 type: 'mo',       unite: 'heure',   rev: 32,   marge: 55,  corps: 'Équipe' },
  { id: 12, nom: 'Sous-traitant plomberie — forfait',      type: 'mo',       unite: 'forfait', rev: 3200, marge: 25,  corps: 'Sous-traitance' },
  { id: 13, nom: 'Location nacelle 12m',                   type: 'ouvrage',  unite: 'jour',    rev: 280,  marge: 30,  corps: 'Matériel' },
  { id: 14, nom: 'Ciment Portland CEM II 25kg',            type: 'materiau', unite: 'sac',     rev: 6.5,  marge: 40,  corps: 'Gros œuvre' },
]

const TYPE_LABELS: Record<string, string> = { ouvrage: 'Ouvrage', materiau: 'Matériau', mo: "Main-d'œuvre" }
const UNITE_OPTIONS = ['forfait', 'm²', 'm³', 'ml', 'unité', 'heure', 'jour', 'lot', 'kg', 'sac', 't']
const CORPS_OPTIONS = ['VRD / Gros œuvre', 'Gros œuvre', 'Second œuvre', 'Charpente / Couverture', 'Équipe', 'Sous-traitance', 'Matériel', 'Autre']

function prixClient(rev: number, marge: number) {
  return rev * (1 + marge / 100)
}

function typeTag(type: string) {
  const styles: Record<string, string> = {
    ouvrage: 'bg-amber-100 text-amber-800 border-amber-300',
    materiau: 'bg-gray-100 text-gray-700 border-gray-300',
    mo: 'bg-green-100 text-green-800 border-green-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[type] || ''}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

const EMPTY_FORM = (isSociete: boolean): Omit<BiblioItem, 'id'> => ({
  nom: '', type: 'ouvrage', unite: 'forfait', rev: 0, marge: 50,
  corps: isSociete ? 'Gros œuvre' : undefined,
})

export default function BibliothequeSection({ artisan, orgRole = 'artisan', navigateTo }: BibliothequeSectionProps) {
  const isSociete = orgRole === 'pro_societe'
  const storageKey = `fixit_bibliotheque_${artisan?.id || 'guest'}`

  const [items, setItems] = useState<BiblioItem[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [corpsFilter, setCorpsFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Omit<BiblioItem, 'id'>>(EMPTY_FORM(isSociete))

  // Charger depuis localStorage (ou items par défaut)
  useEffect(() => {
    if (!artisan?.id) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setItems(JSON.parse(saved))
      } else {
        const defaults = isSociete ? INITIAL_SOCIETE : INITIAL_ARTISAN
        setItems(defaults)
        localStorage.setItem(storageKey, JSON.stringify(defaults))
      }
    } catch {
      setItems(isSociete ? INITIAL_SOCIETE : INITIAL_ARTISAN)
    }
  }, [artisan?.id, isSociete, storageKey])

  // Persister à chaque changement
  function persist(newItems: BiblioItem[]) {
    setItems(newItems)
    if (artisan?.id) {
      localStorage.setItem(storageKey, JSON.stringify(newItems))
    }
  }

  const TABS = [
    { key: 'all',      label: 'Tous' },
    { key: 'ouvrage',  label: 'Ouvrages' },
    { key: 'materiau', label: 'Matériaux' },
    { key: 'mo',       label: "Main-d'œuvre" },
  ]

  const allCorps = useMemo(() => {
    const set = new Set(items.map(i => i.corps).filter(Boolean) as string[])
    return ['all', ...Array.from(set)]
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (tab !== 'all') list = list.filter(i => i.type === tab)
    if (isSociete && corpsFilter !== 'all') list = list.filter(i => i.corps === corpsFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i => i.nom.toLowerCase().includes(q) || i.corps?.toLowerCase().includes(q))
    }
    return list
  }, [items, tab, search, corpsFilter, isSociete])

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM(isSociete))
    setModal(true)
  }

  function openEdit(item: BiblioItem) {
    setEditId(item.id)
    setForm({ nom: item.nom, type: item.type, unite: item.unite, rev: item.rev, marge: item.marge, corps: item.corps })
    setModal(true)
  }

  function handleSave() {
    if (!form.nom.trim()) return
    if (editId !== null) {
      persist(items.map(i => i.id === editId ? { ...i, ...form } : i))
    } else {
      const nextId = Math.max(0, ...items.map(i => i.id)) + 1
      persist([...items, { id: nextId, ...form }])
    }
    setModal(false)
  }

  function handleDelete(id: number) {
    persist(items.filter(i => i.id !== id))
  }

  function fmt(n: number) {
    return n.toFixed(2).replace('.', ',') + ' €'
  }

  const totalRevient = filtered.reduce((s, i) => s + i.rev, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--v22-text)' }}>
            {isSociete ? "Bibliothèque d'entreprise" : 'Bibliothèque'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>
            {isSociete
              ? `${items.length} poste${items.length > 1 ? 's' : ''} — ouvrages, matériaux, MO, sous-traitants`
              : 'Vos ouvrages, matériaux et main-d\'œuvre'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm rounded border outline-none focus:ring-1"
            style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
          />
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm font-medium text-black rounded whitespace-nowrap"
            style={{ background: 'var(--v22-yellow, #facc15)', borderRadius: 4 }}
          >
            {isSociete ? '+ Nouveau poste' : '+ Nouvel ouvrage'}
          </button>
        </div>
      </div>

      {/* Tabs type */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--v22-border)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 text-sm transition-colors"
            style={{
              color: tab === t.key ? 'var(--v22-text)' : 'var(--v22-text-secondary, #6b7280)',
              borderBottom: tab === t.key ? '2px solid var(--v22-yellow, #facc15)' : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtre corps de métier (pro_societe uniquement) */}
      {isSociete && allCorps.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {allCorps.map(c => (
            <button
              key={c}
              onClick={() => setCorpsFilter(c)}
              className="px-2.5 py-1 text-xs rounded-full border transition-colors"
              style={{
                borderColor: corpsFilter === c ? 'var(--v22-yellow)' : 'var(--v22-border)',
                backgroundColor: corpsFilter === c ? 'var(--v22-yellow)' : 'transparent',
                color: corpsFilter === c ? '#000' : 'var(--v22-text-muted)',
                fontWeight: corpsFilter === c ? 600 : 400,
              }}
            >
              {c === 'all' ? 'Tous les corps' : c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded" style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: 'var(--v22-bg-secondary, #f9fafb)' }}>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Désignation</th>
              {isSociete && <th className="px-3 py-2 font-medium" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Corps</th>}
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Catégorie</th>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Unité</th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>
                {isSociete ? 'Coût HT' : 'Revient HT'}
              </th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Marge %</th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>
                {isSociete ? 'Prix vente HT' : 'Client HT'}
              </th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isSociete ? 8 : 7} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>
                  Aucun élément trouvé.
                </td>
              </tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50/50" style={{ borderColor: 'var(--v22-border)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--v22-text)' }}>{item.nom}</td>
                {isSociete && (
                  <td className="px-3 py-2">
                    {item.corps && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                        {item.corps}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2">{typeTag(item.type)}</td>
                <td className="px-3 py-2" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>{item.unite}</td>
                <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: 'var(--v22-text)' }}>{fmt(item.rev)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: 'var(--v22-text)' }}>{item.marge}%</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold" style={{ color: 'var(--v22-text)' }}>{fmt(prixClient(item.rev, item.marge))}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(item)} className="text-xs mr-2 hover:underline" style={{ color: 'var(--v22-yellow, #ca8a04)' }}>Éditer</button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:underline">Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: 'var(--v22-text-secondary, #6b7280)' }}>
        {filtered.length} élément{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
        {filtered.length > 0 && ` — coût total : ${fmt(totalRevient)}`}
      </p>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(false)}>
          <div
            className="bg-white w-full max-w-md mx-4 p-5 space-y-4 shadow-lg"
            style={{ borderRadius: 4, color: 'var(--v22-text)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              {editId ? 'Modifier le poste' : isSociete ? 'Nouveau poste' : 'Nouvel ouvrage'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Désignation</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:ring-1"
                  style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                />
              </div>

              {isSociete && (
                <div>
                  <label className="block text-xs font-medium mb-1">Corps de métier</label>
                  <select
                    value={form.corps || ''}
                    onChange={e => setForm(f => ({ ...f, corps: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border rounded outline-none"
                    style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                  >
                    {CORPS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as BiblioItem['type'] }))}
                    className="w-full px-3 py-1.5 text-sm border rounded outline-none"
                    style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                  >
                    <option value="ouvrage">Ouvrage</option>
                    <option value="materiau">Matériau</option>
                    <option value="mo">Main-d&apos;œuvre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Unité</label>
                  <select
                    value={form.unite}
                    onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border rounded outline-none"
                    style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                  >
                    {UNITE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {isSociete ? 'Coût HT (€)' : 'Prix de revient HT (€)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rev || ''}
                    onChange={e => setForm(f => ({ ...f, rev: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-sm border rounded outline-none font-mono"
                    style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Marge (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.marge || ''}
                    onChange={e => setForm(f => ({ ...f, marge: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 text-sm border rounded outline-none font-mono"
                    style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'var(--v22-bg-secondary, #f9fafb)', borderRadius: 4 }}>
                <span className="text-sm font-medium">{isSociete ? 'Prix de vente HT' : 'Prix client HT'}</span>
                <span className="font-mono font-semibold">{fmt(prixClient(form.rev, form.marge))}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModal(false)}
                className="px-3 py-1.5 text-sm border rounded"
                style={{ borderColor: 'var(--v22-border)', borderRadius: 4 }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm font-medium text-black rounded"
                style={{ background: 'var(--v22-yellow, #facc15)', borderRadius: 4 }}
              >
                {editId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
