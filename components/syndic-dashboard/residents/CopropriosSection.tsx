'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type { Immeuble, Coproprio } from '../types'
import { getCoproKey } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { GecondParseResult, GecondFraction } from '@/lib/gecond-parser'
import { parseGecondCSV, gecondToFixit, parseComplemento, splitName } from '@/lib/gecond-parser'

// ── Helper : DB row → Coproprio interface (camelCase) ──
function dbToCoproprio(row: any): Coproprio {
  return {
    id: row.id,
    immeuble: row.immeuble || '',
    batiment: row.batiment || '',
    etage: row.etage ?? 0,
    numeroPorte: row.numero_porte || '',
    nomProprietaire: row.nom_proprietaire || '',
    prenomProprietaire: row.prenom_proprietaire || '',
    emailProprietaire: row.email_proprietaire || '',
    telephoneProprietaire: row.tel_proprietaire || '',
    nomLocataire: row.nom_locataire || undefined,
    prenomLocataire: row.prenom_locataire || undefined,
    emailLocataire: row.email_locataire || undefined,
    telephoneLocataire: row.tel_locataire || undefined,
    estOccupe: row.est_occupe ?? false,
    notes: row.notes || undefined,
  }
}

export default function CopropriosSection({ immeubles, userId }: { immeubles: Immeuble[]; userId?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [coproprios, setCoproprios] = useState<Coproprio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Coproprio | null>(null)
  const [form, setForm] = useState<Partial<Coproprio>>({ immeuble: '', batiment: '', etage: 0, numeroPorte: '', nomProprietaire: '', prenomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', estOccupe: false })
  const migratedRef = useRef(false)

  // ── Import Gecond states ──
  const [showImportModal, setShowImportModal] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [importCsvContent, setImportCsvContent] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importParseResult, setImportParseResult] = useState<GecondParseResult | null>(null)
  const [importImmeuble, setImportImmeuble] = useState('')
  const [importNewImmeuble, setImportNewImmeuble] = useState('')
  const [importCreateImmeuble, setImportCreateImmeuble] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; duplicates: number; errors?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Récupérer le token d'auth ──
  const getToken = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }, [])

  // ── Charger les copropriétaires depuis l'API ──
  const fetchCoproprios = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch('/api/syndic/coproprios', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      const mapped = (data.coproprios || []).map(dbToCoproprio)
      setCoproprios(mapped)
      return mapped
    } catch (e) {
      console.error('[CopropriosSection] fetch error:', e)
      return []
    } finally {
      setLoading(false)
    }
  }, [getToken])

  // ── Migration automatique localStorage → Supabase (une seule fois) ──
  const migrateFromLocalStorage = useCallback(async (existingFromDb: Coproprio[]) => {
    if (migratedRef.current) return
    migratedRef.current = true

    const storageKey = userId ? `fixit_copros_${userId}` : getCoproKey()
    const migrationFlag = `fixit_copros_migrated_${userId || 'local'}`

    // Déjà migré ?
    if (typeof window === 'undefined') return
    if (localStorage.getItem(migrationFlag)) return

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) { localStorage.setItem(migrationFlag, '1'); return }

      const parsed: Coproprio[] = JSON.parse(raw)
      // Filtrer les fausses données demo
      const FAKE_IDS = ['1', '2', '3', '4', '5', '6']
      const real = parsed.filter(c => !FAKE_IDS.includes(String(c.id)))

      if (real.length === 0) { localStorage.setItem(migrationFlag, '1'); return }

      // Si la DB a déjà des données, ne pas importer les doublons
      if (existingFromDb.length > 0) {
        localStorage.setItem(migrationFlag, '1')
        localStorage.removeItem(storageKey)
        return
      }

      // Importer en batch vers Supabase
      const token = await getToken()
      const res = await fetch('/api/syndic/coproprios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coproprios: real }),
      })

      if (res.ok) {
        localStorage.setItem(migrationFlag, '1')
        localStorage.removeItem(storageKey)
        // Recharger depuis la DB
        await fetchCoproprios()
        console.log(`[CopropriosSection] Migrated ${real.length} copropriétaires from localStorage to Supabase`)
      }
    } catch (e) {
      console.warn('[CopropriosSection] Migration failed (will retry):', e)
      migratedRef.current = false // Permettre un retry
    }
  }, [userId, getToken, fetchCoproprios])

  // ── Chargement initial + migration ──
  useEffect(() => {
    (async () => {
      const existing = await fetchCoproprios()
      await migrateFromLocalStorage(existing)
    })()
  }, [fetchCoproprios, migrateFromLocalStorage])

  // ── CRUD Operations ──
  const handleSave = async () => {
    if (!form.nomProprietaire || !form.immeuble || !form.numeroPorte) return
    setSaving(true)
    try {
      const token = await getToken()
      if (editItem) {
        // UPDATE
        const res = await fetch('/api/syndic/coproprios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editItem.id, ...form }),
        })
        if (!res.ok) throw new Error('Update failed')
        const data = await res.json()
        setCoproprios(prev => prev.map(c => c.id === editItem.id ? dbToCoproprio(data.coproprio) : c))
      } else {
        // CREATE
        const res = await fetch('/api/syndic/coproprios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ coproprio: form }),
        })
        if (!res.ok) throw new Error('Create failed')
        const data = await res.json()
        if (data.coproprios?.length) {
          setCoproprios(prev => [...prev, dbToCoproprio(data.coproprios[0])])
        }
      }
      setShowModal(false)
    } catch (e) {
      console.error('[CopropriosSection] save error:', e)
      toast.error(locale === 'pt' ? 'Erro ao guardar' : 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const msg = locale === 'pt'
      ? 'Eliminar este condómino / fração? Esta ação é irreversível.'
      : 'Supprimer ce copropriétaire / lot ? Cette action est irréversible.'
    if (!window.confirm(msg)) return

    try {
      const token = await getToken()
      const res = await fetch(`/api/syndic/coproprios?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      setCoproprios(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error('[CopropriosSection] delete error:', e)
    }
  }

  // ── Filtrage + Groupement ──
  const filtered = coproprios.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || [c.nomProprietaire, c.prenomProprietaire, c.nomLocataire || '', c.prenomLocataire || '', c.emailProprietaire, c.numeroPorte].some(v => v.toLowerCase().includes(q))
    const matchImm = !filterImmeuble || c.immeuble === filterImmeuble
    return matchSearch && matchImm
  })

  const grouped: Record<string, Record<string, Coproprio[]>> = {}
  filtered.forEach(c => {
    if (!grouped[c.immeuble]) grouped[c.immeuble] = {}
    const etageLabel = locale === 'pt' ? (c.etage === 0 ? 'R/C' : `${c.etage}º andar`) : (c.etage === 0 ? 'RDC' : `Étage ${c.etage}`)
    const key = `${c.batiment} — ${etageLabel}`
    if (!grouped[c.immeuble][key]) grouped[c.immeuble][key] = []
    grouped[c.immeuble][key].push(c)
    grouped[c.immeuble][key].sort((a, b) => a.numeroPorte.localeCompare(b.numeroPorte))
  })

  const openAdd = () => { setEditItem(null); setForm({ immeuble: '', batiment: '', etage: 0, numeroPorte: '', nomProprietaire: '', prenomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', estOccupe: false }); setShowModal(true) }
  const openEdit = (c: Coproprio) => { setEditItem(c); setForm({ ...c }); setShowModal(true) }

  const exportCSV = () => {
    const headers = locale === 'pt'
      ? ['Condomínio', 'Bloco', 'Andar', 'Fração', 'Proprietário', 'Email', 'Telefone', 'Inquilino', 'Email Inquilino', 'Tel Inquilino', 'Ocupado']
      : ['Immeuble', 'Bâtiment', 'Étage', 'Porte', 'Propriétaire', 'Email Proprio', 'Tel Proprio', 'Locataire', 'Email Locataire', 'Tel Locataire', 'Occupé']
    const rows: string[][] = [headers]
    coproprios.forEach(c => rows.push([c.immeuble, c.batiment, c.etage === 0 ? (locale === 'pt' ? 'R/C' : 'RDC') : String(c.etage), c.numeroPorte, `${c.prenomProprietaire} ${c.nomProprietaire}`, c.emailProprietaire, c.telephoneProprietaire, c.nomLocataire ? `${c.prenomLocataire} ${c.nomLocataire}` : '', c.emailLocataire || '', c.telephoneLocataire || '', c.estOccupe ? (locale === 'pt' ? 'Sim' : 'Oui') : (locale === 'pt' ? 'Não' : 'Non')]))
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `coproprios_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  // ── Import Gecond handlers ──
  const openImportModal = () => {
    setImportStep('upload')
    setImportCsvContent('')
    setImportFileName('')
    setImportParseResult(null)
    setImportImmeuble('')
    setImportNewImmeuble('')
    setImportCreateImmeuble(false)
    setImportResult(null)
    setShowImportModal(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      let text = ev.target?.result as string
      // Try to detect and handle Windows-1252 encoding issues
      if (text && text.includes('\ufffd')) {
        // Mojibake detected, try reading as Latin-1
        const reader2 = new FileReader()
        reader2.onload = (ev2) => {
          const latin1Text = ev2.target?.result as string
          setImportCsvContent(latin1Text || text)
          parseImportCSV(latin1Text || text)
        }
        reader2.readAsText(file, 'iso-8859-1')
      } else {
        setImportCsvContent(text)
        parseImportCSV(text)
      }
    }
    reader.readAsText(file, 'utf-8')
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const parseImportCSV = (csvText: string) => {
    try {
      const result = parseGecondCSV(csvText)
      setImportParseResult(result)
      setImportStep('preview')

      // Auto-select immeuble if only one exists
      if (immeubles.length === 1) {
        setImportImmeuble(immeubles[0].nom)
      }
    } catch (err: any) {
      toast.error(locale === 'pt' ? `Erro ao analisar o CSV: ${err.message}` : `Erreur d'analyse CSV : ${err.message}`)
    }
  }

  const handleImport = async () => {
    const targetImmeuble = importCreateImmeuble ? importNewImmeuble.trim() : importImmeuble
    if (!targetImmeuble) {
      toast.error(locale === 'pt' ? 'Selecione ou crie um condomínio' : 'Sélectionnez ou créez un immeuble')
      return
    }
    if (!importCsvContent) return

    setImportLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/syndic/import-gecond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'import',
          csvContent: importCsvContent,
          immeubleName: targetImmeuble,
          createImmeuble: importCreateImmeuble,
        }),
      })
      const data = await res.json()
      setImportResult({
        success: data.success ?? false,
        imported: data.imported ?? 0,
        duplicates: data.duplicates ?? 0,
        errors: data.errors,
      })
      setImportStep('result')

      // Refresh copropriétaires list
      if (data.imported > 0) {
        await fetchCoproprios()
      }
    } catch (err: any) {
      setImportResult({ success: false, imported: 0, duplicates: 0, errors: [err.message] })
      setImportStep('result')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Loading state ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={locale === 'pt' ? 'Pesquisar por nome, fração...' : 'Rechercher par nom, porte...'} className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
          </div>
          <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
            <option value="">{locale === 'pt' ? 'Todos os condomínios' : 'Tous les immeubles'}</option>
            {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={openImportModal} className="border-2 border-[#C9A84C] hover:bg-[#C9A84C]/10 text-[#C9A84C] px-3 py-2 rounded-lg text-sm font-semibold transition">📤 Import Gecond</button>
          <button onClick={exportCSV} className="border-2 border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold transition">📥 Export CSV</button>
          <button onClick={openAdd} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">+ {locale === 'pt' ? 'Adicionar' : 'Ajouter'}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#F7F4EE] border-2 border-[#E4DDD0] rounded-xl p-4">
          <div className="text-2xl font-bold text-[#0D1B2E]">{coproprios.length}</div>
          <div className="text-xs text-gray-600">{locale === 'pt' ? 'Frações total' : 'Lots total'}</div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-700">{coproprios.filter(c => c.estOccupe).length}</div>
          <div className="text-xs text-gray-600">{locale === 'pt' ? 'Ocupados' : 'Occupés'}</div>
        </div>
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-700">{coproprios.filter(c => !c.estOccupe).length}</div>
          <div className="text-xs text-gray-600">{locale === 'pt' ? 'Vagos' : 'Vacants'}</div>
        </div>
      </div>

      {/* Tableau arborescent */}
      {Object.entries(grouped).map(([immeuble, batiments]) => (
        <div key={immeuble} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#0D1B2E] px-5 py-3 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">🏢 {immeuble}</h3>
            <span className="text-[#C9A84C] text-xs">{Object.values(batiments).flat().length} {locale === 'pt' ? 'frações' : 'lots'}</span>
          </div>
          {Object.entries(batiments).map(([batEtage, lots]) => (
            <div key={batEtage}>
              <div className="px-5 py-2 bg-[#F7F4EE] border-y border-gray-100 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">📍 {batEtage}</span>
                <span className="text-xs text-gray-500">({lots.length} {locale === 'pt' ? (lots.length > 1 ? 'frações' : 'fração') : (lots.length > 1 ? 'lots' : 'lot')})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {lots.map(c => (
                  <div key={c.id} className="px-5 py-3 hover:bg-[#F7F4EE] transition group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-[#F7F4EE] rounded-lg flex items-center justify-center text-xs font-bold text-[#C9A84C] flex-shrink-0">
                          {c.numeroPorte}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#0D1B2E]">🏠 {c.prenomProprietaire} {c.nomProprietaire}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.estOccupe ? 'bg-green-100 text-green-700' : 'bg-[#F7F4EE] text-gray-500'}`}>
                              {c.estOccupe ? (locale === 'pt' ? 'Ocupado' : 'Occupé') : (locale === 'pt' ? 'Vago' : 'Vacant')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                            {c.emailProprietaire && <span>✉️ {c.emailProprietaire}</span>}
                            {c.telephoneProprietaire && <span>📞 {c.telephoneProprietaire}</span>}
                          </div>
                          {c.nomLocataire && (
                            <div className="mt-1 flex items-center gap-3 text-xs text-[#C9A84C] flex-wrap">
                              <span>🔑 {locale === 'pt' ? 'Inquilino' : 'Locataire'} : {c.prenomLocataire} {c.nomLocataire}</span>
                              {c.emailLocataire && <span>✉️ {c.emailLocataire}</span>}
                              {c.telephoneLocataire && <span>📞 {c.telephoneLocataire}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-500 hover:text-[#C9A84C] hover:bg-[#F7F4EE] rounded-lg transition text-xs">✏️</button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-xs">🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {filtered.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">👥</div>
          <p>{locale === 'pt' ? 'Nenhum condómino encontrado' : 'Aucun copropriétaire trouvé'}</p>
        </div>
      )}

      {/* Modal Ajout/Édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0D1B2E] mb-5">
              {editItem
                ? (locale === 'pt' ? 'Editar condómino' : 'Modifier un copropriétaire')
                : (locale === 'pt' ? 'Adicionar condómino' : 'Ajouter un copropriétaire')}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 {locale === 'pt' ? 'Condomínio' : 'Immeuble'} *</label>
                  <select value={form.immeuble} onChange={e => setForm({ ...form, immeuble: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                    <option value="">{locale === 'pt' ? 'Selecionar...' : 'Sélectionner...'}</option>
                    {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Bloco' : 'Bâtiment'}</label>
                  <input type="text" value={form.batiment || ''} onChange={e => setForm({ ...form, batiment: e.target.value })} placeholder={locale === 'pt' ? 'Bloco A' : 'Bât A'} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Andar (0 = R/C)' : 'Étage (0 = RDC)'}</label>
                  <input type="number" min={0} value={form.etage ?? 0} onChange={e => setForm({ ...form, etage: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Fração' : 'N° de porte'} *</label>
                  <input type="text" value={form.numeroPorte || ''} onChange={e => setForm({ ...form, numeroPorte: e.target.value })} placeholder="12" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div className="col-span-2"><hr className="border-gray-100" /><p className="text-xs font-bold text-gray-500 mt-2">{locale === 'pt' ? 'PROPRIETÁRIO' : 'PROPRIÉTAIRE'}</p></div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Nome' : 'Prénom'} *</label>
                  <input type="text" value={form.prenomProprietaire || ''} onChange={e => setForm({ ...form, prenomProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Apelido' : 'Nom'} *</label>
                  <input type="text" value={form.nomProprietaire || ''} onChange={e => setForm({ ...form, nomProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={form.emailProprietaire || ''} onChange={e => setForm({ ...form, emailProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Telefone' : 'Téléphone'}</label>
                  <input type="tel" value={form.telephoneProprietaire || ''} onChange={e => setForm({ ...form, telephoneProprietaire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div className="col-span-2 flex items-center gap-3 py-1">
                  <label className="text-sm font-medium text-gray-700">{locale === 'pt' ? 'Fração ocupada por inquilino?' : 'Lot occupé par un locataire ?'}</label>
                  <button onClick={() => setForm({ ...form, estOccupe: !form.estOccupe })} className={`w-10 h-5 rounded-full transition-all ${form.estOccupe ? 'bg-[#0D1B2E]' : 'bg-gray-200'}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow transition-all mx-auto" style={{ marginLeft: form.estOccupe ? '22px' : '2px' }} />
                  </button>
                </div>
                {form.estOccupe && (<>
                  <div className="col-span-2"><p className="text-xs font-bold text-gray-500">{locale === 'pt' ? 'INQUILINO' : 'LOCATAIRE'}</p></div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Nome' : 'Prénom'}</label>
                    <input type="text" value={form.prenomLocataire || ''} onChange={e => setForm({ ...form, prenomLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Apelido' : 'Nom'}</label>
                    <input type="text" value={form.nomLocataire || ''} onChange={e => setForm({ ...form, nomLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                    <input type="email" value={form.emailLocataire || ''} onChange={e => setForm({ ...form, emailLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{locale === 'pt' ? 'Telefone' : 'Téléphone'}</label>
                    <input type="tel" value={form.telephoneLocataire || ''} onChange={e => setForm({ ...form, telephoneLocataire: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                  </div>
                </>)}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">
                {locale === 'pt' ? 'Cancelar' : 'Annuler'}
              </button>
              <button onClick={handleSave} disabled={saving || !form.nomProprietaire || !form.immeuble || !form.numeroPorte} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm flex items-center justify-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editItem
                  ? (locale === 'pt' ? 'Guardar' : 'Enregistrer')
                  : (locale === 'pt' ? 'Adicionar' : 'Ajouter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal Import Gecond ══════ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !importLoading && setShowImportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#0D1B2E] flex items-center gap-2">
                📤 {locale === 'pt' ? 'Importar CSV Gecond' : 'Importer CSV Gecond'}
              </h3>
              {!importLoading && (
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
              )}
            </div>

            {/* ── Step indicators ── */}
            <div className="flex items-center gap-2 mb-6">
              {['upload', 'preview', 'result'].map((step, idx) => (
                <React.Fragment key={step}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    importStep === step ? 'bg-[#C9A84C] text-white' :
                    ['upload', 'preview', 'result'].indexOf(importStep) > idx ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {['upload', 'preview', 'result'].indexOf(importStep) > idx ? '✓' : idx + 1}
                  </div>
                  {idx < 2 && <div className="flex-1 h-0.5 bg-gray-200" />}
                </React.Fragment>
              ))}
            </div>

            {/* ══ STEP 1: Upload ══ */}
            {importStep === 'upload' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">{locale === 'pt' ? 'Formatos suportados' : 'Formats supportés'}</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5">
                    <li>{locale === 'pt' ? 'CSV Gecond completo (42 colunas)' : 'CSV Gecond complet (42 colonnes)'}</li>
                    <li>{locale === 'pt' ? 'Exportação simplificada de condóminos' : 'Export simplifié de condominios'}</li>
                    <li>{locale === 'pt' ? 'CSV genérico (delimitador auto-detectado)' : 'CSV générique (délimiteur auto-détecté)'}</li>
                  </ul>
                </div>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-[#C9A84C] transition"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation()
                    const file = e.dataTransfer.files?.[0]
                    if (file) {
                      const fakeEvent = { target: { files: [file] } } as any
                      handleFileSelect(fakeEvent)
                    }
                  }}
                >
                  <div className="text-4xl mb-3">📁</div>
                  <p className="text-sm text-gray-600 mb-1">
                    {locale === 'pt' ? 'Clique ou arraste o ficheiro CSV aqui' : 'Cliquez ou glissez le fichier CSV ici'}
                  </p>
                  <p className="text-xs text-gray-400">.csv, .txt — max 5 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex justify-end">
                  <button onClick={() => setShowImportModal(false)} className="border-2 border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">
                    {locale === 'pt' ? 'Cancelar' : 'Annuler'}
                  </button>
                </div>
              </div>
            )}

            {/* ══ STEP 2: Preview ══ */}
            {importStep === 'preview' && importParseResult && (
              <div className="space-y-4">
                {/* Parse stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#F7F4EE] rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-[#0D1B2E]">{importParseResult.stats.parsedOk}</div>
                    <div className="text-xs text-gray-500">{locale === 'pt' ? 'Frações' : 'Fractions'}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-green-700">{importParseResult.stats.withOwner}</div>
                    <div className="text-xs text-gray-500">{locale === 'pt' ? 'c/ proprietário' : 'avec proprio'}</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-blue-700">{importParseResult.stats.withTenant}</div>
                    <div className="text-xs text-gray-500">{locale === 'pt' ? 'c/ inquilino' : 'avec locataire'}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-amber-700">{importParseResult.stats.skipped}</div>
                    <div className="text-xs text-gray-500">{locale === 'pt' ? 'Ignoradas' : 'Ignorées'}</div>
                  </div>
                </div>

                {/* Format detected */}
                <div className="bg-[#F7F4EE] rounded-xl p-3 text-sm">
                  <span className="font-semibold text-[#0D1B2E]">{locale === 'pt' ? 'Formato detectado:' : 'Format détecté :'} </span>
                  <span className="text-gray-600">
                    {importParseResult.detectedFormat === 'full_42' && (locale === 'pt' ? 'Gecond completo (42 colunas)' : 'Gecond complet (42 colonnes)')}
                    {importParseResult.detectedFormat === 'simplified' && (locale === 'pt' ? 'Gecond simplificado' : 'Gecond simplifié')}
                    {importParseResult.detectedFormat === 'custom' && (locale === 'pt' ? 'CSV personalizado' : 'CSV personnalisé')}
                  </span>
                  <span className="text-gray-400 ml-2">
                    ({locale === 'pt' ? 'delimitador' : 'délimiteur'}: &ldquo;{importParseResult.detectedDelimiter === '\t' ? 'TAB' : importParseResult.detectedDelimiter}&rdquo;)
                  </span>
                </div>

                {/* Errors */}
                {importParseResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">{locale === 'pt' ? 'Erros' : 'Erreurs'}</p>
                    <ul className="text-xs text-red-600 space-y-0.5">
                      {importParseResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{locale === 'pt' ? 'Linha' : 'Ligne'} {e.line}: {e.message}</li>
                      ))}
                      {importParseResult.errors.length > 5 && (
                        <li className="font-semibold">+{importParseResult.errors.length - 5} {locale === 'pt' ? 'mais' : 'de plus'}...</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {importParseResult.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-amber-700 mb-1">{locale === 'pt' ? 'Avisos' : 'Avertissements'} ({importParseResult.warnings.length})</p>
                    <ul className="text-xs text-amber-600 space-y-0.5">
                      {importParseResult.warnings.slice(0, 3).map((w, i) => (
                        <li key={i}>{locale === 'pt' ? 'Linha' : 'Ligne'} {w.line}: {w.message}</li>
                      ))}
                      {importParseResult.warnings.length > 3 && (
                        <li className="font-semibold">+{importParseResult.warnings.length - 3} {locale === 'pt' ? 'mais' : 'de plus'}...</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview table (first 5 rows) */}
                {importParseResult.fractions.length > 0 && (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-[#0D1B2E] text-white">
                          <th className="px-3 py-2 text-left">{locale === 'pt' ? 'Código' : 'Code'}</th>
                          <th className="px-3 py-2 text-left">{locale === 'pt' ? 'Descrição' : 'Description'}</th>
                          <th className="px-3 py-2 text-right">{locale === 'pt' ? 'Permilagem' : 'Tantièmes'}</th>
                          <th className="px-3 py-2 text-left">{locale === 'pt' ? 'Proprietário' : 'Propriétaire'}</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">{locale === 'pt' ? 'Inquilino' : 'Locataire'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importParseResult.fractions.slice(0, 8).map((f, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7F4EE]'}>
                            <td className="px-3 py-2 font-mono font-bold text-[#C9A84C]">{f.codigo || '—'}</td>
                            <td className="px-3 py-2">{f.complemento || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{f.permilagem || 0}</td>
                            <td className="px-3 py-2 font-semibold">{f.nomProprietaire || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{f.emailProprietaire || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{f.nomLocataire || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importParseResult.fractions.length > 8 && (
                      <div className="text-center py-2 text-xs text-gray-400 bg-[#F7F4EE]">
                        +{importParseResult.fractions.length - 8} {locale === 'pt' ? 'frações não mostradas' : 'fractions non affichées'}...
                      </div>
                    )}
                  </div>
                )}

                {/* Immeuble selection */}
                <div className="bg-white border-2 border-[#C9A84C]/30 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-[#0D1B2E]">
                    🏢 {locale === 'pt' ? 'Associar a qual condomínio?' : 'Associer à quel immeuble ?'}
                  </p>

                  {!importCreateImmeuble ? (
                    <>
                      <select
                        value={importImmeuble}
                        onChange={e => setImportImmeuble(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm"
                      >
                        <option value="">{locale === 'pt' ? 'Selecionar condomínio existente...' : 'Sélectionner un immeuble existant...'}</option>
                        {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                      </select>
                      <button
                        onClick={() => setImportCreateImmeuble(true)}
                        className="text-xs text-[#C9A84C] hover:underline font-semibold"
                      >
                        + {locale === 'pt' ? 'Criar novo condomínio' : 'Créer un nouvel immeuble'}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={importNewImmeuble}
                        onChange={e => setImportNewImmeuble(e.target.value)}
                        placeholder={locale === 'pt' ? 'Nome do novo condomínio...' : 'Nom du nouvel immeuble...'}
                        className="w-full px-3 py-2 border-2 border-[#C9A84C] rounded-lg focus:outline-none text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => { setImportCreateImmeuble(false); setImportNewImmeuble('') }}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        {locale === 'pt' ? 'Usar condomínio existente' : 'Utiliser un immeuble existant'}
                      </button>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setImportStep('upload'); setImportParseResult(null) }}
                    className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm"
                  >
                    {locale === 'pt' ? 'Voltar' : 'Retour'}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importLoading || (!importImmeuble && !importNewImmeuble.trim()) || importParseResult.fractions.length === 0}
                    className="flex-1 bg-[#C9A84C] hover:bg-[#B8973F] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                  >
                    {importLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {importLoading
                      ? (locale === 'pt' ? 'A importar...' : 'Import en cours...')
                      : `📤 ${locale === 'pt' ? 'Importar' : 'Importer'} ${importParseResult.fractions.length} ${locale === 'pt' ? 'frações' : 'fractions'}`
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ══ STEP 3: Result ══ */}
            {importStep === 'result' && importResult && (
              <div className="space-y-4">
                {importResult.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="text-lg font-bold text-green-800 mb-2">
                      {locale === 'pt' ? 'Importação concluída!' : 'Import terminé !'}
                    </p>
                    <p className="text-sm text-green-700">
                      {importResult.imported} {locale === 'pt' ? 'frações importadas' : 'fractions importées'}
                      {importResult.duplicates > 0 && (
                        <span className="text-amber-600 ml-1">
                          ({importResult.duplicates} {locale === 'pt' ? 'duplicados ignorados' : 'doublons ignorés'})
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <div className="text-5xl mb-3">❌</div>
                    <p className="text-lg font-bold text-red-800 mb-2">
                      {locale === 'pt' ? 'Erro na importação' : 'Erreur d\'import'}
                    </p>
                    {importResult.errors?.map((err, i) => (
                      <p key={i} className="text-sm text-red-600">{err}</p>
                    ))}
                    {importResult.imported > 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        {importResult.imported} {locale === 'pt' ? 'frações importadas antes do erro' : 'fractions importées avant l\'erreur'}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-6 py-2.5 rounded-lg font-bold transition text-sm"
                  >
                    {locale === 'pt' ? 'Fechar' : 'Fermer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
