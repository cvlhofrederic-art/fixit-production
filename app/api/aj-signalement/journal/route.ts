// app/api/aj-signalement/journal/route.ts
//
// GET (P1-R18) — journal de traçabilité d'AJ Signalement (super admin seul) : qui a créé ou changé quoi, quand ;
// identifiants, noms de champs, énumérations et nombres seulement (noms joints pour l'affichage). Filtres : action
// (liste fermée), copropriété, gestionnaire, cabinet. Curseur (created_at, id) BRUT de PostgREST, comme P1-R2. 12 mois
// glissants : la purge est lancée à l'ouverture du journal, au plus une fois par jour (clé qr_purge_journal) ; son
// échec ne bloque pas la lecture. Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { journalQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import type { SuitePageQr } from '@/lib/aj-signalement/types'
import {
  TABLE_JOURNAL_QR, controlerAccesQr, parametresQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import { COLONNES_JOURNAL_QR, evenementsDepuisLignesQr, type LigneJournalQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'
const UN_JOUR_MS = 24 * 60 * 60 * 1000

/** Purge des lignes de plus de 12 mois, au plus une fois par jour ; ne bloque jamais la lecture. */
async function purgerSiBesoin(): Promise<void> {
  if (!(await checkRateLimit('qr_purge_journal', 1, UN_JOUR_MS))) return
  const { error } = await supabaseAdmin.rpc('signalements_qr_purger_journal')
  if (error) logger.warn(`${CONTEXTE} purge du journal non faite`, { code: error.code })
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_journal_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_journal_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const validation = validateBody(journalQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)
    const f = validation.data
    await purgerSiBesoin()

    let q = supabaseAdmin.from(TABLE_JOURNAL_QR).select(COLONNES_JOURNAL_QR)
    if (f.action) q = q.eq('action', f.action)
    if (f.copropriete) q = q.eq('copropriete_id', f.copropriete)
    if (f.cabinet) q = q.eq('cabinet_id', f.cabinet)
    if (f.avant && !f.avantId) q = q.lt('created_at', f.avant)
    // Un seul filtre « or » (valeurs déjà validées : uuid, date ISO, entier) : gestionnaire concerné ou auteur, ET curseur.
    const ou = [
      f.gestionnaire ? `or(gestionnaire_id.eq.${f.gestionnaire},acteur_gestionnaire_id.eq.${f.gestionnaire})` : null,
      f.avant && f.avantId ? `or(created_at.lt."${f.avant}",and(created_at.eq."${f.avant}",id.lt.${f.avantId}))` : null,
    ].filter((c): c is string => c !== null)
    if (ou.length > 0) q = q.or(ou.length === 1 ? ou[0].slice(3, -1) : `and(${ou.join(',')})`)
    const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(f.limite + 1)
    if (error) return reponseErreurSqlQr(error, 'lecture du journal')

    const lignes = (data ?? []) as unknown as LigneJournalQr[]
    const page = lignes.slice(0, f.limite)
    const derniere = page.at(-1)
    const suite: SuitePageQr = lignes.length > f.limite && derniere ? { avant: derniere.created_at, avantId: String(derniere.id) } : null
    return reponsePriveeQr({ evenements: await evenementsDepuisLignesQr(page), suite })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} journal`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
