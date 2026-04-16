'use client'

/**
 * DevisFactureFormBTP — Formulaire devis pixel-perfect calqué sur la maquette
 * `vitfix_btp_dashboardpro_v8_settings.html` (id `pg-devis`).
 *
 * Spécifique au rôle `pro_societe` (compte BTP super admin). Le composant
 * standard `DevisFactureForm` reste utilisé pour les artisans / conciergerie
 * / gestionnaire — aucune régression sur ces parcours.
 *
 * Persistance compatible avec la liste V5 (`DevisSection.tsx`) :
 * - `localStorage["fixit_documents_<artisan.id>"]`  → devis envoyés/finalisés
 * - `localStorage["fixit_drafts_<artisan.id>"]`     → brouillons
 * - même shape que `DevisFactureForm` (docNumber, docTitle, lines, status…)
 *
 * Les helpers PDF (jsPDF V3) sont mutualisés avec le composant standard via
 * `lib/pdf/build-v2-input.ts` + `lib/pdf/devis-pdf-v3.ts`.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  type ProductLine,
  type DevisAcompte,
  type DevisFactureFormProps,
} from '@/lib/devis-types'
import { mapLegalFormToCode } from '@/lib/devis-utils'
import { buildV2Input } from '@/lib/pdf/build-v2-input'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'

/* ─────────────────────────────────────────────────────────────────
   CONSTANTES
   ───────────────────────────────────────────────────────────────── */

const STATUTS_JURIDIQUES = [
  'Entreprise Individuelle (EI)',
  'EURL',
  'SARL',
  'SAS',
  'SASU',
  'SA',
  'Auto-entrepreneur',
] as const

const UNITES_TABLEAU = [
  { value: 'u',   label: 'u — Unité' },
  { value: 'm2',  label: 'm² — Mètre carré' },
  { value: 'ml',  label: 'ml — Mètre linéaire' },
  { value: 'm3',  label: 'm³ — Mètre cube' },
  { value: 'h',   label: 'h — Heure' },
  { value: 'j',   label: 'j — Jour' },
  { value: 'f',   label: 'forfait' },
] as const

const TVA_RATES = [20, 10, 5.5, 0] as const

const DECLENCHEURS_ACOMPTE = [
  'À la signature',
  'Au démarrage',
  'À la livraison',
  '30 jours',
  '60 jours',
] as const

const MODES_PAIEMENT = [
  'Virement bancaire',
  'Chèque',
  'Carte bancaire',
  'Espèces (≤ 1000 €)',
  'Prélèvement SEPA',
] as const

const DELAIS_PAIEMENT = [
  'Comptant à réception',
  '30 jours',
  '45 jours fin de mois',
  '60 jours',
] as const

const ESCOMPTES = [
  'Aucun escompte accordé pour paiement anticipé',
  '1 % pour paiement à 10 jours',
  '2 % pour paiement comptant',
] as const

const TYPES_ASSURANCE = [
  { value: 'rc_pro',    label: 'RC Professionnelle' },
  { value: 'decennale', label: 'Décennale' },
  { value: 'both',      label: 'RC Pro + Décennale' },
] as const

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const generateDocNumber = (artisanId?: string): string => {
  const year = new Date().getFullYear()
  try {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]')
    const all = [...docs, ...drafts]
    const nums = all
      .map((d: { docNumber?: string }) => d.docNumber || '')
      .filter((n: string) => n.startsWith(`DEV-${year}-`))
      .map((n: string) => parseInt(n.split('-')[2] || '0', 10))
      .filter((n: number) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `DEV-${year}-${String(next).padStart(3, '0')}`
  } catch {
    return `DEV-${year}-001`
  }
}

/* ─────────────────────────────────────────────────────────────────
   COMPOSANT
   ───────────────────────────────────────────────────────────────── */

export default function DevisFactureFormBTP({
  artisan,
  services,
  bookings,
  initialDocType = 'devis',
  initialData,
  onBack,
  onSave,
}: DevisFactureFormProps) {
  const today = new Date().toISOString().split('T')[0]

  /* ──────── State ──────── */
  const [docType, setDocType] = useState<'devis' | 'facture'>(
    (initialData?.docType as 'devis' | 'facture') || initialDocType
  )
  const [docNumber] = useState<string>(initialData?.docNumber || generateDocNumber(artisan?.id))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')

  // Entreprise
  const [statutJuridique, setStatutJuridique] = useState(
    initialData?.companyStatus || (artisan?.legal_form ? mapLegalFormToCode(artisan.legal_form) : 'Entreprise Individuelle (EI)')
  )
  const [companyName, setCompanyName] = useState(initialData?.companyName || artisan?.company_name || '')
  const [companySiret, setCompanySiret] = useState(initialData?.companySiret || artisan?.siret || '')
  const [companyAddress, setCompanyAddress] = useState(initialData?.companyAddress || artisan?.company_address || artisan?.address || '')
  const [companyRCS, setCompanyRCS] = useState(initialData?.companyRCS || '')
  const [companyPhone, setCompanyPhone] = useState(initialData?.companyPhone || artisan?.phone || '')
  const [companyEmail, setCompanyEmail] = useState(initialData?.companyEmail || artisan?.email || '')
  const [tvaNumber, setTvaNumber] = useState(initialData?.tvaNumber || '')
  const [companyAPE, setCompanyAPE] = useState((initialData as { companyAPE?: string })?.companyAPE || '')
  const [companyCapital, setCompanyCapital] = useState(initialData?.companyCapital || '')

  // Assurance & Médiation
  const [insuranceType, setInsuranceType] = useState<'rc_pro' | 'decennale' | 'both'>(
    initialData?.insuranceType || 'rc_pro'
  )
  const [insuranceName, setInsuranceName] = useState(initialData?.insuranceName || '')
  const [insuranceNumber, setInsuranceNumber] = useState(initialData?.insuranceNumber || '')
  const [insuranceCoverage, setInsuranceCoverage] = useState(initialData?.insuranceCoverage || 'France métropolitaine')
  const [mediatorName, setMediatorName] = useState(initialData?.mediatorName || '')
  const [mediatorUrl, setMediatorUrl] = useState(initialData?.mediatorUrl || '')

  // TVA
  const [tvaEnabled, setTvaEnabled] = useState(initialData?.tvaEnabled ?? false)

  // Client
  const [clientName, setClientName] = useState(initialData?.clientName || '')
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '')
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '')
  const [clientSiret, setClientSiret] = useState(initialData?.clientSiret || '')
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '')
  const [interventionAddress, setInterventionAddress] = useState(initialData?.interventionAddress || '')
  const [interventionBatiment, setInterventionBatiment] = useState(initialData?.interventionBatiment || '')
  const [interventionEtage, setInterventionEtage] = useState(initialData?.interventionEtage || '')
  const [interventionEspacesCommuns, setInterventionEspacesCommuns] = useState(initialData?.interventionEspacesCommuns || '')
  const [interventionExterieur, setInterventionExterieur] = useState(initialData?.interventionExterieur || '')

  // Document
  const [docDate, setDocDate] = useState(initialData?.docDate || today)
  const [docValidity, setDocValidity] = useState<number>(initialData?.docValidity || 30)
  const [executionDelayDays, setExecutionDelayDays] = useState<number>(initialData?.executionDelayDays || 0)
  const [executionDelayType, setExecutionDelayType] = useState<string>(initialData?.executionDelayType || 'ouvres')

  // Lignes prestations
  const [lines, setLines] = useState<ProductLine[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [{ id: 1, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }]
  )
  const [priceMode, setPriceMode] = useState<'ht' | 'ttc'>('ht')

  // Acomptes
  const [acomptesEnabled, setAcomptesEnabled] = useState(initialData?.acomptesEnabled ?? true)
  const [acomptes, setAcomptes] = useState<DevisAcompte[]>(
    initialData?.acomptes && initialData.acomptes.length > 0
      ? initialData.acomptes
      : [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' }]
  )

  // Modalités paiement
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || 'Virement bancaire')
  const [paymentDelay, setPaymentDelay] = useState((initialData as { paymentDelay?: string })?.paymentDelay || 'Comptant à réception')
  const [penaltyRate, setPenaltyRate] = useState((initialData as { penaltyRate?: string })?.penaltyRate || "3 × taux d'intérêt légal en vigueur")
  const [recoveryFee, setRecoveryFee] = useState((initialData as { recoveryFee?: string })?.recoveryFee || '40 € (BtoB uniquement)')
  const [escompte, setEscompte] = useState((initialData as { escompte?: string })?.escompte || ESCOMPTES[0])

  // Notes
  const [notes, setNotes] = useState(initialData?.notes || '')

  // Saving / loading flags
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Modals
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientDb, setClientDb] = useState<Array<{ id: string; name: string; email?: string; phone?: string; siret?: string; mainAddress?: string; address?: string }>>([])
  const [clientDbSearch, setClientDbSearch] = useState('')
  const [clientDbLoading, setClientDbLoading] = useState(false)

  /* ──────── Calculs ──────── */

  // Recalcule totalHT à chaque modif d'une ligne
  const recalcLine = useCallback((line: ProductLine): ProductLine => {
    const totalHT = (line.qty || 0) * (line.priceHT || 0)
    return { ...line, totalHT }
  }, [])

  const totaux = useMemo(() => {
    const subTotalBrut = lines.reduce((s, l) => s + (l.qty || 0) * (l.priceHT || 0), 0)
    const remise = 0 // pas de remise globale dans la maquette V1
    const totalHT = subTotalBrut - remise

    // Ventilation TVA par taux
    const tvaMap = new Map<number, number>()
    if (!tvaEnabled) {
      // entreprise sans TVA → toute la ventilation à 0 / non applicable
    } else {
      lines.forEach((l) => {
        const ht = (l.qty || 0) * (l.priceHT || 0)
        const taux = l.tvaRate || 0
        tvaMap.set(taux, (tvaMap.get(taux) || 0) + ht * (taux / 100))
      })
    }
    const tvaEntries = Array.from(tvaMap.entries()).sort((a, b) => b[0] - a[0])
    const totalTva = tvaEntries.reduce((s, [, v]) => s + v, 0)
    const totalTTC = totalHT + totalTva

    return { subTotalBrut, remise, totalHT, tvaEntries, totalTva, totalTTC }
  }, [lines, tvaEnabled])

  /* ──────── Conformité légale (checklist sidebar) ──────── */

  const conformite = useMemo(() => {
    return {
      siret: companySiret.replace(/\s/g, '').length === 14,
      rcs: companyRCS.trim().length > 0,
      assurance: insuranceName.trim().length > 0 && insuranceNumber.trim().length > 0,
      mediateur: mediatorName.trim().length > 0 && mediatorUrl.trim().length > 0,
      client: clientName.trim().length > 0 && clientAddress.trim().length > 0,
      prestations: lines.some((l) => l.description.trim().length > 0 && l.priceHT > 0),
      penalites: true, // mention auto dans bloc légal
      escompte: true,  // mention auto dans bloc légal
    }
  }, [companySiret, companyRCS, insuranceName, insuranceNumber, mediatorName, mediatorUrl, clientName, clientAddress, lines])

  /* ──────── Handlers tableau prestations ──────── */

  const addLine = () => {
    const nextId = Math.max(0, ...lines.map((l) => l.id)) + 1
    setLines([...lines, { id: nextId, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }])
  }

  const removeLine = (id: number) => {
    if (lines.length === 1) {
      toast.error('Au moins une ligne est requise')
      return
    }
    setLines(lines.filter((l) => l.id !== id))
  }

  const updateLine = (id: number, patch: Partial<ProductLine>) => {
    setLines(lines.map((l) => (l.id === id ? recalcLine({ ...l, ...patch }) : l)))
  }

  /* ──────── Handlers acomptes ──────── */

  const addAcompte = () => {
    const nextOrdre = acomptes.length + 1
    setAcomptes([
      ...acomptes,
      {
        id: `a${Date.now()}`,
        ordre: nextOrdre,
        label: `Acompte ${nextOrdre}`,
        pourcentage: 0,
        declencheur: 'À la livraison',
      },
    ])
  }

  const updateAcompte = (id: string, patch: Partial<DevisAcompte>) => {
    setAcomptes(acomptes.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const removeAcompte = (id: string) => {
    setAcomptes(acomptes.filter((a) => a.id !== id))
  }

  const saveEcheancierAsDefault = () => {
    try {
      const toSave = acomptes
        .filter((a) => a.pourcentage > 0)
        .map((a) => ({ label: a.declencheur, pourcentage: a.pourcentage }))
      localStorage.setItem(`fixit_echeancier_default_${artisan?.id || 'default'}`, JSON.stringify(toSave))
      toast.success('Échéancier enregistré comme défaut')
    } catch (err) {
      console.warn('[DevisBTP] écheancier save failed', err)
      toast.error('Impossible d\'enregistrer l\'échéancier')
    }
  }

  const totalAcomptePct = acomptes.reduce((s, a) => s + (a.pourcentage || 0), 0)

  /* ──────── Import client ──────── */

  const openClientPicker = async () => {
    if (!artisan?.id) return
    setShowClientPicker(true)
    setClientDbLoading(true)
    setClientDbSearch('')
    try {
      const res = await fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      const data = await res.json()
      const authClients = (data.clients || []).map((c: Record<string, unknown>) => ({ ...c }))
      const manualRaw = localStorage.getItem(`fixit_manual_clients_${artisan.id}`)
      const manualClients = manualRaw ? JSON.parse(manualRaw) : []
      setClientDb([...authClients, ...manualClients])
    } catch {
      setClientDb([])
    }
    setClientDbLoading(false)
  }

  const selectClient = (c: typeof clientDb[0]) => {
    setClientName(c.name || '')
    setClientEmail(c.email || '')
    setClientPhone(c.phone || '')
    setClientSiret(c.siret || '')
    setClientAddress(c.mainAddress || c.address || '')
    setShowClientPicker(false)
  }

  /* ──────── Import depuis intervention (booking confirmé/terminé) ──────── */

  const importableBookings = useMemo(() => {
    return (bookings || [])
      .filter((b) => ['confirmed', 'completed', 'terminé', 'confirmé'].includes((b.status || '').toLowerCase()))
      .slice(0, 20)
  }, [bookings])

  const importFromBooking = (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId)
    if (!b) return
    setClientName(b.client_name || clientName)
    setInterventionAddress(b.address || interventionAddress)
    if (b.services?.name) {
      const newLine: ProductLine = {
        id: Math.max(0, ...lines.map((l) => l.id)) + 1,
        description: b.services.name,
        qty: 1,
        unit: 'f',
        priceHT: b.price_ht || 0,
        tvaRate: 20,
        totalHT: b.price_ht || 0,
      }
      setLines([...lines.filter((l) => l.description.trim().length > 0), newLine])
    }
    if (b.notes) setNotes((notes ? notes + '\n' : '') + b.notes)
    toast.success('Pré-rempli depuis l\'intervention')
  }

  /* ──────── Sauvegarde ──────── */

  const buildPayload = useCallback(() => {
    return {
      id: initialData?.docNumber === docNumber && (initialData as { id?: string })?.id ? (initialData as { id?: string }).id : Date.now().toString(),
      docType,
      docNumber,
      docTitle,
      docDate,
      docValidity,
      executionDelayDays,
      executionDelayType,
      // Entreprise
      companyStatus: statutJuridique,
      companyName,
      companySiret,
      companyAddress,
      companyRCS,
      companyCapital,
      companyPhone,
      companyEmail,
      tvaEnabled,
      tvaNumber,
      companyAPE,
      // Assurance
      insuranceType,
      insuranceName,
      insuranceNumber,
      insuranceCoverage,
      mediatorName,
      mediatorUrl,
      isHorsEtablissement: true,
      // Client
      clientName,
      clientEmail,
      clientPhone,
      clientSiret,
      clientAddress,
      interventionAddress,
      interventionBatiment,
      interventionEtage,
      interventionEspacesCommuns,
      interventionExterieur,
      // Lignes
      lines,
      // Acomptes
      acomptesEnabled,
      acomptes,
      // Paiement
      paymentMode,
      paymentDelay,
      penaltyRate,
      recoveryFee,
      escompte,
      // Notes
      notes,
    }
  }, [
    initialData, docNumber, docType, docTitle, docDate, docValidity, executionDelayDays, executionDelayType,
    statutJuridique, companyName, companySiret, companyAddress, companyRCS, companyCapital, companyPhone, companyEmail,
    tvaEnabled, tvaNumber, companyAPE,
    insuranceType, insuranceName, insuranceNumber, insuranceCoverage, mediatorName, mediatorUrl,
    clientName, clientEmail, clientPhone, clientSiret, clientAddress,
    interventionAddress, interventionBatiment, interventionEtage, interventionEspacesCommuns, interventionExterieur,
    lines, acomptesEnabled, acomptes,
    paymentMode, paymentDelay, penaltyRate, recoveryFee, escompte,
    notes,
  ])

  const saveDraft = () => {
    if (!artisan?.id) {
      toast.error('Compte non identifié')
      return
    }
    setSaving(true)
    try {
      const payload = { ...buildPayload(), status: 'brouillon', savedAt: new Date().toISOString() }
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')
      const filtered = drafts.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      filtered.push(payload)
      localStorage.setItem(`fixit_drafts_${artisan.id}`, JSON.stringify(filtered))
      toast.success('Brouillon enregistré')
      onSave?.(payload as never)
    } catch (err) {
      console.error('[DevisBTP] saveDraft failed', err)
      toast.error('Impossible d\'enregistrer le brouillon')
    } finally {
      setSaving(false)
    }
  }

  const saveAndSend = () => {
    if (!artisan?.id) return
    if (!clientName.trim()) { toast.error('Renseignez le nom du client'); return }
    if (!lines.some((l) => l.description.trim().length > 0 && l.priceHT > 0)) {
      toast.error('Ajoutez au moins une prestation chiffrée'); return
    }
    setSaving(true)
    try {
      const payload = { ...buildPayload(), status: 'envoye', savedAt: new Date().toISOString(), sentAt: new Date().toISOString() }
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
      const filtered = docs.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      filtered.push(payload)
      localStorage.setItem(`fixit_documents_${artisan.id}`, JSON.stringify(filtered))
      // Retire des brouillons s'il y était
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')
      const newDrafts = drafts.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      localStorage.setItem(`fixit_drafts_${artisan.id}`, JSON.stringify(newDrafts))
      toast.success('Devis validé')
      onSave?.(payload as never)
      onBack()
    } catch (err) {
      console.error('[DevisBTP] saveAndSend failed', err)
      toast.error('Impossible de valider le devis')
    } finally {
      setSaving(false)
    }
  }

  /* ──────── Génération PDF ──────── */

  const generatePdf = async (action: 'preview' | 'download') => {
    setPdfLoading(true)
    try {
      const formData = buildPayload()
      const v2Input = buildV2Input(formData as never, artisan as never)
      const pdfBlob = await generateDevisPdfV3(v2Input as never)
      if (!pdfBlob || !(pdfBlob instanceof Blob)) {
        toast.error('Génération PDF échouée')
        return
      }
      const url = URL.createObjectURL(pdfBlob)
      if (action === 'download') {
        const a = document.createElement('a')
        a.href = url
        a.download = `${docNumber}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        toast.success('PDF téléchargé')
      } else {
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (err) {
      console.error('[DevisBTP] PDF failed', err)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  /* ──────── Rentabilité (placeholder) ──────── */
  const [showRentaModal, setShowRentaModal] = useState(false)
  const [showImportList, setShowImportList] = useState(false)

  /* ──────── Effect : pré-remplir docTitle si initialData ──────── */
  useEffect(() => {
    if (initialData?.docTitle) setDocTitle(initialData.docTitle)
  }, [initialData?.docTitle])

  /* ─────────────────────────────────────────────────────────────────
     RENDU
     ───────────────────────────────────────────────────────────────── */

  return (
    <div className="dvbtp-root">
      {/* ============ STYLES `.dv-*` (issus de la maquette HTML) ============ */}
      <style jsx>{`
        .dvbtp-root {
          --primary-yellow: #FFC107;
          --primary-yellow-dark: #FFA000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          font-size: 13px;
          color: #1a1a1a;
          background: #FAFAFA;
          padding: 14px;
          min-height: 100%;
        }

        /* Top bar */
        .devis-top-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px; }
        .devis-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #666; cursor: pointer; font-weight: 500; border: none; background: none; font-family: inherit; padding: 0; }
        .devis-back:hover { color: var(--primary-yellow-dark); }
        .devis-top-title { font-size: 17px; font-weight: 600; color: #1a1a1a; }
        .dv-doc-num { font-size: 11px; color: #999; font-weight: 500; padding: 3px 8px; background: #F5F5F5; border-radius: 3px; font-variant-numeric: tabular-nums; }
        .devis-top-right { display: flex; align-items: center; gap: 8px; }
        .devis-top-btn { padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; color: #555; font-family: inherit; transition: all .15s; }
        .devis-top-btn:hover { background: #F5F5F5; }
        .devis-top-btn.cta { background: #2E7D32; color: #fff; border-color: #2E7D32; }
        .devis-top-btn.cta:hover { background: #256d29; }
        .devis-top-btn:disabled { opacity: .5; cursor: not-allowed; }
        .dv-doc-type-switch { display: inline-flex; background: #F0F0F0; border-radius: 6px; padding: 3px; gap: 2px; }
        .dv-doc-type-switch button { border: none; background: none; padding: 5px 12px; font-size: 11px; font-weight: 600; color: #888; cursor: pointer; border-radius: 4px; font-family: inherit; transition: all .15s; }
        .dv-doc-type-switch button.active { background: #fff; color: var(--primary-yellow-dark); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .dv-doc-type-switch button:not(.active):hover { color: #555; }

        /* Layout */
        .devis-layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
        @media (max-width: 1100px) { .devis-layout { grid-template-columns: 1fr; } }

        /* Sections */
        .dv-section { background: #fff; border: 1px solid #E8E8E8; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
        .dv-section-t { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; margin-bottom: .85rem; letter-spacing: .2px; }
        .dv-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .85rem; gap: 1rem; flex-wrap: wrap; }
        .dv-section-head .dv-section-t { margin-bottom: 0; }

        /* Form groups */
        .dv-row { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-bottom: .85rem; }
        .dv-row.col3 { grid-template-columns: 1fr 1fr 1fr; }
        .dv-row.col1 { grid-template-columns: 1fr; }
        .dv-fg { display: flex; flex-direction: column; gap: 3px; }
        .dv-fg label { font-size: 11px; font-weight: 600; color: #444; }
        .dv-fg label .req { color: #E53935; }
        .dv-fg input, .dv-fg select, .dv-fg textarea {
          width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 5px;
          font-size: 12px; font-family: inherit; background: #fff; color: #333; transition: border-color .15s;
        }
        .dv-fg input:focus, .dv-fg select:focus, .dv-fg textarea:focus {
          outline: none; border-color: var(--primary-yellow); box-shadow: 0 0 0 2px rgba(255,193,7,.12);
        }
        .dv-fg textarea { min-height: 70px; resize: vertical; }
        .dv-fg input::placeholder, .dv-fg textarea::placeholder { color: #BBB; }

        /* Alertes */
        .dv-alert { padding: .7rem 1rem; border-radius: 6px; font-size: 12px; line-height: 1.5; margin-bottom: 1rem; }
        .dv-alert.green  { background: #E8F5E9; color: #2E7D32; border-left: 3px solid #4CAF50; }
        .dv-alert.orange { background: #FFF3E0; color: #E65100; border-left: 3px solid #FF9800; }
        .dv-alert.red    { background: #FFEBEE; color: #C62828; border-left: 3px solid #E53935; }
        .dv-alert.blue   { background: #E3F2FD; color: #1565C0; border-left: 3px solid #2196F3; }
        .dv-alert.yellow { background: #FFF8E1; color: #8B7D00; border-left: 3px solid #FFC107; }
        .dv-alert strong { font-weight: 700; }

        /* Toggle row */
        .dv-toggle-row { display: flex; align-items: center; gap: 10px; padding: .6rem 0; }
        .dv-toggle-label { font-size: 12px; color: #444; font-weight: 600; }
        .dv-toggle-sub { font-size: 11px; color: #999; }
        .tgl { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
        .tgl input { opacity: 0; width: 0; height: 0; }
        .tgl .sl { position: absolute; cursor: pointer; inset: 0; background: #ccc; transition: .2s; border-radius: 22px; }
        .tgl .sl::before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; top: 3px; background: white; transition: .2s; border-radius: 50%; }
        .tgl input:checked + .sl { background: var(--primary-yellow); }
        .tgl input:checked + .sl::before { transform: translateX(16px); }

        /* Import card */
        .dv-import-card { background: linear-gradient(180deg, #FFFBEF 0%, #FFF8E1 100%); border: 1px solid #F5C741; border-radius: 8px; padding: 1rem 1.1rem; margin-top: .5rem; }
        .dv-import-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none; padding: 0; cursor: pointer; }
        .dv-import-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: .3rem; }
        .dv-import-title { font-size: 13px; font-weight: 700; color: #7A5C00; letter-spacing: .2px; }
        .dv-import-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; background: var(--primary-yellow); color: #5A4500; padding: 3px 8px; border-radius: 10px; }
        .dv-import-sub { font-size: 11px; color: #8B7D00; margin-bottom: .75rem; line-height: 1.4; }
        .dv-import-empty { text-align: center; padding: .85rem; background: rgba(255,255,255,.6); border: 1px dashed #E6C04A; border-radius: 6px; color: #8B7D00; font-size: 12px; }
        .dv-import-empty strong { color: #5A4500; display: block; margin-bottom: 2px; }
        .dv-import-empty .hint { display: block; font-size: 11px; color: #A89000; font-style: italic; }
        .dv-import-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
        .dv-import-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,.85); border: 1px solid #F5C741; border-radius: 5px; cursor: pointer; transition: background .15s; }
        .dv-import-item:hover { background: #fff; }
        .dv-import-item .nm { font-size: 12px; font-weight: 600; color: #5A4500; }
        .dv-import-item .meta { font-size: 11px; color: #A89000; }

        /* Info strip */
        .dv-info-strip { display: flex; align-items: center; gap: 10px; padding: .7rem .85rem; background: #F5F5F5; border-radius: 6px; border-left: 3px solid #BDBDBD; }
        .dv-info-strip .ico { width: 28px; height: 28px; border-radius: 50%; background: #E8E8E8; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666; flex-shrink: 0; }
        .dv-info-strip .txt { flex: 1; }
        .dv-info-strip .ttl { font-size: 12px; font-weight: 600; color: #333; }
        .dv-info-strip .sub { font-size: 11px; color: #888; line-height: 1.4; margin-top: 1px; }

        /* Tableau prestations */
        .dv-presta-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: .6rem; table-layout: fixed; }
        .dv-presta-table th { text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; border-bottom: 2px solid #E8E8E8; letter-spacing: .2px; white-space: nowrap; }
        .dv-presta-table td { padding: 6px 8px; border-bottom: 1px solid #F0F0F0; vertical-align: middle; }
        .dv-presta-table input, .dv-presta-table select { padding: 6px 8px; border: 1px solid #E0E0E0; border-radius: 4px; font-size: 12px; font-family: inherit; width: 100%; }
        .dv-presta-table input:focus, .dv-presta-table select:focus { outline: none; border-color: var(--primary-yellow); }
        .dv-presta-table td.amount { font-weight: 600; text-align: right; color: #1a1a1a; font-variant-numeric: tabular-nums; }
        .dv-presta-table .col-ht { background: #FAFAFA; }
        .dv-presta-del { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #FFCDD2; background: #fff; color: #E53935; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all .15s; }
        .dv-presta-del:hover { background: #FFEBEE; }
        .dv-add-line { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #666; cursor: pointer; padding: 6px 0; border: none; background: none; font-family: inherit; font-weight: 500; }
        .dv-add-line:hover { color: var(--primary-yellow-dark); }
        .dv-scanner-btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 5px; background: var(--primary-yellow); border: none; color: #333; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .dv-scanner-btn:hover { background: #FFB800; }

        /* Mode switch HT/TTC */
        .dv-mode-switch { display: inline-flex; background: #F0F0F0; border-radius: 6px; padding: 3px; gap: 2px; }
        .dv-mode-switch button { border: none; background: none; padding: 5px 14px; font-size: 11px; font-weight: 600; color: #888; cursor: pointer; border-radius: 4px; font-family: inherit; transition: all .15s; letter-spacing: .3px; }
        .dv-mode-switch button.active { background: #fff; color: var(--primary-yellow-dark); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .dv-mode-switch button:not(.active):hover { color: #555; }

        /* Acomptes */
        .dv-acompte-row { display: grid; grid-template-columns: 1fr 90px 30px 130px 32px; align-items: center; gap: 8px; margin-bottom: .5rem; }
        .dv-acompte-row select, .dv-acompte-row input { min-width: 0; width: 100%; padding: 7px 10px; border: 1px solid #E0E0E0; border-radius: 5px; font-size: 12px; font-family: inherit; }
        .dv-acompte-row input { text-align: center; }
        .dv-acompte-pct { font-size: 12px; color: #666; }
        .dv-acompte-eq { font-size: 12px; color: #888; text-align: right; font-variant-numeric: tabular-nums; }
        .dv-acompte-del { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #E0E0E0; background: none; cursor: pointer; color: #999; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .dv-acompte-del:hover { border-color: #E53935; color: #E53935; background: #FFEBEE; }
        .dv-echelon-warning { font-size: 12px; font-weight: 600; margin-top: .65rem; padding: .5rem .75rem; border-radius: 5px; }
        .dv-echelon-warning.orange { background: #FFF3E0; color: #E65100; border-left: 3px solid #FF9800; }
        .dv-echelon-warning.green  { background: #E8F5E9; color: #2E7D32; border-left: 3px solid #4CAF50; }
        .dv-echelon-warning .sub { font-size: 11px; font-weight: 400; color: #888; display: block; margin-top: 2px; }

        /* Mentions légales */
        .dv-mentions { font-size: 11px; color: #888; line-height: 1.6; padding: .75rem; background: #FAFAFA; border-radius: 6px; }

        /* Btn link client */
        .btn-link-client { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 5px; background: #fff; border: 1px solid var(--primary-yellow); color: var(--primary-yellow-dark); font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
        .btn-link-client:hover { background: #FFF8E1; }

        /* Sidebar */
        .dv-sidebar { position: sticky; top: 0; }
        .dv-sidebar-card { background: #fff; border: 1px solid #E8E8E8; border-radius: 8px; padding: 1rem; margin-bottom: .85rem; }
        .dv-sidebar-t { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; margin-bottom: .75rem; letter-spacing: .2px; }

        .dv-resume-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 1rem; padding: .35rem 0; font-size: 12px; color: #555; }
        .dv-resume-row > span:last-child { font-variant-numeric: tabular-nums; text-align: right; min-width: 80px; }
        .dv-resume-row.subtotal { border-top: 1px dashed #E0E0E0; padding-top: .5rem; margin-top: .25rem; font-weight: 600; color: #1a1a1a; }
        .dv-resume-row.tva { color: #888; font-size: 11px; padding: .2rem 0; }
        .dv-resume-row.tva > span:first-child { padding-left: .75rem; position: relative; }
        .dv-resume-row.tva > span:first-child::before { content: "└"; position: absolute; left: 0; color: #CCC; font-size: 10px; }
        .dv-resume-row.tva-total { font-weight: 600; color: #555; }
        .dv-resume-row.total { background: var(--primary-yellow); color: #333; font-weight: 700; font-size: 13px; padding: .55rem .7rem; border-radius: 5px; margin-top: .5rem; }

        .dv-conf-status { font-size: 12px; color: #888; margin-bottom: .65rem; padding-bottom: .5rem; border-bottom: 1px solid #F0F0F0; }
        .dv-conf-item { display: flex; align-items: center; justify-content: space-between; padding: .3rem .4rem; margin: 0 -.4rem; font-size: 12px; color: #555; cursor: pointer; border-radius: 4px; }
        .dv-conf-item:hover { background: #FAFAFA; }
        .dv-conf-x { color: #E53935; font-weight: 700; font-size: 13px; }
        .dv-conf-check { color: #4CAF50; font-weight: 700; font-size: 13px; }

        .dv-sidebar-btn { width: 100%; padding: 9px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; color: #555; font-family: inherit; transition: all .15s; margin-bottom: .4rem; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .dv-sidebar-btn:hover { background: #FAFAFA; border-color: #CCC; }
        .dv-sidebar-btn.yellow { background: var(--primary-yellow); border-color: var(--primary-yellow); color: #333; }
        .dv-sidebar-btn.yellow:hover { background: #FFB800; }
        .dv-sidebar-btn.green { background: #4CAF50; border-color: #4CAF50; color: #fff; }
        .dv-sidebar-btn.green:hover { background: #43A047; }
        .dv-sidebar-btn.outline-blue { border-color: #1565C0; color: #1565C0; }
        .dv-sidebar-btn.outline-blue:hover { background: #E3F2FD; }
        .dv-sidebar-btn:disabled { opacity: .5; cursor: not-allowed; }

        .dv-apercu { width: 100%; padding: 10px 14px; border: 1px solid #E8E8E8; border-radius: 5px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 600; color: #666; cursor: pointer; background: #FAFAFA; transition: all .15s; }
        .dv-apercu:hover { border-color: var(--primary-yellow); color: #333; background: #FFF8E1; }
        .dv-apercu::before { content: "📄"; font-size: 14px; }

        /* Modal client picker */
        .dvbtp-modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .dvbtp-modal { background: #fff; border-radius: 8px; width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto; padding: 1.5rem; }
        .dvbtp-modal h3 { font-size: 15px; font-weight: 600; margin-bottom: 1rem; }
        .dvbtp-modal .picker-search { width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 5px; font-size: 12px; margin-bottom: 1rem; }
        .dvbtp-modal .picker-list { max-height: 50vh; overflow-y: auto; }
        .dvbtp-modal .picker-item { padding: 10px 12px; border: 1px solid #F0F0F0; border-radius: 5px; margin-bottom: 6px; cursor: pointer; transition: all .15s; }
        .dvbtp-modal .picker-item:hover { background: #FFF8E1; border-color: var(--primary-yellow); }
        .dvbtp-modal .picker-item .nm { font-size: 13px; font-weight: 600; color: #333; }
        .dvbtp-modal .picker-item .meta { font-size: 11px; color: #888; margin-top: 2px; }
        .dvbtp-modal-foot { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; padding-top: .85rem; border-top: 1px solid #F0F0F0; }
        .dvbtp-modal-btn { padding: 7px 14px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; }
        .dvbtp-modal-btn.primary { background: var(--primary-yellow); border-color: var(--primary-yellow); color: #333; }
      `}</style>

      {/* ========== TOP BAR ========== */}
      <div className="devis-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button className="devis-back" onClick={onBack} type="button">← Retour</button>
          <span className="devis-top-title">
            {docType === 'devis' ? 'Nouveau devis' : 'Nouvelle facture proforma'}
          </span>
          <span className="dv-doc-num">{docNumber}</span>
          <span className="dv-doc-type-switch" role="tablist">
            <button type="button" className={docType === 'devis' ? 'active' : ''} onClick={() => setDocType('devis')}>Devis</button>
            <button type="button" className={docType === 'facture' ? 'active' : ''} onClick={() => setDocType('facture')}>Facture proforma</button>
          </span>
        </div>
        <div className="devis-top-right">
          <button className="devis-top-btn" type="button" disabled={pdfLoading} onClick={() => generatePdf('preview')}>
            {pdfLoading ? '…' : 'Aperçu PDF'}
          </button>
          <button className="devis-top-btn cta" type="button" disabled={saving} onClick={saveAndSend}>
            {saving ? 'Enregistrement…' : 'Enregistrer le devis'}
          </button>
        </div>
      </div>

      {/* ========== LAYOUT 2 COL ========== */}
      <div className="devis-layout">

        {/* ─────────── LEFT : MAIN FORM ─────────── */}
        <div>

          {/* 1. OBJET DU DEVIS */}
          <div className="dv-section">
            <div className="dv-section-t">OBJET DU DEVIS</div>
            <div className="dv-fg" style={{ marginBottom: '.75rem' }}>
              <label>Titre / Objet <span style={{ fontWeight: 400, color: '#999' }}>(ex : Nettoyage parc, Rénovation cuisine…)</span></label>
              <input type="text" placeholder="Ex : Nettoyage parc résidence Les Acacias" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            </div>

            <div className="dv-alert green">
              <strong>CONFORMITÉ LÉGALE FRANÇAISE</strong><br />
              Ce document respecte les obligations légales françaises (Code de commerce, Code de la consommation). Toutes les mentions obligatoires sont incluses.
            </div>

            <div className="dv-import-card">
              <button
                type="button"
                className="dv-import-toggle"
                onClick={() => setShowImportList(!showImportList)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dv-import-title">Import rapide depuis intervention ⚡</span>
                  <span className="dv-import-badge">{importableBookings.length} dispo</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A5C00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showImportList ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showImportList && (
                <>
                  <div className="dv-import-sub">Pré-remplit automatiquement vos infos, celles du client et le motif — tout reste modifiable</div>
                  {importableBookings.length === 0 ? (
                    <div className="dv-import-empty">
                      <strong>Aucune intervention confirmée ou terminée</strong>
                      <span className="hint">Dès qu&apos;un rendez-vous sera confirmé ou terminé, il apparaîtra ici</span>
                    </div>
                  ) : (
                    <div className="dv-import-list">
                      {importableBookings.map((b) => (
                        <div key={b.id} className="dv-import-item" onClick={() => importFromBooking(b.id)}>
                          <div>
                            <div className="nm">{b.client_name || 'Client'}</div>
                            <div className="meta">{b.services?.name || 'Intervention'}{b.booking_date ? ` · ${b.booking_date}` : ''}</div>
                          </div>
                          <span style={{ fontSize: 11, color: '#7A5C00', fontWeight: 700 }}>Importer →</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 2. INFORMATIONS ENTREPRISE */}
          <div className="dv-section">
            <div className="dv-section-t">INFORMATIONS ENTREPRISE (PRESTATAIRE)</div>
            <div className="dv-alert orange">
              <strong>Données non vérifiées</strong> — Les informations entreprise n&apos;ont pas pu être confirmées via le registre officiel. Remplissez manuellement.
            </div>

            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Statut juridique <span className="req">*</span></label>
              <select value={statutJuridique} onChange={(e) => setStatutJuridique(e.target.value)}>
                {STATUTS_JURIDIQUES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="dv-row">
              <div className="dv-fg"><label>Raison sociale <span className="req">*</span></label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
              <div className="dv-fg"><label>SIRET <span className="req">*</span></label><input type="text" placeholder="123 456 789 00012" value={companySiret} onChange={(e) => setCompanySiret(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>Adresse siège social <span className="req">*</span></label><input type="text" placeholder="Adresse complète" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>RCS / RM <span className="req">*</span></label><input type="text" placeholder="Ex : RM Marseille 953951589" value={companyRCS} onChange={(e) => setCompanyRCS(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Téléphone <span className="req">*</span></label><input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} /></div>
              <div className="dv-fg"><label>Email <span className="req">*</span></label><input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} /></div>
            </div>
            <div className="dv-row col3">
              <div className="dv-fg"><label>N° TVA intracommunautaire <span style={{ color: '#999', fontWeight: 400 }}>(si assujetti)</span></label><input type="text" placeholder="FR 00 123456789" value={tvaNumber} onChange={(e) => setTvaNumber(e.target.value)} /></div>
              <div className="dv-fg"><label>Code APE / NAF</label><input type="text" placeholder="Ex : 4339Z" value={companyAPE} onChange={(e) => setCompanyAPE(e.target.value)} /></div>
              <div className="dv-fg"><label>Capital social <span style={{ color: '#999', fontWeight: 400 }}>(SARL/SAS/SA)</span></label><input type="text" placeholder="Ex : 10 000 €" value={companyCapital} onChange={(e) => setCompanyCapital(e.target.value)} /></div>
            </div>
          </div>

          {/* 3. ASSURANCE & MÉDIATION */}
          <div className="dv-section">
            <div className="dv-section-t">ASSURANCE &amp; MÉDIATION</div>
            <div className="dv-alert orange" style={{ marginBottom: '1rem' }}>
              <strong>OBLIGATOIRE : Assurance Décennale / RC Pro (Loi Pinel 2014)</strong><br />
              Mention obligatoire sur tous les devis et factures BTP — Absence sanctionnée jusqu&apos;à 75 000 €
            </div>

            <div className="dv-row">
              <div className="dv-fg">
                <label>Type d&apos;assurance <span className="req">*</span></label>
                <select value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as 'rc_pro' | 'decennale' | 'both')}>
                  {TYPES_ASSURANCE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="dv-fg">
                <label>Nom de l&apos;assureur <span className="req">*</span></label>
                <input type="text" placeholder="Ex : MAAF Assurances" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)} />
              </div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>N° de contrat <span className="req">*</span></label><input type="text" placeholder="Ex : RC-2024-123456" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} /></div>
              <div className="dv-fg"><label>Couverture géographique <span className="req">*</span></label><input type="text" placeholder="France métropolitaine" value={insuranceCoverage} onChange={(e) => setInsuranceCoverage(e.target.value)} /></div>
            </div>

            <div className="dv-alert blue" style={{ marginTop: '.5rem' }}>
              <strong>OBLIGATOIRE : Médiateur de la consommation (depuis 01/01/2016)</strong><br />
              Tout professionnel doit communiquer les coordonnées de son médiateur — Absence sanctionnée jusqu&apos;à 15 000 €
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Nom du médiateur</label><input type="text" placeholder="Ex : Médiation de la consommation — CNPM" value={mediatorName} onChange={(e) => setMediatorName(e.target.value)} /></div>
              <div className="dv-fg"><label>Site web du médiateur</label><input type="text" placeholder="Ex : https://www.cnpm-mediation.fr" value={mediatorUrl} onChange={(e) => setMediatorUrl(e.target.value)} /></div>
            </div>
          </div>

          {/* 4. CONFIGURATION TVA */}
          <div className="dv-section">
            <div className="dv-section-t">CONFIGURATION TVA</div>
            <div className="dv-toggle-row">
              <label className="tgl"><input type="checkbox" checked={!tvaEnabled} onChange={(e) => setTvaEnabled(!e.target.checked)} /><span className="sl"></span></label>
              <div>
                <div className="dv-toggle-label">Entreprise sans TVA</div>
                <div className="dv-toggle-sub">Auto-entrepreneur ou franchise en base (art. 293 B du CGI)</div>
              </div>
            </div>
            {!tvaEnabled && (
              <div className="dv-alert blue" style={{ marginTop: '.5rem' }}>
                TVA non applicable — mention « TVA non applicable, art. 293 B du CGI » ajoutée automatiquement sur vos documents.
              </div>
            )}
          </div>

          {/* 5. INFORMATIONS CLIENT */}
          <div className="dv-section">
            <div className="dv-section-head">
              <div className="dv-section-t">INFORMATIONS CLIENT</div>
              <button className="btn-link-client" type="button" onClick={openClientPicker}>+ Importer depuis la base client</button>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Nom / Raison sociale <span className="req">*</span></label><input type="text" placeholder="Ex : Marie Dubois" value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
              <div className="dv-fg"><label>Email</label><input type="email" placeholder="marie.dubois@email.fr" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Téléphone</label><input type="text" placeholder="06 …" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
              <div className="dv-fg"><label>SIRET <span style={{ color: '#999', fontWeight: 400 }}>(si pro / syndic)</span></label><input type="text" placeholder="123 456 789 00012" value={clientSiret} onChange={(e) => setClientSiret(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>Adresse complète (siège / domicile) <span className="req">*</span></label><input type="text" placeholder="12 rue de la Paix, 75002 Paris" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>Lieu d&apos;intervention</label><input type="text" placeholder="Ex : Résidence Le Mail, 15 rue des Lilas, 13001 Marseille" value={interventionAddress} onChange={(e) => setInterventionAddress(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Bâtiment</label><input type="text" placeholder="Ex : B" value={interventionBatiment} onChange={(e) => setInterventionBatiment(e.target.value)} /></div>
              <div className="dv-fg"><label>Étage</label><input type="text" placeholder="Ex : 6" value={interventionEtage} onChange={(e) => setInterventionEtage(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Espaces communs</label><input type="text" placeholder="Ex : Hall, cage d'escalier" value={interventionEspacesCommuns} onChange={(e) => setInterventionEspacesCommuns(e.target.value)} /></div>
              <div className="dv-fg"><label>Extérieur</label><input type="text" placeholder="Ex : Parking, jardin" value={interventionExterieur} onChange={(e) => setInterventionExterieur(e.target.value)} /></div>
            </div>
          </div>

          {/* 6. INFORMATIONS DOCUMENT */}
          <div className="dv-section">
            <div className="dv-section-t">INFORMATIONS DOCUMENT</div>
            <div className="dv-row">
              <div className="dv-fg"><label>Date d&apos;émission <span className="req">*</span></label><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></div>
              <div className="dv-fg"><label>Validité (jours) <span className="req">*</span></label><input type="number" value={docValidity} min={1} onChange={(e) => setDocValidity(parseInt(e.target.value) || 30)} /></div>
            </div>
            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Délai d&apos;exécution <span className="req">*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" placeholder="Nb" style={{ width: 80 }} value={executionDelayDays || ''} onChange={(e) => setExecutionDelayDays(parseInt(e.target.value) || 0)} />
                <select style={{ flex: 1 }} value={executionDelayType} onChange={(e) => setExecutionDelayType(e.target.value)}>
                  <option value="ouvres">jours ouvrés</option>
                  <option value="calendaires">jours calendaires</option>
                  <option value="semaines">semaines</option>
                  <option value="mois">mois</option>
                </select>
              </div>
            </div>
            <div className="dv-info-strip">
              <div className="ico">⚖️</div>
              <div className="txt">
                <div className="ttl">Droit de rétractation 14 jours inclus</div>
                <div className="sub">Contrat hors établissement (domicile du client, chantier, démarchage, à distance) — Mention obligatoire art. L. 221-18 C. conso.</div>
              </div>
            </div>
          </div>

          {/* 7. DÉTAIL DES PRESTATIONS */}
          <div className="dv-section">
            <div className="dv-section-head">
              <div className="dv-section-t">DÉTAIL DES PRESTATIONS</div>
              <div className="dv-mode-switch" role="tablist" aria-label="Mode de saisie des prix">
                <button type="button" className={priceMode === 'ht' ? 'active' : ''} onClick={() => setPriceMode('ht')}>HORS TAXES</button>
                <button type="button" className={priceMode === 'ttc' ? 'active' : ''} onClick={() => setPriceMode('ttc')}>TTC</button>
              </div>
            </div>
            <table className="dv-presta-table">
              <colgroup>
                <col style={{ width: '26%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>DÉSIGNATION</th>
                  <th>QTÉ</th>
                  <th>UNITÉ</th>
                  <th>PRIX U. {priceMode === 'ht' ? 'HT' : 'TTC'}</th>
                  <th>TVA %</th>
                  <th>TOTAL HT</th>
                  <th>TOTAL TTC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const lineHT = (l.qty || 0) * (l.priceHT || 0)
                  const lineTTC = lineHT * (1 + (l.tvaRate || 0) / 100)
                  return (
                    <tr key={l.id}>
                      <td>
                        <input type="text" placeholder="Ex : Démolition cloisons + évacuation gravats" value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} />
                      </td>
                      <td><input type="number" min={0} step={1} value={l.qty} onChange={(e) => updateLine(l.id, { qty: parseFloat(e.target.value) || 0 })} /></td>
                      <td>
                        <select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })}>
                          {UNITES_TABLEAU.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </td>
                      <td><input type="number" min={0} step={0.01} value={l.priceHT} onChange={(e) => updateLine(l.id, { priceHT: parseFloat(e.target.value) || 0 })} /></td>
                      <td>
                        <select value={l.tvaRate} onChange={(e) => updateLine(l.id, { tvaRate: parseFloat(e.target.value) })} disabled={!tvaEnabled}>
                          {TVA_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td className="amount col-ht">{fmt(lineHT)}</td>
                      <td className="amount">{fmt(lineTTC)}</td>
                      <td><button className="dv-presta-del" type="button" aria-label="Supprimer la ligne" onClick={() => removeLine(l.id)}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
              <button className="dv-add-line" type="button" onClick={addLine}>+ Ajouter une ligne</button>
              <button className="dv-scanner-btn" type="button" onClick={() => toast.info('Scanner ticket — bientôt disponible')}>📷 Scanner ticket</button>
            </div>
          </div>

          {/* 8. ACOMPTES & PAIEMENT ÉCHELONNÉ */}
          <div className="dv-section">
            <div className="dv-section-head">
              <div className="dv-section-t">ACOMPTES &amp; PAIEMENT ÉCHELONNÉ</div>
              <label className="tgl"><input type="checkbox" checked={acomptesEnabled} onChange={(e) => setAcomptesEnabled(e.target.checked)} /><span className="sl"></span></label>
            </div>
            {acomptesEnabled && (
              <>
                {acomptes.map((a) => {
                  const eq = totaux.totalTTC * (a.pourcentage / 100)
                  return (
                    <div key={a.id} className="dv-acompte-row">
                      <select value={a.declencheur} onChange={(e) => updateAcompte(a.id, { declencheur: e.target.value })}>
                        {DECLENCHEURS_ACOMPTE.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input type="number" min={0} max={100} value={a.pourcentage} onChange={(e) => updateAcompte(a.id, { pourcentage: parseFloat(e.target.value) || 0 })} />
                      <span className="dv-acompte-pct">%</span>
                      <span className="dv-acompte-eq">= {fmt(eq)}</span>
                      <button className="dv-acompte-del" type="button" onClick={() => removeAcompte(a.id)}>✕</button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: '.5rem' }}>
                  <button className="devis-top-btn" type="button" style={{ fontSize: 11 }} onClick={addAcompte}>+ Ajouter un acompte</button>
                  <button className="devis-top-btn" type="button" style={{ fontSize: 11 }} onClick={saveEcheancierAsDefault}>Enregistrer comme défaut</button>
                </div>
                <div className={`dv-echelon-warning ${totalAcomptePct === 100 ? 'green' : 'orange'}`}>
                  Total échelonné : {totalAcomptePct.toFixed(0)}% {totalAcomptePct === 100 ? '✓' : '⚠️'}
                  <span className="sub">
                    {totalAcomptePct === 100
                      ? 'Le règlement est intégralement réparti.'
                      : `Les ${(100 - totalAcomptePct).toFixed(0)}% restants seront réglés séparément.`
                    }
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 9. MODALITÉS DE PAIEMENT */}
          <div className="dv-section">
            <div className="dv-section-t">MODALITÉS DE PAIEMENT</div>
            <div className="dv-row">
              <div className="dv-fg">
                <label>Mode de paiement accepté <span className="req">*</span></label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="dv-fg">
                <label>Délai de paiement <span className="req">*</span></label>
                <select value={paymentDelay} onChange={(e) => setPaymentDelay(e.target.value)}>
                  {DELAIS_PAIEMENT.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="dv-row">
              <div className="dv-fg">
                <label>Taux des pénalités de retard <span className="req">*</span> <span style={{ color: '#999', fontWeight: 400 }}>(art. L. 441-10)</span></label>
                <input type="text" value={penaltyRate} onChange={(e) => setPenaltyRate(e.target.value)} />
              </div>
              <div className="dv-fg">
                <label>Indemnité forfaitaire frais de recouvrement <span className="req">*</span></label>
                <input type="text" value={recoveryFee} onChange={(e) => setRecoveryFee(e.target.value)} />
              </div>
            </div>
            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Escompte pour paiement anticipé <span className="req">*</span> <span style={{ color: '#999', fontWeight: 400 }}>(art. L. 441-9 — obligatoire même si nul)</span></label>
              <select value={escompte} onChange={(e) => setEscompte(e.target.value)}>
                {ESCOMPTES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="dv-info-strip">
              <div className="ico">ℹ️</div>
              <div className="txt">
                <div className="ttl">RIB &amp; coordonnées bancaires</div>
                <div className="sub">Le RIB sera ajouté automatiquement au pied du PDF (depuis vos paramètres entreprise).</div>
              </div>
            </div>
          </div>

          {/* 10. GARANTIES LÉGALES */}
          <div className="dv-section">
            <div className="dv-section-t">GARANTIES LÉGALES (CLIENT PARTICULIER)</div>
            <div className="dv-info-strip">
              <div className="ico">🛡️</div>
              <div className="txt">
                <div className="ttl">Garanties légales applicables (mention automatique sur le PDF)</div>
                <div className="sub">Garantie de parfait achèvement (1 an, art. 1792-6 C. civ.) · Garantie biennale de bon fonctionnement (2 ans, art. 1792-3) · Garantie décennale (10 ans, art. 1792) · Garantie légale de conformité (art. L. 217-3 C. conso.) · Garantie des vices cachés (art. 1641 C. civ.).</div>
              </div>
            </div>
          </div>

          {/* 11. NOTES COMPLÉMENTAIRES */}
          <div className="dv-section">
            <div className="dv-section-t">NOTES COMPLÉMENTAIRES</div>
            <div className="dv-fg">
              <textarea placeholder="Notes optionnelles visibles par le client (conditions particulières, précisions techniques, etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* 12. RAPPORT D'INTERVENTION */}
          <div className="dv-section">
            <div className="dv-section-t">JOINDRE UN RAPPORT D&apos;INTERVENTION</div>
            <div style={{ fontSize: 12, color: '#888' }}>Aucun rapport disponible. Créez d&apos;abord un rapport dans l&apos;onglet Rapports.</div>
          </div>

          {/* 13. PHOTOS CHANTIER */}
          <div className="dv-section">
            <div className="dv-section-t">JOINDRE DES PHOTOS CHANTIER</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: '.4rem' }}>
              Photos géolocalisées et horodatées prises depuis l&apos;application mobile. Elles seront ajoutées en annexe du document PDF.
            </div>
            <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
              Aucune photo disponible. Prenez des photos depuis l&apos;application mobile (onglet Documents → Photos Chantier).
            </div>
          </div>

          {/* 14. MENTIONS LÉGALES */}
          <div className="dv-section">
            <div className="dv-section-t">MENTIONS LÉGALES AUTOMATIQUES</div>
            <div className="dv-mentions">
              {statutJuridique === 'Entreprise Individuelle (EI)' && (
                <>Entrepreneur individuel (EI) — Loi n°2022-172 du 14 février 2022 relative au statut de l&apos;entrepreneur individuel<br /></>
              )}
              {!tvaEnabled && (
                <>TVA non applicable, article 293 B du CGI (franchise en base de TVA)<br /></>
              )}
              Devis gratuit — Conformément à l&apos;article L. 111-1 du Code de la consommation<br />
              Ce devis est valable {docValidity} jours à compter de sa date d&apos;émission<br />
              Devis reçu avant l&apos;exécution des travaux — Arrêté du 2 mars 1990 relatif à la publicité des prix dans le bâtiment<br /><br />
              ACCEPTATION : Le PDF généré inclut une zone signature client + prestataire avec mention manuscrite obligatoire « Bon pour accord ». Signature électronique conforme eIDAS également proposée à l&apos;envoi.<br /><br />
              DROIT DE RÉTRACTATION : Conformément à l&apos;article L. 221-18 du Code de la consommation, le client dispose d&apos;un délai de 14 jours à compter de la signature pour exercer son droit de rétractation, sans motif ni pénalité.<br /><br />
              Aucun paiement ne peut être exigé avant l&apos;expiration d&apos;un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demandés expressément par le client.<br /><br />
              GARANTIES LÉGALES : parfait achèvement (1 an), bon fonctionnement (2 ans), décennale (10 ans) — articles 1792 et suivants du Code civil. Garantie légale de conformité (art. L. 217-3 C. conso.) et garantie des vices cachés (art. 1641 C. civ.).<br /><br />
              Médiation de la consommation (art. L. 612-1 C. conso.) : en cas de litige, le client peut recourir gratuitement à un médiateur de la consommation.
            </div>
          </div>

        </div>

        {/* ─────────── RIGHT : SIDEBAR ─────────── */}
        <div className="dv-sidebar">

          {/* RÉSUMÉ */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">RÉSUMÉ</div>
            <div className="dv-resume-row"><span>Sous-total brut</span><span>{fmt(totaux.subTotalBrut)}</span></div>
            <div className="dv-resume-row"><span>Remise</span><span>− {fmt(totaux.remise)}</span></div>
            <div className="dv-resume-row subtotal"><span>Total HT</span><span>{fmt(totaux.totalHT)}</span></div>
            {tvaEnabled ? (
              totaux.tvaEntries.length === 0 ? (
                <div className="dv-resume-row tva"><span>TVA 20 %</span><span>{fmt(0)}</span></div>
              ) : (
                <>
                  {totaux.tvaEntries.map(([taux, montant]) => (
                    <div key={taux} className="dv-resume-row tva">
                      <span>TVA {taux} %</span>
                      <span>{fmt(montant)}</span>
                    </div>
                  ))}
                  {totaux.tvaEntries.length > 1 && (
                    <div className="dv-resume-row tva-total"><span>Total TVA</span><span>{fmt(totaux.totalTva)}</span></div>
                  )}
                </>
              )
            ) : null}
            <div className="dv-resume-row total"><span>TOTAL TTC</span><span>{fmt(totaux.totalTTC)}</span></div>
          </div>

          {/* CONFORMITÉ LÉGALE */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">CONFORMITÉ LÉGALE</div>
            <div className="dv-conf-status">Statut : <strong>{statutJuridique}</strong></div>
            {([
              ['SIRET', conformite.siret],
              ['RCS / RM', conformite.rcs],
              ['Assurance RC Pro', conformite.assurance],
              ['Médiateur conso.', conformite.mediateur],
              ['Client renseigné', conformite.client],
              ['Prestations détaillées', conformite.prestations],
              ['Pénalités de retard', conformite.penalites],
              ['Escompte (mention)', conformite.escompte],
            ] as [string, boolean][]).map(([label, ok]) => (
              <div key={label} className="dv-conf-item">
                <span>{label}</span>
                <span className={ok ? 'dv-conf-check' : 'dv-conf-x'}>{ok ? '✓' : '✕'}</span>
              </div>
            ))}
          </div>

          {/* RENTABILITÉ */}
          <div className="dv-sidebar-card">
            <button className="dv-sidebar-btn outline-blue" type="button" onClick={() => setShowRentaModal(true)}>📊 Rentabilité du devis</button>
          </div>

          {/* APERÇU */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">APERÇU</div>
            <div className="dv-apercu" onClick={() => generatePdf('preview')}>
              {pdfLoading ? 'Génération…' : 'Cliquez pour prévisualiser le PDF'}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">ACTIONS</div>
            <button className="dv-sidebar-btn" type="button" disabled={saving} onClick={saveDraft}>
              {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
            </button>
            <button className="dv-sidebar-btn yellow" type="button" disabled={pdfLoading} onClick={() => generatePdf('download')}>
              {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
            </button>
            <button className="dv-sidebar-btn green" type="button" disabled={saving} onClick={saveAndSend}>
              {saving ? 'Validation…' : 'Valider et envoyer'}
            </button>
          </div>

        </div>
      </div>

      {/* ============ MODAL : Client picker ============ */}
      {showClientPicker && (
        <div className="dvbtp-modal-ov" onClick={() => setShowClientPicker(false)}>
          <div className="dvbtp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Importer depuis la base client</h3>
            <input
              className="picker-search"
              type="text"
              placeholder="Rechercher (nom, email, SIRET…)"
              value={clientDbSearch}
              onChange={(e) => setClientDbSearch(e.target.value)}
              autoFocus
            />
            <div className="picker-list">
              {clientDbLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>Chargement…</div>
              ) : clientDb.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>
                  Aucun client trouvé. Créez vos clients depuis l&apos;onglet Clients.
                </div>
              ) : (
                clientDb
                  .filter((c) => {
                    if (!clientDbSearch.trim()) return true
                    const q = clientDbSearch.toLowerCase()
                    return (c.name || '').toLowerCase().includes(q)
                      || (c.email || '').toLowerCase().includes(q)
                      || (c.siret || '').toLowerCase().includes(q)
                  })
                  .slice(0, 30)
                  .map((c) => (
                    <div key={c.id} className="picker-item" onClick={() => selectClient(c)}>
                      <div className="nm">{c.name}</div>
                      <div className="meta">
                        {[c.email, c.phone, c.siret].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  ))
              )}
            </div>
            <div className="dvbtp-modal-foot">
              <button className="dvbtp-modal-btn" type="button" onClick={() => setShowClientPicker(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL : Rentabilité (placeholder) ============ */}
      {showRentaModal && (
        <div className="dvbtp-modal-ov" onClick={() => setShowRentaModal(false)}>
          <div className="dvbtp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📊 Rentabilité du devis</h3>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Total TTC :</strong> {fmt(totaux.totalTTC)} ({fmt(totaux.totalHT)} HT)
              </p>
              <p style={{ marginBottom: 8 }}>
                Le module complet (calcul coût salarié + marge + frais généraux) est disponible
                dans le composant standard. Une version BTP enrichie sera branchée prochainement.
              </p>
            </div>
            <div className="dvbtp-modal-foot">
              <button className="dvbtp-modal-btn" type="button" onClick={() => setShowRentaModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

