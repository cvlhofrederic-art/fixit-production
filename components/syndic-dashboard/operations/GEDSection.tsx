'use client'

import { useState, useEffect, useRef } from 'react'
import type { Immeuble, Artisan, GEDDocument, TypeDocument } from '../types'
import { TYPE_DOC_CONFIG } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function GEDSection({ immeubles, artisans, userId }: { immeubles: Immeuble[]; artisans: Artisan[]; userId?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const gedKey = userId ? `fixit_ged_${userId}` : 'fixit_ged_local'
  const FAKE_GED_IDS = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15']
  const [docs, setDocs] = useState<GEDDocument[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(gedKey)
      if (!raw) return []
      const parsed: GEDDocument[] = JSON.parse(raw)
      // Purge des faux documents demo (IDs courts numériques '1'-'15')
      const hasFake = parsed.some(d => FAKE_GED_IDS.includes(String(d.id)))
      if (hasFake) { localStorage.removeItem(gedKey); return [] }
      return parsed
    } catch { return [] }
  })

  // Persister docs dans localStorage à chaque changement
  useEffect(() => {
    try { localStorage.setItem(gedKey, JSON.stringify(docs)) } catch {}
  }, [docs, gedKey])
  const [search, setSearch] = useState('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterArtisan, setFilterArtisan] = useState('')
  const [filterLocataire, setFilterLocataire] = useState('')
  const [filterType, setFilterType] = useState<TypeDocument | ''>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<GEDDocument | null>(null)
  const [uploadForm, setUploadForm] = useState({ nom: '', type: 'rapport' as TypeDocument, immeuble: '', artisan: '', locataire: '', tags: '' })
  const [gedUploadFile, setGedUploadFile] = useState<File | null>(null)
  const [gedUploading, setGedUploading] = useState(false)
  const gedFileRef = useRef<HTMLInputElement>(null)

  const stats = {
    total: docs.length,
    rapports: docs.filter(d => d.type === 'rapport').length,
    factures: docs.filter(d => d.type === 'facture').length,
    devis: docs.filter(d => d.type === 'devis').length,
  }

  const filtered = docs.filter(doc => {
    const q = search.toLowerCase()
    const matchSearch = !search || [doc.nom, doc.artisan, doc.locataire, doc.immeuble, ...doc.tags].some(v => v.toLowerCase().includes(q))
    const matchImmeuble = !filterImmeuble || doc.immeuble === filterImmeuble
    const matchArtisan = !filterArtisan || doc.artisan === filterArtisan
    const matchLocataire = !filterLocataire || doc.locataire.toLowerCase().includes(filterLocataire.toLowerCase())
    const matchType = !filterType || doc.type === filterType
    return matchSearch && matchImmeuble && matchArtisan && matchLocataire && matchType
  })

  const clearFilters = () => { setSearch(''); setFilterImmeuble(''); setFilterArtisan(''); setFilterLocataire(''); setFilterType('') }
  const hasFilters = search || filterImmeuble || filterArtisan || filterLocataire || filterType

  const handleUpload = async () => {
    if (!uploadForm.nom) return
    setGedUploading(true)
    let fileUrl: string | undefined
    let fileTaille = '—'
    // Upload réel si fichier sélectionné
    if (gedUploadFile) {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        const formData = new FormData()
        formData.append('file', gedUploadFile)
        formData.append('bucket', 'artisan-documents')
        formData.append('folder', 'syndic-ged')
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          fileUrl = data.url
        }
        fileTaille = gedUploadFile.size > 1024 * 1024
          ? `${(gedUploadFile.size / 1024 / 1024).toFixed(1)} Mo`
          : `${(gedUploadFile.size / 1024).toFixed(0)} Ko`
      } catch { /* silencieux */ }
    }
    const newDoc: GEDDocument = {
      id: Date.now().toString(),
      nom: uploadForm.nom || (gedUploadFile?.name ?? 'Document'),
      type: uploadForm.type,
      immeuble: uploadForm.immeuble || 'Tous',
      artisan: uploadForm.artisan,
      locataire: uploadForm.locataire,
      dateDocument: new Date().toISOString().split('T')[0],
      dateAjout: new Date().toISOString().split('T')[0],
      taille: fileTaille,
      tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      url: fileUrl,
    }
    setDocs(prev => [newDoc, ...prev])
    setShowUpload(false)
    setUploadForm({ nom: '', type: 'rapport', immeuble: '', artisan: '', locataire: '', tags: '' })
    setGedUploadFile(null)
    setGedUploading(false)
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{t('syndicDash.ged.subtitle').replace('{total}', String(stats.total)).replace('{rapports}', String(stats.rapports)).replace('{factures}', String(stats.factures)).replace('{devis}', String(stats.devis))}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-2 border border-gray-200 rounded-lg hover:bg-[#F7F4EE] transition text-gray-500 text-sm">
            {viewMode === 'list' ? '⊞' : '☰'}
          </button>
          <button onClick={() => setShowUpload(true)}
            className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            {t('syndicDash.ged.addDoc')}
          </button>
        </div>
      </div>

      {/* ── Stats rapides ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('syndicDash.ged.reports'),    nb: stats.rapports, type: 'rapport'    as TypeDocument, emoji: '📋', color: 'border-[#E4DDD0] bg-[#F7F4EE]' },
          { label: t('syndicDash.ged.invoices'),    nb: stats.factures, type: 'facture'    as TypeDocument, emoji: '💶', color: 'border-green-200 bg-green-50' },
          { label: t('syndicDash.ged.quotes'),       nb: stats.devis,    type: 'devis'      as TypeDocument, emoji: '📝', color: 'border-amber-200 bg-amber-50' },
          { label: t('syndicDash.ged.all'),        nb: stats.total,    type: ''           as TypeDocument | '', emoji: '📁', color: 'border-gray-200 bg-[#F7F4EE]' },
        ].map(s => (
          <button key={s.label}
            onClick={() => setFilterType(filterType === s.type ? '' : s.type as TypeDocument)}
            className={`rounded-xl border-2 p-4 text-left transition hover:shadow-sm ${s.color} ${filterType === s.type ? 'ring-2 ring-[#C9A84C]' : ''}`}>
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-xl font-bold text-[#0D1B2E]">{s.nb}</div>
            <div className="text-xs text-gray-600">{s.label}</div>
          </button>
        ))}
      </div>

      {/* ── Barre de recherche + filtres ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col gap-3">
          {/* Recherche plein texte */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('syndicDash.ged.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#C9A84C] focus:outline-none text-sm"
            />
          </div>

          {/* Filtres multi-critères */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Bâtiment */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 {t('syndicDash.ged.building')}</label>
              <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                <option value="">{t('syndicDash.ged.allBuildings')}</option>
                <option value="Tous">{t('syndicDash.ged.commonAll')}</option>
                {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
              </select>
            </div>

            {/* Artisan / Technicien */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">🔧 {t('syndicDash.ged.artisanTech')}</label>
              <select value={filterArtisan} onChange={e => setFilterArtisan(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                <option value="">{t('syndicDash.ged.allArtisans')}</option>
                {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom} — {a.metier}</option>)}
              </select>
            </div>

            {/* Locataire / Propriétaire */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">👤 {t('syndicDash.ged.tenantOwner')}</label>
              <input
                type="text"
                value={filterLocataire}
                onChange={e => setFilterLocataire(e.target.value)}
                placeholder={t('syndicDash.ged.tenantPlaceholder')}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm"
              />
            </div>

            {/* Type de document */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">📄 {t('syndicDash.ged.docType')}</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as TypeDocument | '')}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                <option value="">{t('syndicDash.ged.allTypes')}</option>
                {(Object.entries(TYPE_DOC_CONFIG) as [TypeDocument, { emoji: string; label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Résultats + reset */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-[#C9A84C]">{filtered.length}</span> {filtered.length !== 1 ? t('syndicDash.ged.foundDocsPlural') : t('syndicDash.ged.foundDocs')} {filtered.length !== 1 ? t('syndicDash.ged.foundPlural') : t('syndicDash.ged.found')}
              {hasFilters && <span className="text-gray-500"> {t('syndicDash.ged.outOf').replace('{total}', String(docs.length))}</span>}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-semibold transition flex items-center gap-1">
                ✕ {t('syndicDash.ged.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Liste des documents ── */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">{t('syndicDash.ged.noDocFound')}</p>
              <p className="text-sm mt-1">{t('syndicDash.ged.changeSearch')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* En-tête tableau */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#F7F4EE] text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <div className="col-span-4">{t('syndicDash.ged.document')}</div>
                <div className="col-span-2">{t('syndicDash.ged.type')}</div>
                <div className="col-span-2">{t('syndicDash.ged.building')}</div>
                <div className="col-span-2">{t('syndicDash.ged.artisan')}</div>
                <div className="col-span-1">{t('syndicDash.ged.date')}</div>
                <div className="col-span-1">{t('syndicDash.ged.actions')}</div>
              </div>
              {filtered.map(doc => {
                const cfg = TYPE_DOC_CONFIG[doc.type]
                return (
                  <div key={doc.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#F7F4EE]/40 transition group items-center">
                    {/* Nom + tags */}
                    <div className="col-span-4">
                      <div className="flex items-start gap-2">
                        <span className="text-xl mt-0.5 flex-shrink-0">{cfg.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0D1B2E] leading-tight">{doc.nom}</p>
                          {doc.locataire && (
                            <p className="text-xs text-[#C9A84C] mt-0.5">👤 {doc.locataire}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.tags.slice(0, 3).map(tag => (
                              <button key={tag} onClick={() => setSearch(tag)}
                                className="text-xs bg-[#F7F4EE] text-gray-500 px-1.5 py-0.5 rounded hover:bg-[#F7F4EE] hover:text-[#C9A84C] transition">
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Type */}
                    <div className="col-span-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {/* Bâtiment */}
                    <div className="col-span-2 text-sm text-gray-600 truncate">{doc.immeuble}</div>
                    {/* Artisan */}
                    <div className="col-span-2 text-sm text-gray-600 truncate">{doc.artisan || <span className="text-gray-300">—</span>}</div>
                    {/* Date */}
                    <div className="col-span-1 text-xs text-gray-500">
                      {new Date(doc.dateDocument).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                    {/* Actions */}
                    <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setSelectedDoc(doc)} title={t('syndicDash.ged.details')}
                        className="p-1.5 bg-[#F7F4EE] hover:bg-[#F7F4EE] text-gray-600 hover:text-[#C9A84C] rounded-lg transition text-xs">👁</button>
                      <button
                        onClick={() => {
                          if (doc.url) {
                            const a = document.createElement('a'); a.href = doc.url; a.download = doc.nom; a.click()
                          } else {
                            const blob = new Blob([`Document: ${doc.nom}\nImmeuble: ${doc.immeuble}\nArtisan: ${doc.artisan}\nDate: ${doc.dateDocument}\nType: ${doc.type}`], { type: 'text/plain;charset=utf-8' })
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = doc.nom + '.txt'; a.click(); URL.revokeObjectURL(a.href)
                          }
                        }}
                        title={t('syndicDash.ged.download')}
                        className="p-1.5 bg-[#F7F4EE] hover:bg-[#F7F4EE] text-gray-600 hover:text-[#C9A84C] rounded-lg transition text-xs">⬇️</button>
                      <button
                        onClick={() => { if (window.confirm(t('syndicDash.ged.deleteConfirm').replace('{name}', doc.nom))) setDocs(prev => prev.filter(d => d.id !== doc.id)) }}
                        title={t('syndicDash.ged.deleteTitle')}
                        className="p-1.5 bg-[#F7F4EE] hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition text-xs">🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Vue grille */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-4 text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">{t('syndicDash.ged.noDocFound')}</p>
            </div>
          ) : filtered.map(doc => {
            const cfg = TYPE_DOC_CONFIG[doc.type]
            return (
              <div key={doc.id} onClick={() => setSelectedDoc(doc)}
                className="bg-white rounded-2xl border-2 border-gray-100 p-4 hover:border-[#C9A84C] hover:shadow-md transition cursor-pointer">
                <div className="text-3xl mb-2">{cfg.emoji}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <p className="text-sm font-medium text-[#0D1B2E] mt-2 leading-snug line-clamp-2">{doc.nom}</p>
                <p className="text-xs text-gray-500 mt-2">{doc.immeuble}</p>
                {doc.artisan && <p className="text-xs text-gray-500">🔧 {doc.artisan}</p>}
                {doc.locataire && <p className="text-xs text-[#C9A84C]">👤 {doc.locataire}</p>}
                <p className="text-xs text-gray-500 mt-2">{new Date(doc.dateDocument).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} · {doc.taille}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Détail document ── */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{TYPE_DOC_CONFIG[selectedDoc.type].emoji}</span>
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_DOC_CONFIG[selectedDoc.type].color}`}>
                    {TYPE_DOC_CONFIG[selectedDoc.type].label}
                  </span>
                  <h3 className="font-bold text-[#0D1B2E] mt-1 leading-snug">{selectedDoc.nom}</h3>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-gray-500 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">🏢 {t('syndicDash.ged.detailBuilding')}</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.immeuble}</p>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📅 {t('syndicDash.ged.detailDate')}</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateDocument).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>
                </div>
                {selectedDoc.artisan && (
                  <div className="bg-[#F7F4EE] rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">🔧 {t('syndicDash.ged.detailArtisan')}</p>
                    <p className="font-semibold text-gray-800">{selectedDoc.artisan}</p>
                  </div>
                )}
                {selectedDoc.locataire && (
                  <div className="bg-[#F7F4EE] rounded-xl p-3">
                    <p className="text-xs text-[#C9A84C] mb-0.5">👤 {t('syndicDash.ged.detailTenant')}</p>
                    <p className="font-semibold text-[#0D1B2E]">{selectedDoc.locataire}</p>
                  </div>
                )}
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📦 {t('syndicDash.ged.detailSize')}</p>
                  <p className="font-semibold text-gray-800">{selectedDoc.taille}</p>
                </div>
                <div className="bg-[#F7F4EE] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📥 {t('syndicDash.ged.detailAdded')}</p>
                  <p className="font-semibold text-gray-800">{new Date(selectedDoc.dateAjout).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</p>
                </div>
              </div>
              {selectedDoc.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">{t('syndicDash.ged.detailTags')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDoc.tags.map(tag => (
                      <button key={tag} onClick={() => { setSelectedDoc(null); setSearch(tag) }}
                        className="text-xs bg-[#F7F4EE] text-[#C9A84C] border border-[#E4DDD0] px-2.5 py-1 rounded-full hover:bg-[#F7F4EE] transition">
                        🏷 {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (selectedDoc.url) {
                    const a = document.createElement('a'); a.href = selectedDoc.url; a.download = selectedDoc.nom; a.click()
                  } else {
                    const content = `Document: ${selectedDoc.nom}\nType: ${selectedDoc.type}\nImmeuble: ${selectedDoc.immeuble}\nArtisan: ${selectedDoc.artisan}\nLocataire: ${selectedDoc.locataire}\nDate du document: ${selectedDoc.dateDocument}\nDate d'ajout: ${selectedDoc.dateAjout}\nTaille: ${selectedDoc.taille}\nTags: ${selectedDoc.tags.join(', ')}`
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = selectedDoc.nom + '.txt'; a.click(); URL.revokeObjectURL(a.href)
                  }
                }}
                className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-semibold transition text-sm"
              >
                ⬇️ {t('syndicDash.ged.downloadBtn')}
              </button>
              <button onClick={() => setSelectedDoc(null)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">
                {t('syndicDash.ged.closeBtn')}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('syndicDash.ged.deleteConfirm').replace('{name}', selectedDoc.nom))) {
                    setDocs(prev => prev.filter(d => d.id !== selectedDoc.id))
                    setSelectedDoc(null)
                  }
                }}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2.5 px-4 rounded-lg font-semibold transition text-sm"
              >
                🗑️ {t('syndicDash.ged.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Upload ── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#0D1B2E] mb-5">{t('syndicDash.ged.uploadTitle')}</h3>
            <div className="space-y-4">
              {/* Upload fichier */}
              <div
                onClick={() => gedFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-[#C9A84C]') }}
                onDragLeave={e => e.currentTarget.classList.remove('border-[#C9A84C]')}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('border-[#C9A84C]')
                  const f = e.dataTransfer.files[0]
                  if (f) { setGedUploadFile(f); if (!uploadForm.nom) setUploadForm(prev => ({ ...prev, nom: f.name.replace(/\.[^.]+$/, '') })) }
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${gedUploadFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-[#C9A84C] hover:bg-[#F7F4EE]/30'}`}
              >
                <input
                  ref={gedFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setGedUploadFile(f); if (!uploadForm.nom) setUploadForm(prev => ({ ...prev, nom: f.name.replace(/\.[^.]+$/, '') })) }
                  }}
                  className="hidden"
                />
                {gedUploadFile ? (
                  <>
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-sm font-semibold text-green-700">{gedUploadFile.name}</p>
                    <p className="text-xs text-green-500 mt-1">{(gedUploadFile.size / 1024).toFixed(0)} Ko · {t('syndicDash.ged.uploadFileSelected')}</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📎</div>
                    <p className="text-sm font-medium text-gray-700">{t('syndicDash.ged.uploadDragDrop')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('syndicDash.ged.uploadFormats')}</p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.ged.uploadDocName')}</label>
                <input type="text" value={uploadForm.nom} onChange={e => setUploadForm({ ...uploadForm, nom: e.target.value })}
                  placeholder={t('syndicDash.ged.uploadDocNamePlaceholder')}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('syndicDash.ged.uploadDocType')}</label>
                  <select value={uploadForm.type} onChange={e => setUploadForm({ ...uploadForm, type: e.target.value as TypeDocument })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                    {(Object.entries(TYPE_DOC_CONFIG) as [TypeDocument, { emoji: string; label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🏢 {t('syndicDash.ged.uploadBuilding')}</label>
                  <select value={uploadForm.immeuble} onChange={e => setUploadForm({ ...uploadForm, immeuble: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                    <option value="">{t('syndicDash.ged.uploadSelect')}</option>
                    <option value="Tous">{t('syndicDash.ged.commonAll')}</option>
                    {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">🔧 {t('syndicDash.ged.uploadArtisan')}</label>
                  <select value={uploadForm.artisan} onChange={e => setUploadForm({ ...uploadForm, artisan: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                    <option value="">{t('syndicDash.ged.uploadNone')}</option>
                    {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">👤 {t('syndicDash.ged.uploadTenant')}</label>
                  <input type="text" value={uploadForm.locataire} onChange={e => setUploadForm({ ...uploadForm, locataire: e.target.value })}
                    placeholder={t('syndicDash.ged.uploadTenantPlaceholder')}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">🏷 {t('syndicDash.ged.uploadTags')}</label>
                <input type="text" value={uploadForm.tags} onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  placeholder={t('syndicDash.ged.uploadTagsPlaceholder')}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowUpload(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition">
                {t('syndicDash.ged.uploadCancel')}
              </button>
              <button onClick={handleUpload} disabled={!uploadForm.nom || gedUploading}
                className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 flex items-center justify-center gap-2">
                {gedUploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('syndicDash.ged.uploadUploading')}</> : `📎 ${t('syndicDash.ged.uploadAddDoc')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
