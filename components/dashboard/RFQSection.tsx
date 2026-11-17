'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import type { RFQ, RFQItem, Offer, CreateRFQPayload } from '@/lib/rfq-types'

interface Props {
  artisan: { id: string; country?: string }
  orgRole?: string
}

const UNITS_FR = ['unité', 'kg', 'tonne', 'm', 'm²', 'm³', 'litre', 'sac', 'palette', 'rouleau', 'boîte']
const UNITS_PT = ['unidade', 'kg', 'tonelada', 'm', 'm²', 'm³', 'litro', 'saco', 'palete', 'rolo', 'caixa']

const CATEGORIES_FR = [
  { value: 'gros_oeuvre', label: 'Gros œuvre' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'menuiserie', label: 'Menuiserie' },
  { value: 'plomberie', label: 'Plomberie' },
  { value: 'electricite', label: 'Électricité' },
  { value: 'carrelage', label: 'Carrelage' },
  { value: 'toiture', label: 'Toiture' },
  { value: 'charpente', label: 'Charpente' },
  { value: 'enduit', label: 'Enduit / Peinture' },
  { value: 'autre', label: 'Autre' },
]

const CATEGORIES_PT = [
  { value: 'alvenaria', label: 'Alvenaria' },
  { value: 'isolamento', label: 'Isolamento' },
  { value: 'carpintaria', label: 'Carpintaria' },
  { value: 'canalizacao', label: 'Canalização' },
  { value: 'electricidade', label: 'Eletricidade' },
  { value: 'pavimento', label: 'Pavimento' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'pintura', label: 'Reboco / Pintura' },
  { value: 'outro', label: 'Outro' },
]

// Libellés portugais, à l'affichage seulement, des unités et catégories de la liste française (celle de toute société
// dont le pays n'est pas « PT ») : la valeur choisie, envoyée à l'API et gardée en base, ne change pas.
const UNITES_FR_EN_PT: Record<string, string> = {
  'unité': 'unidade', 'tonne': 'tonelada', 'litre': 'litro', 'sac': 'saco', 'palette': 'palete', 'rouleau': 'rolo', 'boîte': 'caixa',
}
const CATEGORIES_FR_EN_PT: Record<string, string> = {
  gros_oeuvre: 'Estrutura e alvenaria',
  isolation: 'Isolamento',
  menuiserie: 'Carpintaria e caixilharia',
  plomberie: 'Canalização',
  electricite: 'Eletricidade',
  carrelage: 'Cerâmica e pavimentos',
  toiture: 'Cobertura',
  charpente: 'Estrutura de cobertura',
  enduit: 'Reboco / Pintura',
  autre: 'Outro',
}

interface NewItem {
  product_name: string
  product_ref: string
  category: string
  quantity: string
  unit: string
  notes: string
}

const defaultItem = (): NewItem => ({
  product_name: '',
  product_ref: '',
  category: '',
  quantity: '1',
  unit: 'unité',
  notes: '',
})

export default function RFQSection({ artisan, orgRole }: Props) {
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const country = (artisan.country?.toUpperCase() === 'PT' ? 'PT' : 'FR') as 'FR' | 'PT'
  const isFR = country === 'FR'
  // Langue des textes : le portugais dès que l'interface est en portugais. Le pays de la société (absent du profil en
  // production, donc « FR ») continue seul de choisir les unités, les catégories et le pays envoyé à l'API.
  const locale = useLocale()
  const isPt = locale === 'pt' || !isFR

  const units = isFR ? UNITS_FR : UNITS_PT
  const categories = isFR ? CATEGORIES_FR : CATEGORIES_PT
  const libelleUnite = (u: string) => (isPt ? UNITES_FR_EN_PT[u] ?? u : u)
  const libelleCategorie = (c: { value: string; label: string }) => (isPt ? CATEGORIES_FR_EN_PT[c.value] ?? c.label : c.label)
  const libelleCategorieDe = (valeur?: string) => {
    const categorie = categories.find(c => c.value === valeur)
    return categorie ? libelleCategorie(categorie) : ''
  }

  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Create form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<NewItem[]>([defaultItem()])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const getToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const loadRFQs = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/rfq', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.rfqs) setRfqs(data.rfqs)
    } catch (e) {
      console.error('[RFQSection] loadRFQs error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRFQs()
  }, [loadRFQs])

  const addItem = () => setItems(prev => [...prev, defaultItem()])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof NewItem, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast(isPt ? 'O título é obrigatório' : 'Un titre est requis', false)
      return
    }
    const validItems = items.filter(i => i.product_name.trim())
    if (!validItems.length) {
      showToast(isPt ? 'Adicione pelo menos um produto' : 'Ajoutez au moins un produit', false)
      return
    }
    setSubmitting(true)
    try {
      const token = await getToken()
      if (!token) return
      const payload: CreateRFQPayload = {
        title: title.trim(),
        message: message.trim() || undefined,
        country,
        items: validItems.map(i => ({
          product_name: i.product_name.trim(),
          product_ref: i.product_ref.trim() || undefined,
          category: i.category || undefined,
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit,
          notes: i.notes.trim() || undefined,
        })),
      }
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('API error')
      showToast(isPt ? 'Pedido enviado aos fornecedores!' : 'Demande envoyée aux fournisseurs !')
      setShowCreate(false)
      setTitle('')
      setMessage('')
      setItems([defaultItem()])
      await loadRFQs()
    } catch {
      showToast(isPt ? 'Erro ao criar o pedido' : 'Erreur lors de la création', false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptOffer = async (offerId: string) => {
    setActionLoading(offerId)
    try {
      const token = await getToken()
      if (!token) return
      const { error } = await supabase
        .from('offers')
        .update({ status: 'accepted' })
        .eq('id', offerId)
      if (error) throw error
      if (selectedRFQ) {
        await supabase
          .from('offers')
          .update({ status: 'rejected' })
          .eq('rfq_id', selectedRFQ.id)
          .neq('id', offerId)
        await supabase
          .from('rfqs')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .eq('id', selectedRFQ.id)
      }
      showToast(isPt ? 'Proposta aceite!' : 'Offre acceptée !')
      await loadRFQs()
      setSelectedRFQ(null)
    } catch {
      showToast(isPt ? 'Erro' : 'Erreur', false)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectOffer = async (offerId: string) => {
    setActionLoading(offerId)
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'rejected' })
        .eq('id', offerId)
      if (error) throw error
      showToast(isPt ? 'Proposta recusada' : 'Offre refusée')
      await loadRFQs()
      setSelectedRFQ(null)
    } catch {
      showToast(isPt ? 'Erro' : 'Erreur', false)
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadgeClass = (status: string) => {
    if (isV5) {
      const map: Record<string, string> = { pending: 'v5-badge v5-badge-blue', answered: 'v5-badge v5-badge-green', closed: 'v5-badge v5-badge-gray' }
      return map[status] || 'v5-badge v5-badge-blue'
    }
    const map: Record<string, string> = { pending: 'v22-tag v22-tag-blue', answered: 'v22-tag v22-tag-green', closed: 'v22-tag v22-tag-gray' }
    return map[status] || 'v22-tag v22-tag-blue'
  }
  const statusLabel = (status: string) => {
    const map: Record<string, { fr: string; pt: string }> = {
      pending: { fr: 'En attente', pt: 'Pendente' },
      answered: { fr: 'Réponse(s) reçue(s)', pt: 'Resposta(s) recebida(s)' },
      closed: { fr: 'Clôturé', pt: 'Encerrado' },
    }
    const s = map[status] || map.pending
    return isPt ? s.pt : s.fr
  }

  const offerBadgeClass = (status: string) => {
    if (isV5) {
      const map: Record<string, string> = { pending: 'v5-badge v5-badge-blue', accepted: 'v5-badge v5-badge-green', rejected: 'v5-badge v5-badge-red' }
      return map[status] || 'v5-badge v5-badge-blue'
    }
    const map: Record<string, string> = { pending: 'v22-tag v22-tag-blue', accepted: 'v22-tag v22-tag-green', rejected: 'v22-tag v22-tag-red' }
    return map[status] || 'v22-tag v22-tag-blue'
  }
  const offerLabel = (status: string) => {
    const map: Record<string, { fr: string; pt: string }> = {
      pending: { fr: 'En attente', pt: 'Pendente' },
      accepted: { fr: 'Acceptée', pt: 'Aceite' },
      rejected: { fr: 'Refusée', pt: 'Recusada' },
    }
    const s = map[status] || map.pending
    return isPt ? s.pt : s.fr
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatPrice = (n?: number | null) => n != null ? `${n.toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'

  return (
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? '#1a1a1a' : '#C62828',
          color: '#fff', padding: '10px 20px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div className={isV5 ? 'v5-pg-t' : ''} style={{ marginBottom: 0, flex: 1 }}>
          {isV5 ? <h1>{isPt ? 'Orçamentos de fornecedores (pedidos de cotação)' : 'Devis Fournisseurs (RFQ)'}</h1> : <div className="v22-page-title">{isPt ? 'Orçamentos de fornecedores (pedidos de cotação)' : 'Devis Fournisseurs (RFQ)'}</div>}
          {isV5 ? <p>{isPt ? 'Pedidos de cotação a fornecedores' : 'Demandes de prix aux fournisseurs'}</p> : <div className="v22-page-sub">{isPt ? 'Pedidos de cotação a fornecedores' : 'Demandes de prix aux fournisseurs'}</div>}
        </div>
        <button
          className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}
          onClick={() => { setShowCreate(true); setSelectedRFQ(null) }}
        >
          + {isPt ? 'Novo pedido de cotação' : 'Nouvelle demande de prix'}
        </button>
      </div>

      {/* Detail view */}
      {selectedRFQ && !showCreate && (
        <div>
          <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ marginBottom: 16 }} onClick={() => setSelectedRFQ(null)}>
            &larr; {isPt ? 'Voltar à lista' : 'Retour à la liste'}
          </button>

          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedRFQ.title}</div>
              <span className={statusBadgeClass(selectedRFQ.status)}>{statusLabel(selectedRFQ.status)}</span>
            </div>
            {selectedRFQ.message && (
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#999' }}>{selectedRFQ.message}</p>
            )}
            <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
              {isPt ? 'Criado em' : 'Créé le'} {formatDate(selectedRFQ.created_at)}
            </p>
          </div>

          {/* Items table */}
          {selectedRFQ.rfq_items && selectedRFQ.rfq_items.length > 0 && (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16, overflow: 'auto' }}>
              <div className={isV5 ? 'v5-st' : 'v22-section-title'}>{isPt ? 'Materiais solicitados' : 'Matériaux demandés'}</div>
              <table className={isV5 ? 'v5-dt' : 'v22-table'}>
                <thead>
                  <tr>
                    <th>{isPt ? 'Produto' : 'Produit'}</th>
                    <th>{isPt ? 'Ref.' : 'Réf.'}</th>
                    <th style={{ textAlign: 'center' }}>{isPt ? 'Qtd.' : 'Qté'}</th>
                    <th>{isPt ? 'Categoria' : 'Catégorie'}</th>
                    <th>{isPt ? 'Notas' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRFQ.rfq_items.map((item: RFQItem) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td style={{ color: '#999', fontSize: 11 }}>{item.product_ref || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity} {libelleUnite(item.unit)}</td>
                      <td style={{ color: '#999', fontSize: 11 }}>
                        {libelleCategorieDe(item.category) || item.category || '—'}
                      </td>
                      <td style={{ color: '#999', fontSize: 11 }}>{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Offers comparison */}
          <div className={isV5 ? 'v5-card' : 'v22-card'}>
            <div className={isV5 ? 'v5-st' : 'v22-section-title'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isPt ? 'Propostas recebidas' : 'Offres reçues'}
              {selectedRFQ.offers && selectedRFQ.offers.length > 0 && (
                <span className={isV5 ? 'v5-badge v5-badge-yellow' : 'v22-tag v22-tag-yellow'}>{selectedRFQ.offers.length}</span>
              )}
            </div>
            {!selectedRFQ.offers || selectedRFQ.offers.length === 0 ? (
              <p style={{ fontSize: 12, color: '#999' }}>
                {isPt ? 'Ainda não recebeu nenhuma proposta. Os fornecedores receberam o seu pedido por e-mail.' : 'Aucune offre reçue pour le moment. Les fournisseurs ont reçu votre demande par email.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={isV5 ? 'v5-dt' : 'v22-table'}>
                  <thead>
                    <tr>
                      <th>{isPt ? 'Fornecedor' : 'Fournisseur'}</th>
                      <th style={{ textAlign: 'right' }}>{isPt ? 'Preço s/ IVA' : 'Prix HT'}</th>
                      <th style={{ textAlign: 'center' }}>{isPt ? 'Prazo (dias)' : 'Délai (j)'}</th>
                      <th>{isPt ? 'Estado' : 'Statut'}</th>
                      <th>{isPt ? 'Recebida em' : 'Reçu le'}</th>
                      {selectedRFQ.status !== 'closed' && <th>{isPt ? 'Ação' : 'Action'}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRFQ.offers as Offer[]).map(offer => (
                      <tr key={offer.id} style={{ background: offer.status === 'accepted' ? 'rgba(232,245,233,0.3)' : 'transparent' }}>
                        <td style={{ fontWeight: 600 }}>{offer.supplier_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(offer.total_price)}</td>
                        <td style={{ textAlign: 'center', color: '#999' }}>{offer.delivery_days ?? '—'}</td>
                        <td><span className={offerBadgeClass(offer.status)}>{offerLabel(offer.status)}</span></td>
                        <td style={{ color: '#999', fontSize: 11 }}>{formatDate(offer.created_at)}</td>
                        {selectedRFQ.status !== 'closed' && (
                          <td>
                            {offer.status === 'pending' && offer.total_price != null && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className={isV5 ? 'v5-btn v5-btn-p v5-btn-sm' : 'v22-btn v22-btn-primary v22-btn-sm'}
                                  disabled={actionLoading === offer.id}
                                  onClick={() => handleAcceptOffer(offer.id)}
                                >
                                  {actionLoading === offer.id ? '...' : (isPt ? 'Aceitar' : 'Accepter')}
                                </button>
                                <button
                                  className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                                  disabled={actionLoading === offer.id}
                                  onClick={() => handleRejectOffer(offer.id)}
                                >
                                  {isPt ? 'Recusar' : 'Refuser'}
                                </button>
                              </div>
                            )}
                            {offer.status === 'pending' && offer.total_price == null && (
                              <span style={{ fontSize: 11, color: '#999' }}>
                                {isPt ? 'A aguardar resposta' : 'En attente de réponse'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List view */}
      {!selectedRFQ && !showCreate && (
        <>
          {loading ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 12 }}>
              {isPt ? 'A carregar...' : 'Chargement...'}
            </div>
          ) : rfqs.length === 0 ? (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 32, marginBottom: 12, color: '#BBB' }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {isPt ? 'Nenhum pedido de cotação' : 'Aucune demande de devis'}
              </div>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>
                {isPt
                  ? 'Crie o seu primeiro pedido para obter orçamentos dos seus fornecedores habituais.'
                  : 'Créez votre première demande pour obtenir des devis de vos fournisseurs habituels.'}
              </p>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} onClick={() => setShowCreate(true)}>
                + {isPt ? 'Criar pedido' : 'Créer une demande'}
              </button>
            </div>
          ) : (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflow: 'auto' }}>
              <table className={isV5 ? 'v5-dt' : 'v22-table'}>
                <thead>
                  <tr>
                    <th>{isPt ? 'Pedido de cotação' : 'N° RFQ'}</th>
                    <th style={{ textAlign: 'center' }}>{isPt ? 'Artigos' : 'Articles'}</th>
                    <th style={{ textAlign: 'center' }}>{isPt ? 'Propostas' : 'Offres'}</th>
                    <th>{isPt ? 'Estado' : 'Statut'}</th>
                    <th>{isPt ? 'Data' : 'Date'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rfqs.map(rfq => (
                    <tr key={rfq.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRFQ(rfq)}>
                      <td style={{ fontWeight: 600 }}>
                        {rfq.title}
                        {rfq.message && (
                          <div style={{ fontSize: 10, color: '#999', marginTop: 2, fontWeight: 400 }}>
                            {rfq.message.length > 60 ? rfq.message.slice(0, 60) + '...' : rfq.message}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', color: '#999' }}>{rfq.rfq_items?.length ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        {rfq.offers && rfq.offers.length > 0 ? (
                          <span className={isV5 ? 'v5-badge v5-badge-yellow' : 'v22-tag v22-tag-yellow'}>{rfq.offers.length}</span>
                        ) : (
                          <span style={{ color: '#999', fontSize: 11 }}>0</span>
                        )}
                      </td>
                      <td><span className={statusBadgeClass(rfq.status)}>{statusLabel(rfq.status)}</span></td>
                      <td style={{ color: '#999', fontSize: 11 }}>{formatDate(rfq.created_at)}</td>
                      <td>
                        <span style={{ fontSize: 11, color: 'var(--v5-primary-yellow-dark)', fontWeight: 600, cursor: 'pointer' }}>
                          {isPt ? 'Ver →' : 'Voir →'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create RFQ Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className={isV5 ? 'v5-card v5-fade' : 'v22-card'} style={{ width: '90%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className={isV5 ? 'v5-st' : 'v22-section-title'} style={{ margin: 0 }}>
                {isPt ? 'Novo pedido de cotação' : 'Nouvelle demande de devis pro'}
              </div>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate}>
              {/* Title */}
              <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Título do pedido *' : 'Titre de la demande *'}</label>
                <input
                  className={isV5 ? 'v5-fi' : 'v22-input'} type="text" value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={isPt ? 'Ex.: Materiais da obra de Marco de Canaveses, lote 2' : 'Ex: Matériaux chantier Marseille — Lot 3'}
                  required
                />
              </div>

              {/* Message */}
              <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Mensagem aos fornecedores (opcional)' : 'Message aux fournisseurs (optionnel)'}</label>
                <textarea
                  className={isV5 ? 'v5-fi' : 'v22-input'} value={message}
                  onChange={e => setMessage(e.target.value)} rows={2}
                  placeholder={isPt ? 'Detalhes da obra, prazos pretendidos...' : 'Précisions sur le chantier, délais souhaités...'}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'} style={{ margin: 0 }}>{isPt ? 'Materiais / Produtos *' : 'Matériaux / Produits *'}</label>
                  <button type="button" className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} onClick={addItem}>
                    + {isPt ? 'Adicionar' : 'Ajouter'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid #E8E8E8', borderRadius: 6, padding: 12, background: '#FAFAFA' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className={isV5 ? 'v5-fl' : 'v22-form-label'} style={{ margin: 0 }}>
                          {isPt ? `Produto ${idx + 1}` : `Produit ${idx + 1}`}
                        </span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999' }}>
                            &times;
                          </button>
                        )}
                      </div>

                      <div className={isV5 ? 'v5-fr' : ''} style={{ display: isV5 ? undefined : 'grid', gridTemplateColumns: isV5 ? undefined : '1fr 1fr', gap: isV5 ? undefined : 8, marginBottom: 8 }}>
                        <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome do produto *' : 'Nom du produit *'}</label>
                          <input className={isV5 ? 'v5-fi' : 'v22-input'} type="text" value={item.product_name}
                            onChange={e => updateItem(idx, 'product_name', e.target.value)}
                            placeholder={isPt ? 'Ex.: Bloco de betão 20×20×50' : 'Ex: Parpaing 20×20×50'} required />
                        </div>
                        <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Ref. do fabricante' : 'Réf. fabricant'}</label>
                          <input className={isV5 ? 'v5-fi' : 'v22-input'} type="text" value={item.product_ref}
                            onChange={e => updateItem(idx, 'product_ref', e.target.value)} placeholder="REF-001" />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 8 }}>
                        <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Quantidade' : 'Quantité'}</label>
                          <input className={isV5 ? 'v5-fi' : 'v22-input'} type="number" min="0.01" step="0.01"
                            value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                        </div>
                        <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Unidade' : 'Unité'}</label>
                          <select className={isV5 ? 'v5-fi' : 'v22-input'} value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                            {units.map(u => <option key={u} value={u}>{libelleUnite(u)}</option>)}
                          </select>
                        </div>
                        <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                          <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Categoria' : 'Catégorie'}</label>
                          <select className={isV5 ? 'v5-fi' : 'v22-input'} value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)}>
                            <option value="">{isPt ? 'Selecione' : '— Choisir —'}</option>
                            {categories.map(c => <option key={c.value} value={c.value}>{libelleCategorie(c)}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                        <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Notas (opcional)' : 'Notes (optionnel)'}</label>
                        <input className={isV5 ? 'v5-fi' : 'v22-input'} type="text" value={item.notes}
                          onChange={e => updateItem(idx, 'notes', e.target.value)}
                          placeholder={isPt ? 'Cor, espessura, qualidade...' : 'Couleur, épaisseur, qualité...'} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #E8E8E8', paddingTop: 12 }}>
                <button type="button" className={isV5 ? 'v5-btn' : 'v22-btn'} onClick={() => setShowCreate(false)} disabled={submitting}>
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
                <button type="submit" className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} disabled={submitting}>
                  {submitting
                    ? (isPt ? 'A enviar...' : 'Envoi...')
                    : (isPt ? 'Enviar aos fornecedores →' : 'Envoyer aux fournisseurs →')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
