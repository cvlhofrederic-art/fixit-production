// app/api/aj-signalement/coproprietes/import/route.ts
//
// POST (P1-R19, SPEC § 1.9.6) — import des copropriétés d'UN cabinet client (super admin) depuis le fichier Excel ou CSV
// lu dans le navigateur : seules les lignes normalisées arrivent ici, jamais le fichier. Demande de Hugo du 10/11/2026.
//   - « verifier » (30/h par compte) : toute la vérification refaite sur la base, par la même fonction pure que l'aperçu
//     (lib/aj-signalement/import/ligne.ts) : fiches du cabinet (adresse ou nom), adresses des fiches des autres cabinets,
//     domaines, doublons dans le fichier et avec les copropriétés DU cabinet. Rien n'est écrit ;
//   - « creer » (5/h) : vérification refaite ; une ligne en erreur (l'existant a changé depuis l'aperçu) → 409
//     a_reverifier avec les diagnostics à jour ; destinataire hors domaines sans confirmerHorsDomaine → 409 hors_domaine ;
//     puis UN appel de signalements_qr_creer_coproprietes (une transaction : tout ou rien, jetons tirés par la base,
//     attributions et journal) ; doublon apparu entre-temps (P0001, 23505) → 409 a_reverifier, diagnostics relus, rien
//     n'est écrit ; operationId rejoué → le résultat du premier passage (les copropriétés de ce lot ne sont pas leurs
//     propres doublons).
// Réponses privées (Cache-Control: private, no-store). Le journal serveur ne reçoit que des nombres et des identifiants
// (lignes, créées, complétées, ignorées), jamais un nom ni une adresse. p_acteur = la session, jamais le corps.

import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { importCoproprietesQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { emailCanoniqueQr } from '@/lib/aj-signalement/gestionnaires'
import { diagnostiquerImportQr, planCreationImportQr } from '@/lib/aj-signalement/import/ligne'
import { lireFichesQr } from '@/lib/aj-signalement/serveur-gestion'
import {
  codeDepuisErreurSqlQr, controlerAccesQr, lireCabinetQr, lireCoproprietesDoublonsQr, lireDomainesCabinetQr, lireEmailsFichesQr,
  reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import type { ContexteImportQr, LigneImportQr, ResultatImportQr, VerificationImportQr } from '@/lib/aj-signalement/types'

const CONTEXTE = '[AJ SIGNALEMENT]'
const HEURE = 3_600_000

type LectureContexte = { ok: true; contexte: ContexteImportQr } | { ok: false; reponse: Response }

/** Ce que la vérification lit du cabinet : ses fiches, ses domaines, ses copropriétés ; des autres cabinets, les seules adresses des fiches. */
async function lireContexteImport(cabinetId: string, operationId: string): Promise<LectureContexte> {
  const fiches = await lireFichesQr({ etat: 'tous', cabinet: cabinetId })
  if (!fiches.ok) return { ok: false, reponse: reponseErreurSqlQr(fiches.erreur, 'lecture des fiches (import)', { cabinet: cabinetId }) }
  const existantes = await lireCoproprietesDoublonsQr(cabinetId, { ignorerOperation: operationId })
  if (!existantes.ok) return { ok: false, reponse: reponseErreurSqlQr(existantes.erreur, 'lecture des copropriétés (import)', { cabinet: cabinetId }) }
  const [domaines, toutesFiches] = await Promise.all([lireDomainesCabinetQr(cabinetId), lireEmailsFichesQr()])
  const duCabinet = new Set(fiches.valeur.map((f) => f.id))
  return {
    ok: true,
    contexte: {
      domaines,
      fiches: fiches.valeur.map((f) => ({ id: f.id, nom: f.nom, email: f.email, actif: f.actif === true, contestee: f.adresse_contestee_le !== null })),
      emailsAutresCabinets: toutesFiches.filter((f) => !duCabinet.has(f.id)).map((f) => emailCanoniqueQr(f.email)).filter((e): e is string => e !== null),
      existantes: existantes.coproprietes,
    },
  }
}

const entierPositif = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/** Résultat de la fonction SQL, réduit à sa forme attendue (lignes illisibles écartées). */
function resultatDepuisSql(data: unknown): Omit<ResultatImportQr, 'ignorees'> {
  const brut = (data ?? {}) as { creees?: unknown; completees?: unknown; rejeu?: unknown }
  const liste = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [])
  return {
    creees: liste(brut.creees).flatMap((c) => {
      const numeroLigne = entierPositif(c.numeroLigne)
      return numeroLigne !== null && typeof c.id === 'string' && typeof c.jeton === 'string' ? [{ numeroLigne, id: c.id, jeton: c.jeton }] : []
    }),
    completees: liste(brut.completees).flatMap((c) => {
      const numeroLigne = entierPositif(c.numeroLigne)
      return numeroLigne !== null && typeof c.id === 'string' ? [{ numeroLigne, id: c.id }] : []
    }),
    rejeu: brut.rejeu === true,
  }
}

/** 409 a_reverifier avec les diagnostics à jour (l'existant a changé depuis l'aperçu) : rien n'a été écrit. */
const aReverifier = (verification: VerificationImportQr): Response => reponsePriveeQr({ error: 'a_reverifier', ...verification }, 409)

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_import_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(importCoproprietesQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const s = validation.data
    const limite = s.mode === 'verifier' ? 30 : 5
    if (!(await checkRateLimit(`qr_import_${s.mode}_${controle.user.id}`, limite, HEURE))) return rateLimitResponse()

    const cabinet = await lireCabinetQr({ id: s.cabinetId })
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet (import)', { cabinet: s.cabinetId })
    if (!cabinet.cabinet) return reponseErreur('a_reverifier', 409)

    const lignes: LigneImportQr[] = s.lignes
    const lecture = await lireContexteImport(s.cabinetId, s.operationId)
    if (!lecture.ok) return lecture.reponse
    const verification = diagnostiquerImportQr(lignes, lecture.contexte)
    if (s.mode === 'verifier') return reponsePriveeQr(verification)

    if (verification.diagnostics.some((d) => d.action === 'aucune')) return aReverifier(verification)
    if (verification.horsDomaine && !s.confirmerHorsDomaine) return reponsePriveeQr({ error: 'hors_domaine', champ: 'emailsDestinataires' }, 409)
    const plan = planCreationImportQr(lignes, verification)
    const bilan = { cabinet: s.cabinetId, lignes: lignes.length, ignorees: plan.ignorees }
    if (plan.lignesSql.length === 0) {
      logger.info(`${CONTEXTE} import de copropriétés : rien à écrire`, { ...bilan, creees: 0, completees: 0 })
      return reponsePriveeQr({ creees: [], completees: [], ignorees: plan.ignorees, rejeu: false } satisfies ResultatImportQr)
    }

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_creer_coproprietes', {
      p_operation: s.operationId,
      p_acteur: controle.user.id,
      p_profil: 'super_admin',
      p_gestionnaire: null,
      p_cabinet: s.cabinetId,
      p_lignes: plan.lignesSql,
    })
    if (error) {
      const { code } = codeDepuisErreurSqlQr(error)
      if (code !== 'doublon' && code !== 'a_reverifier') return reponseErreurSqlQr(error, 'import de copropriétés', { cabinet: s.cabinetId })
      // Course : l'existant a changé entre la vérification et la transaction (annulée en entier). Diagnostics relus.
      logger.warn(`${CONTEXTE} import de copropriétés à revérifier`, { cabinet: s.cabinetId, code: error.code })
      const relecture = await lireContexteImport(s.cabinetId, s.operationId)
      if (!relecture.ok) return relecture.reponse
      return aReverifier(diagnostiquerImportQr(lignes, relecture.contexte))
    }

    const resultat = resultatDepuisSql(data)
    logger.info(`${CONTEXTE} import de copropriétés`, {
      ...bilan, creees: resultat.creees.length, completees: resultat.completees.length, rejeu: resultat.rejeu,
    })
    return reponsePriveeQr({ ...resultat, ignorees: plan.ignorees } satisfies ResultatImportQr)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} import de copropriétés`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
