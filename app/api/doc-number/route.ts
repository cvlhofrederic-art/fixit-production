import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateBody, docNumberSchema } from '@/lib/validation'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// POST /api/doc-number — Génère le prochain numéro séquentiel (devis/facture/avoir)
// Utilise la fonction DB next_doc_number() pour garantir l'atomicité (art. L441-3 C. com.)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  if (!(await checkRateLimit(`doc_num_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const v = validateBody(docNumberSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const docType = v.data.docType
  const year = v.data.year || new Date().getFullYear()

  const { data, error } = await supabaseAdmin.rpc('next_doc_number', {
    p_artisan_user_id: user.id,
    p_doc_type: docType,
    p_year: year,
  })

  if (error) {
    console.error('[doc-number] RPC error:', error.message)
    return NextResponse.json({ error: 'Erreur de génération du numéro' }, { status: 500 })
  }

  return NextResponse.json({ number: data })
}
