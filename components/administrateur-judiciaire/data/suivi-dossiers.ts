/**
 * Dossier suivi : `mois` = minutes passées ce mois-ci, `budget` = minutes prévues, `derniere` « JJ/MM »,
 * `echeance` « JJ/MM/AAAA » ou « — », `retard` en jours.
 */
export interface DossierSuivi {
  code: string
  nom: string
  gest: string
  mois: number
  budget: number
  derniere: string
  echeance: string
  retard: number
}

/** État initial de l'écran de suivi des dossiers (ne pas muter). */
export const DEMO_DOSSIERS_SUIVI: DossierSuivi[] = [
  {
    code: 'LM',
    nom: 'Résidence Le Méridien',
    gest: 'Awa Diallo',
    mois: 740,
    budget: 1200,
    derniere: '18/06',
    echeance: '08/07/2026',
    retard: 1,
  },
  {
    code: 'CV',
    nom: 'Le Clos des Vignes',
    gest: 'Marc Léautaud',
    mois: 1320,
    budget: 1200,
    derniere: '02/06',
    echeance: '15/06/2026',
    retard: 17,
  },
  {
    code: 'TL',
    nom: 'Copropriété Les Tilleuls',
    gest: 'Awa Diallo',
    mois: 980,
    budget: 1500,
    derniere: '17/06',
    echeance: '20/06/2026',
    retard: 2,
  },
  {
    code: 'VM',
    nom: 'Villa Montaigne',
    gest: 'Sophie Vidal',
    mois: 210,
    budget: 600,
    derniere: '09/06',
    echeance: '—',
    retard: 10,
  },
]

/** Diligence accomplie : date « JJ/MM », auteur, description. */
export interface DiligenceDossier {
  d: string
  q: string
  t: string
}

export interface EtapeChecklistDossier {
  label: string
  done: boolean
}

export interface DetailDossierSuivi {
  echObjet: string
  diligences: DiligenceDossier[]
  checklist: EtapeChecklistDossier[]
  pieces: string[]
}

/**
 * Détail par code de copropriété. Les libellés de checklist orientent le choix du modèle de courrier
 * (mots-clés lus par preparerCourrierEtapeDossier).
 */
export const DEMO_DETAILS_DOSSIERS_SUIVI: Record<string, DetailDossierSuivi> = {
  LM: {
    echObjet: "Convocation de l'AG élective",
    diligences: [
      { d: '18/06', q: 'Awa Diallo', t: "Préparation de l'ordre du jour de l'AG élective" },
      { d: '05/06', q: 'Julien Marchand', t: 'Reddition de comptes 2025 finalisée et rapprochée sur le compte séparé' },
      { d: '20/05', q: 'Awa Diallo', t: 'Relance amiable des 4 copropriétaires débiteurs (8 460 €)' },
      { d: '14/03', q: 'Cabinet Delaunay', t: "Prise de fonction et notification de l'ordonnance aux copropriétaires" },
    ],
    checklist: [
      { label: "Notification de l'ordonnance (art. 59 décret 1967)", done: true },
      { label: 'Ouverture du compte bancaire séparé', done: true },
      { label: 'Reddition de comptes 2025', done: true },
      { label: "Convocation de l'AG élective (J-21)", done: false },
      { label: 'Recouvrement des impayés (8 460 €)', done: false },
      { label: 'Rapport de fin de mission au tribunal', done: false },
    ],
    pieces: [
      'Ordonnance de désignation',
      'Notification aux copropriétaires',
      'Reddition de comptes 2025',
      'État daté des impayés',
    ],
  },
  CV: {
    echObjet: 'Dépôt du rapport semestriel au juge',
    diligences: [
      { d: '02/06', q: 'Marc Léautaud', t: 'Visite technique — relevé des désordres de façade' },
      { d: '12/05', q: 'Julien Marchand', t: 'Apurement partiel de la dette fournisseurs (-12 000 €)' },
      { d: '20/04', q: 'Camille Noël', t: "Plan d'apurement sur 18 mois soumis au conseil syndical" },
      { d: '22/07', q: 'Cabinet Delaunay', t: 'Prise de fonction, diagnostic financier initial' },
    ],
    checklist: [
      { label: 'Diagnostic financier initial', done: true },
      { label: 'Négociation des échéanciers fournisseurs', done: true },
      { label: "Plan d'apurement (18 mois)", done: true },
      { label: 'Rapport semestriel au juge', done: false },
      { label: 'Recouvrement des impayés (21 750 €)', done: false },
    ],
    pieces: [
      'Ordonnance de désignation',
      'Diagnostic financier',
      "Plan d'apurement 18 mois",
      'Procès-verbal du conseil syndical',
    ],
  },
  TL: {
    echObjet: "Validation des travaux d'étanchéité de toiture",
    diligences: [
      { d: '17/06', q: 'Marc Léautaud', t: 'Devis étanchéité toiture validé (Couverture ÎdF — 18 400 € HT)' },
      { d: '10/06', q: 'Camille Noël', t: 'Mise en demeure des 3 principaux débiteurs' },
      { d: '28/05', q: 'Julien Marchand', t: 'Audit de la dette : 51 000 € ramenés à 34 800 €' },
      { d: '11/01', q: 'Cabinet Delaunay', t: 'Prise de fonction — copropriété en difficulté (art. 29-1)' },
    ],
    checklist: [
      { label: 'Audit de la dette et des engagements', done: true },
      { label: 'Ordre de mission — étanchéité toiture', done: true },
      { label: 'Validation du devis (18 400 € HT)', done: true },
      { label: 'Convocation AG travaux', done: false },
      { label: 'Recouvrement des impayés (34 800 €)', done: false },
    ],
    pieces: ['Ordonnance de désignation', 'Devis Couverture Île-de-France', 'État des impayés', 'Mises en demeure'],
  },
  VM: {
    echObjet: '—',
    diligences: [
      { d: '09/06', q: 'Sophie Vidal', t: "Mise à jour du carnet d'entretien de l'immeuble" },
      { d: '15/05', q: 'Cabinet Delaunay', t: 'Prise de fonction et état des lieux' },
    ],
    checklist: [
      { label: "Notification de l'ordonnance", done: true },
      { label: 'Compte bancaire séparé', done: true },
      { label: "Contrats d'assurance vérifiés (RC art. 9-1 ALUR)", done: true },
      { label: 'Préparation du budget prévisionnel', done: false },
    ],
    pieces: ['Ordonnance de désignation', "État des lieux d'entrée", "Attestations d'assurance"],
  },
}
