// Manifeste de l'application « Vitfix CRM » (lib/crm/manifeste.ts), sur le modèle de app/pt/manifest.webmanifest.
// Public et sans donnée : nom, adresse de départ, couleurs et icônes de l'application installée.

import { MANIFESTE_CRM } from '@/lib/crm/manifeste'

export const runtime = 'nodejs'

export async function GET() {
  return new Response(JSON.stringify(MANIFESTE_CRM), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
