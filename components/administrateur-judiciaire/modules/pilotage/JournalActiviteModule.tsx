'use client'

import { useState } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

/** Entrée du journal d'activité : horodatage « JJ/MM/AAAA HH:MM », auteur, acte. */
export interface EntreeJournalActivite {
  dt: string
  who: string
  act: string
}

/** Journal de démonstration par code de copropriété (ordre antéchronologique) ; autre code → journal vide. */
export const JOURNAL_ACTIVITE_DEMO: Record<string, EntreeJournalActivite[]> = {
  LM: [
    {
      dt: '04/06/2026 09:12',
      who: 'A. Diallo',
      act: "Validation de l'ordre de service OS-2026-051",
    },
    {
      dt: '03/06/2026 16:40',
      who: 'J. Marchand',
      act: 'Rapprochement bancaire du compte séparé',
    },
    {
      dt: '01/06/2026 11:05',
      who: 'C. Noël',
      act: 'Dépôt de la requête en taxation des honoraires',
    },
    {
      dt: '24/05/2026 10:22',
      who: 'Secrétariat',
      act: "Notification du PV de l'AG (LRAR, 40 destinataires)",
    },
    {
      dt: '18/05/2026 18:30',
      who: 'Cabinet Delaunay',
      act: "Tenue de l'assemblée générale",
    },
  ],
  CV: [
    {
      dt: '02/06/2026 14:10',
      who: 'A. Diallo',
      act: "Création de l'OS fuite colonne EU",
    },
    {
      dt: '28/05/2026 09:00',
      who: 'C. Noël',
      act: 'Préparation de la convocation AG élective',
    },
  ],
  TL: [
    {
      dt: '02/06/2026 15:30',
      who: 'C. Noël',
      act: 'Signification de la mise en demeure — SCI Belvédère',
    },
    {
      dt: '21/05/2026 17:00',
      who: 'J. Marchand',
      act: "Mise à jour du plan d'apurement des créanciers",
    },
  ],
  VM: [
    {
      dt: '28/05/2026 10:00',
      who: 'Secrétariat',
      act: "Préparation de la notification d'ordonnance",
    },
  ],
}

/**
 * Journal d'activité du mandat (statut partiel) : actes horodatés de la copropriété choisie (données de
 * démonstration). Le bouton « Exporter le journal » ouvre, comme dans la maquette, l'export du journal COMPTABLE
 * (chiffres figés), et non celui du journal d'activité.
 */
export function JournalActiviteModule() {
  const { push } = useToast()
  const [code, setCode] = useState(() => codeCoproSelectionne('LM'))
  const entrees = JOURNAL_ACTIVITE_DEMO[code] || []
  const copro = useCoproParCode(code)
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Journal d'activité"
        lede="Auxiliaire de justice, l'administrateur doit pouvoir rendre compte de chaque acte. Journal horodaté et exportable : qui a fait quoi, et quand — pour la reddition et tout contentieux."
        actions={
          <>
            <SelecteurCopropriete value={code} onChange={setCode} />
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'download',
                  title: 'Export du journal comptable',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: 'Journal comptable',
                  meta: 'Exercice 2026',
                  lines: [
                    {
                      h: 'Contenu',
                    },
                    {
                      k: 'Écritures',
                      v: '312',
                    },
                    {
                      k: 'Total débit',
                      v: '307 600 €',
                    },
                    {
                      k: 'Format',
                      v: 'FEC / XLSX',
                    },
                  ],
                })
              }
            >
              <Icon name="download" />
              Exporter le journal
            </button>
          </>
        }
      />
      <Panel title={`Journal — ${copro.nom}`} sub="Horodatage automatique · ordre antéchronologique" icon="clock" flush>
        {entrees.map((entree, index) => (
          <div
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 22px',
              borderBottom: '1px solid var(--line)',
              alignItems: 'center',
            }}
            key={index}
          >
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                color: 'var(--navy-500)',
                width: 128,
                flexShrink: 0,
              }}
            >
              {entree.dt}
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--sage-500)',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                }}
              >
                {entree.act}
              </div>
            </div>
            <Pill kind="navy" noDot>
              {entree.who}
            </Pill>
          </div>
        ))}
      </Panel>
    </>
  )
}
