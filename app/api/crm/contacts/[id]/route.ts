// PATCH /api/crm/contacts/:id : nom, numéro, e-mail, ville, langue ou notes de la fiche (409 si le numéro a déjà une fiche).
// Accès : super admin ou compte « secretariat » (lib/crm/acces.ts).

import type { NextRequest } from 'next/server'
import { controlerAccesCrm } from '@/lib/crm/acces'
import { jsonCrm, lireCorps, lireId, reponseErreurServeur } from '@/lib/crm/reponses'
import { modifierContactSchema } from '@/lib/crm/schemas'
import { modifierContact } from '@/lib/crm/serveur'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const id = lireId((await params).id)
  if (!id.ok) return id.reponse
  const corps = await lireCorps(request, modifierContactSchema)
  if (!corps.ok) return corps.reponse
  try {
    return jsonCrm({ contact: await modifierContact(id.id, corps.data, new Date()) })
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'modification du contact')
  }
}
