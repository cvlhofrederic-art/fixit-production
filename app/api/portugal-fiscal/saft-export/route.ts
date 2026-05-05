// ══════════════════════════════════════════════════════════════════════════════
// GET /api/portugal-fiscal/saft-export — DISABLED PT-V1 2026-05-05
// ══════════════════════════════════════════════════════════════════════════════
// Vitfix.io n'est PAS un logiciel certifié AT (Decreto-Lei 28/2019). L'export
// SAF-T avec un certNumber non-certifié constitue un délit fiscal.
//
// Code original disponible dans l'historique git si réactivation suite à
// certification AT (cf. docs/integrations/pt-fatura-reactivation.md).
// ══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

const DISABLED_PAYLOAD = {
  error: 'SAF-T export disabled',
  reason: 'Vitfix is not AT-certified (Decreto-Lei 28/2019). Use third-party certified software (Moloni, InvoiceXpress) for fiscal reporting in Portugal.',
  documentation: 'https://github.com/cvlhofrederic-art/fixit-production/blob/main/docs/integrations/pt-fatura-providers.md',
} as const

export async function GET() {
  return NextResponse.json(DISABLED_PAYLOAD, { status: 410 })
}

export async function POST() {
  return NextResponse.json(DISABLED_PAYLOAD, { status: 410 })
}
