'use client'

import { useCallback, useRef } from 'react'
import { useToast } from '../primitives/toast'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { HOOKS_MESSAGES } from './i18n/hooks.messages'
import { enTetesLea } from './use-lea-documents'

/** Types de documents acceptés par l'endpoint Léa `/api/syndic/lea-documents/upload`. */
export type SyndicDocType =
  | 'facture_artisan'
  | 'facture_syndic'
  | 'devis'
  | 'contrat'
  | 'rib'
  | 'ata_ag'
  | 'releve_bancaire'
  | 'pv_assemblee'
  | 'autre'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp'

/**
 * Upload de documents vers le pipeline Léa (Storage + OCR async + indexation RAG),
 * via l'endpoint existant `POST /api/syndic/lea-documents/upload`.
 *
 * Calque le pattern factory de `useComingSoon` : `upload(type)` renvoie un handler
 * `onClick` qui ouvre le sélecteur de fichier natif puis envoie le fichier choisi.
 * Feedback intégral par toast (chargement → succès/erreur, avertissement de quota).
 * Un garde `busyRef` empêche deux uploads concurrents depuis le même hook.
 *
 * @param onUploaded callback optionnel exécuté après un upload réussi (ex. refresh liste).
 */
export function useDocumentUpload(onUploaded?: () => void) {
  const { push } = useToast()
  const t = useMessages(HOOKS_MESSAGES).upload
  // Messages d'erreur mappés sur les codes renvoyés par l'endpoint upload.
  const erreurs: Record<string, string> = t.erreurs
  const { token } = useSyndicData()
  const busyRef = useRef(false)

  return useCallback(
    (type: SyndicDocType = 'autre') =>
      () => {
        if (busyRef.current) return
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = ACCEPT
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return
          busyRef.current = true
          push({ kind: 'info', title: t.enCours, desc: file.name })
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', type)
            // Pas de Content-Type : le navigateur pose la frontière multipart du FormData.
            const res = await fetch('/api/syndic/lea-documents/upload', { method: 'POST', body: fd, headers: enTetesLea(token) })
            const data = (await res.json().catch(() => ({}))) as {
              error?: string
              document?: { filename?: string }
              quota?: { warning?: boolean }
            }
            if (!res.ok) {
              const code = typeof data.error === 'string' ? data.error : ''
              push({ kind: 'error', title: t.echec, desc: erreurs[code] ?? t.echecGenerique })
              return
            }
            const fname = data.document?.filename ?? file.name
            push({ kind: 'success', title: t.charge, desc: t.traitementLea(fname) })
            if (data.quota?.warning) {
              push({ kind: 'warning', title: t.quotaTitre, desc: t.quotaDetail })
            }
            onUploaded?.()
          } catch {
            push({ kind: 'error', title: t.erreurReseau, desc: t.serveurInjoignable })
          } finally {
            busyRef.current = false
          }
        }
        input.click()
      },
    [push, onUploaded, t, erreurs, token],
  )
}
