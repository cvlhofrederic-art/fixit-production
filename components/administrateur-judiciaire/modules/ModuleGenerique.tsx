'use client'

import { Fragment, useState, type ComponentType, type ReactNode } from 'react'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable, type ColonneTableau } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal, type ChampFormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis, type KpiProps } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Écran de démonstration piloté par configuration. CODE MORT dans la maquette : aucune configuration n'est déclarée
 * (CONFIGS_MODULES_GENERIQUES est vide), la fabrique est conservée pour la fidélité du registre.
 */

/** Fiche détail ouverte depuis une ligne de liste ou de tableau. */
export interface DetailGenerique {
  title?: ReactNode
  icon?: string
  fields?: readonly ChampDetail[]
  footnote?: ReactNode
}

/** Ligne de tableau d'un écran générique. */
export type LigneGenerique = Record<string, unknown>

/** Élément d'un panneau « list » : sans détail, un clic affiche un toast info (titre + meta). */
export interface ElementListeGenerique {
  title: ReactNode
  meta?: ReactNode
  /** Morceaux de la ligne meta, séparés par des points ; à défaut, [meta]. */
  metaParts?: readonly ReactNode[]
  thumb?: ReactNode
  pill?: ReactNode
  pillKind?: string
  detail?: DetailGenerique
}

export interface PanneauAlerteGenerique {
  kind: 'alert'
  /** Variante de l'alerte. */
  k?: string
  icon?: string
  title?: ReactNode
  text?: ReactNode
}

export interface PanneauNoeudGenerique {
  kind: 'node'
  title?: ReactNode
  sub?: ReactNode
  icon?: string
  right?: ReactNode
  node?: ReactNode
}

export interface PanneauListeGenerique {
  kind: 'list'
  title?: ReactNode
  sub?: ReactNode
  icon?: string
  items: readonly ElementListeGenerique[]
}

/** Panneau par défaut (toute autre valeur de kind) : tableau de données. */
export interface PanneauTableauGenerique {
  kind?: 'table'
  title?: ReactNode
  sub?: ReactNode
  icon?: string
  right?: ReactNode
  columns: readonly ColonneTableau<LigneGenerique>[]
  rows: readonly LigneGenerique[]
  rowKey?: keyof LigneGenerique
  /** Si fourni, les lignes ouvrent la fiche détail renvoyée. */
  detail?: (ligne: LigneGenerique) => DetailGenerique
}

export type PanneauGenerique =
  | PanneauAlerteGenerique
  | PanneauNoeudGenerique
  | PanneauListeGenerique
  | PanneauTableauGenerique

/** Action principale : bouton doré ouvrant un FormModal de simulation. */
export interface ActionPrincipaleGenerique {
  label: ReactNode
  /** « plus » par défaut. */
  icon?: string
  /** Titre du formulaire ; le libellé à défaut. */
  title?: ReactNode
  fields?: readonly ChampFormModal[]
  /** « Valider » par défaut. */
  submitLabel?: ReactNode
  /** Suffixe du titre du toast « Simulation — … » (« Enregistré » par défaut). */
  success?: string
  successDesc?: ReactNode
}

export interface ConfigModuleGenerique {
  eyebrow?: ReactNode
  title?: ReactNode
  lede?: ReactNode
  /** false masque le bouton « Exporter ». */
  secondary?: boolean
  primary?: ActionPrincipaleGenerique
  kpis?: readonly KpiProps[]
  panels?: readonly PanneauGenerique[]
}

/** Fabrique un écran générique à partir de sa configuration. */
export function creerModuleGenerique(config: ConfigModuleGenerique): ComponentType {
  function ModuleGenerique() {
    const { push } = useToast()
    const [detail, setDetail] = useState<DetailGenerique | null>(null)
    const [formulaireOuvert, setFormulaireOuvert] = useState(false)
    const actionPrincipale = config.primary

    const boutonExporter = (
      <button
        className="btn"
        onClick={() =>
          push({
            kind: 'doc',
            icon: 'download',
            title: 'Export de données',
            eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
            docTitle: "Récapitulatif d'export",
            meta: 'Généré le 19/06/2026 · CSV / XLSX',
            lines: [
              "L'export contient l'ensemble des données du module sur la période sélectionnée.",
              {
                h: 'Contenu',
              },
              {
                k: 'Lignes',
                v: '248',
              },
              {
                k: 'Période',
                v: '01/01/2026 — 19/06/2026',
              },
              {
                k: 'Format',
                v: 'CSV (UTF-8) et XLSX',
              },
            ],
          })
        }
      >
        <Icon name="download" />
        Exporter
      </button>
    )

    const actions = (
      <>
        {config.secondary !== false && boutonExporter}
        {actionPrincipale && (
          <button className="btn gold" onClick={() => setFormulaireOuvert(true)}>
            <Icon name={actionPrincipale.icon || 'plus'} />
            {actionPrincipale.label}
          </button>
        )}
      </>
    )

    const rendrePanneau = (panneau: PanneauGenerique, index: number) => {
      if (panneau.kind === 'alert')
        return (
          <Alert kind={panneau.k} icon={panneau.icon} title={panneau.title} key={index}>
            {panneau.text}
          </Alert>
        )
      if (panneau.kind === 'node')
        return (
          <Panel title={panneau.title} sub={panneau.sub} icon={panneau.icon} right={panneau.right} key={index}>
            {panneau.node}
          </Panel>
        )
      if (panneau.kind === 'list')
        return (
          <Panel title={panneau.title} sub={panneau.sub} icon={panneau.icon} flush key={index}>
            {panneau.items.map((element, indexElement) => (
              <div
                className="list-row"
                onClick={() =>
                  element.detail
                    ? setDetail(element.detail)
                    : push({
                        kind: 'info',
                        title: element.title,
                        desc: element.meta,
                      })
                }
                key={indexElement}
              >
                <div className="thumb">{element.thumb}</div>
                <div className="info">
                  <b>{element.title}</b>
                  <div className="meta">
                    {(element.metaParts || [element.meta]).map((morceau, indexMorceau) => (
                      <Fragment key={indexMorceau}>
                        {indexMorceau > 0 && <span className="dot" />}
                        <span>{morceau}</span>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div />
                {element.pill && <Pill kind={element.pillKind}>{element.pill}</Pill>}
              </div>
            ))}
          </Panel>
        )
      // Toute autre valeur de kind : tableau de données.
      const detailLigne = panneau.detail
      return (
        <Panel title={panneau.title} sub={panneau.sub} icon={panneau.icon} right={panneau.right} flush key={index}>
          <DataTable
            columns={panneau.columns}
            rows={panneau.rows}
            rowKey={panneau.rowKey}
            onRow={detailLigne ? (ligne) => setDetail(detailLigne(ligne)) : undefined}
          />
        </Panel>
      )
    }

    return (
      <>
        <PageHead eyebrow={config.eyebrow} title={config.title} lede={config.lede} actions={actions} />
        {config.kpis && <Kpis items={config.kpis} />}
        {(config.panels || []).map(rendrePanneau)}
        {actionPrincipale && (
          <FormModal
            open={formulaireOuvert}
            onClose={() => setFormulaireOuvert(false)}
            title={actionPrincipale.title || actionPrincipale.label}
            icon={actionPrincipale.icon}
            fields={actionPrincipale.fields || []}
            submitLabel={actionPrincipale.submitLabel || 'Valider'}
            onDone={() =>
              push({
                kind: 'success',
                title: 'Simulation — ' + (actionPrincipale.success || 'Enregistré'),
                desc: actionPrincipale.successDesc || "Aucune donnée n'est enregistrée dans cette version.",
              })
            }
          />
        )}
        <DetailModal
          open={!!detail}
          onClose={() => setDetail(null)}
          title={detail?.title}
          icon={detail?.icon}
          fields={detail?.fields || []}
          footnote={detail?.footnote}
        />
      </>
    )
  }
  ModuleGenerique.displayName = 'ModuleGenerique'
  return ModuleGenerique
}
