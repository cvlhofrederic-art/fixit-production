'use client'

import React, { useState, useEffect } from 'react'
import type { Artisan, SavedDocument } from '@/lib/types'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PipelineSectionProps {
  artisan: Artisan
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
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
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

function computeStage(doc: SavedDocument, isDraft: boolean): string {
  if (isDraft) return 'draft'
  if (doc.signatureData) return 'signed'
  if (doc.status === 'envoye') return 'sent'
  return 'draft'
}

export default function PipelineSection({ artisan, orgRole = 'artisan', navigateTo }: PipelineSectionProps) {
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'

  const stages = getStages(orgRole)

  useEffect(() => {
    if (!artisan?.id) return
    try {
      const docs: SavedDocument[]   = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
      const drafts: SavedDocument[] = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')

      // Devis documents (saved + drafts)
      const devisDocs = docs.filter((d: SavedDocument) => d.docType === 'devis' || !d.docType)
      const draftDocs = drafts.filter((d: SavedDocument) => d.docType === 'devis' || !d.docType)

      // Factures → invoiced stage
      const factureDocs = docs.filter((d: SavedDocument) => d.docType === 'facture')

      const mapped: PipelineItem[] = [
        ...devisDocs.map((d: SavedDocument) => ({
          ref:     d.docNumber || '—',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: { totalHT?: number; total?: number }) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   computeStage(d, false),
          service: d.title || d.description || d.lines?.[0]?.description || 'Prestation',
        })),
        ...draftDocs.map((d: SavedDocument) => ({
          ref:     d.docNumber || 'Brouillon',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: { totalHT?: number; total?: number }) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   'draft',
          service: d.title || d.description || d.lines?.[0]?.description || 'Prestation',
        })),
        ...factureDocs.map((d: SavedDocument) => ({
          ref:     d.docNumber || '—',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: { totalHT?: number; total?: number }) => s + (l.totalHT || l.total || 0), 0) || 0,
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
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', ...(!isV5 ? { marginBottom: 24 } : {}) }}>
        <div>
          <h1 style={!isV5 ? { fontSize: 20, fontWeight: 700, marginBottom: 4 } : undefined}>Pipeline commercial</h1>
          <p style={!isV5 ? { fontSize: 13, color: '#888' } : undefined}>
            {orgRole === 'pro_societe'
              ? `${items.length} affaire${items.length > 1 ? 's' : ''} \u2014 ${formatEur(totalPipeline)} HT`
              : `Suivi des opportunit\u00e9s \u2014 ${formatEur(totalPipeline)} HT`}
          </p>
        </div>
        <button
          className={isV5 ? 'v5-btn v5-btn-p' : ''}
          style={!isV5 ? { background: '#1A7A3C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' } : undefined}
          onClick={() => navigateTo('devis')}
        >
          {orgRole === 'pro_societe' ? '+ Nouvelle affaire' : '+ Nouveau devis'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#999', fontSize: 12 }}>
          Chargement du pipeline...
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className={isV5 ? 'v5-card' : ''} style={{ textAlign: 'center', padding: '3rem 1.5rem', ...(!isV5 ? { background: '#fff', borderRadius: 12, border: '1px solid #eee' } : {}) }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'\uD83D\uDCCB'}</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {orgRole === 'pro_societe' ? 'Aucune affaire dans le pipeline' : 'Aucun devis dans le pipeline'}
          </div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            Cr\u00e9ez votre premier devis pour l&apos;afficher ici
          </p>
          <button
            className={isV5 ? 'v5-btn v5-btn-p' : ''}
            style={!isV5 ? { background: '#1A7A3C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' } : undefined}
            onClick={() => navigateTo('devis')}
          >
            {orgRole === 'pro_societe' ? 'Cr\u00e9er une affaire' : 'Cr\u00e9er un devis'}
          </button>
        </div>
      )}

      {/* Kanban board */}
      {!loading && items.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div
            className={isV5 ? 'v5-kanban' : ''}
            style={{ display: 'grid', minWidth: '980px', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: isV5 ? undefined : 12 }}
          >
            {stages.map((stage) => {
              const stageItems = getStageItems(stage.id)
              const total = getStageTotal(stage.id)

              return (
                <div
                  key={stage.id}
                  className={isV5 ? 'v5-kb-col' : ''}
                  style={!isV5 ? { background: '#fafafa', borderRadius: 10, padding: 12, minHeight: 120 } : undefined}
                >
                  {/* Column header */}
                  <div className={isV5 ? 'v5-kb-col-t' : ''} style={!isV5 ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontWeight: 600, fontSize: 12 } : undefined}>
                    <span>{stage.label}</span>
                    <span className={isV5 ? 'v5-kb-tot' : ''} style={!isV5 ? { background: '#eee', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 500 } : undefined}>{stageItems.length}</span>
                  </div>
                  {total > 0 && (
                    <div style={{ fontSize: 10, color: '#BBB', marginTop: -6, marginBottom: 8 }}>
                      {formatEur(total)}
                    </div>
                  )}

                  {/* Cards */}
                  {stageItems.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#BBB', fontSize: 11, paddingTop: 24 }}>{'\u2014'}</div>
                  )}
                  {stageItems.map((item, idx) => (
                    <div
                      key={`${item.ref}-${idx}`}
                      className={isV5 ? 'v5-kb-card' : ''}
                      style={!isV5 ? { background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #eee', cursor: 'pointer' } : undefined}
                      onClick={() => navigateTo('devis')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && navigateTo('devis')}
                    >
                      <div className={isV5 ? 'v5-kb-nm' : ''} style={!isV5 ? { fontWeight: 600, fontSize: 13, marginBottom: 2 } : undefined}>{item.client}</div>
                      <div className={isV5 ? 'v5-kb-info' : ''} style={!isV5 ? { fontSize: 11, color: '#888', marginBottom: 4 } : undefined}>{item.service}</div>
                      <div className={isV5 ? 'v5-kb-amt' : ''} style={!isV5 ? { fontSize: 12, fontWeight: 600, color: '#1A7A3C' } : undefined}>{formatEur(item.montant)}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
