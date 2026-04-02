'use client'

import React from 'react'
import { formatPrice } from '@/lib/utils'
import { CATEGORIES, getCategoryEmoji } from './shared'

function statusTag(status: string, isPt: boolean) {
  switch (status) {
    case 'accepted':
      return <span className="v22-tag v22-tag-green">✅ {isPt ? 'Aceite' : 'Accepté'}</span>
    case 'rejected':
      return <span className="v22-tag v22-tag-red">❌ {isPt ? 'Recusado' : 'Refusé'}</span>
    case 'withdrawn':
      return <span className="v22-tag v22-tag-gray">↩️ {isPt ? 'Retirado' : 'Retiré'}</span>
    default:
      return <span className="v22-tag v22-tag-yellow">⏳ {isPt ? 'Pendente' : 'En attente'}</span>
  }
}

interface MyBidsTabViewProps {
  isPt: boolean
  locale: string
  myBids: any[]
  onGoToBrowse: () => void
}

export default function MyBidsTabView({ isPt, locale, myBids, onGoToBrowse }: MyBidsTabViewProps) {
  if (myBids.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          {isPt ? 'Nenhuma candidatura' : 'Aucune candidature'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', maxWidth: 360, margin: '0 auto', marginBottom: 14 }}>
          {isPt
            ? 'Ainda não se candidatou a nenhum mercado. Explore os mercados abertos e envie a sua primeira proposta!'
            : 'Vous n\'avez pas encore postulé à un marché. Explorez les marchés ouverts et envoyez votre première proposition !'}
        </div>
        <button
          onClick={onGoToBrowse}
          className="v22-btn v22-btn-primary"
        >
          {isPt ? 'Explorar mercados' : 'Explorer les marchés'} →
        </button>
      </div>
    )
  }

  return (
    <div className="v22-card">
      <div className="v22-card-head">
        <div className="v22-card-title">{isPt ? 'As minhas candidaturas' : 'Mes candidatures'}</div>
        <div className="v22-card-meta">{myBids.length}</div>
      </div>
      <div>
        {myBids.map((bid) => (
          <div
            key={bid.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #F0F0EE' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <span className="v22-tag v22-tag-yellow">
                  {getCategoryEmoji(bid.marche_category || bid.category)} {isPt
                    ? CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.label
                    : CATEGORIES.find(c => c.id === (bid.marche_category || bid.category))?.labelFr
                  }
                </span>
                {statusTag(bid.status, isPt)}
              </div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>
                {bid.marche_title || bid.title || (isPt ? 'Mercado' : 'Marché')}
              </div>
              {bid.marche_city && (
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>📍 {bid.marche_city}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="v22-amount" style={{ fontSize: 14, fontWeight: 600 }}>
                {formatPrice(bid.price, locale)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                {isPt ? 'Prazo:' : 'Délai :'} {bid.timeline || '—'}
              </div>
              {bid.materials_included && (
                <span className="v22-tag v22-tag-green" style={{ marginTop: 2 }}>
                  ✓ {isPt ? 'Materiais' : 'Matériaux'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
