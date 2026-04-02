'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Offer {
  id: string
  title: string
  description: string
  category: string
  mission_type: 'sous_traitance_complete' | 'renfort_equipe'
  location_city: string
  location_postal?: string
  budget_min?: number
  budget_max?: number
  start_date?: string
  duration_text?: string
  deadline: string
  urgency: 'normal' | 'urgent' | 'emergency'
  candidatures_count: number
  nb_intervenants_souhaite?: number
  require_rc_pro: boolean
  require_decennale: boolean
  require_qualibat: boolean
  status: string
  created_at: string
}

interface Candidature {
  id: string
  artisan_id: string
  artisan_user_id: string
  price: number
  timeline: string
  description: string
  disponibilites?: string
  experience_years?: number
  artisan_company_name?: string
  artisan_rating?: number
  artisan_phone?: string
  materials_included: boolean
  guarantee?: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  profile?: {
    company_name?: string
    rating_avg?: number
    photo_url?: string
    city?: string
    services_offered?: string[]
    rc_pro_valid?: boolean
    decennale_valid?: boolean
    qualibat_valid?: boolean
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const METIERS = [
  { id: 'maconnerie', label: 'Maçonnerie', emoji: '🧱' },
  { id: 'construcao', label: 'Construction / Gros-œuvre', emoji: '🏗️' },
  { id: 'eletricidade', label: 'Électricité', emoji: '⚡' },
  { id: 'canalizacao', label: 'Plomberie', emoji: '🔧' },
  { id: 'pintura', label: 'Peinture', emoji: '🎨' },
  { id: 'carrelage', label: 'Carrelage / Revêtements', emoji: '🪵' },
  { id: 'carpintaria', label: 'Menuiserie / Charpente', emoji: '🪚' },
  { id: 'telhados', label: 'Couverture / Toiture', emoji: '🏠' },
  { id: 'isolamento', label: 'Isolation', emoji: '🧱' },
  { id: 'renovacao', label: 'Rénovation générale', emoji: '🔨' },
  { id: 'serralharia', label: 'Serrurerie / Métallerie', emoji: '🔩' },
  { id: 'climatizacao', label: 'CVC / Climatisation', emoji: '❄️' },
  { id: 'impermeabilizacao', label: 'Étanchéité', emoji: '💧' },
  { id: 'demolition', label: 'Démolition / Terrassement', emoji: '⛏️' },
  { id: 'vrd', label: 'VRD / Réseaux', emoji: '🛤️' },
  { id: 'echafaudage', label: 'Échafaudage', emoji: '🏗️' },
  { id: 'autre', label: 'Autre', emoji: '📋' },
]

const MISSION_LABELS: Record<string, string> = {
  sous_traitance_complete: '📦 Sous-traitance complète',
  renfort_equipe: '👷 Renfort équipe',
}

const URGENCY_CLASS: Record<string, string> = {
  emergency: 'v22-tag v22-tag-red',
  urgent: 'v22-tag v22-tag-amber',
  normal: 'v22-tag v22-tag-green',
}

const STATUS_CLASS: Record<string, string> = {
  open: 'v22-tag v22-tag-green',
  in_review: 'v22-tag v22-tag-amber',
  awarded: 'v22-tag v22-tag-blue',
  closed: 'v22-tag v22-tag-gray',
  cancelled: 'v22-tag v22-tag-red',
}

const CAND_STATUS_CLASS: Record<string, string> = {
  pending: 'v22-tag v22-tag-yellow',
  accepted: 'v22-tag v22-tag-green',
  rejected: 'v22-tag v22-tag-red',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'maconnerie',
  mission_type: 'sous_traitance_complete' as const,
  location_city: '',
  location_postal: '',
  location_address: '',
  budget_min: '',
  budget_max: '',
  start_date: '',
  duration_text: '',
  deadline: '',
  urgency: 'normal' as const,
  nb_intervenants_souhaite: '',
  require_rc_pro: false,
  require_decennale: false,
  require_qualibat: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SousTraitanceOffresSection({ artisan }: { artisan: import('@/lib/types').Artisan }) {
  const isPt = typeof document !== 'undefined' && document.cookie.includes('locale=pt')

  const [tab, setTab] = useState<'annonces' | 'publier' | 'candidats'>('annonces')
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [candLoading, setCandLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Publish form
  const [form, setForm] = useState(EMPTY_FORM)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load offers ───────────────────────────────────────────────────────────
  const loadOffers = useCallback(async () => {
    if (!artisan?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/marches/sous-traitance?btp_company_id=${artisan.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOffers(data.offers || [])
    } catch {
      setOffers([])
    } finally {
      setLoading(false)
    }
  }, [artisan?.id])

  useEffect(() => {
    loadOffers()
  }, [loadOffers])

  // ── Load candidatures for a selected offer ────────────────────────────────
  const loadCandidatures = useCallback(async (offer: Offer) => {
    setSelectedOffer(offer)
    setTab('candidats')
    setCandLoading(true)
    setCandidatures([])
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(
        `/api/marches/sous-traitance?btp_company_id=${artisan.id}&offer_id=${offer.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCandidatures(data.candidatures || [])
    } catch {
      setCandidatures([])
    } finally {
      setCandLoading(false)
    }
  }, [artisan?.id])

  // ── Accept / Reject a candidature ─────────────────────────────────────────
  const updateCandidatureStatus = async (
    offerId: string,
    candId: string,
    status: 'accepted' | 'rejected'
  ) => {
    setActionLoading(candId)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`/api/marches/${offerId}/candidature/${candId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setCandidatures(prev =>
        prev.map(c => (c.id === candId ? { ...c, status } : c))
      )
      showToast(status === 'accepted' ? '✅ Candidature acceptée' : '❌ Candidature refusée')
      // Refresh offer counts
      loadOffers()
    } catch {
      showToast('Erreur lors de la mise à jour', 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Publish new offer ─────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishError('')
    if (!form.title || !form.description || !form.location_city || !form.deadline) {
      setPublishError('Renseignez les champs obligatoires : titre, description, ville, date limite.')
      return
    }

    setPublishing(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session) throw new Error('Non connecté')

      const { data: profile } = await supabase
        .from('profiles_artisan')
        .select('company_name, email, phone')
        .eq('id', artisan.id)
        .single()

      const payload = {
        btp_company_id: artisan.id,
        btp_company_name: profile?.company_name || artisan.company_name || 'Entreprise BTP',
        publisher_user_id: session.user.id,
        publisher_name: profile?.company_name || artisan.company_name || 'Entreprise BTP',
        publisher_email: profile?.email || artisan.email || session.user.email,
        publisher_phone: profile?.phone || artisan.phone || undefined,
        title: form.title,
        description: form.description,
        category: form.category,
        mission_type: form.mission_type,
        location_city: form.location_city,
        location_postal: form.location_postal || undefined,
        location_address: form.location_address || undefined,
        budget_min: form.budget_min ? parseFloat(form.budget_min) : undefined,
        budget_max: form.budget_max ? parseFloat(form.budget_max) : undefined,
        start_date: form.start_date || undefined,
        duration_text: form.duration_text || undefined,
        deadline: form.deadline,
        urgency: form.urgency,
        nb_intervenants_souhaite: form.nb_intervenants_souhaite ? parseInt(form.nb_intervenants_souhaite) : undefined,
        require_rc_pro: form.require_rc_pro,
        require_decennale: form.require_decennale,
        require_qualibat: form.require_qualibat,
        photos: [],
      }

      const res = await fetch('/api/marches/sous-traitance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur serveur')
      }

      setForm(EMPTY_FORM)
      setTab('annonces')
      await loadOffers()
      showToast('✅ Annonce publiée — les artisans correspondants ont été notifiés')
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : 'Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const metierLabel = (id: string) => {
    const m = METIERS.find(m => m.id === id)
    return m ? `${m.emoji} ${m.label}` : id
  }

  const daysLeft = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86_400_000))
  }

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return isPt ? 'Budget à définir' : 'Budget à définir'
    if (min && max) return `${min.toLocaleString('fr-FR')} – ${max.toLocaleString('fr-FR')} €`
    if (min) return `À partir de ${min.toLocaleString('fr-FR')} €`
    return `Jusqu'à ${max!.toLocaleString('fr-FR')} €`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: toast.type === 'ok' ? '#22c55e' : '#ef4444',
            color: '#fff', borderRadius: 10, padding: '12px 20px',
            fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,.18)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          🤝 {isPt ? 'Recrutamento Subempreiteiros' : 'Recrutement sous-traitants'}
        </h2>
        <p style={{ color: '#6b7280', marginTop: 6, marginBottom: 0, fontSize: 14 }}>
          {isPt
            ? 'Publique missões e encontre subempreiteiros qualificados'
            : 'Publiez vos besoins et trouvez des artisans qualifiés pour vos chantiers'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'annonces', label: isPt ? '📋 Minhas Ofertas' : '📋 Mes annonces', count: offers.length },
          { key: 'publier', label: isPt ? '➕ Publicar Oferta' : '➕ Publier une offre' },
          { key: 'candidats', label: isPt ? '👷 Candidatos' : '👷 Candidatures', disabled: !selectedOffer },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key as any)}
            disabled={t.disabled}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 13,
              background: tab === t.key ? '#FFC107' : '#f3f4f6',
              color: tab === t.key ? '#1a1a1a' : t.disabled ? '#9ca3af' : '#374151',
              opacity: t.disabled ? 0.5 : 1,
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ marginLeft: 6, background: tab === t.key ? 'rgba(0,0,0,.12)' : '#e5e7eb', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: MES ANNONCES ─────────────────────────────────────────────── */}
      {tab === 'annonces' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
          ) : offers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ color: '#6b7280', fontWeight: 500 }}>
                {isPt ? 'Nenhuma oferta publicada.' : 'Aucune annonce publiée.'}
              </p>
              <button
                onClick={() => setTab('publier')}
                style={{ marginTop: 12, padding: '10px 20px', background: '#FFC107', color: '#1a1a1a', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {isPt ? 'Publicar primeira oferta' : 'Publier ma première offre'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {offers.map(offer => (
                <div
                  key={offer.id}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span className={STATUS_CLASS[offer.status] || 'v22-tag v22-tag-gray'}>
                          {offer.status === 'open' ? '🟢 Ouverte' : offer.status === 'awarded' ? '✅ Attribuée' : offer.status}
                        </span>
                        <span className={URGENCY_CLASS[offer.urgency]}>
                          {offer.urgency === 'emergency' ? '🔴 Urgence' : offer.urgency === 'urgent' ? '🟡 Urgent' : '🟢 Normal'}
                        </span>
                        <span className="v22-tag v22-tag-blue">{MISSION_LABELS[offer.mission_type]}</span>
                        <span className="v22-tag" style={{ background: '#f3f4f6', color: '#374151' }}>
                          {metierLabel(offer.category)}
                        </span>
                      </div>
                      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{offer.title}</h3>
                      <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                        📍 {offer.location_city}{offer.location_postal && ` (${offer.location_postal})`}
                        {offer.start_date && ` · 🗓️ Début ${new Date(offer.start_date).toLocaleDateString('fr-FR')}`}
                        {offer.duration_text && ` · ⏳ ${offer.duration_text}`}
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#374151', fontSize: 13 }}>
                        💶 {formatBudget(offer.budget_min, offer.budget_max)}
                        {offer.nb_intervenants_souhaite && ` · 👷 ${offer.nb_intervenants_souhaite} intervenant(s)`}
                      </p>
                      <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
                        ⏱️ {daysLeft(offer.deadline)} jours restants · {offer.candidatures_count} candidature(s)
                      </p>
                    </div>
                    <button
                      onClick={() => loadCandidatures(offer)}
                      style={{
                        padding: '8px 16px', background: '#1a1a1a', color: '#fff',
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'opacity .15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      👷 Voir candidats ({offer.candidatures_count})
                    </button>
                  </div>

                  {/* Exigences */}
                  {(offer.require_rc_pro || offer.require_decennale || offer.require_qualibat) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {offer.require_rc_pro && <span className="v22-tag v22-tag-amber">RC Pro exigée</span>}
                      {offer.require_decennale && <span className="v22-tag v22-tag-amber">Décennale exigée</span>}
                      {offer.require_qualibat && <span className="v22-tag v22-tag-amber">Qualibat exigé</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PUBLIER UNE OFFRE ────────────────────────────────────────── */}
      {tab === 'publier' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
            {isPt ? '➕ Nova oferta de subempreitada' : '➕ Nouvelle offre de sous-traitance'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Titre */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre de la mission *</label>
              <input
                style={inputStyle}
                placeholder="ex : Pose carrelage 120m² — Résidence Les Pins"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description détaillée *</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                placeholder="Décrivez les travaux, les conditions, les accès chantier…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Métier */}
            <div>
              <label style={labelStyle}>Métier recherché *</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {METIERS.map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
                ))}
              </select>
            </div>

            {/* Type de mission */}
            <div>
              <label style={labelStyle}>Type de mission *</label>
              <select style={inputStyle} value={form.mission_type} onChange={e => setForm(f => ({ ...f, mission_type: e.target.value as any }))}>
                <option value="sous_traitance_complete">📦 Sous-traitance complète</option>
                <option value="renfort_equipe">👷 Renfort équipe</option>
              </select>
            </div>

            {/* Ville */}
            <div>
              <label style={labelStyle}>Ville du chantier *</label>
              <input
                style={inputStyle}
                placeholder="ex : Marseille"
                value={form.location_city}
                onChange={e => setForm(f => ({ ...f, location_city: e.target.value }))}
              />
            </div>

            {/* Code postal */}
            <div>
              <label style={labelStyle}>Code postal</label>
              <input
                style={inputStyle}
                placeholder="13001"
                value={form.location_postal}
                onChange={e => setForm(f => ({ ...f, location_postal: e.target.value }))}
              />
            </div>

            {/* Adresse */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Adresse du chantier</label>
              <input
                style={inputStyle}
                placeholder="15 rue de la Paix, Bât. A"
                value={form.location_address}
                onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))}
              />
            </div>

            {/* Dates */}
            <div>
              <label style={labelStyle}>Date de début souhaitée</label>
              <input
                type="date"
                style={inputStyle}
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Date limite de candidature *</label>
              <input
                type="date"
                style={inputStyle}
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {/* Durée */}
            <div>
              <label style={labelStyle}>Durée estimée</label>
              <input
                style={inputStyle}
                placeholder="ex : 3 semaines, 1 mois…"
                value={form.duration_text}
                onChange={e => setForm(f => ({ ...f, duration_text: e.target.value }))}
              />
            </div>

            {/* Nb intervenants */}
            <div>
              <label style={labelStyle}>Nombre d'intervenants souhaités</label>
              <input
                type="number"
                min={1}
                style={inputStyle}
                placeholder="1"
                value={form.nb_intervenants_souhaite}
                onChange={e => setForm(f => ({ ...f, nb_intervenants_souhaite: e.target.value }))}
              />
            </div>

            {/* Budget */}
            <div>
              <label style={labelStyle}>Budget minimum (€)</label>
              <input
                type="number"
                min={0}
                style={inputStyle}
                placeholder="5000"
                value={form.budget_min}
                onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Budget maximum (€)</label>
              <input
                type="number"
                min={0}
                style={inputStyle}
                placeholder="15000"
                value={form.budget_max}
                onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))}
              />
            </div>

            {/* Urgence */}
            <div>
              <label style={labelStyle}>Urgence</label>
              <select style={inputStyle} value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value as any }))}>
                <option value="normal">🟢 Normal</option>
                <option value="urgent">🟡 Urgent</option>
                <option value="emergency">🔴 Urgence</option>
              </select>
            </div>

            {/* Exigences */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Certifications exigées</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                {[
                  { key: 'require_rc_pro', label: 'RC Professionnelle' },
                  { key: 'require_decennale', label: 'Assurance Décennale' },
                  { key: 'require_qualibat', label: 'Certification Qualibat' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {publishError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginTop: 16, color: '#dc2626', fontSize: 14 }}>
              {publishError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setTab('annonces')}
              style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Annuler
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{
                padding: '10px 24px', background: publishing ? '#e5e7eb' : '#FFC107',
                color: '#1a1a1a', border: 'none', borderRadius: 8, cursor: publishing ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 15,
              }}
            >
              {publishing ? '⏳ Publication…' : '🚀 Publier l\'offre'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: CANDIDATURES ────────────────────────────────────────────── */}
      {tab === 'candidats' && selectedOffer && (
        <div>
          {/* Offer recap */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedOffer.title}</div>
                <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                  📍 {selectedOffer.location_city} · {metierLabel(selectedOffer.category)}
                </div>
              </div>
              <button
                onClick={() => setTab('annonces')}
                style={{ padding: '6px 14px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
              >
                ← Retour aux annonces
              </button>
            </div>
          </div>

          {candLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Chargement des candidatures…</div>
          ) : candidatures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <p style={{ color: '#6b7280' }}>Aucune candidature pour le moment.</p>
              <p style={{ color: '#9ca3af', fontSize: 13 }}>
                Les artisans correspondant à votre annonce ont été notifiés.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {candidatures.map(cand => (
                <div
                  key={cand.id}
                  style={{
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20,
                    borderLeft: `4px solid ${cand.status === 'accepted' ? '#22c55e' : cand.status === 'rejected' ? '#ef4444' : '#e5e7eb'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    {/* Artisan info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: '#1a1a1a', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 18, flexShrink: 0,
                          overflow: 'hidden',
                        }}>
                          {cand.profile?.photo_url
                            ? <Image src={cand.profile.photo_url} alt="" width={44} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (cand.artisan_company_name || cand.profile?.company_name || '?')[0].toUpperCase()
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>
                            {cand.artisan_company_name || cand.profile?.company_name || 'Artisan'}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: 13 }}>
                            {cand.profile?.city && `📍 ${cand.profile.city}`}
                            {cand.experience_years !== undefined && ` · ${cand.experience_years} ans d'expérience`}
                          </div>
                        </div>
                      </div>

                      {/* Rating */}
                      {(cand.artisan_rating || cand.profile?.rating_avg) && (
                        <div style={{ marginBottom: 6, fontSize: 13, color: '#f59e0b' }}>
                          {'★'.repeat(Math.round(cand.artisan_rating || cand.profile?.rating_avg || 0))}
                          {'☆'.repeat(5 - Math.round(cand.artisan_rating || cand.profile?.rating_avg || 0))}
                          <span style={{ color: '#6b7280', marginLeft: 6 }}>
                            {(cand.artisan_rating || cand.profile?.rating_avg || 0).toFixed(1)} / 5
                          </span>
                        </div>
                      )}

                      {/* Certifs */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {cand.profile?.rc_pro_valid && <span className="v22-tag v22-tag-green">✅ RC Pro</span>}
                        {cand.profile?.decennale_valid && <span className="v22-tag v22-tag-green">✅ Décennale</span>}
                        {cand.profile?.qualibat_valid && <span className="v22-tag v22-tag-green">✅ Qualibat</span>}
                      </div>

                      {/* Proposition */}
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, fontSize: 13 }}>
                        <div><strong>💶 Proposition :</strong> {cand.price.toLocaleString('fr-FR')} €
                          {cand.materials_included && ' (matériaux inclus)'}
                        </div>
                        <div><strong>⏳ Délai :</strong> {cand.timeline}</div>
                        {cand.disponibilites && <div><strong>📅 Disponibilités :</strong> {cand.disponibilites}</div>}
                        {cand.guarantee && <div><strong>🛡️ Garantie :</strong> {cand.guarantee}</div>}
                      </div>

                      {/* Message */}
                      <div style={{ marginTop: 10, color: '#374151', fontSize: 13, lineHeight: 1.5 }}>
                        {cand.description}
                      </div>

                      {cand.artisan_phone && (
                        <div style={{ marginTop: 8, fontSize: 13, color: '#374151', fontWeight: 600 }}>
                          📞 {cand.artisan_phone}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', minWidth: 140 }}>
                      <span className={CAND_STATUS_CLASS[cand.status]}>
                        {cand.status === 'accepted' ? '✅ Accepté' : cand.status === 'rejected' ? '❌ Refusé' : '⏳ En attente'}
                      </span>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {new Date(cand.created_at).toLocaleDateString('fr-FR')}
                      </div>

                      {cand.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                          <button
                            onClick={() => updateCandidatureStatus(selectedOffer.id, cand.id, 'accepted')}
                            disabled={actionLoading === cand.id}
                            style={{
                              padding: '8px 14px', background: '#22c55e', color: '#fff',
                              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                            }}
                          >
                            {actionLoading === cand.id ? '…' : '✅ Accepter'}
                          </button>
                          <button
                            onClick={() => updateCandidatureStatus(selectedOffer.id, cand.id, 'rejected')}
                            disabled={actionLoading === cand.id}
                            style={{
                              padding: '8px 14px', background: '#f3f4f6', color: '#374151',
                              border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            }}
                          >
                            {actionLoading === cand.id ? '…' : '❌ Refuser'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles helpers
// ─────────────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box',
  outline: 'none',
}
