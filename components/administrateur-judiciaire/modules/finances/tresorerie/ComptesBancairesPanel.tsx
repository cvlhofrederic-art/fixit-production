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
import { useComptesBancaires } from '@/lib/administrateur-judiciaire/db/use-comptes-bancaires'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  MODES_TENUE_COMPTES,
  NATURES_COMPTE_BANCAIRE,
  type ModeTenueComptes,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Panneau « Comptes bancaires du mandat » de l'écran « Banque et recouvrement » (maquette du 27/10/2026, sans son
 * sélecteur d'exemples) : réglage du cabinet et choix du mandat (D-BANQUE), mode appliqué et son origine, comptes de la
 * copropriété choisie, contrôles et informations du domaine (comptes-bancaires-vue.ts). Comptes, réglage et choix s'enregistrent
 * dans la base locale (db/comptes-bancaires.ts), comme le reste de l'écran, en démonstration aussi. Chaque écriture est
 * confirmée ou refusée par un toast.
 */

const MODES = Object.entries(MODES_TENUE_COMPTES) as [ModeTenueComptes, (typeof MODES_TENUE_COMPTES)[ModeTenueComptes]][]

/** Formulaire ouvert : aucun, nouveau compte, modification ou clôture d'un compte. */
type Edition = null | { type: 'nouveau' } | { type: 'modifier'; compte: CompteAffiche } | { type: 'cloturer'; compte: CompteAffiche }

const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

const STYLE_SECONDAIRE = { display: 'block', fontSize: 11.5 } as const
/** IBAN jamais coupé : il se relit chiffre à chiffre. Sur téléphone, le tableau défile alors dans son cadre .tbl-wrap. */
const STYLE_IBAN = { whiteSpace: 'nowrap' } as const

/**
 * Tableau des comptes, repris de la maquette (Nature, IBAN, Solde ; mêmes styles en ligne), complété du libellé, du BIC
 * et de l'établissement, des pastilles (fonds de travaux, clôture) et des actions. Dans un cadre .tbl-wrap : sur
 * téléphone, il garde une largeur minimale (comme les tableaux .tbl du module) et défile dans ce cadre, l'IBAN jamais
 * coupé, sans faire déborder la page.
 */
function TableauComptes({ comptes, ouvrir }: { comptes: readonly CompteAffiche[]; ouvrir: (edition: Edition) => void }) {
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
              <td style={{ textAlign: 'right' }}>—</td>
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

/** Alertes du domaine : anomalies (ou comptes conformes), information Caisse des dépôts, entrées non connues. */
function AlertesComptes({ vue }: { vue: VueComptesBancaires }) {
  return (
    <>
      {vue.anomalies.length === 0 ? (
        <Alert kind="info" icon="check" title="Comptes conformes au mode appliqué." />
      ) : (
        // Clé avec l'index : deux comptes de même nature peuvent donner le même message (IBAN invalide).
        vue.anomalies.map((anomalie, index) => (
          <Alert
            key={`${index}-${anomalie.code}`}
            kind={anomalie.gravite === 'bloquant' ? 'rust' : 'warn'}
            icon="alert"
            title={anomalie.message}
          >
            {anomalie.fondement && <span style={{ fontSize: 12 }}>Fondement : {anomalie.fondement}</span>}
          </Alert>
        ))
      )}
      {vue.informations.map((information) => (
        <Alert key={information.code} kind="" icon="info" title="Information, sans blocage">
          {information.message}
        </Alert>
      ))}
      {vue.obligationFonds.obligatoire === null && (
        <Alert kind="" icon="info" title="Obligation du fonds de travaux non établie">
          {`${vue.obligationFonds.motif} Le contrôle « fonds de travaux à ouvrir » n'est donc pas lancé.`}
        </Alert>
      )}
      {vue.reprisActifs > 0 && (
        <Alert kind="" icon="info" title="Compte repris de l'ancien gestionnaire : solde inconnu ici.">
          Le rappel « solder puis clôturer » attend le solde par compte.
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

/** Vue calculée, ou l'erreur du domaine (choix du mandat enregistré inconnu). */
function calculerVue(entree: Parameters<typeof vueComptesBancaires>[0]): { vue: VueComptesBancaires | null; erreur: string | null } {
  try {
    return { vue: vueComptesBancaires(entree), erreur: null }
  } catch (erreur) {
    return { vue: null, erreur: messageErreur(erreur) }
  }
}

export function ComptesBancairesPanel({ copro }: { copro: CoproprieteVue | undefined }) {
  const { push } = useToast()
  const [edition, setEdition] = useState<Edition>(null)
  const lus = useComptesBancaires(copro?.id ?? null, (message) =>
    push({ kind: 'warn', title: 'Comptes bancaires illisibles', desc: message }),
  )
  const mandat = useDonneesStore((etat) => etat.mandats.find((candidat) => candidat.id === copro?.mandatId))
  const ecritures = useEcrituresComptes(copro, lus.relire, () => setEdition(null))
  const { vue, erreur } = calculerVue({
    comptes: lus.comptes,
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
                value={lus.reglagesCabinet.modeParDefaut}
                disabled={!pret}
                onChange={(evenement) => void ecritures.reglerCabinet(evenement.target.value as ModeTenueComptes)}
              >
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
              hint={
                !mandat
                  ? 'Aucun mandat enregistré pour cette copropriété.'
                  : vue?.pratiqueAdministrateurProvisoire
                    ? `Pratique du cabinet pour un administrateur provisoire : ${MODES_TENUE_COMPTES[vue.pratiqueAdministrateurProvisoire].libelle}. Proposée, jamais imposée.`
                    : undefined
              }
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
          {erreur && (
            <Alert kind="rust" icon="alert" title="Mode du mandat illisible">
              {erreur}
            </Alert>
          )}
          {vue && (
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Mode appliqué : <b>{MODES_TENUE_COMPTES[vue.resolu.mode].libelle}</b>{' '}
              <Pill kind={vue.resolu.origine === 'mandat' ? 'gold' : 'navy'}>
                {vue.resolu.origine === 'mandat' ? 'Choix du mandat' : 'Réglage du cabinet'}
              </Pill>
            </div>
          )}
          {lus.chargement ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Chargement…
            </p>
          ) : (
            vue &&
            !lus.erreur && (
              <>
                {vue.comptes.length > 0 && <TableauComptes comptes={vue.comptes} ouvrir={setEdition} />}
                {/* Lignes illisibles seulement : le bandeau d'erreur les signale, sans « aucun compte ». */}
                {vue.comptes.length === 0 && vue.illisibles === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Aucun compte enregistré pour cette copropriété.
                  </p>
                )}
                <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
                  Solde par compte : « — » tant que le relevé importé n’est pas rattaché à un compte.
                </p>
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
