'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { getCategoryLabel, daysRemaining, TIMELINE_OPTIONS } from './shared'

function urgencyTag(urgency: string, isPt: boolean) {
  switch (urgency) {
    case 'emergency':
      return <span className="v22-tag v22-tag-red">🔴 {isPt ? 'Emergência' : 'Urgence'}</span>
    case 'urgent':
      return <span className="v22-tag v22-tag-amber">🟡 {isPt ? 'Urgente' : 'Urgent'}</span>
    default:
      return <span className="v22-tag v22-tag-green">🟢 {isPt ? 'Normal' : 'Normal'}</span>
  }
}

function publisherTag(type: string, isPt: boolean) {
  switch (type) {
    case 'syndic':
      return <span className="v22-tag" style={{ background: '#E8F0FE', color: '#1A56DB' }}>🏢 Syndic</span>
    case 'entreprise':
      return <span className="v22-tag" style={{ background: '#F3E8FF', color: '#7C3AED' }}>🏭 {isPt ? 'Empresa' : 'Entreprise'}</span>
    default:
      return <span className="v22-tag v22-tag-gray">👤 {isPt ? 'Particular' : 'Particulier'}</span>
  }
}

interface DetailModalViewProps {
  isPt: boolean
  locale: string
  isSociete: boolean
  selectedMarche: any
  artisan: any
  // Messaging
  messages: any[]
  msgLoading: boolean
  msgSending: boolean
  msgInput: string
  msgCandidatureId: string | null
  onMsgInputChange: (v: string) => void
  onMsgCandidatureIdChange: (v: string | null) => void
  onLoadMessages: (marcheId: string, candidatureId: string) => void
  onSendMessage: (marcheId: string, candidatureId: string) => void
  // Bid
  onSubmitBid: (e: React.FormEvent) => void
  bidSubmitting: boolean
  bidError: string
  bidSuccess: boolean
  showBidForm: boolean
  onShowBidFormChange: (v: boolean) => void
  bidPrice: string
  bidTimeline: string
  bidDescription: string
  bidMaterials: boolean
  bidGuarantee: string
  bidEffectif: string
  onBidPriceChange: (v: string) => void
  onBidTimelineChange: (v: string) => void
  onBidDescriptionChange: (v: string) => void
  onBidMaterialsChange: (v: boolean) => void
  onBidGuaranteeChange: (v: string) => void
  onBidEffectifChange: (v: string) => void
  onBidErrorChange: (v: string) => void
  // Close
  onClose: () => void
}

export default function DetailModalView({
  isPt, locale, isSociete, selectedMarche, artisan,
  messages, msgLoading, msgSending, msgInput, msgCandidatureId,
  onMsgInputChange, onMsgCandidatureIdChange, onLoadMessages, onSendMessage,
  onSubmitBid, bidSubmitting, bidError, bidSuccess,
  showBidForm, onShowBidFormChange,
  bidPrice, bidTimeline, bidDescription, bidMaterials, bidGuarantee, bidEffectif,
  onBidPriceChange, onBidTimelineChange, onBidDescriptionChange,
  onBidMaterialsChange, onBidGuaranteeChange, onBidEffectifChange, onBidErrorChange,
  onClose,
}: DetailModalViewProps) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null)

  const days = selectedMarche.deadline ? daysRemaining(selectedMarche.deadline) : null
  const photos: string[] = selectedMarche.photos || []

  return (
    <div className="v22-modal-overlay" onClick={onClose}>
      <div className="v22-modal" style={{ width: 680, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Modal head */}
        <div className="v22-modal-head">
          <div className="v22-modal-title">
            {isPt ? 'Detalhe do mercado' : 'Détail du marché'}
          </div>
          <button className="v22-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Modal body */}
        <div className="v22-modal-body">
          {/* Tags row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span className="v22-tag v22-tag-yellow">
              {getCategoryLabel(selectedMarche.category, isPt)}
            </span>
            {urgencyTag(selectedMarche.urgency, isPt)}
            {publisherTag(selectedMarche.publisher_type, isPt)}
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{selectedMarche.title}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 12 }}>
            {selectedMarche.city && (
              <span>📍 {selectedMarche.city}</span>
            )}
            {days !== null && (
              <span>
                ⏰ {days > 0
                  ? (isPt ? `${days} dias restantes` : `${days} jours restants`)
                  : (isPt ? 'Prazo expirado' : 'Délai expiré')}
              </span>
            )}
            {selectedMarche.candidatures_count !== undefined && (
              <span>
                👥 {selectedMarche.candidatures_count} {isPt ? 'candidaturas' : 'candidatures'}
              </span>
            )}
          </div>

          {/* Budget */}
          {(selectedMarche.budget_min || selectedMarche.budget_max) ? (
            <div style={{ background: 'var(--v22-yellow-light)', borderRadius: 3, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="v22-mono">
                {isPt ? 'Orçamento' : 'Budget'}
              </div>
              <div className="v22-mono" style={{ fontSize: 16, fontWeight: 600 }}>
                {selectedMarche.budget_min ? formatPrice(selectedMarche.budget_min, locale) : '—'}
                {' — '}
                {selectedMarche.budget_max ? formatPrice(selectedMarche.budget_max, locale) : '—'}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--v22-bg)', borderRadius: 3, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
              {isPt ? 'Orçamento não definido' : 'Budget non défini'}
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{isPt ? 'Descrição' : 'Description'}</div>
            <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {selectedMarche.description || (isPt ? 'Sem descrição.' : 'Aucune description.')}
            </div>
          </div>

          {/* Photos gallery */}
          {photos.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{isPt ? 'Fotos' : 'Photos'} ({photos.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {photos.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPhotoIdx(idx)}
                    style={{ aspectRatio: '1', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--v22-border)', cursor: 'pointer', padding: 0, background: 'none', position: 'relative' }}
                  >
                    <Image src={url} alt={`Photo ${idx + 1}`} fill style={{ objectFit: 'cover' }} />
                  </button>
                ))}
              </div>

              {/* Lightbox */}
              {selectedPhotoIdx !== null && (
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={() => setSelectedPhotoIdx(null)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(null) }}
                    style={{ position: 'absolute', top: 16, right: 16, color: '#fff', fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', zIndex: 301 }}
                  >
                    ✕
                  </button>
                  {selectedPhotoIdx > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx - 1) }}
                      style={{ position: 'absolute', left: 16, color: '#fff', fontSize: 32, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ‹
                    </button>
                  )}
                  {selectedPhotoIdx < photos.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPhotoIdx(selectedPhotoIdx + 1) }}
                      style={{ position: 'absolute', right: 16, color: '#fff', fontSize: 32, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ›
                    </button>
                  )}
                  <Image
                    src={photos[selectedPhotoIdx]}
                    alt={`Photo ${selectedPhotoIdx + 1}`}
                    width={1200}
                    height={900}
                    style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 4, objectFit: 'contain' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          )}

          {/* Message thread */}
          {selectedMarche.my_candidature_id && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                &#x1F4AC; {isPt ? 'Mensagens' : 'Messages'}
              </div>

              {!msgCandidatureId ? (
                <button
                  onClick={() => {
                    onMsgCandidatureIdChange(selectedMarche.my_candidature_id)
                    onLoadMessages(selectedMarche.id, selectedMarche.my_candidature_id)
                  }}
                  className="v22-btn"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  {isPt ? 'Abrir conversa com o publicador' : 'Ouvrir la conversation avec le donneur d\'ordre'}
                </button>
              ) : (
                <div>
                  {/* Messages list */}
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {msgLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                        <div style={{ width: 20, height: 20, border: '2px solid var(--v22-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : messages.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', textAlign: 'center', padding: '20px 0' }}>
                        {isPt ? 'Nenhuma mensagem ainda. Inicie a conversa!' : 'Aucun message pour l\'instant. Lancez la conversation !'}
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div
                          key={msg.id || idx}
                          style={{ display: 'flex', justifyContent: msg.sender_type === 'artisan' ? 'flex-end' : 'flex-start' }}
                        >
                          <div style={{
                            maxWidth: '80%', borderRadius: 3, padding: '8px 10px', fontSize: 12,
                            background: msg.sender_type === 'artisan' ? 'var(--v22-yellow-light)' : 'var(--v22-bg)',
                            color: 'var(--v22-text)',
                          }}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 4 }}>
                              {new Date(msg.created_at).toLocaleString(isPt ? 'pt-PT' : 'fr-FR', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={msgInput}
                      onChange={e => onMsgInputChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          onSendMessage(selectedMarche.id, selectedMarche.my_candidature_id)
                        }
                      }}
                      placeholder={isPt ? 'Escreva a sua mensagem...' : 'Écrivez votre message...'}
                      className="v22-form-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => onSendMessage(selectedMarche.id, selectedMarche.my_candidature_id)}
                      disabled={!msgInput.trim() || msgSending}
                      className="v22-btn v22-btn-primary"
                      style={{ opacity: (!msgInput.trim() || msgSending) ? 0.5 : 1, cursor: (!msgInput.trim() || msgSending) ? 'not-allowed' : 'pointer' }}
                    >
                      {msgSending ? '...' : (isPt ? 'Enviar' : 'Envoyer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bid form area */}
          {!showBidForm ? (
            <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {isPt ? 'Interessado?' : 'Intéressé ?'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginBottom: 12 }}>
                {isPt
                  ? 'Envie a sua candidatura com o seu preço e prazo estimado.'
                  : 'Envoyez votre candidature avec votre prix et délai estimé.'}
              </div>
              <button
                onClick={() => onShowBidFormChange(true)}
                className="v22-btn v22-btn-primary"
                style={{ width: '100%' }}
              >
                {isPt ? 'Candidatar-me' : 'Postuler'} 🚀
              </button>
            </div>
          ) : bidSuccess ? (
            <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14, textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v22-green)', marginBottom: 6 }}>
                {isPt ? 'Candidatura enviada!' : 'Candidature envoyée !'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>
                {isPt
                  ? 'Receberá uma notificação quando o cliente responder.'
                  : 'Vous recevrez une notification quand le client répondra.'}
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmitBid} style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                {isPt ? 'A sua proposta' : 'Votre proposition'}
              </div>

              {bidError && (
                <div className="v22-alert v22-alert-red" style={{ marginBottom: 10, fontSize: 12 }}>{bidError}</div>
              )}

              {/* Price */}
              <div style={{ marginBottom: 10 }}>
                <label className="v22-form-label">
                  {isPt ? 'Preço (€)' : 'Prix (€)'} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={bidPrice}
                  onChange={e => onBidPriceChange(e.target.value)}
                  placeholder="ex: 5000"
                  className="v22-form-input"
                />
              </div>

              {/* Timeline */}
              <div style={{ marginBottom: 10 }}>
                <label className="v22-form-label">
                  {isPt ? 'Prazo estimado' : 'Délai estimé'} *
                </label>
                <select
                  required
                  value={bidTimeline}
                  onChange={e => onBidTimelineChange(e.target.value)}
                  className="v22-form-input"
                >
                  <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                  {TIMELINE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {isPt ? opt.labelPt : opt.labelFr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 10 }}>
                <label className="v22-form-label">
                  {isPt ? 'Descrição da proposta' : 'Description de la proposition'} *
                </label>
                <textarea
                  required
                  value={bidDescription}
                  onChange={e => onBidDescriptionChange(e.target.value)}
                  rows={4}
                  placeholder={isPt
                    ? 'Descreva a sua abordagem, experiência e o que inclui...'
                    : 'Décrivez votre approche, expérience et ce qui est inclus...'}
                  className="v22-form-input"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Materials toggle */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    style={{
                      width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                      background: bidMaterials ? 'var(--v22-yellow)' : 'var(--v22-border)',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => onBidMaterialsChange(!bidMaterials)}
                  >
                    <div style={{
                      position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--v22-surface)', transition: 'left 0.15s',
                      left: bidMaterials ? 18 : 2,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--v22-text-mid)' }}>
                    {isPt ? 'Materiais incluídos' : 'Matériaux inclus'}
                  </span>
                </label>
              </div>

              {/* Guarantee */}
              <div style={{ marginBottom: 14 }}>
                <label className="v22-form-label">
                  {isPt ? 'Garantia (opcional)' : 'Garantie (optionnel)'}
                </label>
                <input
                  type="text"
                  value={bidGuarantee}
                  onChange={e => onBidGuaranteeChange(e.target.value)}
                  placeholder={isPt ? 'Ex: 2 anos' : 'Ex : 2 ans'}
                  className="v22-form-input"
                />
              </div>

              {/* Effectif -- pro_societe uniquement */}
              {isSociete && (
                <div style={{ marginBottom: 14 }}>
                  <label className="v22-form-label">
                    👷 {isPt ? 'Efectivo mobilizável (companheiros)' : 'Effectif mobilisable (compagnons)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={bidEffectif}
                    onChange={e => onBidEffectifChange(e.target.value)}
                    placeholder={isPt ? 'Ex: 8' : 'Ex : 8'}
                    className="v22-form-input"
                  />
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { onShowBidFormChange(false); onBidErrorChange('') }}
                  className="v22-btn"
                  style={{ flex: 1 }}
                >
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={bidSubmitting}
                  className="v22-btn v22-btn-primary"
                  style={{ flex: 1, opacity: bidSubmitting ? 0.5 : 1, cursor: bidSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {bidSubmitting
                    ? (isPt ? 'A enviar...' : 'Envoi...')
                    : (isPt ? 'Enviar proposta' : 'Envoyer la proposition')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
