'use client'

import { useState } from 'react'
import {
  DEMO_FACTURES_SAISIE_IA,
  PILL_PAR_STATUT_FACTURE_SAISIE,
  type FactureSaisieDemo,
} from '@/components/administrateur-judiciaire/data/saisie-factures'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Saisie de factures (barre latérale : section Outils IA, « Saisie IA factures » ; surtitre « Comptabilité &
 * finances »). Import simulé (formulaire sans lecture de fichier), onglets autonomes (« Importer » par défaut,
 * pastilles 1 sur « À valider » et « Anomalies »), liste des factures avec fiche détail.
 */
export function SaisieFacturesModule() {
  const { push } = useToast()
  const [factureOuverte, setFactureOuverte] = useState<FactureSaisieDemo | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Saisie de factures"
        lede="Import, ventilation comptable et validation des factures fournisseurs."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'folder',
                title: 'Importer des factures',
                fields: [
                  {
                    label: 'Copropriété',
                    type: 'select',
                    options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
                    full: true,
                  },
                  {
                    label: 'Format',
                    type: 'select',
                    options: ['PDF', 'Factur-X / e-facture', 'Photo'],
                    full: true,
                  },
                  {
                    label: 'Fichier',
                    placeholder: 'ex. factures_juin.pdf',
                    full: true,
                  },
                ],
                submitLabel: 'Importer',
                toast: {
                  title: 'Factures importées',
                  desc: 'Les factures ont été importées et pré-ventilées.',
                },
              })
            }
          >
            <Icon name="plus" />
            Importer des factures
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'doc',
            num: 4,
            lbl: 'Total factures',
          },
          {
            icon: 'clock',
            num: 1,
            lbl: 'À valider',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'Validées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: 1,
            lbl: 'Anomalies',
            accent: 'rust',
          },
        ]}
      />
      <Tabs
        defaultActive="imp"
        tabs={[
          {
            id: 'imp',
            icon: 'plus',
            label: 'Importer',
          },
          {
            id: 'att',
            icon: 'clock',
            label: 'À valider',
            badge: 1,
          },
          {
            id: 'trt',
            icon: 'check',
            label: 'Traitées',
          },
          {
            id: 'ano',
            icon: 'alert',
            label: 'Anomalies',
            badge: 1,
          },
        ]}
      />
      <Panel title="Factures" icon="doc" flush>
        <DataTable
          columns={[
            {
              h: 'Facture',
              render: (facture) => <span className="mono">{facture[0]}</span>,
            },
            {
              h: 'Fournisseur',
              render: (facture) => <b>{facture[1]}</b>,
            },
            {
              h: 'Montant',
              render: (facture) => <span className="mono">{facture[2]}</span>,
            },
            {
              h: 'Poste',
              render: (facture) => <Pill noDot>{facture[3]}</Pill>,
            },
            {
              h: 'Statut',
              render: (facture) => (
                <Pill kind={PILL_PAR_STATUT_FACTURE_SAISIE[facture[4]]} noDot>
                  {facture[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_FACTURES_SAISIE_IA}
          onRow={setFactureOuverte}
        />
      </Panel>
      <DetailModal
        open={!!factureOuverte}
        onClose={() => setFactureOuverte(null)}
        title={factureOuverte ? factureOuverte[1] : ''}
        icon="doc"
        fields={
          factureOuverte
            ? [
                {
                  k: 'N° facture',
                  v: factureOuverte[0],
                },
                {
                  k: 'Montant',
                  v: factureOuverte[2],
                },
                {
                  k: 'Poste comptable',
                  v: factureOuverte[3],
                },
                {
                  k: 'Statut',
                  v: factureOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
