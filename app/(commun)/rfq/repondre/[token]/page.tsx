'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface RFQItem { id: string; product_name: string; quantity: number; unit: string; notes?: string }
interface OfferData {
  id: string; token: string; supplier_name: string; status: string;
  rfqs: { title: string; message?: string; country: string; rfq_items: RFQItem[] }
}

export default function SupplierResponsePage() {
  const { token } = useParams<{ token: string }>()
  const [offer, setOffer] = useState<OfferData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [comment, setComment] = useState('')
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({})

  const isFR = offer?.rfqs?.country === 'FR'

  useEffect(() => {
    fetch(`/api/rfq/offer/${token}`)
      .then(r => r.json())
      .then(d => { setOffer(d.offer); setLoading(false) })
      .catch(() => { setError('Lien invalide'); setLoading(false) })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const items = offer!.rfqs.rfq_items.map(i => ({
        rfq_item_id: i.id,
        product_name: i.product_name,
        unit_price: parseFloat(itemPrices[i.id] || '0'),
        quantity: i.quantity,
      }))
      const res = await fetch(`/api/rfq/offer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_price: parseFloat(totalPrice) || null,
          delivery_days: parseInt(deliveryDays) || null,
          comment,
          items,
        }),
      })
      if (!res.ok) throw new Error('Error')
      setSubmitted(true)
    } catch {
      setError(isFR ? "Erreur lors de l'envoi" : 'Erro ao enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
      <p style={{ color: '#888' }}>Chargement...</p>
    </div>
  )

  if (error || !offer) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: '#c0392b' }}>{error || 'Lien introuvable'}</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{isFR ? 'Offre envoyée !' : 'Proposta enviada!'}</h1>
        <p style={{ color: '#555', fontSize: 14 }}>{isFR ? 'Votre réponse a bien été transmise au client.' : 'A sua proposta foi enviada ao cliente.'}</p>
      </div>
    </div>
  )

  if (offer.status !== 'pending') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5', fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
      <p style={{ color: '#888' }}>{isFR ? 'Cette demande est déjà traitée.' : 'Este pedido já foi processado.'}</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'IBM Plex Sans, Arial, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: '#0d0d0d', borderRadius: '6px 6px 0 0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#ffd600', fontWeight: 700, fontSize: 18 }}>VITFIX</span>
          <span style={{ color: '#666', fontSize: 13 }}>— {isFR ? 'Réponse à une demande de devis' : 'Resposta a pedido de orçamento'}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '28px 24px' }}>
          {/* RFQ Info */}
          <div style={{ background: '#f7f7f5', border: '1px solid #e8e8e4', borderRadius: 4, padding: '14px 16px', marginBottom: 24 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isFR ? 'Référence demande' : 'Referência'}
            </p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0d0d0d' }}>{offer.rfqs.title}</p>
            {offer.rfqs.message && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#555' }}>{offer.rfqs.message}</p>}
          </div>

          {/* Items table */}
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isFR ? 'Matériaux demandés' : 'Materiais solicitados'}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 28 }}>
            <thead>
              <tr style={{ background: '#f7f7f5' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e8e8e4', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{isFR ? 'Produit' : 'Produto'}</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '2px solid #e8e8e4', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{isFR ? 'Qté' : 'Qtd'}</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '2px solid #e8e8e4', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{isFR ? 'Prix unitaire HT' : 'Preço unit. s/IVA'}</th>
              </tr>
            </thead>
            <tbody>
              {offer.rfqs.rfq_items.map(item => (
                <tr key={item.id}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #e8e8e4' }}>
                    <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                    {item.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.notes}</div>}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #e8e8e4', color: '#555' }}>{item.quantity} {item.unit}</td>
                  <td style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #e8e8e4' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={itemPrices[item.id] || ''}
                      onChange={e => setItemPrices(p => ({ ...p, [item.id]: e.target.value }))}
                      style={{ width: 90, padding: '4px 8px', border: '1px solid #d0d0c8', borderRadius: 3, fontSize: 13, textAlign: 'right' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {isFR ? 'Prix total HT (€)' : 'Preço total s/IVA (€)'}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={totalPrice} onChange={e => setTotalPrice(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0c8', borderRadius: 3, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {isFR ? 'Délai de livraison (jours)' : 'Prazo de entrega (dias)'}
                </label>
                <input
                  type="number" min="1"
                  value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)}
                  placeholder="5"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0c8', borderRadius: 3, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {isFR ? 'Commentaire (optionnel)' : 'Comentário (opcional)'}
              </label>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder={isFR ? 'Conditions particulières, questions...' : 'Condições especiais, observações...'}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d0d0c8', borderRadius: 3, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button
              type="submit" disabled={submitting}
              style={{ background: '#ffd600', color: '#0d0d0d', border: 'none', borderRadius: 4, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? '...' : (isFR ? 'Envoyer mon offre →' : 'Enviar proposta →')}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 16 }}>Vitfix.io — Plateforme professionnels BTP</p>
      </div>
    </div>
  )
}
