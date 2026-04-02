'use client'

import React, { useRef, useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'
import {
  CATEGORIES, FR_REGIONS, DEPT_LABELS,
  getCategoryLabel, getCategoryEmoji, daysRemaining,
} from './shared'

function urgencyTag(urgency: string, isPt: boolean) {
  switch (urgency) {
    case 'emergency':
      return <span className="v22-tag v22-tag-red">🔴 {isPt ? 'Emergência' : 'Urgence'}</span>
    case 'urgent':
      return <span className="v22-tag v22-tag-amber">🟡 {isPt ? 'Urgente' : 'Urgent'}</span>
    default:
      return <span className="v22-tag v22-tag-green">🟢 {isPt ? 'Normal' : 'Normal'}</span>
  }
}

function publisherTag(type: string, isPt: boolean) {
  switch (type) {
    case 'syndic':
      return <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🏢 Syndic</span>
    case 'entreprise':
      return <span className="v22-tag" style={{ background: '#F3E8FF', color: '#7C3AED' }}>🏭 {isPt ? 'Empresa' : 'Entreprise'}</span>
    default:
      return <span className="v22-tag v22-tag-gray">👤 {isPt ? 'Particular' : 'Particulier'}</span>
  }
}

interface BrowseTabViewProps {
  isPt: boolean
  locale: string
  marches: any[]
  loading: boolean
  scanning: boolean
  scanResults: any[]
  scanMeta: any
  scanError: string
  showScanResults: boolean
  alerts: { expiringCount: number; unreadMessages: number }
  prefsLoaded: boolean
  marchesOptIn: boolean
  filterCategory: string
  filterRegion: string
  filterDepartments: string[]
  prefsSaved: boolean
  onFilterCategoryChange: (v: string) => void
  onFilterRegionChange: (v: string) => void
  onFilterDepartmentsChange: (v: string[]) => void
  onScanMarches: () => void
  onSaveGeoPrefs: () => void
  onSelectMarche: (m: any) => void
  onGoToSettings: () => void
}

export default function BrowseTabView({
  isPt, locale, marches, loading, scanning, scanResults, scanMeta, scanError,
  showScanResults, alerts, prefsLoaded, marchesOptIn,
  filterCategory, filterRegion, filterDepartments, prefsSaved,
  onFilterCategoryChange, onFilterRegionChange, onFilterDepartmentsChange,
  onScanMarches, onSaveGeoPrefs, onSelectMarche, onGoToSettings,
}: BrowseTabViewProps) {
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div>
      {/* Alerts banner */}
      {(alerts.expiringCount > 0 || alerts.unreadMessages > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {alerts.expiringCount > 0 && (
            <div className="v22-alert v22-alert-red" style={{ fontSize: 12 }}>
              <span>&#x23F0;</span>
              <span>
                {isPt
                  ? `${alerts.expiringCount} mercado${alerts.expiringCount > 1 ? 's' : ''} expira${alerts.expiringCount > 1 ? 'm' : ''} nos próximos 3 dias`
                  : `${alerts.expiringCount} marché${alerts.expiringCount > 1 ? 's' : ''} expire${alerts.expiringCount > 1 ? 'nt' : ''} dans les 3 prochains jours`}
              </span>
            </div>
          )}
          {alerts.unreadMessages > 0 && (
            <div className="v22-alert v22-alert-amber" style={{ fontSize: 12 }}>
              <span>&#x1F4AC;</span>
              <span>
                {isPt
                  ? `Tem ${alerts.unreadMessages} mensagen${alerts.unreadMessages > 1 ? 's' : ''} não lida${alerts.unreadMessages > 1 ? 's' : ''}`
                  : `Vous avez ${alerts.unreadMessages} message${alerts.unreadMessages > 1 ? 's' : ''} non lu${alerts.unreadMessages > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Opt-in info banner */}
      {prefsLoaded && !marchesOptIn && (
        <div className="v22-alert v22-alert-amber" style={{ marginBottom: 14, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ flex: 1 }}>
            {isPt
              ? 'Ative a bolsa de mercados nas configurações para receber mercados personalizados'
              : 'Activez la bourse aux marchés dans les paramètres pour recevoir des marchés personnalisés'}
          </span>
          <button
            onClick={onGoToSettings}
            className="v22-btn v22-btn-sm"
          >
            {isPt ? 'Configurações' : 'Paramètres'} →
          </button>
        </div>
      )}

      {/* Filters card */}
      <div className="v22-card" style={{ marginBottom: 14, overflow: 'visible' }}>
        <div className="v22-card-head">
          <div className="v22-card-title">{isPt ? 'Filtros' : 'Filtres'}</div>
        </div>
        <div className="v22-card-body" style={{ overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            <div>
              <label className="v22-form-label">{isPt ? 'Categoria' : 'Catégorie'}</label>
              <select
                value={filterCategory}
                onChange={e => onFilterCategoryChange(e.target.value)}
                className="v22-form-input"
              >
                <option value="">{isPt ? 'Todas' : 'Toutes'}</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {isPt ? cat.label : cat.labelFr}
                  </option>
                ))}
              </select>
            </div>

            {/* Région filter (FR only) */}
            {!isPt && (
              <div>
                <label className="v22-form-label">Région</label>
                <select
                  value={filterRegion}
                  onChange={e => {
                    onFilterRegionChange(e.target.value)
                    onFilterDepartmentsChange([])
                  }}
                  className="v22-form-input"
                >
                  <option value="">Toute la France</option>
                  {FR_REGIONS.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Département dropdown with checkboxes (FR only, when region selected) */}
            {!isPt && filterRegion && (
              <div style={{ position: 'relative' }} ref={deptDropdownRef}>
                <label className="v22-form-label">
                  Départements {filterDepartments.length > 0 && <span style={{ color: '#f59e0b', fontWeight: 700 }}>({filterDepartments.length})</span>}
                </label>
                <button
                  type="button"
                  onClick={() => setDeptDropdownOpen(v => !v)}
                  className="v22-form-input"
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#fff', minWidth: 200,
                  }}
                >
                  <span style={{ fontSize: 12, color: filterDepartments.length > 0 ? '#1a1a1a' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filterDepartments.length === 0
                      ? 'Tous les départements'
                      : filterDepartments.length <= 2
                        ? filterDepartments.map(d => DEPT_LABELS[d]?.split(' - ')[1] || d).join(', ')
                        : `${filterDepartments.length} départements`}
                  </span>
                  <span style={{ fontSize: 10, marginLeft: 6, color: '#9ca3af' }}>{deptDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {deptDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)', width: 280,
                    marginTop: 4,
                  }}>
                    {/* Select all / Deselect all */}
                    <div style={{ padding: '7px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onFilterDepartmentsChange(FR_REGIONS.find(r => r.id === filterRegion)?.depts || [])}
                        style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Choisir tous
                      </button>
                      <span style={{ color: '#d1d5db' }}>|</span>
                      <button
                        type="button"
                        onClick={() => onFilterDepartmentsChange([])}
                        style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Tout désélectionner
                      </button>
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {(FR_REGIONS.find(r => r.id === filterRegion)?.depts || []).map(d => {
                        const isSelected = filterDepartments.includes(d)
                        return (
                          <label
                            key={d}
                            onClick={() => onFilterDepartmentsChange(isSelected ? filterDepartments.filter(x => x !== d) : [...filterDepartments, d])}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                              background: isSelected ? '#fffbeb' : 'transparent',
                              borderBottom: '1px solid #f9fafb',
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <div
                              style={{
                                width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                                border: isSelected ? '2px solid #f59e0b' : '2px solid #d1d5db',
                                background: isSelected ? '#f59e0b' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                            >
                              {isSelected && (
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span style={{ color: isSelected ? '#92400e' : '#374151', fontWeight: isSelected ? 500 : 400 }}>
                              {DEPT_LABELS[d] || d}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {/* Valider button */}
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6' }}>
                      <button
                        type="button"
                        onClick={() => setDeptDropdownOpen(false)}
                        style={{
                          width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
                          background: '#FFC107', color: '#1a1a1a',
                          fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Valider ({filterDepartments.length || 'tous'})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={onScanMarches}
                disabled={scanning}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: scanning ? '#d4a017' : '#FFC107', color: '#1a1a1a',
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {scanning ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #1a1a1a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    {isPt ? 'A analisar...' : 'Scan en cours...'}
                  </>
                ) : (
                  <>📡 {isPt ? 'Scanner marchés publics' : 'Scanner marchés publics'}</>
                )}
              </button>
              {scanMeta && (
                <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', alignSelf: 'center' }}>
                  Dernier scan : {new Date(scanMeta.scannedAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  {' — '}{scanMeta.totalScanned} analysés → {scanMeta.totalFiltered} pertinents
                </span>
              )}
            </div>
            {!isPt && (
              <button
                type="button"
                onClick={onSaveGeoPrefs}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                  background: prefsSaved ? '#f0fdf4' : '#fff', color: prefsSaved ? '#16a34a' : '#374151',
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                {prefsSaved ? '✓ Enregistré' : '💾 Enregistrer mes préférences'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan Results Panel */}
      {scanError && (
        <div style={{ padding: '10px 14px', marginBottom: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12 }}>
          ⚠️ {scanError}
        </div>
      )}

      {scanResults.length > 0 && (
        <div className="v22-card" style={{ marginBottom: 14, border: '2px solid #FFC107' }}>
          <div className="v22-card-head" style={{ background: '#fffbeb' }}>
            <div className="v22-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              📡 {isPt ? 'Marchés publics scannés' : 'Marchés publics scannés'}
              <span style={{ background: '#FFC107', color: '#1a1a1a', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                {scanResults.length} {isPt ? 'resultados' : 'résultats'}
              </span>
            </div>
            {scanMeta && (
              <span style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                {new Date(scanMeta.scannedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div style={{ padding: 0 }}>
            {scanMeta && (
              <div style={{ padding: '8px 14px', background: '#f8f9fa', borderBottom: '1px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', gap: 16 }}>
                {!isPt && <span>🇫🇷 BOAMP: {(scanMeta.sources?.boamp || 0) + (scanMeta.sources?.marches_online || 0)}</span>}
                <span>🇪🇺 TED: {scanMeta.sources?.ted || 0}</span>
                {isPt && <span>🇵🇹 BASE.gov: {scanMeta.sources?.base_gov || 0}</span>}
                {(scanMeta.sources?.stored || 0) > 0 && <span>📋 Sites+Mairies: {scanMeta.sources.stored}</span>}
                <span>📊 Scannés: {scanMeta.totalScanned}</span>
              </div>
            )}
            {scanResults.map((m: any, idx: number) => {
              const score = m.scoring?.scoreTotal || m.scoreTotal || 0
              const priority = m.scoring?.priority || m.priority || 'medium'
              const priorityEmoji = priority === 'high' ? '🔥' : priority === 'medium' ? '⚖️' : 'ℹ️'
              const priorityColor = priority === 'high' ? '#dc2626' : priority === 'medium' ? '#d97706' : '#6b7280'
              const sourceLabel = m.source === 'boamp' ? '🇫🇷 BOAMP' : m.source === 'ted' ? '🇪🇺 TED' : m.source === 'marches_online' ? '🇫🇷 BOAMP' : m.source === 'base_gov' ? '🇵🇹 BASE.gov' : m.source === 'decp' ? '🇫🇷 DECP' : m.source === 'stored' ? '📋 Plateformes' : m.source

              return (
                <div
                  key={m.sourceId || idx}
                  style={{
                    padding: '12px 14px',
                    borderBottom: idx < scanResults.length - 1 ? '1px solid var(--v22-border)' : 'none',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    background: priority === 'high' ? '#fffbeb' : 'transparent',
                  }}
                >
                  {/* Score circle */}
                  <div style={{
                    minWidth: 44, height: 44, borderRadius: '50%',
                    background: priority === 'high' ? '#FFC107' : priority === 'medium' ? '#e5e7eb' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: priority === 'high' ? '#1a1a1a' : '#374151',
                    border: priority === 'high' ? '2px solid #d97706' : '1px solid #d1d5db',
                  }}>
                    {score}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 14 }}>{priorityEmoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--v22-text)' }}>
                        {m.title?.slice(0, 120)}{m.title?.length > 120 ? '...' : ''}
                      </span>
                    </div>

                    {/* AI Summary */}
                    {m.aiSummary && (
                      <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 4, fontStyle: 'italic' }}>
                        🤖 {m.aiSummary}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--v22-text-muted)' }}>
                      <span>{sourceLabel}</span>
                      <span>📍 {m.location}</span>
                      {m.buyer && <span>🏢 {m.buyer.slice(0, 40)}</span>}
                      {m.budgetMin && <span>💰 {formatPrice(m.budgetMin)}</span>}
                      {m.deadline && <span>📅 {new Date(m.deadline).toLocaleDateString('fr-FR')}</span>}
                      {m.scoring?.matchedMetiers?.length > 0 && (
                        <span style={{ color: priorityColor, fontWeight: 600 }}>
                          🎯 {m.scoring.matchedMetiers.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link */}
                  {m.sourceUrl && m.sourceUrl !== '#' && (
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid var(--v22-border)',
                        background: '#fff', color: 'var(--v22-text)', fontSize: 11, fontWeight: 500,
                        textDecoration: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      Voir ↗
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showScanResults && scanResults.length === 0 && !scanning && !scanError && (
        <div style={{ textAlign: 'center', padding: '24px 0', marginBottom: 14, background: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {isPt ? 'Nenhum mercado público pertinente encontrado' : 'Aucun marché public pertinent trouvé'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>
            {isPt ? 'Tente alterar os filtros ou alargue a pesquisa' : 'Essayez de modifier vos filtres ou d\'élargir la recherche'}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 24, height: 24, border: '2px solid var(--v22-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && marches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {isPt ? 'Nenhum mercado encontrado' : 'Aucun marché trouvé'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto' }}>
            {isPt
              ? 'Não há mercados disponíveis com os filtros selecionados. Tente ajustar os critérios ou volte mais tarde.'
              : 'Aucun marché disponible avec les filtres sélectionnés. Essayez d\'ajuster les critères ou revenez plus tard.'}
          </div>
        </div>
      )}

      {/* Opportunités card with list */}
      {!loading && marches.length > 0 && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{isPt ? 'Oportunidades' : 'Opportunités'}</div>
            <div className="v22-card-meta">{marches.length} {isPt ? 'resultados' : 'résultats'}</div>
          </div>
          <div>
            {marches.map((m) => {
              const days = m.deadline ? daysRemaining(m.deadline) : null
              const maxCand = m.max_candidatures || 5
              const currentCand = m.candidatures_count || 0
              const isFull = currentCand >= maxCand
              const WORK_MODE_LABELS: Record<string, { emoji: string; fr: string; pt: string }> = {
                forfait: { emoji: '💼', fr: 'Forfait', pt: 'Forfait' },
                journee: { emoji: '📅', fr: 'Journée', pt: 'Por dia' },
                horaire: { emoji: '⏰', fr: 'Horaire', pt: 'Por hora' },
                tache: { emoji: '✅', fr: 'Tâche', pt: 'Por tarefa' },
              }
              const workMode = m.preferred_work_mode ? WORK_MODE_LABELS[m.preferred_work_mode] : null

              return (
                <div
                  key={m.id}
                  onClick={() => !isFull && onSelectMarche(m)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: '1px solid #F0F0EE',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.5 : 1,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isFull) (e.currentTarget as HTMLElement).style.background = '#FAFAF7' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  {/* Type label (mono) */}
                  <div style={{ flexShrink: 0, width: 90 }}>
                    <span className="v22-tag v22-tag-yellow">
                      {getCategoryEmoji(m.category)} {isPt
                        ? (CATEGORIES.find(c => c.id === m.category)?.label || m.category)
                        : (CATEGORIES.find(c => c.id === m.category)?.labelFr || m.category)}
                    </span>
                  </div>

                  {/* Title + location */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(m.location_city || m.city) && <span>📍 {m.location_city || m.city}{m.concelho && m.concelho !== m.location_city ? `, ${m.concelho}` : ''}</span>}
                      {days !== null && (
                        <span style={{ color: days <= 3 ? 'var(--v22-red)' : undefined }}>
                          ⏰ {days > 0 ? (isPt ? `${days}d` : `${days}j`) : (isPt ? 'Expirado' : 'Expiré')}
                        </span>
                      )}
                      {urgencyTag(m.urgency, isPt)}
                      {isFull && <span className="v22-tag v22-tag-gray">{isPt ? 'Completo' : 'Complet'}</span>}
                      {workMode && (
                        <span className="v22-tag" style={{ background: '#EEF2FF', color: '#4338CA' }}>
                          {workMode.emoji} {isPt ? workMode.pt : workMode.fr}
                        </span>
                      )}
                    </div>

                    {/* Requirements badges */}
                    {(m.require_rc_pro || m.require_decennale || m.require_rge || m.require_qualibat) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {m.require_rc_pro && <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🛡️ RC Pro</span>}
                        {m.require_decennale && <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🏗️ {isPt ? 'Decenal' : 'Décennale'}</span>}
                        {m.require_rge && <span className="v22-tag v22-tag-green">🌿 RGE</span>}
                        {m.require_qualibat && <span className="v22-tag" style={{ background: '#F3E8FF', color: '#7C3AED' }}>🏅 QualiBAT</span>}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div className="v22-prog-bar" style={{ flex: 1 }}>
                        <div className="v22-prog-fill" style={{
                          width: `${Math.min(100, (currentCand / maxCand) * 100)}%`,
                          background: isFull ? 'var(--v22-text-muted)' : currentCand / maxCand > 0.7 ? 'var(--v22-amber)' : 'var(--v22-green)',
                        }} />
                      </div>
                      <span className="v22-mono" style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>
                        {currentCand}/{maxCand}
                      </span>
                    </div>

                    {/* Availability info */}
                    {m.artisan_dispo_info && (
                      <div style={{ marginTop: 4 }}>
                        <span className="v22-tag v22-tag-green">
                          &#x1F4C5; {m.artisan_dispo_info.available_now
                            ? (isPt ? 'Disponível imediatamente' : 'Disponible immédiatement')
                            : m.artisan_dispo_info.available_from
                              ? (isPt
                                ? `Disponível a partir de ${new Date(m.artisan_dispo_info.available_from).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`
                                : `Disponible à partir du ${new Date(m.artisan_dispo_info.available_from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`)
                              : (isPt ? 'Disponibilidade a confirmar' : 'Disponibilité à confirmer')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Budget (mono, right-aligned) */}
                  <div className="v22-amount" style={{ flexShrink: 0, textAlign: 'right' }}>
                    {(m.budget_min || m.budget_max) ? (
                      <>
                        {m.budget_min ? formatPrice(m.budget_min, locale) : '—'}
                        {' - '}
                        {m.budget_max ? formatPrice(m.budget_max, locale) : '—'}
                      </>
                    ) : (
                      <span style={{ color: 'var(--v22-text-muted)', fontStyle: 'italic', fontSize: 11 }}>
                        {isPt ? 'N/D' : 'N/D'}
                      </span>
                    )}
                  </div>

                  {/* Publisher tag */}
                  <div style={{ flexShrink: 0 }}>
                    {publisherTag(m.publisher_type, isPt)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
