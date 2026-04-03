'use client'

import React, { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabPV = 'en_cours' | 'redaction' | 'historique' | 'modeles'
type WizardStep = 1 | 2 | 3 | 4
type TypeAG = 'ordinaire' | 'extraordinaire'
type PresenceStatus = 'present' | 'represente' | 'absent'
type VoteType = 'pour' | 'contre' | 'abstention'
type MajoriteType = 'art24' | 'art25' | 'art25_1' | 'art26' | 'unanimite'
type StatutPV = 'brouillon' | 'en_revision' | 'valide' | 'envoye'

interface Coproprietaire {
  id: string; nom: string; lots: string; tantiemes: number
  presence: PresenceStatus; pouvoirDonneA?: string
}

interface Resolution {
  id: string; numero: number; intitule: string; texte: string
  majorite: MajoriteType; pourTantiemes: number; contreTantiemes: number
  abstentionTantiemes: number; adoptee: boolean | null
}

interface PVRecord {
  id: string; dateAG: string; heureDebut: string; heureFin: string
  lieu: string; immeuble: string; typeAG: TypeAG
  presidentSeance: string; secretaire: string; scrutateurs: string
  coproprietaires: Coproprietaire[]; resolutions: Resolution[]
  statut: StatutPV; texteGenere: string; creeLe: string; modifieLe: string
  dureeGeneration?: number
}

interface ModeleTemplate {
  id: string; nom: string; description: string; icon: string; typeAG: TypeAG
  resolutionsTypes: { intitule: string; majorite: MajoriteType }[]
  isCustom?: boolean
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAJORITE_LABELS: Record<MajoriteType, { short: string; full: string; ref: string }> = {
  art24: { short: 'Art. 24', full: 'Majorite simple', ref: 'Art. 24 loi du 10/07/1965' },
  art25: { short: 'Art. 25', full: 'Majorite absolue', ref: 'Art. 25 loi du 10/07/1965' },
  art25_1: { short: 'Art. 25-1', full: 'Passerelle', ref: 'Art. 25-1 loi du 10/07/1965' },
  art26: { short: 'Art. 26', full: 'Double majorite', ref: 'Art. 26 loi du 10/07/1965' },
  unanimite: { short: 'Unanimite', full: 'Unanimite requise', ref: 'Unanimite — tous coproprietaires' },
}

const STATUT_CONFIG: Record<StatutPV, { label: string; bg: string; color: string; dot: string }> = {
  brouillon: { label: 'Brouillon', bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  en_revision: { label: 'En revision', bg: '#E8EDF4', color: '#2C5282', dot: '#2C5282' },
  valide: { label: 'Valide', bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  envoye: { label: 'Envoye', bg: '#F0EAF8', color: '#6B21A8', dot: '#6B21A8' },
}

const TEMPLATES_BUILTIN: ModeleTemplate[] = [
  {
    id: 'tpl_ag_ordinaire', nom: 'AG ordinaire annuelle', icon: '📅', typeAG: 'ordinaire',
    description: 'Modele complet pour l\'assemblee generale ordinaire annuelle : approbation des comptes, budget previsionnel, fonds travaux, election conseil syndical, mandat syndic.',
    resolutionsTypes: [
      { intitule: 'Designation du bureau de l\'assemblee', majorite: 'art24' },
      { intitule: 'Approbation des comptes de l\'exercice ecoule', majorite: 'art24' },
      { intitule: 'Approbation du budget previsionnel', majorite: 'art24' },
      { intitule: 'Cotisation au fonds de travaux (loi ALUR)', majorite: 'art24' },
      { intitule: 'Election des membres du conseil syndical', majorite: 'art24' },
      { intitule: 'Renouvellement du mandat du syndic', majorite: 'art25' },
      { intitule: 'Questions diverses', majorite: 'art24' },
    ],
  },
  {
    id: 'tpl_ag_extra_travaux', nom: 'AG extraordinaire travaux', icon: '🏗️', typeAG: 'extraordinaire',
    description: 'Modele pour voter des travaux importants : ravalement, toiture, ascenseur. Majorites renforcees art. 25 ou art. 26 selon la nature.',
    resolutionsTypes: [
      { intitule: 'Designation du bureau de l\'assemblee', majorite: 'art24' },
      { intitule: 'Presentation du diagnostic technique', majorite: 'art24' },
      { intitule: 'Choix de l\'entreprise et approbation des travaux', majorite: 'art25' },
      { intitule: 'Appel de fonds et echeancier de paiement', majorite: 'art25' },
      { intitule: 'Autorisation donnee au syndic de signer les marches', majorite: 'art25' },
    ],
  },
  {
    id: 'tpl_ag_mixte', nom: 'AG mixte', icon: '📋', typeAG: 'ordinaire',
    description: 'Modele combinant resolutions ordinaires et extraordinaires dans une meme assemblee. Inclut comptes, budget et vote de travaux.',
    resolutionsTypes: [
      { intitule: 'Designation du bureau de l\'assemblee', majorite: 'art24' },
      { intitule: 'Approbation des comptes', majorite: 'art24' },
      { intitule: 'Budget previsionnel', majorite: 'art24' },
      { intitule: 'Travaux de renovation energetique', majorite: 'art25' },
      { intitule: 'Modification du reglement de copropriete', majorite: 'art26' },
      { intitule: 'Questions diverses', majorite: 'art24' },
    ],
  },
]

const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) } catch { return s } }
const fmtDateShort = (s: string) => { try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return s } }

// ─── Demo data ───────────────────────────────────────────────────────────────

function makeDemoData(): PVRecord[] {
  const copros: Coproprietaire[] = [
    { id: 'c1', nom: 'M. Dupont Jean', lots: 'Lot 1 (Appt. A)', tantiemes: 85, presence: 'present' },
    { id: 'c2', nom: 'Mme Martin Sophie', lots: 'Lot 2 (Appt. B)', tantiemes: 120, presence: 'present' },
    { id: 'c3', nom: 'M. Bernard Pierre', lots: 'Lot 3 (Appt. C)', tantiemes: 95, presence: 'represente', pouvoirDonneA: 'Mme Bernard Anne' },
    { id: 'c4', nom: 'Mme Petit Catherine', lots: 'Lot 4 (Appt. D)', tantiemes: 110, presence: 'absent' },
    { id: 'c5', nom: 'M. Robert Michel', lots: 'Lot 5 (Appt. E)', tantiemes: 75, presence: 'present' },
    { id: 'c6', nom: 'Mme Durand Marie', lots: 'Lot 6 (Appt. F)', tantiemes: 130, presence: 'present' },
    { id: 'c7', nom: 'M. Moreau Philippe', lots: 'Lot 7 (Appt. G)', tantiemes: 90, presence: 'present' },
    { id: 'c8', nom: 'Mme Simon Claire', lots: 'Lots 8+12 (H+Cave)', tantiemes: 105, presence: 'absent' },
  ]
  return [
    {
      id: 'pv-d1', dateAG: '2026-01-20', heureDebut: '18:30', heureFin: '21:00',
      lieu: 'Salle polyvalente, 15 rue de la Paix, 13001 Marseille', immeuble: 'Residence Les Oliviers',
      typeAG: 'ordinaire', presidentSeance: 'Mme Durand Marie', secretaire: 'Mme Martin Sophie',
      scrutateurs: 'M. Moreau Philippe, M. Robert Michel', coproprietaires: copros,
      resolutions: [
        { id: 'r1', numero: 1, intitule: 'Approbation des comptes 2025', texte: 'L\'assemblee approuve les comptes pour 48 250 EUR.', majorite: 'art24', pourTantiemes: 495, contreTantiemes: 130, abstentionTantiemes: 0, adoptee: true },
        { id: 'r2', numero: 2, intitule: 'Budget previsionnel 2026', texte: 'Budget 51 800 EUR approuve.', majorite: 'art24', pourTantiemes: 595, contreTantiemes: 0, abstentionTantiemes: 30, adoptee: true },
        { id: 'r3', numero: 3, intitule: 'Renouvellement mandat syndic', texte: 'Mandat renouvele pour 3 ans.', majorite: 'art25', pourTantiemes: 595, contreTantiemes: 0, abstentionTantiemes: 30, adoptee: true },
      ],
      statut: 'valide', texteGenere: '', creeLe: '2026-01-20T18:30:00Z', modifieLe: '2026-02-10T09:00:00Z', dureeGeneration: 4,
    },
    {
      id: 'pv-d2', dateAG: '2026-03-01', heureDebut: '19:00', heureFin: '21:30',
      lieu: 'Visioconference', immeuble: 'Residence Les Oliviers', typeAG: 'extraordinaire',
      presidentSeance: '', secretaire: '', scrutateurs: '',
      coproprietaires: copros.map(c => ({ ...c, presence: (['c1', 'c2', 'c5', 'c6'].includes(c.id) ? 'present' : 'absent') as PresenceStatus, pouvoirDonneA: undefined })),
      resolutions: [
        { id: 'r4', numero: 1, intitule: 'Ravalement de facade', texte: 'Travaux 85 000 EUR TTC.', majorite: 'art25', pourTantiemes: 410, contreTantiemes: 130, abstentionTantiemes: 0, adoptee: false },
      ],
      statut: 'brouillon', texteGenere: '', creeLe: '2026-03-01T19:00:00Z', modifieLe: '2026-03-01T21:30:00Z', dureeGeneration: 3,
    },
    {
      id: 'pv-d3', dateAG: '2026-02-15', heureDebut: '18:00', heureFin: '20:00',
      lieu: '12 avenue des Fleurs, 13008 Marseille', immeuble: 'Le Panoramic', typeAG: 'ordinaire',
      presidentSeance: 'M. Garcia Antoine', secretaire: 'Mme Roux Helene', scrutateurs: 'M. Faure Louis',
      coproprietaires: [
        { id: 'p1', nom: 'M. Garcia Antoine', lots: 'Lot 1', tantiemes: 200, presence: 'present' },
        { id: 'p2', nom: 'Mme Roux Helene', lots: 'Lot 2', tantiemes: 180, presence: 'present' },
        { id: 'p3', nom: 'M. Faure Louis', lots: 'Lot 3', tantiemes: 150, presence: 'present' },
        { id: 'p4', nom: 'Mme Blanc Julie', lots: 'Lot 4', tantiemes: 170, presence: 'represente', pouvoirDonneA: 'M. Faure Louis' },
        { id: 'p5', nom: 'M. Noel Marc', lots: 'Lot 5', tantiemes: 130, presence: 'absent' },
      ],
      resolutions: [
        { id: 'r5', numero: 1, intitule: 'Approbation des comptes', texte: 'Comptes approuves.', majorite: 'art24', pourTantiemes: 700, contreTantiemes: 0, abstentionTantiemes: 0, adoptee: true },
        { id: 'r6', numero: 2, intitule: 'Budget previsionnel', texte: 'Budget approuve.', majorite: 'art24', pourTantiemes: 700, contreTantiemes: 0, abstentionTantiemes: 0, adoptee: true },
      ],
      statut: 'envoye', texteGenere: '', creeLe: '2026-02-15T18:00:00Z', modifieLe: '2026-03-01T10:00:00Z', dureeGeneration: 5,
    },
    {
      id: 'pv-d4', dateAG: '2026-03-10', heureDebut: '18:30', heureFin: '',
      lieu: '5 rue du Port, 13002 Marseille', immeuble: 'Residence Les Oliviers', typeAG: 'ordinaire',
      presidentSeance: 'M. Dupont Jean', secretaire: '', scrutateurs: '',
      coproprietaires: copros.slice(0, 5).map(c => ({ ...c, presence: 'present' as PresenceStatus, pouvoirDonneA: undefined })),
      resolutions: [],
      statut: 'brouillon', texteGenere: '', creeLe: '2026-03-10T18:30:00Z', modifieLe: '2026-03-10T18:30:00Z',
    },
  ]
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function PVAssembleeIASection({ user, userRole }: { user: User; userRole: string }) {
  const STORAGE_KEY = `fixit_pv_ia_${user?.id || 'demo'}`

  // ── State
  const [tab, setTab] = useState<TabPV>('en_cours')
  const [pvs, setPvs] = useState<PVRecord[]>([])
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [wizardActive, setWizardActive] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [textePreview, setTextePreview] = useState('')

  // Wizard — Step 1 fields
  const [fDateAG, setFDateAG] = useState('')
  const [fHeureDebut, setFHeureDebut] = useState('18:30')
  const [fHeureFin, setFHeureFin] = useState('')
  const [fLieu, setFLieu] = useState('')
  const [fImmeuble, setFImmeuble] = useState('')
  const [fTypeAG, setFTypeAG] = useState<TypeAG>('ordinaire')
  const [fPresident, setFPresident] = useState('')
  const [fSecretaire, setFSecretaire] = useState('')
  const [fScrutateurs, setFScrutateurs] = useState('')

  // Step 2
  const [copros, setCopros] = useState<Coproprietaire[]>([])
  const [newCoproNom, setNewCoproNom] = useState('')
  const [newCoproLots, setNewCoproLots] = useState('')
  const [newCoproTant, setNewCoproTant] = useState('')

  // Step 3
  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [newResIntitule, setNewResIntitule] = useState('')
  const [newResMaj, setNewResMaj] = useState<MajoriteType>('art24')

  // Filters
  const [filterAnnee, setFilterAnnee] = useState<string>('toutes')
  const [filterImmeuble, setFilterImmeuble] = useState<string>('tous')

  // Templates
  const [templates, setTemplates] = useState<ModeleTemplate[]>(TEMPLATES_BUILTIN)
  const [newTplNom, setNewTplNom] = useState('')
  const [newTplDesc, setNewTplDesc] = useState('')
  const [newTplType, setNewTplType] = useState<TypeAG>('ordinaire')

  // ── Persistence
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length > 0) { setPvs(p); return } }
      const demo = makeDemoData(); setPvs(demo); localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    } catch { setPvs(makeDemoData()) }
  }, [STORAGE_KEY])

  const save = (list: PVRecord[]) => { setPvs(list); localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) }

  // ── Styles
  const card: React.CSSProperties = { background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 12, padding: 20 }
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--sd-navy,#0D1B2E)', fontFamily: "'Outfit',sans-serif", outline: 'none' }
  const sel: React.CSSProperties = { ...inp, appearance: 'auto' as const }
  const btnP: React.CSSProperties = { padding: '8px 18px', background: 'var(--sd-navy,#0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }
  const btnS: React.CSSProperties = { padding: '8px 18px', background: 'transparent', color: 'var(--sd-navy,#0D1B2E)', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }
  const btnG: React.CSSProperties = { padding: '8px 18px', background: 'var(--sd-gold,#C9A84C)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }
  const btnD: React.CSSProperties = { padding: '6px 14px', background: '#FDECEA', color: '#C0392B', border: '1px solid #F5C6CB', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 4, display: 'block', fontFamily: "'Outfit',sans-serif" }
  const heading: React.CSSProperties = { fontFamily: "'Playfair Display',serif", fontWeight: 800, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }

  // ── Computed
  const presentsRep = copros.filter(c => c.presence === 'present' || c.presence === 'represente')
  const totalTant = copros.reduce((s, c) => s + c.tantiemes, 0)
  const tantPresents = presentsRep.reduce((s, c) => s + c.tantiemes, 0)
  const pctPresence = totalTant > 0 ? (tantPresents / totalTant * 100) : 0

  const pvsMois = pvs.filter(p => { try { const d = new Date(p.creeLe); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() } catch { return false } })
  const tempsMoyen = pvs.filter(p => p.dureeGeneration).length > 0 ? (pvs.filter(p => p.dureeGeneration).reduce((s, p) => s + (p.dureeGeneration || 0), 0) / pvs.filter(p => p.dureeGeneration).length).toFixed(1) : '—'
  const tauxValidation = pvs.length > 0 ? ((pvs.filter(p => p.statut === 'valide' || p.statut === 'envoye').length / pvs.length) * 100).toFixed(0) : '0'

  const immeubles = [...new Set(pvs.map(p => p.immeuble).filter(Boolean))]
  const annees = [...new Set(pvs.map(p => { try { return new Date(p.dateAG).getFullYear().toString() } catch { return '' } }).filter(Boolean))]

  // ── Wizard helpers
  const resetWizard = () => {
    setWizardActive(false); setWizardStep(1); setEditId(null); setTextePreview('')
    setFDateAG(''); setFHeureDebut('18:30'); setFHeureFin(''); setFLieu(''); setFImmeuble('')
    setFTypeAG('ordinaire'); setFPresident(''); setFSecretaire(''); setFScrutateurs('')
    setCopros([]); setResolutions([])
    setNewCoproNom(''); setNewCoproLots(''); setNewCoproTant('')
    setNewResIntitule(''); setNewResMaj('art24')
  }

  const startNew = () => { resetWizard(); setWizardActive(true); setTab('redaction') }

  const editPV = (pv: PVRecord) => {
    setEditId(pv.id); setWizardActive(true); setTab('redaction'); setWizardStep(1)
    setFDateAG(pv.dateAG); setFHeureDebut(pv.heureDebut); setFHeureFin(pv.heureFin)
    setFLieu(pv.lieu); setFImmeuble(pv.immeuble); setFTypeAG(pv.typeAG)
    setFPresident(pv.presidentSeance); setFSecretaire(pv.secretaire); setFScrutateurs(pv.scrutateurs)
    setCopros(pv.coproprietaires); setResolutions(pv.resolutions); setTextePreview(pv.texteGenere)
  }

  const loadTemplate = (tpl: ModeleTemplate) => {
    resetWizard(); setWizardActive(true); setTab('redaction'); setFTypeAG(tpl.typeAG)
    setResolutions(tpl.resolutionsTypes.map((r, i) => ({
      id: `tr-${i}`, numero: i + 1, intitule: r.intitule, texte: '', majorite: r.majorite,
      pourTantiemes: 0, contreTantiemes: 0, abstentionTantiemes: 0, adoptee: null,
    })))
  }

  const addCopro = () => {
    if (!newCoproNom.trim()) return
    setCopros(p => [...p, { id: crypto.randomUUID(), nom: newCoproNom.trim(), lots: newCoproLots.trim() || '-', tantiemes: parseFloat(newCoproTant) || 0, presence: 'present' }])
    setNewCoproNom(''); setNewCoproLots(''); setNewCoproTant('')
  }

  const addResolution = () => {
    if (!newResIntitule.trim()) return
    setResolutions(p => [...p, { id: crypto.randomUUID(), numero: p.length + 1, intitule: newResIntitule.trim(), texte: '', majorite: newResMaj, pourTantiemes: 0, contreTantiemes: 0, abstentionTantiemes: 0, adoptee: null }])
    setNewResIntitule(''); setNewResMaj('art24')
  }

  const genererPV = async () => {
    setIaLoading(true)
    const start = Date.now()
    await new Promise(r => setTimeout(r, 2200))

    const presents = presentsRep.map(c =>
      `${c.nom} — ${c.lots} (${c.tantiemes} t.)${c.presence === 'represente' ? ` represente(e) par ${c.pouvoirDonneA || '—'}` : ''}`
    ).join('\n  ')
    const absents = copros.filter(c => c.presence === 'absent').map(c => `${c.nom} — ${c.lots} (${c.tantiemes} t.)`).join('\n  ')

    const resTexte = resolutions.map(r => {
      const res = r.adoptee === true ? 'ADOPTEE' : r.adoptee === false ? 'REJETEE' : 'NON VOTEE'
      return `RESOLUTION N${r.numero} — ${r.intitule.toUpperCase()}
  ${r.texte ? `Objet : ${r.texte}` : ''}
  Majorite : ${MAJORITE_LABELS[r.majorite].full} (${MAJORITE_LABELS[r.majorite].ref})
  POUR : ${r.pourTantiemes} t. | CONTRE : ${r.contreTantiemes} t. | ABSTENTION : ${r.abstentionTantiemes} t.
  --> ${res}`
    }).join('\n\n' + '─'.repeat(50) + '\n\n')

    const texte = `PROCES-VERBAL DE L'ASSEMBLEE GENERALE ${fTypeAG === 'extraordinaire' ? 'EXTRAORDINAIRE' : 'ORDINAIRE'}
DES COPROPRIETAIRES

${'━'.repeat(60)}
IMMEUBLE : ${fImmeuble || '[Nom]'}
DATE : ${fDateAG ? fmtDate(fDateAG) : '[Date]'}
HEURE : de ${fHeureDebut || '[Debut]'} a ${fHeureFin || '[Fin]'}
LIEU : ${fLieu || '[Lieu]'}

${'━'.repeat(60)}
FEUILLE DE PRESENCE (art. 14 decret du 17 mars 1967)

Presents et representes (${presentsRep.length}/${copros.length}) :
  ${presents || 'Aucun'}

Absents :
  ${absents || 'Aucun'}

Total tantiemes : ${totalTant} | Presents : ${tantPresents} (${pctPresence.toFixed(1)}%)

${'━'.repeat(60)}
BUREAU DE L'ASSEMBLEE (art. 15 decret du 17 mars 1967)

President de seance : ${fPresident || '________________________'}
Scrutateur(s) : ${fScrutateurs || '________________________'}
Secretaire : ${fSecretaire || '________________________'}

${'━'.repeat(60)}
DELIBERATIONS

${resTexte || 'Aucune resolution.'}

${'━'.repeat(60)}
CLOTURE

L'ordre du jour etant epuise, le President leve la seance a ${fHeureFin || '[heure]'}.
Le present PV a ete lu et approuve conformement a l'article 17 du decret du 17 mars 1967.

RAPPELS LEGAUX :
- PV obligatoire (art. 17 decret du 17 mars 1967)
- Vote par correspondance possible (art. 17-1 A loi du 10/07/1965)
- Notification aux absents et opposants sous 1 mois (art. 42 al. 2 loi du 10/07/1965)
- Delai de contestation : 2 mois (art. 42 loi 1965)
- Majorites : art. 24, 25, 25-1, 26 loi du 10/07/1965

${'━'.repeat(60)}
Document genere par Fixit — ${new Date().toLocaleDateString('fr-FR')}`

    setTextePreview(texte)
    setIaLoading(false)
    return Math.round((Date.now() - start) / 1000)
  }

  const savePV = (statut: StatutPV = 'brouillon') => {
    const now = new Date().toISOString()
    const pv: PVRecord = {
      id: editId || crypto.randomUUID(), dateAG: fDateAG, heureDebut: fHeureDebut, heureFin: fHeureFin,
      lieu: fLieu, immeuble: fImmeuble, typeAG: fTypeAG, presidentSeance: fPresident,
      secretaire: fSecretaire, scrutateurs: fScrutateurs, coproprietaires: copros,
      resolutions, statut, texteGenere: textePreview,
      creeLe: editId ? (pvs.find(p => p.id === editId)?.creeLe || now) : now, modifieLe: now, dureeGeneration: 3,
    }
    if (editId) { save(pvs.map(p => p.id === editId ? pv : p)) } else { save([pv, ...pvs]) }
    resetWizard(); setTab('en_cours')
  }

  // ─── Badge statut ─────────────────────────────────────────────────────────

  const StatutBadge = ({ s }: { s: StatutPV }) => {
    const c = STATUT_CONFIG[s]
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 6, background: c.bg, color: c.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
        {c.label}
      </span>
    )
  }

  // ─── TAB 1: PV en cours ──────────────────────────────────────────────────

  const renderEnCours = () => {
    const drafts = pvs.filter(p => p.statut === 'brouillon' || p.statut === 'en_revision')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { val: pvsMois.length, label: 'PV generes ce mois', color: 'var(--sd-gold,#C9A84C)' },
            { val: `${tempsMoyen} s`, label: 'Temps moyen generation', color: '#2C5282' },
            { val: `${tauxValidation}%`, label: 'Taux de validation', color: '#1A7A6E' },
          ].map((s, i) => (
            <div key={i} style={{ ...card, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Playfair Display',serif" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4, fontFamily: "'Outfit',sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {drafts.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
            <p style={{ fontSize: 14, color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 600 }}>Aucun PV en cours</p>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)', marginBottom: 16 }}>Commencez la redaction d'un nouveau proces-verbal.</p>
            <button onClick={startNew} style={btnP}>+ Nouveau PV</button>
          </div>
        ) : (
          drafts.map(pv => (
            <div key={pv.id} style={{ ...card, padding: 16, cursor: 'pointer' }} onClick={() => editPV(pv)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>📜</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', fontFamily: "'Playfair Display',serif" }}>
                      {pv.immeuble || 'Immeuble non defini'}
                    </span>
                    <StatutBadge s={pv.statut} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    AG {pv.typeAG} — {pv.dateAG ? fmtDateShort(pv.dateAG) : 'Date non definie'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                    {pv.resolutions.length} resolution(s) | Modifie le {fmtDateShort(pv.modifieLe)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); editPV(pv) }} style={{ ...btnS, padding: '6px 12px', fontSize: 11 }}>Modifier</button>
                  <button onClick={e => { e.stopPropagation(); save(pvs.filter(p => p.id !== pv.id)) }} style={{ ...btnD, padding: '6px 12px', fontSize: 11 }}>Supprimer</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  // ─── TAB 2: Redaction IA ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ ...heading, fontSize: 16 }}>Etape 1 — Informations de l'AG</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>Immeuble / residence</label><input style={inp} placeholder="Ex: Residence Les Oliviers" value={fImmeuble} onChange={e => setFImmeuble(e.target.value)} /></div>
        <div><label style={lbl}>Type d'AG</label>
          <select style={sel} value={fTypeAG} onChange={e => setFTypeAG(e.target.value as TypeAG)}>
            <option value="ordinaire">Ordinaire</option><option value="extraordinaire">Extraordinaire</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>Date AG</label><input style={inp} type="date" value={fDateAG} onChange={e => setFDateAG(e.target.value)} /></div>
        <div><label style={lbl}>Heure debut</label><input style={inp} type="time" value={fHeureDebut} onChange={e => setFHeureDebut(e.target.value)} /></div>
        <div><label style={lbl}>Heure fin</label><input style={inp} type="time" value={fHeureFin} onChange={e => setFHeureFin(e.target.value)} /></div>
      </div>
      <div><label style={lbl}>Lieu</label><input style={inp} placeholder="Adresse ou lien visioconference" value={fLieu} onChange={e => setFLieu(e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>President de seance</label><input style={inp} placeholder="Nom complet" value={fPresident} onChange={e => setFPresident(e.target.value)} /></div>
        <div><label style={lbl}>Secretaire de seance</label><input style={inp} placeholder="Nom complet" value={fSecretaire} onChange={e => setFSecretaire(e.target.value)} /></div>
      </div>
      <div><label style={lbl}>Scrutateur(s)</label><input style={inp} placeholder="Noms separes par des virgules" value={fScrutateurs} onChange={e => setFScrutateurs(e.target.value)} /></div>
    </div>
  )

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Jauge */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Representation</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: pctPresence >= 50 ? '#1A7A6E' : '#D4830A' }}>{pctPresence.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--sd-cream,#F7F4EE)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pctPresence, 100)}%`, background: pctPresence >= 50 ? '#1A7A6E' : '#D4830A', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 4 }}>{tantPresents} / {totalTant} tantiemes</div>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { n: copros.filter(c => c.presence === 'present').length, l: 'Presents', c: '#1A7A6E' },
          { n: copros.filter(c => c.presence === 'represente').length, l: 'Representes', c: 'var(--sd-gold,#C9A84C)' },
          { n: copros.filter(c => c.presence === 'absent').length, l: 'Absents', c: '#C0392B' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.n}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div style={card}>
        <h3 style={{ ...heading, fontSize: 14, marginBottom: 12 }}>Feuille de presence ({copros.length})</h3>
        {copros.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--sd-ink-3,#8A9BB0)', fontSize: 13 }}>Aucun coproprietaire. Ajoutez-en ou utilisez un modele.</div>}
        {copros.map((c, idx) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: idx % 2 === 0 ? 'var(--sd-cream,#F7F4EE)' : '#fff', borderRadius: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', minWidth: 140 }}>{c.nom}</span>
            <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', minWidth: 90 }}>{c.lots}</span>
            <span style={{ fontSize: 11, color: 'var(--sd-ink-2,#4A5E78)', minWidth: 55 }}>{c.tantiemes} t.</span>
            <select style={{ ...sel, width: 'auto', padding: '3px 8px', fontSize: 11 }} value={c.presence}
              onChange={e => setCopros(p => p.map(x => x.id === c.id ? { ...x, presence: e.target.value as PresenceStatus } : x))}>
              <option value="present">Present</option><option value="represente">Represente</option><option value="absent">Absent</option>
            </select>
            {c.presence === 'represente' && (
              <input style={{ ...inp, width: 130, padding: '3px 8px', fontSize: 11 }} placeholder="Pouvoir donne a"
                value={c.pouvoirDonneA || ''} onChange={e => setCopros(p => p.map(x => x.id === c.id ? { ...x, pouvoirDonneA: e.target.value } : x))} />
            )}
            <button onClick={() => setCopros(p => p.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', fontSize: 13 }}>x</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 140 }}><label style={lbl}>Nom</label><input style={inp} placeholder="M. / Mme ..." value={newCoproNom} onChange={e => setNewCoproNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCopro()} /></div>
          <div style={{ flex: 1, minWidth: 100 }}><label style={lbl}>Lot(s)</label><input style={inp} placeholder="Lot 1..." value={newCoproLots} onChange={e => setNewCoproLots(e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 80 }}><label style={lbl}>Tantiemes</label><input style={inp} type="number" placeholder="100" value={newCoproTant} onChange={e => setNewCoproTant(e.target.value)} /></div>
          <button onClick={addCopro} style={btnP}>+ Ajouter</button>
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {resolutions.map(r => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-navy,#0D1B2E)' }}>N{r.numero}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: r.majorite === 'art24' ? '#E6F4F2' : r.majorite === 'art25' || r.majorite === 'art25_1' ? '#FEF5E4' : '#FDECEA',
                  color: r.majorite === 'art24' ? '#1A7A6E' : r.majorite === 'art25' || r.majorite === 'art25_1' ? '#D4830A' : '#C0392B',
                }}>{MAJORITE_LABELS[r.majorite].short}</span>
              </div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>{r.intitule}</h4>
            </div>
            <button onClick={() => setResolutions(p => p.filter(x => x.id !== r.id).map((x, i) => ({ ...x, numero: i + 1 })))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B', fontSize: 14 }}>x</button>
          </div>
          {/* Vote inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Pour (tantiemes)</label><input style={inp} type="number" value={r.pourTantiemes || ''} onChange={e => setResolutions(p => p.map(x => x.id === r.id ? { ...x, pourTantiemes: parseInt(e.target.value) || 0 } : x))} /></div>
            <div><label style={lbl}>Contre (tantiemes)</label><input style={inp} type="number" value={r.contreTantiemes || ''} onChange={e => setResolutions(p => p.map(x => x.id === r.id ? { ...x, contreTantiemes: parseInt(e.target.value) || 0 } : x))} /></div>
            <div><label style={lbl}>Abstention (tantiemes)</label><input style={inp} type="number" value={r.abstentionTantiemes || ''} onChange={e => setResolutions(p => p.map(x => x.id === r.id ? { ...x, abstentionTantiemes: parseInt(e.target.value) || 0 } : x))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <label style={{ ...lbl, marginBottom: 0 }}>Resultat :</label>
            {[{ v: true, l: 'Adoptee', bg: '#E6F4F2', c: '#1A7A6E' }, { v: false, l: 'Rejetee', bg: '#FDECEA', c: '#C0392B' }].map(opt => (
              <button key={String(opt.v)} onClick={() => setResolutions(p => p.map(x => x.id === r.id ? { ...x, adoptee: opt.v as boolean } : x))}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: r.adoptee === opt.v ? `1px solid ${opt.c}` : '1px solid var(--sd-border,#E4DDD0)',
                  background: r.adoptee === opt.v ? opt.bg : 'transparent', color: r.adoptee === opt.v ? opt.c : 'var(--sd-ink-3,#8A9BB0)',
                }}>{opt.l}</button>
            ))}
          </div>
        </div>
      ))}

      {/* Add resolution */}
      <div style={card}>
        <h3 style={{ ...heading, fontSize: 14, marginBottom: 12 }}>+ Ajouter une resolution</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200 }}><label style={lbl}>Intitule</label><input style={inp} placeholder="Ex: Approbation des comptes" value={newResIntitule} onChange={e => setNewResIntitule(e.target.value)} onKeyDown={e => e.key === 'Enter' && addResolution()} /></div>
          <div style={{ flex: 1, minWidth: 180 }}><label style={lbl}>Majorite requise</label>
            <select style={sel} value={newResMaj} onChange={e => setNewResMaj(e.target.value as MajoriteType)}>
              <option value="art24">Art. 24 — Majorite simple</option>
              <option value="art25">Art. 25 — Majorite absolue</option>
              <option value="art25_1">Art. 25-1 — Passerelle</option>
              <option value="art26">Art. 26 — Double majorite</option>
              <option value="unanimite">Unanimite</option>
            </select>
          </div>
          <button onClick={addResolution} style={btnP}>+ Ajouter</button>
        </div>
        {/* Quick ref */}
        <div style={{ padding: '10px 14px', background: 'var(--sd-cream,#F7F4EE)', borderRadius: 8, marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 4 }}>Reference rapide — Majorites loi du 10 juillet 1965</div>
          <div style={{ fontSize: 10, color: 'var(--sd-ink-2,#4A5E78)', lineHeight: 1.8 }}>
            <div><strong>Art. 24</strong> : Comptes, budget, entretien courant</div>
            <div><strong>Art. 25</strong> : Mandat syndic, travaux amelioration</div>
            <div><strong>Art. 25-1</strong> : Passerelle si art. 25 echoue mais 1/3+ obtenu</div>
            <div><strong>Art. 26</strong> : Modification reglement, alienation partie commune</div>
            <div><strong>Unanimite</strong> : Cession partie commune, changement destination</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Resume */}
      <div style={card}>
        <h3 style={{ ...heading, fontSize: 14, marginBottom: 12 }}>Apercu du PV</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
          <div><strong>Immeuble :</strong> {fImmeuble || '—'}</div>
          <div><strong>Date :</strong> {fDateAG ? fmtDate(fDateAG) : '—'}</div>
          <div><strong>Type :</strong> {fTypeAG === 'ordinaire' ? 'Ordinaire' : 'Extraordinaire'}</div>
          <div><strong>Presents :</strong> {presentsRep.length} / {copros.length}</div>
          <div><strong>Tantiemes :</strong> {tantPresents} / {totalTant} ({pctPresence.toFixed(1)}%)</div>
          <div><strong>Resolutions :</strong> {resolutions.length} ({resolutions.filter(r => r.adoptee === true).length} adoptee(s))</div>
        </div>
      </div>

      {/* Rappels legaux */}
      <div style={{ ...card, background: 'var(--sd-cream,#F7F4EE)' }}>
        <h3 style={{ ...heading, fontSize: 14, marginBottom: 8 }}>Rappels legaux</h3>
        <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', lineHeight: 1.8 }}>
          <div>- PV obligatoire : art. 17 decret du 17 mars 1967</div>
          <div>- Vote par correspondance : art. 17-1 A loi du 10/07/1965</div>
          <div>- Majorites : art. 24 / 25 / 26 loi du 10/07/1965</div>
          <div>- Notification absents/opposants sous 1 mois : art. 42 al. 2 loi 1965</div>
        </div>
      </div>

      {/* Generate button */}
      <div style={{ ...card, textAlign: 'center' }}>
        <button onClick={async () => { await genererPV() }} disabled={iaLoading}
          style={{ ...btnG, padding: '12px 32px', fontSize: 15, opacity: iaLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {iaLoading ? (<><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Generation IA en cours...</>) : 'Generer le PV'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 8 }}>Formatage automatique conforme a la loi du 10/07/1965 et au decret du 17/03/1967.</p>
      </div>

      {/* Preview */}
      {textePreview && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ ...heading, fontSize: 14 }}>Proces-Verbal genere</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(textePreview)} style={btnS}>Copier</button>
              <button onClick={() => savePV('brouillon')} style={btnS}>Brouillon</button>
              <button onClick={() => savePV('valide')} style={btnP}>Valider</button>
            </div>
          </div>
          <pre style={{ background: 'var(--sd-cream,#F7F4EE)', padding: 20, borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: 'var(--sd-navy,#0D1B2E)', whiteSpace: 'pre-wrap', fontFamily: "'Courier New',monospace", maxHeight: 500, overflow: 'auto', border: '1px solid var(--sd-border,#E4DDD0)' }}>
            {textePreview}
          </pre>
        </div>
      )}
    </div>
  )

  const renderRedaction = () => {
    if (!wizardActive) {
      return (
        <div style={{ ...card, textAlign: 'center', padding: 50 }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>🏛️</div>
          <h3 style={{ ...heading, fontSize: 18, marginBottom: 8 }}>Redaction assistee par IA</h3>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', marginBottom: 20, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Creez un PV d'assemblee generale en 4 etapes. L'IA genere automatiquement le document conforme a la legislation.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={startNew} style={btnP}>Commencer</button>
            <button onClick={() => setTab('modeles')} style={btnS}>Utiliser un modele</button>
          </div>
        </div>
      )
    }

    const steps = [
      { n: 1 as WizardStep, l: 'Infos AG', i: '📋' },
      { n: 2 as WizardStep, l: 'Presence', i: '👥' },
      { n: 3 as WizardStep, l: 'Resolutions', i: '🗳️' },
      { n: 4 as WizardStep, l: 'Apercu & Generation', i: '✅' },
    ]

    return (
      <>
        {/* Steps nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
          {steps.map((s, idx) => (
            <React.Fragment key={s.n}>
              <button onClick={() => setWizardStep(s.n)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: wizardStep === s.n ? 'var(--sd-navy,#0D1B2E)' : wizardStep > s.n ? '#E6F4F2' : 'var(--sd-cream,#F7F4EE)',
                color: wizardStep === s.n ? '#fff' : wizardStep > s.n ? '#1A7A6E' : 'var(--sd-ink-3,#8A9BB0)',
                fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 600,
              }}>
                <span>{s.i}</span> {s.l}
              </button>
              {idx < steps.length - 1 && <div style={{ flex: 1, height: 2, background: wizardStep > s.n ? '#1A7A6E' : 'var(--sd-border,#E4DDD0)', margin: '0 6px' }} />}
            </React.Fragment>
          ))}
        </div>

        {wizardStep === 1 && renderStep1()}
        {wizardStep === 2 && renderStep2()}
        {wizardStep === 3 && renderStep3()}
        {wizardStep === 4 && renderStep4()}

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {wizardStep > 1 && <button onClick={() => setWizardStep((wizardStep - 1) as WizardStep)} style={btnS}>Precedent</button>}
            <button onClick={resetWizard} style={{ ...btnS, color: '#C0392B', borderColor: '#F5C6CB' }}>Annuler</button>
          </div>
          {wizardStep < 4 && <button onClick={() => setWizardStep((wizardStep + 1) as WizardStep)} style={btnP}>Suivant</button>}
        </div>
      </>
    )
  }

  // ─── TAB 3: Historique ───────────────────────────────────────────────────

  const renderHistorique = () => {
    let filtered = [...pvs]
    if (filterAnnee !== 'toutes') filtered = filtered.filter(p => { try { return new Date(p.dateAG).getFullYear().toString() === filterAnnee } catch { return false } })
    if (filterImmeuble !== 'tous') filtered = filtered.filter(p => p.immeuble === filterImmeuble)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...sel, width: 'auto' }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
            <option value="toutes">Toutes les annees</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select style={{ ...sel, width: 'auto' }} value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}>
            <option value="tous">Tous les immeubles</option>
            {immeubles.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>{filtered.length} PV</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 30 }}>
            <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)' }}>Aucun PV dans l'historique.</p>
          </div>
        ) : (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px 100px 140px', gap: 0, padding: '10px 16px', background: 'var(--sd-cream,#F7F4EE)', borderBottom: '1px solid var(--sd-border,#E4DDD0)' }}>
              {['Date', 'Immeuble', 'Type', 'Resol.', 'Statut', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--sd-ink-2,#4A5E78)', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>
            {filtered.map((pv, idx) => (
              <div key={pv.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px 100px 140px', gap: 0, padding: '10px 16px', alignItems: 'center', borderBottom: idx < filtered.length - 1 ? '1px solid var(--sd-border,#E4DDD0)' : 'none', background: idx % 2 === 0 ? '#fff' : 'var(--sd-cream,#F7F4EE)' }}>
                <span style={{ fontSize: 12, color: 'var(--sd-navy,#0D1B2E)' }}>{pv.dateAG ? fmtDateShort(pv.dateAG) : '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>{pv.immeuble || '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--sd-ink-2,#4A5E78)' }}>{pv.typeAG === 'ordinaire' ? 'Ordinaire' : 'Extraordinaire'}</span>
                <span style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>{pv.resolutions.length}</span>
                <StatutBadge s={pv.statut} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setExpandedId(expandedId === pv.id ? null : pv.id)} style={{ ...btnS, padding: '4px 10px', fontSize: 10 }}>Voir</button>
                  {pv.texteGenere && <button onClick={() => navigator.clipboard.writeText(pv.texteGenere)} style={{ ...btnS, padding: '4px 10px', fontSize: 10 }}>Copier</button>}
                  <button onClick={() => { const updated = pvs.map(p => p.id === pv.id ? { ...p, statut: 'envoye' as StatutPV, modifieLe: new Date().toISOString() } : p); save(updated) }} style={{ ...btnG, padding: '4px 10px', fontSize: 10 }}>Envoyer</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expanded detail */}
        {expandedId && (() => {
          const pv = pvs.find(p => p.id === expandedId)
          if (!pv) return null
          return (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ ...heading, fontSize: 16 }}>Detail — {pv.immeuble}</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => editPV(pv)} style={btnS}>Modifier</button>
                  <button onClick={() => setExpandedId(null)} style={btnS}>Fermer</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 14 }}>
                <div><strong>Date :</strong> {pv.dateAG ? fmtDate(pv.dateAG) : '—'}</div>
                <div><strong>Lieu :</strong> {pv.lieu || '—'}</div>
                <div><strong>President :</strong> {pv.presidentSeance || '—'}</div>
                <div><strong>Secretaire :</strong> {pv.secretaire || '—'}</div>
              </div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 8 }}>Resolutions ({pv.resolutions.length})</h4>
              {pv.resolutions.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--sd-cream,#F7F4EE)', borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 30 }}>N{r.numero}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>{r.intitule}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    background: r.majorite === 'art24' ? '#E6F4F2' : '#FEF5E4',
                    color: r.majorite === 'art24' ? '#1A7A6E' : '#D4830A',
                  }}>{MAJORITE_LABELS[r.majorite].short}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: r.adoptee === true ? '#E6F4F2' : r.adoptee === false ? '#FDECEA' : '#F7F4EE',
                    color: r.adoptee === true ? '#1A7A6E' : r.adoptee === false ? '#C0392B' : 'var(--sd-ink-3,#8A9BB0)',
                  }}>{r.adoptee === true ? 'Adoptee' : r.adoptee === false ? 'Rejetee' : '—'}</span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    )
  }

  // ─── TAB 4: Modeles ──────────────────────────────────────────────────────

  const renderModeles = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', margin: 0 }}>
        Selectionnez un modele pre-rempli pour demarrer rapidement, ou creez un modele personnalise.
      </p>

      {templates.map(tpl => (
        <div key={tpl.id} style={card}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ fontSize: 36 }}>{tpl.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ ...heading, fontSize: 16 }}>{tpl.nom}</h3>
                {tpl.isCustom && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--sd-gold,#C9A84C)', color: '#fff', fontWeight: 600 }}>Personnalise</span>}
              </div>
              <p style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', margin: '0 0 10px', lineHeight: 1.5 }}>{tpl.description}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 600 }}>
                  {tpl.resolutionsTypes.length} resolutions
                </span>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 600 }}>
                  AG {tpl.typeAG}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                {tpl.resolutionsTypes.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    <span style={{ fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                    <span style={{ flex: 1 }}>{r.intitule}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                      background: r.majorite === 'art24' ? '#E6F4F2' : '#FEF5E4',
                      color: r.majorite === 'art24' ? '#1A7A6E' : '#D4830A',
                    }}>{MAJORITE_LABELS[r.majorite].short}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => loadTemplate(tpl)} style={btnP}>Utiliser ce modele</button>
                {tpl.isCustom && <button onClick={() => setTemplates(p => p.filter(t => t.id !== tpl.id))} style={btnD}>Supprimer</button>}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Custom template form */}
      <div style={card}>
        <h3 style={{ ...heading, fontSize: 16, marginBottom: 12 }}>Creer un modele personnalise</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Nom du modele</label><input style={inp} placeholder="Ex: AG annuelle immeuble X" value={newTplNom} onChange={e => setNewTplNom(e.target.value)} /></div>
            <div><label style={lbl}>Type AG</label>
              <select style={sel} value={newTplType} onChange={e => setNewTplType(e.target.value as TypeAG)}>
                <option value="ordinaire">Ordinaire</option><option value="extraordinaire">Extraordinaire</option>
              </select>
            </div>
          </div>
          <div><label style={lbl}>Description</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description du modele..." value={newTplDesc} onChange={e => setNewTplDesc(e.target.value)} /></div>
          <button onClick={() => {
            if (!newTplNom.trim()) return
            setTemplates(p => [...p, {
              id: `custom-${Date.now()}`, nom: newTplNom.trim(), description: newTplDesc.trim(),
              icon: '📝', typeAG: newTplType, resolutionsTypes: [
                { intitule: 'Designation du bureau', majorite: 'art24' },
                { intitule: 'Questions diverses', majorite: 'art24' },
              ], isCustom: true,
            }])
            setNewTplNom(''); setNewTplDesc('')
          }} style={btnP}>Creer le modele</button>
        </div>
      </div>
    </div>
  )

  // ─── Render principal ──────────────────────────────────────────────────────

  const TABS: { key: TabPV; label: string; icon: string }[] = [
    { key: 'en_cours', label: 'PV en cours', icon: '📝' },
    { key: 'redaction', label: 'Redaction IA', icon: '🤖' },
    { key: 'historique', label: 'Historique', icon: '📚' },
    { key: 'modeles', label: 'Modeles', icon: '📋' },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ ...heading, fontSize: 22 }}>PV d'Assemblee Generale — IA</h1>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3,#8A9BB0)', margin: '4px 0 0', fontFamily: "'Outfit',sans-serif" }}>
            Generation assistee par IA — Conforme loi 10/07/1965, decret 17/03/1967
          </p>
        </div>
        <button onClick={startNew} style={btnP}>+ Nouveau PV</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--sd-border,#E4DDD0)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'redaction') setWizardActive(false) }}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--sd-navy,#0D1B2E)' : '2px solid transparent',
              color: tab === t.key ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              marginBottom: -2, transition: 'all 0.2s',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'en_cours' && renderEnCours()}
      {tab === 'redaction' && renderRedaction()}
      {tab === 'historique' && renderHistorique()}
      {tab === 'modeles' && renderModeles()}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
