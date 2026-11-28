'use client'

import { useState } from 'react'
import {
  ClotureCompteModal,
  CompteBancaireModal,
  nomDuCompte,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import {
  ibanGroupe,
  vueComptesBancaires,
  type CompteAffiche,
  type EcritureSolde,
  type VueComptesBancaires,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import {
  cloturerCompteBancaire,
  enregistrerCompteBancaire,
  enregistrerModeComptesCabinet,
  enregistrerModeComptesMandat,
  type SaisieCompteBancaire,
} from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import type { ComptesBancairesLus } from '@/lib/administrateur-judiciaire/db/use-comptes-bancaires'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  MODES_TENUE_COMPTES,
  NATURES_COMPTE_BANCAIRE,
  type ModeTenueComptes,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Panneau « Comptes bancaires du mandat » de l'écran « Banque et recouvrement » (maquette du 27/10/2026, sans son
 * sélecteur d'exemples) : réglage du cabinet et choix du mandat (D-BANQUE), mode appliqué et son origine, comptes de la
 * copropriété choisie, contrôles et informations du domaine (comptes-bancaires-vue.ts). Comptes, réglage et choix s'enregistrent
 * dans la base locale (db/comptes-bancaires.ts), comme le reste de l'écran, en démonstration aussi. Chaque écriture est
 * confirmée ou refusée par un toast. Les comptes sont lus par l'écran (useComptesBancaires), qui les partage avec l'import
 * du relevé et le rapprochement ; le solde de chaque compte est celui de son sous-compte 512 (lignes de relevé importées
 * sur ce compte), avec son solde d'ouverture quand il est saisi (décision du 26/11/2026, PR 799, point 2, choix A :
 * champs « Solde d'ouverture » et « au » des formulaires ; lignes datées avant ce solde signalées, hors du solde).
 * Réponses du référent métier du 28/11/2026 (PR 848) : solde d'ouverture de fin de journée (point 2, choix B), les lignes
 * datées de son jour ou d'avant sont signalées, hors du solde (point 3, choix A) ; sous le solde du tableau, une ligne
 * grise « dont ouverture … au … » pour un compte au solde d'ouverture (point 7, choix A) ; un solde d'ouverture écrit
 * hors de l'écran sans date ou mal formé est signalé par un bandeau, comme les arrêtés illisibles (point 8, choix A).
 */

const MODES = Object.entries(MODES_TENUE_COMPTES) as [ModeTenueComptes, (typeof MODES_TENUE_COMPTES)[ModeTenueComptes]][]

/** Formulaire ouvert : aucun, nouveau compte, modification ou clôture d'un compte. */
type Edition = null | { type: 'nouveau' } | { type: 'modifier'; compte: CompteAffiche } | { type: 'cloturer'; compte: CompteAffiche }

const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

/** Indication sous « Ce mandat » : aucun mandat enregistré, ou pratique du cabinet pour un administrateur provisoire (J37). */
function indicationMandat(aUnMandat: boolean, pratique: ModeTenueComptes | null): string | undefined {
  if (!aUnMandat) return 'Aucun mandat enregistré pour cette copropriété.'
  if (!pratique) return undefined
  return `Pratique du cabinet pour un administrateur provisoire : ${MODES_TENUE_COMPTES[pratique].libelle}. Proposée, jamais imposée.`
}

const STYLE_SECONDAIRE = { display: 'block', fontSize: 11.5 } as const
/** IBAN jamais renvoyé à la ligne : il se relit chiffre à chiffre. Sur téléphone, le tableau défile alors dans son cadre .tbl-wrap. */
const STYLE_IBAN = { whiteSpace: 'nowrap' } as const

/**
 * Tableau des comptes, repris de la maquette (Nature, IBAN, Solde ; mêmes styles en ligne), complété du libellé, du BIC
 * et de l'établissement, des pastilles (fonds de travaux, clôture) et des actions. Dans un cadre .tbl-wrap : sur
 * téléphone, il garde une largeur minimale de 640 px et défile dans ce cadre, l'IBAN jamais renvoyé à la ligne, sans
 * faire déborder la page.
 */
function TableauComptes({ comptes, ouvrir }: Readonly<{ comptes: readonly CompteAffiche[]; ouvrir: (edition: Edition) => void }>) {
  return (
    <div className="tbl-wrap" style={{ marginBottom: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nature</th>
            <th style={{ textAlign: 'left' }}>IBAN</th>
            <th style={{ textAlign: 'right' }}>Solde</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {comptes.map((compte) => (
            <tr key={compte.id}>
              <td>
                {NATURES_COMPTE_BANCAIRE[compte.nature].libelle}
                {compte.libelle && (
                  <span className="muted" style={STYLE_SECONDAIRE}>
                    {compte.libelle}
                  </span>
                )}
                {(compte.tientLeFonds || !compte.actif) && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {compte.tientLeFonds && (
                      <Pill kind="sage" noDot>
                        Tient le fonds de travaux
                      </Pill>
                    )}
                    {!compte.actif && (
                      <Pill kind="navy" noDot>
                        Clôturé
                      </Pill>
                    )}
                  </span>
                )}
              </td>
              <td>
                <span className="mono" style={STYLE_IBAN}>
                  {compte.iban ? ibanGroupe(compte.iban) : '—'}
                </span>
                {(compte.bic || compte.etablissement) && (
                  <span className="muted" style={STYLE_SECONDAIRE}>
                    {[compte.bic, compte.etablissement].filter(Boolean).join(' · ')}
                  </span>
                )}
              </td>
              {/* Sous le solde, la part du solde d'ouverture du compte, quand il en a un (PR 848, point 7 ; voir l'en-tête). */}
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span className="mono">{compte.soldeCentimes === null ? '—' : formatEurosCentimes(compte.soldeCentimes / 100)}</span>
                {compte.soldeOuverture && (
                  <span className="muted" style={STYLE_SECONDAIRE}>
                    {`dont ouverture ${formatEurosCentimes(compte.soldeOuverture.centimes / 100)} au ${dateIsoVersFr(compte.soldeOuverture.au)}`}
                  </span>
                )}
              </td>
              <td>
                {compte.actif && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Modifier ${nomDuCompte(compte)}`}
                      onClick={() => ouvrir({ type: 'modifier', compte })}
                    >
                      <Icon name="pencil" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Clôturer ${nomDuCompte(compte)}`}
                      onClick={() => ouvrir({ type: 'cloturer', compte })}
                    >
                      <Icon name="archive" />
                      Clôturer
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Aucun écran ne saisit encore la destination de l'immeuble : la vue la passe toujours comme non renseignée
 * (comptes-bancaires-vue.ts), et le bandeau de l'obligation du fonds de travaux le dit (décision du 19/11, #758,
 * point 6). La saisie viendra dans une PR à part.
 */
const SAISIE_IMMEUBLE_ABSENTE = "La saisie de la destination de l'immeuble n'existe pas encore."

/**
 * Avertissement d'un compte dont des lignes de relevé sont datées du jour de son solde d'ouverture ou d'avant (décision
 * du 26/11/2026, PR 799, point 2 ; réponses du référent métier du 28/11/2026, PR 848, points 2 et 3 : solde de fin de
 * journée, « Garder ainsi ») : elles restent dans « Lignes de relevé », mais n'entrent pas dans le solde du compte.
 */
function AlerteLignesAvantOuverture({ compte, au }: Readonly<{ compte: CompteAffiche; au: string }>) {
  const plusieurs = compte.lignesAvantOuverture > 1
  const lignes = plusieurs ? `${compte.lignesAvantOuverture} lignes de relevé datées` : '1 ligne de relevé datée'
  return (
    <Alert kind="warn" icon="alert" title={`${nomDuCompte(compte)} : ${lignes} au plus tard du ${dateIsoVersFr(au)}, date du solde d’ouverture.`}>
      {plusieurs
        ? 'Tenues pour déjà comprises dans ce solde, elles n’entrent pas dans le solde du compte.'
        : 'Tenue pour déjà comprise dans ce solde, elle n’entre pas dans le solde du compte.'}
      {' Si ce n’est pas le cas, corriger la date ou le montant du solde d’ouverture.'}
    </Alert>
  )
}

/**
 * Conseil du bandeau des soldes d'ouverture illisibles. « Modifier » n'existe que sur la ligne d'un compte actif
 * (TableauComptes), et le solde d'ouverture d'un compte clôturé ne se modifie plus (domain/solde-ouverture-compte.ts) :
 * pour un compte clôturé, seule la base locale permet de corriger (retour de relecture du 28/11/2026, texte à valider
 * par le référent métier). Comptes tous clôturés : déjà nommés en tête du bandeau ; sinon, les comptes clôturés sont
 * nommés à part.
 */
function conseilSoldesOuvertureIllisibles(illisibles: readonly CompteAffiche[]): string {
  const clotures = illisibles.filter((compte) => !compte.actif)
  const pourActifs = clotures.length < illisibles.length ? ' À saisir de nouveau (« Modifier »), ou à reprendre dans la base locale.' : ''
  if (clotures.length === 0) return pourActifs
  const sujet = clotures.length > 1 ? 'Comptes clôturés' : 'Compte clôturé'
  const nommes = pourActifs === '' ? '' : ` (${clotures.map(nomDuCompte).join(', ')})`
  return `${pourActifs} ${sujet}${nommes} : à reprendre dans la base locale.`
}

/**
 * Bandeau des soldes d'ouverture illisibles (réponse du référent métier du 28/11/2026, PR 848, point 8, choix A : « Un
 * bandeau, comme pour les arrêtés illisibles ») : écrits hors de l'écran sans date ou mal formés, ils n'entrent dans
 * aucun solde. Même forme que le bandeau des arrêtés illisibles (RapprochementPanel.tsx) ; les comptes sont nommés.
 */
function AlerteSoldesOuvertureIllisibles({ comptes }: Readonly<{ comptes: readonly CompteAffiche[] }>) {
  const illisibles = comptes.filter((compte) => compte.soldeOuvertureIllisible)
  if (illisibles.length === 0) return null
  const plusieurs = illisibles.length > 1
  return (
    <Alert kind="rust" title={`${illisibles.length} solde${plusieurs ? 's' : ''} d’ouverture de la base non pris en compte`}>
      {`${illisibles.map(nomDuCompte).join(', ')} : `}
      {plusieurs
        ? 'sans date ou mal formés, ils n’entrent ni dans le solde de ces comptes ni dans leurs arrêtés.'
        : 'sans date ou mal formé, il n’entre ni dans le solde du compte ni dans ses arrêtés.'}
      {conseilSoldesOuvertureIllisibles(illisibles)}
    </Alert>
  )
}

/**
 * Alertes du domaine : anomalies (ou comptes conformes), seulement quand le mode se résout ; information Caisse des
 * dépôts et entrées non connues, qui ne dépendent pas du mode ; lignes de relevé déjà comprises dans un solde
 * d'ouverture ; soldes d'ouverture illisibles ; comptes repris actifs, avec ou sans solde d'ouverture, tant que le rappel
 * « solder puis clôturer » n'est pas lancé.
 */
function AlertesComptes({ vue }: Readonly<{ vue: VueComptesBancaires }>) {
  return (
    <>
      {vue.controle &&
        (vue.controle.anomalies.length === 0 ? (
          <Alert kind="info" icon="check" title="Comptes conformes au mode appliqué." />
        ) : (
          // Clé avec l'index : deux comptes de même nature peuvent donner le même message (IBAN invalide).
          vue.controle.anomalies.map((anomalie, index) => (
            <Alert
              key={`${index}-${anomalie.code}`}
              kind={anomalie.gravite === 'bloquant' ? 'rust' : 'warn'}
              icon="alert"
              title={anomalie.message}
            >
              {anomalie.fondement && <span style={{ fontSize: 12 }}>Fondement : {anomalie.fondement}</span>}
            </Alert>
          ))
        ))}
      {vue.informations.map((information) => (
        <Alert key={information.code} kind="" icon="info" title="Information, sans blocage">
          {information.message}
        </Alert>
      ))}
      {vue.obligationFonds.obligatoire === null && (
        <Alert kind="" icon="info" title="Obligation du fonds de travaux non établie">
          {`${vue.obligationFonds.motif} ${SAISIE_IMMEUBLE_ABSENTE} Le contrôle « fonds de travaux à ouvrir » n'est donc pas lancé.`}
        </Alert>
      )}
      {vue.comptes.map(
        (compte) =>
          compte.soldeOuverture !== null &&
          compte.lignesAvantOuverture > 0 && (
            <AlerteLignesAvantOuverture key={compte.id} compte={compte} au={compte.soldeOuverture.au} />
          ),
      )}
      <AlerteSoldesOuvertureIllisibles comptes={vue.comptes} />
      {vue.reprisSansSoldeConnu > 0 && (
        <Alert kind="" icon="info" title={`${NATURES_COMPTE_BANCAIRE.repris_ancien_gestionnaire.libelle} : solde inconnu ici.`}>
          Le rappel « solder puis clôturer » n’est pas lancé : sans solde d’ouverture saisi, le solde affiché ne reprend pas
          le solde du compte avant le premier relevé importé.
        </Alert>
      )}
      {vue.reprisAvecSoldeOuverture > 0 && (
        <Alert
          kind=""
          icon="info"
          title={`${NATURES_COMPTE_BANCAIRE.repris_ancien_gestionnaire.libelle} : rappel « solder puis clôturer » non lancé.`}
        >
          Le solde d’ouverture est saisi, mais ce rappel ne lit pas encore le solde du compte : un compte repris qui garde
          un solde n’est pas signalé ici.
        </Alert>
      )}
      {vue.illisibles > 0 && (
        <Alert kind="rust" title={`${vue.illisibles} compte${vue.illisibles > 1 ? 's' : ''} de la base non affiché${vue.illisibles > 1 ? 's' : ''}`}>
          Nature absente ou inconnue : compte à reprendre dans la base locale.
        </Alert>
      )}
    </>
  )
}

/** Écritures du panneau : chacune confirmée ou refusée par un toast, puis la base est relue. */
function useEcrituresComptes(copro: CoproprieteVue | undefined, relire: () => void, fermer: () => void) {
  const { push } = useToast()
  const refuser = (titre: string, erreur: unknown) => push({ kind: 'warn', title: titre, desc: messageErreur(erreur) })
  return {
    enregistrer: async (saisie: SaisieCompteBancaire, id: string | null): Promise<boolean> => {
      if (!copro) return false
      try {
        const compte = await enregistrerCompteBancaire(copro.id, saisie, { id })
        push({
          kind: 'success',
          title: id ? 'Compte modifié' : 'Compte enregistré',
          desc: `${nomDuCompte({ libelle: compte.libelle ?? '', nature: saisie.nature })} : enregistré dans la base locale.`,
        })
        fermer()
        relire()
        return true
      } catch (erreur) {
        refuser('Enregistrement impossible', erreur)
        return false
      }
    },
    cloturer: async (compte: CompteAffiche): Promise<boolean> => {
      try {
        await cloturerCompteBancaire(compte.id)
        push({ kind: 'success', title: 'Compte clôturé', desc: `${nomDuCompte(compte)} : retiré des contrôles du mandat.` })
        fermer()
        relire()
        return true
      } catch (erreur) {
        refuser('Clôture impossible', erreur)
        return false
      }
    },
    choisirModeMandat: async (mode: ModeTenueComptes | null) => {
      if (!copro?.mandatId) return
      try {
        await enregistrerModeComptesMandat(copro.mandatId, mode)
        push({
          kind: 'success',
          title: 'Mode du mandat enregistré',
          desc: mode ? MODES_TENUE_COMPTES[mode].libelle : 'Comme le cabinet.',
        })
      } catch (erreur) {
        refuser('Enregistrement impossible', erreur)
      }
    },
    reglerCabinet: async (mode: ModeTenueComptes) => {
      try {
        await enregistrerModeComptesCabinet(mode)
        push({
          kind: 'success',
          title: 'Réglage du cabinet enregistré',
          desc: `${MODES_TENUE_COMPTES[mode].libelle} : s'applique aux mandats sans choix propre.`,
        })
        relire()
      } catch (erreur) {
        refuser('Enregistrement impossible', erreur)
      }
    },
  }
}

export interface ComptesBancairesPanelProps {
  copro: CoproprieteVue | undefined
  /** Comptes et réglage du cabinet lus par l'écran (useComptesBancaires). */
  lus: ComptesBancairesLus
  /** Écritures du journal de banque de la copropriété : solde de chaque compte. */
  ecrituresBanque: readonly EcritureSolde[]
}

export function ComptesBancairesPanel({ copro, lus, ecrituresBanque }: Readonly<ComptesBancairesPanelProps>) {
  const [edition, setEdition] = useState<Edition>(null)
  const mandat = useDonneesStore((etat) => etat.mandats.find((candidat) => candidat.id === copro?.mandatId))
  const ecritures = useEcrituresComptes(copro, lus.relire, () => setEdition(null))
  const vue = vueComptesBancaires({
    comptes: lus.comptes,
    ecritures: ecrituresBanque,
    reglagesCabinet: lus.reglagesCabinet,
    choixMandat: mandat?.modeComptesBancaires,
    fondement: copro?.fondement ?? '',
    aujourdhui: AUJOURDHUI_ISO,
  })
  const pret = !!copro && !lus.chargement && !lus.erreur
  const choixMandat: string = mandat?.modeComptesBancaires ?? ''
  const choixInconnu = choixMandat !== '' && !Object.hasOwn(MODES_TENUE_COMPTES, choixMandat)

  return (
    <Panel
      title="Comptes bancaires du mandat"
      sub="Choix du cabinet, remplaçable mandat par mandat"
      icon="bank"
      controlesALaLigne
      right={
        <button type="button" className="btn gold sm" disabled={!pret} onClick={() => setEdition({ type: 'nouveau' })}>
          <Icon name="plus" />
          Nouveau compte
        </button>
      }
    >
      {!copro ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Aucune copropriété choisie.
        </p>
      ) : (
        <>
          <div className="card-grid cols-2">
            <Field label="Réglage du cabinet (mode par défaut)" name="mode-comptes-cabinet">
              <select
                value={lus.reglagesCabinet?.modeParDefaut ?? ''}
                disabled={!pret}
                onChange={(evenement) => void ecritures.reglerCabinet(evenement.target.value as ModeTenueComptes)}
              >
                {/* Réglage non lu (lecture en cours ou impossible) : « — », jamais le défaut du domaine présenté comme lu. */}
                {!lus.reglagesCabinet && (
                  <option value="" disabled>
                    —
                  </option>
                )}
                {MODES.map(([cle, mode]) => (
                  <option key={cle} value={cle}>
                    {mode.libelle}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Ce mandat"
              name="mode-comptes-mandat"
              hint={indicationMandat(!!mandat, vue.pratiqueAdministrateurProvisoire)}
            >
              <select
                value={choixMandat}
                disabled={!pret || !mandat}
                onChange={(evenement) =>
                  void ecritures.choisirModeMandat((evenement.target.value || null) as ModeTenueComptes | null)
                }
              >
                {/* Mode enregistré inconnu : montré tel quel (sinon la liste afficherait « Comme le cabinet »), à remplacer. */}
                {choixInconnu && (
                  <option value={choixMandat} disabled>
                    {`Mode illisible : « ${choixMandat} »`}
                  </option>
                )}
                <option value="">Comme le cabinet</option>
                {MODES.map(([cle, mode]) => (
                  <option key={cle} value={cle}>
                    {mode.libelle}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {lus.erreur && (
            <Alert kind="warn" icon="alert" title="Comptes bancaires illisibles">
              {lus.erreur}
            </Alert>
          )}
          {vue.erreurMode && (
            <Alert kind="rust" icon="alert" title="Mode du mandat illisible">
              {vue.erreurMode}
            </Alert>
          )}
          {/* Mode non résolu (réglage non lu, choix du mandat illisible) : ni mode appliqué ni contrôles. */}
          {vue.controle && (
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Mode appliqué : <b>{MODES_TENUE_COMPTES[vue.controle.resolu.mode].libelle}</b>{' '}
              <Pill kind={vue.controle.resolu.origine === 'mandat' ? 'gold' : 'navy'}>
                {vue.controle.resolu.origine === 'mandat' ? 'Choix du mandat' : 'Réglage du cabinet'}
              </Pill>
            </div>
          )}
          {lus.chargement ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Chargement…
            </p>
          ) : (
            !lus.erreur && (
              <>
                {/* Comptes affichés même quand le mode ne se résout pas : un compte créé reste visible. */}
                {vue.comptes.length > 0 && (
                  <>
                    <TableauComptes comptes={vue.comptes} ouvrir={setEdition} />
                    <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
                      Solde par compte : solde d’ouverture saisi sur le compte, plus les lignes de relevé importées sur
                      son sous-compte 512 datées après le jour de ce solde ; sans solde d’ouverture, somme des lignes
                      importées (sans le solde d’avant le premier relevé importé) ; « — » : ni solde d’ouverture ni ligne
                      importée.
                    </p>
                  </>
                )}
                {/* Lignes illisibles seulement : le bandeau d'erreur les signale, sans « aucun compte ». */}
                {vue.comptes.length === 0 && vue.illisibles === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Aucun compte enregistré pour cette copropriété.
                  </p>
                )}
                <AlertesComptes vue={vue} />
              </>
            )
          )}
        </>
      )}
      {edition?.type === 'nouveau' && (
        <CompteBancaireModal
          key="nouveau"
          compte={null}
          onClose={() => setEdition(null)}
          onEnregistrer={(saisie) => ecritures.enregistrer(saisie, null)}
        />
      )}
      {edition?.type === 'modifier' && (
        <CompteBancaireModal
          key={edition.compte.id}
          compte={edition.compte}
          onClose={() => setEdition(null)}
          onEnregistrer={(saisie) => ecritures.enregistrer(saisie, edition.compte.id)}
        />
      )}
      {edition?.type === 'cloturer' && (
        <ClotureCompteModal
          compte={edition.compte}
          onClose={() => setEdition(null)}
          onConfirmer={() => ecritures.cloturer(edition.compte)}
        />
      )}
    </Panel>
  )
}
