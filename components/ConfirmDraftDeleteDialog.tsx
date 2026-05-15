'use client'

import { useEffect } from 'react'
import { useLocale, useTranslation } from '@/lib/i18n/context'

interface ConfirmDraftDeleteDialogProps {
  open: boolean
  docType: 'devis' | 'facture'
  /** Numéro doc OU client OU titre — ce qui identifie le brouillon pour l'utilisateur. */
  label: string
  onConfirm: () => void
  onClose: () => void
}

/**
 * Modal de confirmation pour suppression brouillon (devis/facture non émis).
 * Remplace window.confirm() pour cohérence visuelle avec DocumentCancelModal.
 *
 * Spec :
 * - Action irréversible mais sans conséquence comptable (brouillon = non émis)
 * - Pas de raison à saisir (vs. DocumentCancelModal qui exige une raison)
 * - Bouton primaire rouge, action explicite ("Supprimer")
 */
export default function ConfirmDraftDeleteDialog({
  open, docType, label, onConfirm, onClose,
}: ConfirmDraftDeleteDialogProps) {
  const { t: _t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, onConfirm])

  if (!open) return null

  const docNoun = docType === 'facture'
    ? (isPt ? 'fatura' : 'facture')
    : (isPt ? 'orçamento' : 'devis')

  const title = isPt
    ? `Eliminar rascunho`
    : `Supprimer le brouillon`

  const body = isPt
    ? `Tem a certeza de que pretende eliminar este ${docNoun} em rascunho ?`
    : `Êtes-vous sûr de vouloir supprimer ${docType === 'facture' ? 'cette' : 'ce'} ${docNoun} en brouillon ?`

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
        aria-labelledby="confirm-draft-delete-title"
        style={{
          position: 'relative',
          background: '#fff', borderRadius: 12, padding: 24,
          maxWidth: 420, width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        }}
      >
        <h3
          id="confirm-draft-delete-title"
          style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}
        >
          {title}
        </h3>

        <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5, color: '#374151' }}>
          {body}
        </p>
        <p style={{
          margin: '0 0 18px',
          fontSize: 13, lineHeight: 1.45, color: '#6B7280',
          padding: 10, background: '#F9FAFB', borderRadius: 6,
          border: '1px solid #E5E7EB',
        }}>
          <strong>{label}</strong>
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="v22-btn v22-btn-sm"
            autoFocus
          >
            {isPt ? 'Cancelar' : 'Annuler'}
          </button>
          <button
            onClick={onConfirm}
            className="v22-btn v22-btn-sm"
            style={{ background: '#DC2626', color: '#fff', borderColor: '#DC2626' }}
          >
            {isPt ? 'Eliminar' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
