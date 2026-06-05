'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'

interface DocumentCancelModalProps {
  open: boolean
  docType: 'devis' | 'facture'
  docNumber: string
  /** Appelé après succès API. Le caller doit retirer le doc des listes locales. */
  onCancelled: () => void
  onClose: () => void
}

/**
 * Modal d'annulation pour devis/facture émis. Conformité art. L123-22 Code
 * commerce + art. 242 nonies CGI : pas de hard delete, annulation tracée
 * (raison, auteur, timestamp). FR-V1.
 */
export default function DocumentCancelModal({
  open, docType, docNumber, onCancelled, onClose,
}: DocumentCancelModalProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // a11y : Escape ferme la modal
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, submitting, onClose])

  if (!open) return null

  const docLabel = docType === 'facture'
    ? (isPt ? 'fatura' : 'facture')
    : (isPt ? 'orçamento' : 'devis')

  async function handleSubmit() {
    if (reason.trim().length < 5) {
      toast.error(isPt
        ? 'A razão deve ter pelo menos 5 caracteres'
        : 'La raison doit faire au moins 5 caractères')
      return
    }
    setSubmitting(true)
    try {
      // Bearer token requis par /api/document-cancel (cf. lib/auth-helpers.ts
      // getAuthUser : 401 si pas d'Authorization header). Sans ça, l'annulation
      // retourne systématiquement Unauthorized en production.
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {}
      const res = await fetch('/api/document-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ docType, numero: docNumber, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || (isPt ? 'Erro ao anular' : 'Erreur lors de l\'annulation'))
        setSubmitting(false)
        return
      }
      toast.success(isPt
        ? `${docLabel} ${docNumber} anulada`
        : `${docLabel} ${docNumber} annulé${docType === 'facture' ? 'e' : ''}`)
      onCancelled()
      onClose()
    } catch (e) {
      toast.error(isPt ? 'Erro de rede' : 'Erreur réseau')
      console.error('[DocumentCancelModal] submit failed:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const title = isPt
    ? `Anular ${docLabel} ${docNumber}`
    : `Annuler ${docLabel === 'facture' ? 'la' : 'le'} ${docLabel} ${docNumber}`

  const warningMsg = isPt
    ? 'Esta ação não pode ser revertida. O documento permanece no histórico com o estado "Anulado" e a razão indicada (prova fiscal — Código Comercial 10 anos).'
    : 'Cette action est irréversible. Le document reste dans l\'historique avec le statut « Annulé » et la raison saisie (preuve fiscale — conservation 10 ans Code de commerce L123-22).'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <button
        type="button"
        aria-label={isPt ? 'Fechar' : 'Fermer'}
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,.55)',
          border: 'none', padding: 0, cursor: 'pointer',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-cancel-title"
        style={{
          position: 'relative',
          background: '#fff', borderRadius: 12, padding: 24,
          maxWidth: 480, width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <h3 id="doc-cancel-title" style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>{title}</h3>

        <div style={{
          padding: 12, borderRadius: 8, background: '#FEF3C7',
          border: '1px solid #FCD34D', color: '#78350F',
          fontSize: 12, lineHeight: 1.45, marginBottom: 16,
        }}>
          ⚠️ {warningMsg}
        </div>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {isPt ? 'Razão da anulação (5-500 caracteres)' : 'Raison de l\'annulation (5-500 caractères)'}
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value.slice(0, 500))}
          placeholder={isPt ? 'Ex: erro de cliente, anulação por avenant...' : 'Ex: erreur de client, annulation suite à avenant...'}
          rows={4}
          maxLength={500}
          autoFocus
          style={{
            width: '100%', padding: 10, borderRadius: 6,
            border: '1px solid #D1D5DB', fontSize: 13,
            fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
          {reason.length} / 500
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            className="v22-btn v22-btn-sm"
            style={{ opacity: submitting ? 0.5 : 1 }}
          >
            {t('common.cancel') || (isPt ? 'Cancelar' : 'Annuler')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 5}
            className="v22-btn v22-btn-sm"
            style={{
              background: '#DC2626', color: '#fff',
              opacity: (submitting || reason.trim().length < 5) ? 0.5 : 1,
            }}
          >
            {submitting
              ? (isPt ? 'A processar…' : 'Traitement…')
              : (isPt ? 'Confirmar anulação' : 'Confirmer l\'annulation')}
          </button>
        </div>
      </div>
    </div>
  )
}
