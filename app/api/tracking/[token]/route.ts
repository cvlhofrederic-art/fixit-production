import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { buildStoragePath } from '@/lib/security/storage-path'
import { TRACKING_TOKEN_PATTERN } from '@/lib/security/tracking-token'
import { BUCKET_SUIVI, CHAMP_PROPRIETAIRE_SUIVI, proprietaireSessionSuivi } from '@/lib/tracking/session-suivi'

// Format du jeton : celui réellement généré par l'application mobile (lib/security/tracking-token.ts),
// vérifié avant toute construction de chemin. L'ancien motif UUID v4 ne correspondait à aucun jeton
// émis : toute lecture répondait 400. Le nom d'objet passe ensuite par buildStoragePath.
//
// Le GET est public (lien envoyé au client, sans compte) : il redevient fonctionnel avec le motif réel,
// d'où la limitation par IP, le jeton n'ayant qu'une vingtaine de bits d'aléa une fois l'heure connue.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`tracking_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  // ── Jeton au format émis, sinon 400 : aucun chemin construit ──
  if (!TRACKING_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_SUIVI)
    .download(buildStoragePath(`${token}.json`))

  if (error || !data) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const text = await data.text()
  let tracking: Record<string, unknown>
  try {
    tracking = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Données tracking corrompues' }, { status: 500 })
  }

  // Expire après 24h
  const updated = new Date(tracking.updated_at as string)
  if (Date.now() - updated.getTime() > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Session expirée' }, { status: 410 })
  }

  // Le compte qui alimente la session reste côté serveur.
  const publique = { ...tracking }
  delete publique[CHAMP_PROPRIETAIRE_SUIVI]
  return NextResponse.json(publique)
}

// Suppression propre en fin de session (appelé par l'artisan — auth requise)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // ── Auth obligatoire pour la suppression ──
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { token } = await params

  // ── Jeton au format émis, sinon 400 : aucun chemin construit ──
  if (!TRACKING_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  // Seul le compte qui alimente la session la supprime (session sans propriétaire : écrite avant ce contrôle).
  const chemin = buildStoragePath(`${token}.json`)
  const proprietaire = await proprietaireSessionSuivi(chemin)
  if (proprietaire && proprietaire !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await supabaseAdmin.storage.from(BUCKET_SUIVI).remove([chemin])
  return NextResponse.json({ success: true })
}
