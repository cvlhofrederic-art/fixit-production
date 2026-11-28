'use client'

import { useState } from 'react'
import { AbandonArreteModal } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/AbandonArreteModal'
import { arreteCourant, controlerSaisieArrete, eurosArrete, type ValeursArrete } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import {
  ChoixCompteBancaire,
  comptesActifs,
  type EtatComptes,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/ChoixCompteBancaire'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import type { CompteAffiche, EcritureSolde } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { NouvelArreteModal } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/NouvelArreteModal'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import {
  abandonnerArreteCompte,
  avecSoldeComptaCourant,
  cloturerArreteCompte,
  decloturerArreteCompte,
  ouvrirArreteCompte,
} from '@/lib/administrateur-judiciaire/db/rapprochements'
import { useArretesRapprochement, type ArretesLusEcran } from '@/lib/administrateur-judiciaire/db/use-arretes'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ReleveImporte } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import { etatArrete, refusArretesIllisibles, type ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Panneau « Rapprochement » de l'écran « Banque et recouvrement », d'après la maquette du 27/10/2026
 * (MaquetteRapprochementPanel, entre « Comptes bancaires du mandat » et « Importer un relevé »), sur un compte réel :
 * arrêtés du compte choisi lus et écrits dans la table locale « rapprochements » (db/rapprochements.ts, règles du domaine
 * rapprochement-bancaire.ts), en démonstration aussi, comme le reste de l'écran. Chaque écriture est confirmée ou
 * refusée par un toast.
 * - Arrêté affiché : celui en cours, sinon le dernier ; soldes, écart et taux du domaine (etatArrete), comme la maquette.
 * - « Nouvel arrêté » (formulaire absent de la maquette) quand aucun arrêté n'est en cours ; « Clôturer » sinon, refusé
 *   hors équilibre par le domaine ; « Déclôturer » sur le dernier arrêté clôturé.
 * - Décision du 26/11/2026 (PR 799, rb-01 A) : « Abandonner l'arrêté » sur l'arrêté en cours, à la place qu'occupe
 *   « Déclôturer » sur un arrêté clôturé, avec confirmation (AbandonArreteModal). L'arrêté abandonné reste en base et
 *   n'est plus affiché : « Nouvel arrêté » redevient possible.
 * - Décision du 26/11/2026 (rb-01 C et rb-03 A) : le solde compta et l'écart d'un arrêté en cours sont ceux de l'instant,
 *   recalculés sur les écritures affichées (avecSoldeComptaCourant), dans le panneau comme dans la liste ; la clôture
 *   enregistre ce solde et le fige. Même mise en page.
 * - Aucun élément à pointer : les écritures du compte viennent toutes du relevé importé, le côté compta indépendant
 *   (règlements, remises) n'est pas branché ; les cases « Auto / Pointé / En suspens » de la maquette n'ont donc rien à
 *   montrer, et le panneau le dit. Décision du 26/11/2026 (rb-13 B) : les taux « Rapproché auto » et « manuel », toujours
 *   à 0 % sans pointage, sont masqués tant qu'aucun élément n'est pointé ; ils reviendront avec le pointage.
 * - Décision du 26/11/2026 (rb-c02 A) : montants avec un séparateur des milliers visible (eurosArrete).
 * - Décision du 26/11/2026 (rb-03 C) : « Nouvel arrêté » propose comme solde banque le solde de clôture du dernier relevé
 *   importé du compte à la date de l'arrêté (relevés gardés reçus de l'écran), modifiable.
 * - Sur téléphone : statut et actions secondaires dans le corps (l'en-tête ne garde qu'un bouton), indicateurs en une
 *   colonne (card-grid cols-4), liste des arrêtés en une fiche par arrêté (rb-c04 A : classe vfx-fiches, étiquette de
 *   chaque valeur dans data-label, règles de aj-correctifs.css).
 */

const euros = eurosArrete
const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

const STYLE_MONTANT = { textAlign: 'right', whiteSpace: 'nowrap' } as const

/** Écritures du panneau : chacune confirmée ou refusée par un toast, puis les arrêtés sont relus. */
function useEcrituresArretes(relire: () => void, fermer: () => void) {
  const { push } = useToast()
  const refuser = (titre: string, erreur: unknown) => push({ kind: 'warn', title: titre, desc: messageErreur(erreur) })
  return {
    ouvrir: async (compte: CompteAffiche, valeurs: ValeursArrete): Promise<boolean> => {
      const controle = controlerSaisieArrete(valeurs, AUJOURDHUI_ISO)
      if ('erreur' in controle) {
        push({ kind: 'warn', title: 'Saisie à corriger', desc: controle.erreur })
        return false
      }
      try {
        const arrete = await ouvrirArreteCompte(compte.id, controle.saisie)
        push({
          kind: 'success',
          title: 'Arrêté ouvert',
          desc: `${nomDuCompte(compte)} : arrêté au ${dateIsoVersFr(arrete.dateArrete)}, écart ${euros(etatArrete(arrete).ecartCentimes)}.`,
        })
        fermer()
        relire()
        return true
      } catch (erreur) {
        refuser('Ouverture refusée', erreur)
        return false
      }
    },
    cloturer: async (arrete: ArreteRapprochement) => {
      // Règle du domaine (etatArrete), dite en euros comme le panneau ; l'écriture la contrôle encore (cloturerArrete).
      const { equilibre, ecartCentimes } = etatArrete(arrete)
      if (!equilibre) {
        push({
          kind: 'warn',
          title: 'Clôture refusée',
          desc: `Arrêté non équilibré : écart de ${euros(ecartCentimes)}. Clôture possible seulement à l’équilibre.`,
        })
        return
      }
      try {
        await cloturerArreteCompte(arrete.id)
        push({ kind: 'success', title: 'Arrêté clôturé', desc: `Arrêté au ${dateIsoVersFr(arrete.dateArrete)} : clôturé à l’équilibre.` })
        relire()
      } catch (erreur) {
        refuser('Clôture refusée', erreur)
      }
    },
    decloturer: async (arrete: ArreteRapprochement) => {
      try {
        await decloturerArreteCompte(arrete.id)
        push({ kind: 'success', title: 'Arrêté déclôturé', desc: `Arrêté au ${dateIsoVersFr(arrete.dateArrete)} : de nouveau en cours.` })
        relire()
      } catch (erreur) {
        refuser('Déclôture refusée', erreur)
      }
    },
    abandonner: async (arrete: ArreteRapprochement): Promise<boolean> => {
      try {
        await abandonnerArreteCompte(arrete.id)
        push({
          kind: 'success',
          title: 'Arrêté abandonné',
          desc: `Arrêté au ${dateIsoVersFr(arrete.dateArrete)} : gardé dans la base, marqué « Abandonné ». Un nouvel arrêté peut être ouvert sur ce compte.`,
        })
        fermer()
        relire()
        return true
      } catch (erreur) {
        refuser('Abandon refusé', erreur)
        return false
      }
    },
  }
}

/** Actions sur l'arrêté affiché, hors de l'en-tête : « Déclôturer » (clôturé), « Abandonner l'arrêté » (en cours). */
interface ActionsArrete {
  decloturer: (arrete: ArreteRapprochement) => void
  abandonner: () => void
  /** Une écriture est en cours, ou le compte n'est pas prêt (lecture, arrêté illisible). */
  occupe: boolean
}

/** Arrêté affiché : statut, soldes, écart et taux du domaine (disposition de la maquette), note et règle d'équilibre. */
function ArreteAffiche({ arrete, decloturer, abandonner, occupe }: Readonly<{ arrete: ArreteRapprochement } & ActionsArrete>) {
  const etat = etatArrete(arrete)
  const cloture = arrete.statut === 'Clôturé'
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pill kind={cloture ? 'sage' : 'gold'}>{arrete.statut}</Pill>
        {cloture ? (
          <button
            type="button"
            className="btn ghost sm"
            aria-label={`Déclôturer l’arrêté du ${dateIsoVersFr(arrete.dateArrete)}`}
            disabled={occupe}
            onClick={() => decloturer(arrete)}
          >
            <Icon name="history" />
            Déclôturer
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost sm"
            aria-label={`Abandonner l’arrêté du ${dateIsoVersFr(arrete.dateArrete)}`}
            disabled={occupe}
            onClick={abandonner}
          >
            <Icon name="ban" />
            Abandonner l’arrêté
          </button>
        )}
      </div>
      <div className="card-grid cols-4" style={{ fontSize: 13, marginBottom: 12 }}>
        <div>
          {'Solde banque '}
          <b>{euros(arrete.soldeBanqueCentimes)}</b>
        </div>
        <div>
          {'Solde compta '}
          <b>{euros(arrete.soldeComptaCentimes)}</b>
        </div>
        <div>
          {'Écart '}
          <b style={{ color: etat.equilibre ? 'var(--sage-700)' : 'var(--rust-500)' }}>{euros(etat.ecartCentimes)}</b>
        </div>
        {arrete.elements.length > 0 && (
          <div>
            Rapproché auto {etat.tauxAutoPct} % · manuel {etat.tauxManuelPct} %
          </div>
        )}
      </div>
      {arrete.elements.length === 0 && (
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 8px' }}>
          Aucun élément à pointer : les écritures du compte viennent toutes du relevé importé ; le côté compta indépendant
          (règlements, remises de chèques) n’est pas encore branché.
        </p>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--navy-300)' }}>
        Équilibre : solde banque − suspens banque = solde compta − suspens compta. Clôture possible seulement à l’équilibre.
      </div>
    </>
  )
}

/** Arrêtés du compte, du plus récent au plus ancien (montrés à partir de deux). */
function ListeArretes({ arretes }: Readonly<{ arretes: readonly ArreteRapprochement[] }>) {
  const lignes = [...arretes].sort((a, b) => b.dateArrete.localeCompare(a.dateArrete))
  return (
    <div className="tbl-wrap" style={{ marginTop: 14 }}>
      <table className="tbl vfx-fiches" aria-label="Arrêtés du compte" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader">Date</th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Solde banque
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Solde compta
            </th>
            <th role="columnheader" style={{ textAlign: 'right' }}>
              Écart
            </th>
            <th role="columnheader">Statut</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {lignes.map((arrete) => (
            <tr key={arrete.id} role="row">
              <td role="cell" className="num-cell" data-label="Date">
                {dateIsoVersFr(arrete.dateArrete)}
              </td>
              <td role="cell" className="num-cell" style={STYLE_MONTANT} data-label="Solde banque">
                {euros(arrete.soldeBanqueCentimes)}
              </td>
              <td role="cell" className="num-cell" style={STYLE_MONTANT} data-label="Solde compta">
                {euros(arrete.soldeComptaCentimes)}
              </td>
              <td role="cell" className="num-cell" style={STYLE_MONTANT} data-label="Écart">
                {euros(etatArrete(arrete).ecartCentimes)}
              </td>
              <td role="cell" data-label="Statut">{arrete.statut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Corps du panneau une fois le compte choisi : lecture, arrêtés illisibles, arrêté affiché, liste. `arretes` : arrêtés
 * lus, au solde compta de l'instant pour celui en cours.
 */
function ContenuArretes({
  lus,
  arretes,
  courant,
  actions,
}: Readonly<{ lus: ArretesLusEcran; arretes: readonly ArreteRapprochement[]; courant: ArreteRapprochement | null; actions: ActionsArrete }>) {
  if (lus.chargement)
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Chargement…
      </p>
    )
  if (lus.erreur)
    return (
      <Alert kind="warn" icon="alert" title="Arrêtés illisibles">
        {lus.erreur}
      </Alert>
    )
  const s = lus.illisibles > 1 ? 's' : ''
  return (
    <>
      {lus.illisibles > 0 && (
        <Alert kind="rust" title={`${lus.illisibles} arrêté${s} de la base non affiché${s}`}>
          Sans la forme d’un arrêté : à reprendre dans la base locale. Ni ouverture, ni clôture, ni déclôture tant qu’il en reste.
        </Alert>
      )}
      {courant ? (
        <ArreteAffiche arrete={courant} {...actions} />
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Aucun arrêté pour ce compte.
        </p>
      )}
      {arretes.length > 1 && <ListeArretes arretes={arretes} />}
    </>
  )
}

export interface RapprochementPanelProps {
  /** Comptes lisibles de la copropriété, actifs et clôturés : seuls les actifs sont proposés. */
  comptes: readonly CompteAffiche[]
  etatComptes: EtatComptes
  /** Écritures du journal de banque de la copropriété : solde compta montré dans « Nouvel arrêté ». */
  ecrituresBanque: readonly EcritureSolde[]
  /** Relevés importés gardés de la copropriété : solde banque proposé dans « Nouvel arrêté ». */
  relevesImportes: readonly ReleveImporte[]
}

export function RapprochementPanel({ comptes, etatComptes, ecrituresBanque, relevesImportes }: Readonly<RapprochementPanelProps>) {
  const { push } = useToast()
  const [choix, setChoix] = useState('')
  const [modale, setModale] = useState<null | 'nouvel-arrete' | 'abandon'>(null)
  const [occupe, setOccupe] = useState(false)
  const actifs = comptesActifs(comptes, etatComptes)
  const compte = actifs.find((candidat) => candidat.id === choix) ?? actifs[0] ?? null
  const lus = useArretesRapprochement(compte?.id ?? null, (message) => push({ kind: 'warn', title: 'Arrêtés illisibles', desc: message }))
  const fermer = () => setModale(null)
  const ecritures = useEcrituresArretes(lus.relire, fermer)
  // Arrêté en cours : solde compta de l'instant, recalculé sur les écritures affichées ; arrêté clôturé : solde figé.
  const arretes = lus.arretes.map((arrete) => avecSoldeComptaCourant(arrete, ecrituresBanque))
  const courant = arreteCourant(arretes)
  // Arrêté illisible sur le compte : toute écriture refusée, règle commune du domaine (refusArretesIllisibles, rb-16 A).
  const pret = compte !== null && !lus.chargement && !lus.erreur && refusArretesIllisibles(lus.illisibles) === null
  // Une écriture à la fois (double clic) ; les écritures signalent elles-mêmes leur échec (toast).
  const lancer = async (action: () => Promise<void>) => {
    if (occupe) return
    setOccupe(true)
    try {
      await action()
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Panel
      title={courant ? `Rapprochement au ${dateIsoVersFr(courant.dateArrete)}` : 'Rapprochement bancaire'}
      sub="Arrêtés successifs par compte : un seul en cours, clôture à l’équilibre"
      icon="check"
      right={
        courant?.statut === 'En cours' ? (
          <button
            type="button"
            className="btn gold sm"
            aria-label={`Clôturer l’arrêté du ${dateIsoVersFr(courant.dateArrete)}`}
            disabled={!pret || occupe}
            onClick={() => void lancer(() => ecritures.cloturer(courant))}
          >
            <Icon name="check" />
            Clôturer
          </button>
        ) : (
          <button type="button" className="btn gold sm" disabled={!pret} onClick={() => setModale('nouvel-arrete')}>
            <Icon name="plus" />
            Nouvel arrêté
          </button>
        )
      }
    >
      <ChoixCompteBancaire label="Compte rapproché" name="rapprochement-compte" etat={etatComptes} actifs={actifs} choisi={compte} choisir={setChoix} />
      {compte && (
        <ContenuArretes
          lus={lus}
          arretes={arretes}
          courant={courant}
          actions={{
            decloturer: (arrete) => void lancer(() => ecritures.decloturer(arrete)),
            abandonner: () => setModale('abandon'),
            occupe: occupe || !pret,
          }}
        />
      )}
      {modale === 'nouvel-arrete' && compte && (
        <NouvelArreteModal
          key={compte.id}
          compte={compte}
          ecrituresBanque={ecrituresBanque}
          relevesImportes={relevesImportes}
          onClose={fermer}
          onEnregistrer={(valeurs) => ecritures.ouvrir(compte, valeurs)}
        />
      )}
      {modale === 'abandon' && compte && courant?.statut === 'En cours' && (
        <AbandonArreteModal compte={compte} arrete={courant} onClose={fermer} onConfirmer={() => ecritures.abandonner(courant)} />
      )}
    </Panel>
  )
}
