'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Priorite = 'urgence' | 'haute' | 'moyenne' | 'basse'
type Etat = 'ouvert' | 'en_analyse' | 'artisan_contacte' | 'en_reparation' | 'resolu' | 'cloture'
type Categorie = 'degat_eaux' | 'ascenseur' | 'electricite' | 'plomberie' | 'parties_communes' | 'nuisances' | 'nettoyage' | 'autre'
type Zone = 'sous_sol' | 'hall' | 'escaliers' | 'toiture' | 'facade' | 'espaces_verts'

interface TimelineEvent {
  id: string
  date: string
  auteur: string
  type: 'statut' | 'commentaire' | 'photo'
  contenu: string
}

interface Signalement {
  id: string
  titre: string
  description: string
  categorie: Categorie
  priorite: Priorite
  signalePar: string
  lot: string
  immeuble: string
  date: string
  etat: Etat
  artisanAssigne: string
  localisationImmeuble: string
  photos: string[]
  timeline: TimelineEvent[]
  zone: Zone
}

interface QRCode {
  id: string
  zone: Zone
  equipement: string
  dateCreation: string
  code: string
  scans: number
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIES: Record<Categorie, { emoji: string; label: string }> = {
  degat_eaux:       { emoji: '\uD83D\uDCA7', label: 'D\u00e9g\u00e2t des eaux' },
  ascenseur:        { emoji: '\uD83D\uDED7', label: 'Ascenseur' },
  electricite:      { emoji: '\u26A1', label: '\u00c9lectricit\u00e9' },
  plomberie:        { emoji: '\uD83D\uDD27', label: 'Plomberie' },
  parties_communes: { emoji: '\uD83C\uDFE2', label: 'Parties communes' },
  nuisances:        { emoji: '\uD83D\uDD0A', label: 'Nuisances' },
  nettoyage:        { emoji: '\uD83E\uDDF9', label: 'Nettoyage' },
  autre:            { emoji: '\uD83D\uDCCB', label: 'Autre' },
}

const PRIORITES: Record<Priorite, { label: string; color: string; bg: string; dot: string }> = {
  urgence: { label: 'Urgence', color: '#C0392B', bg: '#FDECEA', dot: '#C0392B' },
  haute:   { label: 'Haute',   color: '#D4830A', bg: '#FEF5E4', dot: '#D4830A' },
  moyenne: { label: 'Moyenne', color: '#B7950B', bg: '#FEF9E7', dot: '#B7950B' },
  basse:   { label: 'Basse',   color: '#1A7A6E', bg: '#E6F4F2', dot: '#1A7A6E' },
}

const ETATS: Record<Etat, { label: string; icon: string; color: string; bg: string }> = {
  ouvert:            { label: 'Ouvert',            icon: '\uD83D\uDCE3', color: '#C0392B', bg: '#FDECEA' },
  en_analyse:        { label: 'En analyse',        icon: '\uD83D\uDD0D', color: '#6C5CE7', bg: '#EDE8FF' },
  artisan_contacte:  { label: 'Artisan contact\u00e9', icon: '\uD83D\uDCDE', color: '#D4830A', bg: '#FEF5E4' },
  en_reparation:     { label: 'En r\u00e9paration',    icon: '\uD83D\uDD28', color: '#2980B9', bg: '#EBF5FB' },
  resolu:            { label: 'R\u00e9solu',            icon: '\u2705',       color: '#1A7A6E', bg: '#E6F4F2' },
  cloture:           { label: 'Cl\u00f4tur\u00e9',     icon: '\uD83D\uDD12', color: '#8A9BB0', bg: '#F0EDEA' },
}

const PIPELINE_ETATS: Etat[] = ['ouvert', 'en_analyse', 'artisan_contacte', 'en_reparation', 'resolu', 'cloture']

const ZONES: Record<Zone, { emoji: string; label: string }> = {
  sous_sol:       { emoji: '\uD83C\uDD7F\uFE0F', label: 'Sous-sol / Parking' },
  hall:           { emoji: '\uD83D\uDEAA', label: 'Hall d\u2019entr\u00e9e' },
  escaliers:      { emoji: '\uD83E\uDE9C', label: 'Escaliers' },
  toiture:        { emoji: '\uD83C\uDFE0', label: 'Toiture' },
  facade:         { emoji: '\uD83E\uDDF1', label: 'Fa\u00e7ade' },
  espaces_verts:  { emoji: '\uD83C\uDF33', label: 'Espaces verts' },
}

const SLA_CIBLES_JOURS: Record<Priorite, number> = {
  urgence: 1,
  haute: 3,
  moyenne: 7,
  basse: 14,
}

// ─── Formatage ──────────────────────────────────────────────────────────────

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatDateTime = (s: string) => {
  try {
    const d = new Date(s)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return s }
}

const joursDepuis = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  return Math.floor(diff / 86400000)
}

// ─── Donn\u00e9es d\u00e9mo ──────────────────────────────────────────────────────────

const generateDemoData = (): Signalement[] => {
  const now = new Date()
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString()

  return [
    {
      id: 'SIG-001', titre: 'Infiltration plafond parking B2',
      description: 'Tache d\u2019humidit\u00e9 grandissante au plafond du parking niveau B2, pr\u00e8s du pilier 4. Gouttes d\u2019eau lors de fortes pluies.',
      categorie: 'degat_eaux', priorite: 'urgence',
      signalePar: 'Marie Dupont', lot: '3\u00e8me gauche', immeuble: 'R\u00e9sidence Les Tilleuls',
      date: d(2), etat: 'en_reparation', artisanAssigne: 'Jean Morel \u2014 \u00c9tanch\u00e9it\u00e9',
      localisationImmeuble: 'Parking B2, pr\u00e8s du pilier 4', photos: [],
      zone: 'sous_sol',
      timeline: [
        { id: '1', date: d(2), auteur: 'Marie Dupont', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9 \u2014 Infiltration d\u00e9tect\u00e9e' },
        { id: '2', date: d(1.5), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 En analyse' },
        { id: '3', date: d(1), auteur: 'Gestionnaire', type: 'statut', contenu: 'Artisan contact\u00e9 \u2014 Jean Morel' },
        { id: '4', date: d(0.5), auteur: 'Jean Morel', type: 'commentaire', contenu: 'Visite pr\u00e9vue demain \u00e0 9h. Probl\u00e8me probable d\u2019\u00e9tanch\u00e9it\u00e9 en toiture.' },
      ],
    },
    {
      id: 'SIG-002', titre: 'Ascenseur bloqu\u00e9 au 4\u00e8me \u00e9tage',
      description: 'L\u2019ascenseur s\u2019arr\u00eate fr\u00e9quemment au 4\u00e8me \u00e9tage et les portes ne s\u2019ouvrent pas. N\u00e9cessit\u00e9 de red\u00e9marrer via le tableau \u00e9lectrique.',
      categorie: 'ascenseur', priorite: 'haute',
      signalePar: 'Pierre Martin', lot: '4\u00e8me droite', immeuble: 'R\u00e9sidence Les Tilleuls',
      date: d(5), etat: 'artisan_contacte', artisanAssigne: 'Ascenseurs de France',
      localisationImmeuble: 'Ascenseur principal, 4\u00e8me \u00e9tage', photos: [],
      zone: 'hall',
      timeline: [
        { id: '1', date: d(5), auteur: 'Pierre Martin', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9' },
        { id: '2', date: d(4), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 En analyse' },
        { id: '3', date: d(3), auteur: 'Gestionnaire', type: 'statut', contenu: 'Artisan contact\u00e9 \u2014 Ascenseurs de France' },
      ],
    },
    {
      id: 'SIG-003', titre: 'Court-circuit \u00e9clairage du hall',
      description: 'Les lumi\u00e8res du hall d\u2019entr\u00e9e font des courts-circuits. Le disjoncteur saute plusieurs fois par jour.',
      categorie: 'electricite', priorite: 'haute',
      signalePar: 'Sophie Laurent', lot: '1er gauche', immeuble: 'R\u00e9sidence Bellevue',
      date: d(3), etat: 'en_analyse', artisanAssigne: '',
      localisationImmeuble: 'Hall d\u2019entr\u00e9e, tableau \u00e9lectrique g\u00e9n\u00e9ral', photos: [],
      zone: 'hall',
      timeline: [
        { id: '1', date: d(3), auteur: 'Sophie Laurent', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9' },
        { id: '2', date: d(2), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 En analyse. V\u00e9rification de la disponibilit\u00e9 d\u2019un \u00e9lectricien.' },
      ],
    },
    {
      id: 'SIG-004', titre: 'Fuite d\u2019eau canalisation du RDC',
      description: 'Fuite visible sur la canalisation principale du rez-de-chauss\u00e9e, pr\u00e8s de l\u2019entr\u00e9e du parking. Tache au sol.',
      categorie: 'plomberie', priorite: 'urgence',
      signalePar: 'Thomas Bernard', lot: 'RDC droite', immeuble: 'R\u00e9sidence Les Tilleuls',
      date: d(1), etat: 'ouvert', artisanAssigne: '',
      localisationImmeuble: 'Rez-de-chauss\u00e9e, entr\u00e9e du parking', photos: [],
      zone: 'sous_sol',
      timeline: [
        { id: '1', date: d(1), auteur: 'Thomas Bernard', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9 \u2014 Fuite d\u2019eau d\u00e9tect\u00e9e' },
      ],
    },
    {
      id: 'SIG-005', titre: 'Tags sur la fa\u00e7ade nord',
      description: 'Tags importants peints sur la fa\u00e7ade nord de l\u2019immeuble durant la nuit. Peinture spray noire.',
      categorie: 'parties_communes', priorite: 'moyenne',
      signalePar: 'Claire Moreau', lot: '2\u00e8me droite', immeuble: 'R\u00e9sidence Bellevue',
      date: d(10), etat: 'resolu', artisanAssigne: 'Nettoyage Express SARL',
      localisationImmeuble: 'Fa\u00e7ade nord, niveau de la rue', photos: [],
      zone: 'facade',
      timeline: [
        { id: '1', date: d(10), auteur: 'Claire Moreau', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9' },
        { id: '2', date: d(9), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 En analyse' },
        { id: '3', date: d(7), auteur: 'Gestionnaire', type: 'statut', contenu: 'Artisan contact\u00e9 \u2014 Nettoyage Express SARL' },
        { id: '4', date: d(4), auteur: 'Nettoyage Express SARL', type: 'statut', contenu: '\u00c9tat \u2192 En r\u00e9paration. Nettoyage de fa\u00e7ade programm\u00e9.' },
        { id: '5', date: d(2), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 R\u00e9solu. Fa\u00e7ade nettoy\u00e9e avec succ\u00e8s.' },
      ],
    },
    {
      id: 'SIG-006', titre: 'Nuisances sonores \u2014 travaux au 5\u00e8me',
      description: 'Travaux bruyants dans l\u2019appartement du 5\u00e8me gauche en dehors des horaires autoris\u00e9s (apr\u00e8s 20h). Plusieurs plaintes.',
      categorie: 'nuisances', priorite: 'moyenne',
      signalePar: 'Julien Petit', lot: '5\u00e8me droite', immeuble: 'R\u00e9sidence Les Tilleuls',
      date: d(8), etat: 'cloture', artisanAssigne: '',
      localisationImmeuble: '5\u00e8me gauche', photos: [],
      zone: 'escaliers',
      timeline: [
        { id: '1', date: d(8), auteur: 'Julien Petit', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9' },
        { id: '2', date: d(7), auteur: 'Gestionnaire', type: 'commentaire', contenu: 'Courrier d\u2019avertissement envoy\u00e9 au copropri\u00e9taire du 5\u00e8me gauche' },
        { id: '3', date: d(4), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 R\u00e9solu. Copropri\u00e9taire s\u2019est engag\u00e9 \u00e0 respecter les horaires.' },
        { id: '4', date: d(2), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 Cl\u00f4tur\u00e9.' },
      ],
    },
    {
      id: 'SIG-007', titre: 'Ampoules grill\u00e9es escaliers (2\u00e8me au 4\u00e8me)',
      description: 'Trois ampoules grill\u00e9es dans les escaliers entre le 2\u00e8me et le 4\u00e8me \u00e9tage. Escaliers sombres la nuit.',
      categorie: 'nettoyage', priorite: 'basse',
      signalePar: 'Nathalie Roux', lot: '3\u00e8me droite', immeuble: 'R\u00e9sidence Bellevue',
      date: d(6), etat: 'resolu', artisanAssigne: '',
      localisationImmeuble: 'Escaliers, \u00e9tages 2 \u00e0 4', photos: [],
      zone: 'escaliers',
      timeline: [
        { id: '1', date: d(6), auteur: 'Nathalie Roux', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9' },
        { id: '2', date: d(4), auteur: 'Gestionnaire', type: 'statut', contenu: 'Ampoules remplac\u00e9es par le gardien.' },
        { id: '3', date: d(4), auteur: 'Gestionnaire', type: 'statut', contenu: '\u00c9tat \u2192 R\u00e9solu.' },
      ],
    },
    {
      id: 'SIG-008', titre: 'Porte du parking ne ferme plus automatiquement',
      description: 'Le moteur de la porte automatique du parking ne fonctionne plus. Porte reste ouverte en permanence, risque de s\u00e9curit\u00e9.',
      categorie: 'parties_communes', priorite: 'haute',
      signalePar: 'Marc Lefevre', lot: '1er droite', immeuble: 'R\u00e9sidence Les Tilleuls',
      date: d(0), etat: 'ouvert', artisanAssigne: '',
      localisationImmeuble: 'Entr\u00e9e du parking', photos: [],
      zone: 'sous_sol',
      timeline: [
        { id: '1', date: d(0), auteur: 'Marc Lefevre', type: 'statut', contenu: 'Signalement cr\u00e9\u00e9 \u2014 Moteur de porte en panne' },
      ],
    },
  ]
}

const generateDemoQRCodes = (): QRCode[] => [
  { id: 'QR-001', zone: 'sous_sol',  equipement: 'Porte automatique parking', dateCreation: '2025-11-15', code: 'FIXIT-SSO-001', scans: 12 },
  { id: 'QR-002', zone: 'hall',      equipement: 'Tableau \u00e9lectrique g\u00e9n\u00e9ral', dateCreation: '2025-11-15', code: 'FIXIT-HAL-001', scans: 8 },
  { id: 'QR-003', zone: 'escaliers', equipement: '\u00c9clairage parties communes', dateCreation: '2025-12-01', code: 'FIXIT-ESC-001', scans: 5 },
  { id: 'QR-004', zone: 'toiture',   equipement: 'Syst\u00e8me d\u2019\u00e9tanch\u00e9it\u00e9', dateCreation: '2025-12-10', code: 'FIXIT-TOI-001', scans: 3 },
]

// ─── Composant principal ────────────────────────────────────────────────────

export default function SignalementsFRSection({ user, userRole }: Props) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_signalements_fr_${uid}`
  const STORAGE_KEY_QR = `fixit_signalements_fr_qr_${uid}`

  // ── State ──────────────────────────────────────────────────────────────────

  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [qrCodes, setQRCodes] = useState<QRCode[]>([])
  const [tab, setTab] = useState<'tableau_bord' | 'signalements' | 'zones' | 'qrcodes'>('tableau_bord')
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Signalement | null>(null)
  const [commentInput, setCommentInput] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)

  // Filtres
  const [filtreEtat, setFiltreEtat] = useState<Etat | ''>('')
  const [filtrePriorite, setFiltrePriorite] = useState<Priorite | ''>('')
  const [filtreCategorie, setFiltreCategorie] = useState<Categorie | ''>('')
  const [filtreImmeuble, setFiltreImmeuble] = useState('')

  // Formulaire signalement
  const [formTitre, setFormTitre] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategorie, setFormCategorie] = useState<Categorie>('degat_eaux')
  const [formPriorite, setFormPriorite] = useState<Priorite>('moyenne')
  const [formImmeuble, setFormImmeuble] = useState('')
  const [formLot, setFormLot] = useState('')
  const [formLocalisation, setFormLocalisation] = useState('')
  const [formZone, setFormZone] = useState<Zone>('hall')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulaire QR
  const [qrZone, setQrZone] = useState<Zone>('sous_sol')
  const [qrEquipement, setQrEquipement] = useState('')

  // ── Persistance ───────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSignalements(JSON.parse(stored))
      } else {
        const demo = generateDemoData()
        setSignalements(demo)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      setSignalements(generateDemoData())
    }
    try {
      const storedQR = localStorage.getItem(STORAGE_KEY_QR)
      if (storedQR) {
        setQRCodes(JSON.parse(storedQR))
      } else {
        const demoQR = generateDemoQRCodes()
        setQRCodes(demoQR)
        localStorage.setItem(STORAGE_KEY_QR, JSON.stringify(demoQR))
      }
    } catch {
      setQRCodes(generateDemoQRCodes())
    }
  }, [])

  const save = useCallback((updated: Signalement[]) => {
    setSignalements(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [STORAGE_KEY])

  const saveQR = useCallback((updated: QRCode[]) => {
    setQRCodes(updated)
    localStorage.setItem(STORAGE_KEY_QR, JSON.stringify(updated))
  }, [STORAGE_KEY_QR])

  // ── Statistiques ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = signalements.length
    const ouverts = signalements.filter(s => s.etat === 'ouvert').length
    const enCours = signalements.filter(s => ['en_analyse', 'artisan_contacte', 'en_reparation'].includes(s.etat)).length
    const resolus = signalements.filter(s => s.etat === 'resolu' || s.etat === 'cloture').length

    // Temps moyen de r\u00e9solution (en jours)
    const resolved = signalements.filter(s => s.etat === 'resolu' || s.etat === 'cloture')
    let tempoMoyenResolution = 0
    if (resolved.length > 0) {
      const totalJours = resolved.reduce((sum, s) => {
        const lastEvent = s.timeline[s.timeline.length - 1]
        if (lastEvent) {
          return sum + Math.max(1, Math.ceil((new Date(lastEvent.date).getTime() - new Date(s.date).getTime()) / 86400000))
        }
        return sum + 1
      }, 0)
      tempoMoyenResolution = Math.round(totalJours / resolved.length)
    }

    // Priorit\u00e9s
    const parPriorite: Record<Priorite, number> = {
      urgence: signalements.filter(s => s.priorite === 'urgence' && s.etat !== 'cloture').length,
      haute: signalements.filter(s => s.priorite === 'haute' && s.etat !== 'cloture').length,
      moyenne: signalements.filter(s => s.priorite === 'moyenne' && s.etat !== 'cloture').length,
      basse: signalements.filter(s => s.priorite === 'basse' && s.etat !== 'cloture').length,
    }

    // Conformit\u00e9 SLA
    let slaTotal = 0
    let slaMet = 0
    resolved.forEach(s => {
      const target = SLA_CIBLES_JOURS[s.priorite]
      const lastEvent = s.timeline[s.timeline.length - 1]
      if (lastEvent) {
        const resolvedIn = Math.ceil((new Date(lastEvent.date).getTime() - new Date(s.date).getTime()) / 86400000)
        slaTotal++
        if (resolvedIn <= target) slaMet++
      }
    })
    const slaPercent = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 100

    // Zones
    const parZone: Record<string, number> = {}
    signalements.forEach(s => {
      parZone[s.zone] = (parZone[s.zone] || 0) + 1
    })

    // Cat\u00e9gorie la plus fr\u00e9quente par zone
    const categorieParZone: Record<string, string> = {}
    const zoneCatCount: Record<string, Record<string, number>> = {}
    signalements.forEach(s => {
      if (!zoneCatCount[s.zone]) zoneCatCount[s.zone] = {}
      zoneCatCount[s.zone][s.categorie] = (zoneCatCount[s.zone][s.categorie] || 0) + 1
    })
    Object.entries(zoneCatCount).forEach(([zone, cats]) => {
      let maxCat = ''
      let maxCount = 0
      Object.entries(cats).forEach(([cat, count]) => {
        if (count > maxCount) { maxCat = cat; maxCount = count }
      })
      categorieParZone[zone] = maxCat
    })

    return { total, ouverts, enCours, resolus, tempoMoyenResolution, parPriorite, slaPercent, parZone, categorieParZone }
  }, [signalements])

  // ── Liste filtr\u00e9e ──────────────────────────────────────────────────────────

  const immeubles = useMemo(() => [...new Set(signalements.map(s => s.immeuble))].sort(), [signalements])

  const filtered = useMemo(() => {
    let list = [...signalements]
    if (filtreEtat) list = list.filter(s => s.etat === filtreEtat)
    if (filtrePriorite) list = list.filter(s => s.priorite === filtrePriorite)
    if (filtreCategorie) list = list.filter(s => s.categorie === filtreCategorie)
    if (filtreImmeuble) list = list.filter(s => s.immeuble === filtreImmeuble)
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [signalements, filtreEtat, filtrePriorite, filtreCategorie, filtreImmeuble])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreer = () => {
    if (!formTitre.trim()) return
    const now = new Date().toISOString()
    const newSig: Signalement = {
      id: `SIG-${String(signalements.length + 1).padStart(3, '0')}`,
      titre: formTitre.trim(),
      description: formDescription.trim(),
      categorie: formCategorie,
      priorite: formPriorite,
      signalePar: user?.user_metadata?.full_name || user?.email || 'Gestionnaire',
      lot: formLot.trim(),
      immeuble: formImmeuble.trim() || 'Non pr\u00e9cis\u00e9',
      date: now,
      etat: 'ouvert',
      artisanAssigne: '',
      localisationImmeuble: formLocalisation.trim(),
      photos: [],
      zone: formZone,
      timeline: [
        { id: '1', date: now, auteur: 'Syst\u00e8me', type: 'statut', contenu: `Signalement cr\u00e9\u00e9 \u2014 ${CATEGORIES[formCategorie].label}` },
      ],
    }
    save([newSig, ...signalements])
    resetForm()
    setShowModal(false)
  }

  const resetForm = () => {
    setFormTitre('')
    setFormDescription('')
    setFormCategorie('degat_eaux')
    setFormPriorite('moyenne')
    setFormImmeuble('')
    setFormLot('')
    setFormLocalisation('')
    setFormZone('hall')
  }

  const advanceEtat = (id: string, nouvelEtat: Etat) => {
    const now = new Date().toISOString()
    const label = ETATS[nouvelEtat].label
    const updated = signalements.map(s => s.id === id ? {
      ...s, etat: nouvelEtat,
      timeline: [...s.timeline, { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'statut' as const, contenu: `\u00c9tat \u2192 ${label}` }],
    } : s)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(s => s.id === id) || null)
  }

  const addComment = (id: string) => {
    if (!commentInput.trim()) return
    const now = new Date().toISOString()
    const updated = signalements.map(s => s.id === id ? {
      ...s, timeline: [...s.timeline, { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'commentaire' as const, contenu: commentInput.trim() }],
    } : s)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(s => s.id === id) || null)
    setCommentInput('')
  }

  const assignArtisan = (id: string, artisan: string) => {
    const now = new Date().toISOString()
    const updated = signalements.map(s => s.id === id ? {
      ...s, artisanAssigne: artisan, etat: 'artisan_contacte' as Etat,
      timeline: [...s.timeline,
        { id: Date.now().toString(), date: now, auteur: 'Gestionnaire', type: 'statut' as const, contenu: `Artisan assign\u00e9 : ${artisan}` },
      ],
    } : s)
    save(updated)
    if (selected?.id === id) setSelected(updated.find(s => s.id === id) || null)
  }

  const handleGenererQR = () => {
    if (!qrEquipement.trim()) return
    const newQR: QRCode = {
      id: `QR-${String(qrCodes.length + 1).padStart(3, '0')}`,
      zone: qrZone,
      equipement: qrEquipement.trim(),
      dateCreation: new Date().toISOString().split('T')[0],
      code: `FIXIT-${qrZone.slice(0, 3).toUpperCase()}-${String(qrCodes.length + 1).padStart(3, '0')}`,
      scans: 0,
    }
    saveQR([...qrCodes, newQR])
    setQrEquipement('')
    setShowQRModal(false)
  }

  const deleteSignalement = (id: string) => {
    save(signalements.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  // ── Styles partag\u00e9s ────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)',
    borderRadius: 12, padding: 20,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-navy,#0D1B2E)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
  }

  const btnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-navy,#0D1B2E)',
    border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8,
    padding: '8px 16px', fontWeight: 500, fontSize: 13,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--sd-border,#E4DDD0)', fontSize: 14,
    fontFamily: "'Outfit',sans-serif", background: '#fff',
    color: 'var(--sd-navy,#0D1B2E)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)',
    marginBottom: 4, display: 'block',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.35)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  }

  const modalStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflow: 'auto', padding: 28,
    boxShadow: '0 20px 60px rgba(13,27,46,0.2)',
  }

  // ─── Navigation par onglets ────────────────────────────────────────────────

  const TABS: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'tableau_bord',  label: 'Tableau de bord', icon: '\uD83D\uDCCA' },
    { key: 'signalements',  label: 'Signalements',    icon: '\uD83D\uDCCB' },
    { key: 'zones',         label: 'Zones sensibles',  icon: '\uD83D\uDDFA\uFE0F' },
    { key: 'qrcodes',       label: 'QR Codes',         icon: '\uD83D\uDCF1' },
  ]

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Outfit',sans-serif", color: 'var(--sd-navy,#0D1B2E)' }}>
      {/* En-t\u00eate */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
            Signalements et Maintenance
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sd-ink-3,#8A9BB0)' }}>
            Gestion des incidents, maintenances et signalements de la copropri\u00e9t\u00e9
          </p>
        </div>
        {tab === 'signalements' && (
          <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Nouveau signalement</button>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--sd-border,#E4DDD0)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', fontWeight: tab === t.key ? 700 : 500,
              fontSize: 13, fontFamily: "'Outfit',sans-serif",
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--sd-gold,#C9A84C)' : '2px solid transparent',
              color: tab === t.key ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ONGLET 1 — TABLEAU DE BORD */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'tableau_bord' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
            {[
              { emoji: '\uD83D\uDCCB', label: 'Total signalements', value: stats.total, color: 'gold' },
              { emoji: '\uD83D\uDCE3', label: 'Ouverts', value: stats.ouverts, color: 'red' },
              { emoji: '\uD83D\uDD27', label: 'En cours', value: stats.enCours, color: 'blue' },
              { emoji: '\u2705', label: 'R\u00e9solus', value: stats.resolus, color: 'green' },
              { emoji: '\u23F1\uFE0F', label: 'Temps moyen r\u00e9solution', value: `${stats.tempoMoyenResolution}j`, color: 'gold' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: kpi.color === 'red' ? '#FDECEA' : kpi.color === 'green' ? '#E6F4F2' : kpi.color === 'blue' ? '#EBF5FB' : 'rgba(201,168,76,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10,
                }}>
                  {kpi.emoji}
                </div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Priorit\u00e9s + SLA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* R\u00e9partition par priorit\u00e9 */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
                R\u00e9partition par priorit\u00e9
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.keys(PRIORITES) as Priorite[]).map(p => {
                  const count = stats.parPriorite[p]
                  const active = signalements.filter(s => s.etat !== 'cloture').length
                  const pct = active > 0 ? Math.round((count / active) * 100) : 0
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITES[p].dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 70 }}>{PRIORITES[p].label}</span>
                      <div style={{ flex: 1, height: 8, background: '#F0EDEA', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: PRIORITES[p].dot, borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conformit\u00e9 SLA */}
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
                Conformit\u00e9 SLA
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ position: 'relative', width: 140, height: 140 }}>
                  <svg viewBox="0 0 140 140" width={140} height={140}>
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#F0EDEA" strokeWidth="12" />
                    <circle
                      cx="70" cy="70" r="58" fill="none"
                      stroke={stats.slaPercent >= 80 ? '#1A7A6E' : stats.slaPercent >= 50 ? '#D4830A' : '#C0392B'}
                      strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(stats.slaPercent / 100) * 364.4} 364.4`}
                      transform="rotate(-90 70 70)"
                      style={{ transition: 'stroke-dasharray 0.5s' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)' }}>
                      {stats.slaPercent}%
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>R\u00e9solus dans les d\u00e9lais</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)', textAlign: 'center', marginTop: 8 }}>
                Objectifs : Urgence {SLA_CIBLES_JOURS.urgence}j | Haute {SLA_CIBLES_JOURS.haute}j | Moyenne {SLA_CIBLES_JOURS.moyenne}j | Basse {SLA_CIBLES_JOURS.basse}j
              </div>
            </div>
          </div>

          {/* Derniers signalements */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Derniers signalements
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signalements.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  onClick={() => { setSelected(s); setTab('signalements') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 8, cursor: 'pointer', border: '1px solid var(--sd-border,#E4DDD0)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sd-cream,#F7F4EE)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 18 }}>{CATEGORIES[s.categorie]?.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titre}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>{s.immeuble} \u2014 {s.signalePar}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                    background: ETATS[s.etat]?.bg, color: ETATS[s.etat]?.color,
                  }}>
                    {ETATS[s.etat]?.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                    background: PRIORITES[s.priorite]?.bg, color: PRIORITES[s.priorite]?.color,
                  }}>
                    {PRIORITES[s.priorite]?.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ONGLET 2 — SIGNALEMENTS */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'signalements' && !selected && (
        <div>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filtreEtat} onChange={e => setFiltreEtat(e.target.value as Etat | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Tous les \u00e9tats</option>
              {PIPELINE_ETATS.map(e => <option key={e} value={e}>{ETATS[e].icon} {ETATS[e].label}</option>)}
            </select>
            <select value={filtrePriorite} onChange={e => setFiltrePriorite(e.target.value as Priorite | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Toutes les priorit\u00e9s</option>
              {(Object.keys(PRIORITES) as Priorite[]).map(p => <option key={p} value={p}>{PRIORITES[p].label}</option>)}
            </select>
            <select value={filtreCategorie} onChange={e => setFiltreCategorie(e.target.value as Categorie | '')} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Toutes les cat\u00e9gories</option>
              {(Object.keys(CATEGORIES) as Categorie[]).map(c => <option key={c} value={c}>{CATEGORIES[c].emoji} {CATEGORIES[c].label}</option>)}
            </select>
            <select value={filtreImmeuble} onChange={e => setFiltreImmeuble(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
              <option value="">Tous les immeubles</option>
              {immeubles.map(im => <option key={im} value={im}>{im}</option>)}
            </select>
            {(filtreEtat || filtrePriorite || filtreCategorie || filtreImmeuble) && (
              <button onClick={() => { setFiltreEtat(''); setFiltrePriorite(''); setFiltreCategorie(''); setFiltreImmeuble('') }} style={{ ...btnSecondary, fontSize: 12 }}>
                Effacer les filtres
              </button>
            )}
          </div>

          {/* Compteur */}
          <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginBottom: 12 }}>
            {filtered.length} signalement{filtered.length !== 1 ? 's' : ''} trouv\u00e9{filtered.length !== 1 ? 's' : ''}
          </div>

          {/* Tableau */}
          {filtered.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCCB'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Aucun signalement trouv\u00e9</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>Ajustez les filtres ou cr\u00e9ez un nouveau signalement.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream,#F7F4EE)' }}>
                    {['ID', 'Titre', 'Cat\u00e9gorie', 'Priorit\u00e9', 'Signal\u00e9 par', 'Immeuble', 'Date', '\u00c9tat', 'Artisan'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', fontSize: 11, letterSpacing: '0.3px', borderBottom: '1px solid var(--sd-border,#E4DDD0)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--sd-border,#E4DDD0)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sd-cream,#F7F4EE)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--sd-gold,#C9A84C)' }}>{s.id}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titre}</td>
                      <td style={{ padding: '10px 12px' }}>{CATEGORIES[s.categorie]?.emoji} {CATEGORIES[s.categorie]?.label}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: PRIORITES[s.priorite]?.bg, color: PRIORITES[s.priorite]?.color }}>
                          {PRIORITES[s.priorite]?.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.signalePar}<br /><span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>{s.lot}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.immeuble}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(s.date)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ETATS[s.etat]?.bg, color: ETATS[s.etat]?.color }}>
                          {ETATS[s.etat]?.icon} {ETATS[s.etat]?.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.artisanAssigne || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── D\u00e9tail signalement ────────────────────────────────────────────────── */}
      {tab === 'signalements' && selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ ...btnSecondary, marginBottom: 16 }}>
            \u2190 Retour \u00e0 la liste
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Gauche: d\u00e9tails */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{CATEGORIES[selected.categorie]?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>{selected.titre}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-gold,#C9A84C)' }}>{selected.id}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>
                      {selected.immeuble} \u2014 {selected.lot} \u2014 {formatDate(selected.date)}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--sd-ink-2,#4A5E78)', margin: '0 0 16px' }}>
                  {selected.description}
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ETATS[selected.etat]?.bg, color: ETATS[selected.etat]?.color }}>
                    {ETATS[selected.etat]?.icon} {ETATS[selected.etat]?.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: PRIORITES[selected.priorite]?.bg, color: PRIORITES[selected.priorite]?.color }}>
                    {PRIORITES[selected.priorite]?.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-ink-2,#4A5E78)' }}>
                    {CATEGORIES[selected.categorie]?.label}
                  </span>
                </div>
              </div>

              {/* Grille d\u2019informations */}
              <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={labelStyle}>Signal\u00e9 par</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.signalePar}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{selected.lot}</div>
                </div>
                <div>
                  <div style={labelStyle}>Localisation</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.localisationImmeuble || 'Non pr\u00e9cis\u00e9e'}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{ZONES[selected.zone]?.emoji} {ZONES[selected.zone]?.label}</div>
                </div>
                <div>
                  <div style={labelStyle}>Artisan assign\u00e9</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selected.artisanAssigne || 'Aucun'}</div>
                </div>
                <div>
                  <div style={labelStyle}>Ouvert depuis</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{joursDepuis(selected.date)} jour{joursDepuis(selected.date) !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                    SLA : {SLA_CIBLES_JOURS[selected.priorite]}j
                    {joursDepuis(selected.date) > SLA_CIBLES_JOURS[selected.priorite] && selected.etat !== 'resolu' && selected.etat !== 'cloture'
                      ? ' \u2014 SLA d\u00e9pass\u00e9'
                      : ''}
                  </div>
                </div>
              </div>

              {/* Actions : avancer l\u2019\u00e9tat */}
              {selected.etat !== 'cloture' && (
                <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginRight: 8 }}>Avancer l&apos;\u00e9tat :</span>
                  {PIPELINE_ETATS.map(etat => {
                    const currentIdx = PIPELINE_ETATS.indexOf(selected.etat)
                    const etatIdx = PIPELINE_ETATS.indexOf(etat)
                    if (etatIdx <= currentIdx) return null
                    return (
                      <button
                        key={etat}
                        onClick={() => advanceEtat(selected.id, etat)}
                        style={{
                          ...btnSecondary,
                          fontSize: 11, padding: '5px 12px',
                          background: ETATS[etat].bg, color: ETATS[etat].color,
                          borderColor: 'transparent',
                        }}
                      >
                        {ETATS[etat].icon} {ETATS[etat].label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Cr\u00e9er un ordre de mission */}
              {selected.etat !== 'cloture' && selected.etat !== 'resolu' && (
                <div style={{ ...cardStyle, background: 'rgba(201,168,76,0.06)', borderColor: 'var(--sd-gold,#C9A84C)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{'\uD83D\uDCDD'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Cr\u00e9er un ordre de mission</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Lier ce signalement au module Missions pour planifier l&apos;intervention</div>
                    </div>
                    <button
                      style={{ ...btnPrimary, fontSize: 12, padding: '8px 14px', background: 'var(--sd-gold,#C9A84C)' }}
                      onClick={() => {
                        // Cr\u00e9er une description pr\u00e9-remplie pour l\u2019ordre de mission
                        const missionInfo = `Mission pour : ${selected.titre}\nImmeuble : ${selected.immeuble}\nLot : ${selected.lot}\nCat\u00e9gorie : ${CATEGORIES[selected.categorie]?.label}\nPriorit\u00e9 : ${PRIORITES[selected.priorite]?.label}\nSignalement : ${selected.id}`
                        navigator.clipboard?.writeText(missionInfo)
                        toast.success('Informations du signalement copiées. Allez dans le module Missions pour créer l\u2019ordre de mission.')
                      }}
                    >
                      Cr\u00e9er mission
                    </button>
                  </div>
                </div>
              )}

              {/* Assigner un artisan */}
              {!selected.artisanAssigne && selected.etat !== 'cloture' && (
                <div style={cardStyle}>
                  <div style={labelStyle}>Assigner un artisan</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Nom de l'artisan..."
                      id="artisan-input-fr"
                      style={inputStyle}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const input = (e.target as HTMLInputElement).value
                          if (input.trim()) {
                            assignArtisan(selected.id, input.trim());
                            (e.target as HTMLInputElement).value = ''
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('artisan-input-fr') as HTMLInputElement
                        if (input?.value.trim()) {
                          assignArtisan(selected.id, input.value.trim())
                          input.value = ''
                        }
                      }}
                      style={btnPrimary}
                    >
                      Assigner
                    </button>
                  </div>
                </div>
              )}

              {/* Galerie photos */}
              {selected.photos.length > 0 && (
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
                    Photos
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                    {selected.photos.map((photo, idx) => (
                      <div key={idx} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--sd-border,#E4DDD0)', aspectRatio: '1', background: '#F0EDEA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Photo {idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Droite : chronologie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
                  Chronologie
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {selected.timeline.map((evt, idx) => (
                    <div key={evt.id} style={{ display: 'flex', gap: 10, paddingBottom: idx < selected.timeline.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          background: evt.type === 'statut' ? 'var(--sd-gold,#C9A84C)' : evt.type === 'photo' ? '#2980B9' : 'var(--sd-ink-3,#8A9BB0)',
                        }} />
                        {idx < selected.timeline.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--sd-border,#E4DDD0)', marginTop: 4 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{evt.contenu}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                          {formatDateTime(evt.date)} \u2014 {evt.auteur}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ajouter un commentaire */}
                {selected.etat !== 'cloture' && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--sd-border,#E4DDD0)', paddingTop: 12 }}>
                    <textarea
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      placeholder="Ajouter un commentaire..."
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <button
                      onClick={() => addComment(selected.id)}
                      disabled={!commentInput.trim()}
                      style={{ ...btnPrimary, marginTop: 8, opacity: commentInput.trim() ? 1 : 0.5, fontSize: 12, padding: '8px 14px' }}
                    >
                      Commenter
                    </button>
                  </div>
                )}
              </div>

              {/* Supprimer */}
              <button
                onClick={() => { if (confirm('Supprimer ce signalement ?')) deleteSignalement(selected.id) }}
                style={{ ...btnSecondary, color: '#C0392B', borderColor: '#FDECEA', background: '#FDECEA', fontSize: 12 }}
              >
                Supprimer le signalement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ONGLET 3 — ZONES SENSIBLES */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'zones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Carte des incidents par zone
            </h3>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '0 0 20px' }}>
              Visualisation des signalements par zone de l&apos;immeuble. Les zones \u00e0 forte densit\u00e9 d&apos;incidents sont mises en \u00e9vidence en rouge.
            </p>

            {/* Grille visuelle des zones */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {(Object.keys(ZONES) as Zone[]).map(zone => {
                const count = stats.parZone[zone] || 0
                const maxCount = Math.max(...Object.values(stats.parZone), 1)
                const intensity = count / maxCount
                const bg = count === 0 ? '#F7F4EE'
                  : intensity >= 0.7 ? '#FDECEA'
                  : intensity >= 0.4 ? '#FEF5E4'
                  : '#E6F4F2'
                const borderColor = count === 0 ? 'var(--sd-border,#E4DDD0)'
                  : intensity >= 0.7 ? '#E5A9A0'
                  : intensity >= 0.4 ? '#E8D4A0'
                  : '#B5DDD8'
                return (
                  <div
                    key={zone}
                    style={{
                      background: bg, border: `2px solid ${borderColor}`, borderRadius: 12,
                      padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s',
                    }}
                    onClick={() => {
                      setFiltreEtat('')
                      setFiltrePriorite('')
                      setFiltreCategorie('')
                      setFiltreImmeuble('')
                      setTab('signalements')
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{ZONES[zone].emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>{ZONES[zone].label}</div>
                    <div style={{
                      fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif",
                      color: count === 0 ? 'var(--sd-ink-3,#8A9BB0)' : intensity >= 0.7 ? '#C0392B' : intensity >= 0.4 ? '#D4830A' : '#1A7A6E',
                      marginTop: 4,
                    }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>
                      signalement{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Classement des zones */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Classement des zones par incidents
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(stats.parZone)
                .sort(([, a], [, b]) => b - a)
                .map(([zone, count], idx) => {
                  const maxCount = Math.max(...Object.values(stats.parZone), 1)
                  const pct = Math.round((count / maxCount) * 100)
                  const z = ZONES[zone as Zone]
                  const topCat = stats.categorieParZone[zone]
                  return (
                    <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-gold,#C9A84C)', minWidth: 22 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 16 }}>{z?.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 130 }}>{z?.label || zone}</span>
                      <div style={{ flex: 1, height: 8, background: '#F0EDEA', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s',
                          background: idx === 0 ? '#C0392B' : idx === 1 ? '#D4830A' : '#1A7A6E',
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Statistiques par zone */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Statistiques d\u00e9taill\u00e9es par zone
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {(Object.keys(ZONES) as Zone[]).map(zone => {
                const count = stats.parZone[zone] || 0
                const topCat = stats.categorieParZone[zone]
                const zoneSignalements = signalements.filter(s => s.zone === zone)
                const avgResolution = zoneSignalements.length > 0
                  ? Math.round(zoneSignalements.reduce((sum, s) => {
                      const last = s.timeline[s.timeline.length - 1]
                      return sum + (last ? Math.ceil((new Date(last.date).getTime() - new Date(s.date).getTime()) / 86400000) : 0)
                    }, 0) / zoneSignalements.length)
                  : 0
                return (
                  <div key={zone} style={{ border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{ZONES[zone].emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ZONES[zone].label}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>Nb incidents</span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>Type fr\u00e9quent</span>
                        <span style={{ fontWeight: 500 }}>{topCat ? CATEGORIES[topCat as Categorie]?.label || '\u2014' : '\u2014'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>D\u00e9lai moyen</span>
                        <span style={{ fontWeight: 500 }}>{count > 0 ? `${avgResolution}j` : '\u2014'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Repr\u00e9sentation de l\u2019immeuble */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--sd-navy,#0D1B2E)' }}>
              Repr\u00e9sentation de l&apos;immeuble
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400, margin: '0 auto' }}>
              {/* Toiture */}
              <div style={{
                background: (stats.parZone['toiture'] || 0) > 0 ? '#FDECEA' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: '12px 12px 0 0',
                padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONES.toiture.emoji} Toiture ({stats.parZone['toiture'] || 0})
              </div>
              {/* \u00c9tages */}
              {[5, 4, 3, 2, 1].map(etage => (
                <div key={etage} style={{
                  background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 600 }}>{etage}{etage === 1 ? 'er' : '\u00e8me'} \u00e9tage</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span>Gauche</span>
                    <span style={{ color: 'var(--sd-ink-3,#8A9BB0)' }}>|</span>
                    <span>Droite</span>
                  </div>
                </div>
              ))}
              {/* RDC - Hall */}
              <div style={{
                background: (stats.parZone['hall'] || 0) > 0 ? '#FEF5E4' : '#fff',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                padding: '8px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONES.hall.emoji} RDC \u2014 Hall ({stats.parZone['hall'] || 0})
              </div>
              {/* Fa\u00e7ade */}
              <div style={{
                background: (stats.parZone['facade'] || 0) > 0 ? '#FEF5E4' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                padding: '8px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONES.facade.emoji} Fa\u00e7ade ({stats.parZone['facade'] || 0})
              </div>
              {/* Escaliers + Espaces verts */}
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{
                  flex: 1,
                  background: (stats.parZone['escaliers'] || 0) > 0 ? '#FEF5E4' : '#F7F4EE',
                  border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                }}>
                  {ZONES.escaliers.emoji} Escaliers ({stats.parZone['escaliers'] || 0})
                </div>
                <div style={{
                  flex: 1,
                  background: (stats.parZone['espaces_verts'] || 0) > 0 ? '#FEF5E4' : '#F7F4EE',
                  border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none',
                  padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                }}>
                  {ZONES.espaces_verts.emoji} Espaces verts ({stats.parZone['espaces_verts'] || 0})
                </div>
              </div>
              {/* Sous-sol */}
              <div style={{
                background: (stats.parZone['sous_sol'] || 0) > 0 ? '#FDECEA' : '#F7F4EE',
                border: '1px solid var(--sd-border,#E4DDD0)', borderTop: 'none', borderRadius: '0 0 12px 12px',
                padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              }}>
                {ZONES.sous_sol.emoji} Sous-sol / Parking ({stats.parZone['sous_sol'] || 0})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* ONGLET 4 — QR CODES */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'qrcodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 14, color: 'var(--sd-ink-3,#8A9BB0)', margin: 0 }}>
              QR Codes par zone et \u00e9quipement. La lecture ouvre un formulaire pr\u00e9-rempli avec les informations de la zone.
            </p>
            <button onClick={() => setShowQRModal(true)} style={btnPrimary}>+ G\u00e9n\u00e9rer QR Code</button>
          </div>

          {qrCodes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCF1'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Aucun QR Code g\u00e9n\u00e9r\u00e9</div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>G\u00e9n\u00e9rez des QR Codes pour faciliter les signalements sur le terrain.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {qrCodes.map(qr => (
                <div key={qr.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, background: 'rgba(201,168,76,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>
                      {ZONES[qr.zone]?.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{ZONES[qr.zone]?.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{qr.equipement}</div>
                    </div>
                  </div>

                  {/* Repr\u00e9sentation QR */}
                  <div style={{
                    background: '#fff', border: '2px solid var(--sd-navy,#0D1B2E)', borderRadius: 8,
                    padding: 16, textAlign: 'center', marginBottom: 12,
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, width: 84, height: 84, margin: '0 auto',
                    }}>
                      {Array.from({ length: 49 }, (_, i) => {
                        const hash = qr.code.charCodeAt(i % qr.code.length) + i
                        const filled = (hash * 31 + i * 7) % 3 !== 0
                        const row = Math.floor(i / 7)
                        const col = i % 7
                        const isCorner = (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2)
                        return (
                          <div
                            key={i}
                            style={{
                              background: isCorner || filled ? 'var(--sd-navy,#0D1B2E)' : 'transparent',
                              borderRadius: 1,
                            }}
                          />
                        )
                      })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', marginTop: 8, fontFamily: 'monospace' }}>
                      {qr.code}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Cr\u00e9\u00e9 : {formatDate(qr.dateCreation)}</span>
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginLeft: 12 }}>{qr.scans} scan{qr.scans !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      onClick={() => {
                        const text = `Fixit QR \u2014 ${ZONES[qr.zone]?.label} : ${qr.equipement}\nCode : ${qr.code}\nScannez pour signaler un incident dans cette zone.`
                        navigator.clipboard?.writeText(text)
                      }}
                      style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px' }}
                    >
                      Copier info
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — Nouveau signalement */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
                Nouveau signalement
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Titre */}
              <div>
                <label style={labelStyle}>Titre *</label>
                <input value={formTitre} onChange={e => setFormTitre(e.target.value)} placeholder="Ex : Infiltration au plafond du parking" style={inputStyle} />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="D\u00e9crivez le probl\u00e8me en d\u00e9tail..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Cat\u00e9gorie + Priorit\u00e9 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cat\u00e9gorie</label>
                  <select value={formCategorie} onChange={e => setFormCategorie(e.target.value as Categorie)} style={inputStyle}>
                    {(Object.keys(CATEGORIES) as Categorie[]).map(c => (
                      <option key={c} value={c}>{CATEGORIES[c].emoji} {CATEGORIES[c].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priorit\u00e9</label>
                  <select value={formPriorite} onChange={e => setFormPriorite(e.target.value as Priorite)} style={inputStyle}>
                    {(Object.keys(PRIORITES) as Priorite[]).map(p => (
                      <option key={p} value={p}>{PRIORITES[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Immeuble + Lot */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Immeuble</label>
                  <input value={formImmeuble} onChange={e => setFormImmeuble(e.target.value)} placeholder="Ex : R\u00e9sidence Les Tilleuls" style={inputStyle} list="immeubles-list-fr" />
                  <datalist id="immeubles-list-fr">
                    {immeubles.map(im => <option key={im} value={im} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Lot / Appartement</label>
                  <input value={formLot} onChange={e => setFormLot(e.target.value)} placeholder="Ex : 3\u00e8me gauche" style={inputStyle} />
                </div>
              </div>

              {/* Zone + Localisation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Zone de l&apos;immeuble</label>
                  <select value={formZone} onChange={e => setFormZone(e.target.value as Zone)} style={inputStyle}>
                    {(Object.keys(ZONES) as Zone[]).map(z => (
                      <option key={z} value={z}>{ZONES[z].emoji} {ZONES[z].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Localisation pr\u00e9cise</label>
                  <input value={formLocalisation} onChange={e => setFormLocalisation(e.target.value)} placeholder="Ex : Couloir 3\u00e8me \u00e9tage" style={inputStyle} />
                </div>
              </div>

              {/* Photos */}
              <div>
                <label style={labelStyle}>Photos (optionnel)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{
                    ...inputStyle,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => { setShowModal(false); resetForm() }} style={btnSecondary}>Annuler</button>
                <button onClick={handleCreer} disabled={!formTitre.trim()} style={{ ...btnPrimary, opacity: formTitre.trim() ? 1 : 0.5 }}>
                  Cr\u00e9er le signalement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — G\u00e9n\u00e9rer QR Code */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {showQRModal && (
        <div style={overlayStyle} onClick={() => setShowQRModal(false)}>
          <div style={{ ...modalStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--sd-navy,#0D1B2E)' }}>
                G\u00e9n\u00e9rer un QR Code
              </h3>
              <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3,#8A9BB0)' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Zone</label>
                <select value={qrZone} onChange={e => setQrZone(e.target.value as Zone)} style={inputStyle}>
                  {(Object.keys(ZONES) as Zone[]).map(z => (
                    <option key={z} value={z}>{ZONES[z].emoji} {ZONES[z].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>\u00c9quipement *</label>
                <input value={qrEquipement} onChange={e => setQrEquipement(e.target.value)} placeholder="Ex : Tableau \u00e9lectrique principal" style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowQRModal(false)} style={btnSecondary}>Annuler</button>
                <button onClick={handleGenererQR} disabled={!qrEquipement.trim()} style={{ ...btnPrimary, opacity: qrEquipement.trim() ? 1 : 0.5 }}>
                  G\u00e9n\u00e9rer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
