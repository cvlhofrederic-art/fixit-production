'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────

type TypeSondage = 'oui_non' | 'choix_multiple' | 'echelle_1_5' | 'texte_libre'
type StatutSondage = 'actif' | 'en_cours' | 'cloture'
type CibleSondage = 'tous' | 'par_immeuble' | 'par_batiment'

interface OptionSondage {
  id: string
  texte: string
  votes: number
}

interface ReponseSondage {
  coproId: string
  coproNom: string
  valeur: string
  dateReponse: string
}

interface Sondage {
  id: string
  titre: string
  description: string
  type: TypeSondage
  options: OptionSondage[]
  cible: CibleSondage
  cibleDetail?: string
  dateLimite: string
  anonyme: boolean
  notificationAuto: boolean
  statut: StatutSondage
  reponses: ReponseSondage[]
  totalCopros: number
  immeuble?: string
  creeA: string
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const TYPES_SONDAGE: Record<TypeSondage, { label: string; emoji: string }> = {
  oui_non:         { label: 'Oui / Non',        emoji: '✅' },
  choix_multiple:  { label: 'Choix multiple',    emoji: '📋' },
  echelle_1_5:     { label: 'Echelle 1-5',       emoji: '⭐' },
  texte_libre:     { label: 'Texte libre',       emoji: '✏️' },
}

const STATUT_CONFIG: Record<StatutSondage, { label: string; bg: string; color: string; dot: string }> = {
  actif:    { label: 'Actif',    bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  en_cours: { label: 'En cours', bg: '#E8F0FE', color: '#1A56DB', dot: '#1A56DB' },
  cloture:  { label: 'Cloture',  bg: '#F0F0F0', color: '#6B7280', dot: '#6B7280' },
}

const TEMPLATES: { titre: string; description: string; type: TypeSondage; options: string[] }[] = [
  {
    titre: 'Horaires gardien',
    description: 'Quels horaires de presence du gardien preferez-vous pour la copropriete ?',
    type: 'choix_multiple',
    options: ['Matin (7h-12h)', 'Apres-midi (13h-18h)', 'Journee complete (8h-17h)', 'Mi-temps matin (8h-12h)'],
  },
  {
    titre: 'Ravalement facade - couleur',
    description: 'Quelle couleur preferez-vous pour le ravalement de la facade de l\'immeuble ?',
    type: 'choix_multiple',
    options: ['Blanc casse', 'Pierre de taille', 'Gris clair', 'Beige sable'],
  },
  {
    titre: 'Satisfaction nettoyage',
    description: 'Comment evaluez-vous la qualite du nettoyage des parties communes au dernier trimestre ?',
    type: 'echelle_1_5',
    options: [],
  },
  {
    titre: 'Choix prestataire espaces verts',
    description: 'Quel prestataire souhaitez-vous retenir pour l\'entretien des espaces verts de la copropriete ?',
    type: 'choix_multiple',
    options: ['Jardivert SARL', 'Les Jardins du Sud', 'Espaces Verts Plus', 'Garder le prestataire actuel'],
  },
  {
    titre: 'Travaux parking',
    description: 'Approuvez-vous la realisation des travaux de renovation du parking souterrain, conformement au devis presente en AG ?',
    type: 'oui_non',
    options: [],
  },
]

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return s }
}

const joursRestants = (dateLimite: string): number => {
  const diff = new Date(dateLimite).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Donnees demo ───────────────────────────────────────────────────────────

const genererDemoData = (): Sondage[] => {
  const now = new Date()
  const dans15 = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10)
  const dans7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const dans3 = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const il30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const il60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10)

  return [
    {
      id: 'sond-demo-1',
      titre: 'Horaires de presence du gardien',
      description: 'Quel creneau horaire preferez-vous pour la presence du gardien dans l\'immeuble ? Merci de participer avant la date limite.',
      type: 'choix_multiple',
      options: [
        { id: 'o1', texte: 'Matin (7h-12h)', votes: 9 },
        { id: 'o2', texte: 'Apres-midi (13h-18h)', votes: 4 },
        { id: 'o3', texte: 'Journee complete (8h-17h)', votes: 14 },
        { id: 'o4', texte: 'Sans preference', votes: 3 },
      ],
      cible: 'tous',
      dateLimite: dans15,
      anonyme: false,
      notificationAuto: true,
      statut: 'actif',
      reponses: Array.from({ length: 30 }, (_, i) => ({
        coproId: `c${i}`,
        coproNom: `Coproprietaire ${String.fromCharCode(65 + (i % 26))}`,
        valeur: ['Matin (7h-12h)', 'Apres-midi (13h-18h)', 'Journee complete (8h-17h)', 'Sans preference'][i % 4],
        dateReponse: new Date(Date.now() - i * 86400000).toISOString(),
      })),
      totalCopros: 48,
      immeuble: 'Residence Les Tilleuls',
      creeA: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'sond-demo-2',
      titre: 'Ravalement facade - approbation',
      description: 'Etes-vous favorable a la realisation du ravalement de facade prevu au budget 2026, pour un montant de 85 000 EUR ?',
      type: 'oui_non',
      options: [
        { id: 'os1', texte: 'Oui', votes: 22 },
        { id: 'os2', texte: 'Non', votes: 8 },
      ],
      cible: 'par_immeuble',
      cibleDetail: 'Residence Les Tilleuls',
      dateLimite: dans7,
      anonyme: false,
      notificationAuto: true,
      statut: 'en_cours',
      reponses: Array.from({ length: 30 }, (_, i) => ({
        coproId: `c${i}`,
        coproNom: `Coproprietaire ${String.fromCharCode(65 + (i % 26))}`,
        valeur: i < 22 ? 'Oui' : 'Non',
        dateReponse: new Date(Date.now() - i * 43200000).toISOString(),
      })),
      totalCopros: 36,
      immeuble: 'Residence Les Tilleuls',
      creeA: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      id: 'sond-demo-3',
      titre: 'Satisfaction nettoyage parties communes',
      description: 'De 1 a 5, comment evaluez-vous la qualite du nettoyage des parties communes au dernier trimestre ?',
      type: 'echelle_1_5',
      options: [
        { id: 'oe1', texte: '1 - Tres insatisfait', votes: 2 },
        { id: 'oe2', texte: '2 - Insatisfait', votes: 4 },
        { id: 'oe3', texte: '3 - Neutre', votes: 6 },
        { id: 'oe4', texte: '4 - Satisfait', votes: 12 },
        { id: 'oe5', texte: '5 - Tres satisfait', votes: 8 },
      ],
      cible: 'tous',
      dateLimite: dans3,
      anonyme: true,
      notificationAuto: true,
      statut: 'actif',
      reponses: Array.from({ length: 32 }, (_, i) => ({
        coproId: `c${i}`,
        coproNom: `Coproprietaire ${String.fromCharCode(65 + (i % 26))}`,
        valeur: String([1, 2, 3, 3, 4, 4, 4, 4, 5, 5][i % 10]),
        dateReponse: new Date(Date.now() - i * 21600000).toISOString(),
      })),
      totalCopros: 48,
      immeuble: 'Le Clos des Vignes',
      creeA: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      id: 'sond-demo-4',
      titre: 'Choix prestataire espaces verts',
      description: 'Suite a l\'appel d\'offres, quel prestataire souhaitez-vous retenir pour l\'entretien des espaces verts ?',
      type: 'choix_multiple',
      options: [
        { id: 'oc1', texte: 'Jardivert SARL', votes: 18 },
        { id: 'oc2', texte: 'Les Jardins du Sud', votes: 12 },
        { id: 'oc3', texte: 'Garder le prestataire actuel', votes: 8 },
      ],
      cible: 'par_immeuble',
      cibleDetail: 'Le Clos des Vignes',
      dateLimite: il30,
      anonyme: false,
      notificationAuto: true,
      statut: 'cloture',
      reponses: Array.from({ length: 38 }, (_, i) => ({
        coproId: `c${i}`,
        coproNom: `Coproprietaire ${String.fromCharCode(65 + (i % 26))}`,
        valeur: ['Jardivert SARL', 'Les Jardins du Sud', 'Garder le prestataire actuel'][i % 3],
        dateReponse: new Date(Date.now() - (30 + i) * 86400000).toISOString(),
      })),
      totalCopros: 48,
      immeuble: 'Le Clos des Vignes',
      creeA: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: 'sond-demo-5',
      titre: 'Travaux parking souterrain',
      description: 'Approuvez-vous la realisation des travaux de mise aux normes du parking souterrain, conformement au devis presente lors de la derniere AG ?',
      type: 'oui_non',
      options: [
        { id: 'op1', texte: 'Oui', votes: 30 },
        { id: 'op2', texte: 'Non', votes: 5 },
      ],
      cible: 'tous',
      dateLimite: il60,
      anonyme: false,
      notificationAuto: true,
      statut: 'cloture',
      reponses: Array.from({ length: 35 }, (_, i) => ({
        coproId: `c${i}`,
        coproNom: `Coproprietaire ${String.fromCharCode(65 + (i % 26))}`,
        valeur: i < 30 ? 'Oui' : 'Non',
        dateReponse: new Date(Date.now() - (60 + i) * 86400000).toISOString(),
      })),
      totalCopros: 48,
      immeuble: 'Residence Les Tilleuls',
      creeA: new Date(Date.now() - 90 * 86400000).toISOString(),
    },
  ]
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function SondagesFRSection({ user, userRole }: Props) {
  // ── State
  const [sondages, setSondages] = useState<Sondage[]>([])
  const [tab, setTab] = useState<'actifs' | 'historique' | 'creer'>('actifs')
  const [selectedSondage, setSelectedSondage] = useState<Sondage | null>(null)

  // ── Filtres historique
  const [filtreImmeuble, setFiltreImmeuble] = useState<string>('tous')
  const [filtreAnnee, setFiltreAnnee] = useState<string>('tous')

  // ── Formulaire creation
  const [formTitre, setFormTitre] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<TypeSondage>('oui_non')
  const [formOptions, setFormOptions] = useState<string[]>(['', ''])
  const [formCible, setFormCible] = useState<CibleSondage>('tous')
  const [formCibleDetail, setFormCibleDetail] = useState('')
  const [formDateLimite, setFormDateLimite] = useState('')
  const [formAnonyme, setFormAnonyme] = useState(false)
  const [formNotification, setFormNotification] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  // ── Storage
  const STORAGE_KEY = `fixit_sondages_fr_${user.id}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSondages(parsed)
          return
        }
      }
    } catch { /* ignore */ }
    const demo = genererDemoData()
    setSondages(demo)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
  }, [])

  useEffect(() => {
    if (sondages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sondages))
    }
  }, [sondages])

  // ── Donnees derivees
  const sondagesActifs = useMemo(() =>
    sondages.filter(s => s.statut === 'actif' || s.statut === 'en_cours'),
    [sondages]
  )

  const immeublesUniques = useMemo(() => {
    const set = new Set(sondages.map(s => s.immeuble).filter(Boolean))
    return Array.from(set) as string[]
  }, [sondages])

  const anneesUniques = useMemo(() => {
    const set = new Set(sondages.map(s => new Date(s.creeA).getFullYear().toString()))
    return Array.from(set).sort().reverse()
  }, [sondages])

  const sondagesHistorique = useMemo(() => {
    let list = sondages.filter(s => s.statut === 'cloture')
    if (filtreImmeuble !== 'tous') list = list.filter(s => s.immeuble === filtreImmeuble)
    if (filtreAnnee !== 'tous') list = list.filter(s => new Date(s.creeA).getFullYear().toString() === filtreAnnee)
    return list
  }, [sondages, filtreImmeuble, filtreAnnee])

  const participationMoyenne = useMemo(() => {
    const clotures = sondages.filter(s => s.statut === 'cloture')
    if (clotures.length === 0) return 0
    const total = clotures.reduce((sum, s) => sum + (s.reponses.length / s.totalCopros) * 100, 0)
    return Math.round(total / clotures.length)
  }, [sondages])

  // ── Actions
  const creerSondage = () => {
    if (!formTitre.trim() || !formDateLimite) return

    let options: OptionSondage[] = []
    if (formType === 'oui_non') {
      options = [
        { id: crypto.randomUUID(), texte: 'Oui', votes: 0 },
        { id: crypto.randomUUID(), texte: 'Non', votes: 0 },
      ]
    } else if (formType === 'choix_multiple') {
      options = formOptions.filter(o => o.trim()).map(o => ({
        id: crypto.randomUUID(), texte: o.trim(), votes: 0,
      }))
      if (options.length < 2) return
    } else if (formType === 'echelle_1_5') {
      options = [
        { id: crypto.randomUUID(), texte: '1 - Tres insatisfait', votes: 0 },
        { id: crypto.randomUUID(), texte: '2 - Insatisfait', votes: 0 },
        { id: crypto.randomUUID(), texte: '3 - Neutre', votes: 0 },
        { id: crypto.randomUUID(), texte: '4 - Satisfait', votes: 0 },
        { id: crypto.randomUUID(), texte: '5 - Tres satisfait', votes: 0 },
      ]
    }

    const nouveau: Sondage = {
      id: crypto.randomUUID(),
      titre: formTitre.trim(),
      description: formDescription.trim(),
      type: formType,
      options,
      cible: formCible,
      cibleDetail: formCible !== 'tous' ? formCibleDetail.trim() : undefined,
      dateLimite: formDateLimite,
      anonyme: formAnonyme,
      notificationAuto: formNotification,
      statut: 'actif',
      reponses: [],
      totalCopros: 48,
      immeuble: formCible === 'par_immeuble' ? formCibleDetail.trim() : undefined,
      creeA: new Date().toISOString(),
    }

    setSondages(prev => [nouveau, ...prev])
    reinitialiserFormulaire()
    setShowPreview(false)
    setTab('actifs')
  }

  const reinitialiserFormulaire = () => {
    setFormTitre(''); setFormDescription(''); setFormType('oui_non')
    setFormOptions(['', '']); setFormCible('tous'); setFormCibleDetail('')
    setFormDateLimite(''); setFormAnonyme(false); setFormNotification(true)
    setShowPreview(false)
  }

  const cloturerSondage = (id: string) => {
    setSondages(prev => prev.map(s => s.id === id ? { ...s, statut: 'cloture' as StatutSondage } : s))
    setSelectedSondage(null)
  }

  const supprimerSondage = (id: string) => {
    setSondages(prev => prev.filter(s => s.id !== id))
    setSelectedSondage(null)
  }

  const appliquerTemplate = (tpl: typeof TEMPLATES[number]) => {
    setFormTitre(tpl.titre)
    setFormDescription(tpl.description)
    setFormType(tpl.type)
    setFormOptions(tpl.options.length > 0 ? tpl.options : ['', ''])
  }

  const ajouterOption = () => setFormOptions(prev => [...prev, ''])

  const supprimerOption = (idx: number) => {
    if (formOptions.length <= 2) return
    setFormOptions(prev => prev.filter((_, i) => i !== idx))
  }

  const modifierOption = (idx: number, val: string) => {
    setFormOptions(prev => prev.map((o, i) => i === idx ? val : o))
  }

  // ── Styles
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  }

  const statCardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 16,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-navy, #0D1B2E)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnGold: React.CSSProperties = {
    background: 'var(--sd-gold, #C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnOutline: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--sd-ink-2, #4A5E78)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    background: '#FDECEA',
    color: '#C0392B',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'inherit',
    background: '#fff',
    color: 'var(--sd-navy, #0D1B2E)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--sd-navy, #0D1B2E)',
    marginBottom: 6,
    display: 'block',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'auto' as const,
  }

  // ── Render helpers

  const renderBadge = (statut: StatutSondage) => {
    const cfg = STATUT_CONFIG[statut]
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: cfg.bg, color: cfg.color,
        borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
        {cfg.label}
      </span>
    )
  }

  const renderProgressBar = (repondu: number, total: number) => {
    const pct = total > 0 ? Math.round((repondu / total) * 100) : 0
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
          <span>{repondu}/{total} coproprietaires ont repondu</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 4,
            background: pct >= 75 ? '#1A7A6E' : pct >= 50 ? 'var(--sd-gold, #C9A84C)' : '#D4830A',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    )
  }

  const renderBarChart = (options: OptionSondage[]) => {
    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0)
    const maxVotes = Math.max(...options.map(o => o.votes), 1)

    return (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(op => {
          const pct = totalVotes > 0 ? Math.round((op.votes / totalVotes) * 100) : 0
          const barWidth = maxVotes > 0 ? Math.round((op.votes / maxVotes) * 100) : 0
          return (
            <div key={op.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
                <span>{op.texte}</span>
                <span style={{ fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)' }}>{op.votes} ({pct}%)</span>
              </div>
              <div style={{ width: '100%', height: 12, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${barWidth}%`, height: '100%', borderRadius: 6,
                  background: 'linear-gradient(90deg, var(--sd-navy, #0D1B2E), var(--sd-gold, #C9A84C))',
                  transition: 'width 0.3s ease',
                  minWidth: op.votes > 0 ? 4 : 0,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderSondageCard = (sondage: Sondage, showActions: boolean = true) => {
    const jours = joursRestants(sondage.dateLimite)
    return (
      <div key={sondage.id} style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{TYPES_SONDAGE[sondage.type].emoji}</span>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                {sondage.titre}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 8px', lineHeight: 1.5 }}>
              {sondage.description}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
              {renderBadge(sondage.statut)}
              <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>
                {TYPES_SONDAGE[sondage.type].label}
              </span>
              {sondage.immeuble && (
                <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>
                  🏢 {sondage.immeuble}
                </span>
              )}
              {sondage.anonyme && (
                <span style={{ background: '#F0F0F0', color: '#6B7280', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                  🔒 Anonyme
                </span>
              )}
              {sondage.statut !== 'cloture' && (
                <span style={{
                  color: jours <= 3 ? '#C0392B' : jours <= 7 ? '#D4830A' : 'var(--sd-ink-3, #8A9BB0)',
                  fontWeight: jours <= 3 ? 600 : 400,
                }}>
                  ⏰ {jours > 0 ? `${jours} jours restants` : 'Delai expire'}
                </span>
              )}
              {sondage.statut === 'cloture' && (
                <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>
                  📅 Cloture le {formatDate(sondage.dateLimite)}
                </span>
              )}
            </div>
          </div>
          {showActions && sondage.statut !== 'cloture' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedSondage(sondage)} style={{ ...btnOutline, padding: '6px 12px', fontSize: 12 }}>
                Voir details
              </button>
              <button onClick={() => cloturerSondage(sondage.id)} style={btnDanger}>
                Cloturer
              </button>
            </div>
          )}
          {showActions && sondage.statut === 'cloture' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedSondage(sondage)} style={{ ...btnOutline, padding: '6px 12px', fontSize: 12 }}>
                Voir resultats
              </button>
              <button onClick={() => supprimerSondage(sondage.id)} style={btnDanger}>
                Supprimer
              </button>
            </div>
          )}
        </div>

        {renderProgressBar(sondage.reponses.length, sondage.totalCopros)}
        {renderBarChart(sondage.options)}
      </div>
    )
  }

  // ── Toggle helper
  const renderToggle = (value: boolean, onChange: () => void, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <button
        onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
      <span style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{label}</span>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            📊 Sondages coproprietaires
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Consultez l'avis des coproprietaires de maniere rapide et organisee
          </p>
        </div>
        <button onClick={() => { reinitialiserFormulaire(); setTab('creer') }} style={btnPrimary}>
          + Nouveau sondage
        </button>
      </div>

      {/* ── Statistiques ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '📊', label: 'Sondages actifs', value: sondagesActifs.length, color: '#1A7A6E' },
          { emoji: '📁', label: 'Historique total', value: sondages.filter(s => s.statut === 'cloture').length, color: 'var(--sd-navy, #0D1B2E)' },
          { emoji: '📈', label: 'Participation moyenne', value: `${participationMoyenne}%`, color: 'var(--sd-gold, #C9A84C)' },
          { emoji: '👥', label: 'Total reponses', value: sondages.reduce((s, e) => s + e.reponses.length, 0), color: '#1A56DB' },
        ].map((s, i) => (
          <div key={i} style={statCardStyle}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12 }}>
        {[
          { key: 'actifs' as const, label: '📊 Sondages actifs', count: sondagesActifs.length },
          { key: 'historique' as const, label: '📁 Historique', count: sondages.filter(s => s.statut === 'cloture').length },
          { key: 'creer' as const, label: '✏️ Creer un sondage' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedSondage(null) }}
            style={{
              background: tab === t.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: tab === t.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── Modal detail ── */}
      {selectedSondage && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%',
            maxHeight: '85vh', overflow: 'auto', padding: 28,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                  {selectedSondage.titre}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '6px 0 0' }}>
                  {selectedSondage.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedSondage(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {renderBadge(selectedSondage.statut)}
              <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {TYPES_SONDAGE[selectedSondage.type].emoji} {TYPES_SONDAGE[selectedSondage.type].label}
              </span>
              {selectedSondage.immeuble && (
                <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>🏢 {selectedSondage.immeuble}</span>
              )}
              {selectedSondage.anonyme && (
                <span style={{ background: '#F0F0F0', color: '#6B7280', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                  🔒 Anonyme
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ ...statCardStyle, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Date limite</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatDate(selectedSondage.dateLimite)}</div>
              </div>
              <div style={{ ...statCardStyle, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Cree le</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatDate(selectedSondage.creeA)}</div>
              </div>
            </div>

            {renderProgressBar(selectedSondage.reponses.length, selectedSondage.totalCopros)}

            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Resultats</h4>
              {renderBarChart(selectedSondage.options)}
            </div>

            {/* Dernieres reponses */}
            {selectedSondage.reponses.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>
                  Dernieres reponses ({selectedSondage.reponses.length})
                </h4>
                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 8 }}>
                  {selectedSondage.reponses.slice(0, 20).map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                      borderBottom: i < 19 ? '1px solid var(--sd-cream, #F7F4EE)' : 'none',
                      fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--sd-navy, #0D1B2E)' }}>
                        {selectedSondage.anonyme ? `Reponse #${i + 1}` : r.coproNom}
                      </span>
                      <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>{r.valeur}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              {selectedSondage.statut !== 'cloture' && (
                <button onClick={() => cloturerSondage(selectedSondage.id)} style={btnDanger}>
                  Cloturer le sondage
                </button>
              )}
              <button onClick={() => setSelectedSondage(null)} style={btnOutline}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ TAB 1 — Sondages actifs ═══════════════════════ */}
      {tab === 'actifs' && (
        <div>
          {sondagesActifs.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>
                Aucun sondage actif
              </h3>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
                Creez un nouveau sondage pour consulter vos coproprietaires
              </p>
              <button onClick={() => { reinitialiserFormulaire(); setTab('creer') }} style={btnPrimary}>
                + Creer un sondage
              </button>
            </div>
          ) : (
            sondagesActifs.map(s => renderSondageCard(s))
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 2 — Historique ═══════════════════════ */}
      {tab === 'historique' && (
        <div>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginRight: 6 }}>Immeuble :</label>
              <select
                value={filtreImmeuble}
                onChange={e => setFiltreImmeuble(e.target.value)}
                style={{ ...selectStyle, width: 'auto', minWidth: 160 }}
              >
                <option value="tous">Tous les immeubles</option>
                {immeublesUniques.map(im => (
                  <option key={im} value={im}>{im}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginRight: 6 }}>Annee :</label>
              <select
                value={filtreAnnee}
                onChange={e => setFiltreAnnee(e.target.value)}
                style={{ ...selectStyle, width: 'auto', minWidth: 100 }}
              >
                <option value="tous">Toutes</option>
                {anneesUniques.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div style={{
              marginLeft: 'auto', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 600,
            }}>
              📈 Participation moyenne : {participationMoyenne}%
            </div>
          </div>

          {sondagesHistorique.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>
                Aucun sondage cloture
              </h3>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                Les sondages clotures apparaitront ici avec leurs resultats finaux
              </p>
            </div>
          ) : (
            sondagesHistorique.map(s => renderSondageCard(s))
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 3 — Creer un sondage ═══════════════════════ */}
      {tab === 'creer' && (
        <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 24 }}>
          {/* Formulaire */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 20, marginTop: 0 }}>
              Nouveau sondage
            </h3>

            {/* Templates */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Modeles rapides</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => appliquerTemplate(tpl)}
                    style={{
                      background: 'var(--sd-cream, #F7F4EE)',
                      color: 'var(--sd-navy, #0D1B2E)',
                      border: '1px solid var(--sd-border, #E4DDD0)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {tpl.titre}
                  </button>
                ))}
              </div>
            </div>

            {/* Titre */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Titre du sondage *</label>
              <input
                type="text"
                value={formTitre}
                onChange={e => setFormTitre(e.target.value)}
                placeholder="Ex: Choix prestataire nettoyage"
                style={inputStyle}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Decrivez l'objet du sondage..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Type de sondage</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {(Object.entries(TYPES_SONDAGE) as [TypeSondage, { label: string; emoji: string }][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setFormType(key)
                      if (key === 'oui_non' || key === 'echelle_1_5' || key === 'texte_libre') {
                        setFormOptions(['', ''])
                      }
                    }}
                    style={{
                      background: formType === key ? 'var(--sd-navy, #0D1B2E)' : '#fff',
                      color: formType === key ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                      border: `1px solid ${formType === key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-border, #E4DDD0)'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: formType === key ? 600 : 400,
                    }}
                  >
                    {val.emoji} {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options dynamiques (choix multiple) */}
            {formType === 'choix_multiple' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Options de reponse</label>
                {formOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => modifierOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {formOptions.length > 2 && (
                      <button
                        onClick={() => supprimerOption(idx)}
                        style={{
                          background: '#FDECEA', color: '#C0392B', border: 'none',
                          borderRadius: 8, padding: '0 12px', fontSize: 16, cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={ajouterOption} style={{ ...btnOutline, padding: '6px 14px', fontSize: 12, marginTop: 4 }}>
                  + Ajouter une option
                </button>
              </div>
            )}

            {/* Cible */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Cible</label>
              <select
                value={formCible}
                onChange={e => setFormCible(e.target.value as CibleSondage)}
                style={selectStyle}
              >
                <option value="tous">Tous les coproprietaires</option>
                <option value="par_immeuble">Par immeuble</option>
                <option value="par_batiment">Par batiment</option>
              </select>
              {(formCible === 'par_immeuble' || formCible === 'par_batiment') && (
                <input
                  type="text"
                  value={formCibleDetail}
                  onChange={e => setFormCibleDetail(e.target.value)}
                  placeholder={formCible === 'par_immeuble' ? 'Nom de l\'immeuble' : 'Nom du batiment'}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
              )}
            </div>

            {/* Date limite */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Date limite *</label>
              <input
                type="date"
                value={formDateLimite}
                onChange={e => setFormDateLimite(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={inputStyle}
              />
            </div>

            {/* Toggles */}
            {renderToggle(formAnonyme, () => setFormAnonyme(!formAnonyme), 'Sondage anonyme')}
            {renderToggle(formNotification, () => setFormNotification(!formNotification), 'Notification automatique aux coproprietaires')}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button onClick={() => setShowPreview(!showPreview)} style={btnOutline}>
                {showPreview ? 'Masquer l\'apercu' : 'Apercu'}
              </button>
              <button
                onClick={creerSondage}
                disabled={!formTitre.trim() || !formDateLimite}
                style={{
                  ...btnGold,
                  opacity: (!formTitre.trim() || !formDateLimite) ? 0.5 : 1,
                  cursor: (!formTitre.trim() || !formDateLimite) ? 'not-allowed' : 'pointer',
                }}
              >
                Creer le sondage
              </button>
              <button onClick={reinitialiserFormulaire} style={{ ...btnOutline, color: '#C0392B' }}>
                Reinitialiser
              </button>
            </div>
          </div>

          {/* Apercu */}
          {showPreview && (
            <div>
              <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12, marginTop: 0 }}>
                Apercu du sondage
              </h4>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{TYPES_SONDAGE[formType].emoji}</span>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                    {formTitre || 'Titre du sondage'}
                  </h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 12px', lineHeight: 1.5 }}>
                  {formDescription || 'Description du sondage...'}
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {renderBadge('actif')}
                  <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                    {TYPES_SONDAGE[formType].label}
                  </span>
                  {formCible !== 'tous' && formCibleDetail && (
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                      🏢 {formCibleDetail}
                    </span>
                  )}
                  {formAnonyme && (
                    <span style={{ background: '#F0F0F0', color: '#6B7280', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>
                      🔒 Anonyme
                    </span>
                  )}
                  {formDateLimite && (
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                      ⏰ Date limite : {formatDate(formDateLimite)}
                    </span>
                  )}
                </div>

                {/* Apercu options */}
                {formType === 'oui_non' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Oui', 'Non'].map(opt => (
                      <div key={opt} style={{
                        padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)',
                        borderRadius: 8, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)',
                      }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {formType === 'choix_multiple' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {formOptions.filter(o => o.trim()).map((opt, i) => (
                      <div key={i} style={{
                        padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)',
                        borderRadius: 8, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)',
                      }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {formType === 'echelle_1_5' && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} style={{
                        width: 44, height: 44, borderRadius: '50%',
                        border: '2px solid var(--sd-border, #E4DDD0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)',
                      }}>
                        {n}
                      </div>
                    ))}
                  </div>
                )}
                {formType === 'texte_libre' && (
                  <div style={{
                    padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)',
                    borderRadius: 8, fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)',
                    minHeight: 60,
                  }}>
                    Zone de texte libre...
                  </div>
                )}

                {formNotification && (
                  <div style={{
                    marginTop: 12, background: '#E8F0FE', borderRadius: 8,
                    padding: '8px 12px', fontSize: 12, color: '#1A56DB',
                  }}>
                    🔔 Notification automatique envoyee aux coproprietaires a la publication
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
