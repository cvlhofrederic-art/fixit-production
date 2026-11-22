// GET   /api/crm/demandes/:id : la demande, la fiche du client et l'historique.
// PATCH /api/crm/demandes/:id : statut, priorité, rappel, motif, titre ou description (changement de statut journalisé).
// Accès : super admin ou compte « secretariat » (lib/crm/acces.ts).

import type { NextRequest } from 'next/server'
import { controlerAccesCrm } from '@/lib/crm/acces'
import { auteurDe, jsonCrm, lireCorps, lireId, reponseErreurServeur } from '@/lib/crm/reponses'
import { modifierDemandeSchema } from '@/lib/crm/schemas'
import { lireDemande, modifierDemande } from '@/lib/crm/serveur'

type Contexte = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Contexte) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const id = lireId((await params).id)
  if (!id.ok) return id.reponse
  try {
    return jsonCrm(await lireDemande(id.id))
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'lecture de la demande')
  }
}

export async function PATCH(request: NextRequest, { params }: Contexte) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const id = lireId((await params).id)
  if (!id.ok) return id.reponse
  const corps = await lireCorps(request, modifierDemandeSchema)
  if (!corps.ok) return corps.reponse
  try {
    const demande = await modifierDemande(id.id, corps.data, auteurDe(acces.user), new Date())
    return jsonCrm({ demande })
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'modification de la demande')
  }
}
