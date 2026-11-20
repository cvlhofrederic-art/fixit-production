'use client'

import { useState } from 'react'
import { NouvelAppelModal, type SaisieFormulaireAppel } from '@/components/administrateur-judiciaire/modules/finances/appels/AppelsModals'
import { AvisAppelPanel, type EcrituresAvis } from '@/components/administrateur-judiciaire/modules/finances/appels/AvisAppelPanel'
import {
  NATURES_APPEL,
  centimesDepuisSaisie,
  indicateursAppels,
  type IndicateursAppels,
} from '@/components/administrateur-judiciaire/modules/finances/appels/appels-vue'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { ecrireAppelDeFonds, enregistrerNouvelAppel, ouvrirExercice, type DonneesAppelsLues } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { migrerFichesCoproprietaires } from '@/lib/administrateur-judiciaire/db/migration-d2'
import type { EcheanceAppelEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import { useAppelsDeFonds } from '@/lib/administrateur-judiciaire/db/use-appels-de-fonds'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { StatutEcheanceAppel } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { useCodeCoproCourant } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écran « Appels de fonds » en données réelles (plan des écrans, § 5.5 à 5.10) : échéancier du syndicat choisi en haut
 * de page, avis par copropriétaire, écriture de l'appel et lot de prélèvements, sur les tables D2 de la base locale
 * (db/appels-de-fonds.ts). Les onglets et le tableau « Quotes-parts par copropriété » de la démonstration n'ont pas de
 * données réelles : ils ne sont pas affichés ici (écart). Indicateurs tirés de l'échéancier. Chaque écriture est
 * confirmée ou refusée par un toast, puis la base est relue.
 */

const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)
const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

const COULEUR_STATUT: Record<StatutEcheanceAppel, string | undefined> = {
  Prévu: undefined,
  'En attente': 'amber',
  Appelé: 'sage',
  Annulé: 'rust',
}

/** Toast de succès d'une écriture : titre et texte. */
interface Succes {
  title: string
  desc: string
}

async function enregistrerEcheance(copro: CoproprieteVue, saisie: SaisieFormulaireAppel): Promise<Succes> {
  const montantCentimes = centimesDepuisSaisie(saisie.montant)
  if (montantCentimes === null) throw new Error('Montant illisible : en euros, au centime près (ex. 1 250,00).')
  const { echeance, cleCreee } = await enregistrerNouvelAppel(copro.id, { ...saisie, montantCentimes })
  const cle = cleCreee ? ' ; clé générale « 001 » créée depuis les tantièmes des lots' : ''
  return {
    title: 'Échéance enregistrée',
    desc: `${echeance.libelle} : ${eur(echeance.montantCentimes)} exigible le ${dateIsoVersFr(echeance.exigibilite)}, « Prévu »${cle}.`,
  }
}

async function reprendreFiches(): Promise<Succes> {
  const { creees, ecartees, lotsARegulariser } = await migrerFichesCoproprietaires({ aujourdhui: AUJOURDHUI_ISO })
  return {
    title: 'Fiches reprises',
    desc: `${pluriel(creees.length, 'fiche')} reprise(s) en identités, comptes et positions (toutes copropriétés) ; ${pluriel(ecartees.length, 'fiche')} écartée(s) ; ${pluriel(lotsARegulariser.length, 'lot')} à régulariser.`,
  }
}

async function ouvrirExerciceDuSyndicat(copro: CoproprieteVue, bornes: { ouverture: string; cloture: string }): Promise<Succes> {
  const exercice = await ouvrirExercice(copro.id, bornes)
  return { title: 'Exercice ouvert', desc: `Exercice ${exercice.nom ?? ''} (${dateIsoVersFr(bornes.ouverture)} – ${dateIsoVersFr(bornes.cloture)}), en préparation.` }
}

async function ecrireAppel(copro: CoproprieteVue, jusquAu: string): Promise<Succes> {
  const { piece, appelees, avertissements } = await ecrireAppelDeFonds(copro.id, { jusquAu, mandatId: copro.mandatId })
  const suite = avertissements.map((a) => ` ${a.message}`).join('')
  return {
    title: 'Appel écrit',
    desc: `Appel de fonds écrit : pièce n° ${piece.numero} du ${dateIsoVersFr(piece.date)}, ${pluriel(appelees.length, 'échéance')} « Appelé ».${suite}`,
  }
}

/** Écritures de l'écran : chacune confirmée ou refusée par un toast ; après un succès, la base est relue. */
function useEcrituresAppels(copro: CoproprieteVue, relire: () => void) {
  const { push } = useToast()
  const lancer = async (refus: string, ecrire: () => Promise<Succes>): Promise<boolean> => {
    try {
      push({ kind: 'success', ...(await ecrire()) })
      relire()
      return true
    } catch (erreur) {
      push({ kind: 'warn', title: refus, desc: messageErreur(erreur) })
      return false
    }
  }
  const ecritures: EcrituresAvis = {
    reprendreFiches: async () => {
      await lancer('Reprise impossible', reprendreFiches)
    },
    ouvrirExercice: (bornes) => lancer('Exercice non ouvert', () => ouvrirExerciceDuSyndicat(copro, bornes)),
    ecrireAppel: (jusquAu) => lancer('Appel non écrit', () => ecrireAppel(copro, jusquAu)),
  }
  return {
    nouvelAppel: (saisie: SaisieFormulaireAppel) => lancer('Enregistrement impossible', () => enregistrerEcheance(copro, saisie)),
    ecritures,
  }
}

function EcheancierAppelsPanel({ donnees }: Readonly<{ donnees: DonneesAppelsLues }>) {
  const cleDe = (id: string) => donnees.cles.find((c) => c.id === id)?.code ?? '—'
  const pieceDe = (id: string | null): string => {
    const piece = donnees.pieces.find((p) => p.id === id)
    return piece ? `n° ${piece.numero}` : '—'
  }
  const lignes = [...donnees.echeances].sort((a, b) => a.exigibilite.localeCompare(b.exigibilite) || a.id.localeCompare(b.id))
  return (
    <Panel title="Échéancier des appels" sub="Échéances du syndicat, de la saisie à l’appel" icon="calendar" flush>
      {lignes.length > 0 ? (
        <DataTable<EcheanceAppelEnregistree>
          rowKey="id"
          rows={lignes}
          columns={[
            { h: 'Exigibilité', render: (e) => <span className="mono">{dateIsoVersFr(e.exigibilite)}</span> },
            { h: 'Clé', render: (e) => <span className="mono">{cleDe(e.cleId)}</span> },
            { h: 'Libellé', render: (e) => <b>{e.libelle}</b> },
            { h: 'Nature', render: (e) => NATURES_APPEL[e.nature] },
            { h: 'Montant', render: (e) => <span className="mono">{eur(e.montantCentimes)}</span> },
            {
              h: 'Statut',
              render: (e) => (
                <Pill kind={COULEUR_STATUT[e.statut]} noDot>
                  {e.statut}
                </Pill>
              ),
            },
            { h: 'Pièce', render: (e) => <span className="mono">{pieceDe(e.traitementId)}</span> },
          ]}
        />
      ) : (
        <EmptyState icon="coin" title="Aucune échéance" desc="« Émettre un appel » crée la première échéance du syndicat." />
      )}
    </Panel>
  )
}

/** En-tête et indicateurs ; `onEmettre` null : bouton « Émettre un appel » désactivé (aucun syndicat lu). */
function EnTeteAppels({ indicateurs, onEmettre }: Readonly<{ indicateurs: IndicateursAppels; onEmettre: (() => void) | null }>) {
  const prochaine = indicateurs.prochaineExigibilite
  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Appels de fonds"
        lede="Échéancier, avis par copropriétaire et écriture de l’appel du syndicat."
        actions={
          <button className="btn gold" disabled={!onEmettre} onClick={() => onEmettre?.()}>
            <Icon name="coin" />
            Émettre un appel
          </button>
        }
      />
      <Kpis
        items={[
          { icon: 'coin', num: eur(indicateurs.aAppelerCentimes), lbl: 'À appeler', sub: `${pluriel(indicateurs.aAppelerNombre, 'échéance')} « Prévu »` },
          { icon: 'check', num: eur(indicateurs.appeleCentimes), lbl: 'Appelé', accent: 'sage' },
          { icon: 'calendar', num: prochaine ? dateIsoVersFr(prochaine) : '—', lbl: 'Prochaine exigibilité', accent: 'gold' },
          { icon: 'users', num: indicateurs.comptes, lbl: 'Comptes copropriétaires' },
        ]}
      />
    </>
  )
}

/** Écran du syndicat choisi : lecture de ses tables, panneaux, « Nouvel appel de fonds ». */
function AppelsDuSyndicat({ copro }: Readonly<{ copro: CoproprieteVue }>) {
  const { push } = useToast()
  const lus = useAppelsDeFonds(copro.id, (message) => push({ kind: 'warn', title: 'Appels de fonds illisibles', desc: message }))
  const [nouvelAppelOuvert, setNouvelAppelOuvert] = useState(false)
  const { nouvelAppel, ecritures } = useEcrituresAppels(copro, lus.relire)
  const donnees = lus.donnees
  return (
    <>
      <EnTeteAppels
        indicateurs={indicateursAppels(donnees?.echeances ?? [], donnees?.comptes ?? [])}
        onEmettre={donnees ? () => setNouvelAppelOuvert(true) : null}
      />
      {lus.chargement && (
        <p className="muted" style={{ fontSize: 13 }}>
          Chargement…
        </p>
      )}
      {lus.erreur && (
        <Panel title="Avis d’appel par copropriétaire" icon="coin">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{`Données illisibles : ${lus.erreur}`}</p>
        </Panel>
      )}
      {donnees && (
        <>
          <AvisAppelPanel copro={copro} donnees={donnees} ecritures={ecritures} />
          <EcheancierAppelsPanel donnees={donnees} />
        </>
      )}
      {nouvelAppelOuvert && donnees && (
        <NouvelAppelModal
          cles={donnees.cles}
          onClose={() => setNouvelAppelOuvert(false)}
          onEnregistrer={async (saisie) => {
            const ferme = await nouvelAppel(saisie)
            if (ferme) setNouvelAppelOuvert(false)
            return ferme
          }}
        />
      )}
    </>
  )
}

export function AppelsDeFondsReel() {
  const code = useCodeCoproCourant()
  const { copros } = useDonneesLocales()
  const copro = copros.find((candidate) => candidate.code === code)
  if (copro) return <AppelsDuSyndicat key={copro.id} copro={copro} />
  return (
    <>
      <EnTeteAppels indicateurs={indicateursAppels([], [])} onEmettre={null} />
      <Panel title="Avis d’appel par copropriétaire" icon="coin">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Aucune copropriété choisie.
        </p>
      </Panel>
    </>
  )
}
