'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EtatDemande = 'recue' | 'en_cours' | 'acceptee' | 'refusee' | 'installation' | 'terminee'
type TypeDemande = 'individuel' | 'collectif'
type TypeBorne = 'wallbox' | 'prise_renforcee' | 'borne_rapide'
type EtatBorne = 'active' | 'en_maintenance' | 'hors_service'
type TypeInfra = 'individuelle' | 'collective'

interface DemandeIRVE {
  id: string
  coproprietaire: string
  email?: string
  lot: string
  dateDemande: string
  dateEcheance: string         // +3 mois (ordonnance 2020-71)
  type: TypeDemande
  puissanceSouhaitee: number   // kW
  emplacement: string
  etat: EtatDemande
  motifRefus?: 'impossibilite_technique' | 'solution_collective_existante' | 'projet_collectif_en_cours'
  justificationRefus?: string
  dateDecision?: string
  dateInstallation?: string
  observations?: string
  createdAt: string
}

interface BorneInstallee {
  id: string
  immeubleNom: string
  emplacementParking: string
  type: TypeBorne
  puissanceKw: number
  proprietaire: string
  typeInfra: TypeInfra
  dateInstallation: string
  compteurIndividuel: boolean
  etat: EtatBorne
  pilotageEnergetique: boolean
  observations?: string
}

interface FAQItem {
  question: string
  reponse: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ETAT_DEMANDE_CONFIG: Record<EtatDemande, { label: string; bg: string; color: string; dot: string }> = {
  recue:        { label: 'Demande reçue',     bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  en_cours:     { label: 'En cours d\'examen', bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  acceptee:     { label: 'Acceptée',           bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  refusee:      { label: 'Refusée',            bg: '#FDECEA', color: '#C0392B', dot: '#C0392B' },
  installation: { label: 'Installation',       bg: '#E8F0FE', color: '#1967D2', dot: '#1967D2' },
  terminee:     { label: 'Terminée',           bg: '#F7F4EE', color: '#0D1B2E', dot: '#0D1B2E' },
}

const TYPE_DEMANDE_LABELS: Record<TypeDemande, string> = {
  individuel: 'Individuel',
  collectif:  'Collectif',
}

const TYPE_BORNE_CONFIG: Record<TypeBorne, { label: string; icon: string }> = {
  wallbox:          { label: 'Wallbox',            icon: '🔌' },
  prise_renforcee:  { label: 'Prise renforcée',   icon: '🔋' },
  borne_rapide:     { label: 'Borne rapide (DC)',  icon: '⚡' },
}

const ETAT_BORNE_CONFIG: Record<EtatBorne, { label: string; bg: string; color: string }> = {
  active:          { label: 'Active',          bg: '#E6F4F2', color: '#1A7A6E' },
  en_maintenance:  { label: 'En maintenance',  bg: '#FEF5E4', color: '#D4830A' },
  hors_service:    { label: 'Hors service',    bg: '#FDECEA', color: '#C0392B' },
}

const MOTIFS_OPPOSITION: Record<string, string> = {
  impossibilite_technique:       'Impossibilité technique sérieuse',
  solution_collective_existante: 'Solution collective existante ou décidée',
  projet_collectif_en_cours:     'Projet collectif de recharge en cours',
}

const TIMELINE_STEPS = [
  { key: 'recue',        label: 'Demande reçue',              desc: 'Réception de la demande du copropriétaire' },
  { key: 'delai',        label: 'Délai réponse 3 mois',       desc: 'Ordonnance 2020-71, décret 2020-1720' },
  { key: 'decision',     label: 'Décision syndic',            desc: 'Acceptation ou refus motivé' },
  { key: 'installation', label: 'Installation',               desc: 'Mise en service de la borne' },
]

const REGLEMENTATION_CARDS = [
  {
    ref: 'Ordonnance n°2020-71',
    date: '29 janvier 2020',
    titre: 'Droit à la prise',
    description: 'Consacre le droit pour tout copropriétaire ou locataire de demander l\'installation d\'une borne de recharge sur sa place de parking, y compris en parties communes. Le syndic dispose d\'un délai de 3 mois pour s\'opposer, sur des motifs limités.',
    icon: '⚖️',
  },
  {
    ref: 'Décret n°2020-1720',
    date: '24 décembre 2020',
    titre: 'Modalités d\'application',
    description: 'Précise les conditions d\'exercice du droit à la prise : contenu de la demande, délai de réponse, motifs d\'opposition, convention de raccordement, et rôle du syndic et de l\'AG.',
    icon: '📋',
  },
  {
    ref: 'Loi LOM — Art. 64',
    date: 'Loi d\'orientation des mobilités',
    titre: 'Pré-équipement 20% des parkings',
    description: 'Les copropriétés réalisant des travaux sur leur parc de stationnement depuis le 1er janvier 2025 doivent pré-équiper au moins 20% des emplacements pour permettre l\'installation ultérieure de bornes de recharge.',
    icon: '🏗️',
  },
  {
    ref: 'Loi Climat — Art. 24 & 25',
    date: 'Loi Climat et Résilience',
    titre: 'Vote en AG simplifié',
    description: 'L\'étude technique pour l\'IRVE se vote à la majorité simple (art. 24). Les travaux d\'installation d\'infrastructure collective se votent à la majorité absolue (art. 25). Facilite l\'adoption en copropriété.',
    icon: '🗳️',
  },
  {
    ref: 'Copropriétés neuves (PC > 11/03/2021)',
    date: 'Depuis le 11 mars 2021',
    titre: 'Pré-équipement obligatoire',
    description: 'Pour tout permis de construire déposé après le 11 mars 2021, les copropriétés de plus de 10 places de stationnement doivent être pré-équipées en infrastructure de recharge dès la construction.',
    icon: '🏢',
  },
  {
    ref: 'Norme technique',
    date: 'Applicable',
    titre: 'Max 22 kW + pilotage énergétique',
    description: 'Chaque borne individuelle est limitée à 22 kW de puissance. Le pilotage énergétique est obligatoire pour éviter la surcharge du réseau électrique de l\'immeuble et optimiser la consommation.',
    icon: '⚡',
  },
]

const FAQ_DATA: FAQItem[] = [
  {
    question: 'Qu\'est-ce que le droit à la prise ?',
    reponse: 'Le droit à la prise permet à tout occupant (propriétaire ou locataire) d\'un immeuble collectif de demander l\'installation d\'une borne de recharge pour véhicule électrique sur sa place de parking, y compris lorsque celle-ci est en partie commune. Ce droit est encadré par l\'ordonnance n°2020-71.',
  },
  {
    question: 'Quel est le délai de réponse du syndic ?',
    reponse: 'Le syndic dispose d\'un délai de 3 mois à compter de la réception de la demande pour s\'y opposer. Passé ce délai, l\'absence de réponse vaut acceptation tacite. L\'opposition doit être motivée et relever de motifs limités définis par la loi.',
  },
  {
    question: 'Le syndic peut-il refuser la demande ?',
    reponse: 'L\'opposition n\'est possible que pour 3 motifs : (1) impossibilité technique sérieuse, (2) une solution collective de recharge existe déjà ou a été décidée, (3) un projet collectif de recharge est en cours. Tout autre motif de refus est irrecevable.',
  },
  {
    question: 'Qui paie l\'installation de la borne ?',
    reponse: 'Dans le cadre du droit à la prise, l\'ensemble des coûts (achat de la borne, installation, raccordement au réseau, compteur individuel) est à la charge du demandeur. La copropriété n\'a aucun coût à supporter, sauf si elle décide d\'une infrastructure collective.',
  },
  {
    question: 'Faut-il un vote en AG pour le droit à la prise ?',
    reponse: 'Non, le droit à la prise est un droit individuel qui ne nécessite pas de vote en AG. Cependant, la mise en place d\'une infrastructure collective (IRVE) nécessite un vote : majorité simple pour l\'étude technique, majorité absolue pour les travaux.',
  },
  {
    question: 'Qu\'est-ce qu\'un compteur individuel ?',
    reponse: 'Chaque borne individuelle doit être raccordée à un compteur dédié (ou sous-comptage) pour que le copropriétaire paie directement sa consommation électrique à son fournisseur d\'énergie, sans impact sur les charges communes.',
  },
  {
    question: 'Quelle puissance maximale est autorisée ?',
    reponse: 'La puissance maximale par borne est de 22 kW en courant alternatif (AC). Le pilotage énergétique est obligatoire pour réguler la charge en fonction de la capacité du réseau de l\'immeuble et éviter les dépassements.',
  },
  {
    question: 'Quelles aides financières existent ?',
    reponse: 'Plusieurs aides sont disponibles : la prime ADVENIR (jusqu\'à 50% HT pour l\'infrastructure collective), le crédit d\'impôt CIBRE (75% max 500€ pour les particuliers, jusqu\'au 31/12/2025), la TVA réduite à 5,5%, et des aides locales selon les collectivités.',
  },
]

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_DEMANDES: DemandeIRVE[] = [
  {
    id: 'dem-001',
    coproprietaire: 'Jean-Pierre Martin',
    email: 'jp.martin@email.fr',
    lot: 'Lot 12 — 3ème étage',
    dateDemande: '2026-02-01',
    dateEcheance: '2026-05-01',
    type: 'individuel',
    puissanceSouhaitee: 7.4,
    emplacement: 'Parking souterrain -1, place n°23',
    etat: 'en_cours',
    observations: 'Véhicule Tesla Model 3. Devis installateur fourni (Enedis).',
    createdAt: '2026-02-01T10:00:00Z',
  },
  {
    id: 'dem-002',
    coproprietaire: 'Marie Dupont',
    email: 'marie.dupont@email.fr',
    lot: 'Lot 5 — 1er étage',
    dateDemande: '2026-01-15',
    dateEcheance: '2026-04-15',
    type: 'individuel',
    puissanceSouhaitee: 11,
    emplacement: 'Parking souterrain -1, place n°8',
    etat: 'acceptee',
    dateDecision: '2026-02-28',
    observations: 'Capacité réseau vérifiée par EDF. Installation prévue mars 2026.',
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'dem-003',
    coproprietaire: 'Conseil syndical',
    lot: 'Infrastructure collective',
    dateDemande: '2026-03-01',
    dateEcheance: '2026-06-01',
    type: 'collectif',
    puissanceSouhaitee: 22,
    emplacement: 'Parking souterrain -2, zone commune',
    etat: 'recue',
    observations: 'Projet d\'installation de 6 bornes collectives pour les résidents. Étude technique à programmer.',
    createdAt: '2026-03-01T14:00:00Z',
  },
  {
    id: 'dem-004',
    coproprietaire: 'Laurent Moreau',
    lot: 'Lot 18 — 5ème étage',
    dateDemande: '2025-11-10',
    dateEcheance: '2026-02-10',
    type: 'individuel',
    puissanceSouhaitee: 7.4,
    emplacement: 'Parking extérieur, place n°42',
    etat: 'refusee',
    motifRefus: 'projet_collectif_en_cours',
    justificationRefus: 'Un projet collectif d\'infrastructure IRVE est en cours de vote en AG. L\'installation individuelle est reportée.',
    dateDecision: '2026-01-20',
    createdAt: '2025-11-10T11:00:00Z',
  },
]

const DEMO_BORNES: BorneInstallee[] = [
  {
    id: 'bor-001',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -1, place n°15',
    type: 'wallbox',
    puissanceKw: 7.4,
    proprietaire: 'Alain Bernard (Lot 7)',
    typeInfra: 'individuelle',
    dateInstallation: '2025-09-15',
    compteurIndividuel: true,
    etat: 'active',
    pilotageEnergetique: true,
  },
  {
    id: 'bor-002',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -1, place n°22',
    type: 'wallbox',
    puissanceKw: 11,
    proprietaire: 'Sophie Lefèvre (Lot 14)',
    typeInfra: 'individuelle',
    dateInstallation: '2025-11-20',
    compteurIndividuel: true,
    etat: 'active',
    pilotageEnergetique: true,
  },
  {
    id: 'bor-003',
    immeubleNom: 'Résidence Les Jardins de Provence',
    emplacementParking: 'Parking -2, zone commune A',
    type: 'borne_rapide',
    puissanceKw: 22,
    proprietaire: 'Copropriété (infrastructure collective)',
    typeInfra: 'collective',
    dateInstallation: '2025-06-10',
    compteurIndividuel: false,
    etat: 'en_maintenance',
    pilotageEnergetique: true,
    observations: 'Maintenance préventive prévue pour remplacement du module de pilotage.',
  },
  {
    id: 'bor-004',
    immeubleNom: 'Résidence Bellevue',
    emplacementParking: 'Parking extérieur, place n°3',
    type: 'prise_renforcee',
    puissanceKw: 3.7,
    proprietaire: 'François Garcia (Lot 2)',
    typeInfra: 'individuelle',
    dateInstallation: '2024-12-01',
    compteurIndividuel: true,
    etat: 'hors_service',
    pilotageEnergetique: false,
    observations: 'Défaillance électrique signalée. Intervention technicien prévue.',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const fmtDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR') } catch { return s }
}

const joursRestants = (dateStr: string): number => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

const addMonths = (dateStr: string, months: number): string => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const getTimelineStep = (d: DemandeIRVE): number => {
  switch (d.etat) {
    case 'recue': return 0
    case 'en_cours': return 1
    case 'acceptee': case 'refusee': return 2
    case 'installation': return 3
    case 'terminee': return 4
    default: return 0
  }
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function IRVESection({ user, userRole }: { user: any; userRole: string }) {
  type TabKey = 'demandes' | 'bornes' | 'reglementation' | 'aides'
  const [activeTab, setActiveTab] = useState<TabKey>('demandes')

  // ── Data
  const [demandes, setDemandes] = useState<DemandeIRVE[]>([])
  const [bornes, setBornes] = useState<BorneInstallee[]>([])

  // ── Modals / forms
  const [showNouvelleDemande, setShowNouvelleDemande] = useState(false)
  const [showNouvelleBorne, setShowNouvelleBorne] = useState(false)
  const [selectedDemande, setSelectedDemande] = useState<DemandeIRVE | null>(null)
  const [selectedBorne, setSelectedBorne] = useState<BorneInstallee | null>(null)
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  // ── Demande form
  const [fdNom, setFdNom] = useState('')
  const [fdEmail, setFdEmail] = useState('')
  const [fdLot, setFdLot] = useState('')
  const [fdDate, setFdDate] = useState('')
  const [fdType, setFdType] = useState<TypeDemande>('individuel')
  const [fdPuissance, setFdPuissance] = useState('')
  const [fdEmplacement, setFdEmplacement] = useState('')
  const [fdObs, setFdObs] = useState('')

  // ── Borne form
  const [fbImmeuble, setFbImmeuble] = useState('')
  const [fbEmplacement, setFbEmplacement] = useState('')
  const [fbType, setFbType] = useState<TypeBorne>('wallbox')
  const [fbPuissance, setFbPuissance] = useState('')
  const [fbProprietaire, setFbProprietaire] = useState('')
  const [fbTypeInfra, setFbTypeInfra] = useState<TypeInfra>('individuelle')
  const [fbDate, setFbDate] = useState('')
  const [fbCompteur, setFbCompteur] = useState(true)
  const [fbPilotage, setFbPilotage] = useState(true)

  // ── Refus form
  const [refusMotif, setRefusMotif] = useState<string>('')
  const [refusJustification, setRefusJustification] = useState('')

  // ── Simulateur aides
  const [simNbBornes, setSimNbBornes] = useState('')
  const [simCoutEstime, setSimCoutEstime] = useState('')
  const [simNbPlaces, setSimNbPlaces] = useState('')

  // ── Checklist aides
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({
    copropriete: false,
    parking: false,
    devis_installateur: false,
    installateur_irve: false,
    ag_vote: false,
    compteur_individuel: false,
    pilotage_energetique: false,
  })

  // ── Storage
  const STORAGE_KEY = `fixit_irve_fr_${user.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.demandes) setDemandes(data.demandes)
        if (data.bornes) setBornes(data.bornes)
      } else {
        setDemandes(DEMO_DEMANDES)
        setBornes(DEMO_BORNES)
      }
    } catch {
      setDemandes(DEMO_DEMANDES)
      setBornes(DEMO_BORNES)
    }
  }, [])

  useEffect(() => {
    if (demandes.length || bornes.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ demandes, bornes }))
    }
  }, [demandes, bornes])

  // ── Stats
  const stats = useMemo(() => {
    const totalDemandes = demandes.length
    const enAttente = demandes.filter(d => d.etat === 'recue' || d.etat === 'en_cours').length
    const acceptees = demandes.filter(d => d.etat === 'acceptee' || d.etat === 'installation' || d.etat === 'terminee').length
    const refusees = demandes.filter(d => d.etat === 'refusee').length
    const bornesActives = bornes.filter(b => b.etat === 'active').length
    const puissanceTotale = bornes.filter(b => b.etat === 'active').reduce((s, b) => s + b.puissanceKw, 0)
    const bornesCollectives = bornes.filter(b => b.typeInfra === 'collective').length
    const bornesIndividuelles = bornes.filter(b => b.typeInfra === 'individuelle').length

    // Deadline alerts
    const urgentes = demandes.filter(d => {
      if (d.etat !== 'recue' && d.etat !== 'en_cours') return false
      return joursRestants(d.dateEcheance) <= 15
    }).length

    return { totalDemandes, enAttente, acceptees, refusees, bornesActives, puissanceTotale, bornesCollectives, bornesIndividuelles, urgentes }
  }, [demandes, bornes])

  // ── CRUD Demandes
  const creerDemande = () => {
    if (!fdNom.trim() || !fdLot.trim()) return
    const dateD = fdDate || new Date().toISOString().split('T')[0]
    const nouvelle: DemandeIRVE = {
      id: crypto.randomUUID(),
      coproprietaire: fdNom.trim(),
      email: fdEmail.trim() || undefined,
      lot: fdLot.trim(),
      dateDemande: dateD,
      dateEcheance: addMonths(dateD, 3),
      type: fdType,
      puissanceSouhaitee: parseFloat(fdPuissance) || 7.4,
      emplacement: fdEmplacement.trim(),
      etat: 'recue',
      observations: fdObs.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    setDemandes(prev => [nouvelle, ...prev])
    resetDemandeForm()
    setShowNouvelleDemande(false)
  }

  const resetDemandeForm = () => {
    setFdNom(''); setFdEmail(''); setFdLot(''); setFdDate('')
    setFdType('individuel'); setFdPuissance(''); setFdEmplacement(''); setFdObs('')
  }

  const majEtatDemande = (id: string, nouvelEtat: EtatDemande, extra?: Partial<DemandeIRVE>) => {
    setDemandes(prev => prev.map(d =>
      d.id === id
        ? {
            ...d,
            etat: nouvelEtat,
            dateDecision: (nouvelEtat === 'acceptee' || nouvelEtat === 'refusee') ? new Date().toISOString().split('T')[0] : d.dateDecision,
            ...extra,
          }
        : d
    ))
  }

  const supprimerDemande = (id: string) => {
    setDemandes(prev => prev.filter(d => d.id !== id))
    if (selectedDemande?.id === id) setSelectedDemande(null)
  }

  // ── CRUD Bornes
  const creerBorne = () => {
    if (!fbImmeuble.trim() || !fbEmplacement.trim()) return
    const nouvelle: BorneInstallee = {
      id: crypto.randomUUID(),
      immeubleNom: fbImmeuble.trim(),
      emplacementParking: fbEmplacement.trim(),
      type: fbType,
      puissanceKw: Math.min(parseFloat(fbPuissance) || 7.4, 22),
      proprietaire: fbProprietaire.trim() || 'Copropriété',
      typeInfra: fbTypeInfra,
      dateInstallation: fbDate || new Date().toISOString().split('T')[0],
      compteurIndividuel: fbCompteur,
      etat: 'active',
      pilotageEnergetique: fbPilotage,
    }
    setBornes(prev => [nouvelle, ...prev])
    resetBorneForm()
    setShowNouvelleBorne(false)
  }

  const resetBorneForm = () => {
    setFbImmeuble(''); setFbEmplacement(''); setFbType('wallbox'); setFbPuissance('')
    setFbProprietaire(''); setFbTypeInfra('individuelle'); setFbDate(''); setFbCompteur(true); setFbPilotage(true)
  }

  const majEtatBorne = (id: string, nouvelEtat: EtatBorne) => {
    setBornes(prev => prev.map(b => b.id === id ? { ...b, etat: nouvelEtat } : b))
  }

  const supprimerBorne = (id: string) => {
    setBornes(prev => prev.filter(b => b.id !== id))
    if (selectedBorne?.id === id) setSelectedBorne(null)
  }

  // ── Simulateur
  const simulerAide = useMemo(() => {
    const nb = parseInt(simNbBornes) || 0
    const cout = parseFloat(simCoutEstime) || 0
    const places = parseInt(simNbPlaces) || 0
    if (!nb || !cout) return null

    const coutHT = cout / 1.055 // TVA 5.5% inversée
    const primeAdvenir = Math.min(coutHT * 0.50, places <= 100 ? 8000 : 15000)
    const tvaEconomisee = cout - (cout / 1.20 * 1.055) // Différence TVA 20% vs 5.5%
    const creditImpot = Math.min(cout * 0.75, nb * 500) // max 500€ par borne, fin 2025
    const totalAides = primeAdvenir + tvaEconomisee + creditImpot
    const resteACharge = Math.max(0, cout - totalAides)

    return { primeAdvenir, tvaEconomisee, creditImpot, totalAides, resteACharge, coutHT }
  }, [simNbBornes, simCoutEstime, simNbPlaces])

  // ─── Shared Styles ────────────────────────────────────────────────────────

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
    background: 'transparent',
    color: 'var(--sd-ink-2, #4A5E78)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--sd-cream, #F7F4EE)',
    color: 'var(--sd-navy, #0D1B2E)',
    outline: 'none',
    boxSizing: 'border-box',
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
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflow: 'auto',
    padding: 28,
    position: 'relative',
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'demandes',       label: 'Demandes droit à la prise', icon: '📋' },
    { key: 'bornes',         label: 'Bornes installées',         icon: '🔌' },
    { key: 'reglementation', label: 'Réglementation',            icon: '⚖️' },
    { key: 'aides',          label: 'Aides financières',         icon: '💰' },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
            ⚡ IRVE — Recharge Véhicules Électriques
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
            Infrastructure de recharge en copropriété · Ordonnance 2020-71 · Décret 2020-1720
          </p>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '📋', label: 'Demandes en attente', value: stats.enAttente, color: '#D4830A' },
          { icon: '✅', label: 'Acceptées', value: stats.acceptees, color: '#1A7A6E' },
          { icon: '❌', label: 'Refusées', value: stats.refusees, color: '#C0392B' },
          { icon: '🔌', label: 'Bornes actives', value: stats.bornesActives, color: 'var(--sd-navy, #0D1B2E)' },
          { icon: '⚡', label: 'Puissance totale', value: `${stats.puissanceTotale.toFixed(1)} kW`, color: '#6C5CE7' },
          { icon: '🚨', label: 'Échéances proches', value: stats.urgentes, color: stats.urgentes > 0 ? '#C0392B' : '#1A7A6E' },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: 14 }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — DEMANDES DROIT À LA PRISE                                      */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'demandes' && (
        <div>
          {/* Alerte échéances */}
          {stats.urgentes > 0 && (
            <div style={{ background: '#FEF5E4', border: '1px solid #F0B429', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#D4830A' }}>
                  {stats.urgentes} demande{stats.urgentes > 1 ? 's' : ''} avec échéance dans moins de 15 jours
                </div>
                <div style={{ fontSize: 12, color: '#8B6914', marginTop: 2 }}>
                  Le délai légal de réponse est de 3 mois. L'absence de réponse vaut acceptation tacite.
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNouvelleDemande(true)} style={btnPrimary}>
              + Nouvelle demande
            </button>
          </div>

          {/* Demandes list */}
          {demandes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Aucune demande de droit à la prise</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Les copropriétaires peuvent demander l'installation d'une borne de recharge (ordonnance 2020-71)</p>
              <button onClick={() => setShowNouvelleDemande(true)} style={{ ...btnPrimary, marginTop: 16 }}>
                + Enregistrer une demande
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {demandes.map(d => {
                const cfg = ETAT_DEMANDE_CONFIG[d.etat]
                const jours = joursRestants(d.dateEcheance)
                const step = getTimelineStep(d)

                return (
                  <div
                    key={d.id}
                    style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onClick={() => setSelectedDemande(d)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{d.coproprietaire}</span>
                          <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                            {cfg.label}
                          </span>
                          <span style={{ fontSize: 11, background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #4A5E78)', padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                            {TYPE_DEMANDE_LABELS[d.type]}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginTop: 6 }}>
                          {d.lot} · {d.emplacement} · {d.puissanceSouhaitee} kW
                        </div>

                        {/* Mini timeline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
                          {TIMELINE_STEPS.map((ts, i) => (
                            <React.Fragment key={ts.key}>
                              <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: i <= step ? (d.etat === 'refusee' && i === 2 ? '#C0392B' : '#1A7A6E') : '#E4DDD0',
                              }} />
                              {i < TIMELINE_STEPS.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: i < step ? '#1A7A6E' : '#E4DDD0', maxWidth: 40 }} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', flexWrap: 'wrap' }}>
                          <span>Demande : <strong>{fmtDateShort(d.dateDemande)}</strong></span>
                          {(d.etat === 'recue' || d.etat === 'en_cours') && (
                            <span>Échéance : <strong style={{ color: jours <= 7 ? '#C0392B' : jours <= 15 ? '#D4830A' : '#1A7A6E' }}>
                              {jours > 0 ? `${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}` : 'Dépassée !'}
                            </strong></span>
                          )}
                          {d.dateDecision && <span>Décision : <strong>{fmtDateShort(d.dateDecision)}</strong></span>}
                        </div>
                      </div>

                      {/* Right: quick actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(d.etat === 'recue' || d.etat === 'en_cours') && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); majEtatDemande(d.id, 'en_cours') }}
                              style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px' }}
                            >
                              Instruire
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); majEtatDemande(d.id, 'acceptee') }}
                              style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1A7A6E', borderColor: '#1A7A6E' }}
                            >
                              Accepter
                            </button>
                          </>
                        )}
                        {d.etat === 'acceptee' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); majEtatDemande(d.id, 'installation') }}
                            style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1967D2', borderColor: '#1967D2' }}
                          >
                            Installation
                          </button>
                        )}
                        {d.etat === 'installation' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); majEtatDemande(d.id, 'terminee') }}
                            style={{ ...btnSecondary, fontSize: 11, padding: '4px 10px', color: '#1A7A6E', borderColor: '#1A7A6E' }}
                          >
                            Terminée
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Modal nouvelle demande ─────────────────────────────────────── */}
          {showNouvelleDemande && (
            <div style={overlayStyle} onClick={() => setShowNouvelleDemande(false)}>
              <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 20px' }}>
                  Nouvelle demande de droit à la prise
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Copropriétaire *</label>
                    <input style={inputStyle} value={fdNom} onChange={e => setFdNom(e.target.value)} placeholder="Nom complet" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} type="email" value={fdEmail} onChange={e => setFdEmail(e.target.value)} placeholder="email@exemple.fr" />
                  </div>
                  <div>
                    <label style={labelStyle}>Lot *</label>
                    <input style={inputStyle} value={fdLot} onChange={e => setFdLot(e.target.value)} placeholder="Lot 12 — 3ème étage" />
                  </div>
                  <div>
                    <label style={labelStyle}>Date de la demande</label>
                    <input style={inputStyle} type="date" value={fdDate} onChange={e => setFdDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select style={inputStyle} value={fdType} onChange={e => setFdType(e.target.value as TypeDemande)}>
                      <option value="individuel">Individuel</option>
                      <option value="collectif">Collectif</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Puissance souhaitée (kW)</label>
                    <input style={inputStyle} type="number" step="0.1" max="22" value={fdPuissance} onChange={e => setFdPuissance(e.target.value)} placeholder="7.4" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Emplacement parking</label>
                    <input style={inputStyle} value={fdEmplacement} onChange={e => setFdEmplacement(e.target.value)} placeholder="Parking souterrain -1, place n°23" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Observations</label>
                    <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={fdObs} onChange={e => setFdObs(e.target.value)} placeholder="Notes, devis, véhicule..." />
                  </div>
                </div>

                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginTop: 16, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                  <strong>Rappel :</strong> Le délai de réponse est de 3 mois (ordonnance 2020-71). L'échéance sera calculée automatiquement.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setShowNouvelleDemande(false)} style={btnSecondary}>Annuler</button>
                  <button onClick={creerDemande} style={btnPrimary}>Enregistrer la demande</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal détail demande ───────────────────────────────────────── */}
          {selectedDemande && (
            <div style={overlayStyle} onClick={() => setSelectedDemande(null)}>
              <div style={{ ...modalStyle, maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 6px' }}>
                  Demande — {selectedDemande.coproprietaire}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 12, background: ETAT_DEMANDE_CONFIG[selectedDemande.etat].bg, color: ETAT_DEMANDE_CONFIG[selectedDemande.etat].color, padding: '2px 10px', borderRadius: 5, fontWeight: 600 }}>
                    {ETAT_DEMANDE_CONFIG[selectedDemande.etat].label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                    {TYPE_DEMANDE_LABELS[selectedDemande.type]}
                  </span>
                </div>

                {/* Timeline */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Progression</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {TIMELINE_STEPS.map((ts, i) => {
                      const step = getTimelineStep(selectedDemande)
                      const active = i <= step
                      const isRefused = selectedDemande.etat === 'refusee' && i === 2
                      return (
                        <div key={ts.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%', border: '2px solid',
                              borderColor: active ? (isRefused ? '#C0392B' : '#1A7A6E') : '#E4DDD0',
                              background: active ? (isRefused ? '#C0392B' : '#1A7A6E') : '#fff',
                            }} />
                            {i < TIMELINE_STEPS.length - 1 && (
                              <div style={{ width: 2, height: 30, background: i < step ? '#1A7A6E' : '#E4DDD0' }} />
                            )}
                          </div>
                          <div style={{ paddingBottom: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: active ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8A9BB0)' }}>{ts.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{ts.desc}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Infos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Lot', value: selectedDemande.lot },
                    { label: 'Emplacement', value: selectedDemande.emplacement },
                    { label: 'Puissance', value: `${selectedDemande.puissanceSouhaitee} kW` },
                    { label: 'Date demande', value: fmtDate(selectedDemande.dateDemande) },
                    { label: 'Échéance 3 mois', value: fmtDate(selectedDemande.dateEcheance) },
                    { label: 'Jours restants', value: (() => { const j = joursRestants(selectedDemande.dateEcheance); return j > 0 ? `${j} jours` : 'Échéance dépassée' })() },
                  ].map((info, i) => (
                    <div key={i} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{info.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{info.value}</div>
                    </div>
                  ))}
                </div>

                {selectedDemande.observations && (
                  <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                    <strong>Observations :</strong> {selectedDemande.observations}
                  </div>
                )}

                {selectedDemande.motifRefus && (
                  <div style={{ background: '#FDECEA', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#C0392B' }}>
                    <strong>Motif de refus :</strong> {MOTIFS_OPPOSITION[selectedDemande.motifRefus]}
                    {selectedDemande.justificationRefus && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>{selectedDemande.justificationRefus}</div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {(selectedDemande.etat === 'recue' || selectedDemande.etat === 'en_cours') && (
                  <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 16, marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Actions</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <button onClick={() => { majEtatDemande(selectedDemande.id, 'acceptee'); setSelectedDemande(null) }} style={{ ...btnPrimary, background: '#1A7A6E' }}>
                        Accepter la demande
                      </button>
                      <button onClick={() => { majEtatDemande(selectedDemande.id, 'en_cours'); setSelectedDemande(null) }} style={btnSecondary}>
                        Instruire le dossier
                      </button>
                    </div>

                    {/* Refus */}
                    <div style={{ background: '#FDECEA', borderRadius: 10, padding: 14, marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', marginBottom: 8 }}>Refuser (motif obligatoire)</div>
                      <select
                        style={{ ...inputStyle, background: '#fff', marginBottom: 8 }}
                        value={refusMotif}
                        onChange={e => setRefusMotif(e.target.value)}
                      >
                        <option value="">Sélectionner un motif d'opposition...</option>
                        {Object.entries(MOTIFS_OPPOSITION).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <textarea
                        style={{ ...inputStyle, background: '#fff', minHeight: 60, resize: 'vertical' }}
                        value={refusJustification}
                        onChange={e => setRefusJustification(e.target.value)}
                        placeholder="Justification détaillée du refus..."
                      />
                      <button
                        onClick={() => {
                          if (!refusMotif) return
                          majEtatDemande(selectedDemande.id, 'refusee', {
                            motifRefus: refusMotif as DemandeIRVE['motifRefus'],
                            justificationRefus: refusJustification.trim() || undefined,
                          })
                          setRefusMotif('')
                          setRefusJustification('')
                          setSelectedDemande(null)
                        }}
                        disabled={!refusMotif}
                        style={{ ...btnSecondary, marginTop: 8, color: '#C0392B', borderColor: '#C0392B', opacity: refusMotif ? 1 : 0.5 }}
                      >
                        Refuser la demande
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <button onClick={() => { supprimerDemande(selectedDemande.id); setSelectedDemande(null) }} style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B', fontSize: 11 }}>
                    Supprimer
                  </button>
                  <button onClick={() => setSelectedDemande(null)} style={btnSecondary}>Fermer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — BORNES INSTALLÉES                                              */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bornes' && (
        <div>
          {/* Résumé infra */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Infrastructure individuelle</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-navy, #0D1B2E)' }}>{stats.bornesIndividuelles}</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>borne{stats.bornesIndividuelles > 1 ? 's' : ''} privée{stats.bornesIndividuelles > 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Infrastructure collective</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'var(--sd-gold, #C9A84C)' }}>{stats.bornesCollectives}</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>borne{stats.bornesCollectives > 1 ? 's' : ''} partagée{stats.bornesCollectives > 1 ? 's' : ''}</div>
            </div>
            <div style={{ ...cardStyle, flex: 1, minWidth: 180, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Puissance installée</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: '#6C5CE7' }}>{bornes.reduce((s, b) => s + b.puissanceKw, 0).toFixed(1)} kW</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>max 22 kW / borne</div>
            </div>
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNouvelleBorne(true)} style={btnPrimary}>
              + Ajouter une borne
            </button>
          </div>

          {/* Bornes list */}
          {bornes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Aucune borne installée</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Enregistrez les bornes de recharge installées dans vos copropriétés</p>
              <button onClick={() => setShowNouvelleBorne(true)} style={{ ...btnPrimary, marginTop: 16 }}>
                + Ajouter une borne
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {bornes.map(b => {
                const typeCfg = TYPE_BORNE_CONFIG[b.type]
                const etatCfg = ETAT_BORNE_CONFIG[b.etat]

                return (
                  <div
                    key={b.id}
                    style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onClick={() => setSelectedBorne(b)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{typeCfg.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{typeCfg.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{b.puissanceKw} kW</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: etatCfg.bg, color: etatCfg.color, padding: '2px 8px', borderRadius: 5, fontWeight: 600 }}>
                        {etatCfg.label}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 4 }}>
                      {b.immeubleNom}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 8 }}>
                      {b.emplacementParking}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, background: b.typeInfra === 'collective' ? '#EDE8FF' : 'var(--sd-cream, #F7F4EE)', color: b.typeInfra === 'collective' ? '#6C5CE7' : 'var(--sd-ink-2, #4A5E78)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {b.typeInfra === 'collective' ? 'Collective' : 'Individuelle'}
                      </span>
                      {b.compteurIndividuel && (
                        <span style={{ fontSize: 10, background: '#E6F4F2', color: '#1A7A6E', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          Compteur individuel
                        </span>
                      )}
                      {b.pilotageEnergetique && (
                        <span style={{ fontSize: 10, background: '#E8F0FE', color: '#1967D2', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          Pilotage énergétique
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 8 }}>
                      Propriétaire : {b.proprietaire} · Installée le {fmtDateShort(b.dateInstallation)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Modal nouvelle borne ──────────────────────────────────────── */}
          {showNouvelleBorne && (
            <div style={overlayStyle} onClick={() => setShowNouvelleBorne(false)}>
              <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 20px' }}>
                  Ajouter une borne installée
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Immeuble *</label>
                    <input style={inputStyle} value={fbImmeuble} onChange={e => setFbImmeuble(e.target.value)} placeholder="Résidence Les Jardins" />
                  </div>
                  <div>
                    <label style={labelStyle}>Emplacement parking *</label>
                    <input style={inputStyle} value={fbEmplacement} onChange={e => setFbEmplacement(e.target.value)} placeholder="Parking -1, place n°15" />
                  </div>
                  <div>
                    <label style={labelStyle}>Type de borne</label>
                    <select style={inputStyle} value={fbType} onChange={e => setFbType(e.target.value as TypeBorne)}>
                      {Object.entries(TYPE_BORNE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Puissance (kW, max 22)</label>
                    <input style={inputStyle} type="number" step="0.1" max="22" value={fbPuissance} onChange={e => setFbPuissance(e.target.value)} placeholder="7.4" />
                  </div>
                  <div>
                    <label style={labelStyle}>Propriétaire</label>
                    <input style={inputStyle} value={fbProprietaire} onChange={e => setFbProprietaire(e.target.value)} placeholder="Nom du copropriétaire ou Copropriété" />
                  </div>
                  <div>
                    <label style={labelStyle}>Type d'infrastructure</label>
                    <select style={inputStyle} value={fbTypeInfra} onChange={e => setFbTypeInfra(e.target.value as TypeInfra)}>
                      <option value="individuelle">Individuelle</option>
                      <option value="collective">Collective</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Date d'installation</label>
                    <input style={inputStyle} type="date" value={fbDate} onChange={e => setFbDate(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fbCompteur} onChange={e => setFbCompteur(e.target.checked)} />
                      Compteur individuel
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={fbPilotage} onChange={e => setFbPilotage(e.target.checked)} />
                      Pilotage énergétique
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setShowNouvelleBorne(false)} style={btnSecondary}>Annuler</button>
                  <button onClick={creerBorne} style={btnPrimary}>Ajouter la borne</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Modal détail borne ────────────────────────────────────────── */}
          {selectedBorne && (
            <div style={overlayStyle} onClick={() => setSelectedBorne(null)}>
              <div style={{ ...modalStyle, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>{TYPE_BORNE_CONFIG[selectedBorne.type].icon}</span>
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                      {TYPE_BORNE_CONFIG[selectedBorne.type].label} — {selectedBorne.puissanceKw} kW
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{selectedBorne.immeubleNom}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Emplacement', value: selectedBorne.emplacementParking },
                    { label: 'Propriétaire', value: selectedBorne.proprietaire },
                    { label: 'Infrastructure', value: selectedBorne.typeInfra === 'collective' ? 'Collective' : 'Individuelle' },
                    { label: 'Installation', value: fmtDate(selectedBorne.dateInstallation) },
                    { label: 'Compteur individuel', value: selectedBorne.compteurIndividuel ? 'Oui' : 'Non' },
                    { label: 'Pilotage énergétique', value: selectedBorne.pilotageEnergetique ? 'Actif' : 'Inactif' },
                  ].map((info, i) => (
                    <div key={i} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>{info.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{info.value}</div>
                    </div>
                  ))}
                </div>

                {selectedBorne.observations && (
                  <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>
                    <strong>Observations :</strong> {selectedBorne.observations}
                  </div>
                )}

                {/* Changement d'état */}
                <div style={{ borderTop: '1px solid var(--sd-border, #E4DDD0)', paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>Changer l'état</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(Object.entries(ETAT_BORNE_CONFIG) as [EtatBorne, typeof ETAT_BORNE_CONFIG[EtatBorne]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => { majEtatBorne(selectedBorne.id, key); setSelectedBorne({ ...selectedBorne, etat: key }) }}
                        style={{
                          ...btnSecondary,
                          fontSize: 11,
                          padding: '4px 10px',
                          background: selectedBorne.etat === key ? cfg.bg : 'transparent',
                          color: cfg.color,
                          borderColor: cfg.color,
                          fontWeight: selectedBorne.etat === key ? 700 : 500,
                        }}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button onClick={() => { supprimerBorne(selectedBorne.id); setSelectedBorne(null) }} style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B', fontSize: 11 }}>
                    Supprimer
                  </button>
                  <button onClick={() => setSelectedBorne(null)} style={btnSecondary}>Fermer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — RÉGLEMENTATION                                                 */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reglementation' && (
        <div>
          {/* Cartes réglementaires */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, marginBottom: 30 }}>
            {REGLEMENTATION_CARDS.map((card, i) => (
              <div key={i} style={{ ...cardStyle, borderLeft: '4px solid var(--sd-gold, #C9A84C)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{card.titre}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>{card.ref}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic', marginBottom: 6 }}>{card.date}</div>
                <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5 }}>
                  {card.description}
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>
              Questions fréquentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FAQ_DATA.map((faq, i) => (
                <div key={i} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === i ? null : i)}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>{faq.question}</span>
                    <span style={{ fontSize: 18, color: 'var(--sd-ink-3, #8A9BB0)', transform: expandedFAQ === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      ▼
                    </span>
                  </button>
                  {expandedFAQ === i && (
                    <div style={{ padding: '0 18px 14px', fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6 }}>
                      {faq.reponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — AIDES FINANCIÈRES                                              */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'aides' && (
        <div>
          {/* Cartes aides */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 30 }}>
            {/* Prime ADVENIR */}
            <div style={{ ...cardStyle, borderTop: '4px solid #1A7A6E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>🏷️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Prime ADVENIR</div>
                  <div style={{ fontSize: 11, color: '#1A7A6E', fontWeight: 600 }}>Programme national · Prolongé jusqu'en 2027</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
                Prise en charge de 50% HT des coûts d'infrastructure collective de recharge en copropriété.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Plafond :</strong> 8 000 EUR pour les copropriétés de 100 places ou moins
                </div>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Plafond :</strong> 15 000 EUR pour les copropriétés de plus de 100 places
                </div>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Condition :</strong> Installateur qualifié IRVE obligatoire
                </div>
              </div>
            </div>

            {/* Crédit d'impôt CIBRE */}
            <div style={{ ...cardStyle, borderTop: '4px solid #6C5CE7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>💳</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Crédit d'impôt CIBRE</div>
                  <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600 }}>Particuliers · Jusqu'au 31/12/2025</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
                Crédit d'impôt couvrant 75% des coûts d'acquisition et d'installation d'une borne de recharge.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Montant max :</strong> 500 EUR par borne (par personne, par résidence)
                </div>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Condition :</strong> Résidence principale ou secondaire, installation par professionnel
                </div>
              </div>
            </div>

            {/* TVA réduite */}
            <div style={{ ...cardStyle, borderTop: '4px solid #D4830A' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>📉</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>TVA réduite 5,5%</div>
                  <div style={{ fontSize: 11, color: '#D4830A', fontWeight: 600 }}>Applicable sans limite de date</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
                TVA au taux réduit de 5,5% applicable au matériel et à la main d'oeuvre pour l'installation de bornes de recharge dans les logements de plus de 2 ans.
              </div>
              <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                <strong>Économie :</strong> 14,5 points de TVA par rapport au taux normal (20%)
              </div>
            </div>

            {/* Aides locales */}
            <div style={{ ...cardStyle, borderTop: '4px solid var(--sd-gold, #C9A84C)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>🏛️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Aides locales</div>
                  <div style={{ fontSize: 11, color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>Collectivités, métropoles, régions</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.5, marginBottom: 10 }}>
                De nombreuses collectivités territoriales proposent des aides complémentaires : subventions directes, accompagnement technique, ou aides au pré-équipement.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Exemples :</strong> Métropoles, départements, régions
                </div>
                <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 6, padding: 8, fontSize: 12 }}>
                  <strong>Conseil :</strong> Consulter votre ADIL ou l'espace info-énergie local
                </div>
              </div>
            </div>
          </div>

          {/* ── Checklist éligibilité ──────────────────────────────────────── */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
              Checklist d'éligibilité aux aides
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {[
                { key: 'copropriete', label: 'La copropriété est constituée (syndicat de copropriétaires)' },
                { key: 'parking', label: 'Parking couvert ou extérieur disponible' },
                { key: 'devis_installateur', label: 'Devis d\'un installateur qualifié IRVE obtenu' },
                { key: 'installateur_irve', label: 'L\'installateur est certifié IRVE (mention QUALIFELEC / AFNOR)' },
                { key: 'ag_vote', label: 'Vote en AG effectué (si infrastructure collective)' },
                { key: 'compteur_individuel', label: 'Compteur individuel ou sous-comptage prévu' },
                { key: 'pilotage_energetique', label: 'Système de pilotage énergétique intégré' },
              ].map(item => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: checklistItems[item.key] ? '#E6F4F2' : 'var(--sd-cream, #F7F4EE)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: checklistItems[item.key] ? '#1A7A6E' : 'var(--sd-ink-2, #4A5E78)',
                    transition: 'background 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checklistItems[item.key] || false}
                    onChange={e => setChecklistItems(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    style={{ marginTop: 2 }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            {Object.values(checklistItems).every(Boolean) && (
              <div style={{ background: '#E6F4F2', borderRadius: 8, padding: 12, marginTop: 14, fontSize: 13, color: '#1A7A6E', fontWeight: 600 }}>
                Tous les critères sont remplis ! Votre copropriété est éligible aux principales aides IRVE.
              </div>
            )}
          </div>

          {/* ── Simulateur d'aide ─────────────────────────────────────────── */}
          <div style={{ ...cardStyle, borderTop: '4px solid var(--sd-gold, #C9A84C)' }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 4px' }}>
              Simulateur d'aides IRVE
            </h3>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
              Estimation indicative des aides disponibles pour votre projet de recharge en copropriété
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Nombre de bornes</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={simNbBornes}
                  onChange={e => setSimNbBornes(e.target.value)}
                  placeholder="6"
                />
              </div>
              <div>
                <label style={labelStyle}>Coût total estimé TTC (EUR)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={simCoutEstime}
                  onChange={e => setSimCoutEstime(e.target.value)}
                  placeholder="15000"
                />
              </div>
              <div>
                <label style={labelStyle}>Nombre de places parking</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  value={simNbPlaces}
                  onChange={e => setSimNbPlaces(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            {simulerAide && (
              <div style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 14 }}>
                  Estimation des aides
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#1A7A6E', fontWeight: 600 }}>Prime ADVENIR (50% HT)</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#1A7A6E', marginTop: 4 }}>
                      {fmtEur(simulerAide.primeAdvenir)}
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600 }}>Crédit d'impôt CIBRE</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#6C5CE7', marginTop: 4 }}>
                      {fmtEur(simulerAide.creditImpot)}
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#D4830A', fontWeight: 600 }}>Économie TVA (5,5% vs 20%)</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#D4830A', marginTop: 4 }}>
                      {fmtEur(simulerAide.tvaEconomisee)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160, background: '#E6F4F2', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#1A7A6E', fontWeight: 700 }}>Total des aides estimées</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#1A7A6E', marginTop: 4 }}>
                      {fmtEur(simulerAide.totalAides)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160, background: '#fff', border: '2px solid var(--sd-navy, #0D1B2E)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--sd-navy, #0D1B2E)', fontWeight: 700 }}>Reste à charge estimé</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: 'var(--sd-navy, #0D1B2E)', marginTop: 4 }}>
                      {fmtEur(simulerAide.resteACharge)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic' }}>
                  * Estimation indicative basée sur les barèmes en vigueur. Le montant réel dépend de l'éligibilité effective et des conditions spécifiques de chaque dispositif. Le crédit d'impôt CIBRE prend fin au 31/12/2025.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
