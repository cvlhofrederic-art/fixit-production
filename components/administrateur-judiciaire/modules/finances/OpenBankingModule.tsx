'use client'

import { useState } from 'react'
import {
  DEMO_TRANSACTIONS_OPEN_BANKING,
  type TransactionOpenBanking,
} from '@/components/administrateur-judiciaire/data/open-banking'
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
 * Open banking (démonstration) : comptes séparés synchronisés et rapprochement des transactions. « Synchroniser » est
 * simulé ; les onglets sont autonomes (non branchés : seul « Comptes » est affiché). Indicateurs saisis en dur.
 */
export function OpenBankingModule() {
  const { push } = useToast()
  const [transactionOuverte, setTransactionOuverte] = useState<TransactionOpenBanking | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Open banking — rapprochement automatique"
        lede="Synchronisation des comptes séparés et rapprochement automatique des transactions."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'success',
                title: 'Simulation',
                desc: "Aucune synchronisation bancaire n'a eu lieu.",
              })
            }
          >
            <Icon name="arrow" />
            Synchroniser
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bank',
            num: 4,
            lbl: 'Comptes connectés',
            accent: 'sage',
          },
          {
            icon: 'arrow',
            num: 128,
            lbl: 'Transactions sync (mois)',
          },
          {
            icon: 'check',
            num: '96 %',
            lbl: 'Auto-rapprochées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: 1,
            lbl: 'À revoir',
            accent: 'amber',
          },
        ]}
      />
      <Tabs
        defaultActive="cpt"
        tabs={[
          {
            id: 'cpt',
            icon: 'bank',
            label: 'Comptes',
          },
          {
            id: 'sync',
            icon: 'arrow',
            label: 'Sync récente',
          },
          {
            id: 'rev',
            icon: 'alert',
            label: 'À revoir',
            badge: 1,
          },
        ]}
      />
      <Panel title="Transactions récentes" icon="bank" flush>
        <DataTable
          columns={[
            {
              h: 'Date',
              render: (transaction) => <span className="mono">{transaction[0]}</span>,
            },
            {
              h: 'Libellé',
              render: (transaction) => <b>{transaction[1]}</b>,
            },
            {
              h: 'Montant',
              render: (transaction) => (
                <span
                  className="mono"
                  style={{
                    color: transaction[2].startsWith('-') ? 'var(--rust-600)' : 'var(--sage-600)',
                  }}
                >
                  {transaction[2]}
                </span>
              ),
            },
            {
              h: 'Compte',
              render: (transaction) => (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--navy-500)',
                  }}
                >
                  {transaction[3]}
                </span>
              ),
            },
            {
              h: 'Rapprochement',
              render: (transaction) => (
                <Pill kind={transaction[4] === 'rapprochée' ? 'sage' : 'amber'} noDot>
                  {transaction[4]}
                </Pill>
              ),
            },
          ]}
          rows={DEMO_TRANSACTIONS_OPEN_BANKING}
          onRow={setTransactionOuverte}
        />
      </Panel>
      <DetailModal
        open={!!transactionOuverte}
        onClose={() => setTransactionOuverte(null)}
        title={transactionOuverte ? transactionOuverte[1] : ''}
        icon="bank"
        fields={
          transactionOuverte
            ? [
                {
                  k: 'Date',
                  v: transactionOuverte[0],
                },
                {
                  k: 'Montant',
                  v: transactionOuverte[2],
                },
                {
                  k: 'Compte',
                  v: transactionOuverte[3],
                },
                {
                  k: 'Rapprochement',
                  v: transactionOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
