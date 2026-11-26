// GET  /api/crm/demandes : demandes de l'écran (ouvertes + résolues des 30 derniers jours) et compteurs du jour.
// POST /api/crm/demandes : nouvelle demande (appel ou message), fiche du client retrouvée ou créée par son numéro.
// Accès : super admin ou compte « secretariat » (lib/crm/acces.ts).

import type { NextRequest } from 'next/server'
import { controlerAccesCrm } from '@/lib/crm/acces'
import { calculerCompteurs } from '@/lib/crm/compteurs'
import { auteurDe, jsonCrm, lireCorps, reponseErreurServeur } from '@/lib/crm/reponses'
import { creerDemandeSchema } from '@/lib/crm/schemas'
import { LIMITE_LISTE, creerDemande, listerDemandes } from '@/lib/crm/serveur'

export async function GET(request: NextRequest) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  try {
    const maintenant = new Date()
    const demandes = await listerDemandes(maintenant)
    return jsonCrm({ demandes, compteurs: calculerCompteurs(demandes, maintenant), tronquee: demandes.length >= LIMITE_LISTE })
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'liste des demandes')
  }
}

export async function POST(request: NextRequest) {
  const acces = await controlerAccesCrm(request)
  if (!acces.ok) return acces.reponse
  const corps = await lireCorps(request, creerDemandeSchema)
  if (!corps.ok) return corps.reponse
  try {
    const demande = await creerDemande(corps.data, auteurDe(acces.user))
    return jsonCrm({ demande }, 201)
  } catch (erreur) {
    return reponseErreurServeur(erreur, 'création de la demande')
  }
}
