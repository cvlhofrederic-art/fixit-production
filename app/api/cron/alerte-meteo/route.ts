// app/api/cron/alerte-meteo/route.ts
//
// GET — e-mail de la veille au soir de l'alerte météo des chantiers BTP (décision de Frédéric du 26/11/2026). Appelé
// chaque soir à 18:15 UTC par le Cron Trigger du Worker (worker/taches-planifiees.ts, wrangler.toml [triggers] ; les
// déclenchements planifiés de GitHub Actions partaient avec des heures de retard). Le travail est dans
// lib/btp/alerte-meteo-serveur.ts ; ici :
//   - en-tête « Authorization: Bearer CRON_SECRET » (lib/cron/autorisation.ts) ; sinon 401 ;
//   - 200 avec le bilan (des nombres) ; 503 s'il faut rejouer l'appel, ce que fait le Worker une fois, sans doublon
//     (clé d'idempotence par jour et par chantier) ; 500 sans détail si la lecture de départ échoue.

import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { secretCronValide } from '@/lib/cron/autorisation'
import { envoyerAlertesDeLaVeille } from '@/lib/btp/alerte-meteo-serveur'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const attendre = (ms: number) => new Promise<void>(resoudre => { setTimeout(resoudre, ms) })
// Toujours appelé comme une fonction : dans le Worker, `fetch` appelé comme méthode d'un autre objet lève
// « Illegal invocation ».
const lire = (url: string, init?: RequestInit) => fetch(url, init)

export async function GET(request: NextRequest) {
  if (!secretCronValide(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { bilan, rejouer } = await envoyerAlertesDeLaVeille({ maintenantMs: Date.now(), attendre, lire })
    logger.info('[cron/alerte-meteo] terminé', { ...bilan, rejouer })
    return NextResponse.json(bilan, { status: rejouer ? 503 : 200 })
  } catch (err) {
    logger.error('[cron/alerte-meteo] échec', {}, err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
