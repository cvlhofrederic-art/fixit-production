'use client'

import { useCallback, useRef } from 'react'
import { useToast } from '../primitives/toast'

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

/** Messages d'erreur PT mappés sur les codes renvoyés par l'endpoint upload. */
const ERR_PT: Record<string, string> = {
  file_too_large: 'Ficheiro demasiado grande (máximo 25 MB).',
  unsupported_mime_type: 'Formato não suportado. Use PDF, PNG, JPG ou WEBP.',
  quota_exceeded: 'Limite de armazenamento do gabinete atingido.',
  missing_file: 'Nenhum ficheiro selecionado.',
  unauthorized: 'Sessão expirada. Inicie sessão novamente.',
  forbidden: 'Sem permissões para carregar documentos.',
  invalid_metadata: 'Dados do documento inválidos.',
}

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
          push({ kind: 'info', title: 'A carregar documento…', desc: file.name })
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', type)
            const res = await fetch('/api/syndic/lea-documents/upload', { method: 'POST', body: fd })
            const data = (await res.json().catch(() => ({}))) as {
              error?: string
              document?: { filename?: string }
              quota?: { warning?: boolean }
            }
            if (!res.ok) {
              const code = typeof data.error === 'string' ? data.error : ''
              push({ kind: 'error', title: 'Falha no carregamento', desc: ERR_PT[code] ?? 'Não foi possível carregar. Tente novamente.' })
              return
            }
            const fname = data.document?.filename ?? file.name
            push({ kind: 'success', title: 'Documento carregado', desc: `${fname} — em processamento pela Léa.` })
            if (data.quota?.warning) {
              push({ kind: 'warning', title: 'Armazenamento quase cheio', desc: 'Mais de 80% do limite do gabinete utilizado.' })
            }
            onUploaded?.()
          } catch {
            push({ kind: 'error', title: 'Erro de rede', desc: 'Não foi possível contactar o servidor.' })
          } finally {
            busyRef.current = false
          }
        }
        input.click()
      },
    [push, onUploaded],
  )
}
