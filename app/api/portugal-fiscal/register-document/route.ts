// ══════════════════════════════════════════════════════════════════════════════
// POST /api/portugal-fiscal/register-document — DISABLED PT-V1 2026-05-05
// ══════════════════════════════════════════════════════════════════════════════
// Vitfix.io n'est PAS un logiciel certifié AT (Decreto-Lei 28/2019).
// L'enregistrement de document fiscal PT (ATCUD + hash chain + cert number)
// avec un cert non-certifié constitue un délit fiscal (peines : 1500-150 000€
// + interdiction d'exercer).
//
// Le trigger PG (migration 082) bloque aussi l'INSERT en defense-in-depth.
//
// Code original disponible dans l'historique git pour réactivation suite à
// certification AT (cf. docs/integrations/pt-fatura-reactivation.md).
// ══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'PT fiscal document registration disabled',
      reason: 'Vitfix is not AT-certified (Decreto-Lei 28/2019). Use third-party certified software (Moloni, InvoiceXpress) for legal invoicing in Portugal.',
    },
    { status: 410 },
  )
}
