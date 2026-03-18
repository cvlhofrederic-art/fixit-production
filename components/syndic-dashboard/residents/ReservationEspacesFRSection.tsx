'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TypeEspace = 'salle_fetes' | 'jardin' | 'parking_visiteurs' | 'local_velos' | 'salle_reunion' | 'buanderie'
type EtatEspace = 'disponible' | 'reserve' | 'maintenance'
type TabReservation = 'calendrier' | 'espaces' | 'regles' | 'statistiques'
type VueCalendrier = 'semaine' | 'mois'

interface Espace {
  id: string
  type: TypeEspace
  nom: string
  capacite: number
  horaireOuverture: string   // "09:00"
  horaireFermeture: string   // "22:00"
  etat: EtatEspace
  photo?: string
}

interface RegleEspace {
  espaceId: string
  horaireAutoriseDe: string
  horaireAutoriseA: string
  dureeMaxHeures: number
  preavisMinJours: number
  preavisMaxJours: number
  cautionMontant: number
  nettoyageObligatoire: boolean
  limiteReservationsParLotMois: number
  annulationHeuresAvant: number
  nuisancesSonoresRappel: boolean
}

interface Reservation {
  id: string
  espaceId: string
  espaceNom: string
  typeEspace: TypeEspace
  lotId: string             // ex: "A12", "B03"
  nomResident: string
  date: string              // YYYY-MM-DD
  heureDebut: string        // "10:00"
  heureFin: string          // "14:00"
  cautionPayee: boolean
  cautionMontant: number
  etat: 'confirmee' | 'en_attente' | 'annulee'
  creeeLe: string
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPE_ESPACE_CONFIG: Record<TypeEspace, { label: string; emoji: string; couleur: string; couleurBg: string }> = {
  salle_fetes:       { label: 'Salle des fetes',       emoji: '🎉', couleur: '#3B82F6', couleurBg: 'rgba(59,130,246,0.12)' },
  jardin:            { label: 'Jardin / Terrasse',      emoji: '🌿', couleur: '#22C55E', couleurBg: 'rgba(34,197,94,0.12)' },
  parking_visiteurs: { label: 'Parking visiteurs',      emoji: '🚗', couleur: '#F97316', couleurBg: 'rgba(249,115,22,0.12)' },
  local_velos:       { label: 'Local velos',            emoji: '🚲', couleur: '#8B5CF6', couleurBg: 'rgba(139,92,246,0.12)' },
  salle_reunion:     { label: 'Salle de reunion',       emoji: '🤝', couleur: '#0D9488', couleurBg: 'rgba(13,148,136,0.12)' },
  buanderie:         { label: 'Buanderie',              emoji: '🧺', couleur: '#EC4899', couleurBg: 'rgba(236,72,153,0.12)' },
}

const ETAT_ESPACE_CONFIG: Record<EtatEspace, { label: string; couleur: string; bg: string }> = {
  disponible:  { label: 'Disponible',    couleur: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  reserve:     { label: 'Reserve',       couleur: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  maintenance: { label: 'Maintenance',   couleur: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
}

const TABS: { key: TabReservation; label: string; emoji: string }[] = [
  { key: 'calendrier',    label: 'Calendrier',    emoji: '📅' },
  { key: 'espaces',       label: 'Espaces',       emoji: '🏢' },
  { key: 'regles',        label: 'Regles',        emoji: '📋' },
  { key: 'statistiques',  label: 'Statistiques',  emoji: '📊' },
]

// ─── Demo data ───────────────────────────────────────────────────────────────

function genererDonneesDemonstration(userId: string): { espaces: Espace[]; regles: RegleEspace[]; reservations: Reservation[] } {
  const espaces: Espace[] = [
    { id: 'e1', type: 'salle_fetes',       nom: 'Salle des fetes Bat. A',     capacite: 60, horaireOuverture: '09:00', horaireFermeture: '22:00', etat: 'disponible' },
    { id: 'e2', type: 'jardin',            nom: 'Jardin / Terrasse commune',   capacite: 30, horaireOuverture: '08:00', horaireFermeture: '21:00', etat: 'disponible' },
    { id: 'e3', type: 'parking_visiteurs', nom: 'Parking visiteurs (6 places)', capacite: 6,  horaireOuverture: '00:00', horaireFermeture: '23:59', etat: 'disponible' },
    { id: 'e4', type: 'local_velos',       nom: 'Local velos sous-sol',        capacite: 20, horaireOuverture: '06:00', horaireFermeture: '22:00', etat: 'disponible' },
    { id: 'e5', type: 'salle_reunion',     nom: 'Salle de reunion RDC',        capacite: 12, horaireOuverture: '08:00', horaireFermeture: '20:00', etat: 'disponible' },
    { id: 'e6', type: 'buanderie',         nom: 'Buanderie Bat. B',            capacite: 4,  horaireOuverture: '07:00', horaireFermeture: '21:00', etat: 'maintenance' },
  ]

  const regles: RegleEspace[] = espaces.map(e => ({
    espaceId: e.id,
    horaireAutoriseDe: e.horaireOuverture,
    horaireAutoriseA: e.horaireFermeture,
    dureeMaxHeures: e.type === 'salle_fetes' ? 8 : e.type === 'jardin' ? 6 : e.type === 'parking_visiteurs' ? 24 : 4,
    preavisMinJours: e.type === 'salle_fetes' ? 7 : 2,
    preavisMaxJours: 60,
    cautionMontant: e.type === 'salle_fetes' ? 200 : e.type === 'jardin' ? 100 : e.type === 'salle_reunion' ? 50 : 0,
    nettoyageObligatoire: e.type === 'salle_fetes' || e.type === 'jardin' || e.type === 'buanderie',
    limiteReservationsParLotMois: e.type === 'parking_visiteurs' ? 4 : 2,
    annulationHeuresAvant: e.type === 'salle_fetes' ? 72 : 48,
    nuisancesSonoresRappel: e.type === 'salle_fetes' || e.type === 'jardin',
  }))

  const aujourdhui = new Date()
  const reservations: Reservation[] = []
  const noms = ['Jean Dupont', 'Marie Martin', 'Pierre Bernard', 'Sophie Dubois', 'Thomas Petit', 'Claire Moreau', 'Nicolas Leroy', 'Isabelle Roux']
  const lots = ['A01', 'A02', 'A05', 'B01', 'B03', 'B04', 'C02', 'C06', 'D01', 'D03']

  for (let d = -14; d < 28; d++) {
    const dt = new Date(aujourdhui)
    dt.setDate(dt.getDate() + d)
    const dateStr = dt.toISOString().slice(0, 10)
    const nbReservations = Math.random() > 0.45 ? (Math.random() > 0.6 ? 2 : 1) : 0
    for (let r = 0; r < nbReservations; r++) {
      const esp = espaces[Math.floor(Math.random() * espaces.length)]
      const heureI = 9 + Math.floor(Math.random() * 8)
      const duree = 2 + Math.floor(Math.random() * 4)
      const lot = lots[Math.floor(Math.random() * lots.length)]
      const nom = noms[Math.floor(Math.random() * noms.length)]
      const regle = regles.find(rr => rr.espaceId === esp.id)
      reservations.push({
        id: crypto.randomUUID(),
        espaceId: esp.id,
        espaceNom: esp.nom,
        typeEspace: esp.type,
        lotId: lot,
        nomResident: nom,
        date: dateStr,
        heureDebut: `${String(heureI).padStart(2, '0')}:00`,
        heureFin: `${String(Math.min(heureI + duree, 23)).padStart(2, '0')}:00`,
        cautionPayee: Math.random() > 0.3,
        cautionMontant: regle?.cautionMontant || 0,
        etat: d < 0 ? 'confirmee' : Math.random() > 0.2 ? 'confirmee' : 'en_attente',
        creeeLe: new Date(dt.getTime() - 86400000 * 3).toISOString(),
      })
    }
  }

  return { espaces, regles, reservations }
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ReservationEspacesFRSection({ user, userRole }: Props) {
  // ── State
  const [tab, setTab] = useState<TabReservation>('calendrier')
  const [vueCalendrier, setVueCalendrier] = useState<VueCalendrier>('mois')
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [regles, setRegles] = useState<RegleEspace[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [dateCalendrier, setDateCalendrier] = useState(new Date())

  // Modal states
  const [showNouvelEspace, setShowNouvelEspace] = useState(false)
  const [showNouvelleReservation, setShowNouvelleReservation] = useState(false)
  const [reservationDatePrefill, setReservationDatePrefill] = useState('')

  // Form: Nouvel espace
  const [fNom, setFNom] = useState('')
  const [fType, setFType] = useState<TypeEspace>('salle_fetes')
  const [fCapacite, setFCapacite] = useState('')
  const [fHoraireOuverture, setFHoraireOuverture] = useState('09:00')
  const [fHoraireFermeture, setFHoraireFermeture] = useState('22:00')

  // Form: Nouvelle reservation
  const [rEspaceId, setREspaceId] = useState('')
  const [rLot, setRLot] = useState('')
  const [rNom, setRNom] = useState('')
  const [rDate, setRDate] = useState('')
  const [rHeureDebut, setRHeureDebut] = useState('10:00')
  const [rHeureFin, setRHeureFin] = useState('14:00')

  // Regles editing
  const [regleEditId, setRegleEditId] = useState<string | null>(null)

  // ── Storage
  const STORAGE_KEY = `fixit_reservations_fr_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.espaces) setEspaces(data.espaces)
        if (data.regles) setRegles(data.regles)
        if (data.reservations) setReservations(data.reservations)
      } else {
        const demo = genererDonneesDemonstration(user.id)
        setEspaces(demo.espaces)
        setRegles(demo.regles)
        setReservations(demo.reservations)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ espaces, regles, reservations }))
    } catch { /* ignore */ }
  }, [espaces, regles, reservations])

  // ── Actions
  const creerEspace = () => {
    if (!fNom.trim()) return
    const nouvelEspace: Espace = {
      id: crypto.randomUUID(),
      type: fType,
      nom: fNom.trim(),
      capacite: parseInt(fCapacite) || 20,
      horaireOuverture: fHoraireOuverture,
      horaireFermeture: fHoraireFermeture,
      etat: 'disponible',
    }
    const nouvelleRegle: RegleEspace = {
      espaceId: nouvelEspace.id,
      horaireAutoriseDe: fHoraireOuverture,
      horaireAutoriseA: fHoraireFermeture,
      dureeMaxHeures: 4,
      preavisMinJours: 2,
      preavisMaxJours: 60,
      cautionMontant: 0,
      nettoyageObligatoire: false,
      limiteReservationsParLotMois: 2,
      annulationHeuresAvant: 48,
      nuisancesSonoresRappel: false,
    }
    setEspaces(prev => [...prev, nouvelEspace])
    setRegles(prev => [...prev, nouvelleRegle])
    setFNom(''); setFCapacite(''); setFType('salle_fetes'); setFHoraireOuverture('09:00'); setFHoraireFermeture('22:00')
    setShowNouvelEspace(false)
  }

  const supprimerEspace = (id: string) => {
    setEspaces(prev => prev.filter(e => e.id !== id))
    setRegles(prev => prev.filter(r => r.espaceId !== id))
    setReservations(prev => prev.filter(r => r.espaceId !== id))
  }

  const changerEtatEspace = (id: string) => {
    setEspaces(prev => prev.map(e => {
      if (e.id !== id) return e
      const suivant: EtatEspace = e.etat === 'disponible' ? 'maintenance' : e.etat === 'maintenance' ? 'reserve' : 'disponible'
      return { ...e, etat: suivant }
    }))
  }

  const creerReservation = () => {
    if (!rEspaceId || !rLot.trim() || !rNom.trim() || !rDate) return
    const esp = espaces.find(e => e.id === rEspaceId)
    if (!esp) return
    const regle = regles.find(r => r.espaceId === rEspaceId)
    const nouvelle: Reservation = {
      id: crypto.randomUUID(),
      espaceId: rEspaceId,
      espaceNom: esp.nom,
      typeEspace: esp.type,
      lotId: rLot.trim(),
      nomResident: rNom.trim(),
      date: rDate,
      heureDebut: rHeureDebut,
      heureFin: rHeureFin,
      cautionPayee: false,
      cautionMontant: regle?.cautionMontant || 0,
      etat: 'en_attente',
      creeeLe: new Date().toISOString(),
    }
    setReservations(prev => [nouvelle, ...prev])
    setREspaceId(''); setRLot(''); setRNom(''); setRDate(''); setRHeureDebut('10:00'); setRHeureFin('14:00')
    setShowNouvelleReservation(false)
    setReservationDatePrefill('')
  }

  const annulerReservation = (id: string) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, etat: 'annulee' as const } : r))
  }

  const confirmerReservation = (id: string) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, etat: 'confirmee' as const } : r))
  }

  const mettreAJourRegle = (espaceId: string, champ: keyof RegleEspace, valeur: any) => {
    setRegles(prev => prev.map(r => r.espaceId === espaceId ? { ...r, [champ]: valeur } : r))
  }

  // ── Calendar helpers
  const getJoursDansMois = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getPremierJourDuMois = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return d === 0 ? 6 : d - 1 // Lundi=0
  }

  const getJoursSemaine = (date: Date) => {
    const d = new Date(date)
    const jour = d.getDay()
    const diff = d.getDate() - jour + (jour === 0 ? -6 : 1)
    const lundi = new Date(d.setDate(diff))
    const jours: Date[] = []
    for (let i = 0; i < 7; i++) {
      const dd = new Date(lundi)
      dd.setDate(lundi.getDate() + i)
      jours.push(dd)
    }
    return jours
  }

  const reservationsJour = (dateStr: string) => reservations.filter(r => r.date === dateStr && r.etat !== 'annulee')
  const estAujourdhui = (d: Date) => {
    const t = new Date()
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
  }
  const dateVersStr = (d: Date) => d.toISOString().slice(0, 10)
  const fmtPrix = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const joursSemaineLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const moisLabels = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']

  // ── Stats
  const stats = useMemo(() => {
    const maintenant = new Date()
    const moisActuel = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`
    const reservationsMois = reservations.filter(r => r.date.startsWith(moisActuel) && r.etat !== 'annulee')
    const totalReservationsMois = reservationsMois.length

    // Espace le plus utilise
    const comptageParEspace: Record<string, number> = {}
    for (const r of reservationsMois) {
      comptageParEspace[r.espaceNom] = (comptageParEspace[r.espaceNom] || 0) + 1
    }
    const espacePlusUtilise = Object.entries(comptageParEspace).sort((a, b) => b[1] - a[1])[0]

    // Taux d'occupation (reservations du mois / (espaces * jours du mois))
    const joursMois = getJoursDansMois(maintenant)
    const espacesActifs = espaces.filter(e => e.etat !== 'maintenance').length
    const tauxOccupation = espacesActifs > 0 ? Math.round((totalReservationsMois / (espacesActifs * joursMois)) * 100) : 0

    // Revenus des cautions
    const recetteCautions = reservationsMois.filter(r => r.cautionPayee).reduce((s, r) => s + r.cautionMontant, 0)
    const cautionsEnAttente = reservationsMois.filter(r => !r.cautionPayee && r.cautionMontant > 0).length

    // Top lots
    const parLot: Record<string, number> = {}
    for (const r of reservations.filter(rr => rr.etat !== 'annulee')) {
      parLot[r.lotId] = (parLot[r.lotId] || 0) + 1
    }
    const topLots = Object.entries(parLot).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // Reservations par type d'espace
    const parType: Record<string, { count: number; couleur: string }> = {}
    for (const r of reservationsMois) {
      const cfg = TYPE_ESPACE_CONFIG[r.typeEspace]
      const label = cfg?.label || r.typeEspace
      if (!parType[label]) parType[label] = { count: 0, couleur: cfg?.couleur || '#0D1B2E' }
      parType[label].count++
    }

    // Reservations par espace avec taux
    const occupationParEspace = espaces.map(e => {
      const resEspace = reservationsMois.filter(r => r.espaceId === e.id)
      const taux = joursMois > 0 ? Math.round((resEspace.length / joursMois) * 100) : 0
      return { nom: e.nom, type: e.type, reservations: resEspace.length, taux }
    })

    return { totalReservationsMois, espacePlusUtilise, tauxOccupation, recetteCautions, cautionsEnAttente, topLots, parType, occupationParEspace }
  }, [reservations, espaces])

  // ─── Shared styles ────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 20,
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

  const btnSecondary: React.CSSProperties = {
    background: 'var(--sd-cream, #F7F4EE)',
    color: 'var(--sd-navy, #0D1B2E)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    background: '#fff',
    color: 'var(--sd-navy, #0D1B2E)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--sd-ink-2, #4A5E78)',
    marginBottom: 4,
    display: 'block',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(13,27,46,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    padding: 28,
    maxWidth: 520,
    width: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(13,27,46,0.18)',
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            📅 Reservation des espaces communs
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Gestion des reservations, espaces et regles d&apos;utilisation de la copropriete
          </p>
        </div>
        <button onClick={() => { setShowNouvelleReservation(true); setReservationDatePrefill('') }} style={btnPrimary}>
          + Nouvelle reservation
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--sd-cream, #F7F4EE)', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)',
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: tab === t.key ? '0 1px 4px rgba(13,27,46,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Calendrier ──────────────────────────────────────────────────── */}
      {tab === 'calendrier' && (
        <div>
          {/* Calendar controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => {
                const d = new Date(dateCalendrier)
                if (vueCalendrier === 'mois') d.setMonth(d.getMonth() - 1)
                else d.setDate(d.getDate() - 7)
                setDateCalendrier(d)
              }} style={{ ...btnSecondary, padding: '8px 14px' }}>{'<'}</button>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', minWidth: 200, textAlign: 'center' }}>
                {vueCalendrier === 'mois'
                  ? `${moisLabels[dateCalendrier.getMonth()]} ${dateCalendrier.getFullYear()}`
                  : (() => {
                      const sem = getJoursSemaine(dateCalendrier)
                      return `${sem[0].getDate()} - ${sem[6].getDate()} ${moisLabels[sem[6].getMonth()]} ${sem[6].getFullYear()}`
                    })()
                }
              </span>
              <button onClick={() => {
                const d = new Date(dateCalendrier)
                if (vueCalendrier === 'mois') d.setMonth(d.getMonth() + 1)
                else d.setDate(d.getDate() + 7)
                setDateCalendrier(d)
              }} style={{ ...btnSecondary, padding: '8px 14px' }}>{'>'}</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { setDateCalendrier(new Date()) }}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12 }}
              >
                Aujourd&apos;hui
              </button>
              <button
                onClick={() => setVueCalendrier('semaine')}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12, background: vueCalendrier === 'semaine' ? 'var(--sd-navy, #0D1B2E)' : undefined, color: vueCalendrier === 'semaine' ? '#fff' : undefined }}
              >
                Semaine
              </button>
              <button
                onClick={() => setVueCalendrier('mois')}
                style={{ ...btnSecondary, padding: '8px 14px', fontSize: 12, background: vueCalendrier === 'mois' ? 'var(--sd-navy, #0D1B2E)' : undefined, color: vueCalendrier === 'mois' ? '#fff' : undefined }}
              >
                Mois
              </button>
            </div>
          </div>

          {/* Legende */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.entries(TYPE_ESPACE_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--sd-ink-2, #4A5E78)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cfg.couleur, display: 'inline-block' }} />
                {cfg.label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {vueCalendrier === 'mois' ? (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {joursSemaineLabels.map(d => (
                  <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)', background: 'var(--sd-cream, #F7F4EE)', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Days grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {/* Empty cells for offset */}
                {Array.from({ length: getPremierJourDuMois(dateCalendrier) }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 90, borderBottom: '1px solid var(--sd-border, #E4DDD0)', borderRight: '1px solid var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)', opacity: 0.5 }} />
                ))}
                {/* Actual days */}
                {Array.from({ length: getJoursDansMois(dateCalendrier) }).map((_, i) => {
                  const numJour = i + 1
                  const dt = new Date(dateCalendrier.getFullYear(), dateCalendrier.getMonth(), numJour)
                  const ds = dateVersStr(dt)
                  const resJour = reservationsJour(ds)
                  const aujourdhui = estAujourdhui(dt)
                  return (
                    <div
                      key={numJour}
                      onClick={() => { setReservationDatePrefill(ds); setRDate(ds); setShowNouvelleReservation(true) }}
                      style={{
                        minHeight: 90,
                        padding: 6,
                        cursor: 'pointer',
                        background: aujourdhui ? 'rgba(201,168,76,0.06)' : '#fff',
                        border: aujourdhui ? '2px solid var(--sd-gold, #C9A84C)' : undefined,
                        borderBottom: aujourdhui ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
                        borderRight: aujourdhui ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!aujourdhui) (e.currentTarget as HTMLDivElement).style.background = 'var(--sd-cream, #F7F4EE)' }}
                      onMouseLeave={e => { if (!aujourdhui) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
                    >
                      <div style={{
                        fontSize: 12,
                        fontWeight: aujourdhui ? 700 : 400,
                        color: aujourdhui ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                        marginBottom: 4,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: aujourdhui ? 'var(--sd-gold, #C9A84C)' : 'transparent',
                      }}>
                        {numJour}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {resJour.slice(0, 3).map(r => {
                          const cfg = TYPE_ESPACE_CONFIG[r.typeEspace]
                          return (
                            <div key={r.id} style={{
                              fontSize: 9,
                              padding: '2px 4px',
                              borderRadius: 3,
                              background: cfg?.couleurBg || 'rgba(13,27,46,0.06)',
                              color: cfg?.couleur || 'var(--sd-navy, #0D1B2E)',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {r.heureDebut} {r.espaceNom.split(' ')[0]}
                            </div>
                          )
                        })}
                        {resJour.length > 3 && (
                          <div style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 500 }}>
                            +{resJour.length - 3} autres
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Week view */
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {getJoursSemaine(dateCalendrier).map(d => {
                  const ds = dateVersStr(d)
                  const resJour = reservationsJour(ds)
                  const aujourdhui = estAujourdhui(d)
                  return (
                    <div key={ds} style={{ borderRight: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <div style={{
                        padding: '10px 8px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: aujourdhui ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-ink-2, #4A5E78)',
                        background: aujourdhui ? 'rgba(201,168,76,0.08)' : 'var(--sd-cream, #F7F4EE)',
                        borderBottom: aujourdhui ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
                      }}>
                        {joursSemaineLabels[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                      </div>
                      <div
                        onClick={() => { setReservationDatePrefill(ds); setRDate(ds); setShowNouvelleReservation(true) }}
                        style={{ minHeight: 300, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {resJour.map(r => {
                          const cfg = TYPE_ESPACE_CONFIG[r.typeEspace]
                          return (
                            <div key={r.id} style={{
                              fontSize: 11,
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: cfg?.couleurBg || 'rgba(13,27,46,0.06)',
                              borderLeft: `3px solid ${cfg?.couleur || '#999'}`,
                            }}>
                              <div style={{ fontWeight: 600, color: cfg?.couleur || 'var(--sd-navy, #0D1B2E)', fontSize: 10 }}>
                                {r.heureDebut}-{r.heureFin}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 2 }}>
                                {cfg?.emoji} {r.espaceNom}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 1 }}>
                                {r.nomResident} (Lot {r.lotId})
                              </div>
                            </div>
                          )
                        })}
                        {resJour.length === 0 && (
                          <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
                            Aucune reservation
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Prochaines reservations */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>
              Prochaines reservations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reservations
                .filter(r => r.date >= dateVersStr(new Date()) && r.etat !== 'annulee')
                .sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut))
                .slice(0, 8)
                .map(r => {
                  const cfg = TYPE_ESPACE_CONFIG[r.typeEspace]
                  return (
                    <div key={r.id} style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: cfg?.couleurBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          {cfg?.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{r.espaceNom}</div>
                          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                            {r.nomResident} - Lot {r.lotId}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                          {r.heureDebut} - {r.heureFin}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 5,
                          background: r.etat === 'confirmee' ? 'rgba(34,197,94,0.12)' : r.etat === 'en_attente' ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.12)',
                          color: r.etat === 'confirmee' ? '#22C55E' : r.etat === 'en_attente' ? '#F97316' : '#EF4444',
                        }}>
                          {r.etat === 'confirmee' ? 'Confirmee' : r.etat === 'en_attente' ? 'En attente' : 'Annulee'}
                        </span>
                        {r.etat === 'en_attente' && (
                          <button onClick={() => confirmerReservation(r.id)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                            Confirmer
                          </button>
                        )}
                        {r.etat !== 'annulee' && (
                          <button onClick={() => annulerReservation(r.id)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 10, background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              }
              {reservations.filter(r => r.date >= dateVersStr(new Date()) && r.etat !== 'annulee').length === 0 && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 40, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 13 }}>
                  Aucune reservation a venir
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab: Espaces ─────────────────────────────────────────────────────── */}
      {tab === 'espaces' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNouvelEspace(true)} style={btnPrimary}>
              + Ajouter un espace
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {espaces.map(e => {
              const cfg = TYPE_ESPACE_CONFIG[e.type]
              const etatCfg = ETAT_ESPACE_CONFIG[e.etat]
              const nbReservations = reservations.filter(r => r.espaceId === e.id && r.etat !== 'annulee').length
              return (
                <div key={e.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Photo placeholder */}
                  <div style={{
                    height: 120,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${cfg.couleurBg}, rgba(13,27,46,0.04))`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                  }}>
                    {cfg.emoji}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{e.nom}</div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{cfg.label}</div>
                    </div>
                    <span
                      onClick={() => changerEtatEspace(e.id)}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 5,
                        background: etatCfg.bg,
                        color: etatCfg.couleur,
                        cursor: 'pointer',
                      }}
                    >
                      {etatCfg.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Capacite :</span> {e.capacite} {e.type === 'parking_visiteurs' ? 'places' : 'personnes'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Horaires :</span> {e.horaireOuverture}-{e.horaireFermeture}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                      <span style={{ fontWeight: 600 }}>Reservations :</span> {nbReservations} au total
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => { setREspaceId(e.id); setShowNouvelleReservation(true) }}
                      style={{ ...btnSecondary, flex: 1, textAlign: 'center', padding: '8px 12px', fontSize: 12 }}
                    >
                      Reserver
                    </button>
                    <button
                      onClick={() => supprimerEspace(e.id)}
                      style={{ ...btnSecondary, padding: '8px 12px', fontSize: 12, background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {espaces.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Aucun espace configure. Ajoutez le premier espace commun.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Regles ──────────────────────────────────────────────────────── */}
      {tab === 'regles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {espaces.map(e => {
            const cfg = TYPE_ESPACE_CONFIG[e.type]
            const regle = regles.find(r => r.espaceId === e.id)
            if (!regle) return null
            const enEdition = regleEditId === e.id

            return (
              <div key={e.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: cfg.couleurBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {cfg.emoji}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{e.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{cfg.label}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setRegleEditId(enEdition ? null : e.id)}
                    style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }}
                  >
                    {enEdition ? 'Fermer' : 'Modifier'}
                  </button>
                </div>

                {!enEdition ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    <RegleChampsAffichage label="Horaires autorises" valeur={`${regle.horaireAutoriseDe} - ${regle.horaireAutoriseA}`} />
                    <RegleChampsAffichage label="Duree maximale" valeur={`${regle.dureeMaxHeures} heures`} />
                    <RegleChampsAffichage label="Preavis minimum" valeur={`${regle.preavisMinJours} jours`} />
                    <RegleChampsAffichage label="Preavis maximum" valeur={`${regle.preavisMaxJours} jours`} />
                    <RegleChampsAffichage label="Caution / Depot" valeur={regle.cautionMontant > 0 ? `${fmtPrix(regle.cautionMontant)} EUR` : 'Pas de caution'} />
                    <RegleChampsAffichage label="Nettoyage obligatoire" valeur={regle.nettoyageObligatoire ? 'Oui' : 'Non'} />
                    <RegleChampsAffichage label="Limite reservations / lot / mois" valeur={`${regle.limiteReservationsParLotMois} par lot`} />
                    <RegleChampsAffichage label="Conditions d'annulation" valeur={`Jusqu'a ${regle.annulationHeuresAvant}h avant`} />
                    <RegleChampsAffichage label="Nuisances sonores" valeur={regle.nuisancesSonoresRappel ? 'Rappel actif (reglement copropriete)' : 'Aucun rappel'} />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Horaire debut autorise</label>
                      <input type="time" value={regle.horaireAutoriseDe} onChange={ev => mettreAJourRegle(e.id, 'horaireAutoriseDe', ev.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Horaire fin autorise</label>
                      <input type="time" value={regle.horaireAutoriseA} onChange={ev => mettreAJourRegle(e.id, 'horaireAutoriseA', ev.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Duree maximale (heures)</label>
                      <input type="number" min={1} max={24} value={regle.dureeMaxHeures} onChange={ev => mettreAJourRegle(e.id, 'dureeMaxHeures', parseInt(ev.target.value) || 1)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Preavis minimum (jours)</label>
                      <input type="number" min={0} max={90} value={regle.preavisMinJours} onChange={ev => mettreAJourRegle(e.id, 'preavisMinJours', parseInt(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Preavis maximum (jours)</label>
                      <input type="number" min={1} max={365} value={regle.preavisMaxJours} onChange={ev => mettreAJourRegle(e.id, 'preavisMaxJours', parseInt(ev.target.value) || 60)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Caution / Depot (EUR)</label>
                      <input type="number" min={0} step={5} value={regle.cautionMontant} onChange={ev => mettreAJourRegle(e.id, 'cautionMontant', parseFloat(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Nettoyage obligatoire</label>
                      <select value={regle.nettoyageObligatoire ? 'oui' : 'non'} onChange={ev => mettreAJourRegle(e.id, 'nettoyageObligatoire', ev.target.value === 'oui')} style={inputStyle}>
                        <option value="oui">Oui</option>
                        <option value="non">Non</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Limite reservations / mois / lot</label>
                      <input type="number" min={1} max={31} value={regle.limiteReservationsParLotMois} onChange={ev => mettreAJourRegle(e.id, 'limiteReservationsParLotMois', parseInt(ev.target.value) || 1)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Annulation (heures avant)</label>
                      <input type="number" min={0} max={168} value={regle.annulationHeuresAvant} onChange={ev => mettreAJourRegle(e.id, 'annulationHeuresAvant', parseInt(ev.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Rappel nuisances sonores</label>
                      <select value={regle.nuisancesSonoresRappel ? 'oui' : 'non'} onChange={ev => mettreAJourRegle(e.id, 'nuisancesSonoresRappel', ev.target.value === 'oui')} style={inputStyle}>
                        <option value="oui">Oui (rappel reglement copropriete)</option>
                        <option value="non">Non</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {espaces.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 14 }}>
              Ajoutez des espaces d&apos;abord pour configurer les regles.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Statistiques ────────────────────────────────────────────────── */}
      {tab === 'statistiques' && (
        <div>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCardFR emoji="📅" label="Reservations ce mois" valeur={stats.totalReservationsMois} />
            <StatCardFR emoji="🏆" label="Espace le plus utilise" valeur={stats.espacePlusUtilise ? stats.espacePlusUtilise[0] : 'N/A'} sous={stats.espacePlusUtilise ? `${stats.espacePlusUtilise[1]} reservations` : undefined} />
            <StatCardFR emoji="📊" label="Taux d'occupation" valeur={`${stats.tauxOccupation}%`} />
            <StatCardFR emoji="💰" label="Revenus cautions" valeur={`${fmtPrix(stats.recetteCautions)} EUR`} sous={stats.cautionsEnAttente > 0 ? `${stats.cautionsEnAttente} en attente` : undefined} />
          </div>

          {/* Utilisation par espace */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Utilisation par espace (ce mois)
            </h3>
            {stats.occupationParEspace.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.occupationParEspace.sort((a, b) => b.reservations - a.reservations).map(item => {
                  const cfg = TYPE_ESPACE_CONFIG[item.type]
                  const maxRes = Math.max(...stats.occupationParEspace.map(o => o.reservations), 1)
                  return (
                    <div key={item.nom} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{cfg?.emoji}</div>
                      <div style={{ width: 160, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, flexShrink: 0 }}>
                        {item.nom}
                      </div>
                      <div style={{ flex: 1, height: 24, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${(item.reservations / maxRes) * 100}%`,
                          height: '100%',
                          background: cfg?.couleur || 'var(--sd-navy, #0D1B2E)',
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
                          minWidth: item.reservations > 0 ? 24 : 0,
                        }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: item.reservations / maxRes > 0.6 ? '#fff' : 'var(--sd-navy, #0D1B2E)' }}>
                          {item.reservations} res. ({item.taux}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12 }}>
                Aucune donnee de reservation ce mois
              </div>
            )}
          </div>

          {/* Reservations par type d'espace - CSS bar chart */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Reservations par type d&apos;espace (ce mois)
            </h3>
            {Object.entries(stats.parType).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const maxVal = Math.max(...Object.values(stats.parType).map(v => v.count), 1)
                  return Object.entries(stats.parType).sort((a, b) => b[1].count - a[1].count).map(([label, { count, couleur }]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 140, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 500, flexShrink: 0, textAlign: 'right' }}>
                        {label}
                      </div>
                      <div style={{ flex: 1, height: 24, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${(count / maxVal) * 100}%`,
                          height: '100%',
                          background: couleur,
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
                          minWidth: 24,
                        }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: count / maxVal > 0.6 ? '#fff' : 'var(--sd-navy, #0D1B2E)' }}>
                          {count}
                        </span>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12 }}>
                Aucune donnee de reservation ce mois
              </div>
            )}
          </div>

          {/* Top 5 lots */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Top 5 lots les plus reservants
            </h3>
            {stats.topLots.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.topLots.map(([lot, count], idx) => {
                  const maxVal = stats.topLots[0][1] as number
                  const medailles = ['🥇', '🥈', '🥉', '4.', '5.']
                  return (
                    <div key={lot} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{medailles[idx]}</span>
                      <div style={{ width: 70, fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                        Lot {lot}
                      </div>
                      <div style={{ flex: 1, height: 22, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${((count as number) / maxVal) * 100}%`,
                          height: '100%',
                          background: idx === 0 ? 'var(--sd-gold, #C9A84C)' : idx === 1 ? 'rgba(201,168,76,0.6)' : 'rgba(201,168,76,0.35)',
                          borderRadius: 6,
                          transition: 'width 0.5s ease',
                          minWidth: 20,
                        }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {count} reservations
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 12 }}>
                Aucune donnee de lots
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: Nouvel Espace ─────────────────────────────────────────────── */}
      {showNouvelEspace && (
        <div style={overlayStyle} onClick={() => setShowNouvelEspace(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 20 }}>
              Nouvel espace commun
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom de l&apos;espace</label>
                <input value={fNom} onChange={e => setFNom(e.target.value)} placeholder="Ex : Salle des fetes Bat. A" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={fType} onChange={e => setFType(e.target.value as TypeEspace)} style={inputStyle}>
                  {Object.entries(TYPE_ESPACE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Capacite</label>
                  <input type="number" min={1} value={fCapacite} onChange={e => setFCapacite(e.target.value)} placeholder="20" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ouverture</label>
                  <input type="time" value={fHoraireOuverture} onChange={e => setFHoraireOuverture(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fermeture</label>
                  <input type="time" value={fHoraireFermeture} onChange={e => setFHoraireFermeture(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNouvelEspace(false)} style={btnSecondary}>Annuler</button>
              <button onClick={creerEspace} style={btnPrimary}>Creer l&apos;espace</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Nouvelle Reservation ──────────────────────────────────────── */}
      {showNouvelleReservation && (
        <div style={overlayStyle} onClick={() => { setShowNouvelleReservation(false); setReservationDatePrefill('') }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 20 }}>
              Nouvelle reservation
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Espace</label>
                <select value={rEspaceId} onChange={e => setREspaceId(e.target.value)} style={inputStyle}>
                  <option value="">-- Selectionner un espace --</option>
                  {espaces.filter(e => e.etat !== 'maintenance').map(e => {
                    const cfg = TYPE_ESPACE_CONFIG[e.type]
                    return <option key={e.id} value={e.id}>{cfg.emoji} {e.nom}</option>
                  })}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Nom du resident</label>
                  <input value={rNom} onChange={e => setRNom(e.target.value)} placeholder="Ex : Jean Dupont" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Lot</label>
                  <input value={rLot} onChange={e => setRLot(e.target.value)} placeholder="Ex : A05" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={rDate || reservationDatePrefill} onChange={e => setRDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Heure de debut</label>
                  <input type="time" value={rHeureDebut} onChange={e => setRHeureDebut(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Heure de fin</label>
                  <input type="time" value={rHeureFin} onChange={e => setRHeureFin(e.target.value)} style={inputStyle} />
                </div>
              </div>
              {rEspaceId && (() => {
                const regle = regles.find(r => r.espaceId === rEspaceId)
                if (!regle) return null
                return (
                  <div style={{ padding: 12, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--sd-navy, #0D1B2E)' }}>Regles de cet espace :</div>
                    <div>Horaires : {regle.horaireAutoriseDe} - {regle.horaireAutoriseA}</div>
                    <div>Duree max : {regle.dureeMaxHeures}h | Limite : {regle.limiteReservationsParLotMois}/mois/lot</div>
                    {regle.cautionMontant > 0 && <div>Caution : {fmtPrix(regle.cautionMontant)} EUR</div>}
                    {regle.nettoyageObligatoire && <div style={{ color: '#F97316', fontWeight: 500 }}>Nettoyage obligatoire apres utilisation</div>}
                    {regle.nuisancesSonoresRappel && <div style={{ color: '#8B5CF6', fontWeight: 500 }}>Rappel : respect du reglement copropriete (nuisances sonores)</div>}
                  </div>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNouvelleReservation(false); setReservationDatePrefill('') }} style={btnSecondary}>Annuler</button>
              <button onClick={creerReservation} style={btnPrimary}>Creer la reservation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function RegleChampsAffichage({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{valeur}</div>
    </div>
  )
}

function StatCardFR({ emoji, label, valeur, sous }: { emoji: string; label: string; valeur: string | number; sous?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
      <div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{valeur}</div>
        <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 400, marginTop: 4 }}>{label}</div>
        {sous && <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{sous}</div>}
      </div>
    </div>
  )
}
