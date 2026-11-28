// GET /api/pro/titulaire — identité de la société pour un compte qui n'a pas de fiche à lui.
//
// Un salarié invité d'une société BTP n'a aucune ligne `profiles_artisan` : le tableau de bord se rabattait sur un
// objet bâti depuis son propre compte (nom tiré de son e-mail, « SARL », ni SIRET ni adresse ni logo), puis rangeait
// ses documents sous son identifiant. Résultat : liste vide, en-tête de devis faux, gabarit de la société perdu.
//
// Cette route rend la fiche de SA société, pour que son tableau de bord travaille sur la même identité que celle du
// gérant, et la liste des familles de documents qu'il a le droit de voir.
//
// Elle n'exige AUCUN droit sur les documents. Un ouvrier ou un chef de chantier n'en a aucun, mais il ouvre
// l'application tous les jours pour pointer ses heures : lui refuser l'identité de son entreprise fermerait tout.
// Sa fiche lui revient réduite à l'en-tête d'écran, sans l'identité légale (lib/btp/titulaire-documents.ts).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isProSocieteRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resoudreTitulaireDocuments } from '@/lib/btp/titulaire-documents'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Réservé aux comptes de société' }, { status: 403 })
  }
  if (!(await checkRateLimit(`pro_titulaire_${user.id}`, 30, 60_000))) return rateLimitResponse()

  const titulaire = await resoudreTitulaireDocuments(user, supabaseAdmin)
  if (!titulaire.ok) {
    return NextResponse.json({ error: titulaire.message, code: titulaire.code }, { status: titulaire.status })
  }

  return NextResponse.json({
    societeId: titulaire.societeId,
    ficheId: titulaire.ficheId,
    fiche: titulaire.fiche,
    roleEquipe: titulaire.perimetre.roleEquipe,
    titulaire: titulaire.perimetre.titulaire,
    /** Familles de documents visibles : le tableau de bord ne va les chercher que si la liste n'est pas vide. */
    lisibles: titulaire.lisibles,
  })
}
