import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

// Token format validation — UUID v4 strict (pas de path traversal ni injection)
const VALID_TOKEN_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  // ── Validate token format to prevent path traversal / injection ──
  if (!VALID_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('tracking')
    .download(`${token}.json`)

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

  return NextResponse.json(tracking)
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

  // ── Validate token format ──
  if (!VALID_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  await supabaseAdmin.storage.from('tracking').remove([`${token}.json`])
  return NextResponse.json({ success: true })
}
