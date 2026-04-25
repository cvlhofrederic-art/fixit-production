'use client'

import React, { useState, useEffect } from 'react'
import type { Artisan, SavedDocument } from '@/lib/types'
import { useLocale } from '@/lib/i18n/context'

type OrgRole = 'artisan' | 'pro_societe' | 'pro_conciergerie' | 'pro_gestionnaire'

interface PipelineSectionProps {
  artisan: Artisan
  orgRole?: OrgRole
  navigateTo: (page: string) => void
  savedDocuments?: SavedDocument[]
}

interface PipelineItem {
  ref: string
  client: string
  montant: number
  stage: string
  service: string
}

// Labels adaptés selon le rôle et la locale
function getStages(orgRole: OrgRole, isPt: boolean) {
  const isSociete = orgRole === 'pro_societe' || orgRole === 'artisan'
  return [
    { id: 'draft',    label: isPt ? 'Para enviar' : 'À envoyer',                    color: '#888' },
    { id: 'sent',     label: isPt ? 'Enviado' : 'Envoyé',                       color: '#2980b9' },
    { id: 'waiting',  label: isPt ? 'Em espera' : 'En attente',                   color: '#8A6000' },
    { id: 'signed',   label: isPt ? (isSociete ? 'Pedido assinado' : 'Assinado') : (isSociete ? 'Commande signée' : 'Signé'), color: '#1A7A3C' },
    { id: 'building', label: isPt ? (isSociete ? 'Obra em curso' : 'Obra') : (isSociete ? 'Chantier en cours' : 'Chantier'), color: '#8e44ad' },
    { id: 'invoiced', label: isPt ? (isSociete ? 'Situação / Fatura' : 'Faturado') : (isSociete ? 'Situation / Facture' : 'Facturé'), color: '#0D0D0D' },
    { id: 'paid',     label: isPt ? 'Pago' : 'Payé',                         color: '#1A7A3C' },
  ]
}

function formatEur(n: number, isPt: boolean) {
  return n.toLocaleString(isPt ? 'pt-PT' : 'fr-FR') + ' €'
}

function computeStage(doc: SavedDocument, isDraft: boolean): string {
  if (isDraft) return 'draft'
  if (doc.signatureData) return 'signed'
  if (doc.status === 'envoye') return 'sent'
  return 'draft'
}

export default function PipelineSection({ artisan, orgRole = 'artisan', navigateTo, savedDocuments: propDocs }: PipelineSectionProps) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)

  const stages = getStages(orgRole, isPt)

  useEffect(() => {
    if (!artisan?.id) return
    try {
      // Use prop data (merged Supabase+localStorage) if available, fallback to localStorage
      const allDocs: SavedDocument[] = propDocs && propDocs.length > 0
        ? propDocs
        : [
            ...JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]'),
            ...JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]'),
          ]
      const docs: SavedDocument[] = allDocs.filter((d: SavedDocument) => d.status !== 'brouillon')
      const drafts: SavedDocument[] = allDocs.filter((d: SavedDocument) => d.status === 'brouillon' || !(d as unknown as Record<string, unknown>).savedAt)

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
          service: d.title || d.description || d.lines?.[0]?.description || (isPt ? 'Serviço' : 'Prestation'),
        })),
        ...draftDocs.map((d: SavedDocument) => ({
          ref:     d.docNumber || (isPt ? 'Rascunho' : 'Brouillon'),
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: { totalHT?: number; total?: number }) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   'draft',
          service: d.title || d.description || d.lines?.[0]?.description || (isPt ? 'Serviço' : 'Prestation'),
        })),
        ...factureDocs.map((d: SavedDocument) => ({
          ref:     d.docNumber || '—',
          client:  d.clientName || d.client_name || 'Client',
          montant: d.lines?.reduce((s: number, l: { totalHT?: number; total?: number }) => s + (l.totalHT || l.total || 0), 0) || 0,
          stage:   'invoiced',
          service: d.title || d.description || d.lines?.[0]?.description || (isPt ? 'Serviço' : 'Prestation'),
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
  }, [artisan?.id, isPt, propDocs])

  function getStageItems(stageId: string) {
    return items.filter((i) => i.stage === stageId)
  }

  function getStageTotal(stageId: string) {
    return getStageItems(stageId).reduce((sum, i) => sum + i.montant, 0)
  }

  const totalPipeline = items.reduce((s, i) => s + i.montant, 0)

  return (
    <div className="v5-fade">
      {/* Header */}
      <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{isPt ? 'Pipeline comercial' : 'Pipeline commercial'}</h1>
          <p>
            {orgRole === 'pro_societe'
              ? (isPt
                  ? `${items.length} negócio${items.length > 1 ? 's' : ''} — ${formatEur(totalPipeline, isPt)} s/ IVA`
                  : `${items.length} affaire${items.length > 1 ? 's' : ''} — ${formatEur(totalPipeline, isPt)} HT`)
              : (isPt
                  ? `Acompanhamento de oportunidades — ${formatEur(totalPipeline, isPt)} s/ IVA`
                  : `Suivi des opportunités — ${formatEur(totalPipeline, isPt)} HT`)}
          </p>
        </div>
        <button
          className="v5-btn v5-btn-p"
          onClick={() => navigateTo('devis')}
        >
          {orgRole === 'pro_societe'
            ? (isPt ? '+ Novo negócio' : '+ Nouvelle affaire')
            : (isPt ? '+ Novo orçamento' : '+ Nouveau devis')}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#999', fontSize: 12 }}>
          {isPt ? 'A carregar o pipeline...' : 'Chargement du pipeline...'}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="v5-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'\uD83D\uDCCB'}</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {orgRole === 'pro_societe'
              ? (isPt ? 'Nenhum negócio no pipeline' : 'Aucune affaire dans le pipeline')
              : (isPt ? 'Nenhum orçamento no pipeline' : 'Aucun devis dans le pipeline')}
          </div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            {isPt ? 'Crie o seu primeiro orçamento para o ver aqui' : 'Créez votre premier devis pour l\u2019afficher ici'}
          </p>
          <button
            className="v5-btn v5-btn-p"
            onClick={() => navigateTo('devis')}
          >
            {orgRole === 'pro_societe'
              ? (isPt ? 'Criar negócio' : 'Créer une affaire')
              : (isPt ? 'Criar orçamento' : 'Créer un devis')}
          </button>
        </div>
      )}

      {/* Kanban board */}
      {!loading && items.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div
            className="v5-kanban"
            style={{ display: 'grid', minWidth: '980px', gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
          >
            {stages.map((stage) => {
              const stageItems = getStageItems(stage.id)
              const total = getStageTotal(stage.id)

              return (
                <div
                  key={stage.id}
                  className="v5-kb-col"
                >
                  {/* Column header */}
                  <div className="v5-kb-col-t">
                    <span>{stage.label}</span>
                    <span className="v5-kb-tot">{stageItems.length}</span>
                  </div>
                  {total > 0 && (
                    <div style={{ fontSize: 10, color: '#BBB', marginTop: -6, marginBottom: 8 }}>
                      {formatEur(total, isPt)}
                    </div>
                  )}

                  {/* Cards */}
                  {stageItems.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#BBB', fontSize: 11, paddingTop: 24 }}>{'—'}</div>
                  )}
                  {stageItems.map((item, idx) => (
                    <div
                      key={`${item.ref}-${idx}`}
                      className="v5-kb-card"
                      onClick={() => navigateTo('devis')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && navigateTo('devis')}
                    >
                      <div className="v5-kb-nm">{item.client}</div>
                      <div className="v5-kb-info">{item.service}</div>
                      <div className="v5-kb-amt">{formatEur(item.montant, isPt)}</div>
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
