/**
 * Table row for a single rapport d'intervention.
 * Extracted from RapportsSection.tsx.
 */

import { useThemeVars } from '../useThemeVars'

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

const RAPPORT_STATUS_MAP: Record<string, { label: string; tagClass: string }> = {
  termine: { label: '\u2705 Termine', tagClass: 'v22-tag v22-tag-green' },
  en_cours: { label: '\uD83D\uDD04 En cours', tagClass: 'v22-tag v22-tag-gray' },
  a_reprendre: { label: '\u26A0\uFE0F A reprendre', tagClass: 'v22-tag v22-tag-amber' },
  sous_garantie: { label: '\uD83D\uDEE1\uFE0F Sous garantie', tagClass: 'v22-tag v22-tag-gray' },
}

interface RapportTableRowProps {
  rapport: RapportIntervention
  artisanId?: string
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
  dateFmtLocale,
  onEdit,
  onDelete,
  onGeneratePDF,
  onMarkSent,
  pdfLoading,
  onNavigate,
}: RapportTableRowProps) {
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
          let label = r.linkedDevisRef || ''
          if (r.linkedDevisId && artisanId) {
            try {
              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
              const doc = docs.find((d: { id: string }) => d.id === r.linkedDevisId)
              if (doc) label = `Devis ${doc.service || doc.clientName || doc.id}`
            } catch { /* ignore */ }
          }
          return (
            <div
              className="v22-card-meta"
              style={{ marginTop: '2px', color: tv.primary, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
              onClick={() => onNavigate?.('devis')}
            >
              📋 Lie au devis: {label}
            </div>
          )
        })()}
        {(r.linkedFactureId || r.linkedFactureRef) && (() => {
          let label = r.linkedFactureRef || ''
          if (r.linkedFactureId && artisanId) {
            try {
              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
              const doc = docs.find((d: { id: string }) => d.id === r.linkedFactureId)
              if (doc) label = `Facture ${doc.service || doc.clientName || doc.id}`
            } catch { /* ignore */ }
          }
          return (
            <div
              className="v22-card-meta"
              style={{ marginTop: '2px', color: tv.primary, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
              onClick={() => onNavigate?.('devis')}
            >
              🧾 Lie a la facture: {label}
            </div>
          )
        })()}
      </td>
      <td>
        <span className="v22-client-name">{r.clientName || 'Client non defini'}</span>
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
            <span className="v22-tag v22-tag-gray">📸 {r.linkedPhotoIds!.length} photo{r.linkedPhotoIds!.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </td>
      <td>
        {r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014'}
        {r.startTime && <div className="v22-card-meta">{r.startTime}{r.endTime ? ` \u2192 ${r.endTime}` : ''}{duration ? ` (${duration})` : ''}</div>}
      </td>
      <td><span className={st.tagClass}>{st.label}</span></td>
      <td>
        <span className={r.sentStatus === 'envoye' ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-gray'}>
          {r.sentStatus === 'envoye' ? 'Envoye' : 'Non envoye'}
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
            {pdfLoading === r.id ? '\u23F3' : 'PDF'}
          </button>
          <button onClick={() => onEdit(r)} className="v22-btn v22-btn-sm">&#9997;&#65039;</button>
          <button onClick={() => onDelete(r.id)} className="v22-btn v22-btn-sm" style={{ color: tv.red }}>🗑️</button>
          {r.sentStatus !== 'envoye' && (
            <button onClick={() => onMarkSent(r.id)} className="v22-btn v22-btn-sm">
              Marquer envoye
            </button>
          )}
          {r.clientEmail && (
            <button onClick={() => {
              const subject = encodeURIComponent(`Rapport ${r.rapportNumber} \u2014 ${r.artisanName || 'Fixit'}`)
              const body = encodeURIComponent(`Bonjour ${r.clientName || ''},\n\nVeuillez trouver ci-joint le rapport d'intervention ${r.rapportNumber} du ${r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : ''}.\n\nCordialement,\n${r.artisanName || ''}${r.artisanPhone ? '\n' + r.artisanPhone : ''}`)
              window.open(`mailto:${r.clientEmail}?subject=${subject}&body=${body}`)
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
