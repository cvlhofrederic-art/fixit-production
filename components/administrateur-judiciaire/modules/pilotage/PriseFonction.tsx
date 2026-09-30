'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { useEcheancesMandat } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance, type TonPastille } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import {
  construireChecklistPriseFonction,
  type StatutDiligence,
} from '@/lib/administrateur-judiciaire/domain/prise-de-fonction'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

/** Couleur de pastille par statut de diligence. */
export const PILL_PAR_STATUT_DILIGENCE: Record<StatutDiligence, string> = {
  Fait: 'sage',
  'En cours': 'amber',
  'À faire': 'gold',
  Bloqué: 'rust',
}

/** Statut suivant au clic sur une ligne : À faire → En cours → Fait → À faire ; Bloqué → En cours. */
export const STATUT_DILIGENCE_SUIVANT: Record<StatutDiligence, StatutDiligence> = {
  'À faire': 'En cours',
  'En cours': 'Fait',
  Fait: 'À faire',
  Bloqué: 'En cours',
}

/** Accent du KPI « Notification de l'ordonnance » selon la pastille de l'échéance (navy → gold ; gold non prévu). */
const ACCENT_KPI_PAR_TON: Partial<Record<TonPastille, string>> = {
  rust: 'rust',
  amber: 'amber',
  sage: 'sage',
  navy: 'gold',
}

/**
 * Prise de fonction (statut partiel) : check-list de reprise de la mission (état local, recalculée quand la
 * copropriété, sa notification ou son fondement changent ; un clic fait tourner le statut d'une ligne), indicateurs
 * et échéances de la notification de l'ordonnance et du compte séparé tirées du moteur de délais légaux.
 */
export function PriseFonctionModule() {
  const { push } = useToast()
  const [code, setCode] = useState(() => codeCoproSelectionne('VM'))
  const copro = useCoproParCode(code)
  const [diligences, setDiligences] = useState(() => construireChecklistPriseFonction(copro))
  useEffect(() => {
    // Recalcul de la check-list (effet de la maquette, conservé tel quel).
    setDiligences(construireChecklistPriseFonction(copro))
    // Dépendances de la maquette : la vue copropriété change d'identité à chaque rendu, seuls ces champs comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, copro.notifOrdonnance, copro.fondement])
  const faireAvancer = (id: number) =>
    setDiligences((precedentes) =>
      precedentes.map((diligence) =>
        diligence.id === id
          ? {
              ...diligence,
              statut: STATUT_DILIGENCE_SUIVANT[diligence.statut],
            }
          : diligence,
      ),
    )
  const accomplies = diligences.filter((diligence) => diligence.statut === 'Fait').length
  const avancement = Math.round((accomplies / diligences.length) * 100)
  const bloquees = diligences.filter((diligence) => diligence.statut === 'Bloqué').length
  const echeancesMandat = useEcheancesMandat(code)
  const trouverEcheance = (regleId: string) =>
    echeancesMandat.echeances.find((echeance) => echeance.regleId === regleId)
  const notification =
    trouverEcheance('notification-ordonnance-46-47') || trouverEcheance('information-coproprietaires-ap291')
  const compteSepare = trouverEcheance('compte-separe-sj')
  const suffixeDateLimite = (echeance: EcheanceCalculee | undefined) =>
    echeance && echeance.dateRetenue ? ` · au plus tard le ${dateIsoVersFr(echeance.dateRetenue)}` : ''
  /** Suffixe ajouté au fondement des lignes 1 (notification) et 3 (compte séparé). */
  const suffixesParDiligence: Record<number, string> = {
    1: suffixeDateLimite(notification),
    3: suffixeDateLimite(compteSepare),
  }
  const statutNotification = notification ? badgeStatutEcheance(notification, AUJOURDHUI_ISO) : null
  const referenceCourte = (copro.fondement || '').includes('29-1')
    ? 'L. 1965 art. 29-1'
    : /\b47\b/.test(copro.fondement || '')
      ? 'D. 1967 art. 47'
      : 'D. 1967 art. 46'
  const compteSepareOuvert = diligences.find((diligence) => diligence.id === 3)?.statut === 'Fait'
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Prise de fonction"
        lede="Reprise de la mission : récupération des archives et fonds, compte séparé, assurance, immatriculation. La douleur la plus concrète d'un début de mandat, structurée et suivie."
        actions={
          <>
            <SelecteurCopropriete value={code} onChange={setCode} />
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'shield',
                  title: 'Rapport de prise de fonction',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: 'Rapport de prise de fonction',
                  meta: `Ordonnance du ${copro.ordonnance} · ${referenceCourte}`,
                  lines: [
                    `État des lieux dressé à la prise de fonction ${(copro.fondement || '').includes('29-1') ? "de l'administrateur provisoire" : 'du syndic judiciaire'}.`,
                    {
                      h: 'Situation',
                    },
                    {
                      k: 'Compte séparé',
                      v: compteSepareOuvert ? 'Ouvert' : 'Non ouvert',
                    },
                    {
                      k: 'Impayés des copropriétaires',
                      v: formatEuros(copro.impayes || 0),
                    },
                    {
                      k: "Notification de l'ordonnance",
                      v: copro.notifOrdonnance || 'À faire',
                    },
                    {
                      h: 'Mesures',
                    },
                    ...(compteSepareOuvert
                      ? []
                      : [
                          {
                            li: 'Ouverture du compte séparé (art. 18 II L. 1965)',
                          },
                        ]),
                    {
                      li: "Reconstitution du carnet d'entretien",
                    },
                  ],
                })
              }
            >
              <Icon name="download" />
              {"Exporter l'état"}
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'clipboard',
            num: `${avancement}%`,
            lbl: 'Avancement de la reprise',
            sub: copro.nom,
            accent: avancement === 100 ? 'sage' : 'amber',
          },
          {
            icon: 'check',
            num: `${accomplies}/${diligences.length}`,
            lbl: 'Diligences accomplies',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: bloquees,
            lbl: 'Points bloquants',
            sub: bloquees ? "remise par l'ancien syndic" : 'aucun',
            accent: bloquees ? 'rust' : 'sage',
          },
          {
            icon: 'clock',
            num:
              notification && notification.dateRetenue ? dateIsoVersFr(notification.dateRetenue).slice(0, 5) : '1 mois',
            lbl: "Notification de l'ordonnance",
            sub: `${notification ? notification.fondements[0] : 'D. 1967 art. 59'} · ${statutNotification ? statutNotification.label : '1 mois après le prononcé'}`,
            accent: statutNotification ? ACCENT_KPI_PAR_TON[statutNotification.kind] : 'gold',
          },
        ]}
      />
      <Panel
        title="Check-list de reprise de mission"
        sub="Cliquez sur une ligne pour faire évoluer son statut · fondement légal indiqué"
        icon="clipboard"
        right={
          <Pill kind={avancement === 100 ? 'sage' : 'amber'} noDot>
            {avancement}%
          </Pill>
        }
        flush
      >
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              height: 8,
              borderRadius: 5,
              background: 'var(--cream)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${avancement}%`,
                height: '100%',
                background: 'linear-gradient(90deg,var(--sage-700),var(--sage-500))',
              }}
            />
          </div>
        </div>
        {diligences.map((diligence) => (
          <button
            onClick={() => faireAvancer(diligence.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 22px',
              borderBottom: '1px solid var(--line)',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
            }}
            key={diligence.id}
          >
            <span
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 6,
                border: '1.5px solid ' + (diligence.statut === 'Fait' ? 'var(--sage-500)' : 'var(--line)'),
                background: diligence.statut === 'Fait' ? 'var(--sage-500)' : '#fff',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {diligence.statut === 'Fait' && (
                <Icon
                  name="check"
                  style={{
                    width: 13,
                    height: 13,
                  }}
                />
              )}
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  textDecoration: diligence.statut === 'Fait' ? 'line-through' : 'none',
                  color: diligence.statut === 'Fait' ? 'var(--navy-300)' : 'inherit',
                }}
              >
                {diligence.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--navy-300)',
                  marginTop: 2,
                }}
              >
                {diligence.art}
                {suffixesParDiligence[diligence.id] || ''}
                {' · '}
                {diligence.role}
              </div>
            </div>
            <Pill kind={PILL_PAR_STATUT_DILIGENCE[diligence.statut]} noDot>
              {diligence.statut}
            </Pill>
          </button>
        ))}
      </Panel>
    </>
  )
}
