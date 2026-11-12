'use client'

// ── Détail d'un signalement reçu : coordonnées, lieu, description, statut ──────────────────────────
//
// Contenu d'une fenêtre (Modale du socle UI). Téléphone et e-mail sont des liens (appel, courriel) ; qualité du
// déclarant, « même problème que le signalement n° X » et adresse proposée d'après sa position quand il y en a ;
// l'état de l'e-mail envoyé à l'administrateur et celui de la confirmation au déclarant sont rappelés ;
// les boutons de statut suivent ACTIONS_STATUT_QR et appellent la route PATCH ; l'erreur reste affichée,
// le statut ne bouge pas.
// PR 2, lot 5 : le statut affiché part avec la demande (statutAttendu, exigé pour un gestionnaire) ; changé entre-temps
// (409 conflit_statut) : « Le statut a été changé entre-temps » et la liste est rechargée (onConflit). Vue d'un
// gestionnaire (vueGestionnaire) : auteur du dernier changement sans nom (vous, un collègue, le cabinet), aucune erreur
// technique d'envoi (« E-mail non envoyé. »), messages propres (accès retiré…), toast si le réseau est coupé.

import { useState } from 'react'
import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Encadre, Ligne } from '@/components/coproprietaire-dashboard/ui'
import { numeroSignalementQr, type SignalementQr, type StatutSignalementQr } from '@/lib/aj-signalement/types'
import { changerStatutSignalementQr } from '@/lib/aj-signalement/api'
import {
  ACTIONS_STATUT_QR, LIBELLE_PRIORITE_QR, LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, dateHeureParis,
  etatConfirmationQr, libelleQualiteQr, lieuSignalementQr, nomDeclarantQr, situationLotQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'
import { TEXTES_ESPACE_CABINET_QR as EC, messageErreurGestionnaireQr, texteAuteurStatutQr } from '@/lib/aj-signalement/affichage-gestionnaire'

export interface PropsDetailSignalementQr {
  signalement: SignalementQr
  jeton: string | null
  onFermer: () => void
  onStatut: (id: string, statut: StatutSignalementQr, misAJourLe: string) => void
  /** Statut changé entre-temps (409) : l'appelant recharge la liste (la fenêtre reste ouverte, sur le statut à jour). */
  onConflit?: () => void
  /** PR 2 : vue d'un gestionnaire connecté (espace de son cabinet). */
  vueGestionnaire?: boolean
}

/** Lien tel: sans espaces ni ponctuation. */
const lienTelephone = (telephone: string): string => `tel:${telephone.replace(/[\s.()-]/g, '')}`

export default function DetailSignalementQr({
  signalement: s, jeton, onFermer, onStatut, onConflit, vueGestionnaire = false,
}: Readonly<PropsDetailSignalementQr>) {
  const [occupe, setOccupe] = useState<StatutSignalementQr | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const d = T.detail
  const auteur = texteAuteurStatutQr(s.statutModifiePar)

  const changer = async (statut: StatutSignalementQr) => {
    if (occupe) return
    setErreur(null)
    setOccupe(statut)
    const resultat = await changerStatutSignalementQr(s.id, statut, jeton, undefined, s.statut)
    setOccupe(null)
    if (!resultat.ok) {
      if (resultat.code === 'conflit_statut') {
        setErreur(d.conflitStatut)
        onConflit?.()
        return
      }
      const message = vueGestionnaire ? messageErreurGestionnaireQr(resultat.code) : d.erreurStatut
      if (vueGestionnaire && resultat.code === 'reseau') toast.error(message)
      setErreur(message)
      return
    }
    onStatut(s.id, resultat.statut, resultat.misAJourLe || new Date().toISOString())
  }

  // Vue d'un gestionnaire : jamais le texte d'une erreur d'envoi (le serveur ne le rend pas).
  const texteEmailNonEnvoye = vueGestionnaire ? EC.emailNonEnvoye : remplir(d.emailNonEnvoye, { erreur: s.emailErreur || '—' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton={TON_STATUT_QR[s.statut]}>{LIBELLE_STATUT_QR[s.statut]}</Badge>
        {s.priorite === 'urgente' && <Badge ton="rouge">{T.urgent}</Badge>}
        <span className="text-sm text-[#4A5E78]">{remplir(d.titre, { numero: numeroSignalementQr(s.id) })}</span>
      </div>
      {auteur && <p className="text-sm text-[#4A5E78]">{auteur}</p>}

      <div>
        <Ligne etiquette={d.declarant}><span className="font-semibold">{nomDeclarantQr(s)}</span></Ligne>
        <Ligne etiquette={d.qualite}>{libelleQualiteQr(s.qualiteDeclarant)}</Ligne>
        <Ligne etiquette={d.telephone}><a href={lienTelephone(s.telephone)} className="underline underline-offset-4">{s.telephone}</a></Ligne>
        <Ligne etiquette={d.email}><a href={`mailto:${s.email}`} className="break-all underline underline-offset-4">{s.email}</a></Ligne>
        <Ligne etiquette={d.lot}>{situationLotQr(s)}</Ligne>
        <Ligne etiquette={d.copropriete}>{s.coproprieteNom}</Ligne>
        {s.adresseProposee && <Ligne etiquette={d.adresseProposee}>{s.adresseProposee}</Ligne>}
        <Ligne etiquette={d.lieu}>{lieuSignalementQr(s)}</Ligne>
        {s.signalementLieId && <Ligne etiquette={d.signalementLie}><span className="font-semibold">{texteSignalementLieQr(s.signalementLieId)}</span></Ligne>}
        <Ligne etiquette={d.type}>{s.typeIntervention}</Ligne>
        <Ligne etiquette={d.urgence}>{LIBELLE_PRIORITE_QR[s.priorite]}</Ligne>
        <Ligne etiquette={d.deposeLe}>{dateHeureParis(s.creeLe)}</Ligne>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-[#4A5E78]">{d.description}</p>
        <p className="whitespace-pre-wrap rounded-xl bg-[#F7F4EE] px-4 py-3 text-base text-[#0D1B2E]">{s.description}</p>
      </div>

      {s.emailEnvoyeLe ? (
        <p className="text-sm text-[#4A5E78]">{remplir(d.emailEnvoye, { date: dateHeureParis(s.emailEnvoyeLe) })}</p>
      ) : (
        <Encadre ton="avertissement">{texteEmailNonEnvoye}</Encadre>
      )}
      <p className="text-sm text-[#4A5E78]">{etatConfirmationQr(s)}</p>

      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <div className="flex flex-wrap gap-2 border-t border-[#E4DDD0] pt-4">
        {ACTIONS_STATUT_QR[s.statut].map((action) => (
          <Bouton
            key={action.statut}
            variante={action.statut === 'annulee' ? 'danger' : action.statut === 'terminee' ? 'principal' : 'secondaire'}
            petit
            disabled={occupe !== null}
            onClick={() => { void changer(action.statut) }}
          >
            {occupe === action.statut ? '…' : action.libelle}
          </Bouton>
        ))}
        <Bouton variante="discret" petit onClick={onFermer}>{d.fermer}</Bouton>
      </div>
    </div>
  )
}
