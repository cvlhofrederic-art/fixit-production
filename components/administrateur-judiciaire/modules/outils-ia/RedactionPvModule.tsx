'use client'

import { useRef, useState } from 'react'
import MarkdownIA from '@/components/common/MarkdownIA'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { RESOLUTIONS_PROJET_PV } from '@/components/administrateur-judiciaire/data/redaction-pv'
import { ChampCoproprieteDemo } from '@/components/administrateur-judiciaire/modules/ChampCoproprieteDemo'
import {
  STYLE_BOUTON_ATTENTE,
  demanderTexteOutilIA,
  messageErreurOutilIA,
} from '@/components/administrateur-judiciaire/modules/outils-ia/appelOutilIA'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { construireContextePv, markdownVersTexteBrut } from '@/lib/administrateur-judiciaire/ia/outils'
import { AUJOURDHUI_ISO, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/**
 * Trame du projet de PV, affichée avant la rédaction par l'IA. Les résolutions sont numérotées dans l'ordre de
 * sélection (et non dans l'ordre de la liste) ; le résultat des votes reste à compléter (la maquette les déclarait
 * toutes « adoptée à la majorité (art. 24) »).
 */
function texteProjetPv(copropriete: string, resolutionsSelectionnees: readonly number[]): string {
  const lignesResolutions = resolutionsSelectionnees
    .map((indexResolution, rang) => `${rang + 1}. ${RESOLUTIONS_PROJET_PV[indexResolution]} — vote : [À COMPLÉTER].`)
    .join('\n')
  return (
    "PROCÈS-VERBAL D'ASSEMBLÉE GÉNÉRALE\n" +
    `${copropriete}\n` +
    '\n' +
    `L'an ${AUJOURDHUI_ISO.slice(0, 4)}, les copropriétaires se sont réunis en assemblée générale.\n` +
    '\n' +
    'RÉSOLUTIONS SOUMISES AU VOTE :\n' +
    `${lignesResolutions}\n` +
    '\n' +
    "L'ordre du jour étant épuisé, la séance est levée."
  )
}

/**
 * Rédaction de procès-verbaux (barre latérale : section Outils IA ; surtitre « Assistant · IA ») : choix de la
 * copropriété et des résolutions (cases cochables, sélection initiale : 1re et 3e), aperçu du projet de PV.
 * « Générer le PV » demande à l'assistant IA (Claude, via /api/administrateur-judiciaire/outils) un projet de PV pour
 * la copropriété et les résolutions choisies, avec le mandat enregistré dans la base ; le projet (Markdown, mentions
 * [À COMPLÉTER]) remplace l'aperçu tant que la sélection ne change pas. « Copier » copie le texte affiché.
 */
export function RedactionPvModule() {
  const { push } = useToast()
  const { copros } = useDonneesLocales()
  const [copropriete, setCopropriete] = useState<string>(DEMO_NOMS_COPROPRIETES[0])
  const [resolutionsSelectionnees, setResolutionsSelectionnees] = useState<number[]>([0, 2])
  /** Projet rédigé par l'IA, rattaché à la sélection qui l'a produit (copropriété et résolutions). */
  const [pvGenere, setPvGenere] = useState<{ selection: string; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Cocher ajoute l'index EN FIN de sélection : la numérotation du PV suit l'ordre des clics (maquette).
  const basculerResolution = (indexResolution: number) =>
    // Pendant la rédaction, la sélection est figée (le projet attendu la concerne).
    !enCours &&
    setResolutionsSelectionnees((selection) =>
      selection.includes(indexResolution)
        ? selection.filter((index) => index !== indexResolution)
        : [...selection, indexResolution],
    )
  const projetPv = texteProjetPv(copropriete, resolutionsSelectionnees)
  const selection = JSON.stringify([copropriete, resolutionsSelectionnees])
  const pvAffiche = pvGenere?.selection === selection ? pvGenere.texte : null
  /** Sélection à l'écran au moment où la réponse arrive (la copropriété peut changer pendant l'attente). */
  const selectionCourante = useRef(selection)
  selectionCourante.current = selection

  const genererPv = async () => {
    if (enCours) return
    const resolutions = resolutionsSelectionnees.map((indexResolution) => RESOLUTIONS_PROJET_PV[indexResolution])
    if (!resolutions.length) {
      push({ kind: 'info', title: 'Aucune résolution', desc: 'Cochez au moins une résolution à porter au procès-verbal.' })
      return
    }
    const selectionDemandee = selection
    setEnCours(true)
    try {
      const texte = await demanderTexteOutilIA({
        tache: 'redaction-pv',
        copropriete,
        resolutions,
        dateDuJour: AUJOURDHUI_ISO,
        contexte: construireContextePv({ aujourdhui: AUJOURDHUI_ISO, mode: MODE_ACTIF, copropriete, copros }),
      })
      setPvGenere({ selection: selectionDemandee, texte })
      if (selectionCourante.current !== selectionDemandee) {
        push({ kind: 'info', title: 'Sélection modifiée', desc: 'Relancez « Générer le PV » pour la nouvelle sélection.' })
      } else {
        push({
          kind: 'success',
          title: 'Projet de PV rédigé',
          desc: 'À relire et à compléter (mentions [À COMPLÉTER]) avant signature.',
        })
      }
    } catch (erreur) {
      push({ kind: 'error', title: 'Rédaction impossible', desc: messageErreurOutilIA(erreur) })
    } finally {
      setEnCours(false)
    }
  }

  /** Copie le texte affiché : projet rédigé par l'IA (en texte brut, sans marques Markdown) ou, à défaut, la trame. */
  const copier = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Presse-papiers indisponible')
      await navigator.clipboard.writeText(pvAffiche ? markdownVersTexteBrut(pvAffiche) : projetPv)
      push({
        kind: 'success',
        title: 'Copié',
        desc: pvAffiche ? 'Projet de PV copié dans le presse-papiers.' : 'Trame du PV copiée dans le presse-papiers.',
      })
    } catch {
      // Presse-papiers absent (contexte non sécurisé) ou refusé par le navigateur.
      push({
        kind: 'error',
        title: 'Copie impossible',
        desc: "Le presse-papiers n'est pas accessible : sélectionnez le texte et copiez-le.",
      })
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Assistant · IA"
        title="Rédaction de procès-verbaux"
        lede="Génère un projet de PV d'assemblée à partir des résolutions (outil d'aide à la rédaction)."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: 16,
        }}
      >
        <Panel title="Paramètres" icon="pencil">
          <ChampCoproprieteDemo value={copropriete} onChange={setCopropriete} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--navy-300)',
              margin: '10px 0 6px',
            }}
          >
            Résolutions
          </div>
          {RESOLUTIONS_PROJET_PV.map((resolution, indexResolution) => (
            <div
              onClick={() => basculerResolution(indexResolution)}
              onKeyDown={surActivationClavier(() => basculerResolution(indexResolution))}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 4px',
                cursor: 'pointer',
                fontSize: 13,
              }}
              key={indexResolution}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid var(--line-strong)',
                  background: resolutionsSelectionnees.includes(indexResolution) ? 'var(--gold-500)' : 'transparent',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {resolutionsSelectionnees.includes(indexResolution) ? '✓' : ''}
              </span>
              {resolution}
            </div>
          ))}
        </Panel>
        <Panel
          title="Projet de PV"
          icon="doc"
          right={
            <button className="btn ghost sm" onClick={() => void copier()}>
              <Icon name="download" />
              Copier
            </button>
          }
        >
          {pvAffiche ? (
            <section
              aria-label="Projet de PV rédigé par l'IA"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--navy-700)',
                background: 'var(--cream)',
                padding: 16,
                borderRadius: 10,
                margin: 0,
              }}
            >
              <MarkdownIA texte={pvAffiche} />
            </section>
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--navy-700)',
                background: 'var(--cream)',
                padding: 16,
                borderRadius: 10,
                margin: 0,
              }}
            >
              {projetPv}
            </pre>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              marginTop: 12,
            }}
          >
            {enCours && (
              <span role="status" style={{ fontSize: 13, color: 'var(--navy-500)' }}>
                Rédaction du projet de PV en cours…
              </span>
            )}
            <button
              className="btn gold"
              onClick={() => void genererPv()}
              disabled={enCours}
              aria-busy={enCours || undefined}
              style={enCours ? STYLE_BOUTON_ATTENTE : undefined}
            >
              <Icon name="sparkle" />
              Générer le PV
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}
