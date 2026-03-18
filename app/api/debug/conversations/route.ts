import { NextResponse } from 'next/server'

// ── Debug endpoint SUPPRIMÉ en production (audit sécurité 2026-03-13) ──
// Exposait les conversations complètes, remplacé par 404 permanent.

export async function GET() {
  return NextResponse.json({ error: 'Endpoint supprimé' }, { status: 404 })
}
