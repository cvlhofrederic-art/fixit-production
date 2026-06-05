import { useState } from 'react'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import { useToast } from '../primitives/toast'

/**
 * Hook de création POST partagé par les modules syndic v54 (Reservas, Infrações,
 * Plano Man., etc.). Factorise le boilerplate identique busy + fetch POST +
 * refresh + toasts (succès / erreur / démo anonyme), pour éliminer la duplication.
 *
 * Connecté → POST `endpoint`, refresh des données, toast succès. Anonyme → toast démo.
 */
export function useSyndicCreate(endpoint: string) {
  const data = useSyndicData()
  const { push } = useToast()
  const [busy, setBusy] = useState(false)

  const create = (payload: Record<string, unknown>, opts: { okTitle: string; desc?: string; onDone: () => void }) => {
    if (data.authenticated && data.token) {
      setBusy(true)
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(payload),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); opts.onDone(); push({ kind: 'success', title: opts.okTitle, desc: opts.desc }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao gravar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    opts.onDone()
    push({ kind: 'info', title: `${opts.okTitle} (demo)`, desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return { busy, create }
}
