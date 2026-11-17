'use client'

import { useMemo, useState } from 'react'
import { DEMO_SINISTRES } from '@/components/administrateur-judiciaire/data/sinistres'
import {
  useChoixSinistre,
  type ChoixSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/choix-sinistre'
import {
  FicheSinistreModal,
  type LigneSinistre,
} from '@/components/administrateur-judiciaire/modules/technique/sinistres/FicheSinistreModal'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable, type ColonneTableau } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { titreListeVide, useCoproChoisie } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { enregistrerSinistre } from '@/lib/administrateur-judiciaire/db/sinistres'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  ficheDepuisEnregistrement,
  filtrerSinistres,
  lesesSituation,
  numerosAttribues,
  type LigneNumerotee,
} from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import { filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { statutSinistre, type SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'
import { AUJOURDHUI_ISO, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'
import {
  PHASE_SINISTRE,
  STATUT_SINISTRE,
  TYPE_SINISTRE,
  type PhaseSinistre,
  type StatutSinistre,
  type TypeSinistre,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Sinistres, sur le modèle du module Sinistres de Gestéam (liste Date · Type · Mandat · Lésés / situation, fiche
 * complète). Affichés selon la copropriété choisie dans le sélecteur du haut de page, filtrables par statut, type et
 * phase ; indicateurs calculés sur les sinistres de la copropriété (« Assureurs » : compagnies distinctes, dans l'ordre
 * de la liste). « Déclarer un sinistre » et « Détails » ouvrent la même fiche, modifiable (FicheSinistreModal).
 * - Données réelles : la liste lit la table locale « sinistres » ; la fiche s'y enregistre (db/sinistres.ts). Une ligne
 *   illisible (type, survenance ou format d'un champ) est comptée et signalée, jamais tue, et ne bloque pas l'écran ;
 *   son n°, s'il est un texte, reste attribué (ni reproposé ni accepté en double), sinon il est ignoré.
 * - Démonstration : trois fiches fictives ; l'enregistrement est SIMULÉ (rien n'est écrit), mêmes champs. La pastille
 *   du Shell le dit (statut « demo » en démonstration, registry.ts : simulesEnDemonstration), l'écran aussi.
 */

interface FiltresListe {
  statut: StatutSinistre | ''
  type: TypeSinistre | ''
  phase: PhaseSinistre | ''
}

const FILTRES_VIDES: FiltresListe = { statut: '', type: '', phase: '' }

/** Formulaire fermé (null), déclaration (« nouvelle ») ou fiche à modifier. */
type Edition = null | 'nouvelle' | LigneSinistre

const pluriel = (nombre: number, mot: string): string => `${mot}${nombre > 1 ? 's' : ''}`

const parSurvenanceDecroissante = (lignes: LigneSinistre[]): LigneSinistre[] =>
  [...lignes].sort((a, b) => b.dateSurvenance.localeCompare(a.dateSurvenance))

interface LignesSinistres {
  lignes: LigneSinistre[]
  illisibles: number
  loading: boolean
  /** Toutes les lignes, illisibles comprises : leurs numéros sont attribués (proposition et unicité du numéro). */
  numerotees: readonly LigneNumerotee[]
}

/** Lignes affichées : la table locale en mode réel (lignes illisibles comptées, jamais tues), la démonstration sinon. */
function useLignesSinistres(): LignesSinistres {
  const { sinistres, loading } = useDonneesLocales()
  return useMemo(() => {
    if (MODE_ACTIF !== 'reel')
      return { lignes: [...DEMO_SINISTRES], illisibles: 0, loading: false, numerotees: DEMO_SINISTRES }
    const lignes = sinistres.flatMap((ligne) => {
      const fiche = ficheDepuisEnregistrement(ligne)
      return fiche ? [{ ...fiche, id: ligne.id }] : []
    })
    return {
      lignes: parSurvenanceDecroissante(lignes),
      illisibles: sinistres.length - lignes.length,
      loading,
      numerotees: sinistres,
    }
  }, [sinistres, loading])
}

/** Cellule « Copropriété / mandat » : nom de la copropriété, mandat rattaché en dessous. */
function CelluleCoproMandat({ ligne, choix }: { ligne: LigneSinistre; choix: ChoixSinistre }) {
  const mandat = choix.mandatsDe(ligne.coproprieteId).find((candidat) => candidat.id === ligne.mandatId)
  return (
    <>
      {choix.copros.find((copro) => copro.id === ligne.coproprieteId)?.nom ?? '—'}
      {mandat && (
        <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
          {mandat.libelle}
        </span>
      )}
    </>
  )
}

function colonnesSinistres(choix: ChoixSinistre): ColonneTableau<LigneSinistre>[] {
  return [
    { h: 'Date', render: (ligne) => dateIsoVersFr(ligne.dateSurvenance) },
    {
      h: 'N°',
      render: (ligne) => (
        <span className="mono" style={{ fontSize: 12 }}>
          {ligne.numero ?? '—'}
        </span>
      ),
    },
    { h: 'Type', render: (ligne) => <b style={{ fontWeight: 600 }}>{ligne.type}</b> },
    { h: 'Copropriété / mandat', render: (ligne) => <CelluleCoproMandat ligne={ligne} choix={choix} /> },
    { h: 'Lésés / situation', render: (ligne) => lesesSituation(ligne) || '—' },
    { h: 'Phase', render: (ligne) => ligne.phase ?? '—' },
    {
      h: 'Statut',
      render: (ligne) => {
        const statut = statutSinistre(ligne)
        return <Pill kind={statut === 'Terminé' ? 'sage' : 'amber'}>{statut}</Pill>
      },
    },
    { h: 'Assureur', render: (ligne) => ligne.assurance.compagnie ?? '—' },
  ]
}

/** Liste de filtre (valeur vide : tous). */
function SelectFiltre<T extends string>({
  libelle,
  tous,
  valeurs,
  valeur,
  onChange,
}: {
  libelle: string
  tous: string
  valeurs: readonly T[]
  valeur: T | ''
  onChange: (valeur: T | '') => void
}) {
  return (
    <select className="btn" aria-label={libelle} value={valeur} onChange={(evenement) => onChange(evenement.target.value as T | '')}>
      <option value="">{tous}</option>
      {valeurs.map((possible) => (
        <option key={possible}>{possible}</option>
      ))}
    </select>
  )
}

/** Filtres de la liste (statut, type, phase) et copropriété, reliée au sélecteur du haut de page ; compteur annoncé. */
function BarreFiltres({
  filtres,
  changer,
  choix,
  code,
  nombre,
}: {
  filtres: FiltresListe
  changer: (filtres: FiltresListe) => void
  choix: ChoixSinistre
  code: string | null
  nombre: number
}) {
  const choisirCopro = useSelectionDossier((etat) => etat.choisirCopro)
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <SelectFiltre
        libelle="Filtrer par statut"
        tous="Tous statuts"
        valeurs={STATUT_SINISTRE}
        valeur={filtres.statut}
        onChange={(statut) => changer({ ...filtres, statut })}
      />
      <SelectFiltre
        libelle="Filtrer par type"
        tous="Tous types"
        valeurs={TYPE_SINISTRE}
        valeur={filtres.type}
        onChange={(type) => changer({ ...filtres, type })}
      />
      <SelectFiltre
        libelle="Filtrer par phase"
        tous="Toutes phases"
        valeurs={PHASE_SINISTRE}
        valeur={filtres.phase}
        onChange={(phase) => changer({ ...filtres, phase })}
      />
      <select
        className="btn"
        aria-label="Filtrer par copropriété"
        value={code ?? ''}
        onChange={(evenement) => {
          if (evenement.target.value) choisirCopro(evenement.target.value)
        }}
      >
        {!code && <option value="">Toutes copropriétés</option>}
        {choix.copros.map((copro) => (
          <option key={copro.id} value={copro.code}>
            {copro.nom}
          </option>
        ))}
      </select>
      <span className="muted" aria-live="polite" style={{ fontSize: 12.5 }}>
        {`${nombre} ${pluriel(nombre, 'sinistre')} ${pluriel(nombre, 'affiché')}`}
      </span>
    </div>
  )
}

/** Contenu du panneau : chargement, état vide (copropriété ou filtres), ou tableau. */
function ListeSinistres({
  loading,
  deLaCopro,
  affiches,
  titreVide,
  choix,
  ouvrir,
}: {
  loading: boolean
  deLaCopro: number
  affiches: LigneSinistre[]
  titreVide: string
  choix: ChoixSinistre
  ouvrir: (ligne: LigneSinistre) => void
}) {
  if (loading)
    return (
      <p className="muted" style={{ padding: '18px 22px' }}>
        Chargement…
      </p>
    )
  if (deLaCopro === 0) return <EmptyState icon="shield" title={titreVide} />
  if (affiches.length === 0) return <EmptyState icon="shield" title="Aucun sinistre ne correspond aux filtres" />
  return <DataTable rowKey="id" columns={colonnesSinistres(choix)} rows={affiches} onRow={ouvrir} />
}

/**
 * Enregistrement de la fiche : écrit dans la table locale en mode réel, simulé en démonstration (rien n'est écrit).
 * Ne rejette jamais : l'échec est signalé par un toast (la fiche reste ouverte) ; `fermer` est appelé après succès.
 */
function useEnregistrerSinistre(id: string | null, fermer: () => void) {
  const { push } = useToast()
  return async (saisie: SaisieSinistre, statut: StatutSinistre): Promise<boolean> => {
    if (MODE_ACTIF !== 'reel') {
      push({
        kind: 'success',
        title: 'Simulation',
        desc: "Rien n'est enregistré en démonstration : la fiche n'a pas été écrite dans la base.",
      })
      fermer()
      return true
    }
    try {
      const enregistre = await enregistrerSinistre(saisie, { id, aujourdhui: AUJOURDHUI_ISO, statutSaisi: statut })
      push({
        kind: 'success',
        title: id ? 'Sinistre modifié' : 'Sinistre enregistré',
        desc: `${enregistre.numero ?? 'Sans numéro'} · ${enregistre.type} : fiche enregistrée dans la base locale.`,
      })
      fermer()
      return true
    } catch (erreur) {
      push({
        kind: 'warn',
        title: 'Enregistrement impossible',
        desc: erreur instanceof Error ? erreur.message : String(erreur),
      })
      return false
    }
  }
}

/** Filtres de l'écran → filtres du domaine (valeur vide : pas de filtre). */
const filtresDomaine = ({ statut, type, phase }: FiltresListe) => ({
  statut: statut || null,
  type: type || null,
  phase: phase || null,
})

export function SinistresModule() {
  const choix = useChoixSinistre()
  const { lignes, illisibles, loading, numerotees } = useLignesSinistres()
  const { code, nom } = useCoproChoisie()
  const [filtres, setFiltres] = useState<FiltresListe>(FILTRES_VIDES)
  const [edition, setEdition] = useState<Edition>(null)
  const codeDe = (coproprieteId: string) => choix.copros.find((copro) => copro.id === coproprieteId)?.code
  const deLaCopro = filtrerParCopro(lignes, code, (ligne) => codeDe(ligne.coproprieteId))
  const affiches = filtrerSinistres(deLaCopro, filtresDomaine(filtres))
  const assureurs = [...new Set(deLaCopro.map((ligne) => ligne.assurance.compagnie).filter((compagnie) => !!compagnie))]
  const enCours = deLaCopro.filter((ligne) => statutSinistre(ligne) === 'En cours').length
  const ligneEditee = edition === 'nouvelle' ? null : edition
  const enregistrer = useEnregistrerSinistre(ligneEditee?.id ?? null, () => setEdition(null))

  return (
    <>
      <PageHead
        eyebrow="Technique & travaux"
        title="Sinistres"
        lede="Déclarations et suivi des sinistres auprès de l'assurance obligatoire de la copropriété (art. 9-1 loi 1965)."
        actions={
          <button className="btn gold" onClick={() => setEdition('nouvelle')}>
            <Icon name="plus" />
            Déclarer un sinistre
          </button>
        }
      />
      <Kpis
        items={[
          { icon: 'shield', num: deLaCopro.length, lbl: 'Sinistres suivis', sub: 'tous statuts' },
          { icon: 'clock', num: enCours, lbl: 'En cours', sub: 'statut En cours', accent: 'amber' },
          { icon: 'check', num: deLaCopro.length - enCours, lbl: 'Clôturés', sub: '« Clos le » daté', accent: 'sage' },
          { icon: 'doc', num: assureurs.length, lbl: 'Assureurs', sub: assureurs.join(' · ') },
        ]}
      />
      {MODE_ACTIF !== 'reel' && (
        <Alert kind="" icon="info" title="Démonstration : enregistrement simulé">
          La fiche se remplit comme en données réelles, mais rien n’est écrit ; en mode « Données réelles », elle
          s’enregistre dans la base locale de ce navigateur.
        </Alert>
      )}
      {illisibles > 0 && (
        <Alert kind="rust" title={`${illisibles} ${pluriel(illisibles, 'fiche')} de la base non ${pluriel(illisibles, 'affichée')}`}>
          Type, date de survenance ou format d’un champ illisible : fiche à reprendre dans la base locale.
        </Alert>
      )}
      <BarreFiltres filtres={filtres} changer={setFiltres} choix={choix} code={code} nombre={affiches.length} />
      <Panel title="Suivi des sinistres" sub="Date · type · mandat · lésés / situation" icon="shield" flush>
        <ListeSinistres
          loading={loading}
          deLaCopro={deLaCopro.length}
          affiches={affiches}
          titreVide={code ? titreListeVide('Aucun sinistre', nom) : 'Aucun sinistre enregistré'}
          choix={choix}
          ouvrir={setEdition}
        />
      </Panel>
      {edition && (
        <FicheSinistreModal
          key={ligneEditee?.id ?? 'nouvelle'}
          ligne={ligneEditee}
          choix={choix}
          coproParDefaut={choix.copros.find((copro) => copro.code === code) ?? choix.copros[0] ?? null}
          numerosExistants={numerosAttribues(numerotees, ligneEditee?.id ?? null)}
          aujourdhui={AUJOURDHUI_ISO}
          onClose={() => setEdition(null)}
          onEnregistrer={enregistrer}
        />
      )}
    </>
  )
}
