/**
 * Table row for a single rapport d'intervention.
 * Extracted from RapportsSection.tsx.
 */

import { useLocale } from '@/lib/i18n/context'
import { useThemeVars } from '../useThemeVars'
import { useMemo } from 'react'
import { carteDocumentsLies, libelleDocumentLie, type DocumentLie } from '@/components/dashboard/rapports/document-lie'

interface RapportIntervention {
  id: string
  rapportNumber: string
  createdAt: string
  linkedBookingId: string | null
  linkedPhotoIds?: string[]
  refDevisFact: string
  artisanName: string
  artisanAddress: string
  artisanPhone: string
  artisanEmail: string
  artisanSiret: string
  artisanInsurance: string
  clientName: string
  clientPhone: string
  clientEmail: string
  clientAddress: string
  interventionDate: string
  startTime: string
  endTime: string
  siteAddress: string
  motif: string
  travaux: string[]
  materiaux: string[]
  observations: string
  recommendations: string
  status: 'termine' | 'en_cours' | 'a_reprendre' | 'sous_garantie'
  sentStatus?: 'envoye' | 'non_envoye'
  sentAt?: string
  linkedDevisRef?: string
  linkedFactureRef?: string
  linkedDevisId?: string | null
  linkedFactureId?: string | null
}

// labelPt : libellé affiché en portugais ; la clé (statut enregistré) ne change pas.
const RAPPORT_STATUS_MAP: Record<string, { label: string; labelPt: string; tagClass: string }> = {
  termine: { label: '\u2705 Terminé', labelPt: '✅ Concluído', tagClass: 'v22-tag v22-tag-green' },
  en_cours: { label: '\uD83D\uDD04 En cours', labelPt: '🔄 Em curso', tagClass: 'v22-tag v22-tag-gray' },
  a_reprendre: { label: '\u26A0\uFE0F À reprendre', labelPt: '⚠️ A retomar', tagClass: 'v22-tag v22-tag-amber' },
  sous_garantie: { label: '\uD83D\uDEE1\uFE0F Sous garantie', labelPt: '🛡️ Em garantia', tagClass: 'v22-tag v22-tag-gray' },
}

interface RapportTableRowProps {
  rapport: RapportIntervention
  artisanId?: string
  /** Documents de l'écran rangés par identifiant, construits une fois par le parent (voir document-lie.ts). */
  documentsParId?: Map<string, DocumentLie>
  /** Rôle de l'espace (« pro_societe » : vocabulaire de la construction dans le courriel en portugais). */
  orgRole?: string
  /** Société au gabarit Vitfix : son PDF s'intitule « Relatório Técnico », le courriel le nomme ainsi. */
  relatorioTecnico?: boolean
  dateFmtLocale: string
  onEdit: (r: RapportIntervention) => void
  onDelete: (id: string) => void
  onGeneratePDF: (r: RapportIntervention) => void
  onMarkSent: (id: string) => void
  pdfLoading: string | null
  onNavigate?: (page: string) => void
}

export default function RapportTableRow({
  rapport: r,
  artisanId,
  documentsParId,
  orgRole,
  relatorioTecnico,
  dateFmtLocale,
  onEdit,
  onDelete,
  onGeneratePDF,
  onMarkSent,
  pdfLoading,
  onNavigate,
}: RapportTableRowProps) {
  const isPt = useLocale() === 'pt'
  const isBtp = orgRole === 'pro_societe'
  // Carte du parent si elle est fournie (le cas dans l'application), repli sur le stockage du navigateur sinon :
  // ce composant doit rester utilisable seul.
  const carte = useMemo(
    () => documentsParId ?? carteDocumentsLies(undefined, artisanId),
    [documentsParId, artisanId],
  )
  const isV5 = false
  const tv = useThemeVars(isV5)
  const st = RAPPORT_STATUS_MAP[r.status] || RAPPORT_STATUS_MAP.termine
  const duration = r.startTime && r.endTime ? (() => {
    const [sh, sm] = r.startTime.split(':').map(Number)
    const [eh, em] = r.endTime.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins <= 0) return null
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}`
  })() : null

  return (
    <tr>
      <td>
        <span className="v22-ref">{r.rapportNumber}</span>
        {r.refDevisFact && <div className="v22-card-meta" style={{ marginTop: '2px' }}>{r.refDevisFact}</div>}
        {(r.linkedDevisId || r.linkedDevisRef) && (() => {
          const label = libelleDocumentLie(carte, r.linkedDevisId, r.linkedDevisRef, 'devis', isPt)
          return (
            <div
              className="v22-card-meta"
              style={{ marginTop: '2px', color: tv.primary, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
              onClick={() => onNavigate?.('devis')}
            >
              {isPt ? '📋 Associado ao orçamento:' : '📋 Lié au devis :'} {label}
            </div>
          )
        })()}
        {(r.linkedFactureId || r.linkedFactureRef) && (() => {
          const label = libelleDocumentLie(carte, r.linkedFactureId, r.linkedFactureRef, 'facture', isPt)
          return (
            <div
              className="v22-card-meta"
              style={{ marginTop: '2px', color: tv.primary, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
              onClick={() => onNavigate?.('devis')}
            >
              {isPt ? '🧾 Associado à fatura:' : '🧾 Liée à la facture :'} {label}
            </div>
          )
        })()}
      </td>
      <td>
        <span className="v22-client-name">{r.clientName || (isPt ? 'Cliente não definido' : 'Client non défini')}</span>
        {r.siteAddress && <div className="v22-card-meta">{r.siteAddress}</div>}
      </td>
      <td>
        <div style={{ maxWidth: '200px' }}>{r.motif}</div>
        {r.travaux?.filter(t => t).length > 0 && (
          <div className="v22-card-meta" style={{ marginTop: '2px' }}>
            {r.travaux.filter(t => t).slice(0, 2).map((t, i) => <span key={i} style={{ marginRight: '8px' }}>&#10003; {t}</span>)}
            {r.travaux.filter(t => t).length > 2 && <span>+{r.travaux.filter(t => t).length - 2}</span>}
          </div>
        )}
        {(r.linkedPhotoIds?.length || 0) > 0 && (
          <div style={{ marginTop: '4px' }}>
            <span className="v22-tag v22-tag-gray">📸 {r.linkedPhotoIds!.length} {isPt ? 'foto' : 'photo'}{r.linkedPhotoIds!.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </td>
      <td>
        {r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}
        {r.startTime && <div className="v22-card-meta">{r.startTime}{r.endTime ? ` \u2192 ${r.endTime}` : ''}{duration ? ` (${duration})` : ''}</div>}
      </td>
      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '12px' }}><span className={st.tagClass}>{isPt ? st.labelPt : st.label}</span></td>
      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '12px' }}>
        <span className={r.sentStatus === 'envoye' ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-gray'}>
          {isPt ? (r.sentStatus === 'envoye' ? 'Enviado' : 'Não enviado') : (r.sentStatus === 'envoye' ? 'Envoyé' : 'Non envoyé')}
        </span>
        {r.sentAt && (
          <div className="v22-card-meta" style={{ marginTop: '2px' }}>
            {new Date(r.sentAt).toLocaleDateString(dateFmtLocale, { day: '2-digit', month: 'short' })}
          </div>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={() => onGeneratePDF(r)}
            disabled={pdfLoading === r.id}
            className="v22-btn v22-btn-sm"
          >
            {pdfLoading === r.id ? '\u23F3' : (isPt ? 'Descarregar' : 'Télécharger')}
          </button>
          <button onClick={() => onEdit(r)} className="v22-btn v22-btn-sm">&#9997;&#65039;</button>
          <button onClick={() => onDelete(r.id)} className="v22-btn v22-btn-sm" style={{ color: tv.red }}>🗑️</button>
          {r.sentStatus !== 'envoye' && (
            <button onClick={() => onMarkSent(r.id)} className="v22-btn v22-btn-sm">
              {isPt ? 'Marcar como enviado' : 'Marquer envoyé'}
            </button>
          )}
          {r.clientEmail && (
            <button onClick={() => {
              // Courriel préparé pour le client du professionnel : rédigé dans la langue de l'interface
              // (« relatório de obra » côté société BTP, « relatório técnico » pour une société au gabarit Vitfix,
              // « relatório de intervenção » côté artisan).
              let designacao = 'relatório de intervenção'
              if (isBtp) designacao = relatorioTecnico ? 'relatório técnico' : 'relatório de obra'
              const dateIntervention = r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : ''
              const subject = isPt ? encodeURIComponent(`Relatório ${r.rapportNumber} · ${r.artisanName || 'Fixit'}`) : encodeURIComponent(`Rapport ${r.rapportNumber} \u2014 ${r.artisanName || 'Fixit'}`)
              const body = isPt
                ? encodeURIComponent(`Caro(a) ${r.clientName || ''},\n\nSegue em anexo o ${designacao} ${r.rapportNumber} de ${dateIntervention}.\n\nCom os melhores cumprimentos,\n${r.artisanName || ''}${r.artisanPhone ? '\n' + r.artisanPhone : ''}`)
                : encodeURIComponent(`Bonjour ${r.clientName || ''},\n\nVeuillez trouver ci-joint le rapport d'intervention ${r.rapportNumber} du ${r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : ''}.\n\nCordialement,\n${r.artisanName || ''}${r.artisanPhone ? '\n' + r.artisanPhone : ''}`)
              window.open(`mailto:${encodeURIComponent(r.clientEmail)}?subject=${subject}&body=${body}`)
              onMarkSent(r.id)
            }}
              className="v22-btn v22-btn-sm">
              Email
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
