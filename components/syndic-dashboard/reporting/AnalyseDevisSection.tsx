'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Artisan, Mission, Page, DevisExtracted, InputMode } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { User } from '@supabase/supabase-js'

interface DevisScores {
  conformite: { total: number; max: number; details: { id?: string; label: string; ok?: boolean; status?: string; points?: number; poids?: number }[] }
  prix: { ecart_moyen_pct: number; details?: { designation: string; status: string }[] }
  confiance: number
}

interface SiretResult {
  verified: boolean
  company?: {
    name: string
    siret: string
    nafLabel: string
    nafCode: string
    legalForm: string
  }
}

function formatAnalysis(text: string): string {
  if (!text) return ''
  return safeMarkdownToHTML(text)
}

export default function AnalyseDevisSection({ artisans, setPage, missions, setMissions, user }: { artisans: Artisan[]; setPage: (p: Page) => void; missions: Mission[]; setMissions: React.Dispatch<React.SetStateAction<Mission[]>>; user: User }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [mode, setMode] = useState<'main' | 'history'>('main')
  const [inputMode, setInputMode] = useState<InputMode>('drop')
  const [docText, setDocText] = useState('')
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<DevisExtracted | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<{ id: string; filename: string; date: string; verdict: string; score: string; analysis: string; extracted?: DevisExtracted; scores?: DevisScores }[]>([])
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)
  const [scores, setScores] = useState<DevisScores | null>(null)
  const [siretResult, setSiretResult] = useState<SiretResult | null>(null)
  const [isVitfix, setIsVitfix] = useState(false)
  const [accordion, setAccordion] = useState<string | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [missionForm, setMissionForm] = useState({
    artisan: '', immeuble: '', adresseImmeuble: '', batiment: '', etage: '', numLot: '',
    locataire: '', telephoneLocataire: '', accesLogement: '',
    type: '', description: '',
    priorite: 'normale' as 'urgente' | 'normale' | 'planifiee',
    montantDevis: 0, dateIntervention: '',
  })
  const [missionCreating, setMissionCreating] = useState(false)
  const [missionSuccess, setMissionSuccess] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vitfix_analyse_devis_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  const handleFileDrop = async (file: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError(isPt ? 'Apenas são aceites ficheiros PDF.' : 'Seuls les fichiers PDF sont acceptés.')
      return
    }
    setError('')
    setExtracting(true)
    setPdfReady(false)
    setDocText('')
    setFilename(file.name)
    setAnalysis(null)
    setExtracted(null)
    setMissionSuccess(false)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/syndic/extract-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.isScanned) {
          setError(isPt
            ? 'Este PDF é um documento digitalizado (imagem). Por favor, copie e cole o texto manualmente no separador "Inserir o texto".'
            : 'Ce PDF est un document scanné (image). Veuillez copier-coller le texte manuellement dans l\'onglet "Saisir le texte".')
          setInputMode('paste')
        } else if (data.isPasswordProtected) {
          setError(isPt
            ? 'Este PDF está protegido por palavra-passe. Desbloqueie-o primeiro (abra-o, vá a Ficheiro → Exportar/Guardar como sem palavra-passe), depois tente novamente.'
            : 'Ce PDF est protégé par un mot de passe. Déverrouillez-le d\'abord (ouvrez-le, allez dans Fichier → Exporter/Enregistrer sous sans mot de passe), puis réessayez.')
        } else if (data.isCorrupt) {
          setError(isPt
            ? 'Este ficheiro PDF parece estar corrompido ou inválido. Tente abri-lo num leitor de PDF e voltar a exportá-lo.'
            : 'Ce fichier PDF semble corrompu ou invalide. Essayez de l\'ouvrir dans un lecteur PDF et de le ré-exporter.')
        } else {
          setError(data.error || (isPt
            ? 'Erro ao extrair o PDF. Tente novamente ou utilize o separador "Inserir o texto".'
            : 'Erreur lors de l\'extraction du PDF. Réessayez ou utilisez l\'onglet "Saisir le texte".'))
        }
        return
      }
      setDocText(data.text)
      setPdfReady(true)
    } catch {
      setError(isPt ? 'Erro de rede durante a extração' : 'Erreur réseau lors de l\'extraction')
    } finally {
      setExtracting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileDrop(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileDrop(file)
    e.target.value = ''
  }

  const saveToHistory = (fname: string, result: string, ext?: DevisExtracted) => {
    const verdictMatch = result.match(/\*\*Statut\*\*\s*:\s*([^\n]+)/)
    const scoreMatch = result.match(/\*\*Score de conformité\*\*\s*:\s*([^\n]+)/)
    const entry = {
      id: Date.now().toString(),
      filename: fname || (isPt ? 'Documento sem nome' : 'Document sans nom'),
      date: new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR'),
      verdict: verdictMatch ? verdictMatch[1].trim() : '—',
      score: scoreMatch ? scoreMatch[1].trim() : '—',
      analysis: result,
      extracted: ext,
    }
    const updated = [entry, ...history].slice(0, 20)
    setHistory(updated)
    try { localStorage.setItem('vitfix_analyse_devis_history', JSON.stringify(updated)) } catch {}
  }

  const handleAnalyse = async () => {
    if (!docText.trim() || loading) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    setExtracted(null)
    setScores(null)
    setSiretResult(null)
    setAccordion(null)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/syndic/analyse-devis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ content: docText, filename, locale }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || (isPt ? 'Erro durante a análise' : 'Erreur lors de l\'analyse')); return }
      setAnalysis(data.analysis)
      setExtracted(data.extracted || null)
      setScores(data.scores || null)
      setSiretResult(data.siret || null)
      setIsVitfix(data.isVitfix || false)
      saveToHistory(filename || (isPt ? 'Documento analisado' : 'Document analysé'), data.analysis, data.extracted)
    } catch {
      setError(isPt ? 'Erro de rede, por favor tente novamente.' : 'Erreur réseau, veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setDocText('')
    setFilename('')
    setAnalysis(null)
    setExtracted(null)
    setError('')
    setPdfReady(false)
    setMissionSuccess(false)
    setScores(null)
    setSiretResult(null)
    setIsVitfix(false)
    setAccordion(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenMissionModal = (ext: DevisExtracted) => {
    const matchedArtisan = artisans.find(a => {
      if (ext.artisan_email && a.email?.toLowerCase() === ext.artisan_email.toLowerCase()) return true
      if (ext.artisan_nom && a.nom?.toLowerCase().includes(ext.artisan_nom.toLowerCase())) return true
      if (ext.artisan_nom && ext.artisan_nom.toLowerCase().includes(a.nom?.toLowerCase() || '')) return true
      return false
    })
    setMissionForm({
      artisan: matchedArtisan?.nom || ext.artisan_nom || '',
      immeuble: ext.immeuble || '',
      adresseImmeuble: '',
      batiment: '',
      etage: '',
      numLot: '',
      locataire: '',
      telephoneLocataire: '',
      accesLogement: '',
      type: ext.artisan_metier || '',
      description: ext.description_travaux || '',
      priorite: ext.priorite || 'normale',
      montantDevis: ext.montant_ht || 0,
      dateIntervention: ext.date_intervention || '',
    })
    setShowMissionModal(true)
  }

  const handleCreateMission = async () => {
    if (!missionForm.artisan || !missionForm.description) return
    setMissionCreating(true)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const artisanObj = artisans.find(a => a.nom === missionForm.artisan)
      const artisanEmail = artisanObj?.email || ''

      const res = await fetch('/api/syndic/assign-mission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          artisan_email: artisanEmail,
          artisan_name: missionForm.artisan,
          description: missionForm.description,
          type: missionForm.type,
          immeuble: missionForm.immeuble,
          priorite: missionForm.priorite,
          montant_devis: missionForm.montantDevis,
          date_intervention: missionForm.dateIntervention || null,
          source: 'devis_analyse',
        }),
      })
      const data = await res.json()

      const buildMission = () => {
        const newMissionId = `mission_${Date.now()}`
        const now = new Date()
        const dateIntervStr = missionForm.dateIntervention
          ? new Date(missionForm.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : (isPt ? 'a definir' : 'à définir')
        const localisationDetail = [
          missionForm.batiment ? `${isPt ? 'Bloco' : 'Bâtiment'} ${missionForm.batiment}` : null,
          missionForm.etage ? `${isPt ? 'Andar' : 'Étage'} ${missionForm.etage}` : null,
          missionForm.numLot ? `${isPt ? 'Apartamento / Fração' : 'Appartement / Lot'} ${missionForm.numLot}` : null,
        ].filter(Boolean).join(' · ')
        const locataireDetail = missionForm.locataire
          ? `\n👤 ${isPt ? 'Inquilino' : 'Locataire'} : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — ${isPt ? 'Tel' : 'Tél'} : ${missionForm.telephoneLocataire}` : ''}`
          : ''
        const accesDetail = missionForm.accesLogement ? `\n🔑 ${isPt ? 'Acesso' : 'Accès'} : ${missionForm.accesLogement}` : ''

        const msgAuto = isPt
          ? `📋 ORDEM DE MISSÃO — ${missionForm.type || 'Intervenção'}

Olá ${missionForm.artisan},

Foi-lhe atribuída uma intervenção:

🏢 Edifício : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Morada : ${missionForm.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Missão : ${missionForm.description}
📅 Data da intervenção : ${dateIntervStr}
⚡ Prioridade : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normal' : '⚪ Planeada'}${missionForm.montantDevis ? `\n💰 Orçamento : ${missionForm.montantDevis.toLocaleString('pt-PT')} € sem IVA` : ''}

Por favor confirme a receção desta ordem de missão respondendo neste canal.`
          : `📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${dateIntervStr}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

        const autoMsg = { auteur: isPt ? 'Gestor' : 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }
        const newMission: Mission = {
          id: newMissionId,
          immeuble: missionForm.immeuble,
          artisan: missionForm.artisan,
          type: missionForm.type || 'Intervention',
          description: missionForm.description,
          priorite: missionForm.priorite,
          statut: 'en_attente',
          dateCreation: now.toISOString(),
          dateIntervention: missionForm.dateIntervention || undefined,
          montantDevis: missionForm.montantDevis || undefined,
          batiment: missionForm.batiment || undefined,
          etage: missionForm.etage || undefined,
          numLot: missionForm.numLot || undefined,
          locataire: missionForm.locataire || undefined,
          telephoneLocataire: missionForm.telephoneLocataire || undefined,
          accesLogement: missionForm.accesLogement || undefined,
          canalMessages: [autoMsg],
        }
        const updatedMissions = [newMission, ...missions]
        setMissions(updatedMissions)
        try {
          const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
          localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify([newMission, ...stored]))
        } catch {}
        try {
          const artisanKey = `canal_missions_${artisanObj?.artisan_user_id || missionForm.artisan.replace(/\s+/g, '_').toLowerCase()}`
          const artisanMissions = JSON.parse(localStorage.getItem(artisanKey) || '[]')
          artisanMissions.unshift(newMission)
          localStorage.setItem(artisanKey, JSON.stringify(artisanMissions))
        } catch {}
        setMissionSuccess(true)
        setShowMissionModal(false)
        setMissionForm({
          artisan: '', immeuble: '', adresseImmeuble: '', batiment: '', etage: '', numLot: '',
          locataire: '', telephoneLocataire: '', accesLogement: '',
          type: '', description: '',
          priorite: 'normale',
          montantDevis: 0, dateIntervention: '',
        })
      }

      if (res.ok && data.success) {
        buildMission()
      } else {
        buildMission()
      }
    } catch {
      toast.error(isPt ? 'Erro de rede' : 'Erreur réseau')
    } finally {
      setMissionCreating(false)
    }
  }

  const getVerdictColor = (verdict: string) => {
    if (verdict.includes('CONFORME') && !verdict.includes('PARTIELLEMENT') && !verdict.includes('NON')) return 'text-green-700 bg-green-50 border-green-200'
    if (verdict.includes('PARTIELLEMENT')) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    if (verdict.includes('NON CONFORME')) return 'text-red-700 bg-red-50 border-red-200'
    return 'text-gray-700 bg-[#F7F4EE] border-gray-200'
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header — style premium navy/gold/Playfair (aligné Painel de Controlo) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 400, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.1 }}>
            🔍 {isPt ? 'Análise Orçamentos & Faturas' : 'Analyse Devis & Factures'}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 6, letterSpacing: '0.3px' }}>
            {isPt ? 'Conformidade jurídica · Referência de preços de mercado · Prevenção de litígios' : 'Conformité juridique · Benchmark prix marché · Prévention litiges'}
          </p>
        </div>
        <button
          onClick={() => setMode(mode === 'history' ? 'main' : 'history')}
          style={{
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, letterSpacing: '0.3px',
            background: mode === 'history' ? 'var(--sd-navy, #0D1B2E)' : '#fff',
            color: mode === 'history' ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
            border: mode === 'history' ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          🕐 {isPt ? 'Histórico' : 'Historique'} ({history.length})
        </button>
      </div>

      {/* Bandeaux info — cards blanches subtiles avec icône doré */}
      <div className="grid grid-cols-3 gap-4">
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--sd-gold-dim, rgba(201,168,76,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚖️</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{isPt ? 'Conformidade jurídica' : 'Conformité juridique'}</p>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{isPt ? 'NIF, IVA, Seguro RC, garantia decenal' : 'SIRET, TVA, RC Pro, garantie décennale'}</p>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--sd-teal-soft, #E6F4F2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💰</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{isPt ? 'Referência de preços de mercado' : 'Benchmark prix marché'}</p>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{isPt ? 'Tarifas 2024-2025 por ofício' : 'Tarifs 2024-2025 par corps de métier'}</p>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--sd-amber-soft, #FEF5E4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🛡️</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{isPt ? 'Prevenção de litígios' : 'Prévention litiges'}</p>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{isPt ? 'Deteção de riscos jurídicos' : 'Détection des risques juridiques'}</p>
          </div>
        </div>
      </div>

      {/* MODE PRINCIPAL */}
      {mode === 'main' && (
        <div className="space-y-4">
          {!analysis ? (
            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 14, overflow: 'hidden' }}>

              {/* Onglets PDF / Texte — style navy active, ink inactif (aligné Painel) */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                <button
                  onClick={() => { setInputMode('drop'); setError('') }}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: inputMode === 'drop' ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
                    color: inputMode === 'drop' ? '#fff' : 'var(--sd-ink-3, #8A9BB0)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  📄 {isPt ? 'Enviar um PDF' : 'Déposer un PDF'}
                </button>
                <button
                  onClick={() => { setInputMode('paste'); setError('') }}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: inputMode === 'paste' ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
                    color: inputMode === 'paste' ? '#fff' : 'var(--sd-ink-3, #8A9BB0)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  ✏️ {isPt ? 'Inserir o texto' : 'Saisir le texte'}
                </button>
                <button
                  onClick={() => { setInputMode('seguro'); setError('') }}
                  style={{
                    flex: 1, padding: '16px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: inputMode === 'seguro' ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
                    color: inputMode === 'seguro' ? '#fff' : 'var(--sd-ink-3, #8A9BB0)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  🛡️ {isPt ? 'Seguro' : 'Assurance'}
                </button>
              </div>

              <div className="p-6 space-y-4">

                {/* Zone Drop PDF — style premium cream/gold border */}
                {inputMode === 'drop' && (
                  <div className="space-y-4">
                    {!pdfReady ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          position: 'relative', borderRadius: 14, padding: 48, textAlign: 'center', cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: '2px dashed ' + (dragOver ? 'var(--sd-gold, #C9A84C)' : extracting ? 'var(--sd-gold-light, #D6BC6E)' : 'var(--sd-border, #E4DDD0)'),
                          background: dragOver ? 'var(--sd-gold-dim, rgba(201,168,76,0.08))' : extracting ? 'var(--sd-cream, #F7F4EE)' : 'var(--sd-cream, #F7F4EE)',
                          transform: dragOver ? 'scale(1.005)' : 'scale(1)',
                        }}
                        onMouseEnter={e => {
                          if (!dragOver && !extracting) {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--sd-gold, #C9A84C)'
                            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--sd-gold-dim, rgba(201,168,76,0.06))'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!dragOver && !extracting) {
                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--sd-border, #E4DDD0)'
                            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--sd-cream, #F7F4EE)'
                          }
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                        {extracting ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                            <div style={{ width: 44, height: 44, border: '3px solid var(--sd-gold, #C9A84C)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)' }}>{isPt ? 'A extrair o texto...' : 'Extraction du texte en cours...'}</p>
                            <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{filename}</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                            <div style={{ fontSize: 48 }}>📄</div>
                            <div>
                              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.2 }}>{isPt ? 'Arraste o seu PDF aqui' : 'Glissez votre PDF ici'}</p>
                              <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 6 }}>{isPt ? 'ou clique para selecionar um ficheiro' : 'ou cliquez pour sélectionner un fichier'}</p>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 12, fontWeight: 600, letterSpacing: '0.3px' }}>
                              📂 {isPt ? 'Escolher um PDF' : 'Choisir un PDF'}
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{isPt ? 'Orçamento, fatura, nota de encomenda — máx 20 Mo' : 'Devis, facture, bon de commande — max 20 Mo'}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div style={{ background: 'var(--sd-teal-soft, #E6F4F2)', border: '1px solid rgba(26,122,110,0.2)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 22 }}>✅</span>
                            <div>
                              <p style={{ fontWeight: 600, color: 'var(--sd-teal, #1A7A6E)', fontSize: 13 }}>{filename}</p>
                              <p style={{ fontSize: 11, color: 'var(--sd-teal, #1A7A6E)', opacity: 0.8 }}>{docText.length.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} {isPt ? 'caracteres extraídos · Pronto para analisar' : 'caractères extraits · Prêt à analyser'}</p>
                            </div>
                          </div>
                          <button
                            onClick={handleReset}
                            style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            {isPt ? 'Alterar' : 'Changer'} ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Zone Texte manuel */}
                {inputMode === 'paste' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        {isPt ? 'Nome do documento' : 'Nom du document'} <span className="font-normal text-gray-500">{isPt ? '(opcional)' : '(optionnel)'}</span>
                      </label>
                      <input
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        placeholder={isPt ? 'ex : Orçamento canalização João Silva — 24/02/2026' : 'ex : Devis plomberie Marc Fontaine — 24/02/2026'}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        {isPt ? 'Texto do documento' : 'Texto do documento'} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={docText}
                        onChange={e => setDocText(e.target.value)}
                        placeholder={isPt
                          ? "Cole aqui o conteúdo do orçamento ou da fatura...\n\nEx :\nEmpresa Silva Canalizações Lda\nNIF : 123456789\nORÇAMENTO N° 2026-042 — Data : 24/02/2026\nSubstituição coluna água quente cave\n1 275,00 € s/IVA — IVA 23% — Total c/IVA : 1 568,25 €\nSeguro RC Allianz n°12345, válido até 31/12/2026"
                          : "Collez ici le contenu du devis ou de la facture...\n\nEx :\nEntreprise Fontaine Plomberie SARL\nSIRET : 12345678901234\nDEVIS N° 2026-042 — Date : 24/02/2026\nRemplacement colonne eau chaude cave\n1 275,00 € HT — TVA 10% — Total TTC : 1 402,50 €\nRC Pro Allianz n°12345, valide jusqu'au 31/12/2026"}
                        rows={10}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono resize-y"
                      />
                      <p className="text-xs text-gray-500 mt-1">{docText.length} {isPt ? 'caracteres' : 'caractères'}</p>
                    </div>
                    <div className="bg-[#F7F4EE] rounded-xl p-3 border border-gray-100 text-xs text-gray-500 flex gap-2 items-start">
                      <span>💡</span>
                      <span>{isPt
                        ? 'Para extrair o texto de um PDF: abrir → Ctrl+A → Ctrl+C → colar aqui. Para um PDF digitalizado (imagem), use Google Lens ou Adobe Acrobat.'
                        : 'Pour extraire le texte d\'un PDF : ouvrir → Ctrl+A → Ctrl+C → coller ici. Pour un PDF scanné (image), utilisez Google Lens ou Adobe Acrobat.'}</span>
                    </div>
                  </div>
                )}

                {/* Zone Seguro — analyse assurances prestataires */}
                {inputMode === 'seguro' && (
                  <SeguroView locale={locale} isPt={isPt} />
                )}

                {/* Erreur */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton analyser — navy avec accent gold (style Painel) */}
                <button
                  onClick={handleAnalyse}
                  disabled={loading || extracting || docText.trim().length < 10}
                  style={{
                    width: '100%', padding: '14px 0', borderRadius: 12,
                    background: loading || extracting || docText.trim().length < 10 ? 'var(--sd-cream-dark, #EDE8DF)' : 'var(--sd-navy, #0D1B2E)',
                    color: loading || extracting || docText.trim().length < 10 ? 'var(--sd-ink-3, #8A9BB0)' : '#fff',
                    fontSize: 14, fontWeight: 600, letterSpacing: '0.4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    border: 'none', cursor: loading || extracting || docText.trim().length < 10 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s', boxShadow: !(loading || extracting || docText.trim().length < 10) ? '0 4px 12px rgba(13,27,46,0.15)' : 'none',
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      {isPt ? 'Análise IA em curso...' : 'Analyse IA en cours...'}
                    </>
                  ) : (
                    <>
                      <span style={{ color: 'var(--sd-gold, #C9A84C)' }}>🔍</span>
                      {isPt ? 'Analisar o documento' : 'Analyser le document'}
                    </>
                  )}
                </button>
              </div>
            </div>

          ) : (
            /* Résultat */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0D1B2E]">
                  📊 {isPt ? 'Resultado' : 'Résultat'} {filename && <span className="font-normal text-gray-500 text-base">— {filename}</span>}
                </h2>
                <button onClick={handleReset} className="text-sm text-[#C9A84C] hover:text-[#B8963D] font-semibold">
                  ← {isPt ? 'Nova análise' : 'Nouvelle analyse'}
                </button>
              </div>

              {/* Carte récap extraite + bouton mission */}
              {extracted && (extracted.artisan_nom || extracted.description_travaux) && (
                <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-2">{isPt ? 'Informações extraídas automaticamente' : 'Informations extraites automatiquement'}</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                        {extracted.artisan_nom && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🔧</span>
                            <span className="text-gray-700"><strong>{extracted.artisan_nom}</strong>{extracted.artisan_metier ? ` — ${extracted.artisan_metier}` : ''}</span>
                          </div>
                        )}
                        {extracted.description_travaux && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">📋</span>
                            <span className="text-gray-700 truncate">{extracted.description_travaux}</span>
                          </div>
                        )}
                        {extracted.immeuble && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🏢</span>
                            <span className="text-gray-700">{extracted.immeuble}</span>
                          </div>
                        )}
                        {(extracted.montant_ht || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">💰</span>
                            <span className="text-gray-700">
                              <strong>{extracted.montant_ht?.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}€ {isPt ? 's/IVA' : 'HT'}</strong>
                              {(extracted.montant_ttc || 0) > 0 && <span className="text-gray-500"> / {extracted.montant_ttc?.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}€ {isPt ? 'c/IVA' : 'TTC'}</span>}
                            </span>
                          </div>
                        )}
                        {extracted.date_intervention && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">📅</span>
                            <span className="text-gray-700">{new Date(extracted.date_intervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>
                          </div>
                        )}
                        {extracted.priorite && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">🚦</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              extracted.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
                              extracted.priorite === 'normale' ? 'bg-[#F7F4EE] text-[#0D1B2E] border border-[#E4DDD0]' :
                              'bg-[#F7F4EE] text-gray-600'
                            }`}>{isPt
                              ? (extracted.priorite === 'urgente' ? 'Urgente' : extracted.priorite === 'normale' ? 'Normal' : 'Planeada')
                              : extracted.priorite.charAt(0).toUpperCase() + extracted.priorite.slice(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {missionSuccess ? (
                        <div className="bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                          ✅ {isPt ? 'Missão criada !' : 'Mission créée !'}
                          <button onClick={() => setPage('missions')} className="underline text-green-800 hover:text-green-900 ml-1">{isPt ? 'Ver →' : 'Voir →'}</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenMissionModal(extracted)}
                          className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 shadow-sm"
                        >
                          📋 {isPt ? 'Criar a missão' : 'Créer la mission'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Score cards */}
              {scores && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-base">{isPt ? 'Pontuações da análise' : 'Scores d\'analyse'}</h3>
                    <div className="flex items-center gap-2">
                      {isVitfix && <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{isPt ? 'Orçamento Vitfix ✅' : 'Devis Vitfix ✅'}</span>}
                      {siretResult?.verified && <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{isPt ? 'NIF verificado ✅' : 'SIRET vérifié ✅'}</span>}
                      {siretResult && !siretResult.verified && extracted?.artisan_siret && <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{isPt ? 'NIF não verificado ❌' : 'SIRET non vérifié ❌'}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">{isPt ? 'Conformidade legal' : 'Conformité légale'}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scores.conformite.total / scores.conformite.max >= 0.9 ? 'bg-green-500' : scores.conformite.total / scores.conformite.max >= 0.7 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(scores.conformite.total / scores.conformite.max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold">{scores.conformite.total}/{scores.conformite.max}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">{isPt ? 'Nível de preço' : 'Niveau de prix'}</div>
                      {(() => {
                        const known = (scores.prix.details || []).filter(d => d.status !== 'inconnu')
                        if (known.length === 0) {
                          return <div className="text-xs text-gray-400 italic">{isPt ? 'Sem correspondência preço-mercado' : 'Pas de correspondance prix-marché'}</div>
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${Math.abs(scores.prix.ecart_moyen_pct) <= 15 ? 'bg-green-500' : Math.abs(scores.prix.ecart_moyen_pct) <= 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(10, 100 - Math.abs(scores.prix.ecart_moyen_pct))}%` }} />
                            </div>
                            <span className={`text-sm font-bold ${scores.prix.ecart_moyen_pct > 0 ? 'text-amber-600' : 'text-green-600'}`}>{scores.prix.ecart_moyen_pct > 0 ? '+' : ''}{scores.prix.ecart_moyen_pct}%</span>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">{isPt ? 'Confiança' : 'Confiance'}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scores.confiance >= 80 ? 'bg-green-500' : scores.confiance >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${scores.confiance}%` }} />
                        </div>
                        <span className="text-sm font-bold">{scores.confiance}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Conformité details accordion */}
                  <button onClick={() => setAccordion(accordion === 'conformite' ? null : 'conformite')} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-semibold text-gray-700">
                    <span>{isPt ? 'Detalhe da conformidade' : 'Détail conformité'} ({scores.conformite.total}/{scores.conformite.max})</span>
                    <span className={`transition-transform ${accordion === 'conformite' ? 'rotate-90' : ''}`}>▶</span>
                  </button>
                  {accordion === 'conformite' && (
                    <div className="px-3 space-y-1">
                      {scores.conformite.details.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs">
                          <span>{c.status === 'ok' ? '✅' : c.status === 'partial' ? '⚠️' : c.status === 'na' ? '➖' : '❌'}</span>
                          <span className={c.status === 'ok' ? 'text-green-700' : c.status === 'missing' ? 'text-red-600' : 'text-gray-600'}>{c.label}</span>
                          <span className="text-gray-400 ml-auto">{c.poids} pts</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SIRET details accordion */}
                  {siretResult && (
                    <>
                      <button onClick={() => setAccordion(accordion === 'siret' ? null : 'siret')} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-semibold text-gray-700">
                        <span>{isPt ? 'Verificação da empresa' : 'Vérification entreprise'} {siretResult.verified ? '✅' : '❌'}</span>
                        <span className={`transition-transform ${accordion === 'siret' ? 'rotate-90' : ''}`}>▶</span>
                      </button>
                      {accordion === 'siret' && (
                        <div className="px-3 text-xs space-y-1">
                          {siretResult.verified && siretResult.company ? (
                            <>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'Empresa :' : 'Entreprise :'}</span> {siretResult.company.name}</div>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'NIF :' : 'SIRET :'}</span> {siretResult.company.siret}</div>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'Atividade :' : 'Activité :'}</span> {siretResult.company.nafLabel} ({siretResult.company.nafCode})</div>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'Forma :' : 'Forme :'}</span> {siretResult.company.legalForm}</div>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'Estado :' : 'Statut :'}</span> <span className="text-green-600 font-semibold">{isPt ? 'Ativa ✅' : 'Active ✅'}</span></div>
                            </>
                          ) : siretResult.verified && extracted?.artisan_siret ? (
                            <>
                              <div><span className="font-semibold text-gray-500">{isPt ? 'NIF :' : 'SIRET :'}</span> <span className="font-semibold text-green-600">{extracted.artisan_siret}</span></div>
                              <div className="text-green-600">{isPt ? '✅ Validado por checksum (algoritmo AT — Autoridade Tributária)' : '✅ Vérifié par checksum'}</div>
                            </>
                          ) : (
                            <div className="text-red-600 font-semibold">{extracted?.artisan_siret ? `${locale === 'pt' ? 'NIF' : 'SIRET'} ${extracted.artisan_siret} ${locale === 'pt' ? 'não encontrado' : 'non trouvé'}` : (locale === 'pt' ? 'Nenhum NIF detetado' : 'Aucun SIRET détecté')}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }} />
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    const blob = new Blob([analysis], { type: 'text/plain; charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `analyse-${filename || 'devis'}-${new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR').replace(/\//g, '-')}.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                >
                  💾 {isPt ? 'Exportar' : 'Exporter'}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(analysis).then(() => toast.success(isPt ? 'Análise copiada !' : 'Analyse copiée !'))}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                >
                  📋 {isPt ? 'Copiar' : 'Copier'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-xl font-medium text-sm transition"
                >
                  🔍 {isPt ? 'Analisar outro' : 'Analyser un autre'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE HISTORIQUE */}
      {mode === 'history' && (
        <div className="space-y-4">
          <button onClick={() => setMode('main')} className="text-sm text-[#C9A84C] hover:text-[#B8963D] font-semibold">← {isPt ? 'Voltar' : 'Retour'}</button>
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
              <div className="text-4xl mb-3">📂</div>
              <p className="font-semibold text-gray-700">{isPt ? 'Nenhuma análise guardada' : 'Aucune analyse enregistrée'}</p>
              <p className="text-sm text-gray-500 mt-1">{isPt ? 'Lance a sua primeira análise para a encontrar aqui' : 'Lancez votre première analyse pour la retrouver ici'}</p>
            </div>
          ) : selectedHistory ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedHistory(null)} className="text-sm text-[#C9A84C] hover:text-[#B8963D] font-semibold flex items-center gap-1">
                ← {isPt ? 'Voltar ao histórico' : 'Retour à l\'historique'}
              </button>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: formatAnalysis(history.find(h => h.id === selectedHistory)?.analysis || '') }} />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F7F4EE] border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Documento' : 'Document'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Data' : 'Date'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Pontuação' : 'Score'}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Estado' : 'Statut'}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-[#F7F4EE] transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <p className="font-medium text-[#0D1B2E] text-sm">{h.filename}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{h.date}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">{h.score}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getVerdictColor(h.verdict)}`}>
                          {h.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button onClick={() => setSelectedHistory(h.id)} className="text-sm text-[#C9A84C] hover:text-[#B8963D] font-medium">{isPt ? 'Ver →' : 'Voir →'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal création mission */}
      {showMissionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#0D1B2E]">📋 {isPt ? 'Nova ordem de missão' : 'Nouvel ordre de mission'}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{isPt ? 'Uma mensagem automática será enviada ao profissional no canal da missão' : 'Un message automatique sera envoyé à l\'artisan dans le canal de la mission'}</p>
                </div>
                <button onClick={() => setShowMissionModal(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Section artisan + type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Profissional prestador' : 'Artisan prestataire'} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={missionForm.artisan}
                    onChange={e => setMissionForm(f => ({ ...f, artisan: e.target.value }))}
                    list="artisans-list-devis"
                    placeholder={isPt ? 'Nome do profissional' : 'Nom de l\'artisan'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                  <datalist id="artisans-list-devis">
                    {artisans.map(a => <option key={a.id} value={a.nom} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Tipo de obras' : 'Type de travaux'}</label>
                  <input
                    type="text"
                    value={missionForm.type}
                    onChange={e => setMissionForm(f => ({ ...f, type: e.target.value }))}
                    placeholder={isPt ? 'ex : Canalização, Eletricidade…' : 'ex : Plomberie, Électricité…'}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Section localisation */}
              <div className="bg-[#F7F4EE] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide">📍 {isPt ? 'Localização da intervenção' : 'Localisation de l\'intervention'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Nome do edifício' : 'Nom de la résidence'} <span className="text-red-500">*</span></label>
                    <input type="text" value={missionForm.immeuble} onChange={e => setMissionForm(f => ({ ...f, immeuble: e.target.value }))} placeholder={isPt ? 'ex : Edifício Os Pinheiros' : 'ex : Résidence Les Pins'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Morada completa' : 'Adresse complète'}</label>
                    <input type="text" value={missionForm.adresseImmeuble} onChange={e => setMissionForm(f => ({ ...f, adresseImmeuble: e.target.value }))} placeholder={isPt ? 'Rua de Santa Catarina 100, 4000-447 Porto' : '12 rue de la Paix, 75001 Paris'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Bloco' : 'Bâtiment'}</label>
                    <input type="text" value={missionForm.batiment} onChange={e => setMissionForm(f => ({ ...f, batiment: e.target.value }))} placeholder="ex : A, B, C…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Andar' : 'Étage'}</label>
                    <input type="text" value={missionForm.etage} onChange={e => setMissionForm(f => ({ ...f, etage: e.target.value }))} placeholder={isPt ? 'ex : 2, R/C…' : 'ex : 2, RDC…'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Apartamento / N° fração' : 'Appartement / N° lot'}</label>
                    <input type="text" value={missionForm.numLot} onChange={e => setMissionForm(f => ({ ...f, numLot: e.target.value }))} placeholder="ex : 12, 4B…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Inquilino / Ocupante' : 'Locataire / Occupant'}</label>
                    <input type="text" value={missionForm.locataire} onChange={e => setMissionForm(f => ({ ...f, locataire: e.target.value }))} placeholder={isPt ? 'Nome do inquilino (opcional)' : 'Nom du locataire (optionnel)'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{isPt ? 'Telefone do inquilino' : 'Téléphone locataire'}</label>
                    <input type="tel" value={missionForm.telephoneLocataire} onChange={e => setMissionForm(f => ({ ...f, telephoneLocataire: e.target.value }))} placeholder={isPt ? '9X XXX XX XX' : '06 XX XX XX XX'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">🔑 {isPt ? 'Instruções de acesso' : 'Instructions d\'accès'}</label>
                  <input type="text" value={missionForm.accesLogement} onChange={e => setMissionForm(f => ({ ...f, accesLogement: e.target.value }))} placeholder={isPt ? 'ex : Chave com porteiro, código portão 1234…' : 'ex : Clé chez gardien, code portail 1234…'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                </div>
              </div>

              {/* Motif + date + priorité */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Motivo / Descrição da intervenção' : 'Motif / Description de l\'intervention'} <span className="text-red-500">*</span></label>
                <textarea
                  value={missionForm.description}
                  onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder={isPt ? 'Descreva precisamente as obras a realizar…' : 'Décrivez précisément les travaux à effectuer…'}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Data da intervenção' : 'Date d\'intervention'}</label>
                  <input type="date" value={missionForm.dateIntervention} onChange={e => setMissionForm(f => ({ ...f, dateIntervention: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Prioridade' : 'Priorité'}</label>
                  <select value={missionForm.priorite} onChange={e => setMissionForm(f => ({ ...f, priorite: e.target.value as 'urgente' | 'normale' | 'planifiee' }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm">
                    <option value="urgente">🔴 {isPt ? 'Urgente' : 'Urgente'}</option>
                    <option value="normale">🔵 {isPt ? 'Normal' : 'Normale'}</option>
                    <option value="planifiee">⚪ {isPt ? 'Planeada' : 'Planifiée'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{isPt ? 'Montante orçamento (€ s/IVA)' : 'Montant devis (€ HT)'}</label>
                  <input type="number" value={missionForm.montantDevis || ''} onChange={e => setMissionForm(f => ({ ...f, montantDevis: parseFloat(e.target.value) || 0 }))} placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                </div>
              </div>

              {/* Aperçu du message automatique */}
              {missionForm.artisan && missionForm.immeuble && missionForm.description && (
                <div className="bg-[#F7F4EE] rounded-xl p-4 border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">👁️ {isPt ? 'Pré-visualização da mensagem automática enviada ao profissional' : 'Aperçu du message automatique envoyé à l\'artisan'}</p>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto leading-relaxed">
                    {isPt
                      ? `📋 ORDEM DE MISSÃO — ${missionForm.type || 'Intervenção'}

Olá ${missionForm.artisan},

Foi-lhe atribuída uma intervenção:

🏢 Edifício : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Morada : ${missionForm.adresseImmeuble}` : ''}${[missionForm.batiment && `Bloco ${missionForm.batiment}`, missionForm.etage && `Andar ${missionForm.etage}`, missionForm.numLot && `Apartamento / Fração ${missionForm.numLot}`].filter(Boolean).join(' · ') ? `\n📌 ${[missionForm.batiment && `Bloco ${missionForm.batiment}`, missionForm.etage && `Andar ${missionForm.etage}`, missionForm.numLot && `Apartamento / Fração ${missionForm.numLot}`].filter(Boolean).join(' · ')}` : ''}${missionForm.locataire ? `\n👤 Inquilino : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tel : ${missionForm.telephoneLocataire}` : ''}` : ''}${missionForm.accesLogement ? `\n🔑 Acesso : ${missionForm.accesLogement}` : ''}

🔧 Missão : ${missionForm.description}
📅 Data da intervenção : ${missionForm.dateIntervention ? new Date(missionForm.dateIntervention).toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'a definir'}
⚡ Prioridade : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normal' : '⚪ Planeada'}${missionForm.montantDevis ? `\n💰 Orçamento : ${missionForm.montantDevis.toLocaleString('pt-PT')} € sem IVA` : ''}

Por favor confirme a receção desta ordem de missão respondendo neste canal.`
                      : `📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ') ? `\n📌 ${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ')}` : ''}${missionForm.locataire ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}` : ''}${missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${missionForm.dateIntervention ? new Date(missionForm.dateIntervention).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'à définir'}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString('fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={handleCreateMission}
                disabled={missionCreating || !missionForm.artisan || !missionForm.description || !missionForm.immeuble}
                className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {missionCreating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {isPt ? 'A criar...' : 'Création en cours...'}</>
                ) : (isPt ? '📤 Criar a ordem de missão + enviar no canal' : '📤 Créer l\'ordre de mission + envoyer dans le canal')}
              </button>
              <button
                onClick={() => setShowMissionModal(false)}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-[#F7F4EE] transition text-sm"
              >
                {isPt ? 'Cancelar' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Seguro — Analyse assurances prestataires (même flux que devis/factures) ──

function SeguroView({ locale, isPt }: { locale: string; isPt: boolean }) {
  const [seguroInput, setSeguroInput] = useState<'drop' | 'paste'>('drop')
  const [seguroText, setSeguroText] = useState('')
  const [seguroFilename, setSeguroFilename] = useState('')
  const [seguroExtracting, setSeguroExtracting] = useState(false)
  const [seguroPdfReady, setSeguroPdfReady] = useState(false)
  const [seguroLoading, setSeguroLoading] = useState(false)
  const [seguroAnalysis, setSeguroAnalysis] = useState<string | null>(null)
  const [seguroError, setSeguroError] = useState('')
  const [seguroDragOver, setSeguroDragOver] = useState(false)
  const seguroFileRef = useRef<HTMLInputElement>(null)

  const handleSeguroFileDrop = async (file: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setSeguroError(isPt ? 'Apenas são aceites ficheiros PDF.' : 'Seuls les fichiers PDF sont acceptés.')
      return
    }
    setSeguroError('')
    setSeguroExtracting(true)
    setSeguroPdfReady(false)
    setSeguroText('')
    setSeguroFilename(file.name)
    setSeguroAnalysis(null)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/syndic/extract-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.isScanned) {
          setSeguroError(isPt
            ? 'Este PDF é um documento digitalizado (imagem). Copie e cole o texto manualmente.'
            : 'Ce PDF est un document scanné. Copiez-collez le texte manuellement.')
          setSeguroInput('paste')
        } else {
          setSeguroError(data.error || (isPt ? 'Erro ao extrair o PDF.' : 'Erreur lors de l\'extraction du PDF.'))
        }
        return
      }
      setSeguroText(data.text)
      setSeguroPdfReady(true)
    } catch {
      setSeguroError(isPt ? 'Erro de rede durante a extração' : 'Erreur réseau lors de l\'extraction')
    } finally {
      setSeguroExtracting(false)
    }
  }

  const handleSeguroAnalyse = async () => {
    if (!seguroText.trim() || seguroLoading) return
    setSeguroLoading(true)
    setSeguroError('')
    setSeguroAnalysis(null)
    try {
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const res = await fetch('/api/syndic/analyse-devis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ content: seguroText, filename: seguroFilename, locale, type: 'seguro' }),
      })
      const data = await res.json()
      if (!res.ok) { setSeguroError(data.error || (isPt ? 'Erro durante a análise' : 'Erreur lors de l\'analyse')); return }
      setSeguroAnalysis(data.analysis)
    } catch {
      setSeguroError(isPt ? 'Erro de rede, por favor tente novamente.' : 'Erreur réseau, veuillez réessayer.')
    } finally {
      setSeguroLoading(false)
    }
  }

  const handleSeguroReset = () => {
    setSeguroText('')
    setSeguroFilename('')
    setSeguroAnalysis(null)
    setSeguroError('')
    setSeguroPdfReady(false)
    if (seguroFileRef.current) seguroFileRef.current.value = ''
  }

  // ── Résultat affiché ──
  if (seguroAnalysis) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#0D1B2E] flex items-center gap-2">
            🛡️ {isPt ? 'Resultado da análise' : 'Résultat de l\'analyse'}
            {seguroFilename && <span className="font-normal text-gray-500 text-sm">— {seguroFilename}</span>}
          </h3>
          <button onClick={handleSeguroReset} className="text-sm text-[#C9A84C] hover:text-[#B8963D] font-semibold">
            ← {isPt ? 'Nova análise' : 'Nouvelle analyse'}
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(seguroAnalysis) }} />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => {
              const blob = new Blob([seguroAnalysis], { type: 'text/plain; charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `analyse-seguro-${seguroFilename || 'document'}-${new Date().toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR').replace(/\//g, '-')}.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
          >
            💾 {isPt ? 'Exportar' : 'Exporter'}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(seguroAnalysis).then(() => toast.success(isPt ? 'Análise copiada !' : 'Analyse copiée !'))}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
          >
            📋 {isPt ? 'Copiar' : 'Copier'}
          </button>
          <button onClick={handleSeguroReset} className="flex items-center gap-2 px-5 py-2.5 bg-[#0D1B2E] hover:bg-[#152338] text-white rounded-xl font-medium text-sm transition">
            🛡️ {isPt ? 'Analisar outro seguro' : 'Analyser une autre assurance'}
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire d'entrée ──
  return (
    <div className="space-y-4">
      {/* Sub-toggle PDF / Texto */}
      <div className="flex gap-2">
        <button
          onClick={() => { setSeguroInput('drop'); setSeguroError('') }}
          style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            background: seguroInput === 'drop' ? 'var(--sd-gold, #C9A84C)' : '#fff',
            color: seguroInput === 'drop' ? '#fff' : 'var(--sd-ink-3, #8A9BB0)',
            border: '1px solid var(--sd-border, #E4DDD0)', cursor: 'pointer',
          }}
        >
          📄 PDF
        </button>
        <button
          onClick={() => { setSeguroInput('paste'); setSeguroError('') }}
          style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            background: seguroInput === 'paste' ? 'var(--sd-gold, #C9A84C)' : '#fff',
            color: seguroInput === 'paste' ? '#fff' : 'var(--sd-ink-3, #8A9BB0)',
            border: '1px solid var(--sd-border, #E4DDD0)', cursor: 'pointer',
          }}
        >
          ✏️ {isPt ? 'Texto' : 'Texte'}
        </button>
      </div>

      {/* Drop zone PDF */}
      {seguroInput === 'drop' && (
        <div className="space-y-4">
          {!seguroPdfReady ? (
            <div
              onDragOver={e => { e.preventDefault(); setSeguroDragOver(true) }}
              onDragLeave={() => setSeguroDragOver(false)}
              onDrop={e => { e.preventDefault(); setSeguroDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleSeguroFileDrop(f) }}
              onClick={() => seguroFileRef.current?.click()}
              style={{
                borderRadius: 14, padding: 40, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                border: '2px dashed ' + (seguroDragOver ? 'var(--sd-gold, #C9A84C)' : seguroExtracting ? 'var(--sd-gold-light, #D6BC6E)' : 'var(--sd-border, #E4DDD0)'),
                background: seguroDragOver ? 'var(--sd-gold-dim, rgba(201,168,76,0.08))' : 'var(--sd-cream, #F7F4EE)',
              }}
            >
              <input ref={seguroFileRef} type="file" accept=".pdf,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleSeguroFileDrop(f); e.target.value = '' }} className="hidden" />
              {seguroExtracting ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, border: '3px solid var(--sd-gold, #C9A84C)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)' }}>{isPt ? 'A extrair o texto...' : 'Extraction du texte en cours...'}</p>
                  <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{seguroFilename}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 48 }}>🛡️</div>
                  <div>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>
                      {isPt ? 'Arraste o certificado de seguro aqui' : 'Glissez le certificat d\'assurance ici'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 6 }}>
                      {isPt ? 'ou clique para selecionar um ficheiro' : 'ou cliquez pour sélectionner un fichier'}
                    </p>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                    📂 {isPt ? 'Escolher um PDF' : 'Choisir un PDF'}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
                    {isPt ? 'Apólice RC Pro, certificado de seguro, atestado de responsabilidade civil' : 'Attestation RC Pro, certificat d\'assurance, police responsabilité civile'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--sd-teal-soft, #E6F4F2)', border: '1px solid rgba(26,122,110,0.2)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--sd-teal, #1A7A6E)', fontSize: 13 }}>{seguroFilename}</p>
                  <p style={{ fontSize: 11, color: 'var(--sd-teal, #1A7A6E)', opacity: 0.8 }}>
                    {seguroText.length.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')} {isPt ? 'caracteres extraídos · Pronto para analisar' : 'caractères extraits · Prêt à analyser'}
                  </p>
                </div>
              </div>
              <button onClick={handleSeguroReset} style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {isPt ? 'Alterar' : 'Changer'} ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zone texte manuel */}
      {seguroInput === 'paste' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isPt ? 'Nome do documento' : 'Nom du document'} <span className="font-normal text-gray-500">{isPt ? '(opcional)' : '(optionnel)'}</span>
            </label>
            <input type="text" value={seguroFilename} onChange={e => setSeguroFilename(e.target.value)}
              placeholder={isPt ? 'ex : Apólice RC Pro — Silva Canalizações' : 'ex : Attestation RC Pro — Fontaine Plomberie'}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isPt ? 'Texto do certificado de seguro' : 'Texte du certificat d\'assurance'} <span className="text-red-500">*</span>
            </label>
            <textarea value={seguroText} onChange={e => setSeguroText(e.target.value)}
              placeholder={isPt
                ? "Cole aqui o conteúdo do certificado de seguro...\n\nEx :\nFidelidade — Companhia de Seguros, S.A.\nAPÓLICE N° RC-2025-048721\nTomador : Silva Canalizações Lda — NIF 514237891\nRamo : Responsabilidade Civil Profissional\nCapital segurado : 500 000,00 €\nFranquia : 500,00 €\nInício : 01/03/2025 — Termo : 28/02/2026\nCobertura : Danos materiais e corporais a terceiros"
                : "Collez ici le contenu du certificat d'assurance...\n\nEx :\nAllianz France — Assurances\nATTESTATION RC PRO N° AL-2025-112847\nSouscripteur : Fontaine Plomberie SARL — SIRET 12345678901234\nGarantie : Responsabilité Civile Professionnelle\nMontant : 1 000 000 €\nFranchise : 750 €\nEffet : 01/01/2025 — Échéance : 31/12/2025\nActivités couvertes : Plomberie, chauffage, sanitaire"}
              rows={10}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono resize-y" />
            <p className="text-xs text-gray-500 mt-1">{seguroText.length} {isPt ? 'caracteres' : 'caractères'}</p>
          </div>
        </div>
      )}

      {/* Erreur */}
      {seguroError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <span className="flex-shrink-0">⚠️</span>
          <span>{seguroError}</span>
        </div>
      )}

      {/* Bouton analyser */}
      <button onClick={handleSeguroAnalyse} disabled={seguroLoading || seguroExtracting || seguroText.trim().length < 10}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 12,
          background: seguroLoading || seguroExtracting || seguroText.trim().length < 10 ? 'var(--sd-cream-dark, #EDE8DF)' : 'var(--sd-navy, #0D1B2E)',
          color: seguroLoading || seguroExtracting || seguroText.trim().length < 10 ? 'var(--sd-ink-3, #8A9BB0)' : '#fff',
          fontSize: 14, fontWeight: 600, letterSpacing: '0.4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          border: 'none', cursor: seguroLoading || seguroExtracting || seguroText.trim().length < 10 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', boxShadow: !(seguroLoading || seguroExtracting || seguroText.trim().length < 10) ? '0 4px 12px rgba(13,27,46,0.15)' : 'none',
        }}
      >
        {seguroLoading ? (
          <>
            <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            {isPt ? 'Análise IA em curso...' : 'Analyse IA en cours...'}
          </>
        ) : (
          <>
            <span style={{ color: 'var(--sd-gold, #C9A84C)' }}>🛡️</span>
            {isPt ? 'Analisar o seguro' : 'Analyser l\'assurance'}
          </>
        )}
      </button>

      {/* Info box */}
      <div className="bg-[#F7F4EE] rounded-xl p-3 border border-gray-100 text-xs text-gray-500 flex gap-2 items-start">
        <span>💡</span>
        <span>{isPt
          ? 'A IA verificará : validade da apólice, tipo de cobertura (RC Pro, decenal, acidentes), montantes segurados, franquias, exclusões, e conformidade com as exigências de copropiedade.'
          : 'L\'IA vérifiera : validité de la police, type de couverture (RC Pro, décennale, accidents), montants assurés, franchises, exclusions, et conformité avec les exigences de copropriété.'}</span>
      </div>
    </div>
  )
}
