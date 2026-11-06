'use client'

// ── Détail d'un signalement reçu : coordonnées, lieu, description, statut ──────────────────────────
//
// Contenu d'une fenêtre (Modale du socle UI). Téléphone et e-mail sont des liens (appel, courriel) ;
// l'état de l'e-mail envoyé à l'administrateur et celui de la confirmation au déclarant sont rappelés ;
// les boutons de statut suivent ACTIONS_STATUT_QR et appellent la route PATCH ; l'erreur reste affichée,
// le statut ne bouge pas.

import { useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Encadre, Ligne } from '@/components/coproprietaire-dashboard/ui'
import { numeroSignalementQr, type SignalementQr, type StatutSignalementQr } from '@/lib/aj-signalement/types'
import { changerStatutSignalementQr } from '@/lib/aj-signalement/api'
import {
  ACTIONS_STATUT_QR, LIBELLE_PRIORITE_QR, LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, dateHeureParis,
  etatConfirmationQr, lieuSignalementQr, nomDeclarantQr, situationLotQr,
} from '@/lib/aj-signalement/affichage'

export interface PropsDetailSignalementQr {
  signalement: SignalementQr
  jeton: string | null
  onFermer: () => void
  onStatut: (id: string, statut: StatutSignalementQr, misAJourLe: string) => void
}

/** Lien tel: sans espaces ni ponctuation. */
const lienTelephone = (telephone: string): string => `tel:${telephone.replace(/[\s.()-]/g, '')}`

export default function DetailSignalementQr({ signalement: s, jeton, onFermer, onStatut }: Readonly<PropsDetailSignalementQr>) {
  const [occupe, setOccupe] = useState<StatutSignalementQr | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const d = T.detail

  const changer = async (statut: StatutSignalementQr) => {
    if (occupe) return
    setErreur(null)
    setOccupe(statut)
    const resultat = await changerStatutSignalementQr(s.id, statut, jeton)
    setOccupe(null)
    if (!resultat.ok) {
      setErreur(d.erreurStatut)
      return
    }
    onStatut(s.id, resultat.statut, resultat.misAJourLe || new Date().toISOString())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton={TON_STATUT_QR[s.statut]}>{LIBELLE_STATUT_QR[s.statut]}</Badge>
        {s.priorite === 'urgente' && <Badge ton="rouge">{T.urgent}</Badge>}
        <span className="text-sm text-[#4A5E78]">{remplir(d.titre, { numero: numeroSignalementQr(s.id) })}</span>
      </div>

      <div>
        <Ligne etiquette={d.declarant}><span className="font-semibold">{nomDeclarantQr(s)}</span></Ligne>
        <Ligne etiquette={d.telephone}><a href={lienTelephone(s.telephone)} className="underline underline-offset-4">{s.telephone}</a></Ligne>
        <Ligne etiquette={d.email}><a href={`mailto:${s.email}`} className="break-all underline underline-offset-4">{s.email}</a></Ligne>
        <Ligne etiquette={d.lot}>{situationLotQr(s)}</Ligne>
        <Ligne etiquette={d.copropriete}>{s.coproprieteNom}</Ligne>
        <Ligne etiquette={d.lieu}>{lieuSignalementQr(s)}</Ligne>
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
        <Encadre ton="avertissement">{remplir(d.emailNonEnvoye, { erreur: s.emailErreur || '—' })}</Encadre>
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
