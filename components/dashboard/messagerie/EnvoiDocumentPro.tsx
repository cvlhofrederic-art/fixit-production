'use client'

import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useLocale, useTranslation } from '@/lib/i18n/context'
import { documentMessageProSchema } from '@/lib/validation'
import {
  ICONES_DOCUMENT_PRO,
  TYPES_DOCUMENT_PRO,
  formaterMontantDocumentPro,
  libelleDocumentPro,
  resumeDocumentPro,
  type DocumentPro,
  type TypeDocumentPro,
} from '@/lib/messagerie-pro'
import { documentsPourPreRemplissage, type DocumentEnregistre } from './documents-enregistres'

// « Envoyer un document » dans une conversation Pro : devis, rapport d'intervention ou
// facture renvoyé au donneur d'ordre (syndic…). Barre compacte + petit formulaire modal,
// mêmes classes que la fenêtre « Accepter la mission » (V5 et legacy).

type Props = {
  isV5: boolean
  orgRole?: string
  /** Devis / factures du tableau de bord, pour pré-remplir le formulaire */
  documentsEnregistres?: DocumentEnregistre[]
  /** Envoie le document ; renvoie false en cas d'échec (le formulaire reste ouvert) */
  onEnvoyer: (document: DocumentPro, contenu: string) => Promise<boolean>
}

type Champ = 'reference' | 'montant_ttc' | 'description' | 'date'

const aujourdhui = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « 1 240,50 » / « 1240.5 » → 1240.5 ; vide ou illisible → NaN */
const lireMontant = (saisie: string): number => {
  const propre = saisie.replace(/[\s  €]/g, '').replace(',', '.')
  return propre === '' ? Number.NaN : Number(propre)
}

export default function EnvoiDocumentPro({ isV5, orgRole, documentsEnregistres, onEnvoyer }: Props) {
  const { t } = useTranslation()
  const locale = useLocale()
  const idBase = useId()
  const [type, setType] = useState<TypeDocumentPro | null>(null)
  const [reference, setReference] = useState('')
  const [montant, setMontant] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(aujourdhui)
  const [selection, setSelection] = useState('')
  const [erreurs, setErreurs] = useState<Set<Champ>>(new Set())
  const [envoi, setEnvoi] = useState(false)

  const avecMontant = type === 'devis' || type === 'facture'
  const suggestions = useMemo(
    () => (type === 'devis' || type === 'facture' ? documentsPourPreRemplissage(documentsEnregistres, type, orgRole) : []),
    [type, documentsEnregistres, orgRole],
  )

  const ouvrir = (choix: TypeDocumentPro) => {
    setType(choix)
    setReference('')
    setMontant('')
    setDescription('')
    setDate(aujourdhui())
    setSelection('')
    setErreurs(new Set())
  }

  const fermer = () => { if (!envoi) setType(null) }

  const preRemplir = (cle: string) => {
    setSelection(cle)
    const doc = suggestions.find(s => s.cle === cle)
    if (!doc) return
    setReference(doc.reference)
    setMontant(doc.montant_ttc.toFixed(2).replace('.', ','))
    if (doc.description) setDescription(doc.description)
    if (doc.date) setDate(doc.date)
    setErreurs(new Set())
  }

  const envoyer = async () => {
    if (!type || envoi) return
    const brut = {
      type,
      reference,
      ...(avecMontant ? { montant_ttc: lireMontant(montant) } : {}),
      description,
      date,
    }
    const resultat = documentMessageProSchema.safeParse(brut)
    if (!resultat.success) {
      setErreurs(new Set(resultat.error.issues.map(i => i.path[0] as Champ)))
      toast.error(t('proDash.messagerie.docChampsInvalides'))
      return
    }
    setErreurs(new Set())
    setEnvoi(true)
    try {
      const ok = await onEnvoyer(resultat.data, resumeDocumentPro(resultat.data, locale))
      if (ok) {
        toast.success(t('proDash.messagerie.docEnvoye'))
        setType(null)
      } else {
        toast.error(t('proDash.messagerie.docErreurEnvoi'))
      }
    } catch (e) {
      console.error('[messagerie] envoi document error:', e)
      toast.error(t('proDash.messagerie.docErreurEnvoi'))
    } finally {
      setEnvoi(false)
    }
  }

  const classeChamp = isV5 ? 'v5-fi' : 'v22-form-input'
  const styleChamp = (champ: Champ) => ({
    width: '100%',
    boxSizing: 'border-box' as const,
    ...(erreurs.has(champ) ? { borderColor: '#DC2626' } : {}),
  })
  const styleLabel = { display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600 }
  const id = (champ: string) => `${idBase}-${champ}`

  return (
    <>
      {/* ── Barre compacte : 3 choix ── */}
      <div
        role="group"
        aria-label={t('proDash.messagerie.envoyerDocument')}
        style={{ display: 'flex', gap: 4, padding: '4px 12px 0', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>{'📎'} {t('proDash.messagerie.envoyerDocument')} :</span>
        {TYPES_DOCUMENT_PRO.map(choix => (
          <button key={choix} type="button" onClick={() => ouvrir(choix)} className="btn btn-sm" style={{ fontSize: 9 }}>
            {ICONES_DOCUMENT_PRO[choix]} {libelleDocumentPro(choix, locale)}
          </button>
        ))}
      </div>

      {/* ── Formulaire ── */}
      {type && (
        <div className="v22-modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id('titre')}
            className={isV5 ? 'v5-card' : 'v22-modal'}
            style={{ maxWidth: 420, width: 'calc(100% - 32px)', ...(isV5 ? { padding: 0 } : {}) }}
          >
            <div className={isV5 ? '' : 'v22-modal-head'} style={isV5 ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' } : {}}>
              <div id={id('titre')} className={isV5 ? '' : 'v22-modal-title'} style={isV5 ? { fontWeight: 600, fontSize: 13 } : {}}>
                {ICONES_DOCUMENT_PRO[type]} {t('proDash.messagerie.envoyerDocument')} — {libelleDocumentPro(type, locale)}
              </div>
              <button type="button" onClick={fermer} aria-label={t('proDash.messagerie.annuler')} className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-modal-close'}>{'✕'}</button>
            </div>

            <div className={isV5 ? '' : 'v22-modal-body'} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              {suggestions.length > 0 && (
                <div>
                  <label htmlFor={id('prefill')} className={isV5 ? 'v5-fl' : 'v22-form-label'} style={styleLabel}>
                    {t('proDash.messagerie.docPreRemplir')}
                  </label>
                  <select id={id('prefill')} value={selection} onChange={e => preRemplir(e.target.value)} className={classeChamp} style={{ width: '100%' }}>
                    <option value="">{t('proDash.messagerie.docChoisir')}</option>
                    {suggestions.map(s => (
                      <option key={s.cle} value={s.cle}>
                        {s.reference} — {formaterMontantDocumentPro(s.montant_ttc, locale)}{s.description ? ` — ${s.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: avecMontant ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div>
                  <label htmlFor={id('reference')} className={isV5 ? 'v5-fl' : 'v22-form-label'} style={styleLabel}>
                    {t('proDash.messagerie.docReference')}
                  </label>
                  <input
                    id={id('reference')}
                    type="text"
                    value={reference}
                    maxLength={60}
                    onChange={e => setReference(e.target.value)}
                    placeholder={t('proDash.messagerie.docPlaceholderReference')}
                    aria-invalid={erreurs.has('reference') || undefined}
                    className={classeChamp}
                    style={styleChamp('reference')}
                  />
                </div>
                {avecMontant && (
                  <div>
                    <label htmlFor={id('montant')} className={isV5 ? 'v5-fl' : 'v22-form-label'} style={styleLabel}>
                      {t('proDash.messagerie.docMontantTtc')}
                    </label>
                    <input
                      id={id('montant')}
                      type="text"
                      inputMode="decimal"
                      value={montant}
                      onChange={e => setMontant(e.target.value)}
                      placeholder="0,00"
                      aria-invalid={erreurs.has('montant_ttc') || undefined}
                      className={classeChamp}
                      style={styleChamp('montant_ttc')}
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor={id('description')} className={isV5 ? 'v5-fl' : 'v22-form-label'} style={styleLabel}>
                  {type === 'rapport' ? t('proDash.messagerie.docCompteRendu') : t('proDash.messagerie.docDescription')}
                </label>
                <textarea
                  id={id('description')}
                  value={description}
                  maxLength={4000}
                  rows={type === 'rapport' ? 5 : 3}
                  onChange={e => setDescription(e.target.value)}
                  aria-invalid={erreurs.has('description') || undefined}
                  className={classeChamp}
                  style={{ ...styleChamp('description'), resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label htmlFor={id('date')} className={isV5 ? 'v5-fl' : 'v22-form-label'} style={styleLabel}>
                  {t('proDash.messagerie.docDate')}
                </label>
                <input
                  id={id('date')}
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  aria-invalid={erreurs.has('date') || undefined}
                  className={classeChamp}
                  style={styleChamp('date')}
                />
              </div>
            </div>

            <div className={isV5 ? '' : 'v22-modal-foot'} style={{ display: 'flex', gap: 8, padding: 16 }}>
              <button type="button" onClick={fermer} disabled={envoi} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1 }}>
                {t('proDash.messagerie.annuler')}
              </button>
              <button type="button" onClick={envoyer} disabled={envoi} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ flex: 1 }}>
                {envoi ? '…' : `➤ ${t('proDash.messagerie.docEnvoyer')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
