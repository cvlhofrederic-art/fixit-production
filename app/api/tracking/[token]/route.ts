import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.storage
    .from('tracking')
    .download(`${token}.json`)

  if (error || !data) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  const text = await data.text()
  const tracking = JSON.parse(text)

  // Expire après 24h
  const updated = new Date(tracking.updated_at)
  if (Date.now() - updated.getTime() > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Session expirée' }, { status: 410 })
  }

  return NextResponse.json(tracking)
}

// Suppression propre en fin de session (appelé par l'artisan)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.storage.from('tracking').remove([`${token}.json`])
  return NextResponse.json({ success: true })
}
