// GET /api/crm/contacts?telephone=… : fiche du numéro (et nombre de ses demandes), ou null pour un nouveau client.
// GET /api/crm/contacts?q=…         : recherche par nom ou par chiffres du numéro.
// Accès : super admin ou compte « secretariat » (lib/crm/acces.ts).

import type { NextRequest } from 'next/server'
import { controlerAccesCrm, reponseErreurCrm } from '@/lib/crm/acces'
import { jsonCrm, reponseErreurServeur } from '@/lib/crm/reponses'
import { chercherContactParTelephone, chercherContacts } from '@/lib/crm/serveur'
import { normaliserTelephone } from '@/lib/crm/telephone'

export async function GET(request: NextRequest) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const parametres = request.nextUrl.searchParams
  const saisieTelephone = parametres.get('telephone')
  try {
    if (saisieTelephone !== null) {
      const telephone = normaliserTelephone(saisieTelephone)
      if (!telephone) return reponseErreurCrm(400, 'telephone_invalide')
      return jsonCrm({ telephone, trouve: await chercherContactParTelephone(telephone) })
    }
    return jsonCrm({ contacts: await chercherContacts(parametres.get('q') ?? '') })
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'recherche de contacts')
  }
}
