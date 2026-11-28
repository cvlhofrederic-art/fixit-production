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
//     propres doublons), seulement pour le même cabinet et le même lot : la fonction compare l'empreinte des lignes, et
//     la route vérifie que le rejeu porte sur les numéros de ligne demandés (sinon 409 a_reverifier, diagnostics relus
//     SANS ignorer l'opération : ce qu'elle a créé est alors un doublon comme un autre). Les créées sont rendues telles
//     que la base les a enregistrées (nom, adresse, code postal, ville, jeton) : l'écran en fait affiches et export.
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
  codeDepuisErreurSqlQr, controlerAccesQr, lireCabinetQr, lireCoproprietesDoublonsQr, lireDomainesAutresCabinetsQr, lireDomainesCabinetQr,
  lireFichesParEmailsQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import type { ContexteImportQr, LigneImportQr, LigneSqlImportQr, ResultatImportQr, VerificationImportQr } from '@/lib/aj-signalement/types'

const CONTEXTE = '[AJ SIGNALEMENT]'
const HEURE = 3_600_000

type LectureContexte = { ok: true; contexte: ContexteImportQr } | { ok: false; reponse: Response }

const canoniquesDe = (emails: readonly string[]): string[] =>
  [...new Set(emails.map(emailCanoniqueQr).filter((e): e is string => e !== null))]

/**
 * Ce que la vérification lit du cabinet : ses fiches, ses domaines, ses copropriétés ; des autres cabinets, les seules
 * fiches et les seuls domaines que le fichier cite (jamais toute la table, relecture 11). Une lecture de contrôle en
 * échec, autre qu'une table absente, répond 500 : aucune vérification n'est rendue sans elle (relecture 4).
 * `operationIgnoree` : les copropriétés déjà créées par CE lot (rejeu) ne sont pas ses doublons.
 */
async function lireContexteImport(cabinetId: string, lignes: readonly LigneImportQr[], operationIgnoree: string | null): Promise<LectureContexte> {
  const echec = (erreur: ErreurBase, operation: string): LectureContexte =>
    ({ ok: false, reponse: reponseErreurSqlQr(erreur, operation, { cabinet: cabinetId }) })
  const fiches = await lireFichesQr({ etat: 'tous', cabinet: cabinetId })
  if (!fiches.ok) return echec(fiches.erreur, 'lecture des fiches (import)')
  const existantes = await lireCoproprietesDoublonsQr(cabinetId, operationIgnoree ? { ignorerOperation: operationIgnoree } : {})
  if (!existantes.ok) return echec(existantes.erreur, 'lecture des copropriétés (import)')
  const gestionnairesCites = canoniquesDe(lignes.flatMap((l) => l.gestionnaires))
  const [domaines, fichesCitees, domainesAutres] = await Promise.all([
    lireDomainesCabinetQr(cabinetId),
    lireFichesParEmailsQr(canoniquesDe([...gestionnairesCites, ...lignes.flatMap((l) => l.emailsDestinataires)])),
    lireDomainesAutresCabinetsQr(cabinetId, [...new Set(gestionnairesCites.map((e) => e.split('@')[1] ?? ''))]),
  ])
  if (!domaines.ok) return echec(domaines.erreur, 'lecture des domaines (import)')
  if (!fichesCitees.ok) return echec(fichesCitees.erreur, 'lecture des fiches citées (import)')
  if (!domainesAutres.ok) return echec(domainesAutres.erreur, 'lecture des domaines des autres cabinets (import)')
  const duCabinet = new Set(fiches.valeur.map((f) => f.id))
  return {
    ok: true,
    contexte: {
      domaines: domaines.valeur,
      fiches: fiches.valeur.map((f) => ({ id: f.id, nom: f.nom, email: f.email, actif: f.actif === true, contestee: f.adresse_contestee_le !== null })),
      emailsAutresCabinets: canoniquesDe(fichesCitees.valeur.filter((f) => !duCabinet.has(f.id)).map((f) => f.email ?? '')),
      domainesAutresCabinets: domainesAutres.valeur,
      existantes: existantes.coproprietes,
    },
  }
}

const entierPositif = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)
const texte = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Résultat de la fonction SQL, réduit à sa forme attendue (lignes illisibles écartées). */
function resultatDepuisSql(data: unknown): Omit<ResultatImportQr, 'ignorees'> {
  const brut = (data ?? {}) as { creees?: unknown; completees?: unknown; rejeu?: unknown }
  const liste = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [])
  return {
    creees: liste(brut.creees).flatMap((c) => {
      const numeroLigne = entierPositif(c.numeroLigne)
      return numeroLigne !== null && typeof c.id === 'string' && typeof c.jeton === 'string'
        ? [{ numeroLigne, id: c.id, jeton: c.jeton, nom: texte(c.nom), adresse: texte(c.adresse), codePostal: texte(c.codePostal), ville: texte(c.ville) }]
        : []
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

/** Diagnostics relus sur la base, sans ignorer d'opération, rendus en 409 a_reverifier. */
async function relireEtReverifier(cabinetId: string, lignes: readonly LigneImportQr[]): Promise<Response> {
  const relecture = await lireContexteImport(cabinetId, lignes, null)
  return relecture.ok ? aReverifier(diagnostiquerImportQr(lignes, relecture.contexte)) : relecture.reponse
}

/** Le rejeu rendu porte-t-il exactement les lignes demandées (mêmes numéros, même action) ? */
function memesLignes(resultat: Omit<ResultatImportQr, 'ignorees'>, lignesSql: readonly LigneSqlImportQr[]): boolean {
  const rendues = [
    ...resultat.creees.map((c) => `creer:${c.numeroLigne}`),
    ...resultat.completees.map((c) => `completer:${c.numeroLigne}`),
  ].sort((a, b) => a.localeCompare(b))
  const demandees = lignesSql.map((l) => `${l.action}:${l.numeroLigne}`).sort((a, b) => a.localeCompare(b))
  return rendues.length === demandees.length && rendues.every((r, i) => r === demandees[i])
}

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
    const lecture = await lireContexteImport(s.cabinetId, lignes, s.operationId)
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
      // Course (l'existant a changé, transaction annulée en entier) ou identifiant d'un AUTRE lot : diagnostics relus
      // sans ignorer l'opération (ce qu'un autre lot a créé sous cet identifiant compte comme doublon).
      logger.warn(`${CONTEXTE} import de copropriétés à revérifier`, { cabinet: s.cabinetId, code: error.code })
      return relireEtReverifier(s.cabinetId, lignes)
    }

    const resultat = resultatDepuisSql(data)
    if (resultat.rejeu && !memesLignes(resultat, plan.lignesSql)) {
      logger.warn(`${CONTEXTE} rejeu d’import refusé : lignes différentes`, { cabinet: s.cabinetId, lignes: lignes.length })
      return relireEtReverifier(s.cabinetId, lignes)
    }
    logger.info(`${CONTEXTE} import de copropriétés`, {
      ...bilan, creees: resultat.creees.length, completees: resultat.completees.length, rejeu: resultat.rejeu,
    })
    return reponsePriveeQr({ ...resultat, ignorees: plan.ignorees } satisfies ResultatImportQr)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} import de copropriétés`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
