'use client'

import { useState } from 'react'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { ListeEcheancesLegales } from '@/components/administrateur-judiciaire/ui/ListeEcheancesLegales'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { useEcheancesMandat } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { dateFrVersIso, dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { ficheRegimeCopro, LIBELLES_REGIMES, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

/** Pièce versée au dossier juridictionnel. */
export interface PieceDossierJuridictionnel {
  nom: string
  /** « JJ/MM/AAAA » ou libellé (« — », « à notifier au plus tard le … »). */
  date: string
  statut: string
  pill: string
}

/** Requête au tribunal et son suivi (dépôt → délibéré → ordonnance). */
export interface RequeteTribunal {
  objet: string
  /** Date de dépôt « JJ/MM/AAAA » ou libellé (« À déposer », « — »). */
  date: string
  statut: string
  pill: string
  /** Ordonnance rendue, « — » sinon. */
  ord: string
}

/** Événement de la chronologie de la mission (date « JJ/MM/AAAA », texte, couleur de la pastille). */
export interface EvenementChronologieMission {
  d: string
  t: string
  k: string
}

/**
 * Dossier juridictionnel du mandat (statut partiel) : pièces du dossier, requêtes au tribunal, échéances légales
 * calculées par le moteur de délais et chronologie. Les lignes datées avant l'ordonnance sont masquées ; les dates
 * non analysables (« — », « À déposer ») restent affichées. Contenu propre à certaines copropriétés (maquette) :
 * TL a la requête en prorogation et une taxation « En délibéré », VM une notification « En cours ».
 */
export function DossierJuridictionnelModule() {
  const { push } = useToast()
  const [code, setCode] = useState(() => codeCoproSelectionne('TL'))
  const copro = useCoproParCode(code)
  const regime = ficheRegimeCopro(copro)
  const estAp291 = regime.code === 'ap291'
  const echeancesMandat = useEcheancesMandat(code)
  const trouverEcheance = (regleId: string) =>
    echeancesMandat.echeances.find((echeance) => echeance.regleId === regleId)
  // Le fondement affiché vient du contexte du moteur (regimeDepuisFondement), à défaut de la fiche de régime.
  const regimeFondement: Regime = echeancesMandat.contexte
    ? echeancesMandat.contexte.regime
    : estAp291
      ? 'ap291'
      : 'sj'
  const notification = trouverEcheance(
    estAp291 ? 'information-coproprietaires-ap291' : 'notification-ordonnance-46-47',
  )
  const rapportIntermediaire = trouverEcheance('rapport-intermediaire-ap291')
  /** Vrai si la date n'est pas antérieure à l'ordonnance (ou si l'une des deux n'est pas une date « JJ/MM/AAAA »). */
  const nonAnterieureAOrdonnance = (date: string) => {
    const dateIso = dateFrVersIso(date),
      ordonnanceIso = dateFrVersIso(copro.ordonnance)
    return !dateIso || !ordonnanceIso || dateIso >= ordonnanceIso
  }
  const pieces: PieceDossierJuridictionnel[] = [
    {
      nom: 'Ordonnance de désignation',
      date: copro.ordonnance,
      statut: 'Versée',
      pill: 'sage',
    },
    {
      nom: `Notification aux copropriétaires (art. ${estAp291 ? '62-5' : '59'} décret)`,
      date:
        copro.code === 'VM' && notification && notification.dateRetenue
          ? `à notifier au plus tard le ${dateIsoVersFr(notification.dateRetenue)}`
          : '—',
      statut: copro.code === 'VM' ? 'En cours' : 'Effectuée',
      pill: copro.code === 'VM' ? 'amber' : 'sage',
    },
    ...(estAp291
      ? [
          {
            nom: 'Rapport intermédiaire (art. 29-1 I, 6 mois)',
            date:
              rapportIntermediaire && rapportIntermediaire.dateRetenue
                ? `au plus tard le ${dateIsoVersFr(rapportIntermediaire.dateRetenue)}`
                : 'À échéance',
            statut: rapportIntermediaire && rapportIntermediaire.accomplie ? 'Remis' : 'À établir',
            pill: rapportIntermediaire && rapportIntermediaire.accomplie ? 'sage' : 'rust',
          },
        ]
      : []),
    {
      nom: 'Procès-verbal de la dernière AG',
      date: '18/05/2026',
      statut: 'Versé',
      pill: 'sage',
    },
    {
      nom: 'Rapport de fin de mission',
      date: '—',
      statut: 'Non échu',
      pill: 'gold',
    },
  ]
  const requetes: RequeteTribunal[] = [
    ...(copro.code === 'TL'
      ? [
          {
            objet: 'Requête en prorogation de la mission',
            date: 'À déposer',
            statut: 'À préparer',
            pill: 'rust',
            ord: '—',
          },
        ]
      : []),
    {
      objet: 'Requête en autorisation de travaux urgents',
      date: '02/04/2026',
      statut: 'Ordonnance rendue',
      pill: 'sage',
      ord: 'Ord. du 11/04/2026',
    },
    {
      objet: 'Requête en taxation des honoraires',
      date: copro.code === 'TL' ? '05/03/2026' : '—',
      statut: copro.code === 'TL' ? 'En délibéré' : 'Non déposée',
      pill: copro.code === 'TL' ? 'amber' : 'gold',
      ord: '—',
    },
  ].filter((requete) => nonAnterieureAOrdonnance(requete.date))
  const chronologie: EvenementChronologieMission[] = [
    {
      d: copro.ordonnance,
      t: `Ordonnance de désignation — ${regime.label}`,
      k: 'sage',
    },
    {
      d: '11/04/2026',
      t: 'Ordonnance autorisant les travaux urgents',
      k: 'sage',
    },
    ...(estAp291 && rapportIntermediaire && rapportIntermediaire.dateRetenue
      ? [
          {
            d: dateIsoVersFr(rapportIntermediaire.dateRetenue),
            t: 'Rapport intermédiaire (art. 29-1 I) : mesures de redressement financier',
            k: 'rust',
          },
        ]
      : []),
    {
      d: copro.echeance,
      t: 'Échéance de la mission',
      k: 'amber',
    },
  ]
    .filter((evenement) => nonAnterieureAOrdonnance(evenement.d))
    .sort((a, b) => (dateFrVersIso(a.d) || '').localeCompare(dateFrVersIso(b.d) || ''))
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Dossier juridictionnel"
        lede="Tout le dialogue avec le tribunal pour ce mandat : pièces du dossier, requêtes et leur suivi (dépôt → délibéré → ordonnance), chronologie."
        actions={
          <>
            <SelecteurCopropriete value={code} onChange={setCode} />
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'scale',
                  title: 'Nouvelle requête au tribunal',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: 'Projet de requête',
                  meta: 'Tribunal judiciaire',
                  lines: [
                    'Modèle de requête à compléter au titre de la mission.',
                    {
                      h: 'Mentions',
                    },
                    {
                      li: "Référence de l'ordonnance",
                    },
                    {
                      li: 'Objet et fondement juridique',
                    },
                    {
                      li: 'Pièces justificatives',
                    },
                  ],
                })
              }
            >
              <Icon name="plus" />
              Nouvelle requête
            </button>
          </>
        }
      />
      <Alert kind="sage" icon="scale" title={`${regime.label} — ${copro.tribunal}`}>
        {'Désignation sur le fondement : '}
        {LIBELLES_REGIMES[regimeFondement].fondement}
        {'. RG '}
        {copro.rg}
        {' · ordonnance du '}
        {copro.ordonnance}
        {' · durée '}
        {copro.dureeMois}
        {' mois, fin le '}
        {copro.echeance}
        {estAp291 ? ' (minimum légal : 12 mois)' : ''}
        {'.'}
      </Alert>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 16,
        }}
      >
        <Panel title="Requêtes au tribunal" sub="Suivi dépôt → délibéré → ordonnance" icon="scale" flush>
          <DataTable
            rowKey="objet"
            columns={[
              {
                h: 'Objet',
                render: (requete) => (
                  <b
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {requete.objet}
                  </b>
                ),
              },
              {
                h: 'Déposée le',
                render: (requete) => requete.date,
              },
              {
                h: 'Statut',
                render: (requete) => (
                  <Pill kind={requete.pill} noDot>
                    {requete.statut}
                  </Pill>
                ),
              },
              {
                h: 'Ordonnance',
                render: (requete) => (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {requete.ord}
                  </span>
                ),
              },
            ]}
            rows={requetes}
          />
        </Panel>
        <Panel title="Pièces du dossier" icon="doc" flush>
          {pieces.map((piece, index) => (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 20px',
                borderBottom: '1px solid var(--line)',
              }}
              key={index}
            >
              <div
                className="thumb"
                style={{
                  flexShrink: 0,
                }}
              >
                <Icon name="doc" />
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {piece.nom}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {piece.date}
                </div>
              </div>
              <Pill kind={piece.pill} noDot>
                {piece.statut}
              </Pill>
            </div>
          ))}
        </Panel>
      </div>
      <Panel
        title="Échéances légales du mandat"
        sub={`Calculées par le moteur de délais légaux · date de référence ${dateIsoVersFr(AUJOURDHUI_ISO)}`}
        icon="clock"
        flush
      >
        {echeancesMandat.etat === 'chargement' ? (
          <div
            style={{
              padding: '22px',
              textAlign: 'center',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            {MESSAGES_ETAT_ECHEANCES.chargement}
          </div>
        ) : (
          <ListeEcheancesLegales
            items={echeancesMandat.echeances}
            reference={AUJOURDHUI_ISO}
            vide={MESSAGES_ETAT_ECHEANCES[echeancesMandat.etat]}
            grouper
          />
        )}
      </Panel>
      <Panel title="Chronologie de la mission" sub="Échanges et actes juridictionnels" icon="clock" flush>
        {chronologie.map((evenement, index) => (
          <div
            style={{
              display: 'flex',
              gap: 14,
              padding: '13px 22px',
              borderBottom: '1px solid var(--line)',
              alignItems: 'center',
            }}
            key={index}
          >
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--navy-500)',
                width: 90,
                flexShrink: 0,
              }}
            >
              {evenement.d}
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: `var(--${evenement.k}-500)`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
              }}
            >
              {evenement.t}
            </span>
          </div>
        ))}
      </Panel>
    </>
  )
}
