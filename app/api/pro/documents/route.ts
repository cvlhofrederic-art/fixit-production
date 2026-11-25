// GET /api/pro/documents — devis et factures de la société, pour un compte qui n'en est pas le titulaire.
//
// POURQUOI UNE ROUTE, ET PAS UNE LECTURE DU NAVIGATEUR
// Le tableau de bord lit `devis` et `factures` directement depuis le navigateur, avec la session de l'utilisateur
// (lib/document-sync.ts). La RLS de ces deux tables ne laisse passer que les lignes du compte connecté : un salarié
// n'y verra jamais les documents du gérant, et élargir cette RLS ouvrirait la lecture à toutes les pages du
// navigateur en même temps, sans distinction de rôle. La lecture passe donc par ici, avec la clé de service, après
// un contrôle de rôle explicite.
//
// CE QUI EST LU
// `artisan_user_id = <société>`, et rien d'autre. Au 25/11/2026 aucun document de la production n'est rangé sous un
// sous-compte, et /api/devis/sync enregistre désormais tout nouveau document sous la société : ce seul critère est
// donc complet. Y ajouter `artisan_id = <fiche de la société>` aurait fait entrer dans la liste une ligne qu'un
// compte membre de deux sociétés aurait écrite sous la fiche de l'autre.
//
// Aucun identifiant de salarié n'entre dans le filtre : la visibilité des documents ne dépend pas de `is_active`,
// et désactiver un salarié ne peut donc pas faire disparaître des documents de l'écran du gérant.
//
// CE QUI N'EST PAS LU
// Rien n'est projeté colonne par colonne. Un document amputé de `raw_data` qui repasserait par /api/devis/sync
// écraserait le document d'origine par une coquille à 0 €. Pour les documents, un rôle voit tout ou ne voit rien :
// READ donne la liste entière en lecture, FULL y ajoute le droit d'écrire (lib/btp/titulaire-documents.ts).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isProSocieteRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  CHAMPS_DOCUMENT_COMPLET,
  CHAMPS_DOCUMENT_SOMMAIRE,
  colonneRawDataAbsente,
} from '@/lib/documents/champs-lecture'
import {
  FAMILLES_DOCUMENT,
  resoudreTitulaireDocuments,
  type FamilleDocument,
} from '@/lib/btp/titulaire-documents'
import { messageRefusFr } from '@/lib/documents/messages-refus'

/** Lignes d'une table de documents pour cette société, en lecture complète ou sommaire selon le schéma. */
async function lireFamille(
  table: FamilleDocument,
  societeId: string,
): Promise<{ lignes: Record<string, unknown>[] } | { erreur: string }> {
  const lire = (champs: string) =>
    supabaseAdmin.from(table).select(champs).eq('artisan_user_id', societeId).is('deleted_at', null)

  let resultat = await lire(CHAMPS_DOCUMENT_COMPLET)
  if (resultat.error && colonneRawDataAbsente(resultat.error.message)) {
    resultat = await lire(CHAMPS_DOCUMENT_SOMMAIRE)
  }
  if (resultat.error) {
    logger.error('[pro/documents] lecture impossible', { table, error: resultat.error.message })
    return { erreur: resultat.error.message }
  }
  return { lignes: (resultat.data ?? []) as unknown as Record<string, unknown>[] }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Réservé aux comptes de société' }, { status: 403 })
  }
  if (!(await checkRateLimit(`pro_documents_${user.id}`, 30, 60_000))) return rateLimitResponse()

  const titulaire = await resoudreTitulaireDocuments(user, supabaseAdmin)
  if (!titulaire.ok) {
    return NextResponse.json({ error: titulaire.message, code: titulaire.code }, { status: titulaire.status })
  }

  const lisibles = new Set(titulaire.lisibles)
  if (lisibles.size === 0) {
    return NextResponse.json({ error: messageRefusFr('aucun_droit'), code: 'aucun_droit' }, { status: 403 })
  }

  const resultats = await Promise.all(
    FAMILLES_DOCUMENT.map(async famille =>
      lisibles.has(famille)
        ? { famille, resultat: await lireFamille(famille, titulaire.societeId) }
        : { famille, resultat: { lignes: [] as Record<string, unknown>[] } },
    ),
  )

  // Une lecture en échec n'est pas une liste vide : le dire, pour que l'écran montre une erreur au lieu de laisser
  // croire que la société n'a aucun document.
  const enEchec = resultats.find(({ resultat }) => 'erreur' in resultat)
  if (enEchec) {
    return NextResponse.json({ error: messageRefusFr('lecture_impossible'), code: 'lecture_impossible' }, { status: 500 })
  }

  const parFamille = Object.fromEntries(
    resultats.map(({ famille, resultat }) => [famille, 'lignes' in resultat ? resultat.lignes : []]),
  ) as Record<FamilleDocument, Record<string, unknown>[]>

  return NextResponse.json({
    societeId: titulaire.societeId,
    ficheId: titulaire.ficheId,
    devis: parFamille.devis,
    factures: parFamille.factures,
  })
}
