'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Artisan, Mission, Page, DevisExtracted, InputMode } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'

function formatAnalysis(text: string): string {
  if (!text) return ''
  return safeMarkdownToHTML(text)
}

export default function AnalyseDevisSection({ artisans, setPage, missions, setMissions, user }: { artisans: Artisan[]; setPage: (p: Page) => void; missions: Mission[]; setMissions: React.Dispatch<React.SetStateAction<Mission[]>>; user: any }) {
  const { t } = useTranslation()
  const locale = useLocale()
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
  const [history, setHistory] = useState<{ id: string; filename: string; date: string; verdict: string; score: string; analysis: string; extracted?: DevisExtracted; scores?: any }[]>([])
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)
  const [scores, setScores] = useState<any>(null)
  const [siretResult, setSiretResult] = useState<any>(null)
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
      setError('Seuls les fichiers PDF sont acceptés.')
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
          setError('Ce PDF est un document scanné (image). Veuillez copier-coller le texte manuellement dans l\'onglet "Saisir le texte".')
          setInputMode('paste')
        } else if (data.isPasswordProtected) {
          setError('Ce PDF est protégé par un mot de passe. Déverrouillez-le d\'abord (ouvrez-le, allez dans Fichier → Exporter/Enregistrer sous sans mot de passe), puis réessayez.')
        } else if (data.isCorrupt) {
          setError('Ce fichier PDF semble corrompu ou invalide. Essayez de l\'ouvrir dans un lecteur PDF et de le ré-exporter.')
        } else {
          setError(data.error || 'Erreur lors de l\'extraction du PDF. Réessayez ou utilisez l\'onglet "Saisir le texte".')
        }
        return
      }
      setDocText(data.text)
      setPdfReady(true)
    } catch {
      setError('Erreur réseau lors de l\'extraction')
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
      filename: fname || 'Document sans nom',
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
        body: JSON.stringify({ content: docText, filename }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur lors de l\'analyse'); return }
      setAnalysis(data.analysis)
      setExtracted(data.extracted || null)
      setScores(data.scores || null)
      setSiretResult(data.siret || null)
      setIsVitfix(data.isVitfix || false)
      saveToHistory(filename || 'Document analysé', data.analysis, data.extracted)
    } catch {
      setError('Erreur réseau, veuillez réessayer.')
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
          : 'à définir'
        const localisationDetail = [
          missionForm.batiment ? `Bâtiment ${missionForm.batiment}` : null,
          missionForm.etage ? `Étage ${missionForm.etage}` : null,
          missionForm.numLot ? `Appartement / Lot ${missionForm.numLot}` : null,
        ].filter(Boolean).join(' · ')
        const locataireDetail = missionForm.locataire
          ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}`
          : ''
        const accesDetail = missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''

        const msgAuto = `📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${localisationDetail ? `\n📌 ${localisationDetail}` : ''}${locataireDetail}${accesDetail}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${dateIntervStr}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`

        const autoMsg = { auteur: 'Gestionnaire', role: 'syndic', texte: msgAuto, date: now.toISOString() }
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
      toast.error('Erreur réseau')
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B2E]">🔍 Analyse Devis &amp; Factures</h1>
          <p className="text-sm text-gray-500 mt-1">Conformité juridique · Benchmark prix marché · Prévention litiges</p>
        </div>
        <button
          onClick={() => setMode(mode === 'history' ? 'main' : 'history')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${mode === 'history' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-[#F7F4EE]'}`}
        >
          🕐 Historique ({history.length})
        </button>
      </div>

      {/* Bandeaux info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <p className="font-semibold text-blue-900 text-sm">Conformité juridique</p>
            <p className="text-xs text-blue-600 mt-0.5">SIRET, TVA, RC Pro, garantie décennale</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-semibold text-green-900 text-sm">Benchmark prix marché</p>
            <p className="text-xs text-green-600 mt-0.5">Tarifs 2024-2025 par corps de métier</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">Prévention litiges</p>
            <p className="text-xs text-amber-600 mt-0.5">Détection des risques juridiques</p>
          </div>
        </div>
      </div>

      {/* MODE PRINCIPAL */}
      {mode === 'main' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Onglets PDF / Texte */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => { setInputMode('drop'); setError('') }}
                  className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${inputMode === 'drop' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-[#F7F4EE]'}`}
                >
                  📄 Déposer un PDF
                </button>
                <button
                  onClick={() => { setInputMode('paste'); setError('') }}
                  className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${inputMode === 'paste' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-[#F7F4EE]'}`}
                >
                  ✏️ Saisir le texte
                </button>
              </div>

              <div className="p-6 space-y-4">

                {/* Zone Drop PDF */}
                {inputMode === 'drop' && (
                  <div className="space-y-4">
                    {!pdfReady ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                          dragOver
                            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                            : extracting
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                        {extracting ? (
                          <div className="space-y-3">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="font-semibold text-blue-700">Extraction du texte en cours...</p>
                            <p className="text-sm text-blue-500">{filename}</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-6xl">📄</div>
                            <div>
                              <p className="text-lg font-bold text-gray-800">Glissez votre PDF ici</p>
                              <p className="text-sm text-gray-500 mt-1">ou cliquez pour sélectionner un fichier</p>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
                              📂 Choisir un PDF
                            </div>
                            <p className="text-xs text-gray-500">Devis, facture, bon de commande — max 20 Mo</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">✅</span>
                            <div>
                              <p className="font-semibold text-green-800 text-sm">{filename}</p>
                              <p className="text-xs text-green-600">{docText.length.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} caractères extraits · Prêt à analyser</p>
                            </div>
                          </div>
                          <button
                            onClick={handleReset}
                            className="text-sm text-gray-500 hover:text-red-500 transition"
                          >
                            Changer ✕
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
                        Nom du document <span className="font-normal text-gray-500">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={filename}
                        onChange={e => setFilename(e.target.value)}
                        placeholder="ex : Devis plomberie Marc Fontaine — 24/02/2026"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Texte du document <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={docText}
                        onChange={e => setDocText(e.target.value)}
                        placeholder={"Collez ici le contenu du devis ou de la facture...\n\nEx :\nEntreprise Fontaine Plomberie SARL\nSIRET : 12345678901234\nDEVIS N° 2026-042 — Date : 24/02/2026\nRemplacement colonne eau chaude cave\n1 275,00 € HT — TVA 10% — Total TTC : 1 402,50 €\nRC Pro Allianz n°12345, valide jusqu'au 31/12/2026"}
                        rows={10}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-mono resize-y"
                      />
                      <p className="text-xs text-gray-500 mt-1">{docText.length} caractères</p>
                    </div>
                    <div className="bg-[#F7F4EE] rounded-xl p-3 border border-gray-100 text-xs text-gray-500 flex gap-2 items-start">
                      <span>💡</span>
                      <span>Pour extraire le texte d&apos;un PDF : ouvrir → Ctrl+A → Ctrl+C → coller ici. Pour un PDF scanné (image), utilisez Google Lens ou Adobe Acrobat.</span>
                    </div>
                  </div>
                )}

                {/* Erreur */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Bouton analyser */}
                <button
                  onClick={handleAnalyse}
                  disabled={loading || extracting || docText.trim().length < 10}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition disabled:opacity-40 flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyse IA en cours...
                    </>
                  ) : (
                    <>🔍 Analyser le document</>
                  )}
                </button>
              </div>
            </div>

          ) : (
            /* Résultat */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0D1B2E]">
                  📊 Résultat {filename && <span className="font-normal text-gray-500 text-base">— {filename}</span>}
                </h2>
                <button onClick={handleReset} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                  ← Nouvelle analyse
                </button>
              </div>

              {/* Carte récap extraite + bouton mission */}
              {extracted && (extracted.artisan_nom || extracted.description_travaux) && (
                <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F7F4EE] border border-blue-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Informations extraites automatiquement</p>
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
                              <strong>{extracted.montant_ht?.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}€ HT</strong>
                              {(extracted.montant_ttc || 0) > 0 && <span className="text-gray-500"> / {extracted.montant_ttc?.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}€ TTC</span>}
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
                              extracted.priorite === 'normale' ? 'bg-blue-100 text-blue-700' :
                              'bg-[#F7F4EE] text-gray-600'
                            }`}>{extracted.priorite.charAt(0).toUpperCase() + extracted.priorite.slice(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {missionSuccess ? (
                        <div className="bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                          ✅ Mission créée !
                          <button onClick={() => setPage('missions')} className="underline text-green-800 hover:text-green-900 ml-1">Voir →</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenMissionModal(extracted)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition flex items-center gap-2 shadow-sm"
                        >
                          📋 Créer la mission
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
                    <h3 className="font-bold text-gray-900 text-base">Scores d{"'"}analyse</h3>
                    <div className="flex items-center gap-2">
                      {isVitfix && <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Devis Vitfix ✅</span>}
                      {siretResult?.verified && <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">SIRET vérifié ✅</span>}
                      {siretResult && !siretResult.verified && extracted?.artisan_siret && <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">SIRET non vérifié ❌</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">Conformité légale</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scores.conformite.total / scores.conformite.max >= 0.9 ? 'bg-green-500' : scores.conformite.total / scores.conformite.max >= 0.7 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(scores.conformite.total / scores.conformite.max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold">{scores.conformite.total}/{scores.conformite.max}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">Niveau de prix</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${Math.abs(scores.prix.ecart_moyen_pct) <= 15 ? 'bg-green-500' : Math.abs(scores.prix.ecart_moyen_pct) <= 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(10, 100 - Math.abs(scores.prix.ecart_moyen_pct))}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${scores.prix.ecart_moyen_pct > 0 ? 'text-amber-600' : 'text-green-600'}`}>{scores.prix.ecart_moyen_pct > 0 ? '+' : ''}{scores.prix.ecart_moyen_pct}%</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-medium mb-1">Confiance</div>
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
                    <span>Détail conformité ({scores.conformite.total}/{scores.conformite.max})</span>
                    <span className={`transition-transform ${accordion === 'conformite' ? 'rotate-90' : ''}`}>▶</span>
                  </button>
                  {accordion === 'conformite' && (
                    <div className="px-3 space-y-1">
                      {scores.conformite.details.map((c: any) => (
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
                        <span>Vérification entreprise {siretResult.verified ? '✅' : '❌'}</span>
                        <span className={`transition-transform ${accordion === 'siret' ? 'rotate-90' : ''}`}>▶</span>
                      </button>
                      {accordion === 'siret' && (
                        <div className="px-3 text-xs space-y-1">
                          {siretResult.verified && siretResult.company ? (
                            <>
                              <div><span className="font-semibold text-gray-500">Entreprise :</span> {siretResult.company.name}</div>
                              <div><span className="font-semibold text-gray-500">SIRET :</span> {siretResult.company.siret}</div>
                              <div><span className="font-semibold text-gray-500">Activité :</span> {siretResult.company.nafLabel} ({siretResult.company.nafCode})</div>
                              <div><span className="font-semibold text-gray-500">Forme :</span> {siretResult.company.legalForm}</div>
                              <div><span className="font-semibold text-gray-500">Statut :</span> <span className="text-green-600 font-semibold">Active ✅</span></div>
                            </>
                          ) : (
                            <div className="text-red-600 font-semibold">{extracted?.artisan_siret ? `SIRET ${extracted.artisan_siret} non trouvé` : 'Aucun SIRET détecté'}</div>
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
                  💾 Exporter
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(analysis).then(() => toast.success('Analyse copiée !'))}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F7F4EE] hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
                >
                  📋 Copier
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition"
                >
                  🔍 Analyser un autre
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE HISTORIQUE */}
      {mode === 'history' && (
        <div className="space-y-4">
          <button onClick={() => setMode('main')} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">← Retour</button>
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16">
              <div className="text-4xl mb-3">📂</div>
              <p className="font-semibold text-gray-700">Aucune analyse enregistrée</p>
              <p className="text-sm text-gray-500 mt-1">Lancez votre première analyse pour la retrouver ici</p>
            </div>
          ) : selectedHistory ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedHistory(null)} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                ← Retour à l&apos;historique
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
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
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
                        <button onClick={() => setSelectedHistory(h.id)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Voir →</button>
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
                  <h3 className="text-lg font-bold text-[#0D1B2E]">📋 Nouvel ordre de mission</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Un message automatique sera envoyé à l'artisan dans le canal de la mission</p>
                </div>
                <button onClick={() => setShowMissionModal(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Section artisan + type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Artisan prestataire <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={missionForm.artisan}
                    onChange={e => setMissionForm(f => ({ ...f, artisan: e.target.value }))}
                    list="artisans-list-devis"
                    placeholder="Nom de l'artisan"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                  <datalist id="artisans-list-devis">
                    {artisans.map(a => <option key={a.id} value={a.nom} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type de travaux</label>
                  <input
                    type="text"
                    value={missionForm.type}
                    onChange={e => setMissionForm(f => ({ ...f, type: e.target.value }))}
                    placeholder="ex : Plomberie, Électricité…"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Section localisation */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📍 Localisation de l&apos;intervention</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la résidence <span className="text-red-500">*</span></label>
                    <input type="text" value={missionForm.immeuble} onChange={e => setMissionForm(f => ({ ...f, immeuble: e.target.value }))} placeholder="ex : Résidence Les Pins" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse complète</label>
                    <input type="text" value={missionForm.adresseImmeuble} onChange={e => setMissionForm(f => ({ ...f, adresseImmeuble: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bâtiment</label>
                    <input type="text" value={missionForm.batiment} onChange={e => setMissionForm(f => ({ ...f, batiment: e.target.value }))} placeholder="ex : A, B, C…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Étage</label>
                    <input type="text" value={missionForm.etage} onChange={e => setMissionForm(f => ({ ...f, etage: e.target.value }))} placeholder="ex : 2, RDC…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Appartement / N° lot</label>
                    <input type="text" value={missionForm.numLot} onChange={e => setMissionForm(f => ({ ...f, numLot: e.target.value }))} placeholder="ex : 12, 4B…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Locataire / Occupant</label>
                    <input type="text" value={missionForm.locataire} onChange={e => setMissionForm(f => ({ ...f, locataire: e.target.value }))} placeholder="Nom du locataire (optionnel)" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone locataire</label>
                    <input type="tel" value={missionForm.telephoneLocataire} onChange={e => setMissionForm(f => ({ ...f, telephoneLocataire: e.target.value }))} placeholder="06 XX XX XX XX" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">🔑 Instructions d&apos;accès</label>
                  <input type="text" value={missionForm.accesLogement} onChange={e => setMissionForm(f => ({ ...f, accesLogement: e.target.value }))} placeholder="ex : Clé chez gardien, code portail 1234…" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white" />
                </div>
              </div>

              {/* Motif + date + priorité */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Motif / Description de l&apos;intervention <span className="text-red-500">*</span></label>
                <textarea
                  value={missionForm.description}
                  onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Décrivez précisément les travaux à effectuer…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date d&apos;intervention</label>
                  <input type="date" value={missionForm.dateIntervention} onChange={e => setMissionForm(f => ({ ...f, dateIntervention: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priorité</label>
                  <select value={missionForm.priorite} onChange={e => setMissionForm(f => ({ ...f, priorite: e.target.value as 'urgente' | 'normale' | 'planifiee' }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm">
                    <option value="urgente">🔴 Urgente</option>
                    <option value="normale">🔵 Normale</option>
                    <option value="planifiee">⚪ Planifiée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Montant devis (€ HT)</label>
                  <input type="number" value={missionForm.montantDevis || ''} onChange={e => setMissionForm(f => ({ ...f, montantDevis: parseFloat(e.target.value) || 0 }))} placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                </div>
              </div>

              {/* Aperçu du message automatique */}
              {missionForm.artisan && missionForm.immeuble && missionForm.description && (
                <div className="bg-[#F7F4EE] rounded-xl p-4 border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">👁️ Aperçu du message automatique envoyé à l&apos;artisan</p>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto leading-relaxed">
                    {`📋 ORDRE DE MISSION — ${missionForm.type || 'Intervention'}

Bonjour ${missionForm.artisan},

Une intervention vous est assignée :

🏢 Résidence : ${missionForm.immeuble}${missionForm.adresseImmeuble ? `\n📍 Adresse : ${missionForm.adresseImmeuble}` : ''}${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ') ? `\n📌 ${[missionForm.batiment && `Bâtiment ${missionForm.batiment}`, missionForm.etage && `Étage ${missionForm.etage}`, missionForm.numLot && `Appartement / Lot ${missionForm.numLot}`].filter(Boolean).join(' · ')}` : ''}${missionForm.locataire ? `\n👤 Locataire : ${missionForm.locataire}${missionForm.telephoneLocataire ? ` — Tél : ${missionForm.telephoneLocataire}` : ''}` : ''}${missionForm.accesLogement ? `\n🔑 Accès : ${missionForm.accesLogement}` : ''}

🔧 Mission : ${missionForm.description}
📅 Date d'intervention : ${missionForm.dateIntervention ? new Date(missionForm.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'à définir'}
⚡ Priorité : ${missionForm.priorite === 'urgente' ? '🔴 URGENTE' : missionForm.priorite === 'normale' ? '🔵 Normale' : '⚪ Planifiée'}${missionForm.montantDevis ? `\n💰 Montant devis : ${missionForm.montantDevis.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} € HT` : ''}

Merci de confirmer la réception de cet ordre de mission en répondant dans ce canal.`}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                onClick={handleCreateMission}
                disabled={missionCreating || !missionForm.artisan || !missionForm.description || !missionForm.immeuble}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {missionCreating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création en cours...</>
                ) : '📤 Créer l\'ordre de mission + envoyer dans le canal'}
              </button>
              <button
                onClick={() => setShowMissionModal(false)}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-[#F7F4EE] transition text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
