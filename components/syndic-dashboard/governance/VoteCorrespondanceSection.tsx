'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────────

type MajoriteType = 'art24' | 'art25' | 'art25_1' | 'art26' | 'unanimite'
type StatutVote = 'en_cours' | 'cloture' | 'resultat_proclame'
type TabKey = 'votes' | 'formulaires' | 'historique' | 'configuration'

interface VoteTantiemes {
  pour: number
  contre: number
  abstention: number
}

interface Resolution {
  id: string
  numero: number
  intitule: string
  description: string
  majorite: MajoriteType
  resultatProvisoire: VoteTantiemes
  statut: 'en_cours' | 'adoptee' | 'rejetee'
}

interface Coproprietaire {
  id: string
  nom: string
  prenom: string
  email: string
  lots: string[]
  tantiemes: number
  aVote: boolean
  dateVote?: string
  modeVote?: 'correspondance' | 'electronique' | 'presentiel'
}

interface SessionVote {
  id: string
  agId: string
  agTitre: string
  immeuble: string
  dateAG: string
  dateLimiteReception: string
  resolutions: Resolution[]
  coproprietaires: Coproprietaire[]
  totalTantiemes: number
  statut: StatutVote
  hybride: boolean
  notificationOpposants: boolean
  dateNotification?: string
  createdAt: string
}

interface ConfigVote {
  hybride: boolean
  visioUrl: string
  voteElectronique: boolean
  auth2FA: boolean
  horodatage: boolean
  archivageSecurise: boolean
  envoiDematerialise: boolean
  delaiConvocationJours: number
  quorumPct: number
}

interface FormulaireMandat {
  mandantNom: string
  mandantLots: string
  mandantTantiemes: number
  mandataireNom: string
  dateSignature: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAJORITE_CONFIG: Record<MajoriteType, { label: string; description: string; color: string; bgColor: string }> = {
  art24:     { label: 'Art. 24 — Majorite simple',       description: 'Majorite des voix exprimees des coproprietaires presents ou representes', color: '#2563EB', bgColor: 'rgba(37,99,235,0.08)' },
  art25:     { label: 'Art. 25 — Majorite absolue',      description: 'Majorite des voix de tous les coproprietaires (>50% des tantiemes)',      color: '#C9A84C', bgColor: 'rgba(201,168,76,0.12)' },
  art25_1:   { label: 'Art. 25-1 — Passerelle',          description: 'Si art. 25 non atteint mais 1/3 des voix favorables, 2e vote a art. 24', color: '#7C3AED', bgColor: 'rgba(124,58,237,0.08)' },
  art26:     { label: 'Art. 26 — Double majorite',        description: '2/3 des voix de tous les coproprietaires',                                color: '#DC2626', bgColor: 'rgba(220,38,38,0.08)' },
  unanimite: { label: 'Unanimite',                        description: 'Accord de tous les coproprietaires',                                     color: '#0D1B2E', bgColor: 'rgba(13,27,46,0.08)' },
}

const STATUT_LABELS: Record<StatutVote, { label: string; color: string; bg: string }> = {
  en_cours:          { label: 'En cours',           color: '#D4830A', bg: 'rgba(212,131,10,0.1)' },
  cloture:           { label: 'Cloture',            color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  resultat_proclame: { label: 'Resultat proclame',  color: '#1A7A6E', bg: 'rgba(26,122,110,0.08)' },
}

const TAB_CONFIG: { key: TabKey; label: string; icon: string }[] = [
  { key: 'votes',         label: 'Votes en cours',  icon: 'check-square' },
  { key: 'formulaires',   label: 'Formulaires',     icon: 'file-text' },
  { key: 'historique',    label: 'Historique',       icon: 'clock' },
  { key: 'configuration', label: 'Configuration',   icon: 'settings' },
]

// ─── Demo Data ──────────────────────────────────────────────────────────────────

function createDemoData(): SessionVote[] {
  const now = new Date()
  const ag1Date = new Date(now.getTime() + 15 * 86400000)
  const ag1Limite = new Date(ag1Date.getTime() - 3 * 86400000)
  const ag2Date = new Date(now.getTime() - 45 * 86400000)

  const copros1: Coproprietaire[] = [
    { id: 'c1', nom: 'Dupont', prenom: 'Jean', email: 'jean.dupont@email.fr', lots: ['A-101'], tantiemes: 450, aVote: true, dateVote: new Date(now.getTime() - 2 * 86400000).toISOString(), modeVote: 'correspondance' },
    { id: 'c2', nom: 'Martin', prenom: 'Sophie', email: 'sophie.martin@email.fr', lots: ['A-205', 'B-001'], tantiemes: 820, aVote: true, dateVote: new Date(now.getTime() - 1 * 86400000).toISOString(), modeVote: 'electronique' },
    { id: 'c3', nom: 'Bernard', prenom: 'Pierre', email: 'p.bernard@email.fr', lots: ['A-302'], tantiemes: 380, aVote: false },
    { id: 'c4', nom: 'Petit', prenom: 'Marie', email: 'marie.petit@email.fr', lots: ['B-104'], tantiemes: 290, aVote: false },
    { id: 'c5', nom: 'Moreau', prenom: 'Luc', email: 'luc.moreau@email.fr', lots: ['A-401'], tantiemes: 560, aVote: true, dateVote: new Date(now.getTime() - 5 * 86400000).toISOString(), modeVote: 'correspondance' },
    { id: 'c6', nom: 'Garcia', prenom: 'Ana', email: 'a.garcia@email.fr', lots: ['B-203'], tantiemes: 500, aVote: false },
  ]

  const copros2: Coproprietaire[] = [
    { id: 'c7', nom: 'Leroy', prenom: 'Paul', email: 'paul.leroy@email.fr', lots: ['1-A'], tantiemes: 600, aVote: true, dateVote: ag2Date.toISOString(), modeVote: 'presentiel' },
    { id: 'c8', nom: 'Roux', prenom: 'Claire', email: 'claire.roux@email.fr', lots: ['2-B', '3-C'], tantiemes: 1100, aVote: true, dateVote: ag2Date.toISOString(), modeVote: 'presentiel' },
    { id: 'c9', nom: 'David', prenom: 'Marc', email: 'marc.david@email.fr', lots: ['4-A'], tantiemes: 450, aVote: true, dateVote: new Date(ag2Date.getTime() - 4 * 86400000).toISOString(), modeVote: 'correspondance' },
    { id: 'c10', nom: 'Simon', prenom: 'Nathalie', email: 'n.simon@email.fr', lots: ['5-B'], tantiemes: 350, aVote: true, dateVote: ag2Date.toISOString(), modeVote: 'presentiel' },
  ]

  return [
    {
      id: 'sv1',
      agId: 'ag-2026-01',
      agTitre: 'AG Ordinaire Annuelle 2026',
      immeuble: 'Residence Les Oliviers',
      dateAG: ag1Date.toISOString(),
      dateLimiteReception: ag1Limite.toISOString(),
      totalTantiemes: 3000,
      statut: 'en_cours',
      hybride: true,
      notificationOpposants: false,
      createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      coproprietaires: copros1,
      resolutions: [
        { id: 'r1', numero: 1, intitule: 'Approbation des comptes exercice 2025', description: 'Vote sur les comptes annuels presentes par le syndic', majorite: 'art24', resultatProvisoire: { pour: 1830, contre: 0, abstention: 0 }, statut: 'en_cours' },
        { id: 'r2', numero: 2, intitule: 'Budget previsionnel 2026-2027', description: 'Adoption du budget previsionnel pour le prochain exercice', majorite: 'art24', resultatProvisoire: { pour: 1270, contre: 560, abstention: 0 }, statut: 'en_cours' },
        { id: 'r3', numero: 3, intitule: 'Renouvellement du contrat du syndic', description: 'Renouvellement du mandat du syndic pour 3 ans — art. 25', majorite: 'art25', resultatProvisoire: { pour: 1830, contre: 0, abstention: 0 }, statut: 'en_cours' },
        { id: 'r4', numero: 4, intitule: 'Ravalement facade batiment A', description: 'Approbation des travaux de ravalement et choix du prestataire', majorite: 'art26', resultatProvisoire: { pour: 1270, contre: 560, abstention: 0 }, statut: 'en_cours' },
        { id: 'r5', numero: 5, intitule: 'Modification du reglement de copropriete', description: 'Mise en conformite avec la loi ELAN — necessite unanimite', majorite: 'unanimite', resultatProvisoire: { pour: 1830, contre: 0, abstention: 0 }, statut: 'en_cours' },
      ],
    },
    {
      id: 'sv2',
      agId: 'ag-2025-02',
      agTitre: 'AG Extraordinaire — Travaux toiture',
      immeuble: 'Copropriete Haussmann',
      dateAG: ag2Date.toISOString(),
      dateLimiteReception: new Date(ag2Date.getTime() - 3 * 86400000).toISOString(),
      totalTantiemes: 2500,
      statut: 'resultat_proclame',
      hybride: false,
      notificationOpposants: true,
      dateNotification: new Date(ag2Date.getTime() + 15 * 86400000).toISOString(),
      createdAt: new Date(ag2Date.getTime() - 30 * 86400000).toISOString(),
      coproprietaires: copros2,
      resolutions: [
        { id: 'r6', numero: 1, intitule: 'Travaux urgents toiture — etancheite', description: 'Remplacement de la couverture — devis 85 000 EUR HT', majorite: 'art25', resultatProvisoire: { pour: 2150, contre: 350, abstention: 0 }, statut: 'adoptee' },
        { id: 'r7', numero: 2, intitule: 'Appel de fonds exceptionnel', description: 'Echelonnement sur 12 mois — provision speciale art. 14-2', majorite: 'art24', resultatProvisoire: { pour: 1550, contre: 600, abstention: 350 }, statut: 'adoptee' },
        { id: 'r8', numero: 3, intitule: 'Installation panneaux solaires', description: 'Projet photovoltaique parties communes — autofinancement 50%', majorite: 'art26', resultatProvisoire: { pour: 1100, contre: 1050, abstention: 350 }, statut: 'rejetee' },
      ],
    },
  ]
}

function createDefaultConfig(): ConfigVote {
  return {
    hybride: true,
    visioUrl: '',
    voteElectronique: true,
    auth2FA: true,
    horodatage: true,
    archivageSecurise: true,
    envoiDematerialise: true,
    delaiConvocationJours: 21,
    quorumPct: 25,
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calculerResultatMajorite(res: Resolution, totalTantiemes: number): { adopte: boolean; seuil: number; detail: string } {
  const { pour, contre, abstention } = res.resultatProvisoire
  const exprimes = pour + contre
  switch (res.majorite) {
    case 'art24': {
      const seuil = Math.floor(exprimes / 2) + 1
      return { adopte: pour > contre, seuil, detail: `Majorite simple : ${pour} / ${contre} (seuil ${seuil})` }
    }
    case 'art25': {
      const seuil = Math.floor(totalTantiemes / 2) + 1
      return { adopte: pour >= seuil, seuil, detail: `Majorite absolue : ${pour} / ${totalTantiemes} (seuil ${seuil})` }
    }
    case 'art25_1': {
      const seuil25 = Math.floor(totalTantiemes / 2) + 1
      const tiersVoix = Math.floor(totalTantiemes / 3)
      if (pour >= seuil25) return { adopte: true, seuil: seuil25, detail: `Art. 25 atteint directement : ${pour} >= ${seuil25}` }
      if (pour >= tiersVoix) return { adopte: true, seuil: tiersVoix, detail: `Passerelle art. 25-1 : ${pour} >= 1/3 (${tiersVoix}), 2e vote a art. 24` }
      return { adopte: false, seuil: tiersVoix, detail: `Passerelle non declenchee : ${pour} < 1/3 (${tiersVoix})` }
    }
    case 'art26': {
      const seuil = Math.ceil(totalTantiemes * 2 / 3)
      return { adopte: pour >= seuil, seuil, detail: `Double majorite : ${pour} / ${totalTantiemes} (seuil 2/3 = ${seuil})` }
    }
    case 'unanimite': {
      const totalVotants = pour + contre + abstention
      return { adopte: totalVotants > 0 && contre === 0 && abstention === 0, seuil: totalTantiemes, detail: `Unanimite : ${contre === 0 && abstention === 0 ? 'AUCUNE OPPOSITION' : `${contre} contre, ${abstention} abstentions`}` }
    }
  }
}

// ─── Inline Styles ──────────────────────────────────────────────────────────────

const sCard: React.CSSProperties = { background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 14, padding: 24 }
const sCardCompact: React.CSSProperties = { ...sCard, padding: 16 }
const sHeading: React.CSSProperties = { fontFamily: "'Playfair Display', serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 700, lineHeight: 1.2 }
const sSubheading: React.CSSProperties = { fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 600 }
const sBody: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }
const sSmall: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }
const sBtnPrimary: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--sd-navy, #0D1B2E)', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }
const sBtnSecondary: React.CSSProperties = { ...sBtnPrimary, background: 'transparent', color: 'var(--sd-navy, #0D1B2E)', border: '1px solid var(--sd-border, #E4DDD0)' }
const sBtnGold: React.CSSProperties = { ...sBtnPrimary, background: 'var(--sd-gold, #C9A84C)' }
const sInput: React.CSSProperties = { fontFamily: "'Outfit', sans-serif", fontSize: 13, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-navy, #0D1B2E)', outline: 'none', width: '100%' }
const sToggleTrack: (on: boolean) => React.CSSProperties = (on) => ({ width: 44, height: 24, borderRadius: 12, background: on ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 })
const sToggleThumb: (on: boolean) => React.CSSProperties = (on) => ({ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' })
const sProgressBar: React.CSSProperties = { height: 8, borderRadius: 4, background: 'var(--sd-cream, #F7F4EE)', overflow: 'hidden', width: '100%' }
const sProgressFill: (pct: number, color: string) => React.CSSProperties = (pct, color) => ({ height: '100%', borderRadius: 4, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s ease' })

// ─── Component ──────────────────────────────────────────────────────────────────

export default function VoteCorrespondanceSection({ user, userRole }: { user: User; userRole: string }) {
  const uid = user?.id || 'demo'
  const storageKey = `fixit_votes_fr_${uid}`

  // ── State ──
  const [activeTab, setActiveTab] = useState<TabKey>('votes')
  const [sessions, setSessions] = useState<SessionVote[]>([])
  const [config, setConfig] = useState<ConfigVote>(createDefaultConfig)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [showNewVote, setShowNewVote] = useState(false)
  const [genFormLoading, setGenFormLoading] = useState(false)
  const [genFormDone, setGenFormDone] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [mandatForm, setMandatForm] = useState<FormulaireMandat>({ mandantNom: '', mandantLots: '', mandantTantiemes: 0, mandataireNom: '', dateSignature: new Date().toISOString().split('T')[0] })
  const [showMandat, setShowMandat] = useState(false)
  const [historiqueFilter, setHistoriqueFilter] = useState({ year: '', immeuble: '', resultat: '' as '' | 'adoptee' | 'rejetee' })
  const [newVoteForm, setNewVoteForm] = useState({ agTitre: '', immeuble: '', dateAG: '', resolutions: '' })

  // ── Persistence ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSessions(parsed.sessions || [])
        if (parsed.config) setConfig(parsed.config)
      } else {
        const demo = createDemoData()
        setSessions(demo)
        localStorage.setItem(storageKey, JSON.stringify({ sessions: demo, config: createDefaultConfig() }))
      }
    } catch {
      const demo = createDemoData()
      setSessions(demo)
    }
  }, [storageKey])

  const save = useCallback((newSessions: SessionVote[], newConfig?: ConfigVote) => {
    const c = newConfig || config
    setSessions(newSessions)
    if (newConfig) setConfig(c)
    localStorage.setItem(storageKey, JSON.stringify({ sessions: newSessions, config: c }))
  }, [config, storageKey])

  // ── Computed ──
  const activeSession = useMemo(() => sessions.find(s => s.id === selectedSession) || null, [sessions, selectedSession])
  const sessionsEnCours = useMemo(() => sessions.filter(s => s.statut === 'en_cours'), [sessions])
  const sessionsTerminees = useMemo(() => sessions.filter(s => s.statut !== 'en_cours'), [sessions])

  const filteredHistorique = useMemo(() => {
    return sessionsTerminees.filter(s => {
      if (historiqueFilter.year && !s.dateAG.startsWith(historiqueFilter.year)) return false
      if (historiqueFilter.immeuble && !s.immeuble.toLowerCase().includes(historiqueFilter.immeuble.toLowerCase())) return false
      if (historiqueFilter.resultat) {
        const hasMatch = s.resolutions.some(r => r.statut === historiqueFilter.resultat)
        if (!hasMatch) return false
      }
      return true
    })
  }, [sessionsTerminees, historiqueFilter])

  const uniqueYears = useMemo(() => {
    const years = new Set(sessions.map(s => new Date(s.dateAG).getFullYear().toString()))
    return Array.from(years).sort().reverse()
  }, [sessions])

  // ── Handlers ──
  const handleCreateSession = () => {
    if (!newVoteForm.agTitre.trim() || !newVoteForm.dateAG) return
    const dateAG = new Date(newVoteForm.dateAG)
    const dateLimite = new Date(dateAG.getTime() - 3 * 86400000)
    const resLines = newVoteForm.resolutions.split('\n').filter(l => l.trim())
    const resolutions: Resolution[] = resLines.map((line, i) => ({
      id: `r-${Date.now()}-${i}`,
      numero: i + 1,
      intitule: line.trim(),
      description: '',
      majorite: 'art24',
      resultatProvisoire: { pour: 0, contre: 0, abstention: 0 },
      statut: 'en_cours',
    }))

    const newSession: SessionVote = {
      id: `sv-${Date.now()}`,
      agId: `ag-${Date.now()}`,
      agTitre: newVoteForm.agTitre,
      immeuble: newVoteForm.immeuble || 'Non precise',
      dateAG: dateAG.toISOString(),
      dateLimiteReception: dateLimite.toISOString(),
      resolutions,
      coproprietaires: [],
      totalTantiemes: 10000,
      statut: 'en_cours',
      hybride: config.hybride,
      notificationOpposants: false,
      createdAt: new Date().toISOString(),
    }

    save([newSession, ...sessions])
    setShowNewVote(false)
    setNewVoteForm({ agTitre: '', immeuble: '', dateAG: '', resolutions: '' })
    setSelectedSession(newSession.id)
  }

  const handleCloturer = (sessionId: string) => {
    const updated = sessions.map(s => s.id === sessionId ? { ...s, statut: 'cloture' as StatutVote } : s)
    save(updated)
  }

  const handleProclamer = (sessionId: string) => {
    const updated = sessions.map(s => {
      if (s.id !== sessionId) return s
      const resolutions = s.resolutions.map(r => {
        const result = calculerResultatMajorite(r, s.totalTantiemes)
        return { ...r, statut: result.adopte ? 'adoptee' as const : 'rejetee' as const }
      })
      return { ...s, statut: 'resultat_proclame' as StatutVote, resolutions }
    })
    save(updated)
  }

  const handleGenererFormulaires = () => {
    setGenFormLoading(true)
    setTimeout(() => {
      setGenFormLoading(false)
      setGenFormDone(true)
      setTimeout(() => setGenFormDone(false), 3000)
    }, 1500)
  }

  const handleEnvoyerEmail = () => {
    setEmailSending(true)
    setTimeout(() => {
      setEmailSending(false)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    }, 2000)
  }

  const handleNotifierOpposants = (sessionId: string) => {
    const updated = sessions.map(s =>
      s.id === sessionId ? { ...s, notificationOpposants: true, dateNotification: new Date().toISOString() } : s
    )
    save(updated)
  }

  // ── Render Helpers ──
  const renderCountdown = (dateLimite: string) => {
    const days = daysUntil(dateLimite)
    const isUrgent = days <= 5
    const isPassed = days < 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: isPassed ? 'rgba(220,38,38,0.08)' : isUrgent ? 'rgba(212,131,10,0.1)' : 'rgba(37,99,235,0.06)', border: `1px solid ${isPassed ? 'rgba(220,38,38,0.15)' : isUrgent ? 'rgba(212,131,10,0.15)' : 'rgba(37,99,235,0.1)'}` }}>
        <span style={{ fontSize: 14 }}>{isPassed ? '\u23F0' : '\u23F3'}</span>
        <span style={{ ...sBody, fontSize: 12, fontWeight: 600, color: isPassed ? '#DC2626' : isUrgent ? '#D4830A' : '#2563EB' }}>
          {isPassed
            ? `Delai depasse depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`
            : `J-${days} — Reception au plus tard 3 jours francs avant l'AG (art. 17-1 A loi 1965)`
          }
        </span>
      </div>
    )
  }

  const renderResolutionCard = (res: Resolution, totalTantiemes: number, showResult: boolean) => {
    const majConfig = MAJORITE_CONFIG[res.majorite]
    const result = calculerResultatMajorite(res, totalTantiemes)
    const totalExprime = res.resultatProvisoire.pour + res.resultatProvisoire.contre + res.resultatProvisoire.abstention
    const pctPour = totalExprime > 0 ? (res.resultatProvisoire.pour / totalTantiemes) * 100 : 0
    const pctContre = totalExprime > 0 ? (res.resultatProvisoire.contre / totalTantiemes) * 100 : 0
    const pctAbst = totalExprime > 0 ? (res.resultatProvisoire.abstention / totalTantiemes) * 100 : 0

    return (
      <div key={res.id} style={{ ...sCardCompact, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ ...sBody, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', fontSize: 14 }}>
                Resolution n\u00B0{res.numero}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: majConfig.bgColor, color: majConfig.color }}>
                {majConfig.label}
              </span>
            </div>
            <p style={{ ...sBody, fontWeight: 500, marginBottom: 2 }}>{res.intitule}</p>
            {res.description && <p style={sSmall}>{res.description}</p>}
          </div>
          {showResult && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, flexShrink: 0, background: res.statut === 'adoptee' ? 'rgba(26,122,110,0.1)' : res.statut === 'rejetee' ? 'rgba(220,38,38,0.08)' : 'rgba(212,131,10,0.1)', color: res.statut === 'adoptee' ? '#1A7A6E' : res.statut === 'rejetee' ? '#DC2626' : '#D4830A' }}>
              {res.statut === 'adoptee' ? '\u2713 Adoptee' : res.statut === 'rejetee' ? '\u2717 Rejetee' : 'En cours'}
            </span>
          )}
        </div>

        {/* Vote bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...sSmall, fontWeight: 600, color: '#1A7A6E' }}>Pour</span>
              <span style={{ ...sSmall, fontWeight: 600 }}>{res.resultatProvisoire.pour} t. ({pctPour.toFixed(1)}%)</span>
            </div>
            <div style={sProgressBar}>
              <div style={sProgressFill(pctPour, '#1A7A6E')} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...sSmall, fontWeight: 600, color: '#DC2626' }}>Contre</span>
              <span style={{ ...sSmall, fontWeight: 600 }}>{res.resultatProvisoire.contre} t. ({pctContre.toFixed(1)}%)</span>
            </div>
            <div style={sProgressBar}>
              <div style={sProgressFill(pctContre, '#DC2626')} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...sSmall, fontWeight: 600, color: '#8A9BB0' }}>Abstention</span>
              <span style={{ ...sSmall, fontWeight: 600 }}>{res.resultatProvisoire.abstention} t. ({pctAbst.toFixed(1)}%)</span>
            </div>
            <div style={sProgressBar}>
              <div style={sProgressFill(pctAbst, '#8A9BB0')} />
            </div>
          </div>
        </div>

        {showResult && (
          <div style={{ ...sSmall, fontStyle: 'italic', borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 8, marginTop: 4 }}>
            {result.detail}
          </div>
        )}
      </div>
    )
  }

  // ─── Tab: Votes en cours ──────────────────────────────────────────────────────

  const renderVotesEnCours = () => {
    if (selectedSession && activeSession) {
      const votesRecus = activeSession.coproprietaires.filter(c => c.aVote).length
      const totalCopros = activeSession.coproprietaires.length
      const pctProgress = totalCopros > 0 ? (votesRecus / totalCopros) * 100 : 0

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Back button */}
          <button onClick={() => setSelectedSession(null)} style={{ ...sBtnSecondary, alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12 }}>
            \u2190 Retour aux sessions
          </button>

          {/* Session header */}
          <div style={sCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={sSubheading}>{activeSession.agTitre}</h2>
                <p style={{ ...sBody, marginTop: 4 }}>{activeSession.immeuble} — AG du {formatDate(activeSession.dateAG)}</p>
                {activeSession.hybride && (
                  <span style={{ ...sSmall, display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontWeight: 600 }}>
                    AG Hybride (presentiel + visioconference)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: STATUT_LABELS[activeSession.statut].bg, color: STATUT_LABELS[activeSession.statut].color }}>
                  {STATUT_LABELS[activeSession.statut].label}
                </span>
              </div>
            </div>

            {/* Countdown */}
            {activeSession.statut === 'en_cours' && renderCountdown(activeSession.dateLimiteReception)}

            {/* Progress */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ ...sBody, fontWeight: 600 }}>Votes recus</span>
                <span style={{ ...sBody, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{votesRecus} / {totalCopros} coproprietaires</span>
              </div>
              <div style={sProgressBar}>
                <div style={sProgressFill(pctProgress, 'var(--sd-gold, #C9A84C)')} />
              </div>
              <p style={{ ...sSmall, marginTop: 6 }}>Tantiemes representes : {activeSession.coproprietaires.filter(c => c.aVote).reduce((sum, c) => sum + c.tantiemes, 0)} / {activeSession.totalTantiemes}</p>
            </div>

            {/* Action buttons */}
            {activeSession.statut === 'en_cours' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => handleCloturer(activeSession.id)} style={{ ...sBtnSecondary, fontSize: 12 }}>
                  Cloturer la reception
                </button>
              </div>
            )}
            {activeSession.statut === 'cloture' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => handleProclamer(activeSession.id)} style={{ ...sBtnGold, fontSize: 12 }}>
                  Proclamer les resultats
                </button>
              </div>
            )}
          </div>

          {/* Resolutions */}
          <div>
            <h3 style={{ ...sSubheading, fontSize: 16, marginBottom: 12 }}>Resolutions ({activeSession.resolutions.length})</h3>
            {activeSession.resolutions.map(r => renderResolutionCard(r, activeSession.totalTantiemes, activeSession.statut !== 'en_cours'))}
          </div>

          {/* Coproprietaires list */}
          <div style={sCard}>
            <h3 style={{ ...sSubheading, fontSize: 16, marginBottom: 12 }}>Suivi des votes par coproprietaire</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Outfit', sans-serif", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Coproprietaire</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Lot(s)</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Tantiemes</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Statut</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Mode</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 600, fontSize: 11 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSession.coproprietaires.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{c.prenom} {c.nom}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--sd-ink-2, #4A5E78)' }}>{c.lots.join(', ')}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{c.tantiemes}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: c.aVote ? 'rgba(26,122,110,0.1)' : 'rgba(212,131,10,0.1)', color: c.aVote ? '#1A7A6E' : '#D4830A' }}>
                          {c.aVote ? '\u2713 Vote recu' : 'En attente'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                        {c.modeVote && (
                          <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)' }}>
                            {c.modeVote === 'correspondance' ? 'Correspondance' : c.modeVote === 'electronique' ? 'Electronique' : 'Presentiel'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', ...sSmall }}>{c.dateVote ? formatDateShort(c.dateVote) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }

    // Session list view
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={sSubheading}>Sessions de vote en cours</h2>
            <p style={sSmall}>{sessionsEnCours.length} session{sessionsEnCours.length > 1 ? 's' : ''} active{sessionsEnCours.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowNewVote(true)} style={sBtnPrimary}>
            + Nouvelle session de vote
          </button>
        </div>

        {/* New vote form */}
        {showNewVote && (
          <div style={{ ...sCard, borderColor: 'var(--sd-gold, #C9A84C)' }}>
            <h3 style={{ ...sSubheading, fontSize: 15, marginBottom: 16 }}>Creer une session de vote</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre de l'AG</label>
                <input value={newVoteForm.agTitre} onChange={e => setNewVoteForm(p => ({ ...p, agTitre: e.target.value }))} placeholder="AG Ordinaire 2026" style={sInput} />
              </div>
              <div>
                <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Immeuble</label>
                <input value={newVoteForm.immeuble} onChange={e => setNewVoteForm(p => ({ ...p, immeuble: e.target.value }))} placeholder="Residence Les Oliviers" style={sInput} />
              </div>
              <div>
                <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date de l'AG</label>
                <input type="date" value={newVoteForm.dateAG} onChange={e => setNewVoteForm(p => ({ ...p, dateAG: e.target.value }))} style={sInput} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Resolutions (une par ligne)</label>
                <textarea value={newVoteForm.resolutions} onChange={e => setNewVoteForm(p => ({ ...p, resolutions: e.target.value }))} placeholder={'Approbation des comptes\nBudget previsionnel\nRenouvellement syndic'} rows={4} style={{ ...sInput, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleCreateSession} style={sBtnPrimary}>Creer la session</button>
              <button onClick={() => setShowNewVote(false)} style={sBtnSecondary}>Annuler</button>
            </div>
          </div>
        )}

        {sessionsEnCours.length === 0 && !showNewVote ? (
          <div style={{ ...sCard, textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83D\uDDF3\uFE0F'}</div>
            <h3 style={{ ...sSubheading, fontSize: 16, marginBottom: 6 }}>Aucune session de vote en cours</h3>
            <p style={{ ...sBody, maxWidth: 400, margin: '0 auto 16px' }}>Creez une session de vote par correspondance pour votre prochaine assemblee generale.</p>
            <button onClick={() => setShowNewVote(true)} style={sBtnGold}>Creer une session</button>
          </div>
        ) : (
          sessionsEnCours.map(session => {
            const votesRecus = session.coproprietaires.filter(c => c.aVote).length
            const totalCopros = session.coproprietaires.length
            const pctProgress = totalCopros > 0 ? (votesRecus / totalCopros) * 100 : 0
            const daysLeft = daysUntil(session.dateLimiteReception)

            return (
              <div key={session.id} style={{ ...sCard, cursor: 'pointer', transition: 'border-color 0.15s' }} onClick={() => setSelectedSession(session.id)} onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sd-border, #E4DDD0)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ ...sBody, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', fontSize: 15 }}>{session.agTitre}</h3>
                    <p style={{ ...sSmall, marginTop: 2 }}>{session.immeuble} — AG du {formatDate(session.dateAG)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {daysLeft >= 0 && (
                      <span style={{ ...sSmall, fontWeight: 600, color: daysLeft <= 3 ? '#DC2626' : daysLeft <= 7 ? '#D4830A' : '#2563EB' }}>
                        J-{daysLeft}
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: STATUT_LABELS[session.statut].bg, color: STATUT_LABELS[session.statut].color }}>
                      {STATUT_LABELS[session.statut].label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <span style={sSmall}>{session.resolutions.length} resolution{session.resolutions.length > 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    <span style={sSmall}>{votesRecus} / {totalCopros} votes recus</span>
                  </div>
                  <div>
                    <span style={sSmall}>{session.totalTantiemes} tantiemes</span>
                  </div>
                </div>

                <div style={sProgressBar}>
                  <div style={sProgressFill(pctProgress, 'var(--sd-gold, #C9A84C)')} />
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  // ─── Tab: Formulaires ─────────────────────────────────────────────────────────

  const renderFormulaires = () => {
    const sessionPourFormulaire = sessionsEnCours[0] || sessions[0]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Formulaire de vote par correspondance */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\uD83D\uDCDD'}</div>
            <div>
              <h3 style={sSubheading}>Formulaire de vote par correspondance</h3>
              <p style={sSmall}>Obligatoire depuis la loi ELAN (art. 17-1 A loi du 10 juillet 1965)</p>
            </div>
          </div>

          <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ ...sBody, fontWeight: 600, marginBottom: 8 }}>Contenu du formulaire :</p>
            <ul style={{ ...sBody, paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Identite du coproprietaire (nom, prenom, adresse)</li>
              <li>Numero(s) de lot(s) et tantiemes associes</li>
              <li>Pour chaque resolution : choix Pour / Contre / Abstention</li>
              <li>Date et signature du coproprietaire</li>
              <li>Mention de la majorite requise pour chaque resolution</li>
            </ul>
          </div>

          {sessionPourFormulaire && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ ...sSmall, fontWeight: 600, marginBottom: 8 }}>Apercu — {sessionPourFormulaire.agTitre}</p>
              <div style={{ border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: 16, background: '#fff' }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>FORMULAIRE DE VOTE PAR CORRESPONDANCE</p>
                  <p style={{ ...sSmall, marginTop: 4 }}>{sessionPourFormulaire.agTitre} — {formatDate(sessionPourFormulaire.dateAG)}</p>
                  <p style={{ ...sSmall }}>Art. 17-1 A loi n\u00B065-557 du 10 juillet 1965</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed var(--sd-border, #E4DDD0)' }}>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Nom du coproprietaire :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Lot(s) :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Tantiemes :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Immeuble :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                </div>

                {sessionPourFormulaire.resolutions.slice(0, 3).map(res => (
                  <div key={res.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px dotted var(--sd-border, #E4DDD0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ ...sBody, fontWeight: 600, fontSize: 12 }}>Resolution n\u00B0{res.numero} : {res.intitule}</span>
                      <span style={{ ...sSmall, fontWeight: 500, color: MAJORITE_CONFIG[res.majorite].color }}>{MAJORITE_CONFIG[res.majorite].label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      {['Pour', 'Contre', 'Abstention'].map(v => (
                        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, ...sSmall, cursor: 'default' }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--sd-border, #E4DDD0)', display: 'inline-block' }} />
                          {v}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {sessionPourFormulaire.resolutions.length > 3 && (
                  <p style={{ ...sSmall, fontStyle: 'italic' }}>... et {sessionPourFormulaire.resolutions.length - 3} autre(s) resolution(s)</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--sd-border, #E4DDD0)' }}>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Date :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Signature :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 24, marginTop: 4 }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleGenererFormulaires} disabled={genFormLoading} style={{ ...sBtnPrimary, opacity: genFormLoading ? 0.7 : 1 }}>
              {genFormLoading ? 'Generation en cours...' : genFormDone ? '\u2713 Formulaires generes' : 'Generer formulaires pour tous les coproprietaires'}
            </button>
            <button onClick={handleEnvoyerEmail} disabled={emailSending} style={{ ...sBtnGold, opacity: emailSending ? 0.7 : 1 }}>
              {emailSending ? 'Envoi en cours...' : emailSent ? '\u2713 Emails envoyes' : 'Envoyer par email'}
            </button>
          </div>
          <p style={{ ...sSmall, marginTop: 8 }}>
            Loi n\u00B02024-322 : envoi dematerialise sans consentement prealable du coproprietaire
          </p>
        </div>

        {/* Pouvoir / Mandat */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\uD83E\uDD1D'}</div>
            <div>
              <h3 style={sSubheading}>Pouvoir / Mandat de representation</h3>
              <p style={sSmall}>Art. 22 loi 1965 : max. 3 mandats par mandataire, sauf si total &lt; 10% des voix</p>
            </div>
          </div>

          <button onClick={() => setShowMandat(!showMandat)} style={sBtnSecondary}>
            {showMandat ? 'Masquer le formulaire' : 'Generer un mandat de representation'}
          </button>

          {showMandat && (
            <div style={{ marginTop: 16, border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: 16, background: 'var(--sd-cream, #F7F4EE)' }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', textAlign: 'center', marginBottom: 16 }}>
                POUVOIR — MANDAT DE REPRESENTATION EN AG
              </p>
              <p style={{ ...sSmall, textAlign: 'center', marginBottom: 16 }}>Art. 22 loi n\u00B065-557 du 10 juillet 1965</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mandant (coproprietaire)</label>
                  <input value={mandatForm.mandantNom} onChange={e => setMandatForm(p => ({ ...p, mandantNom: e.target.value }))} style={sInput} placeholder="Nom du coproprietaire" />
                </div>
                <div>
                  <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Lot(s)</label>
                  <input value={mandatForm.mandantLots} onChange={e => setMandatForm(p => ({ ...p, mandantLots: e.target.value }))} style={sInput} placeholder="A-101, B-003" />
                </div>
                <div>
                  <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tantiemes</label>
                  <input type="number" value={mandatForm.mandantTantiemes || ''} onChange={e => setMandatForm(p => ({ ...p, mandantTantiemes: parseInt(e.target.value) || 0 }))} style={sInput} placeholder="450" />
                </div>
                <div>
                  <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mandataire (representant)</label>
                  <input value={mandatForm.mandataireNom} onChange={e => setMandatForm(p => ({ ...p, mandataireNom: e.target.value }))} style={sInput} placeholder="Nom du mandataire" />
                </div>
                <div>
                  <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date de signature</label>
                  <input type="date" value={mandatForm.dateSignature} onChange={e => setMandatForm(p => ({ ...p, dateSignature: e.target.value }))} style={sInput} />
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 8, padding: 12, marginTop: 16, border: '1px solid var(--sd-border, #E4DDD0)' }}>
                <p style={{ ...sBody, lineHeight: 1.7, fontSize: 12 }}>
                  Je soussigne(e), <strong>{mandatForm.mandantNom || '____________________'}</strong>, coproprietaire du/des lot(s) <strong>{mandatForm.mandantLots || '________'}</strong> representant <strong>{mandatForm.mandantTantiemes || '____'}</strong> tantiemes, donne pouvoir a <strong>{mandatForm.mandataireNom || '____________________'}</strong> de me representer a l'assemblee generale et de voter en mon nom sur toutes les resolutions inscrites a l'ordre du jour.
                </p>
                <p style={{ ...sSmall, marginTop: 12, fontStyle: 'italic' }}>
                  Rappel : un mandataire ne peut detenir plus de 3 mandats, sauf si le total des voix dont il dispose (les siennes et celles de ses mandants) n'excede pas 10% des voix du syndicat (art. 22 al. 3).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--sd-border, #E4DDD0)' }}>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Fait le : {mandatForm.dateSignature ? formatDate(mandatForm.dateSignature + 'T00:00:00') : '____________________'}</span>
                  </div>
                  <div>
                    <span style={{ ...sSmall, fontWeight: 600 }}>Signature :</span>
                    <div style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', height: 32, marginTop: 4 }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Tab: Historique ──────────────────────────────────────────────────────────

  const renderHistorique = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={sSubheading}>Historique des votes en AG</h2>
        <p style={sSmall}>Resultats et suivi des notifications (art. 42 al. 2 loi 1965)</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={historiqueFilter.year} onChange={e => setHistoriqueFilter(p => ({ ...p, year: e.target.value }))} style={{ ...sInput, width: 'auto', minWidth: 120 }}>
          <option value="">Toutes les annees</option>
          {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input value={historiqueFilter.immeuble} onChange={e => setHistoriqueFilter(p => ({ ...p, immeuble: e.target.value }))} placeholder="Filtrer par immeuble..." style={{ ...sInput, width: 'auto', minWidth: 180 }} />
        <select value={historiqueFilter.resultat} onChange={e => setHistoriqueFilter(p => ({ ...p, resultat: e.target.value as any }))} style={{ ...sInput, width: 'auto', minWidth: 140 }}>
          <option value="">Tous les resultats</option>
          <option value="adoptee">Adoptees</option>
          <option value="rejetee">Rejetees</option>
        </select>
      </div>

      {filteredHistorique.length === 0 ? (
        <div style={{ ...sCard, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{'\uD83D\uDCDA'}</div>
          <p style={sBody}>Aucune AG cloturee correspondant aux filtres.</p>
        </div>
      ) : (
        filteredHistorique.map(session => {
          const adoptees = session.resolutions.filter(r => r.statut === 'adoptee').length
          const rejetees = session.resolutions.filter(r => r.statut === 'rejetee').length
          const notifDelai = session.dateNotification ? daysUntil(new Date(new Date(session.dateNotification).getTime() + 60 * 86400000).toISOString()) : null
          const opposantsNotifies = session.notificationOpposants

          return (
            <div key={session.id} style={sCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ ...sBody, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', fontSize: 15 }}>{session.agTitre}</h3>
                  <p style={{ ...sSmall, marginTop: 2 }}>{session.immeuble} — AG du {formatDate(session.dateAG)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: STATUT_LABELS[session.statut].bg, color: STATUT_LABELS[session.statut].color }}>
                    {STATUT_LABELS[session.statut].label}
                  </span>
                </div>
              </div>

              {/* Stats summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(26,122,110,0.06)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#1A7A6E' }}>{adoptees}</div>
                  <div style={sSmall}>Adoptee{adoptees > 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#DC2626' }}>{rejetees}</div>
                  <div style={sSmall}>Rejetee{rejetees > 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{session.coproprietaires.filter(c => c.aVote).length}/{session.coproprietaires.length}</div>
                  <div style={sSmall}>Votants</div>
                </div>
              </div>

              {/* Resolutions */}
              {session.resolutions.map(r => renderResolutionCard(r, session.totalTantiemes, true))}

              {/* Notification status */}
              <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <p style={{ ...sBody, fontWeight: 600, fontSize: 12, marginBottom: 2 }}>Notification aux opposants et absents</p>
                    <p style={sSmall}>Art. 42 al. 2 : notification sous 1 mois, delai de contestation de 2 mois</p>
                  </div>
                  {opposantsNotifies ? (
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(26,122,110,0.1)', color: '#1A7A6E' }}>
                        {'\u2713'} Notifies le {session.dateNotification ? formatDateShort(session.dateNotification) : '—'}
                      </span>
                      {notifDelai !== null && (
                        <p style={{ ...sSmall, marginTop: 4 }}>
                          Delai de contestation : {notifDelai > 0 ? `${notifDelai} jour${notifDelai > 1 ? 's' : ''} restant${notifDelai > 1 ? 's' : ''}` : 'Expire'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => handleNotifierOpposants(session.id)} style={{ ...sBtnSecondary, fontSize: 12, padding: '6px 14px' }}>
                      Envoyer les notifications
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  // ─── Tab: Configuration ───────────────────────────────────────────────────────

  const renderConfiguration = () => {
    const toggleConfig = (key: keyof ConfigVote) => {
      const updated = { ...config, [key]: !config[key] }
      save(sessions, updated)
    }

    const updateNumericConfig = (key: keyof ConfigVote, value: number) => {
      const updated = { ...config, [key]: value }
      save(sessions, updated)
    }

    const renderToggle = (label: string, description: string, key: keyof ConfigVote) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
        <div style={{ flex: 1, marginRight: 16 }}>
          <p style={{ ...sBody, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{label}</p>
          <p style={sSmall}>{description}</p>
        </div>
        <div style={sToggleTrack(!!config[key])} onClick={() => toggleConfig(key)}>
          <div style={sToggleThumb(!!config[key])} />
        </div>
      </div>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* AG Hybride */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\uD83D\uDCF9'}</div>
            <h3 style={sSubheading}>AG Hybride</h3>
          </div>
          {renderToggle(
            'Presentiel + Visioconference',
            'Permet la participation a distance des coproprietaires (art. 17-1 AA loi 1965 modifie par loi ELAN)',
            'hybride'
          )}
          {config.hybride && (
            <div style={{ marginTop: 12 }}>
              <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>URL de visioconference</label>
              <input value={config.visioUrl} onChange={e => { const updated = { ...config, visioUrl: e.target.value }; save(sessions, updated) }} placeholder="https://meet.example.com/ag-copro" style={sInput} />
            </div>
          )}
        </div>

        {/* Vote electronique */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\uD83D\uDD12'}</div>
            <h3 style={sSubheading}>Vote electronique</h3>
          </div>
          {renderToggle('Activer le vote electronique', 'Permettre aux coproprietaires de voter en ligne de maniere securisee', 'voteElectronique')}
          {config.voteElectronique && (
            <>
              {renderToggle('Authentification 2FA', 'Double authentification obligatoire pour valider un vote', 'auth2FA')}
              {renderToggle('Horodatage certifie', 'Horodatage conforme eIDAS pour chaque vote enregistre', 'horodatage')}
              {renderToggle('Archivage securise', 'Conservation des votes dans un coffre-fort numerique certifie', 'archivageSecurise')}
            </>
          )}
        </div>

        {/* Envoi dematerialise */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\uD83D\uDCE7'}</div>
            <h3 style={sSubheading}>Envoi dematerialise</h3>
          </div>
          {renderToggle(
            'Convocations par voie electronique',
            'Loi n\u00B02024-322 : envoi dematerialise sans consentement prealable du coproprietaire (sauf opposition expresse)',
            'envoiDematerialise'
          )}
        </div>

        {/* Delais et quorum */}
        <div style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(26,122,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u2696\uFE0F'}</div>
            <h3 style={sSubheading}>Delais et quorum</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Delai de convocation (jours)</label>
              <input type="number" value={config.delaiConvocationJours} onChange={e => updateNumericConfig('delaiConvocationJours', parseInt(e.target.value) || 21)} style={sInput} min={21} />
              <p style={{ ...sSmall, marginTop: 4, fontStyle: 'italic' }}>Minimum legal : 21 jours (art. 9 decret n\u00B067-223 du 17 mars 1967)</p>
            </div>
            <div>
              <label style={{ ...sSmall, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quorum (%)</label>
              <input type="number" value={config.quorumPct} onChange={e => updateNumericConfig('quorumPct', parseInt(e.target.value) || 25)} style={sInput} min={0} max={100} />
              <p style={{ ...sSmall, marginTop: 4, fontStyle: 'italic' }}>Pas de quorum legal en copropriete (sauf clause specifique du reglement)</p>
            </div>
          </div>
        </div>

        {/* Legal references */}
        <div style={{ ...sCard, background: 'var(--sd-cream, #F7F4EE)' }}>
          <h3 style={{ ...sBody, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>References legales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {[
              { ref: 'Art. 17-1 A', desc: 'Vote par correspondance obligatoire (loi ELAN)' },
              { ref: 'Art. 22', desc: 'Mandats de representation (max. 3 mandats)' },
              { ref: 'Art. 24', desc: 'Majorite simple des voix exprimees' },
              { ref: 'Art. 25', desc: 'Majorite absolue de tous les coproprietaires' },
              { ref: 'Art. 25-1', desc: 'Passerelle : 2e vote a art. 24 si 1/3 favorable' },
              { ref: 'Art. 26', desc: 'Double majorite (2/3 des voix)' },
              { ref: 'Art. 42 al. 2', desc: 'Notification opposants sous 1 mois, contestation 2 mois' },
              { ref: 'Art. 9 decret 1967', desc: 'Delai convocation 21 jours minimum' },
              { ref: 'Loi 2024-322', desc: 'Envoi dematerialise sans consentement prealable' },
            ].map(item => (
              <div key={item.ref} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(13,27,46,0.08)', color: 'var(--sd-navy, #0D1B2E)', flexShrink: 0, marginTop: 1 }}>{item.ref}</span>
                <span style={sSmall}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={sHeading}>Vote par correspondance</h1>
        <p style={{ ...sBody, marginTop: 6 }}>
          Gestion des votes par correspondance et electroniques pour les assemblees generales de copropriete
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 0 }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedSession(null) }}
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--sd-gold, #C9A84C)' : '2px solid transparent',
              padding: '10px 18px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'votes' && renderVotesEnCours()}
      {activeTab === 'formulaires' && renderFormulaires()}
      {activeTab === 'historique' && renderHistorique()}
      {activeTab === 'configuration' && renderConfiguration()}
    </div>
  )
}
