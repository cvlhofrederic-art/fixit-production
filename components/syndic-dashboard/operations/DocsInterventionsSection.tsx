'use client'

import { useState, useEffect, useRef } from 'react'
import type { Artisan, Page, DocIntervention } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

function safeHref(url: string): string {
  try { return ['http:', 'https:'].includes(new URL(url).protocol) ? url : '#' } catch { return '#' }
}

export default function DocsInterventionsSection({ artisans, setPage }: { artisans: Artisan[]; setPage: (p: Page) => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [docs, setDocs] = useState<DocIntervention[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<'all' | 'envoye' | 'non_envoye'>('all')
  const [filterArtisan, setFilterArtisan] = useState<string>('all')
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    artisan_nom: '', artisan_metier: '', immeuble: '',
    date_intervention: new Date().toISOString().split('T')[0],
    type: 'facture' as DocIntervention['type'],
    notes: '', montant: '',
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [sendingCompta, setSendingCompta] = useState<string | null>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)
  const [typeDropdownIdx, setTypeDropdownIdx] = useState(0)
  const [artisanDropdownIdx, setArtisanDropdownIdx] = useState(0)

  // Charger depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vitfix_docs_interventions')
      if (saved) setDocs(JSON.parse(saved))
    } catch {}
  }, [])

  const saveDocs = (updated: DocIntervention[]) => {
    setDocs(updated)
    try { localStorage.setItem('vitfix_docs_interventions', JSON.stringify(updated)) } catch {}
  }

  // Upload document
  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.artisan_nom || !uploadForm.immeuble) return
    setUploading(true)
    setUploadError('')
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('bucket', 'artisan-documents')
      form.append('folder', 'syndic-interventions')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error || 'Erreur upload'); return }

      const newDoc: DocIntervention = {
        id: Date.now().toString(),
        artisan_nom: uploadForm.artisan_nom,
        artisan_metier: uploadForm.artisan_metier,
        immeuble: uploadForm.immeuble,
        date_intervention: uploadForm.date_intervention,
        type: uploadForm.type,
        filename: uploadFile.name,
        url: data.url,
        envoye_compta: false,
        notes: uploadForm.notes,
        montant: uploadForm.montant ? parseFloat(uploadForm.montant) : undefined,
      }
      saveDocs([newDoc, ...docs])
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadForm({ artisan_nom: '', artisan_metier: '', immeuble: '', date_intervention: new Date().toISOString().split('T')[0], type: 'facture', notes: '', montant: '' })
    } catch { setUploadError('Erreur réseau') }
    finally { setUploading(false) }
  }

  const handleEnvoyerCompta = async (doc: DocIntervention) => {
    setSendingCompta(doc.id)
    await new Promise(r => setTimeout(r, 800))
    const updated = docs.map(d => d.id === doc.id
      ? { ...d, envoye_compta: true, envoye_compta_at: new Date().toISOString() }
      : d
    )
    saveDocs(updated)
    setSendingCompta(null)
  }

  const handleAnnulerEnvoi = (docId: string) => {
    const updated = docs.map(d => d.id === docId ? { ...d, envoye_compta: false, envoye_compta_at: undefined } : d)
    saveDocs(updated)
  }

  const handleDelete = (docId: string) => {
    if (!confirm(t('syndicDash.docsInterventions.deleteConfirm'))) return
    saveDocs(docs.filter(d => d.id !== docId))
  }

  // Filtres
  const filtered = docs.filter(d => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase()) &&
        !d.artisan_nom.toLowerCase().includes(search.toLowerCase()) &&
        !d.immeuble.toLowerCase().includes(search.toLowerCase()) &&
        !d.notes?.toLowerCase().includes(search.toLowerCase()) &&
        !d.artisan_metier.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType !== 'all' && d.type !== filterType) return false
    if (filterStatut === 'envoye' && !d.envoye_compta) return false
    if (filterStatut === 'non_envoye' && d.envoye_compta) return false
    if (filterArtisan !== 'all' && d.artisan_nom !== filterArtisan) return false
    return true
  })

  const typeConfig: Record<string, { emoji: string; label: string; tagClass: string; iconClass: string }> = {
    facture:  { emoji: '💶', label: 'Facture',  tagClass: 'sd-doc-tag-facture',  iconClass: 'sd-doc-fi-pdf' },
    devis:    { emoji: '📑', label: 'Devis',    tagClass: 'sd-doc-tag-devis',    iconClass: 'sd-doc-fi-pdf' },
    rapport:  { emoji: '📋', label: 'Rapport',  tagClass: 'sd-doc-tag-rapport',  iconClass: 'sd-doc-fi-pdf' },
    photo:    { emoji: '🖼', label: 'Photo',    tagClass: 'sd-doc-tag-photo',    iconClass: 'sd-doc-fi-img' },
    autre:    { emoji: '📝', label: 'Autre',    tagClass: 'sd-doc-tag-autre',    iconClass: 'sd-doc-fi-doc' },
  }

  const artisansList = Array.from(new Set(docs.map(d => d.artisan_nom))).filter(Boolean)
  const typeLabels = ['📄 Tous types', '💶 Factures', '📑 Devis', '📋 Rapports', '🖼 Photos', '📝 Autres']
  const typeValues = ['all', 'facture', 'devis', 'rapport', 'photo', 'autre']
  const artisanLabelsDropdown = ['🔧 Tous artisans', ...artisansList]
  const artisanValuesDropdown = ['all', ...artisansList]

  const stats = {
    total: docs.length,
    envoyes: docs.filter(d => d.envoye_compta).length,
    nonEnvoyes: docs.filter(d => !d.envoye_compta).length,
    factures: docs.filter(d => d.type === 'facture').length,
  }

  const locStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  const getFileIcon = (doc: DocIntervention) => {
    const ext = doc.filename.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return { emoji: '📄', cls: 'sd-doc-fi-pdf' }
    if (['jpg','jpeg','png','webp'].includes(ext || '')) return { emoji: '🖼', cls: 'sd-doc-fi-img' }
    if (['doc','docx'].includes(ext || '')) return { emoji: '📝', cls: 'sd-doc-fi-doc' }
    if (['xls','xlsx'].includes(ext || '')) return { emoji: '📊', cls: 'sd-doc-fi-sheet' }
    return { emoji: typeConfig[doc.type]?.emoji || '📄', cls: typeConfig[doc.type]?.iconClass || 'sd-doc-fi-doc' }
  }

  return (
    <div style={{ padding: '34px 36px' }}>

      {/* ══════ HERO ══════ */}
      <div className="sd-doc-hero">
        <div>
          <div className="sd-doc-hero-title">📁 Documents Interventions</div>
          <div className="sd-doc-hero-sub">
            <span>Factures</span> · <span>Devis</span> · <span>Rapports</span> · <span>Photos</span> — Transmission comptabilité
          </div>
        </div>
        <button className="sd-doc-add-btn" onClick={() => setShowUploadModal(true)}>
          <span style={{ color: 'var(--sd-gold)', fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</span> Ajouter un document
        </button>
      </div>

      {/* ══════ KPI STRIP ══════ */}
      <div className="sd-doc-kpi-strip">
        <div className="sd-doc-kpi kpi-navy">
          <div className="sd-doc-kpi-num">{stats.total}</div>
          <div className="sd-doc-kpi-label">Total documents</div>
          <div className="sd-doc-kpi-sub">Toutes catégories</div>
        </div>
        <div className="sd-doc-kpi kpi-red">
          <div className="sd-doc-kpi-num">{stats.nonEnvoyes}</div>
          <div className="sd-doc-kpi-label">Non transmis compta</div>
          <div className="sd-doc-kpi-sub">À traiter</div>
        </div>
        <div className="sd-doc-kpi kpi-teal">
          <div className="sd-doc-kpi-num">{stats.envoyes}</div>
          <div className="sd-doc-kpi-label">Transmis comptabilité</div>
          <div className="sd-doc-kpi-sub">Classés</div>
        </div>
        <div className="sd-doc-kpi kpi-gold">
          <div className="sd-doc-kpi-num">{stats.factures}</div>
          <div className="sd-doc-kpi-label">Factures</div>
          <div className="sd-doc-kpi-sub">Ce mois</div>
        </div>
      </div>

      {/* ══════ FILTER TABS ══════ */}
      <div className="sd-doc-filter-bar">
        <button className={`sd-doc-filter-tab ${filterStatut === 'all' ? 'active' : ''}`} onClick={() => setFilterStatut('all')}>
          📂 Tous <span className="sd-doc-ft-count">{stats.total}</span>
        </button>
        <button className={`sd-doc-filter-tab ${filterStatut === 'non_envoye' ? 'active' : ''}`} onClick={() => setFilterStatut('non_envoye')}>
          <span className="sd-doc-ft-dot" style={{ background: 'var(--sd-red)' }} />
          À envoyer <span className="sd-doc-ft-count">{stats.nonEnvoyes}</span>
        </button>
        <button className={`sd-doc-filter-tab ${filterStatut === 'envoye' ? 'active' : ''}`} onClick={() => setFilterStatut('envoye')}>
          <span className="sd-doc-ft-dot" style={{ background: 'var(--sd-teal)' }} />
          Envoyés &amp; classés <span className="sd-doc-ft-count">{stats.envoyes}</span>
        </button>
      </div>

      {/* ══════ SEARCH ROW ══════ */}
      <div className="sd-doc-search-row">
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sd-ink-3)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
          </svg>
          <input
            className="sd-doc-search-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par artisan, immeuble, fichier, notes…"
          />
        </div>
        <button
          className="sd-doc-filter-select"
          onClick={() => {
            const next = (typeDropdownIdx + 1) % typeLabels.length
            setTypeDropdownIdx(next)
            setFilterType(typeValues[next])
          }}
        >
          <span>{typeLabels[typeDropdownIdx]}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4"/></svg>
        </button>
        <button
          className="sd-doc-filter-select"
          onClick={() => {
            const next = (artisanDropdownIdx + 1) % artisanLabelsDropdown.length
            setArtisanDropdownIdx(next)
            setFilterArtisan(artisanValuesDropdown[next])
          }}
        >
          <span>{artisanLabelsDropdown[artisanDropdownIdx] || '🔧 Tous artisans'}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4"/></svg>
        </button>
      </div>

      {/* ══════ TABLE ══════ */}
      <div className="sd-doc-table-wrap">
        <div className="sd-doc-count-bar">
          <span><strong>{filtered.length}</strong> document{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</span>
          <button className="sd-doc-filter-select" style={{ fontSize: 11, padding: '5px 11px' }}>⬇ Exporter</button>
        </div>

        {filtered.length === 0 ? (
          <div className="sd-doc-empty">
            <div className="sd-doc-empty-icon">📁</div>
            <div className="sd-doc-empty-title">{docs.length === 0 ? 'Aucun document' : 'Aucun résultat'}</div>
            <div className="sd-doc-empty-sub">
              {docs.length === 0 ? 'Ajoutez des factures, devis et rapports d\'intervention' : 'Essayez de modifier vos filtres'}
            </div>
            {docs.length === 0 && (
              <button className="sd-doc-add-btn" style={{ marginTop: 6 }} onClick={() => setShowUploadModal(true)}>
                <span style={{ color: 'var(--sd-gold)', fontSize: 16 }}>+</span> Ajouter un document
              </button>
            )}
          </div>
        ) : (
          <table className="sd-doc-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Résidence</th>
                <th>Artisan</th>
                <th>Date</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const fi = getFileIcon(doc)
                const tc = typeConfig[doc.type]
                const downloadUrl = safeHref(doc.url)
                return (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className={`sd-doc-file-icon ${fi.cls}`}>{fi.emoji}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)' }}>{doc.filename}</div>
                          <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 1 }}>
                            {doc.montant ? `${doc.montant.toLocaleString(locStr)} €` : 'Sans montant'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`sd-doc-tag ${tc?.tagClass || 'sd-doc-tag-autre'}`}>
                        {tc?.emoji} {tc?.label || doc.type}
                      </span>
                    </td>
                    <td><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--sd-navy)' }}>{doc.immeuble}</div></td>
                    <td><div style={{ fontSize: 12, color: 'var(--sd-ink-2)' }}>{doc.artisan_nom}</div></td>
                    <td><div style={{ fontSize: 12, color: 'var(--sd-ink-2)' }}>{new Date(doc.date_intervention).toLocaleDateString(locStr)}</div></td>
                    <td>
                      {doc.envoye_compta ? (
                        <span className="sd-doc-status sd-doc-status-transmis">
                          <span className="sd-doc-status-dot" /> Transmis
                        </span>
                      ) : (
                        <span className="sd-doc-status sd-doc-status-envoyer">
                          <span className="sd-doc-status-dot" /> À envoyer
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="sd-doc-row-actions">
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="sd-doc-row-btn" title="Télécharger">⬇</a>
                        <button className="sd-doc-row-btn" title="Transmettre" onClick={() => doc.envoye_compta ? handleAnnulerEnvoi(doc.id) : handleEnvoyerCompta(doc)}>
                          {sendingCompta === doc.id ? '⏳' : '📤'}
                        </button>
                        <button className="sd-doc-row-btn danger" title="Supprimer" onClick={() => handleDelete(doc.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════ MODAL AJOUT ══════ */}
      {showUploadModal && (
        <div className="sd-doc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
          <div className="sd-doc-modal">
            <div className="sd-doc-modal-header">
              <div>
                <div className="sd-doc-modal-title">Ajouter un document</div>
                <div className="sd-doc-modal-sub">Factures, devis, rapports, photos d&apos;intervention</div>
              </div>
              <button className="sd-doc-modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div className="sd-doc-modal-body">
              {/* Drop zone */}
              <div
                className={`sd-doc-drop-zone ${uploadFile ? 'has-file' : ''}`}
                onClick={() => uploadFileRef.current?.click()}
              >
                <input
                  ref={uploadFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                {uploadFile ? (
                  <>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-teal)' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 3 }}>{(uploadFile.size / 1024).toFixed(0)} Ko · Fichier sélectionné</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>📎</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy)', marginBottom: 3 }}>Glissez vos fichiers ici</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3)' }}>ou <strong style={{ color: 'var(--sd-gold)', cursor: 'pointer' }}>parcourir</strong> depuis votre ordinateur · PDF, JPG, PNG, DOCX</div>
                  </>
                )}
              </div>

              {/* Grid champs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="sd-doc-field-label">Type de document</label>
                  <select
                    className="sd-doc-field-select"
                    value={uploadForm.type}
                    onChange={e => setUploadForm(f => ({ ...f, type: e.target.value as DocIntervention['type'] }))}
                  >
                    <option value="facture">Facture</option>
                    <option value="devis">Devis</option>
                    <option value="rapport">Rapport d&apos;intervention</option>
                    <option value="photo">Photo</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="sd-doc-field-label">Résidence</label>
                  <input
                    className="sd-doc-field-input"
                    type="text"
                    value={uploadForm.immeuble}
                    onChange={e => setUploadForm(f => ({ ...f, immeuble: e.target.value }))}
                    placeholder="Nom de la résidence"
                  />
                </div>
                <div>
                  <label className="sd-doc-field-label">Artisan</label>
                  <input
                    className="sd-doc-field-input"
                    type="text"
                    value={uploadForm.artisan_nom}
                    onChange={e => setUploadForm(f => ({ ...f, artisan_nom: e.target.value }))}
                    list="artisans-docs-list"
                    placeholder="Nom de l'artisan"
                  />
                  <datalist id="artisans-docs-list">
                    {artisans.map(a => <option key={a.id} value={a.nom} />)}
                  </datalist>
                </div>
                <div>
                  <label className="sd-doc-field-label">Date du document</label>
                  <input
                    className="sd-doc-field-input"
                    type="date"
                    value={uploadForm.date_intervention}
                    onChange={e => setUploadForm(f => ({ ...f, date_intervention: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="sd-doc-field-label">Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--sd-ink-3)' }}>(optionnel)</span></label>
                <input
                  className="sd-doc-field-input"
                  type="text"
                  value={uploadForm.notes}
                  onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Référence, observations…"
                />
              </div>

              {uploadError && (
                <div style={{ background: 'var(--sd-red-soft)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 9, padding: '10px 14px', fontSize: 12, color: 'var(--sd-red)' }}>
                  ⚠️ {uploadError}
                </div>
              )}
            </div>
            <div className="sd-doc-modal-footer">
              <button className="sd-doc-btn-cancel" onClick={() => setShowUploadModal(false)}>Annuler</button>
              <button
                className="sd-doc-btn-submit"
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadForm.artisan_nom || !uploadForm.immeuble}
              >
                {uploading ? 'Upload...' : 'Ajouter le document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
