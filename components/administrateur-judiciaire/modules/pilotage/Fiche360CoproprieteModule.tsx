'use client'

import type { ReactNode } from 'react'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { LigneCleValeur } from '@/components/administrateur-judiciaire/ui/LigneCleValeur'
import { ListeEcheancesLegales } from '@/components/administrateur-judiciaire/ui/ListeEcheancesLegales'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import type { Coproprietaire, Sinistre } from '@/lib/administrateur-judiciaire/db/schema'
import { useFiche360Copropriete } from '@/lib/administrateur-judiciaire/db/use-fiches-360'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance, type TonPastille } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import type {
  PersonneCopropriete,
  SituationChronologie,
  SourceChronologie,
} from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { LIBELLES_REGIMES, regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatDateOuPoint, formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** Libellé de l'origine d'un événement de la chronologie (champ `source` de la fiche 360). */
export const LIBELLES_SOURCE_CHRONOLOGIE: Record<SourceChronologie, string> = {
  mandat: 'Mandat',
  moteur: 'Moteur de délais',
  suivi: 'Suivi du cabinet',
  tache: 'Tâche',
}

/** Pastille de situation d'un événement de la chronologie par rapport à la date de référence. */
export const PILL_SITUATION_CHRONOLOGIE: Record<SituationChronologie, { kind: TonPastille; label: string }> = {
  passee: {
    kind: 'navy',
    label: 'Passé',
  },
  aujourdhui: {
    kind: 'rust',
    label: "Aujourd'hui",
  },
  a_venir: {
    kind: 'sage',
    label: 'À venir',
  },
}

/**
 * Sinistre tel que l'écran le lit : type, référence et statut ne sont pas déclarés dans le schéma de la base
 * (table jamais alimentée) ; absents, ils ne s'affichent pas, comme dans la maquette.
 */
type SinistreAffiche = Sinistre & {
  type?: string
  reference?: string
  statut?: string
}

/** Échéance du moteur dont la date retenue est connue. */
type EcheanceDatee = EcheanceCalculee & { dateRetenue: string }

/** Message grisé d'un panneau sans contenu. */
function MessagePanneauVide({ children }: { children?: ReactNode }) {
  return (
    <div
      style={{
        padding: '18px 22px',
        color: 'var(--navy-300)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Date d'une vue copropriété pour formatDateOuPoint : sans mandat, la vue porte une chaîne ISO (createdAt),
 * que la maquette affichait « · » (seules les Date sont formatées).
 */
const dateOuNull = (valeur: Date | string): Date | null => (valeur instanceof Date ? valeur : null)

/**
 * Fiche 360 d'une copropriété (données réelles de la base locale) : mandat, argent, échéances légales,
 * copropriétaires, obligations et tâches, contrats et sinistres, chronologie. Code sélectionné, sinon « VM ».
 */
export function Fiche360CoproprieteModule() {
  const { code, choisirCopro, choisirPersonne } = useSelectionDossier()
  const codeCopro = code || 'VM'
  const { loading, erreur, fiche } = useFiche360Copropriete(codeCopro)
  const ouvrirEcran = (route: string) => {
    choisirCopro(codeCopro)
    naviguerVers(route)
  }
  const ouvrirPersonne = (personne: PersonneCopropriete<Coproprietaire>) => {
    choisirPersonne(personne.id)
    naviguerVers('personne360')
  }
  const actions = (
    <>
      <SelecteurCopropriete value={codeCopro} onChange={choisirCopro} />
      <button className="btn" onClick={() => ouvrirEcran('dossierJud')}>
        <Icon name="scale" />
        Dossier juridictionnel
      </button>
      <button className="btn" onClick={() => ouvrirEcran('priseFonction')}>
        <Icon name="clipboard" />
        Prise de fonction
      </button>
      <button className="btn" onClick={() => ouvrirEcran('notifJud')}>
        <Icon name="mail" />
        Notifications
      </button>
      <button className="btn" onClick={() => ouvrirEcran('journal')}>
        <Icon name="history" />
        Journal
      </button>
      <button className="btn gold" onClick={() => ouvrirEcran('cockpit')}>
        <Icon name="pencil" />
        Actes
      </button>
    </>
  )
  if (loading)
    return (
      <>
        <PageHead eyebrow="Fiche 360" title="Copropriété" lede={MESSAGES_ETAT_ECHEANCES.chargement} actions={actions} />
      </>
    )
  if (!fiche)
    return (
      <>
        <PageHead
          eyebrow="Fiche 360"
          title="Copropriété"
          lede={erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : MESSAGES_ETAT_ECHEANCES.introuvable}
          actions={actions}
        />
      </>
    )
  const {
    vue,
    personnes,
    debiteurs,
    totalDebiteur,
    tauxImpayes,
    seuilAdHoc,
    obligationsSuivi,
    taches,
    contrats,
    sinistres,
    prestataires,
    echeances,
    chronologie,
  } = fiche
  const regime = regimeDepuisFondement(vue.fondement)
  const libelleRegime = regime ? LIBELLES_REGIMES[regime].libelle : vue.fondement
  const echeancesEchues = echeances.echeances.filter(
    (echeance): echeance is EcheanceDatee =>
      !!echeance.dateRetenue &&
      !echeance.accomplie &&
      (echeance.nature === 'obligation' || echeance.nature === 'repere') &&
      badgeStatutEcheance(echeance, AUJOURDHUI_ISO).kind === 'rust',
  )
  const seuilAdHocAtteint = tauxImpayes != null && tauxImpayes >= seuilAdHoc
  // Taux d'impayés en pourcentage : utilisé seulement quand le taux est connu.
  const pourcentageImpayes = Math.round((tauxImpayes ?? 0) * 100)
  const compteSepare = echeances.echeances.find((echeance) => echeance.regleId === 'compte-separe-sj')
  const sinistresAffiches: SinistreAffiche[] = sinistres
  return (
    <>
      <PageHead
        eyebrow="Fiche 360 · copropriété"
        title={vue.nom}
        lede={`${vue.adresse} · ${vue.lots} lots · ${libelleRegime} · ${vue.tribunal || 'tribunal non renseigné'}${vue.rg ? ` · RG ${vue.rg}` : ''}`}
        actions={actions}
      />
      <Kpis
        items={[
          {
            icon: 'coin',
            num: formatEuros(vue.budget),
            lbl: 'Budget prévisionnel',
            sub: `${formatEuros(vue.depense)} engagés`,
          },
          {
            icon: 'alert',
            num: formatEuros(vue.impayes),
            lbl: 'Impayés déclarés',
            sub:
              tauxImpayes != null
                ? `${pourcentageImpayes} % du budget · seuil mandataire ad hoc ${Math.round(seuilAdHoc * 100)} %`
                : 'budget inconnu',
            accent: seuilAdHocAtteint ? 'rust' : 'amber',
          },
          {
            icon: 'users',
            num: debiteurs.length,
            lbl: 'Copropriétaires débiteurs',
            sub: debiteurs.length
              ? `${formatEuros(-totalDebiteur)} dus · sur ${personnes.length} enregistrés`
              : `${personnes.length} enregistrés`,
            accent: debiteurs.length ? 'rust' : 'sage',
          },
          {
            icon: 'clock',
            num: echeancesEchues.length,
            lbl: 'Échéances légales échues',
            sub: echeancesEchues.length
              ? echeancesEchues.map((echeance) => dateIsoVersFr(echeance.dateRetenue)).join(', ')
              : 'aucune',
            accent: echeancesEchues.length ? 'rust' : 'sage',
          },
        ]}
      />
      {seuilAdHocAtteint && (
        <Alert kind="warn" icon="siren" title="Seuil de saisine pour un mandataire ad hoc atteint">
          {'Impayés à '}
          {pourcentageImpayes}
          {' % du budget, seuil de '}
          {Math.round(seuilAdHoc * 100)}
          {
            ' % (L. 1965 art. 29-1 A, apprécié sur les sommes exigibles à la clôture des comptes ; ici rapporté au budget).'
          }
        </Alert>
      )}
      <div className="card-grid cols-2">
        <Panel title="Mandat" sub="Ce que la base sait du mandat en cours" icon="scale">
          <LigneCleValeur k="Régime" v={libelleRegime} />
          <LigneCleValeur k="Fondement saisi" v={vue.fondement} />
          <LigneCleValeur k="Tribunal · RG" v={`${vue.tribunal || '·'} · ${vue.rg || '·'}`} />
          <LigneCleValeur k="Ordonnance" v={formatDateOuPoint(dateOuNull(vue.ordonnance))} />
          <LigneCleValeur
            k="Durée · fin de mission"
            v={`${vue.dureeMois || '·'} mois · ${formatDateOuPoint(dateOuNull(vue.echeance))}`}
          />
          <LigneCleValeur k="Notification de l'ordonnance" v={vue.notifOrdonnance || '·'} />
          <LigneCleValeur k="Motif" v={vue.motif || '·'} />
          <LigneCleValeur
            k="Statut"
            v={
              <Pill kind={vue.pill || 'navy'} noDot>
                {vue.statut || '·'}
              </Pill>
            }
          />
          {echeances.anomalies.map((anomalie, index) => (
            <p
              style={{
                fontSize: 12,
                margin: '8px 0 0',
                color: anomalie.niveau === 'erreur' ? 'var(--rust-500)' : 'var(--navy-500)',
              }}
              key={index}
            >
              {anomalie.niveau === 'erreur' ? 'Erreur' : 'Alerte'}
              {' : '}
              {anomalie.message}
            </p>
          ))}
        </Panel>
        <Panel title="Argent" sub="Budget, fonds et impayés déclarés au mandat" icon="coin">
          <LigneCleValeur k="Budget prévisionnel" v={formatEuros(vue.budget)} />
          <LigneCleValeur k="Charges engagées" v={formatEuros(vue.depense)} />
          <LigneCleValeur k="Impayés" v={formatEuros(vue.impayes)} />
          <LigneCleValeur k="Fonds de travaux" v={formatEuros(vue.fondsTravaux)} />
          <LigneCleValeur
            k="Compte séparé"
            v={
              compteSepare
                ? compteSepare.accomplie
                  ? 'Ouvert'
                  : // Date absente : dateIsoVersFr lève une erreur, comme la maquette (String garde ce comportement).
                    `À ouvrir · au plus tard le ${dateIsoVersFr(String(compteSepare.dateRetenue))}`
                : 'Non suivi par le moteur pour ce régime'
            }
          />
          <p
            style={{
              fontSize: 11.5,
              color: 'var(--navy-300)',
              margin: '10px 0 0',
            }}
          >
            Soldes bancaires, appels de fonds et rapprochements : tables présentes dans le schéma, non alimentées par la
            démonstration.
          </p>
        </Panel>
      </div>
      <Panel
        title="Échéances légales"
        sub={`Moteur de délais légaux · date de référence ${dateIsoVersFr(AUJOURDHUI_ISO)}`}
        icon="clock"
        flush
      >
        <ListeEcheancesLegales
          items={echeances.echeances}
          reference={AUJOURDHUI_ISO}
          vide={MESSAGES_ETAT_ECHEANCES[echeances.etat]}
          grouper
        />
      </Panel>
      <Panel
        title={`Copropriétaires (${personnes.length})`}
        sub="Lots, tantièmes et soldes · cliquer pour ouvrir la fiche personne"
        icon="users"
        flush
      >
        {personnes.length === 0 ? (
          <MessagePanneauVide>Aucun copropriétaire enregistré pour cette copropriété.</MessagePanneauVide>
        ) : (
          <DataTable
            rowKey="id"
            columns={[
              {
                h: 'Nom',
                render: (personne) => (
                  <b
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {personne.nom}
                  </b>
                ),
              },
              {
                h: 'Lot',
                render: (personne) => personne.lot,
              },
              {
                h: 'Tantièmes',
                render: (personne) => <span className="mono">{personne.tantiemes}</span>,
              },
              {
                h: 'Solde',
                render: (personne) => (
                  <span
                    className="mono"
                    style={{
                      color: personne.solde < 0 ? 'var(--rust-500)' : 'inherit',
                    }}
                  >
                    {formatEuros(personne.solde)}
                  </span>
                ),
              },
              {
                h: 'Statut',
                render: (personne) => (
                  <Pill kind={personne.solde < 0 ? 'rust' : 'sage'} noDot>
                    {personne.statut}
                  </Pill>
                ),
              },
              {
                h: 'Contact',
                render: (personne) => (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {personne.tel || '·'}
                    {' · '}
                    {personne.mail || '·'}
                  </span>
                ),
              },
            ]}
            rows={personnes}
            onRow={ouvrirPersonne}
          />
        )}
      </Panel>
      <div className="card-grid cols-2">
        <Panel
          title={`Obligations et tâches (${obligationsSuivi.length + taches.length})`}
          sub="Suivi du cabinet, hors moteur de délais"
          icon="clipboard"
          flush
        >
          {obligationsSuivi.length + taches.length === 0 ? (
            <MessagePanneauVide>{"Rien d'enregistré."}</MessagePanneauVide>
          ) : (
            <>
              {obligationsSuivi.map((obligation) => (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '11px 22px',
                    borderBottom: '1px solid var(--line)',
                    alignItems: 'center',
                  }}
                  key={obligation.id}
                >
                  <span
                    className="mono"
                    style={{
                      width: 84,
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {formatDateOuPoint(obligation.date)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {obligation.objet}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--navy-300)',
                      }}
                    >
                      {obligation.base}
                    </div>
                  </div>
                  <Pill kind="navy" noDot>
                    {obligation.statut}
                  </Pill>
                </div>
              ))}
              {taches.map((tache) => (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '11px 22px',
                    borderBottom: '1px solid var(--line)',
                    alignItems: 'center',
                  }}
                  key={tache.id}
                >
                  <span
                    className="mono"
                    style={{
                      width: 84,
                      fontSize: 12,
                      color: 'var(--navy-500)',
                    }}
                  >
                    {tache.due}
                  </span>
                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {tache.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--navy-300)',
                      }}
                    >
                      {tache.basis}
                      {' · '}
                      {tache.role}
                    </div>
                  </div>
                  <Pill kind="gold" noDot>
                    Tâche
                  </Pill>
                </div>
              ))}
            </>
          )}
        </Panel>
        <Panel
          title="Contrats, sinistres, prestataires"
          sub="Ce que la base relie à cette copropriété"
          icon="handshake"
          flush
        >
          {/* Maquette : le test porte sur contrats + sinistres, mais la liste affiche prestataires puis sinistres. */}
          {contrats.length + sinistres.length === 0 ? (
            <MessagePanneauVide>
              Aucun contrat ni sinistre enregistré dans la base pour cette copropriété : les modules Contrats et Sinistres
              restent sur leurs données de démonstration (migration M6).
            </MessagePanneauVide>
          ) : (
            <>
              {prestataires.map((prestataire) => (
                <div
                  style={{
                    padding: '11px 22px',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                  }}
                  key={prestataire.id}
                >
                  <b>{prestataire.nom}</b>
                  {' · '}
                  {prestataire.metier}
                  {' · '}
                  {prestataire.ville}
                </div>
              ))}
              {sinistresAffiches.map((sinistre) => (
                <div
                  style={{
                    padding: '11px 22px',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                  }}
                  key={sinistre.id}
                >
                  <b>{sinistre.type}</b>
                  {' · '}
                  {sinistre.reference}
                  {' · '}
                  {sinistre.statut}
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>
      <Panel
        title={`Chronologie (${chronologie.length})`}
        sub="Tout ce qui est daté, du mandat aux tâches"
        icon="history"
        flush
      >
        {chronologie.length === 0 ? (
          <MessagePanneauVide>Aucun événement daté.</MessagePanneauVide>
        ) : (
          chronologie.map((evenement, index) => (
            <div
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 22px',
                borderBottom: '1px solid var(--line)',
                alignItems: 'center',
                opacity: evenement.situation === 'passee' && evenement.detail === 'accomplie' ? 0.6 : 1,
              }}
              key={index}
            >
              <span
                className="mono"
                style={{
                  width: 84,
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {dateIsoVersFr(evenement.date)}
              </span>
              <div
                style={{
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {evenement.libelle}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {LIBELLES_SOURCE_CHRONOLOGIE[evenement.source]}
                  {evenement.detail ? ` · ${evenement.detail}` : ''}
                </div>
              </div>
              <Pill kind={PILL_SITUATION_CHRONOLOGIE[evenement.situation].kind} noDot>
                {PILL_SITUATION_CHRONOLOGIE[evenement.situation].label}
              </Pill>
            </div>
          ))
        )}
      </Panel>
    </>
  )
}
