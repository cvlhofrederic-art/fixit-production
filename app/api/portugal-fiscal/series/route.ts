// ══════════════════════════════════════════════════════════════════════════════
// /api/portugal-fiscal/series — DISABLED (lockdown fiscal PT, audit FNC-08)
// ══════════════════════════════════════════════════════════════════════════════
// La table `pt_fiscal_series` n'existe PAS dans le schéma live et n'est pas
// dans le lot de migrations en attente (lockdown fiscal volontaire) : toute
// requête échouait en 500. Même raison de fond que saft-export — Vitfix.io
// n'est PAS un logiciel certifié AT (Decreto-Lei 28/2019) : gérer des séries
// fiscales PT sans certification n'a pas de base légale.
//
// Code original (GET liste des séries / POST création-mise à jour) disponible
// dans l'historique git si réactivation suite à certification AT
// (cf. docs/integrations/pt-fatura-reactivation.md).
// ══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

const DISABLED_PAYLOAD = {
  error: 'PT fiscal series management disabled',
  reason: 'Vitfix is not AT-certified (Decreto-Lei 28/2019). Use third-party certified software (Moloni, InvoiceXpress) for fiscal series management in Portugal.',
} as const

export async function GET() {
  return NextResponse.json(DISABLED_PAYLOAD, { status: 410 })
}

export async function POST() {
  return NextResponse.json(DISABLED_PAYLOAD, { status: 410 })
}
