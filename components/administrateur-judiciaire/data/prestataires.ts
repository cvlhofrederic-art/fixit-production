import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Prestataire } from '@/lib/administrateur-judiciaire/db/schema'
import { nouvelleFicheEntreprise, type FicheEntreprise } from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'

/** Prestataire référencé : `note` à virgule décimale et `decennale` « Oui » / « N/A » (convertis par le seed). */
export interface PrestataireDemo {
  id: string
  nom: string
  metier: string
  ville: string
  note: string
  interventions: number
  statut: string
  pill: 'sage' | 'gold' | 'amber'
  siret: string
  decennale: 'Oui' | 'N/A'
}

export const DEMO_PRESTATAIRES: PrestataireDemo[] = [
  {
    id: 'F1',
    nom: 'Atlantic Plomberie SARL',
    metier: 'Plomberie / chauffage',
    ville: 'Nanterre',
    note: '4,8',
    interventions: 12,
    statut: 'Référencé',
    pill: 'sage',
    siret: '492 118 332 00027',
    decennale: 'Oui',
  },
  {
    id: 'F2',
    nom: 'ELEC92 Services',
    metier: 'Électricité',
    ville: 'Rueil-Malmaison',
    note: '4,6',
    interventions: 9,
    statut: 'Référencé',
    pill: 'sage',
    siret: '811 204 559 00018',
    decennale: 'Oui',
  },
  {
    id: 'F3',
    nom: 'OTIS Maintenance',
    metier: 'Ascensoriste',
    ville: 'Île-de-France',
    note: '4,5',
    interventions: 4,
    statut: 'Contrat cadre',
    pill: 'gold',
    siret: '542 097 904 00115',
    decennale: 'N/A',
  },
  {
    id: 'F4',
    nom: 'Couverture Île-de-France',
    metier: 'Couverture / étanchéité',
    ville: 'Boulogne',
    note: '4,7',
    interventions: 6,
    statut: 'Référencé',
    pill: 'sage',
    siret: '790 553 118 00022',
    decennale: 'Oui',
  },
  {
    id: 'F5',
    nom: 'Vert Pro Espaces',
    metier: 'Espaces verts',
    ville: 'Neuilly',
    note: '4,4',
    interventions: 5,
    statut: 'Référencé',
    pill: 'sage',
    siret: '833 661 209 00010',
    decennale: 'N/A',
  },
  {
    id: 'F6',
    nom: 'Net Hall Propreté',
    metier: 'Nettoyage parties communes',
    ville: 'Nanterre',
    note: '4,3',
    interventions: 14,
    statut: 'Référencé',
    pill: 'sage',
    siret: '521 480 663 00031',
    decennale: 'N/A',
  },
  {
    id: 'F7',
    nom: 'Serrurerie Express 92',
    metier: 'Serrurerie / urgences',
    ville: 'Courbevoie',
    note: '4,2',
    interventions: 3,
    statut: 'Sur appel',
    pill: 'amber',
    siret: '884 552 100 00014',
    decennale: 'N/A',
  },
  {
    id: 'F8',
    nom: 'Façade & Ravalement IDF',
    metier: 'Façades / ravalement',
    ville: 'Rueil',
    note: '4,6',
    interventions: 2,
    statut: 'Devis en cours',
    pill: 'amber',
    siret: '901 226 778 00019',
    decennale: 'Oui',
  },
  {
    id: 'F9',
    nom: 'Sécurité Incendie 92',
    metier: 'Sécurité incendie',
    ville: 'Nanterre',
    note: '4,9',
    interventions: 7,
    statut: 'Contrat cadre',
    pill: 'gold',
    siret: '448 990 221 00025',
    decennale: 'N/A',
  },
]

/** Métiers proposés à la création d'un prestataire. */
export const METIERS_PRESTATAIRE = [
  'Plomberie / chauffage',
  'Électricité',
  'Ascensoriste',
  'Couverture / étanchéité',
  'Espaces verts',
  'Nettoyage',
  'Serrurerie',
  'Sécurité incendie',
] as const

export type MetierPrestataire = (typeof METIERS_PRESTATAIRE)[number]

const d = composerDateIso

/** Fiche commune de démonstration : chaque prestataire n'en précise que ce qui le distingue. */
const ficheDemo = (
  propre: Partial<FicheEntreprise> & Pick<FicheEntreprise, 'numero' | 'formeJuridique' | 'adresse' | 'codePostal'>,
): FicheEntreprise => nouvelleFicheEntreprise(propre)

/** Fiches de démonstration (entreprises et personnes fictives), par id de prestataire. */
export const FICHES_PRESTATAIRES_DEMO: Record<string, FicheEntreprise> = {
  F1: ficheDemo({
    numero: '00412',
    formeJuridique: 'SARL',
    reference: 'PLB-NAN',
    adresse: '12 rue de la République',
    codePostal: '92000',
    tvaIntracommunautaire: 'FR12 492118332',
    rcs: 'Nanterre',
    contacts: [
      { nom: 'Marc Delorme', civilite: 'Monsieur', fonction: 'Gérant' },
      { nom: 'Service dépannage', civilite: null, fonction: 'Astreinte 24 h/24' },
    ],
    telecoms: [
      { type: 'Courriel', nature: 'Général', prefere: true, valeur: 'contact@atlantic-plomberie.fr' },
      { type: 'Téléphone', nature: 'Astreinte', prefere: false, valeur: '01 47 00 00 00' },
      { type: 'Site web', nature: 'Général', prefere: false, valeur: 'atlantic-plomberie.fr' },
    ],
    vigilanceLe: d(2025, 11, 15),
    kbisLe: d(2026, 4, 2),
    domaines: ['Plomberie', 'Chauffage', 'Recherche de fuite'],
    intervientPour: ['Résidence Le Méridien', 'Le Clos des Vignes'],
    exclueDe: ['Villa Montaigne'],
    reglement: {
      mode: 'Virement',
      delaiJours: 30,
      unVirementPar: 'Facture',
      priorite: 2,
      iban: 'FR76 3000 6000 0112 3456 7890 427',
      bic: 'AGRIFRPP',
    },
    demandes: [
      { date: d(2026, 5, 28), nature: 'Demande', copropriete: 'Résidence Le Méridien', objet: "Fuite colonne d'eau bât. B" },
      { date: d(2026, 3, 12), nature: 'Devis', copropriete: 'Le Clos des Vignes', objet: 'Remplacement ballon eau chaude' },
    ],
    notes: 'Intervient sous 4 h en urgence.',
  }),
  F2: ficheDemo({
    numero: '00418',
    formeJuridique: 'SAS',
    adresse: '5 avenue Paul Doumer',
    codePostal: '92500',
    contacts: [{ nom: 'Nadia Benhamou', civilite: 'Madame', fonction: 'Responsable travaux' }],
    telecoms: [{ type: 'Courriel', nature: 'Général', prefere: true, valeur: 'contact@elec92.fr' }],
    vigilanceLe: d(2026, 2, 10),
    kbisLe: d(2026, 1, 20),
    domaines: ['Électricité', 'Éclairage des parties communes'],
    intervientPour: ['Résidence Le Méridien'],
  }),
  F3: ficheDemo({
    numero: '00031',
    formeJuridique: 'SCS',
    reference: 'ASC-CADRE',
    adresse: '9 place de la Défense',
    codePostal: '92400',
    contacts: [{ nom: 'Centre de relation clients', civilite: null, fonction: 'Pannes et dépannages' }],
    telecoms: [{ type: 'Téléphone', nature: 'Pannes', prefere: true, valeur: '01 40 00 00 01' }],
    vigilanceLe: d(2026, 3, 1),
    kbisLe: d(2026, 3, 1),
    domaines: ['Ascenseurs', 'Contrôle technique'],
    intervientPour: ['Résidence Le Méridien', 'Copropriété Les Tilleuls'],
    reglement: { mode: 'Prélèvement', delaiJours: 45, unVirementPar: 'Mandat', priorite: 1, iban: null, bic: null },
    notes: 'Contrat cadre : maintenance des ascenseurs.',
  }),
  F4: ficheDemo({
    numero: '00427',
    formeJuridique: 'SARL',
    adresse: '30 route de la Reine',
    codePostal: '92100',
    contacts: [{ nom: 'Julien Perrot', civilite: 'Monsieur', fonction: 'Chef de chantier' }],
    telecoms: [{ type: 'Mobile', nature: 'Chantier', prefere: true, valeur: '06 30 00 00 02' }],
    vigilanceLe: d(2025, 10, 2),
    domaines: ['Couverture', 'Étanchéité des toitures-terrasses'],
    intervientPour: ['Villa Montaigne'],
  }),
  F5: ficheDemo({
    numero: '00433',
    formeJuridique: 'EURL',
    adresse: '2 allée des Jardins',
    codePostal: '92200',
    domaines: ['Espaces verts', 'Élagage'],
    intervientPour: ['Le Clos des Vignes'],
  }),
  F6: ficheDemo({
    numero: '00440',
    formeJuridique: 'SAS',
    adresse: '45 rue Maurice Thorez',
    codePostal: '92000',
    telecoms: [{ type: 'Courriel', nature: 'Planning', prefere: true, valeur: 'planning@nethall.fr' }],
    vigilanceLe: d(2026, 4, 20),
    domaines: ['Nettoyage des parties communes', 'Sortie des conteneurs'],
    intervientPour: ['Résidence Le Méridien', 'Copropriété Les Tilleuls', 'Le Clos des Vignes'],
    reglement: {
      mode: 'Virement',
      delaiJours: 30,
      unVirementPar: 'Mandat',
      priorite: 2,
      iban: 'FR76 1027 8060 0000 0201 2340 155',
      bic: 'CMCIFR2A',
    },
  }),
  F7: ficheDemo({
    numero: '00446',
    formeJuridique: 'Entreprise individuelle',
    adresse: '7 rue de Bezons',
    codePostal: '92400',
    telecoms: [{ type: 'Mobile', nature: 'Urgences', prefere: true, valeur: '06 40 00 00 03' }],
    domaines: ['Serrurerie', 'Ouverture de porte'],
    reglement: { mode: 'Chèque', delaiJours: 0, unVirementPar: 'Facture', priorite: 3, iban: null, bic: null },
    notes: 'Sur appel uniquement, hors contrat.',
  }),
  F8: ficheDemo({
    numero: '00451',
    formeJuridique: 'SAS',
    adresse: '18 boulevard Richelieu',
    codePostal: '92500',
    contacts: [{ nom: 'Claire Moreau', civilite: 'Madame', fonction: 'Chargée d’affaires' }],
    vigilanceLe: d(2026, 5, 2),
    kbisLe: d(2026, 5, 2),
    domaines: ['Ravalement', 'Façades'],
    intervientPour: ['Copropriété Les Tilleuls'],
    demandes: [{ date: d(2026, 5, 15), nature: 'Devis', copropriete: 'Copropriété Les Tilleuls', objet: 'Ravalement façade sur rue' }],
  }),
  F9: ficheDemo({
    numero: '00058',
    formeJuridique: 'SAS',
    reference: 'SSI-CADRE',
    adresse: '1 rue des Pompiers',
    codePostal: '92000',
    telecoms: [{ type: 'Courriel', nature: 'Maintenance', prefere: true, valeur: 'maintenance@securite-incendie92.fr' }],
    vigilanceLe: d(2026, 1, 12),
    kbisLe: d(2026, 1, 12),
    domaines: ['Extincteurs', 'Désenfumage', 'Alarme incendie'],
    intervientPour: ['Résidence Le Méridien', 'Copropriété Les Tilleuls', 'Villa Montaigne', 'Le Clos des Vignes'],
    notes: 'Contrat cadre : vérifications annuelles.',
  }),
}

/**
 * Prestataire complété de sa fiche et de ses assurances de démonstration, s'il n'en a pas d'enregistrées (le jeu de
 * démonstration de la base reste inchangé). Sans effet sur un prestataire réel : ses identifiants ne sont pas F1 à F9.
 */
export function completerAvecDemo(prestataire: Prestataire): Prestataire {
  const assurances = ASSURANCES_PRESTATAIRES_DEMO[prestataire.id]
  return {
    ...prestataire,
    fiche: prestataire.fiche ?? FICHES_PRESTATAIRES_DEMO[prestataire.id],
    rcDecennaleEcheance: prestataire.rcDecennaleEcheance ?? assurances?.decennaleAu ?? null,
    rcpEcheance: prestataire.rcpEcheance ?? assurances?.rcpAu ?? null,
  }
}

/** Échéances des attestations d'assurance de démonstration (RC décennale, RCP), par id de prestataire. */
export const ASSURANCES_PRESTATAIRES_DEMO: Record<string, { decennaleAu: string | null; rcpAu: string | null }> = {
  F1: { decennaleAu: d(2026, 12, 31), rcpAu: d(2026, 6, 30) },
  F2: { decennaleAu: d(2026, 12, 31), rcpAu: d(2026, 12, 31) },
  F3: { decennaleAu: null, rcpAu: d(2026, 12, 31) },
  F4: { decennaleAu: d(2026, 5, 31), rcpAu: d(2026, 12, 31) },
  F5: { decennaleAu: null, rcpAu: null },
  F6: { decennaleAu: null, rcpAu: d(2027, 3, 31) },
  F7: { decennaleAu: null, rcpAu: d(2026, 9, 30) },
  F8: { decennaleAu: d(2027, 1, 31), rcpAu: d(2027, 1, 31) },
  F9: { decennaleAu: null, rcpAu: d(2026, 12, 31) },
}
