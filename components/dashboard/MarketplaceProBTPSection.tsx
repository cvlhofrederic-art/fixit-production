'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'
import {
  MARKETPLACE_CATEGORIES,
  type MarketplaceListing,
  type MarketplaceDemande,
  type MarketplaceCategorieId,
  type TypeAnnonce,
  type EtatMateriel,
  type CreateListingPayload,
} from '@/lib/marketplace-btp-types'
import { PlusCircle, Pencil, Trash2, Search, ShoppingCart, Package, BarChart3, Tag, Eye, MapPin, Phone, Mail, AlertTriangle, ChevronDown, Camera, Check, Send, Clock, Pause, Play, X, Lock, DollarSign, Calendar, Euro } from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtEur(v: number, locale: string) {
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
function daysAgo(d: string, isPt: boolean) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (diff === 0) return isPt ? 'hoje' : "aujourd'hui"
  if (diff === 1) return isPt ? 'ontem' : 'hier'
  return isPt ? `há ${diff} dias` : `il y a ${diff} j`
}
function getCat(id: string, isPt: boolean) {
  const c = MARKETPLACE_CATEGORIES.find(c => c.id === id)
  return c ? `${c.emoji} ${isPt ? c.labelPt : c.labelFr}` : id
}
function etatLabel(e: string, isPt: boolean) {
  const map: Record<string, { fr: string; pt: string }> = {
    neuf: { fr: 'Neuf', pt: 'Novo' },
    bon: { fr: 'Bon état', pt: 'Bom estado' },
    correct: { fr: 'État correct', pt: 'Estado razoável' },
    use: { fr: 'Usé', pt: 'Usado' },
  }
  return isPt ? (map[e]?.pt ?? e) : (map[e]?.fr ?? e)
}
function etatColor(e: string) {
  return { neuf: '#22c55e', bon: '#3b82f6', correct: '#eab308', use: '#f97316' }[e] ?? '#888'
}
function typeLabel(t: string, isPt: boolean) {
  if (t === 'vente') return isPt ? 'Venda' : 'Vente'
  if (t === 'location') return isPt ? 'Aluguer' : 'Location'
  return isPt ? 'Venda/Aluguer' : 'Vente/Location'
}

const ETAT_OPTIONS: EtatMateriel[] = ['neuf', 'bon', 'correct', 'use']

// ─── EMPTY STATES ─────────────────────────────────────────────────────────────
function EmptyState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--v22-text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}><Package size={40} strokeWidth={1.5} /></div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v22-text)', marginBottom: 4 }}>{text}</div>
      {sub && <div style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

// ─── LISTING CARD ─────────────────────────────────────────────────────────────
function ListingCard({ listing, isPt, onContact, isOwn }: {
  listing: MarketplaceListing; isPt: boolean; onContact?: () => void; isOwn?: boolean
}) {
  const firstPhoto = listing.photos?.[0]
  return (
    <div className="v22-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo */}
      <div style={{
        height: 130, background: firstPhoto ? `url(${firstPhoto}) center/cover` : 'var(--v22-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, borderBottom: '1px solid var(--v22-border)',
      }}>
        {!firstPhoto && (MARKETPLACE_CATEGORIES.find(c => c.id === listing.categorie)?.emoji ?? <Package size={36} />)}
      </div>
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Titre + état */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v22-text)', lineHeight: 1.3 }}>{listing.title}</div>
          <span style={{ fontSize: 9, fontWeight: 700, color: etatColor(listing.etat), border: `1px solid ${etatColor(listing.etat)}`, borderRadius: 3, padding: '2px 5px', flexShrink: 0 }}>
            {etatLabel(listing.etat, isPt).toUpperCase()}
          </span>
        </div>
        {/* Catégorie + type */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="v22-tag" style={{ fontSize: 10 }}>{getCat(listing.categorie, isPt)}</span>
          <span className="v22-tag v22-tag-yellow" style={{ fontSize: 10 }}>{typeLabel(listing.type_annonce, isPt)}</span>
        </div>
        {/* Prix */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v22-yellow)' }}>
          {listing.prix_vente && <span>{fmtEur(listing.prix_vente, isPt ? 'pt' : 'fr')}{isPt ? ' (venda)' : ' (vente)'}</span>}
          {listing.prix_vente && listing.prix_location_jour && <span> · </span>}
          {listing.prix_location_jour && <span>{fmtEur(listing.prix_location_jour, isPt ? 'pt' : 'fr')}/{isPt ? 'dia' : 'jour'}</span>}
          {!listing.prix_vente && !listing.prix_location_jour && <span style={{ color: 'var(--v22-text-muted)', fontWeight: 400 }}>{isPt ? 'Preço a negociar' : 'Prix à négocier'}</span>}
        </div>
        {/* Localisation + marque */}
        <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
          {listing.localisation && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {listing.localisation}</span>}
          {listing.marque && <span> · {listing.marque}{listing.modele ? ` ${listing.modele}` : ''}</span>}
          {listing.annee && <span> · {listing.annee}</span>}
        </div>
        {/* Date + vues */}
        <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--v22-border)' }}>
          <span>{daysAgo(listing.created_at, isPt)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={11} /> {listing.vues}</span>
        </div>
        {/* CTA */}
        {!isOwn && onContact && (
          <button onClick={onContact} className="v22-btn v22-btn-primary" style={{ marginTop: 6, width: '100%', fontSize: 12, padding: '7px 0' }}>
            <Send size={12} /> {isPt ? 'Contactar vendedor' : 'Contacter le vendeur'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MODAL DEMANDE ─────────────────────────────────────────────────────────────
function DemandeModal({ listing, isPt, onClose, onSubmit }: {
  listing: MarketplaceListing; isPt: boolean; onClose: () => void; onSubmit: (d: Partial<MarketplaceDemande>) => void
}) {
  const [type, setType] = useState<'achat' | 'location'>(listing.type_annonce === 'vente' ? 'achat' : 'location')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [message, setMessage] = useState('')
  const [prixPropose, setPrixPropose] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await onSubmit({ type_demande: type, date_debut: dateDebut || undefined, date_fin: dateFin || undefined, message, prix_propose: prixPropose ? parseFloat(prixPropose) : undefined })
    setLoading(false)
  }

  return (
    <div className="v22-modal-overlay">
      <div className="v22-modal" style={{ maxWidth: 520 }}>
        <div className="v22-modal-head">
          <div className="v22-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Send size={16} /> {isPt ? 'Contactar vendedor' : 'Contacter le vendeur'}</div>
          <button className="v22-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="v22-modal-body">
          <p style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 14 }}>
            <strong style={{ color: 'var(--v22-text)' }}>{listing.title}</strong>{listing.localisation ? ` — ${listing.localisation}` : ''}
          </p>

          {listing.type_annonce === 'vente_location' && (
            <div style={{ marginBottom: 14 }}>
              <label className="v22-label">{isPt ? 'Tipo de pedido' : 'Type de demande'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['achat', 'location'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)} className="v22-btn" style={{ flex: 1, background: type === t ? 'var(--v22-yellow)' : 'var(--v22-surface)', color: type === t ? 'var(--v22-text)' : 'var(--v22-text-muted)', border: `1px solid ${type === t ? 'var(--v22-yellow)' : 'var(--v22-border)'}`, fontWeight: type === t ? 700 : 400 }}>
                    {t === 'achat' ? (isPt ? 'Compra' : 'Achat') : (isPt ? 'Aluguer' : 'Location')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(type === 'location') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label className="v22-label">{isPt ? 'Data início' : 'Date début'}</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="v22-form-input" />
              </div>
              <div>
                <label className="v22-label">{isPt ? 'Data fim' : 'Date fin'}</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="v22-form-input" />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label className="v22-label">{isPt ? 'Preço proposto (€)' : 'Prix proposé (€)'} <span style={{ fontWeight: 400, color: 'var(--v22-text-muted)' }}>{isPt ? '— opcional' : '— optionnel'}</span></label>
            <input type="number" value={prixPropose} onChange={e => setPrixPropose(e.target.value)} className="v22-form-input" placeholder={isPt ? 'Deixar vazio = preço anunciado' : 'Laisser vide = prix affiché'} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="v22-label">{isPt ? 'Mensagem' : 'Message'}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="v22-form-input" rows={3}
              placeholder={isPt ? 'Apresente-se e explique as suas necessidades...' : 'Présentez-vous et expliquez vos besoins...'} style={{ resize: 'none' }} />
          </div>
        </div>
        <div className="v22-modal-foot">
          <button className="v22-btn" onClick={onClose}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          <button className="v22-btn v22-btn-primary" onClick={handleSubmit} disabled={loading || !message.trim()}>
            {loading ? <Clock size={14} className="animate-spin" /> : <><Send size={12} /> {isPt ? 'Enviar pedido' : 'Envoyer la demande'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FORMULAIRE ANNONCE ────────────────────────────────────────────────────────
function AnnonceForm({ isPt, artisan, initial, onSave, onCancel }: {
  isPt: boolean; artisan: any; initial?: MarketplaceListing; onSave: (data: CreateListingPayload) => void; onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [desc, setDesc] = useState(initial?.description || '')
  const [cat, setCat] = useState<MarketplaceCategorieId>(initial?.categorie || 'outillage_pro')
  const [type, setType] = useState<TypeAnnonce>(initial?.type_annonce || 'location')
  const [prixVente, setPrixVente] = useState(initial?.prix_vente?.toString() || '')
  const [prixJour, setPrixJour] = useState(initial?.prix_location_jour?.toString() || '')
  const [prixSem, setPrixSem] = useState(initial?.prix_location_semaine?.toString() || '')
  const [prixMois, setPrixMois] = useState(initial?.prix_location_mois?.toString() || '')
  const [dispo_de, setDispoDe] = useState(initial?.disponible_de || '')
  const [dispo_jusqu, setDispoJusqu] = useState(initial?.disponible_jusqu || '')
  const [localisation, setLocalisation] = useState(initial?.localisation || '')
  const [marque, setMarque] = useState(initial?.marque || '')
  const [modele, setModele] = useState(initial?.modele || '')
  const [annee, setAnnee] = useState(initial?.annee?.toString() || '')
  const [etat, setEtat] = useState<EtatMateriel>(initial?.etat || 'bon')
  const [vendeurNom, setVendeurNom] = useState(initial?.vendeur_nom || artisan?.company_name || '')
  const [vendeurPhone, setVendeurPhone] = useState(initial?.vendeur_phone || artisan?.phone || '')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(), description: desc.trim() || undefined,
      categorie: cat, type_annonce: type, etat,
      prix_vente: prixVente ? parseFloat(prixVente) : undefined,
      prix_location_jour: prixJour ? parseFloat(prixJour) : undefined,
      prix_location_semaine: prixSem ? parseFloat(prixSem) : undefined,
      prix_location_mois: prixMois ? parseFloat(prixMois) : undefined,
      disponible_de: dispo_de || undefined, disponible_jusqu: dispo_jusqu || undefined,
      localisation: localisation.trim() || undefined,
      country: artisan?.country || 'FR',
      marque: marque.trim() || undefined, modele: modele.trim() || undefined,
      annee: annee ? parseInt(annee) : undefined,
      vendeur_nom: vendeurNom.trim() || undefined,
      vendeur_phone: vendeurPhone.trim() || undefined,
    })
  }

  return (
    <div className="v22-card">
      <div className="v22-card-head">
        <div className="v22-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{initial ? <><Pencil size={14} /> {isPt ? 'Editar anúncio' : 'Modifier l\'annonce'}</> : <><PlusCircle size={14} /> {isPt ? 'Novo anúncio' : 'Nouvelle annonce'}</>}</div>
      </div>
      <div className="v22-card-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div>
          <label className="v22-label">{isPt ? 'Título *' : 'Titre *'}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="v22-form-input" placeholder={isPt ? 'Ex: Pelleteuse 3T Caterpillar 308' : 'Ex: Pelleteuse 3T Caterpillar 308'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="v22-label">{isPt ? 'Categoria *' : 'Catégorie *'}</label>
            <select value={cat} onChange={e => setCat(e.target.value as MarketplaceCategorieId)} className="v22-form-input">
              {MARKETPLACE_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {isPt ? c.labelPt : c.labelFr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="v22-label">{isPt ? 'Tipo *' : 'Type *'}</label>
            <select value={type} onChange={e => setType(e.target.value as TypeAnnonce)} className="v22-form-input">
              <option value="location">{isPt ? 'Aluguer' : 'Location'}</option>
              <option value="vente">{isPt ? 'Venda' : 'Vente'}</option>
              <option value="vente_location">{isPt ? 'Venda ou aluguer' : 'Vente ou location'}</option>
            </select>
          </div>
        </div>

        {/* Prix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {(type === 'vente' || type === 'vente_location') && (
            <div>
              <label className="v22-label">{isPt ? 'Preço venda (€)' : 'Prix vente (€)'}</label>
              <input type="number" value={prixVente} onChange={e => setPrixVente(e.target.value)} className="v22-form-input" placeholder="0" />
            </div>
          )}
          {(type === 'location' || type === 'vente_location') && (
            <>
              <div>
                <label className="v22-label">{isPt ? '€/dia' : '€/jour'}</label>
                <input type="number" value={prixJour} onChange={e => setPrixJour(e.target.value)} className="v22-form-input" placeholder="0" />
              </div>
              <div>
                <label className="v22-label">{isPt ? '€/semana' : '€/semaine'}</label>
                <input type="number" value={prixSem} onChange={e => setPrixSem(e.target.value)} className="v22-form-input" placeholder="0" />
              </div>
              <div>
                <label className="v22-label">{isPt ? '€/mês' : '€/mois'}</label>
                <input type="number" value={prixMois} onChange={e => setPrixMois(e.target.value)} className="v22-form-input" placeholder="0" />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label className="v22-label">{isPt ? 'Marca' : 'Marque'}</label>
            <input value={marque} onChange={e => setMarque(e.target.value)} className="v22-form-input" placeholder="Caterpillar" />
          </div>
          <div>
            <label className="v22-label">{isPt ? 'Modelo' : 'Modèle'}</label>
            <input value={modele} onChange={e => setModele(e.target.value)} className="v22-form-input" placeholder="308" />
          </div>
          <div>
            <label className="v22-label">{isPt ? 'Ano' : 'Année'}</label>
            <input type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="v22-form-input" placeholder="2022" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="v22-label">{isPt ? 'Estado *' : 'État *'}</label>
            <select value={etat} onChange={e => setEtat(e.target.value as EtatMateriel)} className="v22-form-input">
              {ETAT_OPTIONS.map(e => <option key={e} value={e}>{etatLabel(e, isPt)}</option>)}
            </select>
          </div>
          <div>
            <label className="v22-label">{isPt ? 'Localização' : 'Localisation'}</label>
            <input value={localisation} onChange={e => setLocalisation(e.target.value)} className="v22-form-input" placeholder={isPt ? 'Ex: Porto' : 'Ex: Marseille'} />
          </div>
        </div>

        {(type === 'location' || type === 'vente_location') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="v22-label">{isPt ? 'Disponível de' : 'Disponible du'}</label>
              <input type="date" value={dispo_de} onChange={e => setDispoDe(e.target.value)} className="v22-form-input" />
            </div>
            <div>
              <label className="v22-label">{isPt ? 'Disponível até' : "Disponible jusqu'au"}</label>
              <input type="date" value={dispo_jusqu} onChange={e => setDispoJusqu(e.target.value)} className="v22-form-input" />
            </div>
          </div>
        )}

        <div>
          <label className="v22-label">{isPt ? 'Descrição' : 'Description'}</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} className="v22-form-input" rows={3} style={{ resize: 'none' }}
            placeholder={isPt ? 'Detalhes, horas de uso, histórico de manutenção...' : 'Détails, heures d\'utilisation, historique maintenance...'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="v22-label">{isPt ? 'Nome do vendedor' : 'Nom vendeur'}</label>
            <input value={vendeurNom} onChange={e => setVendeurNom(e.target.value)} className="v22-form-input" />
          </div>
          <div>
            <label className="v22-label">{isPt ? 'Telefone' : 'Téléphone'}</label>
            <input value={vendeurPhone} onChange={e => setVendeurPhone(e.target.value)} className="v22-form-input" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--v22-border)' }}>
          <button className="v22-btn" onClick={onCancel}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          <button className="v22-btn v22-btn-primary" onClick={handleSave} disabled={!title.trim()}>
            <Check size={14} /> {isPt ? 'Publicar anúncio' : 'Publier l\'annonce'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MarketplaceProBTPSection({ artisan, orgRole }: { artisan: any; orgRole: string }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isProSociete = orgRole === 'pro_societe'

  // Seuls les artisans classiques sont limités aux catégories AE
  const isAE = !isProSociete && orgRole === 'artisan'
  const aeOnly = isAE // restreindre la vue acheteur

  type Tab = 'parcourir' | 'mes_annonces' | 'nouvelle_annonce' | 'demandes' | 'stats'
  const [tab, setTab] = useState<Tab>('parcourir')
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([])
  const [demandes, setDemandes] = useState<MarketplaceDemande[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [editListing, setEditListing] = useState<MarketplaceListing | null>(null)
  const [showDemandeModal, setShowDemandeModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Filtres parcourir
  const [filterCat, setFilterCat] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  // ── Charger annonces publiques ────────────────────────────────────────────
  const loadListings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCat)  params.set('categorie', filterCat)
      if (filterType) params.set('type', filterType)
      if (aeOnly)     params.set('ae_only', 'true')
      if (artisan?.country) params.set('country', artisan.country)

      const res = await fetch(`/api/marketplace-btp?${params.toString()}`)
      const data = await res.json()
      setListings(data.listings ?? [])
    } catch {}
    setLoading(false)
  }, [filterCat, filterType, aeOnly, artisan?.country])

  const loadMyListings = useCallback(async () => {
    if (!artisan?.user_id) return
    try {
      const res = await fetch(`/api/marketplace-btp?user_id=${artisan.user_id}`)
      const data = await res.json()
      setMyListings(data.listings ?? [])
    } catch {}
  }, [artisan?.user_id])

  const loadDemandes = useCallback(async () => {
    // Charger les demandes reçues sur mes annonces
    if (!myListings.length) return
    try {
      const token = await getToken()
      const all: MarketplaceDemande[] = []
      await Promise.allSettled(myListings.map(async l => {
        const res = await fetch(`/api/marketplace-btp/${l.id}/demande`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const d = await res.json()
        if (d.demandes) all.push(...d.demandes.map((x: MarketplaceDemande) => ({ ...x, listing: l })))
      }))
      setDemandes(all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch {}
  }, [myListings, getToken])

  useEffect(() => { loadListings() }, [loadListings])
  useEffect(() => { loadMyListings() }, [loadMyListings])
  useEffect(() => { if (tab === 'demandes') loadDemandes() }, [tab, loadDemandes])

  // ── Créer/modifier annonce ────────────────────────────────────────────────
  const handleSaveAnnonce = async (data: CreateListingPayload) => {
    try {
      const token = await getToken()
      if (!token) return
      const url = editListing ? `/api/marketplace-btp/${editListing.id}` : '/api/marketplace-btp'
      const method = editListing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        showToast(isPt ? 'Anúncio publicado!' : 'Annonce publiée !')
        setTab('mes_annonces')
        setEditListing(null)
        loadMyListings()
      }
    } catch {}
  }

  // ── Supprimer annonce ──────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const token = await getToken()
    await fetch(`/api/marketplace-btp/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    setConfirmDeleteId(null)
    showToast(isPt ? 'Anúncio eliminado' : 'Annonce supprimée')
    loadMyListings()
  }

  // ── Changer status annonce ─────────────────────────────────────────────────
  const handleStatusChange = async (listing: MarketplaceListing, newStatus: string) => {
    const token = await getToken()
    await fetch(`/api/marketplace-btp/${listing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    })
    loadMyListings()
  }

  // ── Envoyer demande ────────────────────────────────────────────────────────
  const handleSendDemande = async (d: Partial<MarketplaceDemande>) => {
    if (!selectedListing) return
    const token = await getToken()
    if (!token) return
    const res = await fetch(`/api/marketplace-btp/${selectedListing.id}/demande`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(d),
    })
    if (res.ok) {
      showToast(isPt ? 'Pedido enviado!' : 'Demande envoyée !')
      setShowDemandeModal(false)
      setSelectedListing(null)
    }
  }

  // ── Accepter/Rejeter demande ───────────────────────────────────────────────
  const handleRespond = async (demande: MarketplaceDemande, status: 'accepted' | 'rejected', reponse?: string) => {
    const token = await getToken()
    await fetch(`/api/marketplace-btp/${demande.listing_id}/demande`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ demande_id: demande.id, status, reponse_vendeur: reponse }),
    })
    showToast(status === 'accepted' ? (isPt ? 'Pedido aceite' : 'Demande acceptée') : (isPt ? 'Pedido recusado' : 'Demande refusée'))
    loadDemandes()
  }

  // ── Statistiques ───────────────────────────────────────────────────────────
  const statsTotal = myListings.length
  const statsActive = myListings.filter(l => l.status === 'active').length
  const statsVues = myListings.reduce((s, l) => s + (l.vues || 0), 0)
  const statsDemandesPending = demandes.filter(d => d.status === 'pending').length

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'parcourir' as Tab, icon: <Search size={13} />, label: isPt ? 'Explorar' : 'Parcourir', count: listings.length },
    { key: 'mes_annonces' as Tab, icon: <Package size={13} />, label: isPt ? 'Meus anúncios' : 'Mes annonces', count: myListings.length, hidden: !isProSociete },
    { key: 'nouvelle_annonce' as Tab, icon: <PlusCircle size={13} />, label: isPt ? 'Novo anúncio' : 'Nouvelle annonce', hidden: !isProSociete },
    { key: 'demandes' as Tab, icon: <Send size={13} />, label: isPt ? 'Pedidos' : 'Demandes', count: demandes.filter(d => d.status === 'pending').length || undefined, hidden: !isProSociete },
    { key: 'stats' as Tab, icon: <BarChart3 size={13} />, label: isPt ? 'Estatísticas' : 'Statistiques', hidden: !isProSociete },
  ].filter(t => !t.hidden)


  return (
    <div className="animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, background: 'var(--v22-surface)', border: '1px solid var(--v22-border)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">Marketplace PRO BTP</h1>
          <p className="v22-page-sub">
            {isAE
              ? (isPt ? 'Mini-máquinas e material leve disponíveis para aluguer' : 'Mini-engins et matériel léger disponibles à la location')
              : (isPt ? 'Aluguer & venda de equipamento entre profissionais' : 'Location & vente de matériel entre professionnels')}
          </p>
        </div>
        {isProSociete && (
          <button className="v22-btn v22-btn-primary" onClick={() => { setEditListing(null); setTab('nouvelle_annonce') }}>
            {isPt ? '+ Publicar anúncio' : '+ Publier une annonce'}
          </button>
        )}
      </div>

      {/* Bandeau restriction AE */}
      {isAE && (
        <div className="v22-card" style={{ marginBottom: 16, borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.06)', padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>
            <Lock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt
              ? 'Acesso restrito a mini-máquinas e material leve. As empresas PRO têm acesso à gama completa.'
              : 'Accès restreint aux mini-engins et matériel léger. Les entreprises PRO ont accès à la gamme complète.'}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--v22-border)', marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`v22-tab${tab === t.key ? ' active' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {t.icon} {t.label}
            {t.count != null && t.count > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--v22-yellow)', color: '#111', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PARCOURIR ─────────────────────────────────────────────────── */}
      {tab === 'parcourir' && (
        <div>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="v22-form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
              <option value="">{isPt ? '— Todas as categorias —' : '— Toutes catégories —'}</option>
              {MARKETPLACE_CATEGORIES.filter(c => !aeOnly || c.accessibleAE).map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {isPt ? c.labelPt : c.labelFr}</option>
              ))}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="v22-form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
              <option value="">{isPt ? '— Venda & aluguer —' : '— Vente & location —'}</option>
              <option value="vente">{isPt ? 'Venda' : 'Vente'}</option>
              <option value="location">{isPt ? 'Aluguer' : 'Location'}</option>
            </select>
            <button className="v22-btn" style={{ fontSize: 12, padding: '6px 14px' }} onClick={loadListings}>
              {loading ? <Clock size={12} className="animate-spin" /> : <><Search size={12} /> {isPt ? 'Filtrar' : 'Filtrer'}</>}
            </button>
          </div>

          {/* Grille */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--v22-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Clock size={16} className="animate-spin" /> {isPt ? 'A carregar...' : 'Chargement...'}</div>
          ) : listings.length === 0 ? (
            <EmptyState
              text={isPt ? 'Nenhum anúncio disponível' : 'Aucune annonce disponible'}
              sub={isPt ? 'Seja o primeiro a publicar!' : 'Soyez le premier à publier !'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {listings.map(l => (
                <ListingCard key={l.id} listing={l} isPt={isPt}
                  onContact={l.user_id !== artisan?.user_id ? () => { setSelectedListing(l); setShowDemandeModal(true) } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MES ANNONCES ──────────────────────────────────────────────── */}
      {tab === 'mes_annonces' && (
        <div>
          {myListings.length === 0 ? (
            <EmptyState
              text={isPt ? 'Nenhum anúncio publicado' : 'Aucune annonce publiée'}
              sub={isPt ? 'Clique em "+ Novo anúncio" para começar' : 'Cliquez "+ Nouvelle annonce" pour commencer'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myListings.map(l => (
                <div key={l.id} className="v22-card">
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 6, background: l.photos?.[0] ? `url(${l.photos[0]}) center/cover` : 'var(--v22-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '1px solid var(--v22-border)' }}>
                      {!l.photos?.[0] && (MARKETPLACE_CATEGORIES.find(c => c.id === l.categorie)?.emoji ?? <Package size={22} />)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)', marginBottom: 2 }}>{l.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                        {getCat(l.categorie, isPt)} · {typeLabel(l.type_annonce, isPt)} · {l.localisation || (isPt ? 'Sem localização' : 'Sans localisation')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                        <Eye size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {l.vues} {isPt ? 'visualizações' : 'vues'} · {daysAgo(l.created_at, isPt)}
                      </div>
                    </div>
                    {/* Status badge */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                      background: l.status === 'active' ? 'rgba(34,197,94,0.12)' : l.status === 'paused' ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)',
                      color: l.status === 'active' ? '#22c55e' : l.status === 'paused' ? '#eab308' : '#ef4444',
                    }}>
                      {l.status === 'active' ? (isPt ? '● ATIVO' : '● ACTIVE') : l.status === 'paused' ? (isPt ? '▪ PAUSADO' : '▪ PAUSÉE') : (isPt ? '✓ VENDIDO/ALUGADO' : '✓ VENDU/LOUÉ')}
                    </span>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="v22-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => { setEditListing(l); setTab('nouvelle_annonce') }}><Pencil size={14} /></button>
                      {l.status === 'active'
                        ? <button className="v22-btn" style={{ fontSize: 11, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => handleStatusChange(l, 'paused')}><Pause size={12} /> {isPt ? 'Pausar' : 'Pauser'}</button>
                        : <button className="v22-btn v22-btn-primary" style={{ fontSize: 11, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => handleStatusChange(l, 'active')}><Play size={12} /> {isPt ? 'Ativar' : 'Activer'}</button>
                      }
                      <button className="v22-btn" style={{ fontSize: 11, padding: '5px 10px', color: 'var(--v22-red)' }} onClick={() => setConfirmDeleteId(l.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NOUVELLE ANNONCE ──────────────────────────────────────────── */}
      {tab === 'nouvelle_annonce' && (
        <AnnonceForm
          isPt={isPt} artisan={artisan} initial={editListing ?? undefined}
          onSave={handleSaveAnnonce}
          onCancel={() => { setEditListing(null); setTab('mes_annonces') }}
        />
      )}

      {/* ── DEMANDES ──────────────────────────────────────────────────── */}
      {tab === 'demandes' && (
        <div>
          {demandes.length === 0 ? (
            <EmptyState
              text={isPt ? 'Nenhum pedido recebido' : 'Aucune demande reçue'}
              sub={isPt ? 'Os pedidos dos compradores aparecerão aqui' : 'Les demandes des acheteurs apparaîtront ici'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {demandes.map(d => (
                <div key={d.id} className="v22-card">
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)', marginBottom: 2 }}>
                          {d.type_demande === 'achat' ? (isPt ? 'Pedido de compra' : 'Demande d\'achat') : (isPt ? 'Pedido de aluguer' : 'Demande de location')}
                          {' — '}
                          <span style={{ color: 'var(--v22-text-muted)', fontWeight: 400 }}>{(d.listing as any)?.title || isPt ? 'Anúncio' : 'Annonce'}</span>
                        </div>
                        {d.date_debut && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {d.date_debut}{d.date_fin ? ` → ${d.date_fin}` : ''}</div>}
                        {d.prix_propose && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Euro size={11} /> {fmtEur(d.prix_propose, isPt ? 'pt' : 'fr')} {isPt ? 'proposto' : 'proposé'}</div>}
                        {d.message && <div style={{ fontSize: 12, color: 'var(--v22-text)', marginTop: 6, fontStyle: 'italic' }}>"{d.message}"</div>}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, flexShrink: 0,
                        background: d.status === 'pending' ? 'rgba(234,179,8,0.12)' : d.status === 'accepted' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: d.status === 'pending' ? '#eab308' : d.status === 'accepted' ? '#22c55e' : '#ef4444',
                      }}>
                        {d.status === 'pending' ? (isPt ? 'PENDENTE' : 'EN ATTENTE') : d.status === 'accepted' ? (isPt ? 'ACEITE' : 'ACCEPTÉ') : (isPt ? 'RECUSADO' : 'REFUSÉ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: d.status === 'pending' ? 10 : 0 }}>
                      {daysAgo(d.created_at, isPt)}
                    </div>
                    {d.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="v22-btn v22-btn-primary" style={{ fontSize: 11, padding: '5px 14px' }} onClick={() => handleRespond(d, 'accepted', isPt ? 'Pedido aceite. Entraremos em contacto.' : 'Demande acceptée. Nous vous contacterons.')}>
                          <Check size={12} /> {isPt ? 'Aceitar' : 'Accepter'}
                        </button>
                        <button className="v22-btn" style={{ fontSize: 11, padding: '5px 14px', color: 'var(--v22-red)' }} onClick={() => handleRespond(d, 'rejected', isPt ? 'Lamentamos, não está disponível.' : 'Désolé, non disponible.')}>
                          <X size={12} /> {isPt ? 'Recusar' : 'Refuser'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STATISTIQUES ──────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div>
          <div className="v22-stats" style={{ marginBottom: 20 }}>
            <div className="v22-stat" style={{ borderLeft: '3px solid var(--v22-yellow)' }}>
              <div className="v22-stat-label">{isPt ? 'Total anúncios' : 'Total annonces'}</div>
              <div className="v22-stat-val">{statsTotal}</div>
            </div>
            <div className="v22-stat" style={{ borderLeft: '3px solid #22c55e' }}>
              <div className="v22-stat-label">{isPt ? 'Anúncios ativos' : 'Annonces actives'}</div>
              <div className="v22-stat-val" style={{ color: '#22c55e' }}>{statsActive}</div>
            </div>
            <div className="v22-stat" style={{ borderLeft: '3px solid #3b82f6' }}>
              <div className="v22-stat-label">{isPt ? 'Total visualizações' : 'Vues totales'}</div>
              <div className="v22-stat-val" style={{ color: '#3b82f6' }}>{statsVues}</div>
            </div>
            <div className="v22-stat" style={{ borderLeft: '3px solid #f97316' }}>
              <div className="v22-stat-label">{isPt ? 'Pedidos pendentes' : 'Demandes en attente'}</div>
              <div className="v22-stat-val" style={{ color: '#f97316' }}>{statsDemandesPending}</div>
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="v22-card">
            <div className="v22-card-head"><div className="v22-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={14} /> {isPt ? 'Anúncios por categoria' : 'Annonces par catégorie'}</div></div>
            <div className="v22-card-body" style={{ padding: 16 }}>
              {MARKETPLACE_CATEGORIES.filter(c => myListings.some(l => l.categorie === c.id)).map(c => {
                const count = myListings.filter(l => l.categorie === c.id).length
                const pct = statsTotal > 0 ? Math.round((count / statsTotal) * 100) : 0
                return (
                  <div key={c.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{c.emoji} {isPt ? c.labelPt : c.labelFr}</span>
                      <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--v22-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--v22-yellow)', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
              {statsTotal === 0 && <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', textAlign: 'center', padding: 20 }}>{isPt ? 'Sem dados' : 'Aucune donnée'}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal demande */}
      {showDemandeModal && selectedListing && (
        <DemandeModal
          listing={selectedListing} isPt={isPt}
          onClose={() => { setShowDemandeModal(false); setSelectedListing(null) }}
          onSubmit={handleSendDemande}
        />
      )}

      {/* Modal confirmation suppression */}
      {confirmDeleteId && (
        <div className="v22-modal-overlay">
          <div className="v22-modal" style={{ maxWidth: 400 }}>
            <div className="v22-modal-head">
              <div className="v22-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {isPt ? 'Confirmar eliminação' : 'Confirmer la suppression'}</div>
              <button className="v22-modal-close" onClick={() => setConfirmDeleteId(null)}>✕</button>
            </div>
            <div className="v22-modal-body">
              <p style={{ fontSize: 13, color: 'var(--v22-text)' }}>
                {isPt ? 'Tem a certeza que quer eliminar este anúncio? Esta ação é irreversível.' : 'Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est irréversible.'}
              </p>
            </div>
            <div className="v22-modal-foot">
              <button className="v22-btn" onClick={() => setConfirmDeleteId(null)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-red)', color: '#fff', border: 'none' }} onClick={() => handleDelete(confirmDeleteId)}>
                <Trash2 size={12} /> {isPt ? 'Eliminar' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
