'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RFQ, RFQItem, Offer, CreateRFQPayload } from '@/lib/rfq-types'

interface Props {
  artisan: { id: string; country?: string }
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
  { value: 'electricidade', label: 'Electricidade' },
  { value: 'pavimento', label: 'Pavimento' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'estrutura', label: 'Estrutura' },
  { value: 'pintura', label: 'Reboco / Pintura' },
  { value: 'outro', label: 'Outro' },
]

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

export default function RFQSection({ artisan }: Props) {
  const country = (artisan.country?.toUpperCase() === 'PT' ? 'PT' : 'FR') as 'FR' | 'PT'
  const isFR = country === 'FR'

  const units = isFR ? UNITS_FR : UNITS_PT
  const categories = isFR ? CATEGORIES_FR : CATEGORIES_PT

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
      showToast(isFR ? 'Un titre est requis' : 'Título obrigatório', false)
      return
    }
    const validItems = items.filter(i => i.product_name.trim())
    if (!validItems.length) {
      showToast(isFR ? 'Ajoutez au moins un produit' : 'Adicione pelo menos um produto', false)
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
      showToast(isFR ? 'Demande envoyée aux fournisseurs !' : 'Pedido enviado aos fornecedores!')
      setShowCreate(false)
      setTitle('')
      setMessage('')
      setItems([defaultItem()])
      await loadRFQs()
    } catch {
      showToast(isFR ? 'Erreur lors de la création' : 'Erro ao criar pedido', false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptOffer = async (offerId: string) => {
    setActionLoading(offerId)
    try {
      const token = await getToken()
      if (!token) return
      // Accept via supabase directly using service role (admin action)
      const { error } = await supabase
        .from('offers')
        .update({ status: 'accepted' })
        .eq('id', offerId)
      if (error) throw error
      // Reject other offers for same rfq
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
      showToast(isFR ? 'Offre acceptée !' : 'Proposta aceite!')
      await loadRFQs()
      // Refresh selectedRFQ
      const updated = rfqs.find(r => r.id === selectedRFQ?.id)
      if (updated) setSelectedRFQ(updated)
      setSelectedRFQ(null)
    } catch {
      showToast(isFR ? 'Erreur' : 'Erro', false)
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
      showToast(isFR ? 'Offre refusée' : 'Proposta recusada')
      await loadRFQs()
      setSelectedRFQ(null)
    } catch {
      showToast(isFR ? 'Erreur' : 'Erro', false)
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string; labelPt: string }> = {
      pending:  { bg: '#fef3c7', color: '#92400e', label: 'En attente', labelPt: 'Pendente' },
      answered: { bg: '#dbeafe', color: '#1e40af', label: 'Réponse(s) reçue(s)', labelPt: 'Resposta(s) recebida(s)' },
      closed:   { bg: '#f3f4f6', color: '#374151', label: 'Clôturé', labelPt: 'Encerrado' },
    }
    const s = styles[status] || styles.pending
    return (
      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {isFR ? s.label : s.labelPt}
      </span>
    )
  }

  const offerStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string; labelPt: string }> = {
      pending:  { bg: '#fef3c7', color: '#92400e', label: 'En attente', labelPt: 'Pendente' },
      accepted: { bg: '#d1fae5', color: '#065f46', label: 'Acceptée', labelPt: 'Aceite' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Refusée', labelPt: 'Recusada' },
    }
    const s = map[status] || map.pending
    return (
      <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3 }}>
        {isFR ? s.label : s.labelPt}
      </span>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString(isFR ? 'fr-FR' : 'pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatPrice = (n?: number | null) => n != null ? `${n.toLocaleString(isFR ? 'fr-FR' : 'pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'

  return (
    <div className="animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? '#0d0d0d' : '#c0392b',
          color: '#fff', padding: '10px 20px', borderRadius: 4, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="v22-page-header">
        <div>
          <div className="v22-page-title">{isFR ? 'Devis Fournisseurs' : 'Orçamentos Fornecedores'}</div>
          <div className="v22-page-sub">
            {isFR
              ? 'Envoyez des demandes de devis groupées à vos fournisseurs et comparez les offres.'
              : 'Envie pedidos de orçamento em grupo aos fornecedores e compare as propostas.'}
          </div>
        </div>
        <button
          className="v22-btn v22-btn-primary"
          onClick={() => { setShowCreate(true); setSelectedRFQ(null) }}
        >
          + {isFR ? 'Nouvelle demande' : 'Novo pedido'}
        </button>
      </div>

      {/* Detail view */}
      {selectedRFQ && !showCreate && (
        <div>
          <button
            className="v22-btn"
            style={{ marginBottom: 20 }}
            onClick={() => setSelectedRFQ(null)}
          >
            ← {isFR ? 'Retour à la liste' : 'Voltar à lista'}
          </button>

          <div className="v22-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedRFQ.title}</h2>
              {statusBadge(selectedRFQ.status)}
            </div>
            {selectedRFQ.message && (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--v22-text-muted)' }}>{selectedRFQ.message}</p>
            )}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--v22-text-muted)' }}>
              {isFR ? 'Créé le' : 'Criado em'} {formatDate(selectedRFQ.created_at)}
            </p>
          </div>

          {/* Items table */}
          {selectedRFQ.rfq_items && selectedRFQ.rfq_items.length > 0 && (
            <div className="v22-card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: 'var(--v22-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isFR ? 'Matériaux demandés' : 'Materiais solicitados'}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--v22-bg)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Produit' : 'Produto'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Réf.' : 'Ref.'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Qté' : 'Qtd'}</th>
                      <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Catégorie' : 'Categoria'}</th>
                      <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Notes' : 'Notas'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRFQ.rfq_items.map((item: RFQItem) => (
                      <tr key={item.id}>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)', fontSize: 12 }}>{item.product_ref || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--v22-border)' }}>{item.quantity} {item.unit}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)', fontSize: 12 }}>
                          {categories.find(c => c.value === item.category)?.label || item.category || '—'}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)', fontSize: 12 }}>{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Offers comparison */}
          <div className="v22-card">
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: 'var(--v22-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isFR ? 'Offres reçues' : 'Propostas recebidas'}
              {selectedRFQ.offers && selectedRFQ.offers.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--v22-yellow)', color: '#0d0d0d', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>
                  {selectedRFQ.offers.length}
                </span>
              )}
            </h3>
            {!selectedRFQ.offers || selectedRFQ.offers.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--v22-text-muted)', margin: 0 }}>
                {isFR ? 'Aucune offre reçue pour le moment. Les fournisseurs ont reçu votre demande par email.' : 'Nenhuma proposta recebida ainda. Os fornecedores receberam o seu pedido por email.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--v22-bg)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Fournisseur' : 'Fornecedor'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Prix HT' : 'Preço s/IVA'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Délai (j)' : 'Prazo (dias)'}</th>
                      <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Statut' : 'Estado'}</th>
                      <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Reçu le' : 'Recebido em'}</th>
                      {selectedRFQ.status !== 'closed' && (
                        <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Action' : 'Ação'}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRFQ.offers as Offer[]).map(offer => (
                      <tr key={offer.id} style={{ background: offer.status === 'accepted' ? 'rgba(209,250,229,0.3)' : 'transparent' }}>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', fontWeight: 500 }}>{offer.supplier_name}</td>
                        <td style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid var(--v22-border)', fontWeight: 600, color: offer.total_price ? 'var(--v22-text)' : 'var(--v22-text-muted)' }}>
                          {formatPrice(offer.total_price)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}>
                          {offer.delivery_days ?? '—'}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)' }}>
                          {offerStatusBadge(offer.status)}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)', fontSize: 12 }}>
                          {formatDate(offer.created_at)}
                        </td>
                        {selectedRFQ.status !== 'closed' && (
                          <td style={{ padding: '10px', borderBottom: '1px solid var(--v22-border)' }}>
                            {offer.status === 'pending' && offer.total_price != null && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="v22-btn v22-btn-primary"
                                  style={{ padding: '4px 12px', fontSize: 12 }}
                                  disabled={actionLoading === offer.id}
                                  onClick={() => handleAcceptOffer(offer.id)}
                                >
                                  {actionLoading === offer.id ? '...' : (isFR ? 'Accepter' : 'Aceitar')}
                                </button>
                                <button
                                  className="v22-btn"
                                  style={{ padding: '4px 12px', fontSize: 12 }}
                                  disabled={actionLoading === offer.id}
                                  onClick={() => handleRejectOffer(offer.id)}
                                >
                                  {isFR ? 'Refuser' : 'Recusar'}
                                </button>
                              </div>
                            )}
                            {offer.status === 'pending' && offer.total_price == null && (
                              <span style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>
                                {isFR ? 'En attente de réponse' : 'Aguarda resposta'}
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
            <div className="v22-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--v22-text-muted)', fontSize: 13 }}>
                {isFR ? 'Chargement...' : 'A carregar...'}
              </p>
            </div>
          ) : rfqs.length === 0 ? (
            <div className="v22-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>
                {isFR ? 'Aucune demande de devis' : 'Sem pedidos de orçamento'}
              </h3>
              <p style={{ color: 'var(--v22-text-muted)', fontSize: 13, margin: '0 0 20px' }}>
                {isFR
                  ? 'Créez votre première demande pour obtenir des devis de vos fournisseurs habituels.'
                  : 'Crie o primeiro pedido para obter orçamentos dos seus fornecedores.'}
              </p>
              <button className="v22-btn v22-btn-primary" onClick={() => setShowCreate(true)}>
                + {isFR ? 'Créer une demande' : 'Criar pedido'}
              </button>
            </div>
          ) : (
            <div className="v22-card">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--v22-bg)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Référence' : 'Referência'}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Articles' : 'Artigos'}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Offres' : 'Propostas'}</th>
                    <th style={{ padding: '8px 12px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Statut' : 'Estado'}</th>
                    <th style={{ padding: '8px 12px', borderBottom: '2px solid var(--v22-border)', fontSize: 11, color: 'var(--v22-text-muted)', textTransform: 'uppercase' }}>{isFR ? 'Date' : 'Data'}</th>
                    <th style={{ padding: '8px 12px', borderBottom: '2px solid var(--v22-border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rfqs.map(rfq => (
                    <tr key={rfq.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRFQ(rfq)}>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--v22-border)', fontWeight: 600 }}>
                        {rfq.title}
                        {rfq.message && (
                          <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2, fontWeight: 400 }}>
                            {rfq.message.length > 60 ? rfq.message.slice(0, 60) + '…' : rfq.message}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)' }}>
                        {rfq.rfq_items?.length ?? 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--v22-border)' }}>
                        {rfq.offers && rfq.offers.length > 0 ? (
                          <span style={{ background: 'var(--v22-yellow)', color: '#0d0d0d', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3 }}>
                            {rfq.offers.length}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--v22-text-muted)', fontSize: 12 }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--v22-border)' }}>
                        {statusBadge(rfq.status)}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--v22-border)', color: 'var(--v22-text-muted)', fontSize: 12 }}>
                        {formatDate(rfq.created_at)}
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--v22-border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--v22-yellow)', fontWeight: 500 }}>
                          {isFR ? 'Voir →' : 'Ver →'}
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
        <div className="v22-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="v22-modal v22-modal--tall">
            <div className="v22-modal-head">
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {isFR ? 'Nouvelle demande de devis pro' : 'Novo pedido de orçamento'}
              </span>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--v22-text-muted)', padding: '0 4px' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="v22-modal-body">
                {/* Title */}
                <div style={{ marginBottom: 16 }}>
                  <label className="v22-form-label">
                    {isFR ? 'Titre de la demande *' : 'Título do pedido *'}
                  </label>
                  <input
                    className="v22-form-input"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={isFR ? 'Ex: Matériaux chantier Marseille — Lot 3' : 'Ex: Materiais obra Marco de Canaveses — Lote 2'}
                    required
                  />
                </div>

                {/* Message */}
                <div style={{ marginBottom: 20 }}>
                  <label className="v22-form-label">
                    {isFR ? 'Message aux fournisseurs (optionnel)' : 'Mensagem aos fornecedores (opcional)'}
                  </label>
                  <textarea
                    className="v22-form-input"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={2}
                    placeholder={isFR ? 'Précisions sur le chantier, délais souhaités...' : 'Detalhes da obra, prazos desejados...'}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Items */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label className="v22-form-label" style={{ margin: 0 }}>
                      {isFR ? 'Matériaux / Produits *' : 'Materiais / Produtos *'}
                    </label>
                    <button
                      type="button"
                      className="v22-btn"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={addItem}
                    >
                      + {isFR ? 'Ajouter' : 'Adicionar'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((item, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--v22-border)', borderRadius: 4, padding: '12px', background: 'var(--v22-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v22-text-muted)' }}>
                            {isFR ? `Produit ${idx + 1}` : `Produto ${idx + 1}`}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--v22-text-muted)', padding: '0 4px' }}
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Row 1: product name + ref */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label className="v22-form-label" style={{ fontSize: 11 }}>
                              {isFR ? 'Nom du produit *' : 'Nome do produto *'}
                            </label>
                            <input
                              className="v22-form-input"
                              type="text"
                              value={item.product_name}
                              onChange={e => updateItem(idx, 'product_name', e.target.value)}
                              placeholder={isFR ? 'Ex: Parpaing 20×20×50' : 'Ex: Bloco de betão 20×20×50'}
                              required
                            />
                          </div>
                          <div>
                            <label className="v22-form-label" style={{ fontSize: 11 }}>
                              {isFR ? 'Réf. fabricant' : 'Ref. fabricante'}
                            </label>
                            <input
                              className="v22-form-input"
                              type="text"
                              value={item.product_ref}
                              onChange={e => updateItem(idx, 'product_ref', e.target.value)}
                              placeholder="REF-001"
                            />
                          </div>
                        </div>

                        {/* Row 2: qty + unit + category */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label className="v22-form-label" style={{ fontSize: 11 }}>
                              {isFR ? 'Quantité' : 'Quantidade'}
                            </label>
                            <input
                              className="v22-form-input"
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="v22-form-label" style={{ fontSize: 11 }}>
                              {isFR ? 'Unité' : 'Unidade'}
                            </label>
                            <select
                              className="v22-form-input"
                              value={item.unit}
                              onChange={e => updateItem(idx, 'unit', e.target.value)}
                            >
                              {units.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="v22-form-label" style={{ fontSize: 11 }}>
                              {isFR ? 'Catégorie' : 'Categoria'}
                            </label>
                            <select
                              className="v22-form-input"
                              value={item.category}
                              onChange={e => updateItem(idx, 'category', e.target.value)}
                            >
                              <option value="">{isFR ? '— Choisir —' : '— Escolher —'}</option>
                              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Row 3: notes */}
                        <div>
                          <label className="v22-form-label" style={{ fontSize: 11 }}>
                            {isFR ? 'Notes (optionnel)' : 'Notas (opcional)'}
                          </label>
                          <input
                            className="v22-form-input"
                            type="text"
                            value={item.notes}
                            onChange={e => updateItem(idx, 'notes', e.target.value)}
                            placeholder={isFR ? 'Couleur, épaisseur, qualité...' : 'Cor, espessura, qualidade...'}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="v22-modal-foot">
                <button
                  type="button"
                  className="v22-btn"
                  onClick={() => setShowCreate(false)}
                  disabled={submitting}
                >
                  {isFR ? 'Annuler' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  className="v22-btn v22-btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? (isFR ? 'Envoi...' : 'A enviar...')
                    : (isFR ? 'Envoyer aux fournisseurs →' : 'Enviar aos fornecedores →')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
