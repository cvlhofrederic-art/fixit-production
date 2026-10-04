'use client'

import { useState, type ReactNode } from 'react'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceLegale } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import {
  BADGES_CERTITUDE_ECHEANCE,
  badgeStatutEcheance,
  estEcheanceAccomplieOuRevolue,
} from '@/lib/administrateur-judiciaire/domain/echeances-affichage'

/** Copropriété rattachée à une échéance (portefeuille) : identifiant pour la clé React, nom affiché devant le libellé. */
export interface CoproEcheance {
  id: string
  nom: string
}

/** Échéance accompagnée de sa copropriété (null pour une échéance d'un seul mandat). */
export interface EcheanceAvecCopro {
  echeance: EcheanceLegale
  copro: CoproEcheance | null
}

/** Élément accepté par la liste : échéance nue ou échéance accompagnée de sa copropriété. */
export type ElementListeEcheances = EcheanceLegale | EcheanceAvecCopro

/** Même test que la maquette : seul un élément doté d'un champ « echeance » renseigné est déjà enveloppé. */
function estEcheanceAvecCopro(element: ElementListeEcheances): element is EcheanceAvecCopro {
  return Boolean(element) && 'echeance' in element && Boolean(element.echeance)
}

export interface LigneEcheanceLegaleProps {
  echeance: EcheanceLegale
  /** Copropriété affichée devant le libellé (listes de portefeuille). */
  copro?: Pick<CoproEcheance, 'nom'> | null
  /** Date de référence ISO du statut. */
  reference: string
  /** Ligne atténuée (échéances accomplies ou passées, groupe replié). */
  attenuee?: boolean
}

/**
 * Ligne d'une échéance légale : date retenue, copropriété facultative, libellé, pastille de certitude, fondements,
 * libellé du délai, report CPC art. 642, points à vérifier et pastille de statut. La note de la règle sert d'infobulle.
 */
export function LigneEcheanceLegale({ echeance, copro, reference, attenuee }: LigneEcheanceLegaleProps) {
  const statut = badgeStatutEcheance(echeance, reference),
    certitude = BADGES_CERTITUDE_ECHEANCE[echeance.certitude]
  return (
    <div
      title={echeance.note}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 22px',
        borderBottom: '1px solid var(--line)',
        opacity: attenuee ? 0.6 : 1,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: 'var(--navy-500)',
          width: 84,
          flexShrink: 0,
        }}
      >
        {echeance.dateRetenue ? dateIsoVersFr(echeance.dateRetenue) : '·'}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {copro && (
            <span
              style={{
                color: 'var(--navy-500)',
                fontWeight: 500,
              }}
            >
              {copro.nom}
              {' · '}
            </span>
          )}
          {echeance.libelle}
          {certitude && (
            <span
              style={{
                marginLeft: 8,
              }}
            >
              <Pill kind={certitude.kind} noDot>
                {certitude.label}
              </Pill>
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--navy-300)',
            marginTop: 2,
          }}
        >
          {echeance.fondements.join(' · ')}
          {' · '}
          {echeance.delaiLibelle}
          {echeance.dateProrogee && (
            <>
              {' · légal '}
              {/* La date légale est toujours renseignée quand une date prorogée existe ; String() garde l'erreur de la maquette sinon. */}
              {dateIsoVersFr(String(echeance.dateLegale))}
              {', reporté (CPC art. 642)'}
            </>
          )}
          {echeance.aVerifier.length > 0 && (
            <>
              {' · à vérifier : '}
              {echeance.aVerifier.join(' ; ')}
            </>
          )}
        </div>
      </div>
      <Pill kind={statut.kind} noDot>
        {statut.label}
      </Pill>
    </div>
  )
}

/** Petite ligne de texte grisé sous la liste (aucune échéance en cours, N autres non affichées). */
function MentionListeEcheances({ children }: { children?: ReactNode }) {
  return (
    <div
      style={{
        padding: '11px 22px',
        fontSize: 11.5,
        color: 'var(--navy-300)',
      }}
    >
      {children}
    </div>
  )
}

export interface ListeEcheancesLegalesProps {
  items?: readonly ElementListeEcheances[] | null
  /** Date de référence ISO des statuts. */
  reference: string
  /** Nombre maximal d'échéances en cours affichées (toutes si absent ou 0). */
  max?: number
  /** Message affiché quand la liste est vide. */
  vide?: string
  /** Range les échéances accomplies ou révolues dans un groupe repliable. */
  grouper?: boolean
}

/**
 * Liste des échéances légales calculées : limite d'affichage, message si vide et, en option, regroupement repliable
 * des échéances accomplies ou passées.
 */
export function ListeEcheancesLegales({
  items,
  reference,
  max,
  vide = 'Aucune échéance légale calculée.',
  grouper = false,
}: ListeEcheancesLegalesProps) {
  const [groupeOuvert, setGroupeOuvert] = useState(false),
    elements: EcheanceAvecCopro[] = (items || []).map((element) =>
      estEcheanceAvecCopro(element)
        ? element
        : {
            echeance: element,
            copro: null,
          },
    ),
    enCours = grouper
      ? elements.filter((element) => !estEcheanceAccomplieOuRevolue(element.echeance, reference))
      : elements,
    accompliesOuPassees = grouper
      ? elements.filter((element) => estEcheanceAccomplieOuRevolue(element.echeance, reference))
      : []
  if (elements.length === 0)
    return (
      <div
        style={{
          padding: '22px',
          textAlign: 'center',
          color: 'var(--navy-300)',
          fontSize: 13,
        }}
      >
        {vide}
      </div>
    )
  const affichees = max ? enCours.slice(0, max) : enCours,
    nonAffichees = enCours.length - affichees.length,
    cle = (element: EcheanceAvecCopro) => `${element.copro ? element.copro.id : ''}-${element.echeance.regleId}`
  return (
    <>
      {affichees.map((element) => (
        <LigneEcheanceLegale
          echeance={element.echeance}
          copro={element.copro}
          reference={reference}
          key={cle(element)}
        />
      ))}
      {enCours.length === 0 && (
        <MentionListeEcheances>Aucune échéance en cours : tout ce qui était dû est accompli ou passé.</MentionListeEcheances>
      )}
      {nonAffichees > 0 && (
        <MentionListeEcheances>
          {nonAffichees}
          {' autre'}
          {nonAffichees > 1 ? 's' : ''}
          {' échéance'}
          {nonAffichees > 1 ? 's' : ''}
          {' non affichée'}
          {nonAffichees > 1 ? 's' : ''}
          {'.'}
        </MentionListeEcheances>
      )}
      {accompliesOuPassees.length > 0 && (
        <>
          <button
            type="button"
            className="btn"
            onClick={() => setGroupeOuvert((ouvert) => !ouvert)}
            style={{
              margin: '10px 22px',
            }}
          >
            {groupeOuvert ? 'Masquer' : 'Afficher'}
            {' les '}
            {accompliesOuPassees.length}
            {' échéance'}
            {accompliesOuPassees.length > 1 ? 's' : ''}
            {' accomplie'}
            {accompliesOuPassees.length > 1 ? 's' : ''}
            {' ou passée'}
            {accompliesOuPassees.length > 1 ? 's' : ''}
          </button>
          {groupeOuvert &&
            accompliesOuPassees.map((element) => (
              <LigneEcheanceLegale
                echeance={element.echeance}
                copro={element.copro}
                reference={reference}
                attenuee
                key={cle(element)}
              />
            ))}
        </>
      )}
    </>
  )
}
