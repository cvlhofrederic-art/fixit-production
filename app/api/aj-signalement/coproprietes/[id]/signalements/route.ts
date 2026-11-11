// app/api/aj-signalement/coproprietes/[id]/signalements/route.ts
//
// GET — signalements d'une copropriété, page par page (P1-R2 ; page de suivi d'un gestionnaire vue par le super admin,
// puis du gestionnaire lui-même en PR 2). Filtres : statut (ouverts par défaut, tous, clos), priorité. Curseur
// (created_at, id) : `avant` est le created_at BRUT de PostgREST (« …123456+00:00 », microsecondes comprises), jamais
// repassé par new Date() (qui tronque aux millisecondes et ferait sauter les lignes du même instant) ; le client le code
// par URLSearchParams. 50 par page, 100 au plus. Super admin seul en PR 1 ; jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { signalementsCoproQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { STATUTS_OUVERTS_QR, type SuitePageQr } from '@/lib/aj-signalement/types'
import {
  COLONNES_SIGNALEMENT_QR, TABLE_SIGNALEMENTS_QR, colonneInconnue, controlerAccesQr, estUuid, lireLigneCoproprieteQr, parametresQr, reponseErreur,
  reponseErreurSqlQr, reponseInvalide, reponsePriveeQr, signalementDepuisLigne, type LigneSignalementQr,
} from '@/lib/aj-signalement/serveur'

const STATUTS_CLOS = ['terminee', 'annulee']

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalements_copro_${ip}`, 120, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_signalements_copro_${controle.user.id}`, 120, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const validation = validateBody(signalementsCoproQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)
    const f = validation.data

    const copro = await lireLigneCoproprieteQr(id)
    if (!copro.ok) return reponseErreurSqlQr(copro.erreur, 'lecture de la copropriété', { copropriete: id })
    if (!copro.ligne) return reponseErreur('introuvable', 404)

    const lire = (colonnes: string) => {
      let q = supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select(colonnes).eq('copropriete_id', id)
      if (f.statut === 'ouverts') q = q.in('statut', [...STATUTS_OUVERTS_QR])
      if (f.statut === 'clos') q = q.in('statut', STATUTS_CLOS)
      if (f.priorite) q = q.eq('priorite', f.priorite)
      if (f.avant && f.avantId) q = q.or(`created_at.lt."${f.avant}",and(created_at.eq."${f.avant}",id.lt."${f.avantId}")`)
      else if (f.avant) q = q.lt('created_at', f.avant)
      // Une ligne de plus que la page : il y a une suite.
      return q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(f.limite + 1)
    }
    let r = await lire(COLONNES_SIGNALEMENT_QR)
    if (colonneInconnue(r.error)) r = await lire('*')
    if (r.error) return reponseErreurSqlQr(r.error, 'lecture des signalements', { copropriete: id })
    const lignes = (r.data ?? []) as unknown as LigneSignalementQr[]
    const page = lignes.slice(0, f.limite)
    const derniere = page.at(-1)
    const suite: SuitePageQr = lignes.length > f.limite && derniere?.created_at ? { avant: derniere.created_at, avantId: derniere.id } : null
    const nom = typeof copro.ligne.nom === 'string' ? copro.ligne.nom : ''
    return reponsePriveeQr({ signalements: page.map((s) => signalementDepuisLigne(s, nom)), suite })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] signalements d’une copropriété', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
