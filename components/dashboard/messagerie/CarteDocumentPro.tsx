'use client'

import { useLocale } from '@/lib/i18n/context'
import {
  ICONES_DOCUMENT_PRO,
  formaterMontantDocumentPro,
  libelleDocumentPro,
  type DocumentPro,
} from '@/lib/messagerie-pro'

// Carte d'un document (devis / rapport d'intervention / facture) envoyé par le
// prestataire dans une conversation Pro. Couleurs héritées de la bulle (propre / reçue),
// textes secondaires par opacité : lisible sur les deux fonds, V5 comme legacy.
export default function CarteDocumentPro({ document, isV5 = false }: { document: DocumentPro; isV5?: boolean }) {
  const locale = useLocale()
  const dateLisible = /^\d{4}-\d{2}-\d{2}$/.test(document.date)
    ? new Date(`${document.date}T12:00:00`).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  return (
    <div
      className={isV5 ? 'v5-card' : undefined}
      data-testid="carte-document-pro"
      data-type-document={document.type}
      style={{
        display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'normal',
        ...(isV5 ? { padding: '8px 10px', marginTop: 2, maxWidth: 360 } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 600, fontSize: 12 }}>
        <span aria-hidden="true">{ICONES_DOCUMENT_PRO[document.type]}</span>
        <span>{libelleDocumentPro(document.type, locale)}</span>
        <span style={{ fontWeight: 500, opacity: 0.75 }}>{document.reference}</span>
      </div>
      {typeof document.montant_ttc === 'number' && (
        <div style={{ fontWeight: 700, fontSize: 13 }}>{formaterMontantDocumentPro(document.montant_ttc, locale)}</div>
      )}
      {document.description && (
        <div style={{ fontSize: 12, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{document.description}</div>
      )}
      {dateLisible && <div style={{ fontSize: 10, opacity: 0.7 }}>{dateLisible}</div>}
    </div>
  )
}
