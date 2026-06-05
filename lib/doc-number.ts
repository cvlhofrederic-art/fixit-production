// Numérotation légale partagée (art. 242 nonies A I 2° CGI : séquence continue,
// sans rupture). Extrait de DevisFactureFormBTP pour réutilisation par le flux
// « Émettre l'acompte » (FacturesSection). Le form garde sa propre copie liée à
// son état — GARDER LES DEUX ALIGNÉS (même format, même API /api/doc-number).

import { supabase } from '@/lib/supabase'

export type DocSeriesType = 'devis' | 'facture' | 'avoir' | 'acompte'

/**
 * Compteur localStorage — DERNIER recours (peut diverger entre devices).
 * Séries dédiées par type : DEV- (devis), FACT- (facture), AC- (acompte), AV- (avoir).
 */
export function localFallbackDocNumber(artisanId: string | undefined, docType: DocSeriesType): string {
  const year = new Date().getFullYear()
  const prefix = docType === 'devis' ? 'DEV' : docType === 'facture' ? 'FACT' : docType === 'acompte' ? 'AC' : 'AV'
  try {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]')
    const all = [...docs, ...drafts]
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)
    const maxSeq = all
      .map((d: { docNumber?: string }) => d.docNumber?.match(pattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .reduce((a: number, b: number) => Math.max(a, b), 0)
    return `${prefix}-${year}-${String(maxSeq + 1).padStart(3, '0')}`
  } catch {
    return `${prefix}-${year}-001`
  }
}

/**
 * Prochain numéro légal via la séquence atomique serveur. 3 niveaux de fallback :
 *   1. API HTTP /api/doc-number (rate limit + auth Bearer)
 *   2. RPC Supabase next_doc_number (SECURITY DEFINER)
 *   3. Compteur localStorage (dernier recours)
 * Ne renvoie JAMAIS de chaîne vide (un acompte émis a toujours un numéro légal).
 */
export async function fetchNextDocNumber(docType: DocSeriesType, artisanId: string | undefined): Promise<string> {
  const year = new Date().getFullYear()

  // 1) API HTTP avec Bearer token
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const authHeader: Record<string, string> = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
    const res = await fetch('/api/doc-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ docType, year }),
    })
    if (res.ok) {
      const { number } = await res.json()
      if (number) return String(number)
    }
  } catch { /* fallthrough */ }

  // 2) RPC Supabase direct
  try {
    if (artisanId) {
      const { data, error } = await supabase.rpc('next_doc_number', {
        p_artisan_user_id: artisanId,
        p_doc_type: docType,
        p_year: year,
      })
      if (!error && data) return String(data)
    }
  } catch { /* fallthrough */ }

  // 3) Fallback localStorage
  return localFallbackDocNumber(artisanId, docType)
}
