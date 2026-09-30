'use client'

import { DEMO_DPE_COPROPRIETES, ECHELLE_ETIQUETTES_DPE } from '@/components/administrateur-judiciaire/data/dpe'
import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Performance énergétique (DPE collectif et audit, loi Climat & Résilience), écran de démonstration : indicateurs en dur
 * (« D », 4, 1, 1), tableau sans fiche détail. L'audit énergétique est un document généré (simulé).
 */
export function PerformanceEnergetiqueModule() {
  const { push } = useToast()

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
                meta: 'Résidence Le Méridien · 36 lots',
                lines: [
                  {
                    h: 'Résultats',
                  },
                  {
                    k: 'Classe énergétique (DPE collectif)',
                    v: 'D',
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
            num: 'D',
            lbl: 'Étiquette moyenne du parc',
            accent: 'gold',
          },
          {
            icon: 'building',
            num: 4,
            lbl: 'DPE collectifs',
          },
          {
            icon: 'alert',
            num: 1,
            lbl: 'Passoire (F/G)',
            accent: 'rust',
          },
          {
            icon: 'clipboard',
            num: 1,
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
          rows={DEMO_DPE_COPROPRIETES}
        />
      </Panel>
    </>
  )
}
