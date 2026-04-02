'use client'

import React, { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { getCategoryLabel } from './shared'

interface WonContractsTabViewProps {
  isPt: boolean
  locale: string
  wonBids: any[]
  receivedEval: Record<string, any>
  onGoToBrowse: () => void
  onSubmitEvaluation: (marcheId: string, candidatureId: string, rating: number, comment: string) => Promise<void>
  onLoadReceivedEvaluation: (marcheId: string) => void
}

export default function WonContractsTabView({
  isPt, locale, wonBids, receivedEval,
  onGoToBrowse, onSubmitEvaluation, onLoadReceivedEvaluation,
}: WonContractsTabViewProps) {
  const [evalBidId, setEvalBidId] = useState<string | null>(null)
  const [evalRating, setEvalRating] = useState(0)
  const [evalComment, setEvalComment] = useState('')
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [evalSuccess, setEvalSuccess] = useState(false)

  const handleSubmit = async (marcheId: string, candidatureId: string) => {
    if (evalRating < 1 || evalSubmitting) return
    setEvalSubmitting(true)
    try {
      await onSubmitEvaluation(marcheId, candidatureId, evalRating, evalComment.trim())
      setEvalSuccess(true)
      setEvalBidId(null)
      setEvalRating(0)
      setEvalComment('')
      setTimeout(() => setEvalSuccess(false), 3000)
    } finally {
      setEvalSubmitting(false)
    }
  }

  if (wonBids.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          {isPt ? 'Nenhum contrato ganho ainda' : 'Aucun contrat remporté pour l\'instant'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto', marginBottom: 14 }}>
          {isPt
            ? 'Continue a candidatar-se aos mercados. Os seus contratos ganhos aparecerão aqui.'
            : 'Continuez à postuler aux marchés. Vos contrats remportés apparaîtront ici.'}
        </div>
        <button
          onClick={onGoToBrowse}
          className="v22-btn v22-btn-primary"
        >
          {isPt ? 'Ver mercados' : 'Voir les marchés'} →
        </button>
      </div>
    )
  }

  return (
    <div className="v22-card">
      <div className="v22-card-head">
        <div className="v22-card-title">{isPt ? 'Contratos ganhos' : 'Contrats gagnés'}</div>
        <div className="v22-card-meta">{wonBids.length}</div>
      </div>
      <div>
        {wonBids.map((bid) => (
          <div key={bid.id} style={{ padding: 14, borderBottom: '1px solid #F0F0EE' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <span className="v22-tag v22-tag-green">✅ {isPt ? 'Contrato ganho' : 'Contrat remporté'}</span>
                  <span className="v22-tag v22-tag-yellow">
                    {getCategoryLabel(bid.marche_category || bid.category, isPt)}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
                </div>
                {bid.marche_city && (
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 4 }}>📍 {bid.marche_city}</div>
                )}
                {bid.marche_description && (
                  <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                    {bid.marche_description}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, background: 'var(--v22-bg)', borderRadius: 3, padding: '10px 14px', border: '1px solid var(--v22-border)', minWidth: 160 }}>
                <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="v22-mono">
                  {isPt ? 'O seu preço' : 'Votre prix'}
                </div>
                <div className="v22-mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--v22-green)', marginBottom: 8 }}>
                  {formatPrice(bid.price, locale)}
                </div>
                {bid.publisher_contact && (
                  <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 8, marginTop: 8 }}>
                    <div className="v22-mono" style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {isPt ? 'Contacto' : 'Contact'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{bid.publisher_contact.name}</div>
                    {bid.publisher_contact.email && (
                      <a href={`mailto:${bid.publisher_contact.email}`} style={{ fontSize: 11, color: '#1A56DB' }}>
                        {bid.publisher_contact.email}
                      </a>
                    )}
                    {bid.publisher_contact.phone && (
                      <div style={{ fontSize: 11, color: 'var(--v22-text-mid)' }}>{bid.publisher_contact.phone}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Evaluation section */}
            <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 10, marginTop: 10 }}>
              {/* Received evaluation from publisher */}
              {receivedEval[bid.marche_id] && (
                <div style={{ marginBottom: 10, borderRadius: 3, background: '#E8F0FE', border: '1px solid #B6D4FE', padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A56DB', marginBottom: 6 }}>
                    &#x2B50; {isPt ? 'Avaliação recebida do cliente' : 'Évaluation reçue du donneur d\'ordre'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} style={{ fontSize: 14, color: s <= receivedEval[bid.marche_id].note_globale ? '#D4A00A' : 'var(--v22-border)' }}>
                        &#x2605;
                      </span>
                    ))}
                    <span className="v22-mono" style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>{receivedEval[bid.marche_id].note_globale}/5</span>
                  </div>
                  {receivedEval[bid.marche_id].comment && (
                    <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', fontStyle: 'italic', marginTop: 4 }}>
                      &quot;{receivedEval[bid.marche_id].comment}&quot;
                    </div>
                  )}
                </div>
              )}

              {/* Evaluate this mission */}
              {evalBidId === bid.id ? (
                <div style={{ borderRadius: 3, background: 'var(--v22-amber-light)', border: '1px solid var(--v22-yellow-border)', padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v22-amber)', marginBottom: 8 }}>
                    {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEvalRating(s)}
                        style={{
                          fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          color: s <= evalRating ? '#D4A00A' : 'var(--v22-border)',
                          transition: 'transform 0.1s',
                        }}
                      >
                        &#x2605;
                      </button>
                    ))}
                    {evalRating > 0 && <span className="v22-mono" style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>{evalRating}/5</span>}
                  </div>
                  <textarea
                    value={evalComment}
                    onChange={e => setEvalComment(e.target.value)}
                    rows={3}
                    placeholder={isPt ? 'Comentário (opcional)...' : 'Commentaire (optionnel)...'}
                    className="v22-form-input"
                    style={{ resize: 'none', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setEvalBidId(null); setEvalRating(0); setEvalComment('') }}
                      className="v22-btn"
                      style={{ flex: 1 }}
                    >
                      {isPt ? 'Cancelar' : 'Annuler'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(bid.marche_id || bid.marche?.id, bid.id || bid.my_candidature_id)}
                      disabled={evalRating < 1 || evalSubmitting}
                      className="v22-btn v22-btn-primary"
                      style={{ flex: 1, opacity: (evalRating < 1 || evalSubmitting) ? 0.5 : 1, cursor: (evalRating < 1 || evalSubmitting) ? 'not-allowed' : 'pointer' }}
                    >
                      {evalSubmitting
                        ? (isPt ? 'A enviar...' : 'Envoi...')
                        : (isPt ? 'Enviar avaliação' : 'Envoyer l\'évaluation')}
                    </button>
                  </div>
                </div>
              ) : evalSuccess ? (
                <div style={{ borderRadius: 3, background: 'var(--v22-green-light)', border: '1px solid var(--v22-green)', padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v22-green)' }}>
                    &#x2705; {isPt ? 'Avaliação enviada com sucesso!' : 'Évaluation envoyée avec succès !'}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEvalBidId(bid.id)
                    onLoadReceivedEvaluation(bid.marche_id)
                  }}
                  className="v22-btn"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  &#x2B50; {isPt ? 'Avaliar esta missão' : 'Évaluer cette mission'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
