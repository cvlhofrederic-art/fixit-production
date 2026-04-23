'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from './useThemeVars'

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

const UNITE_OPTIONS = ['forfait', 'm²', 'm³', 'ml', 'unité', 'heure', 'jour', 'lot', 'kg', 'sac', 't']

function prixClient(rev: number, marge: number) {
  return rev * (1 + marge / 100)
}

function typeTag(type: string, typeLabels: Record<string, string>) {
  const styles: Record<string, string> = {
    ouvrage: 'bg-amber-100 text-amber-800 border-amber-300',
    materiau: 'bg-gray-100 text-gray-700 border-gray-300',
    mo: 'bg-green-100 text-green-800 border-green-300',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[type] || ''}`}>
      {typeLabels[type]}
    </span>
  )
}

const EMPTY_FORM = (isSociete: boolean, defaultCorps?: string): Omit<BiblioItem, 'id'> => ({
  nom: '', type: 'ouvrage', unite: 'forfait', rev: 0, marge: 50,
  corps: isSociete ? (defaultCorps || 'Gros œuvre') : undefined,
})

export default function BibliothequeSection({ artisan, orgRole = 'artisan', navigateTo }: BibliothequeSectionProps) {
  const { t } = useTranslation()
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const storageKey = `fixit_bibliotheque_${artisan?.id || 'guest'}`

  const TYPE_LABELS: Record<string, string> = {
    ouvrage: t('proDash.bibliotheque.typeOuvrage'),
    materiau: t('proDash.bibliotheque.typeMateriau'),
    mo: t('proDash.bibliotheque.typeMo'),
  }
  const CORPS_OPTIONS = [
    t('proDash.bibliotheque.corpsVrd'),
    t('proDash.bibliotheque.corpsGrosOeuvre'),
    t('proDash.bibliotheque.corpsSecondOeuvre'),
    t('proDash.bibliotheque.corpsCharpente'),
    t('proDash.bibliotheque.corpsEquipe'),
    t('proDash.bibliotheque.corpsSousTraitance'),
    t('proDash.bibliotheque.corpsMateriel'),
    t('proDash.bibliotheque.corpsAutre'),
  ]

  const [items, setItems] = useState<BiblioItem[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [corpsFilter, setCorpsFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Omit<BiblioItem, 'id'>>(EMPTY_FORM(isSociete, CORPS_OPTIONS[1]))

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
        try { localStorage.setItem(storageKey, JSON.stringify(defaults)) } catch (e) { console.warn('[storage] biblio init', e) }
      }
    } catch {
      setItems(isSociete ? INITIAL_SOCIETE : INITIAL_ARTISAN)
    }
  }, [artisan?.id, isSociete, storageKey])

  // Persister à chaque changement
  function persist(newItems: BiblioItem[]) {
    setItems(newItems)
    if (artisan?.id) {
      try { localStorage.setItem(storageKey, JSON.stringify(newItems)) } catch (e) { console.warn('[storage] biblio persist', e) }
    }
  }

  const TABS = [
    { key: 'all',      label: t('proDash.bibliotheque.tabTous') },
    { key: 'ouvrage',  label: t('proDash.bibliotheque.tabOuvrages') },
    { key: 'materiau', label: t('proDash.bibliotheque.tabMateriaux') },
    { key: 'mo',       label: t('proDash.bibliotheque.tabMo') },
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
    setForm(EMPTY_FORM(isSociete, CORPS_OPTIONS[1]))
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

  /* ═══════════════════════════════════════════
     V5 layout — pro_societe only
     ═══════════════════════════════════════════ */
  if (isV5) {
    return (
      <div className="v5-fade">
        <div className="v5-pg-t">
          <h1>{t('proDash.bibliotheque.title')}</h1>
          <p>{t('proDash.bibliotheque.subtitleBdd')} &mdash; {items.length} {t('proDash.bibliotheque.poste')}{items.length > 1 ? 's' : ''}</p>
        </div>

        {/* Search + new */}
        <div className="v5-search">
          <input
            className="v5-search-in"
            placeholder={t('proDash.bibliotheque.rechercher')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="v5-btn v5-btn-p" onClick={openCreate}>+ {t('proDash.bibliotheque.nouveauPoste')}</button>
        </div>

        {/* Tabs type */}
        <div className="v5-tabs" style={{ marginBottom: '0.5rem' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`v5-tab-b${tab === t.key ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtre corps de metier */}
        {allCorps.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {allCorps.map(c => (
              <button
                key={c}
                onClick={() => setCorpsFilter(c)}
                className={`v5-btn v5-btn-sm${corpsFilter === c ? ' v5-btn-p' : ''}`}
              >
                {c === 'all' ? t('proDash.bibliotheque.tousLesCorps') : c}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="v5-card" style={{ overflowX: 'auto' }}>
          <table className="v5-dt">
            <thead>
              <tr>
                <th>{t('proDash.bibliotheque.colOuvrage')}</th>
                <th>{t('proDash.bibliotheque.colCorps')}</th>
                <th>{t('proDash.bibliotheque.colCategorie')}</th>
                <th>{t('proDash.bibliotheque.colUnite')}</th>
                <th style={{ textAlign: 'right' }}>{t('proDash.bibliotheque.colCoutHT')}</th>
                <th style={{ textAlign: 'right' }}>{t('proDash.bibliotheque.colMarge')}</th>
                <th style={{ textAlign: 'right' }}>{t('proDash.bibliotheque.colPrixVenteHT')}</th>
                <th style={{ textAlign: 'right' }}>{t('proDash.bibliotheque.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#999' }}>
                    {t('proDash.bibliotheque.aucunElement')}
                  </td>
                </tr>
              )}
              {filtered.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.nom}</td>
                  <td>
                    {item.corps && (
                      <span className="v5-badge v5-badge-blue">{item.corps}</span>
                    )}
                  </td>
                  <td>
                    <span className={`v5-badge ${item.type === 'ouvrage' ? 'v5-badge-yellow' : item.type === 'materiau' ? 'v5-badge-gray' : 'v5-badge-green'}`}>
                      {TYPE_LABELS[item.type]}
                    </span>
                  </td>
                  <td>{item.unite}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmt(item.rev)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{item.marge}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{fmt(prixClient(item.rev, item.marge))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEdit(item)} className="v5-btn v5-btn-sm" style={{ marginRight: 4 }}>{t('proDash.bibliotheque.editer')}</button>
                    <button onClick={() => handleDelete(item.id)} className="v5-btn v5-btn-sm v5-btn-d">{t('proDash.bibliotheque.supprimer')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
          {filtered.length} {t('proDash.bibliotheque.elementsAffiches')}
          {filtered.length > 0 && ` — ${t('proDash.bibliotheque.coutTotal')} : ${fmt(totalRevient)}`}
        </div>

        {/* Modal */}
        {modal && (
          <div className="v22-modal-overlay" onClick={() => setModal(false)}>
            <div className="v22-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="v22-modal-head">
                <h3 className="v22-modal-title">{editId ? t('proDash.bibliotheque.modifierPoste') : t('proDash.bibliotheque.nouveauPoste')}</h3>
              </div>
              <div className="v22-modal-body">
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.designation')}</label>
                  <input type="text" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="v22-form-input" />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.corpsDeMetier')}</label>
                  <select value={form.corps || ''} onChange={e => setForm(f => ({ ...f, corps: e.target.value }))} className="v22-form-input">
                    {CORPS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('proDash.bibliotheque.type')}</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as BiblioItem['type'] }))} className="v22-form-input">
                      <option value="ouvrage">{TYPE_LABELS.ouvrage}</option>
                      <option value="materiau">{TYPE_LABELS.materiau}</option>
                      <option value="mo">{TYPE_LABELS.mo}</option>
                    </select>
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('proDash.bibliotheque.unite')}</label>
                    <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} className="v22-form-input">
                      {UNITE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('proDash.bibliotheque.coutHTEuro')}</label>
                    <input type="number" step="0.01" min="0" value={form.rev || ''} onChange={e => setForm(f => ({ ...f, rev: parseFloat(e.target.value) || 0 }))} className="v22-form-input" />
                  </div>
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('proDash.bibliotheque.margePct')}</label>
                    <input type="number" step="1" min="0" value={form.marge || ''} onChange={e => setForm(f => ({ ...f, marge: parseFloat(e.target.value) || 0 }))} className="v22-form-input" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#FAFAFA', borderRadius: 4, border: '1px solid #E8E8E8' }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{t('proDash.bibliotheque.prixVenteHT')}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(prixClient(form.rev, form.marge))}</span>
                </div>
              </div>
              <div className="v22-modal-foot">
                <button onClick={() => setModal(false)} className="v22-btn">{t('proDash.bibliotheque.annuler')}</button>
                <button onClick={handleSave} className="v22-btn v22-btn-primary">{editId ? t('proDash.bibliotheque.enregistrer') : t('proDash.bibliotheque.creer')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════════════
     V22 layout — artisan and other roles
     ═══════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: tv.text }}>
            {isSociete ? t('proDash.bibliotheque.titleEntreprise') : t('proDash.bibliotheque.titleSimple')}
          </h2>
          <p className="text-sm" style={{ color: tv.textSecondary }}>
            {isSociete
              ? `${items.length} ${t('proDash.bibliotheque.poste')}${items.length > 1 ? 's' : ''} — ${t('proDash.bibliotheque.subtitleSociete')}`
              : t('proDash.bibliotheque.subtitleArtisan')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder={t('proDash.bibliotheque.rechercher')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm rounded border outline-none focus:ring-1"
            style={{ borderColor: tv.border, borderRadius: 4 }}
          />
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm font-medium text-black rounded whitespace-nowrap"
            style={{ background: tv.primary, borderRadius: 4 }}
          >
            {isSociete ? `+ ${t('proDash.bibliotheque.nouveauPoste')}` : `+ ${t('proDash.bibliotheque.nouvelOuvrage')}`}
          </button>
        </div>
      </div>

      {/* Tabs type */}
      <div className="flex gap-1 border-b" style={{ borderColor: tv.border }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 text-sm transition-colors"
            style={{
              color: tab === t.key ? tv.text : tv.textSecondary,
              borderBottom: tab === t.key ? `2px solid ${tv.primary}` : '2px solid transparent',
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
                borderColor: corpsFilter === c ? tv.primary : tv.border,
                backgroundColor: corpsFilter === c ? tv.primary : 'transparent',
                color: corpsFilter === c ? '#000' : tv.textMuted,
                fontWeight: corpsFilter === c ? 600 : 400,
              }}
            >
              {c === 'all' ? t('proDash.bibliotheque.tousLesCorps') : c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded" style={{ borderColor: tv.border, borderRadius: 4 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: tv.bg }}>
              <th className="px-3 py-2 font-medium" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.designation')}</th>
              {isSociete && <th className="px-3 py-2 font-medium" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.colCorps')}</th>}
              <th className="px-3 py-2 font-medium" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.colCategorie')}</th>
              <th className="px-3 py-2 font-medium" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.colUnite')}</th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: tv.textSecondary }}>
                {isSociete ? t('proDash.bibliotheque.colCoutHT') : t('proDash.bibliotheque.colRevientHT')}
              </th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.colMarge')}</th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: tv.textSecondary }}>
                {isSociete ? t('proDash.bibliotheque.colPrixVenteHT') : t('proDash.bibliotheque.colClientHT')}
              </th>
              <th className="px-3 py-2 font-medium text-right" style={{ color: tv.textSecondary }}>{t('proDash.bibliotheque.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isSociete ? 8 : 7} className="px-3 py-6 text-center text-sm" style={{ color: tv.textSecondary }}>
                  {t('proDash.bibliotheque.aucunElement')}
                </td>
              </tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="border-t hover:bg-gray-50/50" style={{ borderColor: tv.border }}>
                <td className="px-3 py-2" style={{ color: tv.text }}>{item.nom}</td>
                {isSociete && (
                  <td className="px-3 py-2">
                    {item.corps && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                        {item.corps}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2">{typeTag(item.type, TYPE_LABELS)}</td>
                <td className="px-3 py-2" style={{ color: tv.textSecondary }}>{item.unite}</td>
                <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: tv.text }}>{fmt(item.rev)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: tv.text }}>{item.marge}%</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-semibold" style={{ color: tv.text }}>{fmt(prixClient(item.rev, item.marge))}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(item)} className="text-xs mr-2 hover:underline" style={{ color: tv.primary }}>{t('proDash.bibliotheque.editer')}</button>
                  <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:underline">{t('proDash.bibliotheque.supprimer')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: tv.textSecondary }}>
        {filtered.length} {t('proDash.bibliotheque.elementsAffiches')}
        {filtered.length > 0 && ` — ${t('proDash.bibliotheque.coutTotal')} : ${fmt(totalRevient)}`}
      </p>

      {/* Modal */}
      {modal && (
        <div className="v22-modal-overlay" onClick={() => setModal(false)}>
          <div className="v22-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="v22-modal-head">
              <h3 className="v22-modal-title">
                {editId ? t('proDash.bibliotheque.modifierPoste') : isSociete ? t('proDash.bibliotheque.nouveauPoste') : t('proDash.bibliotheque.nouvelOuvrage')}
              </h3>
            </div>
            <div className="v22-modal-body">
              <div className="v22-form-group">
                <label className="v22-form-label">{t('proDash.bibliotheque.designation')}</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="v22-form-input"
                />
              </div>

              {isSociete && (
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.corpsDeMetier')}</label>
                  <select
                    value={form.corps || ''}
                    onChange={e => setForm(f => ({ ...f, corps: e.target.value }))}
                    className="v22-form-input"
                  >
                    {CORPS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.type')}</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as BiblioItem['type'] }))}
                    className="v22-form-input"
                  >
                    <option value="ouvrage">{TYPE_LABELS.ouvrage}</option>
                    <option value="materiau">{TYPE_LABELS.materiau}</option>
                    <option value="mo">{TYPE_LABELS.mo}</option>
                  </select>
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.unite')}</label>
                  <select
                    value={form.unite}
                    onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                    className="v22-form-input"
                  >
                    {UNITE_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">
                    {isSociete ? t('proDash.bibliotheque.coutHTEuro') : t('proDash.bibliotheque.prixRevientHTEuro')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.rev || ''}
                    onChange={e => setForm(f => ({ ...f, rev: parseFloat(e.target.value) || 0 }))}
                    className="v22-form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('proDash.bibliotheque.margePct')}</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.marge || ''}
                    onChange={e => setForm(f => ({ ...f, marge: parseFloat(e.target.value) || 0 }))}
                    className="v22-form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#FAFAFA', borderRadius: 4, border: '1px solid #E8E8E8' }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{isSociete ? t('proDash.bibliotheque.prixVenteHT') : t('proDash.bibliotheque.prixClientHT')}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(prixClient(form.rev, form.marge))}</span>
              </div>
            </div>
            <div className="v22-modal-foot">
              <button onClick={() => setModal(false)} className="v22-btn">{t('proDash.bibliotheque.annuler')}</button>
              <button onClick={handleSave} className="v22-btn v22-btn-primary">
                {editId ? t('proDash.bibliotheque.enregistrer') : t('proDash.bibliotheque.creer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
