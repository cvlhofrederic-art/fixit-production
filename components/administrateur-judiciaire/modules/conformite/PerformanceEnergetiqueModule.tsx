'use client'

import { DEMO_DPE_COPROPRIETES, ECHELLE_ETIQUETTES_DPE } from '@/components/administrateur-judiciaire/data/dpe'
import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { classeDpeMoyenne } from '@/lib/administrateur-judiciaire/domain/patrimoine-copropriete'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Copropriété de l'audit de démonstration, sans copropriété choisie (écran rendu seul). */
const AUDIT_DEMO = 'Résidence Le Méridien · 36 lots'

/** Classes F et G : « passoires » énergétiques (loi Climat & Résilience). */
const estPassoire = (classe: string): boolean => classe === 'F' || classe === 'G'

/**
 * Performance énergétique (DPE collectif et audit, loi Climat & Résilience), écran de démonstration affiché selon la
 * copropriété choisie dans le sélecteur du haut de page : tableau filtré, indicateurs calculés sur lui (étiquette de la
 * copropriété au lieu de l'étiquette moyenne du parc), audit au nom de la copropriété avec sa classe (le reste de
 * l'audit reste celui de la démonstration). Sans copropriété choisie (écran rendu seul) : tout le parc (« D », 4, 1, 1)
 * et l'audit de Résidence Le Méridien. Tableau sans fiche détail ; l'audit est un document généré (simulé).
 */
export function PerformanceEnergetiqueModule() {
  const { push } = useToast()
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const dpes = filtrerParCopro(DEMO_DPE_COPROPRIETES, code, (dpe) => codeDeNomCopro(dpe[0]))
  const classeAffichee = classeDpeMoyenne(dpes.map((dpe) => dpe[1])) ?? '—'

  return (
    <>
      <PageHead
        eyebrow="Conformité · Loi Climat & Résilience"
        title="Performance énergétique (DPE)"
        lede="DPE collectif et audit énergétique des copropriétés sous mandat (étiquettes A à G)."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'sparkle',
                title: 'Audit énergétique',
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: 'Audit énergétique du bâtiment',
                meta: code ? `${copro.nom} · ${copro.lots} lots` : AUDIT_DEMO,
                lines: [
                  {
                    h: 'Résultats',
                  },
                  {
                    k: 'Classe énergétique (DPE collectif)',
                    v: code ? classeAffichee : 'D',
                  },
                  {
                    k: 'Consommation',
                    v: '186 kWh/m²/an',
                  },
                  {
                    k: 'Émissions GES',
                    v: 'E',
                  },
                  {
                    h: 'Préconisations',
                  },
                  {
                    li: 'Isolation de la toiture-terrasse',
                  },
                  {
                    li: 'Remplacement de la chaudière collective',
                  },
                  {
                    li: 'Inscription au plan pluriannuel de travaux (loi Climat art. 14-2)',
                  },
                ],
              })
            }
          >
            <Icon name="bolt" />
            Audit énergétique
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bolt',
            num: classeAffichee,
            lbl: code ? 'Étiquette de la copropriété' : 'Étiquette moyenne du parc',
            accent: 'gold',
          },
          {
            icon: 'building',
            num: dpes.length,
            lbl: 'DPE collectifs',
          },
          {
            icon: 'alert',
            num: dpes.filter((dpe) => estPassoire(dpe[1])).length,
            lbl: 'Passoire (F/G)',
            accent: 'rust',
          },
          {
            icon: 'clipboard',
            num: dpes.filter((dpe) => dpe[3] === 'amber').length,
            lbl: 'Audit recommandé',
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Échelle des étiquettes énergétiques" icon="bolt">
        <div className="card-grid cols-4">
          {ECHELLE_ETIQUETTES_DPE.map(([classe, teinte], index) => (
            <CarteCritere
              titre={`Classe ${classe}`}
              detail={classe === 'A' ? 'Très performant' : classe === 'G' ? 'Très énergivore' : '—'}
              teinte={teinte}
              key={index}
            />
          ))}
        </div>
      </Panel>
      <Panel title="DPE par copropriété" icon="building" flush>
        {dpes.length === 0 ? (
          <EmptyState icon="bolt" title={`Aucun DPE pour ${copro.nom}`} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Copropriété',
                render: (dpe) => <b>{dpe[0]}</b>,
              },
              {
                h: 'Étiquette',
                render: (dpe) => (
                  <Pill kind={dpe[3]} noDot>
                    {'Classe '}
                    {dpe[1]}
                  </Pill>
                ),
              },
              {
                h: 'Statut',
                render: (dpe) => dpe[2],
              },
            ]}
            rows={dpes}
          />
        )}
      </Panel>
    </>
  )
}
