'use client'

import { useState } from 'react'
import { arreteCourant, controlerSaisieArrete, type ValeursArrete } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
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
import { cloturerArreteCompte, decloturerArreteCompte, ouvrirArreteCompte } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { useArretesRapprochement, type ArretesLusEcran } from '@/lib/administrateur-judiciaire/db/use-arretes'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { etatArrete, type ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
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
 * - Aucun élément à pointer : les écritures du compte viennent toutes du relevé importé, le côté compta indépendant
 *   (règlements, remises) n'est pas branché ; les cases « Auto / Pointé / En suspens » de la maquette n'ont donc rien à
 *   montrer, et le panneau le dit.
 * - Sur téléphone : statut et actions secondaires dans le corps (l'en-tête ne garde qu'un bouton), indicateurs en une
 *   colonne (card-grid cols-4), liste des arrêtés dans son cadre défilant (tbl-wrap).
 */

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)
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
  }
}

/** Arrêté affiché : statut, soldes, écart et taux du domaine (disposition de la maquette), note et règle d'équilibre. */
function ArreteAffiche({ arrete, decloturer, occupe }: Readonly<{ arrete: ArreteRapprochement; decloturer: () => void; occupe: boolean }>) {
  const etat = etatArrete(arrete)
  const cloture = arrete.statut === 'Clôturé'
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pill kind={cloture ? 'sage' : 'gold'}>{arrete.statut}</Pill>
        {cloture && (
          <button type="button" className="btn ghost sm" disabled={occupe} onClick={decloturer}>
            <Icon name="history" />
            Déclôturer
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
        <div>
          Rapproché auto {etat.tauxAutoPct} % · manuel {etat.tauxManuelPct} %
        </div>
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
      <table className="tbl" aria-label="Arrêtés du compte">
        <thead>
          <tr>
            <th>Date</th>
            <th style={{ textAlign: 'right' }}>Solde banque</th>
            <th style={{ textAlign: 'right' }}>Solde compta</th>
            <th style={{ textAlign: 'right' }}>Écart</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((arrete) => (
            <tr key={arrete.id}>
              <td className="num-cell">{dateIsoVersFr(arrete.dateArrete)}</td>
              <td className="num-cell" style={STYLE_MONTANT}>
                {euros(arrete.soldeBanqueCentimes)}
              </td>
              <td className="num-cell" style={STYLE_MONTANT}>
                {euros(arrete.soldeComptaCentimes)}
              </td>
              <td className="num-cell" style={STYLE_MONTANT}>
                {euros(etatArrete(arrete).ecartCentimes)}
              </td>
              <td>{arrete.statut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Corps du panneau une fois le compte choisi : lecture, arrêtés illisibles, arrêté affiché, liste. */
function ContenuArretes({
  lus,
  courant,
  decloturer,
  occupe,
}: Readonly<{ lus: ArretesLusEcran; courant: ArreteRapprochement | null; decloturer: (arrete: ArreteRapprochement) => void; occupe: boolean }>) {
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
          Sans la forme d’un arrêté : à reprendre dans la base locale. Aucun nouvel arrêté tant qu’il en reste.
        </Alert>
      )}
      {courant ? (
        <ArreteAffiche arrete={courant} decloturer={() => decloturer(courant)} occupe={occupe} />
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Aucun arrêté pour ce compte.
        </p>
      )}
      {lus.arretes.length > 1 && <ListeArretes arretes={lus.arretes} />}
    </>
  )
}

export interface RapprochementPanelProps {
  /** Comptes lisibles de la copropriété, actifs et clôturés : seuls les actifs sont proposés. */
  comptes: readonly CompteAffiche[]
  etatComptes: EtatComptes
  /** Écritures du journal de banque de la copropriété : solde compta montré dans « Nouvel arrêté ». */
  ecrituresBanque: readonly EcritureSolde[]
}

export function RapprochementPanel({ comptes, etatComptes, ecrituresBanque }: Readonly<RapprochementPanelProps>) {
  const { push } = useToast()
  const [choix, setChoix] = useState('')
  const [formulaire, setFormulaire] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const actifs = comptesActifs(comptes, etatComptes)
  const compte = actifs.find((candidat) => candidat.id === choix) ?? actifs[0] ?? null
  const lus = useArretesRapprochement(compte?.id ?? null, (message) => push({ kind: 'warn', title: 'Arrêtés illisibles', desc: message }))
  const ecritures = useEcrituresArretes(lus.relire, () => setFormulaire(false))
  const courant = arreteCourant(lus.arretes)
  const pret = compte !== null && !lus.chargement && !lus.erreur
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
          <button type="button" className="btn gold sm" disabled={!pret || occupe} onClick={() => void lancer(() => ecritures.cloturer(courant))}>
            <Icon name="check" />
            Clôturer
          </button>
        ) : (
          <button type="button" className="btn gold sm" disabled={!pret} onClick={() => setFormulaire(true)}>
            <Icon name="plus" />
            Nouvel arrêté
          </button>
        )
      }
    >
      <ChoixCompteBancaire label="Compte rapproché" name="rapprochement-compte" etat={etatComptes} actifs={actifs} choisi={compte} choisir={setChoix} />
      {compte && <ContenuArretes lus={lus} courant={courant} decloturer={(arrete) => void lancer(() => ecritures.decloturer(arrete))} occupe={occupe} />}
      {formulaire && compte && (
        <NouvelArreteModal
          key={compte.id}
          compte={compte}
          ecrituresBanque={ecrituresBanque}
          onClose={() => setFormulaire(false)}
          onEnregistrer={(valeurs) => ecritures.ouvrir(compte, valeurs)}
        />
      )}
    </Panel>
  )
}
