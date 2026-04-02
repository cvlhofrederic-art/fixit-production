/**
 * Hidden PDF template for rapport d'intervention preview.
 * Rendered off-screen for html2canvas capture.
 * Extracted from RapportsSection.tsx.
 */
import { forwardRef } from 'react'

interface RapportIntervention {
  id: string
  rapportNumber: string
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
  linkedPhotoIds?: string[]
  linkedDevisId?: string | null
  linkedDevisRef?: string
  linkedFactureId?: string | null
  linkedFactureRef?: string
}

interface PhotoRecord {
  id: string
  url?: string
  taken_at?: string
  lat?: number
  lng?: number
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface RapportPDFPreviewProps {
  previewRapport: RapportIntervention
  availablePhotos: PhotoRecord[]
  artisanId?: string
  dateFmtLocale: string
  onNavigate?: (page: string) => void
}

const RapportPDFPreview = forwardRef<HTMLDivElement, RapportPDFPreviewProps>(
  ({ previewRapport, availablePhotos, artisanId, dateFmtLocale, onNavigate }, ref) => {
    return (
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff' }}>
        <div ref={ref} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#1a1a1a', padding: '48px 48px 40px 48px', background: '#fff', width: '794px', boxSizing: 'border-box', lineHeight: '1.5' }}>
          {/* En-tete bandeau */}
          <div style={{ backgroundColor: '#1E293B', margin: '-48px -48px 0 -48px', padding: '30px 48px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.3px' }}>RAPPORT D&apos;INTERVENTION</div>
              <div style={{ fontSize: '13px', color: '#FFC107', fontWeight: '700', marginTop: '6px', letterSpacing: '1px' }}>{previewRapport.rapportNumber}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                Etabli le {new Date().toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            {previewRapport.refDevisFact && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px' }}>Ref : {previewRapport.refDevisFact}</div>
              </div>
            )}
            {(previewRapport.linkedDevisId || previewRapport.linkedDevisRef) && (() => {
              let label = previewRapport.linkedDevisRef || ''
              if (previewRapport.linkedDevisId && artisanId) {
                try {
                  const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
                  const doc = docs.find((d: { id: string }) => d.id === previewRapport.linkedDevisId)
                  if (doc) label = `Devis ${doc.service || doc.clientName || doc.id}`
                } catch { /* ignore */ }
              }
              return (
                <div
                  style={{ fontSize: '10px', color: '#FFC107', marginTop: '6px', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                  onClick={() => onNavigate?.('devis')}
                >
                  📋 Lie au devis: {label}
                </div>
              )
            })()}
            {(previewRapport.linkedFactureId || previewRapport.linkedFactureRef) && (() => {
              let label = previewRapport.linkedFactureRef || ''
              if (previewRapport.linkedFactureId && artisanId) {
                try {
                  const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
                  const doc = docs.find((d: { id: string }) => d.id === previewRapport.linkedFactureId)
                  if (doc) label = `Facture ${doc.service || doc.clientName || doc.id}`
                } catch { /* ignore */ }
              }
              return (
                <div
                  style={{ fontSize: '10px', color: '#FFC107', marginTop: '6px', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                  onClick={() => onNavigate?.('devis')}
                >
                  🧾 Lie a la facture: {label}
                </div>
              )
            })()}
          </div>
          {/* Bande jaune decorative */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #FFC107 0%, #FFD54F 50%, #FFC107 100%)', margin: '0 -48px 28px -48px' }}></div>

          {/* Artisan + Client */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>Prestataire</div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{previewRapport.artisanName}</div>
              {previewRapport.artisanAddress && <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{previewRapport.artisanAddress}</div>}
              {previewRapport.artisanPhone && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.artisanPhone}</div>}
              {previewRapport.artisanEmail && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.artisanEmail}</div>}
              {previewRapport.artisanSiret && <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '6px' }}>SIRET : {previewRapport.artisanSiret}</div>}
              {previewRapport.artisanInsurance && <div style={{ fontSize: '9px', color: '#94A3B8' }}>{previewRapport.artisanInsurance}</div>}
            </div>
            <div style={{ background: '#F8FAFC', borderLeft: '4px solid #FFC107', borderRadius: '0 10px 10px 0', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>Client</div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{previewRapport.clientName}</div>
              {previewRapport.clientAddress && <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{previewRapport.clientAddress}</div>}
              {previewRapport.clientPhone && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientPhone}</div>}
              {previewRapport.clientEmail && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientEmail}</div>}
            </div>
          </div>

          {/* Details intervention */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>Details de l&apos;intervention</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Date</div>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.interventionDate ? new Date(previewRapport.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : '\u2014'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure debut</div>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.startTime || '\u2014'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure fin</div>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.endTime || '\u2014'}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Duree</div>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                  {previewRapport.startTime && previewRapport.endTime ? (() => {
                    const [sh, sm] = previewRapport.startTime.split(':').map(Number)
                    const [eh, em] = previewRapport.endTime.split(':').map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    return mins > 0 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}` : '\u2014'
                  })() : '\u2014'}
                </div>
              </div>
            </div>
            {previewRapport.siteAddress && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '9px', color: '#6b7280' }}>Adresse chantier : </span>
                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.siteAddress}</span>
              </div>
            )}
          </div>

          {/* Motif */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Motif d&apos;intervention
            </div>
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', fontSize: '11px', minHeight: '30px', color: '#1E293B' }}>
              {previewRapport.motif}
            </div>
          </div>

          {/* Travaux */}
          {previewRapport.travaux?.filter(t => t).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Travaux realises
              </div>
              <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC' }}>
                {previewRapport.travaux.filter(t => t).map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', fontSize: '11px', color: '#1E293B' }}>
                    <span style={{ color: '#059669', fontWeight: 'bold' }}>&#10003;</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiaux */}
          {previewRapport.materiaux?.filter(m => m).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Materiaux utilises
              </div>
              <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC' }}>
                {previewRapport.materiaux.filter(m => m).map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', fontSize: '11px', color: '#1E293B' }}>
                    <span style={{ color: '#64748B' }}>&bull;</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations + Recommandations */}
          {(previewRapport.observations || previewRapport.recommendations) && (
            <div style={{ display: 'grid', gridTemplateColumns: previewRapport.recommendations ? '1fr 1fr' : '1fr', gap: '14px', marginBottom: '16px' }}>
              {previewRapport.observations && (
                <div>
                  <div style={{ background: '#475569', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Observations</div>
                  <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', fontSize: '11px', minHeight: '40px', color: '#1E293B', lineHeight: '1.6' }}>{previewRapport.observations}</div>
                </div>
              )}
              {previewRapport.recommendations && (
                <div>
                  <div style={{ background: '#2563EB', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Recommandations</div>
                  <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#EFF6FF', fontSize: '11px', minHeight: '40px', color: '#1E293B', lineHeight: '1.6' }}>{previewRapport.recommendations}</div>
                </div>
              )}
            </div>
          )}

          {/* Photos chantier */}
          {(previewRapport.linkedPhotoIds?.length || 0) > 0 && (() => {
            const photos = availablePhotos.filter(p => previewRapport.linkedPhotoIds?.includes(p.id))
            return photos.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Photos chantier ({photos.length})
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{ width: '140px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Used for html2canvas PDF capture, requires native img */}
                      <img src={photo.url} alt="Photo chantier" style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} crossOrigin="anonymous" />
                      <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '3px' }}>
                        {photo.taken_at ? new Date(photo.taken_at).toLocaleDateString(dateFmtLocale) : ''} {photo.taken_at ? new Date(photo.taken_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' }) : ''}
                        {photo.lat && photo.lng ? ` \u00B7 GPS ${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* Footer */}
          <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #E2E8F0', textAlign: 'center', fontSize: '8px', color: '#94A3B8' }}>
            {previewRapport.artisanName} {previewRapport.artisanSiret ? `\u2014 SIRET ${previewRapport.artisanSiret}` : ''} \u2014 Document genere par Vitfix Pro \u2014 {new Date().toLocaleDateString(dateFmtLocale)}
          </div>
        </div>
      </div>
    )
  }
)

RapportPDFPreview.displayName = 'RapportPDFPreview'

export default RapportPDFPreview
