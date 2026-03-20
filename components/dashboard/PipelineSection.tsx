'use client'

import React, { useState } from 'react'

interface PipelineSectionProps {
  artisan: any
  navigateTo: (page: string) => void
}

const PIPELINE_STAGES = [
  { id: 'draft', label: 'À envoyer', color: '#888' },
  { id: 'sent', label: 'Envoyé', color: '#2980b9' },
  { id: 'waiting', label: 'En attente', color: '#8A6000' },
  { id: 'signed', label: 'Signé', color: '#1A7A3C' },
  { id: 'building', label: 'Chantier', color: '#8e44ad' },
  { id: 'invoiced', label: 'Facturé', color: '#0D0D0D' },
  { id: 'paid', label: 'Payé', color: '#1A7A3C' },
]

const PIPELINE_ITEMS = [
  { ref: 'DEV-042', client: 'SCI Horizon', montant: 4800, stage: 'draft', service: 'VMC double flux' },
  { ref: 'DEV-041', client: 'T. Mercier', montant: 1840, stage: 'sent', service: 'Tableau électrique' },
  { ref: 'DEV-039', client: 'SCI Tilleuls', montant: 6200, stage: 'signed', service: 'Peinture appartement' },
  { ref: 'DEV-037', client: 'K. Bensaid', montant: 980, stage: 'waiting', service: 'Carrelage salle de bain' },
  { ref: 'DEV-035', client: 'M. Fontaine', montant: 320, stage: 'invoiced', service: 'Diagnostic fuite' },
  { ref: 'DEV-033', client: 'N. Rousseau', montant: 1450, stage: 'paid', service: 'Pose carrelage' },
  { ref: 'DEV-031', client: 'Foncia', montant: 5400, stage: 'building', service: 'Étanchéité terrasse' },
]

function formatEur(n: number) {
  return n.toLocaleString('fr-FR') + ' €'
}

export default function PipelineSection({ artisan, navigateTo }: PipelineSectionProps) {
  const [items] = useState(PIPELINE_ITEMS)

  function getStageItems(stageId: string) {
    return items.filter((i) => i.stage === stageId)
  }

  function getStageTotal(stageId: string) {
    return getStageItems(stageId).reduce((sum, i) => sum + i.montant, 0)
  }

  function handleCardClick(item: (typeof PIPELINE_ITEMS)[0]) {
    alert(`${item.ref} — ${item.client}\n${item.service}\n${formatEur(item.montant)}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v22-text)' }}>
            Pipeline
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--v22-text-muted)' }}>
            Suivi commercial de vos devis
          </p>
        </div>
        <button
          onClick={() => navigateTo('devis')}
          className="px-4 py-2 rounded-lg text-sm font-medium text-black transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--v22-yellow)' }}
        >
          + Nouveau devis
        </button>
      </div>

      {/* Kanban board */}
      <div
        className="grid grid-cols-7 gap-2.5 overflow-x-auto pb-2"
        style={{ minWidth: '900px' }}
      >
        {PIPELINE_STAGES.map((stage) => {
          const stageItems = getStageItems(stage.id)
          const total = getStageTotal(stage.id)

          return (
            <div
              key={stage.id}
              className="rounded-lg flex flex-col"
              style={{
                backgroundColor: 'var(--v22-surface)',
                border: '1px solid var(--v22-border)',
                minHeight: '320px',
              }}
            >
              {/* Column header */}
              <div
                className="rounded-t-lg px-3 py-2.5"
                style={{ borderTop: `3px solid ${stage.color}` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: stage.color }}
                  >
                    {stage.label}
                  </span>
                  <span
                    className="text-xs font-medium rounded-full px-1.5 py-0.5"
                    style={{
                      backgroundColor: 'var(--v22-bg)',
                      color: 'var(--v22-text-muted)',
                    }}
                  >
                    {stageItems.length}
                  </span>
                </div>
                {total > 0 && (
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--v22-text-muted)' }}>
                    {formatEur(total)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
                {stageItems.map((item) => (
                  <button
                    key={item.ref}
                    onClick={() => handleCardClick(item)}
                    className="w-full text-left rounded-md p-2.5 transition-shadow hover:shadow-md cursor-pointer"
                    style={{
                      backgroundColor: 'var(--v22-bg)',
                      border: '1px solid var(--v22-border)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[11px] font-mono font-medium"
                        style={{ color: 'var(--v22-text-muted)' }}
                      >
                        {item.ref}
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--v22-text)' }}
                      >
                        {formatEur(item.montant)}
                      </span>
                    </div>
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--v22-text)' }}
                    >
                      {item.client}
                    </p>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--v22-text-muted)' }}
                    >
                      {item.service}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
