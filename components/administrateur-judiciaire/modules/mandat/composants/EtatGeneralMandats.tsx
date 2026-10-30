'use client'

import { DEMO_TACHES, type TacheDemo } from '@/components/administrateur-judiciaire/data/taches'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { ListeEcheancesLegales } from '@/components/administrateur-judiciaire/ui/ListeEcheancesLegales'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useCoproprietesAffichees } from '@/lib/administrateur-judiciaire/db/hooks'
import { useEcheancesPortefeuille } from '@/lib/administrateur-judiciaire/db/use-echeances'
import {
  MODELES_ACTES_EXPRESS,
  type CleActeExpress,
  type ModeleActeExpress,
} from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import { dateIsoVersFr, ecartJours, joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  MESSAGES_ETAT_ECHEANCES,
  filtrerEcheancesAAfficher,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * État général des mandats, partagé par le tableau de bord (page d'accueil) et l'ancienne page « Aujourd'hui »
 * (cockpit, retirée du menu le 29/10/2026) : alerte d'échéance dépassée, radar des mandats, échéances légales du
 * portefeuille et génération express d'actes. Code repris tel quel du cockpit.
 */

/** Acte express ouvert dans la GenerationActeModal : modèle et copropriété proposée. */
export interface ActeExpressOuvert {
  tpl: CleActeExpress | undefined
  code: string
}

/** Pastille d'urgence d'une échéance : libellé et variante de couleur (chaîne vide = pastille neutre). */
export interface PastilleUrgence {
  lbl: string
  k: '' | 'rust' | 'amber' | 'gold' | 'sage'
}

/**
 * Échelle d'urgence : sans date « — » ; en retard ou aujourd'hui en rouille ; J-1 à J-3 ambre ; J-4 à J-10 or ;
 * au-delà sauge.
 */
export function pastilleUrgence(jours: number | null): PastilleUrgence {
  if (jours == null) return { lbl: '—', k: '' }
  if (jours < 0) return { lbl: `Retard ${Math.abs(jours)} j`, k: 'rust' }
  if (jours === 0) return { lbl: "Aujourd'hui", k: 'rust' }
  if (jours <= 3) return { lbl: `J-${jours}`, k: 'amber' }
  if (jours <= 10) return { lbl: `J-${jours}`, k: 'gold' }
  return { lbl: `J-${jours}`, k: 'sage' }
}

/** Tâche de la file d'actions, avec le nombre de jours avant son échéance (null si date illisible). */
export type TacheDatee = TacheDemo & { d: number | null }

/** Tâches de démonstration du rôle (toutes pour la direction), triées par urgence ; sans date en dernier. */
export function tachesDuRole(role: RoleCabinet): TacheDatee[] {
  return (role === 'Direction' ? DEMO_TACHES : DEMO_TACHES.filter((tache) => tache.role === role))
    .map((tache) => ({
      ...tache,
      d: joursAvantDateFr(tache.due),
    }))
    .sort((a, b) => (a.d ?? 999) - (b.d ?? 999))
}

/** Vrai si l'échéance de la tâche est passée (aujourd'hui exclu). */
export const estEnRetard = (tache: TacheDatee): boolean => tache.d != null && tache.d < 0

/** Alerte des échéances légales dépassées ; rien quand il n'y en a aucune. */
export function AlerteEcheancesDepassees({ nombre }: { nombre: number }) {
  if (nombre <= 0) return null
  const pluriel = nombre > 1 ? 's' : ''
  return (
    <Alert kind="warn" icon="siren" title={`${nombre} échéance${pluriel} légale${pluriel} dépassée${pluriel}`}>
      {
        "Une échéance non tenue engage la responsabilité du cabinet auprès du tribunal. Traitez les actions en rouge en priorité — l'acte correspondant se génère en un clic."
      }
    </Alert>
  )
}

/**
 * Radar des mandats : une carte par copropriété affichée (base locale en mode réel, démonstration sinon : la même liste
 * que le sélecteur du haut de page), avec la pastille d'urgence de sa fin de mission. Un clic choisit la copropriété
 * de la carte puis ouvre les mandats, qui s'affichent donc sur elle.
 */
export function RadarMandats() {
  const copros = useCoproprietesAffichees()
  return (
    <>
      <div className="section-eyebrow">
        <span>Radar des mandats — prochaine échéance de mission</span>
        <div className="line" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 12,
          marginBottom: 8,
        }}
      >
        {copros.map((copro) => {
          const pastille = pastilleUrgence(joursAvantDateFr(copro.echeance))
          return (
            <button
              onClick={() => {
                useSelectionDossier.getState().choisirCopro(copro.code)
                naviguerVers('mandats')
              }}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 16,
              }}
              key={copro.id}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'var(--cream)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'Cormorant Garamond,serif',
                    fontWeight: 600,
                  }}
                >
                  {copro.code}
                </span>
                <Pill kind={pastille.k} noDot>
                  {pastille.lbl}
                </Pill>
              </div>
              <div
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 17,
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {copro.nom}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                  marginTop: 3,
                }}
              >
                {copro.fondement}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-500)',
                  marginTop: 6,
                }}
              >
                {'Fin de mission · '}
                {copro.echeance}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Échéances légales de tous les mandats : moteur de délais légaux, fenêtre de J-60 à J+120 autour du jour. */
export function PanneauEcheancesLegales() {
  const portefeuille = useEcheancesPortefeuille(),
    echeancesFenetre = filtrerEcheancesAAfficher(portefeuille.items, AUJOURDHUI_ISO).filter((item) => {
      if (!item.echeance.dateRetenue) return false
      const jours = ecartJours(AUJOURDHUI_ISO, item.echeance.dateRetenue)
      return jours >= -60 && jours <= 120
    }),
    nombreSurEvenement = portefeuille.items.filter((item) => !item.echeance.dateRetenue).length,
    messageVide = portefeuille.erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : 'Aucune échéance légale dans la fenêtre.'
  return (
    <Panel
      title="Échéances légales · tous les mandats"
      sub={`Moteur de délais légaux · de J-60 à J+120 autour du ${dateIsoVersFr(AUJOURDHUI_ISO)} · ${nombreSurEvenement} échéance${nombreSurEvenement > 1 ? 's' : ''} à déclencher sur événement`}
      icon="clock"
      right={
        <Pill kind="navy" noDot>
          {echeancesFenetre.length}
        </Pill>
      }
      flush
    >
      {portefeuille.loading ? (
        <div
          style={{
            padding: '22px',
            textAlign: 'center',
            color: 'var(--navy-300)',
            fontSize: 13,
          }}
        >
          Chargement des mandats…
        </div>
      ) : (
        <ListeEcheancesLegales items={echeancesFenetre} reference={AUJOURDHUI_ISO} max={8} vide={messageVide} />
      )}
    </Panel>
  )
}

export interface PanneauActesExpressProps {
  /** Acte choisi : clé du modèle et copropriété proposée (celle du modèle). */
  onChoisir: (tpl: CleActeExpress, code: string) => void
}

/** Génération express d'actes : un bouton par modèle ; l'acte s'ouvre pré-rempli avec les données du mandat. */
export function PanneauActesExpress({ onChoisir }: PanneauActesExpressProps) {
  return (
    <Panel title="Génération express d'actes" sub="Un clic = l'acte prêt, données du mandat fusionnées" icon="sparkle">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {(Object.entries(MODELES_ACTES_EXPRESS) as [CleActeExpress, ModeleActeExpress][]).map(([cle, modele]) => (
          <button
            onClick={() => onChoisir(cle, modele.code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              cursor: 'pointer',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '12px 14px',
            }}
            key={cle}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'var(--cream)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--navy-700)',
                flexShrink: 0,
              }}
            >
              <Icon
                name={modele.icon}
                style={{
                  width: 17,
                  height: 17,
                }}
              />
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              {modele.label}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
