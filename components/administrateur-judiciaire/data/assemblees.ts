import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type { FicheAssemblee } from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import type { Bulletin, EtatPresence, LignePresence } from '@/lib/administrateur-judiciaire/domain/votes-ag'
import { MODE_ACTIF, type Mode } from '@/lib/administrateur-judiciaire/mode'

/** Assemblées de démonstration (données fictives) : feuilles de présence, résolutions et bulletins. */

const d = composerDateIso

interface CompteDemo {
  compteId: string
  nom: string
  tantiemes: number
}

/** Comptes nommés, puis `nombre` comptes génériques qui se partagent le reste des 10 000 tantièmes. */
function comptes(prefixe: string, nommes: CompteDemo[], nombre: number): CompteDemo[] {
  const reste = 10000 - nommes.reduce((total, compte) => total + compte.tantiemes, 0)
  const part = Math.floor(reste / nombre)
  const generiques = Array.from({ length: nombre }, (_, rang) => {
    const numero = String(rang + 1).padStart(2, '0')
    return {
      compteId: `${prefixe}-${numero}`,
      nom: `Copropriétaire n° ${numero}`,
      tantiemes: rang === nombre - 1 ? reste - part * (nombre - 1) : part,
    }
  })
  return [...nommes, ...generiques]
}

/** Feuille de présence : situation par compte (absent par défaut), mandataire des comptes représentés. */
function feuille(liste: CompteDemo[], etats: Record<string, EtatPresence>, mandataires: Record<string, string> = {}): LignePresence[] {
  return liste.map(({ compteId, tantiemes }) => ({
    compteId,
    tantiemes,
    etat: etats[compteId] ?? 'absent',
    mandataire: mandataires[compteId] ?? null,
  }))
}

const plage = (prefixe: string, de: number, a: number) =>
  Array.from({ length: a - de + 1 }, (_, rang) => `${prefixe}-${String(de + rang).padStart(2, '0')}`)
const avec = (comptesIds: string[], etat: EtatPresence) => Object.fromEntries(comptesIds.map((compte) => [compte, etat]))
/** Bulletins : `pour` par défaut pour chaque votant, sauf les exceptions. */
function bulletins(votants: string[], exceptions: Record<string, Bulletin> = {}): Record<string, Bulletin> {
  return Object.fromEntries(votants.map((compte) => [compte, exceptions[compte] ?? 'pour']))
}

// Résidence Le Méridien : trois copropriétaires de démonstration et 33 comptes génériques.
const COMPTES_LM = comptes(
  'LM',
  [
    { compteId: 'P1', nom: 'Laurent Mercier', tantiemes: 412 },
    { compteId: 'P4', nom: 'Inès Lefèvre', tantiemes: 350 },
    { compteId: 'P8', nom: 'Mathilde Faure', tantiemes: 288 },
  ],
  33,
)
const PRESENTS_LM = ['P1', 'P4', 'P8', ...plage('LM', 1, 11)]
const REPRESENTES_LM = plage('LM', 12, 16)
const VOTANTS_LM = [...PRESENTS_LM, ...REPRESENTES_LM, 'LM-17', 'LM-18']
const FEUILLE_LM_2026 = feuille(
  COMPTES_LM,
  { ...avec(PRESENTS_LM, 'present'), ...avec(REPRESENTES_LM, 'represente'), 'LM-17': 'correspondance', 'LM-18': 'visio' },
  { 'LM-12': 'P4', 'LM-13': 'P4', 'LM-14': 'P4', 'LM-15': 'P1', 'LM-16': 'P1' },
)
const NOMS_LM = Object.fromEntries(COMPTES_LM.map((compte) => [compte.compteId, compte.nom]))
const CONTRE_RAVALEMENT = Object.fromEntries(VOTANTS_LM.slice(10).map((compte) => [compte, 'contre' as const]))

// Le Clos des Vignes : vingt comptes génériques.
const COMPTES_CV = comptes('CV', [], 20)
const VOTANTS_CV = plage('CV', 1, 13)

export const FICHES_ASSEMBLEES_DEMO: FicheAssemblee[] = [
  {
    id: 'ag-lm-2026-1',
    coproCode: 'LM',
    numero: 'M012.2026.1',
    nature: 'Annuelle',
    statut: 'Notifiée',
    date: d(2026, 4, 18),
    heureDebut: '10 h 00',
    heureFin: '12 h 30',
    lieu: 'Salle municipale, 2 rue de la Mairie, Nanterre',
    visio: true,
    voteCorrespondance: true,
    clePresence: '001 · Charges communes générales',
    convocationEnvoyeeLe: d(2026, 3, 20),
    convocationPresenteeLe: d(2026, 3, 23),
    feuille: FEUILLE_LM_2026,
    noms: NOMS_LM,
    resolutions: [
      { numero: 1, intitule: 'Élection du président de séance', majorite: 'art24', bulletins: bulletins(VOTANTS_LM) },
      {
        numero: 2,
        intitule: 'Approbation des comptes de l’exercice 2025',
        majorite: 'art24',
        bulletins: bulletins(VOTANTS_LM, { 'LM-10': 'contre', 'LM-11': 'contre' }),
      },
      {
        numero: 3,
        intitule: 'Budget prévisionnel 2027',
        majorite: 'art24',
        bulletins: bulletins(VOTANTS_LM, { 'LM-10': 'contre', 'LM-11': 'contre' }),
      },
      { numero: 4, intitule: 'Ravalement de la façade sur rue', majorite: 'art25', bulletins: bulletins(VOTANTS_LM, CONTRE_RAVALEMENT) },
      {
        numero: 5,
        intitule: 'Élection des membres du conseil syndical',
        majorite: 'art25',
        bulletins: bulletins(VOTANTS_LM, { 'LM-18': 'abstention' }),
      },
    ],
    bureau: { president: 'Inès Lefèvre', scrutateurs: ['Mathilde Faure', 'Copropriétaire n° 01'], secretaire: 'Le syndic judiciaire' },
    decisions: { exerciceApprouve: 2025, budgetAnnee: 2027, budgetVoteEuros: 146000, mandatCsMois: 12, seuilConsultationCsEuros: 3000 },
    pvSigneLe: d(2026, 4, 18),
    pvPresenteLe: d(2026, 5, 5),
    notes: 'Ravalement à réinscrire à la prochaine assemblée.',
    responsable: 'Gestionnaire A',
    assistant: 'Assistant C',
  },
  {
    id: 'ag-lm-2026-2',
    coproCode: 'LM',
    numero: 'M012.2026.2',
    nature: 'Spéciale',
    statut: 'Convoquée',
    date: d(2026, 9, 15),
    heureDebut: '18 h 30',
    heureFin: '20 h 00',
    lieu: 'Salle municipale, 2 rue de la Mairie, Nanterre',
    visio: true,
    voteCorrespondance: true,
    clePresence: '001 · Charges communes générales',
    convocationEnvoyeeLe: d(2026, 8, 14),
    convocationPresenteeLe: null,
    feuille: feuille(COMPTES_LM, {}),
    noms: NOMS_LM,
    resolutions: [
      { numero: 1, intitule: 'Élection du président de séance', majorite: 'art24', bulletins: null },
      { numero: 2, intitule: 'Ravalement de la façade sur rue (nouveau projet)', majorite: 'art25', bulletins: null },
    ],
    bureau: { president: '', scrutateurs: [], secretaire: 'Le syndic judiciaire' },
    decisions: { exerciceApprouve: null, budgetAnnee: null, budgetVoteEuros: null, mandatCsMois: null, seuilConsultationCsEuros: null },
    pvSigneLe: null,
    pvPresenteLe: null,
    notes: '',
    responsable: 'Gestionnaire A',
    assistant: 'Assistant C',
  },
  {
    id: 'ag-cv-2025-1',
    coproCode: 'CV',
    numero: 'M007.2025.1',
    nature: 'Annuelle',
    statut: 'Notifiée',
    date: d(2025, 10, 9),
    heureDebut: '18 h 00',
    heureFin: '20 h 30',
    lieu: 'Loge du gardien, 8 av. du Château, Rueil-Malmaison',
    visio: false,
    voteCorrespondance: true,
    clePresence: '001 · Charges communes générales',
    convocationEnvoyeeLe: d(2025, 9, 10),
    convocationPresenteeLe: d(2025, 9, 12),
    feuille: feuille(COMPTES_CV, avec(VOTANTS_CV, 'present')),
    noms: Object.fromEntries(COMPTES_CV.map((compte) => [compte.compteId, compte.nom])),
    resolutions: [
      { numero: 1, intitule: 'Approbation des comptes de l’exercice 2024', majorite: 'art24', bulletins: bulletins(VOTANTS_CV) },
      { numero: 2, intitule: 'Désignation du conseil syndical', majorite: 'art25', bulletins: bulletins(VOTANTS_CV) },
    ],
    bureau: { president: 'Copropriétaire n° 01', scrutateurs: ['Copropriétaire n° 02'], secretaire: 'Le syndic judiciaire' },
    decisions: { exerciceApprouve: 2024, budgetAnnee: 2026, budgetVoteEuros: 198000, mandatCsMois: 24, seuilConsultationCsEuros: 5000 },
    pvSigneLe: d(2025, 10, 9),
    pvPresenteLe: d(2025, 10, 28),
    notes: '',
    responsable: 'Gestionnaire A',
    assistant: 'Assistant C',
  },
]

/**
 * Assemblées de démonstration d'une copropriété (par code), de la plus récente à la plus ancienne ; aucune hors du mode
 * démonstration (une copropriété réelle peut porter le même code).
 */
export const assembleesDeLaCopro = (code: string, mode: Mode = MODE_ACTIF): FicheAssemblee[] =>
  mode === 'demo'
    ? FICHES_ASSEMBLEES_DEMO.filter((assemblee) => assemblee.coproCode === code).sort((a, b) => b.date.localeCompare(a.date))
    : []
