'use client'

import React, { useState, useEffect } from 'react'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PipelineSectionProps {
  artisan: any
  orgRole?: OrgRole
  navigateTo: (page: string) => void
}

interface PipelineItem {
  ref: string
  client: string
  montant: number
  stage: string
  service: string
}

// Labels adaptés selon le rôle
function getStages(orgRole: OrgRole) {
  const isSociete = orgRole === 'pro_societe'
  return [
    { id: 'draft',    label: 'À envoyer',                    color: '#888' },
    { id: 'sent',     label: 'Envoyé',                       color: '#2980b9' },
    { id: 'waiting',  label: 'En attente',                   color: '#8A6000' },
    { id: 'signed',   label: isSociete ? 'Commande signée' : 'Signé', color: '#1A7A3C' },
    { id: 'building', label: isSociete ? 'Chantier en cours' : 'Chantier', color: '#8e44ad' },
    { id: 'invoiced', label: isSociete ? 'Situation / Facture' : 'Facturé', color: '#0D0D0D' },
    { id: 'paid',     label: 'Payé',                         color: '#1A7A3C' },
  ]
}

function formatEur(n: number) {
  return n.toLocaleString('fr-FR') + ' €'
}

function computeStage(doc: any, isDraft: boolean): string {
  if (isDraft) return 'draft'
  if (doc.signatureData) return 'signed'
  if (doc.status === 'envoye') return 'sent'
  return 'draft'
}

export default function PipelineSection({ artisan, orgRole = 'artisan', navigateTo }: PipelineSectionProps) {
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const stages = getStages(orgRole)

  useEffect(() => {
    if (!artisan?.id) return
    try {
      const docs: any[]   = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
      const drafts: any[] = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')

      // Devis documents (saved + drafts)
      const devisDocs = docs.filter((d: any) => d.docType === 'devis' || !d.docType)
      const draftDocs = drafts.filter((d: any) => d.docType === 'devis' || !d.docType)

      // Factures → invoiced stage
      const factureDocs = docs.filter((d: any) => d.docType === 'facture')

      const mapped: PipelineItem[] = [
        ...devisDocs.map((d: any) => ({
          ref:     d.docNumber || '—',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: any) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   computeStage(d, false),
          service: d.title || d.description || d.lines?.[0]?.description || 'Prestation',
        })),
        ...draftDocs.map((d: any) => ({
          ref:     d.docNumber || 'Brouillon',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: any) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   'draft',
          service: d.title || d.description || d.lines?.[0]?.description || 'Prestation',
        })),
        ...factureDocs.map((d: any) => ({
          ref:     d.docNumber || '—',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: any) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   'invoiced',
          service: d.title || d.description || d.lines?.[0]?.description || 'Prestation',
        })),
      ]

      // Dédupliquer par ref (un devis converti en facture ne doit pas apparaître deux fois en draft)
      const seen = new Set<string>()
      const deduped = mapped.filter(item => {
        const key = `${item.ref}-${item.stage}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setItems(deduped)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [artisan?.id])

  function getStageItems(stageId: string) {
    return items.filter((i) => i.stage === stageId)
  }

  function getStageTotal(stageId: string) {
    return getStageItems(stageId).reduce((sum, i) => sum + i.montant, 0)
  }

  const totalPipeline = items.reduce((s, i) => s + i.montant, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--v22-text)' }}>
            Pipeline commercial
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--v22-text-muted)' }}>
            {orgRole === 'pro_societe'
              ? `${items.length} affaire${items.length > 1 ? 's' : ''} — ${formatEur(totalPipeline)} HT`
              : `Suivi commercial de vos devis — ${formatEur(totalPipeline)} HT`}
          </p>
        </div>
        <button
          onClick={() => navigateTo('devis')}
          className="px-4 py-2 rounded-lg text-sm font-medium text-black transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--v22-yellow)' }}
        >
          {orgRole === 'pro_societe' ? '+ Nouvelle affaire' : '+ Nouveau devis'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12" style={{ color: 'var(--v22-text-muted)' }}>
          Chargement du pipeline…
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 v22-card">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium" style={{ color: 'var(--v22-text)' }}>
            {orgRole === 'pro_societe' ? 'Aucune affaire dans le pipeline' : 'Aucun devis dans le pipeline'}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--v22-text-muted)' }}>
            Créez votre premier devis pour l&apos;afficher ici
          </p>
          <button
            onClick={() => navigateTo('devis')}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-black"
            style={{ backgroundColor: 'var(--v22-yellow)' }}
          >
            {orgRole === 'pro_societe' ? 'Créer une affaire' : 'Créer un devis'}
          </button>
        </div>
      )}

      {/* Kanban board */}
      {!loading && items.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div
            className="grid gap-2.5"
            style={{ minWidth: '980px', gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
          >
            {stages.map((stage) => {
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
                    {stageItems.length === 0 && (
                      <p className="text-xs text-center mt-6" style={{ color: 'var(--v22-text-muted)' }}>—</p>
                    )}
                    {stageItems.map((item, idx) => (
                      <button
                        key={`${item.ref}-${idx}`}
                        onClick={() => navigateTo('devis')}
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
      )}
    </div>
  )
}
