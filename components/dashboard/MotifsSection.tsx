'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ServiceEtapesEditor from '@/components/dashboard/ServiceEtapesEditor'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface MotifsSectionProps {
  services: any[]
  showMotifModal: boolean
  setShowMotifModal: (v: boolean) => void
  editingMotif: any
  motifForm: {
    name: string; description: string; duration_minutes: number | ''; price_min: number | ''; price_max: number | ''; pricing_unit: string; validation_auto: boolean; delai_minimum_heures: number
  }
  setMotifForm: (v: any) => void
  savingMotif: boolean
  openNewMotif: () => void
  openEditMotif: (service: any) => void
  saveMotif: () => void
  toggleMotifActive: (serviceId: string, currentActive: boolean) => void | Promise<void>
  deleteMotif: (serviceId: string) => void | Promise<void>
  getPriceRangeLabel: (service: any) => string
  getPricingUnit: (service: any) => string
  getCleanDescription: (service: any) => string
  orgRole?: OrgRole
}

export default function MotifsSection({
  services, showMotifModal, setShowMotifModal, editingMotif, motifForm, setMotifForm,
  savingMotif, openNewMotif, openEditMotif, saveMotif, toggleMotifActive, deleteMotif,
  getPriceRangeLabel, getPricingUnit, getCleanDescription, orgRole,
}: MotifsSectionProps) {
  const { t } = useTranslation()
  const [localEtapes, setLocalEtapes] = useState<string[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingWithEtapes, setSavingWithEtapes] = useState(false)
  const isSociete = orgRole === 'pro_societe'

  // Reset local étapes when modal opens/closes
  const origOpenNewMotif = openNewMotif
  const wrappedOpenNewMotif = () => { setLocalEtapes([]); origOpenNewMotif() }

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="v22-page-title">
            {isSociete ? '🏗️ Lots & Prestations BTP' : `${'🔧'} ${t('proDash.motifs.title')}`}
          </div>
          <div className="v22-page-sub">
            {isSociete
              ? 'Définissez vos lots de travaux, postes de devis et prix unitaires'
              : t('proDash.motifs.subtitle')}
          </div>
        </div>
        <button onClick={() => { setLocalEtapes([]); openNewMotif() }} className="v22-btn v22-btn-primary">
          {isSociete ? '+ Nouveau lot' : t('proDash.motifs.nouveauMotif')}
        </button>
      </div>

      {/* Info box - amber alert */}
      <div className="v22-alert v22-alert-amber" style={{ marginBottom: 16, cursor: 'default' }}>
        <span style={{ fontSize: 12 }}>
          {isSociete ? (
            <><strong>{'💡'} Conseil BTP</strong> Créez un lot par type de prestation (Maçonnerie, Charpente, Électricité…) avec prix unitaire ou forfait. Ces lots alimenteront vos devis et situations de travaux.</>
          ) : (
            <><strong>{'💡'} {t('proDash.motifs.astuce')}</strong> {t('proDash.motifs.astuceTexte')}</>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="v22-card">
        <table>
          <thead>
            <tr>
              <th>{t('proDash.motifs.colMotif')}</th>
              <th>{t('proDash.motifs.colDuree')}</th>
              <th>{t('proDash.motifs.colFourchette')}</th>
              <th>{t('proDash.motifs.colUnite')}</th>
              <th>{t('proDash.motifs.colValidation')}</th>
              <th>{t('proDash.motifs.colStatut')}</th>
              <th>{t('proDash.motifs.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{isSociete ? '🏗️' : '🌿'} {service.name}</div>
                  {getCleanDescription(service) && (
                    <div className="v22-ref" style={{ marginTop: 2 }}>{getCleanDescription(service)}</div>
                  )}
                </td>
                <td className="v22-ref">
                  {service.duration_minutes
                    ? `${Math.floor(service.duration_minutes / 60)}h${service.duration_minutes % 60 > 0 ? String(service.duration_minutes % 60).padStart(2, '0') : '00'}`
                    : '—'}
                </td>
                <td className="v22-amount" style={{ color: 'var(--v22-amber)', textAlign: 'left' }}>{getPriceRangeLabel(service)}</td>
                <td>
                  <span className="v22-tag v22-tag-gray">{getPricingUnit(service)}</span>
                </td>
                <td>
                  <span className={`v22-tag ${service.validation_auto ? 'v22-tag-green' : 'v22-tag-gray'}`}>
                    {service.validation_auto ? `⚡ ${t('proDash.motifs.auto')}` : `👤 ${t('proDash.motifs.manuel')}`}
                  </span>
                </td>
                <td>
                  <button onClick={async () => {
                    setTogglingId(service.id)
                    try { await toggleMotifActive(service.id, service.active) } finally { setTogglingId(null) }
                  }}
                    disabled={togglingId === service.id}
                    className={`v22-tag ${service.active ? 'v22-tag-green' : 'v22-tag-gray'}`}
                    style={{ cursor: togglingId === service.id ? 'not-allowed' : 'pointer', opacity: togglingId === service.id ? 0.5 : 1 }}>
                    {togglingId === service.id ? 'Chargement...' : service.active ? `✅ ${t('proDash.motifs.actif')}` : `⏸ ${t('proDash.motifs.inactif')}`}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEditMotif(service)} className="v22-btn v22-btn-sm">
                      {'✏️'} {t('proDash.motifs.modifier')}
                    </button>
                    <button onClick={async () => {
                      setDeletingId(service.id)
                      try { await deleteMotif(service.id) } finally { setDeletingId(null) }
                    }}
                      disabled={deletingId === service.id}
                      className="v22-btn v22-btn-sm"
                      style={{ color: 'var(--v22-red)', opacity: deletingId === service.id ? 0.5 : 1, cursor: deletingId === service.id ? 'not-allowed' : 'pointer' }}>
                      {deletingId === service.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 14px' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{isSociete ? '🏗️' : '🔧'}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {isSociete ? 'Aucun lot défini' : t('proDash.motifs.aucunMotif')}
                  </div>
                  <div className="v22-ref" style={{ marginBottom: 12 }}>
                    {isSociete
                      ? 'Créez vos premiers lots de travaux pour les intégrer dans vos devis BTP'
                      : t('proDash.motifs.aucunMotifDesc')}
                  </div>
                  <button onClick={() => { setLocalEtapes([]); openNewMotif() }} className="v22-btn v22-btn-primary">
                    {isSociete ? '+ Créer un lot' : t('proDash.motifs.creerMotif')}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Motif */}
      {showMotifModal && (
        <div className="v22-modal-overlay" onClick={() => setShowMotifModal(false)}>
          <div className="v22-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="v22-modal-head">
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {editingMotif
                  ? `✏️ ${isSociete ? 'Modifier le lot' : t('proDash.motifs.modifierMotif')}`
                  : isSociete ? '🏗️ Nouveau lot BTP' : `🔧 ${t('proDash.motifs.nouveauMotifTitle')}`}
              </span>
              <button onClick={() => setShowMotifModal(false)} className="v22-btn v22-btn-sm">✕</button>
            </div>
            <div className="v22-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name */}
                <div>
                  <label className="v22-form-label">{t('proDash.motifs.nomMotif')} *</label>
                  <input type="text" value={motifForm.name} onChange={(e) => setMotifForm({...motifForm, name: e.target.value})}
                    placeholder={isSociete ? 'Ex: Maçonnerie, Charpente bois, Électricité CFO…' : t('proDash.motifs.nomMotifPlaceholder')}
                    className="v22-form-input" />
                </div>

                {/* Description */}
                <div>
                  <label className="v22-form-label">{t('proDash.motifs.description')}</label>
                  <textarea value={motifForm.description} onChange={(e) => setMotifForm({...motifForm, description: e.target.value})}
                    rows={2} placeholder={t('proDash.motifs.descriptionPlaceholder')}
                    className="v22-form-input" style={{ resize: 'none' }} />
                </div>

                {/* Étapes — sous la description, même style que dans le devis */}
                <div style={{
                  marginTop: 8, padding: '6px 10px',
                  background: '#f3f4f6', border: '1px solid #e5e7eb',
                  borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: 0.3 }}>ÉTAPES</span>
                    {editingMotif?.id ? null : (
                      <button onClick={() => setLocalEtapes(prev => [...prev, ''])}
                        style={{ fontSize: 10, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>+ Ajouter</button>
                    )}
                  </div>
                  {editingMotif?.id ? (
                    <ServiceEtapesEditor serviceId={editingMotif.id} />
                  ) : (
                    <>
                      {localEtapes.length === 0 && (
                        <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>Aucune étape. Cliquez + Ajouter.</div>
                      )}
                      {localEtapes.map((et, i) => (
                        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', lineHeight: 1.6 }}>
                          <span style={{ color: '#999', fontSize: 11, minWidth: 16 }}>{i + 1}.</span>
                          <input type="text" value={et} placeholder="Ex: Diagnostic visuel"
                            onChange={(e) => setLocalEtapes(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                            style={{ flex: 1, fontSize: 12, color: '#555', background: 'transparent', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', padding: '2px 0' }}
                          />
                          <button onClick={() => setLocalEtapes(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#ccc' }}>✕</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="v22-form-label">
                    {t('proDash.motifs.dureeEstimee')} <span style={{ fontWeight: 400 }}>({t('proDash.motifs.dureeOptional')})</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number"
                      value={motifForm.duration_minutes}
                      onChange={(e) => setMotifForm({...motifForm, duration_minutes: e.target.value === '' ? '' : parseInt(e.target.value)})}
                      min={5} step={5}
                      placeholder="Ex: 60"
                      className="v22-form-input" style={{ width: 100 }}
                    />
                    {motifForm.duration_minutes !== '' && Number(motifForm.duration_minutes) > 0 && (
                      <span className="v22-ref">
                        = {Math.floor(Number(motifForm.duration_minutes) / 60)}h{Number(motifForm.duration_minutes) % 60 > 0 ? String(Number(motifForm.duration_minutes) % 60).padStart(2, '0') : '00'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pricing unit */}
                <div>
                  <label className="v22-form-label" style={{ marginBottom: 8 }}>{t('proDash.motifs.uniteTarification')} *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { value: 'forfait', label: `💰 ${t('proDash.motifs.forfait')}`, desc: t('proDash.motifs.forfaitDesc') },
                      { value: 'unite', label: `🔢 ${t('proDash.motifs.unite')}`, desc: t('proDash.motifs.uniteDesc') },
                      { value: 'm2', label: `📐 ${t('proDash.motifs.m2')}`, desc: t('proDash.motifs.m2Desc') },
                      { value: 'ml', label: `📏 ${t('proDash.motifs.ml')}`, desc: t('proDash.motifs.mlDesc') },
                      { value: 'm3', label: `🧊 ${t('proDash.motifs.m3')}`, desc: t('proDash.motifs.m3Desc') },
                      { value: 'heure', label: `🕐 ${t('proDash.motifs.heure')}`, desc: t('proDash.motifs.heureDesc') },
                      { value: 'kg', label: `⚖️ ${t('proDash.motifs.kg')}`, desc: t('proDash.motifs.kgDesc') },
                      { value: 'tonne', label: `♻️ ${t('proDash.motifs.tonne')}`, desc: t('proDash.motifs.tonneDesc') },
                      { value: 'lot', label: `📦 ${t('proDash.motifs.lot')}`, desc: t('proDash.motifs.lotDesc') },
                      ...(isSociete ? [
                        { value: 'jour', label: '📅 Journée', desc: 'Prix à la journée de travail (MO)' },
                        { value: 'semaine', label: '🗓️ Semaine', desc: 'Prix à la semaine (chantier)' },
                      ] : []),
                    ].map((opt) => (
                      <button key={opt.value}
                        onClick={() => setMotifForm({...motifForm, pricing_unit: opt.value})}
                        className="v22-btn"
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderColor: motifForm.pricing_unit === opt.value ? 'var(--v22-yellow)' : undefined,
                          background: motifForm.pricing_unit === opt.value ? 'var(--v22-yellow-light)' : undefined,
                        }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
                        <div className="v22-ref">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div>
                  <label className="v22-form-label">
                    {t('proDash.motifs.fourchettePrix')}{motifForm.pricing_unit !== 'forfait' ? ` (€${({ m2: '/m²', ml: '/ml', m3: '/m³', heure: '/h', unite: '/u', arbre: '/u', kg: '/kg', tonne: '/t', lot: '/lot' } as Record<string, string>)[motifForm.pricing_unit] || ''})` : ' (€)'}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="v22-form-label">{t('proDash.motifs.prixMinimum')}</label>
                      <input
                        type="number"
                        value={motifForm.price_min}
                        onChange={(e) => setMotifForm({...motifForm, price_min: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                        step="0.01" min="0" placeholder={t('proDash.motifs.surDevisPlaceholder')}
                        className="v22-form-input"
                      />
                    </div>
                    <div>
                      <label className="v22-form-label">{t('proDash.motifs.prixMaximum')}</label>
                      <input
                        type="number"
                        value={motifForm.price_max}
                        onChange={(e) => setMotifForm({...motifForm, price_max: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                        step="0.01" min="0" placeholder={t('proDash.motifs.surDevisPlaceholder')}
                        className="v22-form-input"
                      />
                    </div>
                  </div>
                  <div className="v22-ref" style={{ marginTop: 4 }}>{t('proDash.motifs.surDevisNote')}</div>
                </div>

                {/* Validation auto */}
                <div>
                  <label className="v22-form-label" style={{ marginBottom: 8 }}>{t('proDash.motifs.validationAuto')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      onClick={() => setMotifForm({...motifForm, validation_auto: false})}
                      className="v22-btn"
                      style={{
                        textAlign: 'left', padding: '8px 10px',
                        borderColor: !motifForm.validation_auto ? 'var(--v22-yellow)' : undefined,
                        background: !motifForm.validation_auto ? 'var(--v22-yellow-light)' : undefined,
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>👤 {t('proDash.motifs.validationManuelle')}</div>
                      <div className="v22-ref">{t('proDash.motifs.validationManuelleDesc')}</div>
                    </button>
                    <button
                      onClick={() => setMotifForm({...motifForm, validation_auto: true})}
                      className="v22-btn"
                      style={{
                        textAlign: 'left', padding: '8px 10px',
                        borderColor: motifForm.validation_auto ? 'var(--v22-yellow)' : undefined,
                        background: motifForm.validation_auto ? 'var(--v22-yellow-light)' : undefined,
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>⚡ {t('proDash.motifs.validationAutomatique')}</div>
                      <div className="v22-ref">{t('proDash.motifs.validationAutomatiqueDesc')}</div>
                    </button>
                  </div>
                </div>

                {/* Délai minimum */}
                <div>
                  <label className="v22-form-label" style={{ marginBottom: 8 }}>{t('proDash.motifs.delaiMinimum')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[0, 2, 4, 8, 12, 24, 48, 72].map((h) => (
                      <button key={h}
                        onClick={() => setMotifForm({...motifForm, delai_minimum_heures: h})}
                        className="v22-btn"
                        style={{
                          textAlign: 'center', padding: '8px 6px',
                          borderColor: motifForm.delai_minimum_heures === h ? 'var(--v22-yellow)' : undefined,
                          background: motifForm.delai_minimum_heures === h ? 'var(--v22-yellow-light)' : undefined,
                        }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>
                          {h === 0 ? t('proDash.motifs.delaiAucun') : h < 24 ? `${h}h` : `${h / 24}j`}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="v22-ref" style={{ marginTop: 4 }}>{t('proDash.motifs.delaiNote')}</div>
                </div>

                {/* Étapes moved above, under Description */}
              </div>
            </div>
            <div className="v22-modal-foot">
              <button onClick={() => setShowMotifModal(false)} className="v22-btn">
                {t('proDash.motifs.annuler')}
              </button>
              <button onClick={async () => {
                setSavingWithEtapes(true)
                try {
                  const etapesToSave = !editingMotif ? localEtapes.filter(e => e.trim()) : []
                  await saveMotif()
                  // Nouveau motif avec étapes → insérer après sauvegarde
                  if (etapesToSave.length > 0) {
                    try {
                      const { supabase } = await import('@/lib/supabase')
                      const { data: found } = await supabase.from('services').select('id').eq('name', motifForm.name).order('created_at', { ascending: false }).limit(1)
                      if (found?.[0]) {
                        for (let i = 0; i < etapesToSave.length; i++) {
                          await fetch('/api/service-etapes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ service_id: found[0].id, designation: etapesToSave[i], ordre: i + 1 }) })
                        }
                      }
                    } catch { /* non-bloquant */ }
                    setLocalEtapes([])
                  }
                } finally {
                  setSavingWithEtapes(false)
                }
              }} disabled={!motifForm.name || savingMotif || savingWithEtapes}
                className="v22-btn v22-btn-primary"
                style={{ opacity: (!motifForm.name || savingMotif || savingWithEtapes) ? 0.4 : 1, cursor: (!motifForm.name || savingMotif || savingWithEtapes) ? 'not-allowed' : 'pointer' }}>
                {(savingMotif || savingWithEtapes) ? t('proDash.motifs.sauvegarde') : editingMotif ? `💾 ${t('proDash.motifs.modifier')}` : t('proDash.motifs.creerLeMotif')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
