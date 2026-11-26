// POST /api/crm/demandes/:id/notes : note ajoutée à l'historique de la demande.
// Accès : super admin ou compte « secretariat » (lib/crm/acces.ts).

import type { NextRequest } from 'next/server'
import { controlerAccesCrm } from '@/lib/crm/acces'
import { auteurDe, jsonCrm, lireCorps, lireId, reponseErreurServeur } from '@/lib/crm/reponses'
import { noteSchema } from '@/lib/crm/schemas'
import { ajouterNote } from '@/lib/crm/serveur'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const id = lireId((await params).id)
  if (!id.ok) return id.reponse
  const corps = await lireCorps(request, noteSchema)
  if (!corps.ok) return corps.reponse
  try {
    const evenement = await ajouterNote(id.id, corps.data.contenu, auteurDe(acces.user), new Date())
    return jsonCrm({ evenement }, 201)
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'note')
  }
}
