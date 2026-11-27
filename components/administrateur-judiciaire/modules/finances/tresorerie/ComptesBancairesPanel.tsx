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
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Panneau « Comptes bancaires du mandat » de l'écran « Banque et recouvrement » (maquette du 27/10/2026, sans son
 * sélecteur d'exemples) : réglage du cabinet et choix du mandat (D-BANQUE), mode appliqué et son origine, comptes de la
 * copropriété choisie, contrôles et informations du domaine (comptes-bancaires-vue.ts). Comptes, réglage et choix s'enregistrent
 * dans la base locale (db/comptes-bancaires.ts), comme le reste de l'écran, en démonstration aussi. Chaque écriture est
 * confirmée ou refusée par un toast. Les comptes sont lus par l'écran (useComptesBancaires), qui les partage avec l'import
 * du relevé et le rapprochement ; le solde de chaque compte est celui de son sous-compte 512 (lignes de relevé importées
 * sur ce compte).
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
/** IBAN jamais renvoyé à la ligne : il se relit chiffre à chiffre (sur téléphone, la fiche le coupe entre ses groupes de chiffres : règle de aj-correctifs.css). */
const STYLE_IBAN = { whiteSpace: 'nowrap' } as const

/**
 * Tableau des comptes, repris de la maquette (Nature, IBAN, Solde ; mêmes styles en ligne), complété du libellé, du BIC
 * et de l'établissement, des pastilles (fonds de travaux, clôture) et des actions. Dans un cadre .tbl-wrap : sur
 * ordinateur, largeur minimale de 640 px (classe vfx-comptes, aj-correctifs.css) ; sous 769 px, une fiche par compte (classe
 * vfx-fiches, étiquette de chaque valeur dans data-label, rôles ARIA de tableau conservés), sans défilement de côté ;
 * Modifier et Clôturer restent dans la cellule « Actions ». Chaque valeur est dans un seul bloc (vfx-fiche-valeur) :
 * la cellule de la fiche est une ligne flex, qui rangerait sinon le texte, le libellé et les pastilles côte à côte.
 */
function TableauComptes({ comptes, ouvrir }: Readonly<{ comptes: readonly CompteAffiche[]; ouvrir: (edition: Edition) => void }>) {
  return (
    <div className="tbl-wrap" style={{ marginBottom: 12 }}>
      <table className="vfx-comptes vfx-fiches" aria-label="Comptes bancaires du mandat" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" style={{ textAlign: 'left' }}>
              Nature
            </th>
            <th role="columnheader" style={{ textAlign: 'left' }}>
              IBAN
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Solde
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {comptes.map((compte) => (
            <tr key={compte.id} role="row">
              <td role="cell" data-label="Nature">
                <div className="vfx-fiche-valeur">
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
                </div>
              </td>
              <td role="cell" data-label="IBAN">
                <div className="vfx-fiche-valeur vfx-fiche-iban">
                <span className="mono" style={STYLE_IBAN}>
                  {compte.iban ? ibanGroupe(compte.iban) : '—'}
                </span>
                {(compte.bic || compte.etablissement) && (
                  <span className="muted" style={STYLE_SECONDAIRE}>
                    {[compte.bic, compte.etablissement].filter(Boolean).join(' · ')}
                  </span>
                )}
                </div>
              </td>
              <td className="mono" role="cell" data-label="Solde" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {compte.soldeCentimes === null ? '—' : formatEurosCentimes(compte.soldeCentimes / 100)}
              </td>
              <td role="cell" data-label="Actions">
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
 * Alertes du domaine : anomalies (ou comptes conformes), seulement quand le mode se résout ; information Caisse des
 * dépôts et entrées non connues, qui ne dépendent pas du mode.
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
      {vue.reprisActifs > 0 && (
        <Alert kind="" icon="info" title={`${NATURES_COMPTE_BANCAIRE.repris_ancien_gestionnaire.libelle} : solde inconnu ici.`}>
          Le rappel « solder puis clôturer » n’est pas lancé : le solde affiché ne reprend pas le solde du compte avant le
          premier relevé importé.
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
                      Solde par compte : solde de son sous-compte 512, somme des lignes de relevé importées sur ce compte
                      (sans le solde d’avant le premier relevé importé) ; « — » : aucune ligne importée.
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
