'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type CategorieAvis = 'maintenance' | 'assemblee' | 'finances' | 'securite' | 'vie_immeuble' | 'autre'
type PrioriteAvis = 'normal' | 'important' | 'urgent'
type EtatAvis = 'actif' | 'archive'

interface Avis {
  id: string
  titre: string
  contenu: string
  categorie: CategorieAvis
  priorite: PrioriteAvis
  immeubleCible: string          // 'tous' ou nom de l'immeuble
  auteur: string
  datePublication: string
  dateExpiration?: string
  pieceJointeNom?: string
  epingle: boolean
  etat: EtatAvis
  vues: number
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIES: Record<CategorieAvis, { icon: string; label: string; couleur: string }> = {
  maintenance:   { icon: '🔧', label: 'Maintenance',       couleur: '#D4830A' },
  assemblee:     { icon: '🏛️', label: 'Assemblee',          couleur: '#6C5CE7' },
  finances:      { icon: '💶', label: 'Finances',           couleur: '#1A7A6E' },
  securite:      { icon: '🛡️', label: 'Securite',           couleur: '#C0392B' },
  vie_immeuble:  { icon: '🏠', label: 'Vie de l\'immeuble', couleur: '#C9A84C' },
  autre:         { icon: '📄', label: 'Autre',              couleur: '#4A5E78' },
}

const PRIORITES: Record<PrioriteAvis, { label: string; bg: string; color: string; borderLeft: string }> = {
  normal:    { label: 'Normal',    bg: 'rgba(13,27,46,0.06)', color: '#0D1B2E', borderLeft: 'transparent' },
  important: { label: 'Important', bg: '#FEF5E4',             color: '#D4830A', borderLeft: '#C9A84C' },
  urgent:    { label: 'Urgent',    bg: '#FDECEA',             color: '#C0392B', borderLeft: '#C0392B' },
}

const IMMEUBLES_DEMO = [
  'Residence Les Jardins — 12 rue de la Paix',
  'Residence Bellevue — 45 avenue Victor Hugo',
  'Residence Le Parc — 8 boulevard Haussmann',
]

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateCourt = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

const genId = () => `avis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ─── Donnees de demonstration ────────────────────────────────────────────────

const DEMO_AVIS: Avis[] = [
  {
    id: 'demo_1',
    titre: 'Coupure d\'eau — Travaux urgents sur la canalisation',
    contenu: 'Nous vous informons qu\'une coupure d\'eau est prevue le 15 mars de 9h a 14h pour une reparation urgente sur la canalisation principale de l\'immeuble. Nous vous conseillons de prevoir des reserves d\'eau pour cette periode. Nous nous excusons pour la gene occasionnee.',
    categorie: 'maintenance',
    priorite: 'urgent',
    immeubleCible: 'Residence Les Jardins — 12 rue de la Paix',
    auteur: 'Syndic',
    datePublication: '2026-03-11T10:00:00',
    dateExpiration: '2026-03-16',
    epingle: true,
    etat: 'actif',
    vues: 47,
  },
  {
    id: 'demo_2',
    titre: 'Panne ascenseur — Reparation en cours',
    contenu: 'L\'ascenseur de la Residence Bellevue est en panne depuis ce matin. La societe de maintenance a ete contactee et l\'intervention est prevue sous 48h ouvrees. Merci d\'utiliser les escaliers avec prudence. Les personnes a mobilite reduite peuvent contacter la loge pour assistance.',
    categorie: 'maintenance',
    priorite: 'urgent',
    immeubleCible: 'Residence Bellevue — 45 avenue Victor Hugo',
    auteur: 'Gestionnaire technique',
    datePublication: '2026-03-10T16:30:00',
    epingle: false,
    etat: 'actif',
    vues: 62,
  },
  {
    id: 'demo_3',
    titre: 'Convocation — Assemblee Generale Ordinaire 2026',
    contenu: 'Nous convoquons l\'ensemble des coproprietaires a l\'Assemblee Generale Ordinaire qui se tiendra le 28 mars 2026 a 19h00 dans la salle de reunion de la Residence Les Jardins. Ordre du jour : approbation des comptes 2025, budget previsionnel 2026, travaux de ravalement et questions diverses.',
    categorie: 'assemblee',
    priorite: 'important',
    immeubleCible: 'Residence Les Jardins — 12 rue de la Paix',
    auteur: 'Syndic',
    datePublication: '2026-03-08T09:00:00',
    dateExpiration: '2026-03-28',
    epingle: true,
    etat: 'actif',
    vues: 38,
  },
  {
    id: 'demo_4',
    titre: 'Renouvellement de l\'assurance multirisque — Information',
    contenu: 'Nous vous informons que l\'assurance multirisque de la copropriete a ete renouvelee aupres de la MAIF, avec effet au 1er avril 2026. La prime annuelle s\'eleve a 2 850 EUR. Les details de la couverture sont disponibles au cabinet du syndic sur demande.',
    categorie: 'finances',
    priorite: 'important',
    immeubleCible: 'tous',
    auteur: 'Syndic',
    datePublication: '2026-03-07T14:00:00',
    epingle: false,
    etat: 'actif',
    vues: 25,
  },
  {
    id: 'demo_5',
    titre: 'Planning menage des parties communes',
    contenu: 'A compter du 1er avril, les horaires de nettoyage des parties communes seront modifies : passage le matin de 8h a 11h au lieu de l\'apres-midi. Ce changement vise a reduire les nuisances pour les residents. Le prestataire reste la societe ProClean.',
    categorie: 'vie_immeuble',
    priorite: 'normal',
    immeubleCible: 'tous',
    auteur: 'Gestionnaire technique',
    datePublication: '2026-03-06T11:00:00',
    epingle: false,
    etat: 'actif',
    vues: 19,
  },
  {
    id: 'demo_6',
    titre: 'Travaux de ravalement de facade — Phase 1',
    contenu: 'Les travaux de ravalement de la facade cote rue debuteront le 20 mars pour une duree estimee de 6 semaines. Un echafaudage sera installe des le 18 mars. Merci de bien vouloir fermer vos volets et fenetres lors des operations de sablage. Un planning detaille sera affiche en hall.',
    categorie: 'maintenance',
    priorite: 'normal',
    immeubleCible: 'Residence Le Parc — 8 boulevard Haussmann',
    auteur: 'Gestionnaire technique',
    datePublication: '2026-03-05T08:30:00',
    epingle: false,
    etat: 'actif',
    vues: 14,
  },
  {
    id: 'demo_7',
    titre: 'Horaires du gardien — Mise a jour',
    contenu: 'Suite a la demande de plusieurs coproprietaires, les horaires du gardien sont modifies comme suit : lundi au vendredi de 8h00 a 12h00 et de 14h00 a 18h00, samedi de 9h00 a 12h00. La loge reste fermee le dimanche et les jours feries. Pour les urgences, contactez le numero d\'astreinte.',
    categorie: 'vie_immeuble',
    priorite: 'normal',
    immeubleCible: 'tous',
    auteur: 'Syndic',
    datePublication: '2026-03-04T10:00:00',
    epingle: false,
    etat: 'actif',
    vues: 31,
  },
  {
    id: 'demo_8',
    titre: 'Tri selectif — Nouvelles consignes de collecte',
    contenu: 'A partir du 1er avril 2026, de nouvelles consignes de tri selectif entrent en vigueur dans notre commune. Les emballages plastiques (pots, barquettes, films) sont desormais a deposer dans le bac jaune. Des affiches recapitulatives seront placees dans les locaux poubelles. Merci de respecter ces consignes.',
    categorie: 'securite',
    priorite: 'normal',
    immeubleCible: 'tous',
    auteur: 'Syndic',
    datePublication: '2026-03-03T15:00:00',
    epingle: false,
    etat: 'actif',
    vues: 22,
  },
]

// ─── Composant ───────────────────────────────────────────────────────────────

export default function PanneauAffichageSection({ user, userRole }: Props) {
  // ── State
  const [avis, setAvis] = useState<Avis[]>([])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieAvis | 'tous'>('tous')
  const [filtrePriorite, setFiltrePriorite] = useState<PrioriteAvis | 'tous'>('tous')
  const [filtreImmeuble, setFiltreImmeuble] = useState<string>('tous')
  const [filtreEtat, setFiltreEtat] = useState<EtatAvis | 'tous'>('actif')

  // ── Form state
  const [formTitre, setFormTitre] = useState('')
  const [formContenu, setFormContenu] = useState('')
  const [formCategorie, setFormCategorie] = useState<CategorieAvis>('maintenance')
  const [formPriorite, setFormPriorite] = useState<PrioriteAvis>('normal')
  const [formImmeuble, setFormImmeuble] = useState<string>('tous')
  const [formPieceJointe, setFormPieceJointe] = useState<string>('')
  const [formExpiration, setFormExpiration] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── localStorage key
  const storageKey = `fixit_panneau_fr_${user?.id || 'local'}`

  // ── Load / Save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        setAvis(JSON.parse(raw))
      } else {
        setAvis(DEMO_AVIS)
        localStorage.setItem(storageKey, JSON.stringify(DEMO_AVIS))
      }
    } catch {
      setAvis(DEMO_AVIS)
    }
  }, [storageKey])

  const persist = (next: Avis[]) => {
    setAvis(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  // ── Donnees derivees
  const avisActifs = useMemo(() => avis.filter(a => a.etat === 'actif'), [avis])
  const avisCeMois = useMemo(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    return avisActifs.filter(a => {
      const d = new Date(a.datePublication)
      return d.getMonth() === m && d.getFullYear() === y
    }).length
  }, [avisActifs])
  const plusConsulte = useMemo(() => {
    if (avisActifs.length === 0) return null
    return [...avisActifs].sort((a, b) => b.vues - a.vues)[0]
  }, [avisActifs])
  const distributionCategories = useMemo(() => {
    const dist: Record<string, number> = {}
    for (const a of avisActifs) {
      dist[a.categorie] = (dist[a.categorie] || 0) + 1
    }
    return dist
  }, [avisActifs])

  // ── Filtrage + tri
  const avisFiltres = useMemo(() => {
    let list = [...avis]

    // Filtre etat
    if (filtreEtat !== 'tous') list = list.filter(a => a.etat === filtreEtat)

    // Filtre categorie
    if (filtreCategorie !== 'tous') list = list.filter(a => a.categorie === filtreCategorie)

    // Filtre priorite
    if (filtrePriorite !== 'tous') list = list.filter(a => a.priorite === filtrePriorite)

    // Filtre immeuble
    if (filtreImmeuble !== 'tous') list = list.filter(a => a.immeubleCible === filtreImmeuble || a.immeubleCible === 'tous')

    // Recherche
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(a =>
        a.titre.toLowerCase().includes(q) ||
        a.contenu.toLowerCase().includes(q) ||
        a.auteur.toLowerCase().includes(q)
      )
    }

    // Tri : epingles en premier, puis par date decroissante
    list.sort((a, b) => {
      if (a.epingle !== b.epingle) return a.epingle ? -1 : 1
      return new Date(b.datePublication).getTime() - new Date(a.datePublication).getTime()
    })

    return list
  }, [avis, filtreEtat, filtreCategorie, filtrePriorite, filtreImmeuble, search])

  // ── Actions
  const handleCreerAvis = () => {
    if (!formTitre.trim() || !formContenu.trim()) return
    const nouvel: Avis = {
      id: genId(),
      titre: formTitre.trim(),
      contenu: formContenu.trim(),
      categorie: formCategorie,
      priorite: formPriorite,
      immeubleCible: formImmeuble,
      auteur: user?.user_metadata?.full_name || user?.email || 'Syndic',
      datePublication: new Date().toISOString(),
      dateExpiration: formExpiration || undefined,
      pieceJointeNom: formPieceJointe || undefined,
      epingle: false,
      etat: 'actif',
      vues: 0,
    }
    persist([nouvel, ...avis])
    resetForm()
    setShowModal(false)
  }

  const toggleEpingler = (id: string) => {
    persist(avis.map(a => a.id === id ? { ...a, epingle: !a.epingle } : a))
  }

  const archiver = (id: string) => {
    persist(avis.map(a => a.id === id ? { ...a, etat: 'archive' as EtatAvis } : a))
  }

  const restaurer = (id: string) => {
    persist(avis.map(a => a.id === id ? { ...a, etat: 'actif' as EtatAvis } : a))
  }

  const resetForm = () => {
    setFormTitre('')
    setFormContenu('')
    setFormCategorie('maintenance')
    setFormPriorite('normal')
    setFormImmeuble('tous')
    setFormPieceJointe('')
    setFormExpiration('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setFormPieceJointe(file.name)
  }

  // ── Simuler vues au clic
  const incrementerVues = (id: string) => {
    persist(avis.map(a => a.id === id ? { ...a, vues: a.vues + 1 } : a))
  }

  // ── Carte depliee
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      incrementerVues(id)
    }
  }

  // ── Rendu
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── En-tete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>
            Panneau d'affichage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '4px 0 0' }}>
            Communiquez avec les coproprietaires de maniere claire et organisee
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          style={{
            background: 'var(--sd-gold,#C9A84C)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>+</span> Nouvel avis
        </button>
      </div>

      {/* ── Disposition : Feed + Barre laterale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* ── Colonne principale */}
        <div>
          {/* ── Recherche + Filtres */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {/* Barre de recherche */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Rechercher des avis..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  fontSize: 14,
                  color: 'var(--sd-navy,#0D1B2E)',
                  background: 'var(--sd-cream,#F7F4EE)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* Etat */}
              <select
                value={filtreEtat}
                onChange={e => setFiltreEtat(e.target.value as EtatAvis | 'tous')}
                style={filterSelectStyle}
              >
                <option value="tous">Tous les etats</option>
                <option value="actif">Actifs</option>
                <option value="archive">Archives</option>
              </select>

              {/* Categorie */}
              <select
                value={filtreCategorie}
                onChange={e => setFiltreCategorie(e.target.value as CategorieAvis | 'tous')}
                style={filterSelectStyle}
              >
                <option value="tous">Toutes les categories</option>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>

              {/* Priorite */}
              <select
                value={filtrePriorite}
                onChange={e => setFiltrePriorite(e.target.value as PrioriteAvis | 'tous')}
                style={filterSelectStyle}
              >
                <option value="tous">Toutes les priorites</option>
                {Object.entries(PRIORITES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Immeuble */}
              <select
                value={filtreImmeuble}
                onChange={e => setFiltreImmeuble(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="tous">Tous les immeubles</option>
                {IMMEUBLES_DEMO.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Feed */}
          {avisFiltres.length === 0 ? (
            <div style={{
              background: '#fff',
              border: '1px solid var(--sd-border,#E4DDD0)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, color: 'var(--sd-ink-2,#4A5E78)', margin: 0 }}>
                Aucun avis trouve
              </p>
              <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '6px 0 0' }}>
                Ajustez les filtres ou creez un nouvel avis
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {avisFiltres.map(item => {
                const cat = CATEGORIES[item.categorie]
                const prio = PRIORITES[item.priorite]
                const isExpanded = expandedId === item.id
                const isExpired = item.dateExpiration && new Date(item.dateExpiration) < new Date()

                return (
                  <div
                    key={item.id}
                    style={{
                      background: item.etat === 'archive' ? '#FAFAFA' : '#fff',
                      border: '1px solid var(--sd-border,#E4DDD0)',
                      borderRadius: 12,
                      borderLeft: `4px solid ${prio.borderLeft}`,
                      padding: 0,
                      opacity: item.etat === 'archive' ? 0.7 : 1,
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    {/* En-tete de carte */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      style={{
                        padding: '16px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 14,
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Icone categorie */}
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: `${cat.couleur}14`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                        marginTop: 2,
                      }}>
                        {cat.icon}
                      </div>

                      {/* Contenu */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          {item.epingle && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: 'var(--sd-gold,#C9A84C)',
                              color: '#fff',
                              letterSpacing: '0.3px',
                            }}>
                              📌 Epingle
                            </span>
                          )}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: `${cat.couleur}18`,
                            color: cat.couleur,
                            letterSpacing: '0.3px',
                          }}>
                            {cat.label}
                          </span>
                          {item.priorite !== 'normal' && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: prio.bg,
                              color: prio.color,
                              letterSpacing: '0.3px',
                            }}>
                              {prio.label}
                            </span>
                          )}
                          {isExpired && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 5,
                              background: '#FDECEA',
                              color: '#C0392B',
                              letterSpacing: '0.3px',
                            }}>
                              Expire
                            </span>
                          )}
                        </div>

                        {/* Titre */}
                        <h3 style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: 'var(--sd-navy,#0D1B2E)',
                          margin: 0,
                          lineHeight: 1.35,
                        }}>
                          {item.titre}
                        </h3>

                        {/* Apercu */}
                        {!isExpanded && (
                          <p style={{
                            fontSize: 13,
                            color: 'var(--sd-ink-2,#4A5E78)',
                            margin: '6px 0 0',
                            lineHeight: 1.45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {item.contenu}
                          </p>
                        )}

                        {/* Meta */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 14,
                          marginTop: 8,
                          fontSize: 12,
                          color: 'var(--sd-ink-3,#8A9BB0)',
                        }}>
                          <span>{item.auteur}</span>
                          <span>{formatDate(item.datePublication)}</span>
                          {item.immeubleCible !== 'tous' ? (
                            <span>🏢 {item.immeubleCible.split('—')[0]?.trim()}</span>
                          ) : (
                            <span>🏢 Tous les immeubles</span>
                          )}
                          <span>👁️ {item.vues}</span>
                        </div>
                      </div>

                      {/* Indicateur deplier */}
                      <span style={{
                        fontSize: 16,
                        color: 'var(--sd-ink-3,#8A9BB0)',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                        flexShrink: 0,
                        marginTop: 4,
                      }}>
                        ▾
                      </span>
                    </div>

                    {/* Contenu deplie */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 20px 16px 76px',
                        borderTop: '1px solid var(--sd-border,#E4DDD0)',
                      }}>
                        <p style={{
                          fontSize: 14,
                          color: 'var(--sd-navy,#0D1B2E)',
                          lineHeight: 1.6,
                          margin: '14px 0 0',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {item.contenu}
                        </p>

                        {/* Piece jointe */}
                        {item.pieceJointeNom && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 10,
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'var(--sd-cream,#F7F4EE)',
                            fontSize: 12,
                            color: 'var(--sd-ink-2,#4A5E78)',
                          }}>
                            📎 {item.pieceJointeNom}
                          </div>
                        )}

                        {/* Expiration */}
                        {item.dateExpiration && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                            Expire le : {formatDateCourt(item.dateExpiration)}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleEpingler(item.id) }}
                            style={actionBtnStyle}
                          >
                            {item.epingle ? '📌 Desepingler' : '📌 Epingler'}
                          </button>
                          {item.etat === 'actif' ? (
                            <button
                              onClick={e => { e.stopPropagation(); archiver(item.id) }}
                              style={actionBtnStyle}
                            >
                              📦 Archiver
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); restaurer(item.id) }}
                              style={actionBtnStyle}
                            >
                              ♻️ Restaurer
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Barre laterale statistiques */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Resume */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Resume
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stat : Total avis actifs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: 'rgba(201,168,76,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}>
                  📋
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                    {avisActifs.length}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Avis actifs</div>
                </div>
              </div>

              {/* Stat : Ce mois */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: 'rgba(26,122,110,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}>
                  📅
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                    {avisCeMois}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Avis ce mois</div>
                </div>
              </div>

              {/* Stat : Plus consulte */}
              {plusConsulte && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: 'rgba(108,92,231,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    👁️
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>
                      {plusConsulte.vues}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--sd-ink-3,#8A9BB0)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {plusConsulte.titre.length > 30 ? plusConsulte.titre.slice(0, 30) + '...' : plusConsulte.titre}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Distribution par categorie */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Distribution par categorie
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => {
                const count = distributionCategories[key] || 0
                const maxCount = Math.max(...Object.values(distributionCategories), 1)
                const pct = (count / maxCount) * 100

                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                        {cat.icon} {cat.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>
                        {count}
                      </span>
                    </div>
                    <div style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--sd-cream,#F7F4EE)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 3,
                        background: cat.couleur,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions rapides */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--sd-border,#E4DDD0)',
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
              Actions rapides
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { resetForm(); setFormPriorite('urgent'); setFormCategorie('maintenance'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                🚨 Avis urgent
              </button>
              <button
                onClick={() => { resetForm(); setFormCategorie('assemblee'); setFormPriorite('important'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                🏛️ Convocation AG
              </button>
              <button
                onClick={() => { resetForm(); setFormCategorie('finances'); setShowModal(true) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: 'var(--sd-cream,#F7F4EE)',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--sd-navy,#0D1B2E)',
                  fontWeight: 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                💶 Avis financier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal : Nouvel avis */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,27,46,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(13,27,46,0.2)',
            }}
          >
            {/* En-tete modal */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--sd-border,#E4DDD0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 20,
                color: 'var(--sd-navy,#0D1B2E)',
                margin: 0,
              }}>
                Nouvel avis
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--sd-ink-3,#8A9BB0)',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Corps du modal */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Titre */}
              <div>
                <label style={labelStyle}>Titre *</label>
                <input
                  type="text"
                  placeholder="Ex : Coupure d'eau — Travaux urgents"
                  value={formTitre}
                  onChange={e => setFormTitre(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Contenu */}
              <div>
                <label style={labelStyle}>Contenu *</label>
                <textarea
                  placeholder="Decrivez l'avis avec tous les details pertinents..."
                  value={formContenu}
                  onChange={e => setFormContenu(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
                />
              </div>

              {/* Ligne : Categorie + Priorite */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categorie</label>
                  <select
                    value={formCategorie}
                    onChange={e => setFormCategorie(e.target.value as CategorieAvis)}
                    style={inputStyle}
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priorite</label>
                  <select
                    value={formPriorite}
                    onChange={e => setFormPriorite(e.target.value as PrioriteAvis)}
                    style={inputStyle}
                  >
                    {Object.entries(PRIORITES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Immeuble cible */}
              <div>
                <label style={labelStyle}>Immeuble cible</label>
                <select
                  value={formImmeuble}
                  onChange={e => setFormImmeuble(e.target.value)}
                  style={inputStyle}
                >
                  <option value="tous">Tous les immeubles</option>
                  {IMMEUBLES_DEMO.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              {/* Date d'expiration */}
              <div>
                <label style={labelStyle}>Date d'expiration (optionnel)</label>
                <input
                  type="date"
                  value={formExpiration}
                  onChange={e => setFormExpiration(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Piece jointe */}
              <div>
                <label style={labelStyle}>Piece jointe (optionnel)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid var(--sd-border,#E4DDD0)',
                      borderRadius: 8,
                      background: 'var(--sd-cream,#F7F4EE)',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--sd-ink-2,#4A5E78)',
                    }}
                  >
                    📎 Choisir un fichier
                  </button>
                  {formPieceJointe && (
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                      {formPieceJointe}
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Pied du modal */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--sd-border,#E4DDD0)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid var(--sd-border,#E4DDD0)',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--sd-ink-2,#4A5E78)',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleCreerAvis}
                disabled={!formTitre.trim() || !formContenu.trim()}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 8,
                  background: !formTitre.trim() || !formContenu.trim()
                    ? 'rgba(201,168,76,0.4)'
                    : 'var(--sd-gold,#C9A84C)',
                  color: '#fff',
                  cursor: !formTitre.trim() || !formContenu.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Publier l'avis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Responsive : empiler la sidebar en dessous sur petits ecrans */}
      <style>{`
        @media (max-width: 860px) {
          div[style*="gridTemplateColumns: '1fr 320px'"],
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Styles partages ─────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--sd-ink-2,#4A5E78)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--sd-navy,#0D1B2E)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const filterSelectStyle: React.CSSProperties = {
  padding: '7px 12px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--sd-navy,#0D1B2E)',
  background: '#fff',
  outline: 'none',
  cursor: 'pointer',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--sd-border,#E4DDD0)',
  borderRadius: 8,
  background: 'var(--sd-cream,#F7F4EE)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--sd-ink-2,#4A5E78)',
}
