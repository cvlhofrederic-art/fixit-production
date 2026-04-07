'use client'

import { useState, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Artisan, Service, Booking } from '@/lib/types'

interface InterventionAddress {
  id: string
  label: string
  address: string
}

interface ClientBooking {
  id: string
  date: string
  status: string
  price?: number
  price_ttc?: number
  service?: string
  address?: string
}

interface ClientRecord {
  id: string
  name: string
  email?: string
  phone?: string
  type?: string
  siret?: string
  mainAddress?: string
  address?: string
  mainAddressLabel?: string
  interventionAddresses?: InterventionAddress[]
  notes?: string
  source?: string
  bookings?: ClientBooking[]
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const CLIENT_TYPES = [
  { value: 'particulier', label: 'Particulier', group: 'b2c' },
  { value: 'particulier_bailleur', label: 'Propriétaire bailleur', group: 'b2c' },
  { value: 'particulier_secondaire', label: 'Résidence secondaire', group: 'b2c' },
  { value: 'professionnel', label: 'Professionnel', group: 'b2b' },
  { value: 'societe', label: 'Société / Entreprise', group: 'b2b' },
  { value: 'artisan_sous_traitant', label: 'Artisan / Sous-traitant', group: 'b2b' },
  { value: 'syndic', label: 'Syndic de copropriété', group: 'b2b' },
  { value: 'conciergerie', label: 'Conciergerie / Gestion locative', group: 'b2b' },
  { value: 'agence_immobiliere', label: 'Agence immobilière', group: 'b2b' },
  { value: 'promoteur', label: 'Promoteur immobilier', group: 'b2b' },
  { value: 'architecte', label: "Architecte / Maître d'œuvre", group: 'b2b' },
  { value: 'collectivite', label: 'Collectivité / Mairie', group: 'b2b' },
  { value: 'association', label: 'Association', group: 'b2b' },
] as const

const EMPTY_CLIENT_FORM = {
  type: 'particulier' as string,
  name: '',
  email: '',
  phone: '',
  siret: '',
  mainAddress: '',
  mainAddressLabel: 'Domicile',
  interventionAddresses: [] as { id: string; label: string; address: string }[],
  notes: '',
}

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

export default function ClientsSection({ artisan, bookings, services, onNewRdv, onNewDevis, orgRole = 'artisan' }: {
  artisan: Artisan | null
  bookings: Booking[]
  services: Service[]
  onNewRdv: (clientName: string) => void
  onNewDevis: (clientName: string) => void
  orgRole?: OrgRole
}) {
  const isSociete = orgRole === 'pro_societe'
  const isV5 = orgRole === 'pro_societe'
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const manualStorageKey = `fixit_manual_clients_${artisan?.id}`

  const [authClients, setAuthClients] = useState<ClientRecord[]>([])
  const [manualClients, setManualClients] = useState<ClientRecord[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`fixit_manual_clients_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'tous' | 'particuliers' | 'entreprises'>('tous')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState({ ...EMPTY_CLIENT_FORM })
  const [saving, setSaving] = useState(false)

  // Fetch auth clients from API
  useEffect(() => {
    if (!artisan?.id) return
    setLoading(true)
    fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      .then(r => r.json())
      .then(data => {
        setAuthClients(data.clients || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [artisan?.id])

  // Save manual clients to localStorage
  const saveManualClients = (updated: ClientRecord[]) => {
    setManualClients(updated)
    localStorage.setItem(manualStorageKey, JSON.stringify(updated))
  }

  // Merge auth + manual clients
  const allClients = [
    ...authClients,
    ...manualClients.map(c => ({ ...c, source: 'manual' })),
  ]

  const isEntreprise = (c: ClientRecord) => {
    const b2bTypes = CLIENT_TYPES.filter(t => t.group === 'b2b').map(t => t.value)
    return b2bTypes.includes(c.type as any) || Boolean(c.siret && c.siret.trim()) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  const filtered = allClients.filter(c => {
    const searchFields = [c.name, c.email, c.phone, c.mainAddress || c.address, c.siret, c.notes]
    const matchSearch = !search || searchFields.filter(Boolean).some((v: any) => String(v).toLowerCase().includes(search.toLowerCase())) // eslint-disable-line @typescript-eslint/no-explicit-any
    const matchTab =
      activeTab === 'tous' ||
      (activeTab === 'entreprises' && isEntreprise(c)) ||
      (activeTab === 'particuliers' && !isEntreprise(c))
    return matchSearch && matchTab
  })

  const totalCA = (c: ClientRecord) => {
    const clientBookings = (c.bookings || []).filter((b: ClientBooking) => b.status === 'completed')
    return clientBookings.reduce((sum: number, b: ClientBooking) => sum + (b.price || b.price_ttc || 0), 0)
  }

  const lastBookingDate = (c: ClientRecord) => {
    const bks = c.bookings || []
    if (bks.length === 0) return null
    const sorted = [...bks].sort((a: ClientBooking, b: ClientBooking) => b.date.localeCompare(a.date))
    return sorted[0].date
  }

  const particuliersCount = allClients.filter(c => !isEntreprise(c)).length
  const entreprisesCount = allClients.filter(c => isEntreprise(c)).length

  // Open modal for new client
  const openNew = () => {
    setEditingId(null)
    setClientForm({ ...EMPTY_CLIENT_FORM })
    setShowModal(true)
  }

  // Open modal for editing a manual client
  const openEdit = (c: ClientRecord) => {
    setEditingId(c.id)
    setClientForm({
      type: c.type || 'particulier',
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      siret: c.siret || '',
      mainAddress: c.mainAddress || c.address || '',
      mainAddressLabel: c.mainAddressLabel || (c.type === 'professionnel' ? 'Siège social' : 'Domicile'),
      interventionAddresses: c.interventionAddresses || [],
      notes: c.notes || '',
    })
    setShowModal(true)
  }

  const addInterventionAddress = () => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: [
        ...prev.interventionAddresses,
        { id: Date.now().toString(), label: '', address: '' },
      ],
    }))
  }

  const updateInterventionAddress = (id: string, field: 'label' | 'address', value: string) => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: prev.interventionAddresses.map(a => a.id === id ? { ...a, [field]: value } : a),
    }))
  }

  const removeInterventionAddress = (id: string) => {
    setClientForm(prev => ({
      ...prev,
      interventionAddresses: prev.interventionAddresses.filter(a => a.id !== id),
    }))
  }

  const saveClient = () => {
    if (!clientForm.name.trim()) return
    setSaving(true)
    if (editingId) {
      const updated = manualClients.map(c => c.id === editingId ? { ...c, ...clientForm } : c)
      saveManualClients(updated)
    } else {
      const newClient = { ...clientForm, id: `manual_${Date.now()}`, bookings: [] }
      saveManualClients([newClient, ...manualClients])
    }
    setShowModal(false)
    setSaving(false)
  }

  const deleteManualClient = (id: string) => {
    if (!confirm(t('proDash.clients.supprimerClient'))) return
    saveManualClients(manualClients.filter(c => c.id !== id))
  }

  // Helper: badge class by client type
  const typeBadgeClass = (c: ClientRecord) => {
    const t = (c.type || '').toLowerCase()
    if (t.includes('syndic')) return 'v5-badge v5-badge-blue'
    if (t.includes('promoteur')) return 'v5-badge v5-badge-purple'
    if (t.includes('collectivite') || t.includes('mairie')) return 'v5-badge v5-badge-green'
    if (isEntreprise(c)) return 'v5-badge v5-badge-yellow'
    return 'v5-badge v5-badge-gray'
  }

  const typeLabel = (c: ClientRecord) => {
    const ct = CLIENT_TYPES.find(ct => ct.value === c.type)
    if (ct) return ct.label
    return isEntreprise(c) ? 'B2B' : 'Particulier'
  }

  // ═══════════════════════════════════════════════════════
  // V5 RENDER — pro_societe uses the v5 design system
  // ═══════════════════════════════════════════════════════
  if (isSociete) {
    return (
      <div className="v5-fade">
        {/* Modal — reuse same modal for v5 */}
        {showModal && (
          <div className="v5-modal-ov">
            <div className="v5-modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="v5-modal-h">
                <span className="v5-modal-t">
                  {editingId ? t('proDash.clients.modifierClient') : t('proDash.clients.nouveauClient')}
                </span>
                <button className="v5-btn v5-btn-sm" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
                {/* Type */}
                <div className="v5-fg">
                  <label className="v5-fl">{t('proDash.clients.typeDeClient')}</label>
                  <select
                    value={clientForm.type}
                    onChange={e => {
                      const ct = e.target.value
                      const isB2B = CLIENT_TYPES.find(t => t.value === ct)?.group === 'b2b'
                      setClientForm(prev => ({
                        ...prev, type: ct,
                        mainAddressLabel: isB2B ? t('proDash.clients.siegeSocial') : t('proDash.clients.domicile'),
                      }))
                    }}
                    className="v5-fi"
                  >
                    <optgroup label="Particuliers (B2C)">
                      {CLIENT_TYPES.filter(ct => ct.group === 'b2c').map(ct => (
                        <option key={ct.value} value={ct.value}>{ct.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Professionnels (B2B)">
                      {CLIENT_TYPES.filter(ct => ct.group === 'b2b').map(ct => (
                        <option key={ct.value} value={ct.value}>{ct.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {/* Name */}
                <div className="v5-fg">
                  <label className="v5-fl">
                    {clientForm.type === 'professionnel' ? `${t('proDash.clients.raisonSociale')} *` : `${t('proDash.clients.nomComplet')} *`}
                  </label>
                  <input
                    type="text" value={clientForm.name}
                    onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={clientForm.type === 'professionnel' ? 'AJA Associés, Groupe Martin...' : 'Jean Dupont'}
                    className="v5-fi"
                  />
                </div>
                {/* Phone + Email */}
                <div className="v5-fr">
                  <div className="v5-fg">
                    <label className="v5-fl">{t('proDash.clients.telephone')}</label>
                    <input type="tel" value={clientForm.phone} onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="06 00 00 00 00" className="v5-fi" />
                  </div>
                  <div className="v5-fg">
                    <label className="v5-fl">{t('proDash.clients.email')}</label>
                    <input type="email" value={clientForm.email} onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))} placeholder="contact@exemple.fr" className="v5-fi" />
                  </div>
                </div>
                {/* SIRET for pro */}
                {clientForm.type === 'professionnel' && (
                  <div className="v5-fg">
                    <label className="v5-fl">{t('proDash.clients.siret')}</label>
                    <input type="text" value={clientForm.siret} onChange={e => setClientForm(prev => ({ ...prev, siret: e.target.value }))} placeholder="123 456 789 00012" className="v5-fi" />
                  </div>
                )}
                {/* Main address */}
                <div className="v5-fg">
                  <label className="v5-fl">{clientForm.mainAddressLabel} ({t('proDash.clients.adressePrincipale')})</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={clientForm.mainAddressLabel} onChange={e => setClientForm(prev => ({ ...prev, mainAddressLabel: e.target.value }))} className="v5-fi" style={{ flexShrink: 0, width: 'auto' }}>
                      {clientForm.type === 'particulier'
                        ? [t('proDash.clients.domicile'), t('proDash.clients.residencePrincipale'), t('proDash.clients.appartement'), t('proDash.clients.maison'), t('proDash.clients.autre')].map(l => <option key={l}>{l}</option>)
                        : [t('proDash.clients.siegeSocial'), t('proDash.clients.bureauPrincipal'), t('proDash.clients.autre')].map(l => <option key={l}>{l}</option>)}
                    </select>
                    <input type="text" value={clientForm.mainAddress} onChange={e => setClientForm(prev => ({ ...prev, mainAddress: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" className="v5-fi" style={{ flex: 1 }} />
                  </div>
                </div>
                {/* Intervention addresses */}
                <div className="v5-fg">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="v5-fl" style={{ margin: 0 }}>
                      {t('proDash.clients.lieuxIntervention')}
                      <span style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({clientForm.type === 'professionnel' ? t('proDash.clients.lotsResidencesSites') : t('proDash.clients.autresAdresses')})
                      </span>
                    </label>
                    <button onClick={addInterventionAddress} className="v5-btn v5-btn-sm">
                      {t('proDash.clients.ajouterLieu')}
                    </button>
                  </div>
                  {clientForm.interventionAddresses.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>
                      {clientForm.type === 'professionnel' ? t('proDash.clients.exempleProLieux') : t('proDash.clients.exemplePartLieux')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clientForm.interventionAddresses.map((addr) => (
                        <div key={addr.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <input type="text" value={addr.label} onChange={e => updateInterventionAddress(addr.id, 'label', e.target.value)} placeholder={clientForm.type === 'professionnel' ? t('proDash.clients.exempleProLabel') : t('proDash.clients.exemplePartLabel')} className="v5-fi" style={{ width: 140, flexShrink: 0 }} />
                          <input type="text" value={addr.address} onChange={e => updateInterventionAddress(addr.id, 'address', e.target.value)} placeholder={t('proDash.clients.adresseComplete')} className="v5-fi" style={{ flex: 1 }} />
                          <button onClick={() => removeInterventionAddress(addr.id)} className="v5-btn v5-btn-sm v5-btn-d">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Notes */}
                <div className="v5-fg">
                  <label className="v5-fl">{t('proDash.clients.notesInternes')}</label>
                  <textarea value={clientForm.notes} onChange={e => setClientForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder={t('proDash.clients.notesPlaceholder')} className="v5-fi" style={{ resize: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid #E8E8E8' }}>
                <button onClick={() => setShowModal(false)} className="v5-btn">{t('proDash.clients.annuler')}</button>
                <button onClick={saveClient} disabled={!clientForm.name.trim() || saving} className="v5-btn v5-btn-p" style={{ opacity: (!clientForm.name.trim() || saving) ? 0.5 : 1 }}>
                  {saving ? t('proDash.clients.sauvegardeEncours') : editingId ? t('proDash.motifs.modifier') : t('proDash.clients.creerClient')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page title */}
        <div className="v5-pg-t">
          <h1>Base clients</h1>
          <p>Ma&icirc;tres d&apos;ouvrage, syndics, architectes</p>
        </div>

        {/* Search + new */}
        <div className="v5-search">
          <input
            className="v5-search-in"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="v5-filter-sel" value={activeTab} onChange={e => setActiveTab(e.target.value as typeof activeTab)}>
            <option value="tous">Tous ({allClients.length})</option>
            <option value="particuliers">B2C ({particuliersCount})</option>
            <option value="entreprises">B2B ({entreprisesCount})</option>
          </select>
          <button className="v5-btn v5-btn-p" onClick={openNew}>+ Nouveau client</button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999', fontSize: 13 }}>
            <p>{t('proDash.clients.chargement')}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              {search ? t('proDash.clients.aucunResultat') : t('proDash.clients.pasEncoreClients')}
            </div>
            {!search && (
              <button onClick={openNew} className="v5-btn v5-btn-p">+ {t('proDash.clients.creerPremierClient')}</button>
            )}
          </div>
        )}

        {/* Clients table */}
        {!loading && filtered.length > 0 && (
          <div className="v5-card" style={{ overflowX: 'auto' }}>
            <table className="v5-dt">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Chantiers</th>
                  <th>CA cumul&eacute;</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const ca = totalCA(c)
                  const bks = c.bookings || []
                  const isManual = c.source === 'manual'
                  return (
                    <tr key={c.id} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><span className={typeBadgeClass(c)}>{typeLabel(c)}</span></td>
                      <td style={{ fontSize: 11, color: '#444' }}>{c.phone || c.email || '\u2014'}</td>
                      <td>{bks.length}</td>
                      <td>{ca > 0 ? `${ca.toLocaleString('fr-FR')} \u20AC` : '\u2014'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="v5-btn v5-btn-sm" onClick={e => { e.stopPropagation(); onNewDevis(c.name) }}>Devis</button>
                          {isManual && (
                            <>
                              <button className="v5-btn v5-btn-sm" onClick={e => { e.stopPropagation(); openEdit(c) }}>Modifier</button>
                              <button className="v5-btn v5-btn-sm v5-btn-d" onClick={e => { e.stopPropagation(); deleteManualClient(c.id) }}>Suppr.</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded detail panel */}
        {expandedId && (() => {
          const c = filtered.find(cl => cl.id === expandedId)
          if (!c) return null
          const isExp = isEntreprise(c)
          const ca = totalCA(c)
          const bks = c.bookings || []
          const isManual = c.source === 'manual'

          return (
            <div className="v5-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #E8E8E8' }}>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{c.name}</span>
                <span className={typeBadgeClass(c)}>{typeLabel(c)}</span>
                {c.source === 'auth' && <span className="v5-badge v5-badge-green">{t('proDash.clients.compteFix')}</span>}
                {isManual && <span className="v5-badge v5-badge-gray">{t('proDash.clients.ajouteManuellement')}</span>}
                <button onClick={() => setExpandedId(null)} className="v5-btn v5-btn-sm">✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '16px' }}>
                {/* Contact info */}
                <div>
                  <div className="v5-st">{t('proDash.clients.coordonnees')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    {c.phone && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#999', width: 70, flexShrink: 0 }}>{t('proDash.clients.telephone')}</span><a href={`tel:${c.phone}`} style={{ color: '#1a1a1a' }}>{c.phone}</a></div>}
                    {c.email && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#999', width: 70, flexShrink: 0 }}>{t('proDash.clients.email')}</span><a href={`mailto:${c.email}`} style={{ color: '#1a1a1a' }}>{c.email}</a></div>}
                    {(c.mainAddress || c.address) && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#999', width: 70, flexShrink: 0 }}>{c.mainAddressLabel || t('proDash.clients.adresse')}</span><span>{c.mainAddress || c.address}</span></div>}
                    {c.siret && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#999', width: 70, flexShrink: 0 }}>{t('proDash.clients.siret')}</span><span>{c.siret}</span></div>}
                    {c.notes && <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#999', width: 70, flexShrink: 0 }}>{t('proDash.clients.notes')}</span><span style={{ color: '#666', fontStyle: 'italic', fontSize: 11 }}>{c.notes}</span></div>}
                  </div>
                  {/* Intervention addresses */}
                  {c.interventionAddresses && c.interventionAddresses.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="v5-st">{t('proDash.clients.lieuxIntervention')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.interventionAddresses.map((addr: InterventionAddress) => (
                          <div key={addr.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 8px', background: '#FAFAFA', borderRadius: 4, border: '1px solid #E8E8E8' }}>
                            <span style={{ fontWeight: 500, color: '#F57C00', flexShrink: 0, minWidth: 70 }}>{addr.label || t('proDash.clients.lieu')}</span>
                            <span style={{ color: '#666' }}>{addr.address}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                    <button onClick={() => onNewRdv(c.name)} className="v5-btn v5-btn-p">{t('proDash.clients.rdv')}</button>
                    <button onClick={() => onNewDevis(c.name)} className="v5-btn">Devis</button>
                    {isManual && (
                      <>
                        <button onClick={() => openEdit(c)} className="v5-btn v5-btn-sm">{t('proDash.motifs.modifier') || 'Modifier'}</button>
                        <button onClick={() => deleteManualClient(c.id)} className="v5-btn v5-btn-sm v5-btn-d">{t('proDash.clients.supprimerClient') || 'Supprimer'}</button>
                      </>
                    )}
                  </div>
                </div>
                {/* Booking history */}
                <div>
                  <div className="v5-st">{t('proDash.clients.historique')} ({bks.length})</div>
                  {bks.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>{t('proDash.clients.aucuneIntervention')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                      {[...bks].sort((a: ClientBooking, b: ClientBooking) => b.date.localeCompare(a.date)).map((bk: ClientBooking) => (
                        <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 8px', background: '#FAFAFA', border: '1px solid #E8E8E8', borderRadius: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: bk.status === 'completed' ? '#4CAF50' : bk.status === 'confirmed' ? '#42A5F5' : bk.status === 'cancelled' ? '#E53935' : '#FFA726' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.service || 'Intervention'}</div>
                            <div style={{ fontSize: 10, color: '#999' }}>{new Date(bk.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          </div>
                          <span className={`v5-badge ${bk.status === 'completed' ? 'v5-badge-green' : bk.status === 'confirmed' ? 'v5-badge-blue' : bk.status === 'cancelled' ? 'v5-badge-red' : 'v5-badge-orange'}`}>
                            {bk.status === 'completed' ? t('proDash.clients.termine') : bk.status === 'confirmed' ? t('proDash.clients.confirme') : bk.status === 'cancelled' ? t('proDash.clients.annuleStat') : t('proDash.clients.enAttente')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E8E8E8', display: 'flex', gap: 24, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{ca > 0 ? `${ca.toLocaleString('fr-FR')} \u20AC` : '\u2014'}</div>
                      <div style={{ color: '#999', fontSize: 11 }}>{t('proDash.clients.caTotal')}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{bks.length}</div>
                      <div style={{ color: '#999', fontSize: 11 }}>{bks.length > 1 ? t('proDash.clients.interventions') : t('proDash.clients.intervention')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <div>
      {/* Modal — Create/Edit client */}
      {showModal && (
        <div className="v22-modal-overlay">
          <div className="v22-modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-modal-head">
              <span className="v22-card-title">
                {editingId ? t('proDash.clients.modifierClient') : t('proDash.clients.nouveauClient')}
              </span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Type client dropdown */}
              <div>
                <label className="v22-form-label">{t('proDash.clients.typeDeClient')}</label>
                <select
                  value={clientForm.type}
                  onChange={e => {
                    const ct = e.target.value
                    const isB2B = CLIENT_TYPES.find(t => t.value === ct)?.group === 'b2b'
                    setClientForm(prev => ({
                      ...prev,
                      type: ct,
                      mainAddressLabel: isB2B ? t('proDash.clients.siegeSocial') : t('proDash.clients.domicile'),
                    }))
                  }}
                  className="v22-form-input"
                >
                  <optgroup label="Particuliers (B2C)">
                    {CLIENT_TYPES.filter(ct => ct.group === 'b2c').map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Professionnels (B2B)">
                    {CLIENT_TYPES.filter(ct => ct.group === 'b2b').map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="v22-form-label">
                  {clientForm.type === 'professionnel' ? `${t('proDash.clients.raisonSociale')} *` : `${t('proDash.clients.nomComplet')} *`}
                </label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={e => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={clientForm.type === 'professionnel' ? 'AJA Associés, Groupe Martin...' : 'Jean Dupont'}
                  className="v22-form-input"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Phone + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="v22-form-label">{t('proDash.clients.telephone')}</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="06 00 00 00 00"
                    className="v22-form-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="v22-form-label">{t('proDash.clients.email')}</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@exemple.fr"
                    className="v22-form-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* SIRET for pro */}
              {clientForm.type === 'professionnel' && (
                <div>
                  <label className="v22-form-label">{t('proDash.clients.siret')}</label>
                  <input
                    type="text"
                    value={clientForm.siret}
                    onChange={e => setClientForm(prev => ({ ...prev, siret: e.target.value }))}
                    placeholder="123 456 789 00012"
                    className="v22-form-input v22-mono"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Main address */}
              <div>
                <label className="v22-form-label">
                  {clientForm.mainAddressLabel} <span style={{ fontWeight: 400 }}>({t('proDash.clients.adressePrincipale')})</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={clientForm.mainAddressLabel}
                    onChange={e => setClientForm(prev => ({ ...prev, mainAddressLabel: e.target.value }))}
                    className="v22-form-input"
                    style={{ flexShrink: 0, width: 'auto' }}
                  >
                    {clientForm.type === 'particulier'
                      ? [t('proDash.clients.domicile'), t('proDash.clients.residencePrincipale'), t('proDash.clients.appartement'), t('proDash.clients.maison'), t('proDash.clients.autre')].map(l => <option key={l}>{l}</option>)
                      : [t('proDash.clients.siegeSocial'), t('proDash.clients.bureauPrincipal'), t('proDash.clients.autre')].map(l => <option key={l}>{l}</option>)}
                  </select>
                  <input
                    type="text"
                    value={clientForm.mainAddress}
                    onChange={e => setClientForm(prev => ({ ...prev, mainAddress: e.target.value }))}
                    placeholder="12 rue de la Paix, 75001 Paris"
                    className="v22-form-input"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              {/* Intervention addresses */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="v22-form-label" style={{ margin: 0 }}>
                    {t('proDash.clients.lieuxIntervention')}
                    <span style={{ fontWeight: 400, marginLeft: 4 }}>
                      ({clientForm.type === 'professionnel' ? t('proDash.clients.lotsResidencesSites') : t('proDash.clients.autresAdresses')})
                    </span>
                  </label>
                  <button onClick={addInterventionAddress} className="v22-btn v22-btn-sm">
                    {t('proDash.clients.ajouterLieu')}
                  </button>
                </div>

                {clientForm.interventionAddresses.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
                    {clientForm.type === 'professionnel'
                      ? t('proDash.clients.exempleProLieux')
                      : t('proDash.clients.exemplePartLieux')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {clientForm.interventionAddresses.map((addr) => (
                      <div key={addr.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <input
                          type="text"
                          value={addr.label}
                          onChange={e => updateInterventionAddress(addr.id, 'label', e.target.value)}
                          placeholder={clientForm.type === 'professionnel' ? t('proDash.clients.exempleProLabel') : t('proDash.clients.exemplePartLabel')}
                          className="v22-form-input"
                          style={{ width: 140, flexShrink: 0 }}
                        />
                        <input
                          type="text"
                          value={addr.address}
                          onChange={e => updateInterventionAddress(addr.id, 'address', e.target.value)}
                          placeholder={t('proDash.clients.adresseComplete')}
                          className="v22-form-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={() => removeInterventionAddress(addr.id)}
                          className="v22-btn v22-btn-sm"
                          style={{ color: 'var(--v22-red)', flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="v22-form-label">{t('proDash.clients.notesInternes')}</label>
                <textarea
                  value={clientForm.notes}
                  onChange={e => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder={t('proDash.clients.notesPlaceholder')}
                  className="v22-form-input"
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>
            </div>

            <div className="v22-modal-foot">
              <button onClick={() => setShowModal(false)} className="v22-btn" style={{ flex: 1 }}>
                {t('proDash.clients.annuler')}
              </button>
              <button
                onClick={saveClient}
                disabled={!clientForm.name.trim() || saving}
                className="v22-btn v22-btn-primary"
                style={{ flex: 1, opacity: (!clientForm.name.trim() || saving) ? 0.5 : 1 }}
              >
                {saving ? t('proDash.clients.sauvegardeEncours') : editingId ? t('proDash.motifs.modifier') : t('proDash.clients.creerClient')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="v22-page-header">
        <div>
          <div className="v22-page-title">{t('proDash.clients.title')}</div>
          <div className="v22-page-sub">{t('proDash.clients.subtitle')}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="v22-tag v22-tag-gray">{allClients.length} {allClients.length > 1 ? t('proDash.clients.clients') : t('proDash.clients.client')}</span>
          <button onClick={openNew} className="v22-btn v22-btn-primary">+ {t('proDash.clients.nouveauClient')}</button>
        </div>
      </div>

      {/* Search + Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={t('proDash.clients.rechercherPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="v22-form-input"
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tous', 'particuliers', 'entreprises'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`v22-btn v22-btn-sm ${activeTab === tab ? 'v22-btn-primary' : ''}`}
            >
              {tab === 'tous' ? `${t('proDash.clients.tous')} (${allClients.length})` : tab === 'particuliers' ? `B2C (${particuliersCount})` : `B2B (${entreprisesCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--v22-text-muted)', fontSize: 13 }}>
          <p>{t('proDash.clients.chargement')}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 13, color: 'var(--v22-text-mid)', marginBottom: 8 }}>
            {search ? t('proDash.clients.aucunResultat') : t('proDash.clients.pasEncoreClients')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 16 }}>
            {search ? t('proDash.clients.essayerAutreTerme') : t('proDash.clients.clientsApparaitront')}
          </div>
          {!search && (
            <button onClick={openNew} className="v22-btn v22-btn-primary">
              + {t('proDash.clients.creerPremierClient')}
            </button>
          )}
        </div>
      )}

      {/* Clients table */}
      {!loading && filtered.length > 0 && (
        <div className="v22-card">
          <div className="v22-card-head">
            <span className="v22-card-title">{t('proDash.clients.title')}</span>
            <span className="v22-card-meta">{filtered.length} {filtered.length > 1 ? t('proDash.clients.clients') : t('proDash.clients.client')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>{t('proDash.clients.ville') || 'Ville'}</th>
                <th>{t('proDash.clients.interventions') || 'Interventions'}</th>
                <th style={{ textAlign: 'right' }}>{t('proDash.clients.caTotal') || 'CA total'}</th>
                <th>{t('proDash.clients.dernierContact') || 'Dernier contact'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const isExp = isEntreprise(c)
                const ca = totalCA(c)
                const lastDate = lastBookingDate(c)
                const bks = c.bookings || []
                const isExpanded = expandedId === c.id
                const isManual = c.source === 'manual'
                const hasInterventionAddresses = c.interventionAddresses && c.interventionAddresses.length > 0
                const city = (c.mainAddress || c.address || '').split(',').pop()?.trim() || ''

                return (
                  <tr key={c.id} onClick={() => setExpandedId(isExpanded ? null : c.id)} style={isExpanded ? { background: 'var(--v22-bg)' } : undefined}>
                    <td>
                      <span className="v22-client-name">{c.name}</span>
                      {c.phone && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{c.phone}</div>}
                    </td>
                    <td>
                      <span className={`v22-tag ${isExp ? 'v22-tag-yellow' : 'v22-tag-gray'}`}>
                        {isExp ? 'B2B' : 'B2C'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--v22-text-mid)' }}>{city || '—'}</td>
                    <td style={{ fontSize: 12 }}>{bks.length}</td>
                    <td className="v22-amount">{ca > 0 ? `${ca.toFixed(0)} €` : '—'}</td>
                    <td>
                      {lastDate
                        ? <span className="v22-ref">{new Date(lastDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</span>
                        : <span className="v22-ref">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded detail panel */}
      {expandedId && (() => {
        const c = filtered.find(cl => cl.id === expandedId)
        if (!c) return null
        const isExp = isEntreprise(c)
        const ca = totalCA(c)
        const bks = c.bookings || []
        const isManual = c.source === 'manual'
        const hasInterventionAddresses = c.interventionAddresses && c.interventionAddresses.length > 0

        return (
          <div className="v22-card" style={{ marginTop: 12 }}>
            <div className="v22-card-head">
              <span className="v22-card-title">{c.name}</span>
              <span className={`v22-tag ${isExp ? 'v22-tag-yellow' : 'v22-tag-gray'}`}>
                {isExp ? t('proDash.clients.professionnelType') : t('proDash.clients.particulierType')}
              </span>
              {c.source === 'auth' && <span className="v22-tag v22-tag-green">{t('proDash.clients.compteFix')}</span>}
              {isManual && <span className="v22-tag v22-tag-gray">{t('proDash.clients.ajouteManuellement')}</span>}
              <button onClick={() => setExpandedId(null)} className="v22-btn v22-btn-sm" style={{ marginLeft: 'auto' }}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Contact info + addresses */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--v22-text-muted)', marginBottom: 10 }}>
                  {t('proDash.clients.coordonnees')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  {c.phone && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--v22-text-muted)', width: 70, flexShrink: 0 }}>{t('proDash.clients.telephone')}</span>
                      <a href={`tel:${c.phone}`} style={{ color: 'var(--v22-text)' }}>{c.phone}</a>
                    </div>
                  )}
                  {c.email && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--v22-text-muted)', width: 70, flexShrink: 0 }}>{t('proDash.clients.email')}</span>
                      <a href={`mailto:${c.email}`} style={{ color: 'var(--v22-text)' }}>{c.email}</a>
                    </div>
                  )}
                  {(c.mainAddress || c.address) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--v22-text-muted)', width: 70, flexShrink: 0 }}>{c.mainAddressLabel || t('proDash.clients.adresse')}</span>
                      <span>{c.mainAddress || c.address}</span>
                    </div>
                  )}
                  {c.siret && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--v22-text-muted)', width: 70, flexShrink: 0 }}>{t('proDash.clients.siret')}</span>
                      <span className="v22-mono">{c.siret}</span>
                    </div>
                  )}
                  {c.notes && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--v22-text-muted)', width: 70, flexShrink: 0 }}>{t('proDash.clients.notes')}</span>
                      <span style={{ color: 'var(--v22-text-mid)', fontStyle: 'italic', fontSize: 11 }}>{c.notes}</span>
                    </div>
                  )}
                </div>

                {/* Intervention addresses */}
                {hasInterventionAddresses && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--v22-text-muted)', marginBottom: 8 }}>
                      {t('proDash.clients.lieuxIntervention')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(c.interventionAddresses || []).map((addr: InterventionAddress) => (
                        <div key={addr.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 8px', background: 'var(--v22-bg)', borderRadius: 4, border: '1px solid var(--v22-border)' }}>
                          <span style={{ fontWeight: 500, color: 'var(--v22-amber)', flexShrink: 0, minWidth: 70 }}>{addr.label || t('proDash.clients.lieu')}</span>
                          <span style={{ color: 'var(--v22-text-mid)' }}>{addr.address}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button onClick={() => onNewRdv(c.name)} className="v22-btn v22-btn-primary">
                    {t('proDash.clients.rdv')}
                  </button>
                  <button onClick={() => onNewDevis(c.name)} className="v22-btn">
                    {t('proDash.devis.title')}
                  </button>
                  {isManual && (
                    <>
                      <button onClick={() => openEdit(c)} className="v22-btn v22-btn-sm">
                        {t('proDash.motifs.modifier') || 'Modifier'}
                      </button>
                      <button
                        onClick={() => deleteManualClient(c.id)}
                        className="v22-btn v22-btn-sm"
                        style={{ color: 'var(--v22-red)' }}
                      >
                        {t('proDash.clients.supprimerClient') || 'Supprimer'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Booking history */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--v22-text-muted)', marginBottom: 10 }}>
                  {t('proDash.clients.historique')} ({bks.length})
                </div>
                {bks.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>{t('proDash.clients.aucuneIntervention')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {[...bks].sort((a: ClientBooking, b: ClientBooking) => b.date.localeCompare(a.date)).map((bk: ClientBooking) => (
                      <div key={bk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 8px', background: 'var(--v22-surface)', border: '1px solid var(--v22-border)', borderRadius: 4 }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: bk.status === 'completed' ? 'var(--v22-green)' : bk.status === 'confirmed' ? '#2563eb' : bk.status === 'cancelled' ? 'var(--v22-red)' : 'var(--v22-amber)'
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.service || 'Intervention'}</div>
                          {bk.address && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.address}</div>}
                          <div className="v22-ref">{new Date(bk.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                        <span className={`v22-tag ${bk.status === 'completed' ? 'v22-tag-green' : bk.status === 'confirmed' ? 'v22-tag-gray' : bk.status === 'cancelled' ? 'v22-tag-red' : 'v22-tag-amber'}`}>
                          {bk.status === 'completed' ? t('proDash.clients.termine') : bk.status === 'confirmed' ? t('proDash.clients.confirme') : bk.status === 'cancelled' ? t('proDash.clients.annuleStat') : t('proDash.clients.enAttente')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--v22-border)', display: 'flex', gap: 24, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }} className="v22-amount">{ca > 0 ? `${ca.toFixed(0)} €` : '—'}</div>
                    <div style={{ color: 'var(--v22-text-muted)', fontSize: 11 }}>{t('proDash.clients.caTotal')}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{bks.length}</div>
                    <div style={{ color: 'var(--v22-text-muted)', fontSize: 11 }}>{bks.length > 1 ? t('proDash.clients.interventions') : t('proDash.clients.intervention')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
