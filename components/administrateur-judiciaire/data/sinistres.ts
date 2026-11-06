import { DEMO_CONTRATS_ASSURANCE } from '@/components/administrateur-judiciaire/data/contrats-assurance'
import { DEMO_EQUIPE_CABINET } from '@/components/administrateur-judiciaire/data/equipe-cabinet'
import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { saisieSinistreParDefaut } from '@/lib/administrateur-judiciaire/domain/fiche-sinistre'
import { creerSinistre, type FicheSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Sinistres de démonstration : trois fiches FICTIVES complètes sur le modèle de la fiche Gestéam (aucune donnée de
 * copropriété venue de Gestéam). Mêmes copropriétés, numéros d'ordre et assureurs que la maquette (CV · MMA, TL · AXA,
 * LM · MMA), numéro au format Gestéam (code + « . » + rang sur 5 chiffres). Courtiers et intervenants fictifs.
 */

/** Option d'une liste de choix de la fiche sinistre (identifiant de l'annuaire, libellé affiché). */
export interface OptionChoixSinistre {
  id: string
  libelle: string
}

/** Contrat d'assurance proposé dans la fiche : la compagnie et le n° de police se recopient à son choix. */
export interface OptionContratSinistre extends OptionChoixSinistre {
  compagnie: string | null
  compagnieId: string | null
  numeroPolice: string | null
}

const slug = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const assureurDe = (assureurEtReference: string): string => assureurEtReference.split(' · ')[0].trim()

/** Compagnies d'assurance de la démonstration : assureurs des contrats de démonstration, dans l'ordre d'apparition. */
export const DEMO_COMPAGNIES_ASSURANCE: readonly OptionChoixSinistre[] = [
  ...new Set(DEMO_CONTRATS_ASSURANCE.map(([, assureurEtReference]) => assureurDe(assureurEtReference))),
].map((nom) => ({ id: `demo-compagnie-${slug(nom)}`, libelle: nom }))

/** Courtiers fictifs (aucun courtier n'existe dans les données de démonstration). */
export const DEMO_COURTIERS: readonly OptionChoixSinistre[] = [
  { id: 'demo-courtier-valmont', libelle: 'Valmont Courtage' },
  { id: 'demo-courtier-oree', libelle: 'Orée Assurances Conseil' },
]

/** Collaborateurs du cabinet de démonstration (responsable, assistant). */
export const DEMO_COLLABORATEURS_SINISTRE: readonly OptionChoixSinistre[] = DEMO_EQUIPE_CABINET.map(
  ([initiales, nom, role]) => ({ id: `demo-equipe-${initiales}`, libelle: `${nom} (${role})` }),
)

/** Contrats d'assurance de démonstration, avec les codes des copropriétés couvertes. */
export const DEMO_CONTRATS_SINISTRE: readonly (OptionContratSinistre & { copros: readonly string[] })[] =
  DEMO_CONTRATS_ASSURANCE.map(([intitule, assureurEtReference, , , copros], index) => {
    const compagnie = assureurDe(assureurEtReference)
    return {
      id: `demo-contrat-${index + 1}`,
      libelle: `${intitule} => , ${assureurEtReference}`,
      compagnie,
      compagnieId: `demo-compagnie-${slug(compagnie)}`,
      numeroPolice: /police n° (\S+)/.exec(assureurEtReference)?.[1] ?? null,
      copros,
    }
  })

const collaborateur = (initiales: string): { id: string; nom: string } => {
  const membre = DEMO_EQUIPE_CABINET.find(([code]) => code === initiales)
  return { id: `demo-equipe-${initiales}`, nom: membre ? membre[1] : initiales }
}

/** Saisie d'une fiche de démonstration : champs non renseignés à leur valeur par défaut. */
const saisieDemo = saisieSinistreParDefaut

/** Fiche de démonstration identifiée (même forme qu'une ligne relue de la base). */
export type SinistreDemo = FicheSinistre & { id: string }

/** Les trois sinistres de démonstration, du plus récent au plus ancien. */
export const DEMO_SINISTRES: readonly SinistreDemo[] = [
  {
    id: 'demo-sinistre-cv-14',
    ...creerSinistre(
      saisieDemo({
        coproprieteId: 'C2',
        numero: 'CV.00014',
        type: 'Dégât des eaux',
        phase: 'Déclaration',
        dateOuverture: composerDateIso(2026, 6, 1),
        dateSurvenance: composerDateIso(2026, 5, 29),
        dateDeclaration: composerDateIso(2026, 6, 1),
        partiesCommunesLesees: true,
        origine: "Fuite sur la colonne d'eau chaude",
        lieu: '4e étage, palier',
        dommages: 'Plafond et peintures du palier',
        assurance: {
          compagnie: 'MMA',
          compagnieId: 'demo-compagnie-mma',
          numeroSinistre: 'MMA-26-055120',
          courtier: 'Valmont Courtage',
          courtierId: 'demo-courtier-valmont',
          numeroCourtier: 'VC-2026-118',
          contrat: null,
        },
        parties: [{ role: 'Lésé', nature: 'Personne', refId: null, libelle: 'Occupant du lot 41' }],
        responsable: collaborateur('ML'),
        assistant: collaborateur('SV'),
      }),
    ),
  },
  {
    id: 'demo-sinistre-tl-9',
    ...creerSinistre(
      saisieDemo({
        coproprieteId: 'C3',
        numero: 'TL.00009',
        type: 'Dégât des eaux',
        phase: "Mission d'expertise",
        dateOuverture: composerDateIso(2026, 4, 13),
        dateSurvenance: composerDateIso(2026, 4, 12),
        dateDeclaration: composerDateIso(2026, 4, 14),
        dateExpertise: composerDateIso(2026, 6, 18),
        heureExpertise: '10:00',
        partiesCommunesLesees: true,
        partiesCommunesResponsables: true,
        origine: 'Infiltration toiture',
        lieu: 'Toiture-terrasse, bât. A',
        dommages: "Plafonds du 3e étage et de la cage d'escalier",
        assurance: { compagnie: 'AXA', compagnieId: 'demo-compagnie-axa', numeroSinistre: 'AXA-26-004512', courtier: null, contrat: null },
        carnetEntretien: true,
        publieExtranet: true,
        notes: "Bâche posée sur la toiture en attendant l'expertise.",
        responsable: collaborateur('AD'),
        assistant: collaborateur('SV'),
      }),
    ),
  },
  {
    id: 'demo-sinistre-lm-31',
    ...creerSinistre(
      saisieDemo({
        coproprieteId: 'C1',
        numero: 'LM.00031',
        type: 'Bris de glace',
        phase: 'Indemnités',
        dateOuverture: composerDateIso(2025, 12, 18),
        dateSurvenance: composerDateIso(2025, 12, 18),
        dateDeclaration: composerDateIso(2025, 12, 19),
        dateReglement: composerDateIso(2026, 2, 20),
        dateCloture: composerDateIso(2026, 3, 2),
        partiesCommunesLesees: true,
        origine: 'Choc accidentel',
        lieu: "Hall d'entrée",
        dommages: 'Vitrage de la porte du hall',
        assurance: { compagnie: 'MMA', compagnieId: 'demo-compagnie-mma', numeroSinistre: 'MMA-25-778301', courtier: null, contrat: null },
        indemniteImmediateCentimes: 124_000,
        indemniteImmediateReglee: true,
        causesSupprimees: true,
        reparationsFaites: true,
        parties: [{ role: 'Responsable', nature: 'Entreprise', refId: null, libelle: 'Entreprise de déménagement (tiers)' }],
        responsable: collaborateur('ML'),
      }),
    ),
  },
]
