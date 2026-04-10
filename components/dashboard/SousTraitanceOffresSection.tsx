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
  sous_traitance_complete: 'Sous-traitance complète',
  renfort_equipe: 'Renfort équipe',
}

const URGENCY_BADGE_V5: Record<string, string> = {
  emergency: 'v5-badge v5-badge-red', urgent: 'v5-badge v5-badge-orange', normal: 'v5-badge v5-badge-green',
}
const URGENCY_BADGE_V22: Record<string, string> = {
  emergency: 'v22-tag v22-tag-red', urgent: 'v22-tag v22-tag-orange', normal: 'v22-tag v22-tag-green',
}

const STATUS_BADGE_V5: Record<string, string> = {
  open: 'v5-badge v5-badge-green', in_review: 'v5-badge v5-badge-orange', awarded: 'v5-badge v5-badge-blue', closed: 'v5-badge v5-badge-gray', cancelled: 'v5-badge v5-badge-red',
}
const STATUS_BADGE_V22: Record<string, string> = {
  open: 'v22-tag v22-tag-green', in_review: 'v22-tag v22-tag-orange', awarded: 'v22-tag v22-tag-blue', closed: 'v22-tag v22-tag-gray', cancelled: 'v22-tag v22-tag-red',
}

const CAND_STATUS_BADGE_V5: Record<string, string> = {
  pending: 'v5-badge v5-badge-blue', accepted: 'v5-badge v5-badge-green', rejected: 'v5-badge v5-badge-red',
}
const CAND_STATUS_BADGE_V22: Record<string, string> = {
  pending: 'v22-tag v22-tag-blue', accepted: 'v22-tag v22-tag-green', rejected: 'v22-tag v22-tag-red',
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

export default function SousTraitanceOffresSection({ artisan, orgRole }: { artisan: import('@/lib/types').Artisan; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
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
      showToast(status === 'accepted' ? 'Candidature acceptée' : 'Candidature refusée')
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
      showToast('Annonce publiée — les artisans correspondants ont été notifiés')
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
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#2E7D32' : '#C62828',
          color: '#fff', borderRadius: 6, padding: '10px 20px',
          fontWeight: 600, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ marginBottom: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{isPt ? 'Recrutar subempreiteiros' : 'Recruter sous-traitants'}</h1>
          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>{isPt ? 'Publique missões e encontre subempreiteiros qualificados' : 'Publiez vos offres et recevez des candidatures'}</p>
        </div>
        <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} onClick={() => setTab('publier')}>
          + {isPt ? 'Publicar uma oferta' : 'Publier une offre'}
        </button>
      </div>

      {/* Tabs */}
      <div className={isV5 ? 'v5-tabs' : 'v22-tabs'}>
        {[
          { key: 'annonces', label: isPt ? 'Minhas Ofertas' : 'Mes annonces', count: offers.length },
          { key: 'publier', label: isPt ? 'Publicar Oferta' : 'Publier une offre' },
          { key: 'candidats', label: isPt ? 'Candidatos' : 'Candidatures', disabled: !selectedOffer },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key as any)}
            disabled={t.disabled}
            className={isV5 ? `v5-tab-b${tab === t.key ? ' active' : ''}` : `v22-tab ${tab === t.key ? 'active' : ''}`}
            style={{ opacity: t.disabled ? 0.5 : 1 }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray'} style={{ marginLeft: 6 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: MES ANNONCES ─────────────────────────────────────────────── */}
      {tab === 'annonces' && (
        <div>
          {loading ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 48, color: '#999', fontSize: 12 }}>Chargement...</div>
          ) : offers.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 32, marginBottom: 12, color: '#BBB' }}>📭</div>
              <p style={{ color: '#999', fontSize: 12 }}>
                {isPt ? 'Nenhuma oferta publicada.' : 'Aucune annonce publiée.'}
              </p>
              <button onClick={() => setTab('publier')} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ marginTop: 12 }}>
                {isPt ? 'Publicar primeira oferta' : 'Publier ma première offre'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {offers.map(offer => (
                <div key={offer.id} className={isV5 ? 'v5-card' : 'v22-card'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span className={(isV5 ? STATUS_BADGE_V5 : STATUS_BADGE_V22)[offer.status] || 'v5-badge v5-badge-gray'}>
                          {offer.status === 'open' ? 'Ouverte' : offer.status === 'awarded' ? 'Attribuée' : offer.status}
                        </span>
                        <span className={(isV5 ? URGENCY_BADGE_V5 : URGENCY_BADGE_V22)[offer.urgency]}>
                          {offer.urgency === 'emergency' ? 'Urgence' : offer.urgency === 'urgent' ? 'Urgent' : 'Normal'}
                        </span>
                        <span className={isV5 ? 'v5-badge v5-badge-blue' : 'v22-tag v22-tag-blue'}>{MISSION_LABELS[offer.mission_type]}</span>
                        <span className={isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray'}>{metierLabel(offer.category)}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{offer.title}</div>
                      <div style={{ color: '#999', fontSize: 11 }}>
                        {offer.location_city}{offer.location_postal && ` (${offer.location_postal})`}
                        {offer.start_date && ` · Début ${new Date(offer.start_date).toLocaleDateString('fr-FR')}`}
                        {offer.duration_text && ` · ${offer.duration_text}`}
                      </div>
                      <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                        {formatBudget(offer.budget_min, offer.budget_max)}
                        {offer.nb_intervenants_souhaite && ` · ${offer.nb_intervenants_souhaite} intervenant(s)`}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span className={isV5 ? 'v5-badge v5-badge-blue' : 'v22-tag v22-tag-blue'}>{offer.candidatures_count} candidature(s)</span>
                        <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>{daysLeft(offer.deadline)} jours restants</span>
                      </div>
                    </div>
                    <button onClick={() => loadCandidatures(offer)} className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn v22-btn-primary v22-btn-sm'}>
                      Voir candidats ({offer.candidatures_count})
                    </button>
                  </div>

                  {(offer.require_rc_pro || offer.require_decennale || offer.require_qualibat) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {offer.require_rc_pro && <span className={isV5 ? 'v5-badge v5-badge-orange' : 'v22-tag v22-tag-orange'}>RC Pro exigée</span>}
                      {offer.require_decennale && <span className={isV5 ? 'v5-badge v5-badge-orange' : 'v22-tag v22-tag-orange'}>Décennale exigée</span>}
                      {offer.require_qualibat && <span className={isV5 ? 'v5-badge v5-badge-orange' : 'v22-tag v22-tag-orange'}>Qualibat exigé</span>}
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
        <div className={isV5 ? 'v5-card' : 'v22-card'}>
          <div className={isV5 ? 'v5-st' : 'v22-section-title'}>
            {isPt ? 'Nova oferta de subempreitada' : 'Nouvelle offre de sous-traitance'}
          </div>

          <div className={isV5 ? 'v5-fr' : 'v22-form-row'}>
            {/* Titre */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Titre de la mission *</label>
              <input className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="ex : Pose carrelage 120m²" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            {/* Description */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Description détaillée *</label>
              <textarea className={isV5 ? 'v5-fi' : 'v22-input'} style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Décrivez les travaux, les conditions..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Métier */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Métier recherché *</label>
              <select className={isV5 ? 'v5-fi' : 'v22-input'} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {METIERS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
              </select>
            </div>

            {/* Type de mission */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Type de mission *</label>
              <select className={isV5 ? 'v5-fi' : 'v22-input'} value={form.mission_type} onChange={e => setForm(f => ({ ...f, mission_type: e.target.value as any }))}>
                <option value="sous_traitance_complete">Sous-traitance complète</option>
                <option value="renfort_equipe">Renfort équipe</option>
              </select>
            </div>

            {/* Ville */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Ville du chantier *</label>
              <input className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="ex : Marseille" value={form.location_city}
                onChange={e => setForm(f => ({ ...f, location_city: e.target.value }))} />
            </div>

            {/* Code postal */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Code postal</label>
              <input className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="13001" value={form.location_postal}
                onChange={e => setForm(f => ({ ...f, location_postal: e.target.value }))} />
            </div>

            {/* Adresse */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Adresse du chantier</label>
              <input className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="15 rue de la Paix, Bât. A" value={form.location_address}
                onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))} />
            </div>

            {/* Dates */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Date de début souhaitée</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-input'} value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Date limite de candidature *</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-input'} value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>

            {/* Durée */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Durée estimée</label>
              <input className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="ex : 3 semaines, 1 mois..."
                value={form.duration_text} onChange={e => setForm(f => ({ ...f, duration_text: e.target.value }))} />
            </div>

            {/* Nb intervenants */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Nombre d'intervenants</label>
              <input type="number" min={1} className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="1"
                value={form.nb_intervenants_souhaite}
                onChange={e => setForm(f => ({ ...f, nb_intervenants_souhaite: e.target.value }))} />
            </div>

            {/* Budget */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Budget minimum (&euro;)</label>
              <input type="number" min={0} className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="5000"
                value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} />
            </div>
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Budget maximum (&euro;)</label>
              <input type="number" min={0} className={isV5 ? 'v5-fi' : 'v22-input'} placeholder="15000"
                value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} />
            </div>

            {/* Urgence */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Urgence</label>
              <select className={isV5 ? 'v5-fi' : 'v22-input'} value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value as any }))}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Urgence</option>
              </select>
            </div>

            {/* Exigences */}
            <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ gridColumn: '1 / -1' }}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Certifications exigées</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                {[
                  { key: 'require_rc_pro', label: 'RC Professionnelle' },
                  { key: 'require_decennale', label: 'Assurance Décennale' },
                  { key: 'require_qualibat', label: 'Certification Qualibat' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {publishError && (
            <div className={isV5 ? 'v5-al err' : 'v22-alert v22-alert-red'} style={{ marginTop: 12 }}>{publishError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setTab('annonces')} className={isV5 ? 'v5-btn' : 'v22-btn'}>Annuler</button>
            <button onClick={handlePublish} disabled={publishing} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
              {publishing ? 'Publication...' : 'Publier l\'offre'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: CANDIDATURES ────────────────────────────────────────────── */}
      {tab === 'candidats' && selectedOffer && (
        <div>
          {/* Offer recap */}
          <div className={isV5 ? 'v5-al info' : 'v22-alert v22-alert-blue'} style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedOffer.title}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  {selectedOffer.location_city} · {metierLabel(selectedOffer.category)}
                </div>
              </div>
              <button onClick={() => setTab('annonces')} className="v5-btn v5-btn-sm">
                &larr; Retour aux annonces
              </button>
            </div>
          </div>

          {candLoading ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 12 }}>Chargement des candidatures...</div>
          ) : candidatures.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 10, color: '#BBB' }}>📭</div>
              <p style={{ color: '#999', fontSize: 12 }}>Aucune candidature pour le moment.</p>
              <p style={{ color: '#BBB', fontSize: 11 }}>
                Les artisans correspondant à votre annonce ont été notifiés.
              </p>
            </div>
          ) : (
            <div className="v5-sc3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {candidatures.map(cand => (
                <div key={cand.id} className={isV5 ? 'v5-card' : 'v22-card'} style={{ borderLeft: `3px solid ${cand.status === 'accepted' ? '#2E7D32' : cand.status === 'rejected' ? '#C62828' : '#E8E8E8'}` }}>
                  {/* Artisan info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#F57C00', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 12, flexShrink: 0, overflow: 'hidden',
                    }}>
                      {cand.profile?.photo_url
                        ? <Image src={cand.profile.photo_url} alt="" width={32} height={32} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (cand.artisan_company_name || cand.profile?.company_name || '?')[0].toUpperCase()
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {cand.artisan_company_name || cand.profile?.company_name || 'Artisan'}
                      </div>
                      <div style={{ fontSize: 10, color: '#999' }}>
                        {cand.profile?.city && cand.profile.city}
                        {cand.experience_years !== undefined && ` · ${cand.experience_years} ans`}
                        {(cand.artisan_rating || cand.profile?.rating_avg) && ` · ⭐ ${(cand.artisan_rating || cand.profile?.rating_avg || 0).toFixed(1)}`}
                      </div>
                    </div>
                  </div>

                  {/* Certifs */}
                  {(cand.profile?.rc_pro_valid || cand.profile?.decennale_valid || cand.profile?.qualibat_valid) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                      {cand.profile?.rc_pro_valid && <span className="v5-badge v5-badge-green">RC Pro</span>}
                      {cand.profile?.decennale_valid && <span className="v5-badge v5-badge-green">Décennale</span>}
                      {cand.profile?.qualibat_valid && <span className="v5-badge v5-badge-green">Qualibat</span>}
                    </div>
                  )}

                  {/* Proposition */}
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                    Tarif : {cand.price.toLocaleString('fr-FR')} &euro;{cand.materials_included ? ' (matériaux inclus)' : ''}
                    {` · ${cand.timeline}`}
                    {cand.disponibilites && ` · Dispo: ${cand.disponibilites}`}
                  </div>

                  {cand.description && (
                    <p style={{ fontSize: 11, color: '#444', lineHeight: 1.4, marginBottom: 8 }}>{cand.description}</p>
                  )}

                  {/* Status + actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #E8E8E8' }}>
                    <span className={(isV5 ? CAND_STATUS_BADGE_V5 : CAND_STATUS_BADGE_V22)[cand.status]}>
                      {cand.status === 'accepted' ? 'Accepté' : cand.status === 'rejected' ? 'Refusé' : 'En attente'}
                    </span>

                    {cand.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => updateCandidatureStatus(selectedOffer.id, cand.id, 'accepted')}
                          disabled={actionLoading === cand.id}
                          className="v5-btn v5-btn-s v5-btn-sm"
                        >
                          {actionLoading === cand.id ? '...' : 'Accepter'}
                        </button>
                        <button
                          onClick={() => updateCandidatureStatus(selectedOffer.id, cand.id, 'rejected')}
                          disabled={actionLoading === cand.id}
                          className="v5-btn v5-btn-sm"
                        >
                          {actionLoading === cand.id ? '...' : 'Refuser'}
                        </button>
                      </div>
                    )}
                  </div>

                  {cand.artisan_phone && (
                    <div style={{ marginTop: 8 }}>
                      <button className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn v22-btn-primary v22-btn-sm'} onClick={() => window.open(`tel:${cand.artisan_phone}`)}>
                        Contacter
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
