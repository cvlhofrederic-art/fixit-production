// ── Espace de démonstration ───────────────────────────────────────────────────
//
// Même forme que les données réelles (EspaceCopro), pour le visiteur sans compte et pour
// le super admin dont le cabinet n'a aucune fiche. Récit cohérent avec lib/copro-demo-data.ts
// (Géraldine Xavier, Résidence Le Prado à Marseille, AG du 19 novembre 2026) et avec le
// cabinet de démo Syndic v54. Dates fixes autour d'octobre 2026, jamais calculées du jour.
// Module sans React ni navigateur : lu aussi par l'assistant Fixy (lib/copro-ia-contexte.ts).

import { AG_DEMO, PROFILE_DEMO, SYNDIC_DEMO } from '@/lib/copro-demo-data'
import type {
  AssembleeCopro, DemandeCopro, EspaceCopro, InterventionVue, ResolutionCopro,
} from '@/lib/coproprietaire/types'

/** IBAN fictif (clé de contrôle fantaisiste) affiché dans la démonstration. */
export const IBAN_DEMO = 'FR76 3000 6000 0112 3456 7890 189'

const INTERVENTION_COLONNE: InterventionVue = {
  id: 'demo-int-3',
  type: 'Plomberie',
  description: 'Fuite sur la colonne d’eau froide, palier du 4e étage du bâtiment D',
  prestataire: 'Plomberie du Vieux-Port',
  statut: 'terminee',
  priorite: 'urgente',
  dateCreation: '2026-09-15',
  datePrevue: '2026-09-16',
  partieCommune: true,
  zone: 'Couloir / palier',
  batiment: 'D',
  etage: '4',
  numLot: '',
  montantDevis: 420,
  montantFacture: 420,
  compteRendu: {
    travailEffectue: 'Remplacement du raccord défectueux sur la colonne d’eau froide et reprise de l’étanchéité du plafond.',
    materiauxUtilises: 'Raccord laiton 20/27, joints, enduit de rebouchage',
    problemesConstates: 'Raccord oxydé ; traces d’humidité anciennes sur le plafond du palier.',
    recommandations: 'Contrôler les autres raccords de la colonne lors de la prochaine visite d’entretien.',
    dureeIntervention: '2 h',
    dateRapport: '2026-09-16',
  },
  documents: [
    { type: 'facture', reference: 'FAC-2026-0931', montantTtc: 420, description: 'Réparation colonne eau froide — palier 4e', date: '2026-09-17' },
  ],
  estLaMienne: true,
  signalementId: 'demo-sig-2',
}

const INTERVENTIONS_IMMEUBLE: InterventionVue[] = [
  {
    id: 'demo-int-4',
    type: 'Électricité',
    description: 'Éclairage du parking en panne (niveau -1)',
    prestataire: 'Élec Services Phocéens',
    statut: 'acceptee',
    priorite: 'normale',
    dateCreation: '2026-10-14',
    datePrevue: '2026-10-21',
    partieCommune: true,
    zone: 'Parking / garage',
    batiment: '',
    etage: '',
    numLot: '',
    montantDevis: 380,
    montantFacture: null,
    compteRendu: null,
    documents: [{ type: 'devis', reference: 'DEV-2026-204', montantTtc: 380, description: 'Remplacement de 6 blocs d’éclairage LED', date: '2026-10-15' }],
    estLaMienne: false,
    signalementId: null,
  },
  {
    id: 'demo-int-2',
    type: 'Peinture',
    description: 'Remise en peinture du hall d’entrée et de la cage d’escalier du bâtiment D',
    prestataire: 'Peinture & Décor Méditerranée',
    statut: 'en_cours',
    priorite: 'planifiee',
    dateCreation: '2026-10-06',
    datePrevue: '2026-10-13',
    partieCommune: true,
    zone: 'Hall d’entrée',
    batiment: 'D',
    etage: '',
    numLot: '',
    montantDevis: 3480,
    montantFacture: null,
    compteRendu: null,
    documents: [{ type: 'devis', reference: 'DEV-2026-188', montantTtc: 3480, description: 'Peinture hall et cage d’escalier, 2 couches', date: '2026-10-02' }],
    estLaMienne: false,
    signalementId: null,
  },
  {
    id: 'demo-int-1',
    type: 'Ascenseur',
    description: 'Visite d’entretien semestrielle et remplacement des patins de guidage de la cabine',
    prestataire: 'Ascenseurs Phocéens',
    statut: 'terminee',
    priorite: 'normale',
    dateCreation: '2026-09-22',
    datePrevue: '2026-09-29',
    partieCommune: true,
    zone: 'Ascenseur',
    batiment: 'D',
    etage: '',
    numLot: '',
    montantDevis: 1240,
    montantFacture: 1240,
    compteRendu: {
      travailEffectue: 'Remplacement des patins de guidage de la cabine, contrôle des portes palières et du parachute.',
      materiauxUtilises: 'Jeu de patins de guidage, graisse',
      problemesConstates: 'Usure normale des patins ; carte de manœuvre vieillissante.',
      recommandations: 'Prévoir le remplacement de la carte de manœuvre au budget 2027.',
      dureeIntervention: '3 h',
      dateRapport: '2026-09-29',
    },
    documents: [{ type: 'facture', reference: 'FAC-2026-0118', montantTtc: 1240, description: 'Entretien semestriel + patins de guidage', date: '2026-09-30' }],
    estLaMienne: false,
    signalementId: null,
  },
  INTERVENTION_COLONNE,
]

const MES_DEMANDES: DemandeCopro[] = [
  {
    id: 'demo-sig-1',
    type: 'Ascenseur',
    description: 'Bruit anormal de l’ascenseur du bâtiment D entre le 3e et le 4e étage, surtout le matin.',
    priorite: 'normale',
    statut: 'en_attente',
    partieCommune: true,
    zone: 'Ascenseur',
    batiment: 'D',
    etage: '4',
    numLot: '12',
    prestataire: '',
    creeLe: '2026-09-29T08:45:00+02:00',
    misAJourLe: '2026-09-30T10:12:00+02:00',
    origine: 'portail',
    messages: [
      { id: 'demo-msg-1', auteur: SYNDIC_DEMO, role: 'syndic', texte: 'Demande bien reçue : nous contactons l’ascensoriste pour une visite de contrôle.', date: '2026-09-30T10:12:00+02:00', deMoi: false },
    ],
    intervention: null,
  },
  {
    id: 'demo-sig-2',
    type: 'Plomberie',
    description: 'Fuite d’eau au plafond du palier du 4e étage, l’eau coule sur les boîtes aux lettres.',
    priorite: 'urgente',
    statut: 'terminee',
    partieCommune: true,
    zone: 'Couloir / palier',
    batiment: 'D',
    etage: '4',
    numLot: '12',
    prestataire: 'Plomberie du Vieux-Port',
    creeLe: '2026-09-15T07:30:00+02:00',
    misAJourLe: '2026-09-16T17:05:00+02:00',
    origine: 'portail',
    messages: [
      { id: 'demo-msg-2', auteur: `${PROFILE_DEMO.prenom} ${PROFILE_DEMO.nom}`, role: 'coproprio', texte: 'Merci de faire vite, l’eau coule depuis ce matin.', date: '2026-09-15T07:32:00+02:00', deMoi: true },
      { id: 'demo-msg-3', auteur: SYNDIC_DEMO, role: 'syndic', texte: 'Mission confiée à Plomberie du Vieux-Port (plombier) — intervention prévue le 16 septembre 2026.', date: '2026-09-15T09:10:00+02:00', deMoi: false },
      { id: 'demo-msg-4', auteur: SYNDIC_DEMO, role: 'syndic', texte: 'Intervention terminée : le raccord a été remplacé et le plafond sera repeint avec le hall en octobre.', date: '2026-09-16T17:05:00+02:00', deMoi: false },
    ],
    intervention: INTERVENTION_COLONNE,
  },
]

const PV_AG_2026 = `Procès-verbal de l'assemblée générale ordinaire du 11 juin 2026 — Résidence Le Prado.
Présents et représentés : 7 650 tantièmes sur 10 000. Le quorum est atteint.
Résolution 1 — Approbation des comptes 2025 : adoptée (7 150 pour, 450 contre, 600 abstentions).
Résolution 2 — Budget prévisionnel 2027 de 46 500 € : adoptée (6 800 pour, 900 contre, 500 abstentions).
Résolution 3 — Ravalement de la façade côté rue (85 000 € TTC, entreprise Renov'Bat) : adoptée (6 100 pour, 1 650 contre, 450 abstentions).
Résolution 4 — Renouvellement du mandat du Cabinet Dupont (2026-2029) : adoptée (5 600 pour, 1 900 contre, 700 abstentions).
La séance est levée à 20 h 15.`

const PV_AG_TOITURE = `Procès-verbal de l'assemblée générale extraordinaire du 20 septembre 2025 — Résidence Le Prado.
Résolution 1 — Réfection de la toiture du bâtiment D (52 000 € TTC) : adoptée (6 200 pour, 1 800 contre, 500 abstentions).
Résolution 2 — Emprunt collectif de 45 000 € sur 5 ans : rejetée (5 500 pour, 3 000 contre, 1 000 abstentions ; double majorité non atteinte).`

function assembleesDemo(): AssembleeCopro[] {
  const pv: Record<string, string> = { '3': PV_AG_2026, '2': PV_AG_TOITURE }
  return AG_DEMO.map(ag => ({
    id: `demo-ag-${ag.id}`,
    titre: ag.titre,
    date: `${ag.date}+01:00`,
    lieu: ag.lieu,
    type: ag.type,
    statut: ag.statut === 'cloturee' ? 'cloturee' : ag.statut === 'en_cours' ? 'en_cours' : 'convoquee',
    ordreDuJour: [...ag.ordreDuJour],
    resolutions: ag.resolutions.map((r, i): ResolutionCopro => ({
      id: `demo-res-${r.id}`,
      numero: i + 1,
      titre: r.titre,
      description: r.description,
      majorite: r.majorite,
      votePour: r.votePour,
      voteContre: r.voteContre,
      voteAbstention: r.voteAbstention,
      statut: r.statut === 'cloturee' ? (r.resultat === 'rejetée' ? 'rejetee' : 'adoptee') : 'en_cours',
      monVote: r.monVote ?? null,
      monVoteLe: r.monVote ? ag.date.slice(0, 10) : '',
    })),
    totalTantiemes: 10000,
    pv: pv[ag.id] ?? '',
    convocationEnvoyeeLe: ag.statut === 'convoquee' ? '2026-10-05' : '',
  }))
}

/** Espace de démonstration complet (source 'demo'). */
export function espaceDemo(chargeLe = '2026-10-17T09:00:00+02:00'): EspaceCopro {
  return {
    source: 'demo',
    vueSuperAdmin: false,
    chargeLe,
    profil: {
      id: 'demo',
      prenom: PROFILE_DEMO.prenom,
      nom: PROFILE_DEMO.nom,
      email: PROFILE_DEMO.email,
      telephone: PROFILE_DEMO.telephone,
      role: 'proprietaire',
      immeuble: PROFILE_DEMO.immeuble,
      batiment: PROFILE_DEMO.batiment,
      etage: PROFILE_DEMO.etage,
      numLot: PROFILE_DEMO.numLot,
      tantiemes: PROFILE_DEMO.tantiemes,
      quotePart: PROFILE_DEMO.quotePart,
      totalTantiemes: 10000,
      solde: -855,
      estOccupe: false,
    },
    autresLots: [],
    immeuble: {
      id: 'demo-immeuble',
      nom: PROFILE_DEMO.immeuble,
      adresse: '182 avenue du Prado',
      ville: 'Marseille',
      codePostal: '13008',
      nbLots: 48,
      anneeConstruction: 1972,
      typeImmeuble: 'Copropriété',
      gestionnaire: 'Hugo Carvalho',
      budgetAnnuel: 45000,
      depensesAnnee: 31200,
      reglement: {
        texte: '',
        pdfNom: 'Règlement de copropriété — Résidence Le Prado.pdf',
        dateMaj: '2020-03-10',
        chargesRepartition: 'Charges générales réparties aux tantièmes généraux ; ascenseur et chauffage selon les tantièmes spéciaux par bâtiment.',
        majoriteAg: 'Majorité de l’article 24 pour les décisions courantes ; article 25 pour les travaux.',
        fondsTravaux: true,
        fondsRoulementPct: 5,
      },
    },
    syndic: {
      nom: SYNDIC_DEMO,
      adresse: '45 avenue du Prado',
      ville: 'Marseille',
      codePostal: '13008',
      telephone: '04 91 00 00 00',
      email: 'contact@cabinet-dupont.fr',
    },
    interventions: { mesDemandes: MES_DEMANDES, immeuble: INTERVENTIONS_IMMEUBLE },
    finances: {
      solde: -855,
      appels: [
        { id: 'demo-appel-ravalement', exercice: 'Ravalement façade — 1er appel de fonds', periodeDebut: '2026-12-01', periodeFin: '2027-02-28', montantTotal: 1462.5, montantPaye: 0, resteAPayer: 1462.5, statut: 'a_payer', echeance: '2026-12-01', iban: IBAN_DEMO, referencePaiement: 'TRX-2026-001-LOT12' },
        { id: 'demo-appel-fonds', exercice: 'Fonds de travaux 2026 (art. 14-2-1)', periodeDebut: '2026-01-01', periodeFin: '2026-12-31', montantTotal: 220, montantPaye: 0, resteAPayer: 220, statut: 'a_payer', echeance: '2026-11-05', iban: IBAN_DEMO, referencePaiement: 'FDT-2026-001-LOT12' },
        { id: 'demo-appel-t4', exercice: '2026-T4', periodeDebut: '2026-10-01', periodeFin: '2026-12-31', montantTotal: 855, montantPaye: 0, resteAPayer: 855, statut: 'a_payer', echeance: '2026-10-15', iban: IBAN_DEMO, referencePaiement: 'PAY-2026-004-LOT12' },
        { id: 'demo-appel-t3', exercice: '2026-T3', periodeDebut: '2026-07-01', periodeFin: '2026-09-30', montantTotal: 855, montantPaye: 855, resteAPayer: 0, statut: 'solde', echeance: '2026-07-15', iban: IBAN_DEMO, referencePaiement: 'PAY-2026-003-LOT12' },
        { id: 'demo-appel-t2', exercice: '2026-T2', periodeDebut: '2026-04-01', periodeFin: '2026-06-30', montantTotal: 855, montantPaye: 855, resteAPayer: 0, statut: 'solde', echeance: '2026-04-15', iban: IBAN_DEMO, referencePaiement: 'PAY-2026-002-LOT12' },
        { id: 'demo-appel-t1', exercice: '2026-T1', periodeDebut: '2026-01-01', periodeFin: '2026-03-31', montantTotal: 855, montantPaye: 855, resteAPayer: 0, statut: 'solde', echeance: '2026-01-15', iban: IBAN_DEMO, referencePaiement: 'PAY-2026-001-LOT12' },
        { id: 'demo-appel-2025-t4', exercice: '2025-T4', periodeDebut: '2025-10-01', periodeFin: '2025-12-31', montantTotal: 830, montantPaye: 830, resteAPayer: 0, statut: 'solde', echeance: '2025-10-15', iban: IBAN_DEMO, referencePaiement: 'PAY-2025-004-LOT12' },
      ],
      factures: [
        { id: 'demo-fact-1', numero: 'FC-2026-0042', emiseLe: '2026-07-08', echeance: '2026-07-31', montantHt: 125, tvaTaux: 0, montantTtc: 125, description: 'Régularisation des charges 2025 — trop-perçu remboursé sur votre compte', statut: 'reglee', pdfDisponible: false },
        { id: 'demo-fact-2', numero: 'FC-2025-0117', emiseLe: '2025-11-02', echeance: '2025-11-30', montantHt: 10, tvaTaux: 20, montantTtc: 12, description: 'Frais de relance — charges du 4e trimestre 2025', statut: 'reglee', pdfDisponible: false },
      ],
      impayes: [],
    },
    documents: {
      fichiers: [
        { id: 'demo-doc-1', nom: 'Convocation AG extraordinaire du 19 novembre 2026.pdf', type: 'autre', categorie: 'convocation', personnel: false, mimeType: 'application/pdf', tailleOctets: 1_200_000, ajouteLe: '2026-10-05', tags: ['convocation'] },
        { id: 'demo-doc-2', nom: 'Devis chaudière à condensation — Thermo Services.pdf', type: 'devis', categorie: 'devis_approuve', personnel: false, mimeType: 'application/pdf', tailleOctets: 760_000, ajouteLe: '2026-10-05', tags: [] },
        { id: 'demo-doc-4', nom: 'PV AG ordinaire du 11 juin 2026.pdf', type: 'pv_assemblee', categorie: 'pv_ag', personnel: false, mimeType: 'application/pdf', tailleOctets: 2_400_000, ajouteLe: '2026-06-25', tags: [] },
        { id: 'demo-doc-5', nom: 'Comptes annuels 2025.pdf', type: 'autre', categorie: 'budget', personnel: false, mimeType: 'application/pdf', tailleOctets: 1_800_000, ajouteLe: '2026-05-12', tags: ['comptes'] },
        { id: 'demo-doc-6', nom: 'Budget prévisionnel 2027.pdf', type: 'autre', categorie: 'budget', personnel: false, mimeType: 'application/pdf', tailleOctets: 980_000, ajouteLe: '2026-05-12', tags: ['budget'] },
        { id: 'demo-doc-7', nom: 'Contrat de gardiennage 2026.pdf', type: 'contrat', categorie: 'contrat_entretien', personnel: false, mimeType: 'application/pdf', tailleOctets: 2_000_000, ajouteLe: '2026-08-20', tags: [] },
        { id: 'demo-doc-8', nom: 'Contrat d’assurance de l’immeuble 2026.pdf', type: 'contrat', categorie: 'assurance', personnel: false, mimeType: 'application/pdf', tailleOctets: 3_100_000, ajouteLe: '2026-01-02', tags: [] },
        { id: 'demo-doc-9', nom: 'PV AG extraordinaire toiture — 20 septembre 2025.pdf', type: 'pv_assemblee', categorie: 'pv_ag', personnel: false, mimeType: 'application/pdf', tailleOctets: 1_600_000, ajouteLe: '2025-10-01', tags: [] },
      ],
      contrats: [
        { id: 'demo-contrat-1', fournisseur: 'Gardiennage Sud Services', categorie: 'seguranca', coutMensuel: 1200, coutAnnuel: 14400, debut: '2026-01-01', fin: '2026-12-31', statut: 'ativo' },
        { id: 'demo-contrat-2', fournisseur: 'Propre & Net', categorie: 'limpezas', coutMensuel: 650, coutAnnuel: 7800, debut: '2026-01-01', fin: '2026-12-31', statut: 'ativo' },
        { id: 'demo-contrat-3', fournisseur: 'Ascenseurs Phocéens', categorie: 'elevadores', coutMensuel: 380, coutAnnuel: 4560, debut: '2025-07-01', fin: '2027-06-30', statut: 'ativo' },
      ],
      assurances: [
        { id: 'demo-assurance-1', assureur: 'AXA', type: 'multirriscos', police: 'MRI-2026-4471', primeAnnuelle: 4800, capital: 2_000_000, debut: '2026-01-01', fin: '2026-12-31', statut: 'ativa' },
      ],
    },
    assemblees: assembleesDemo(),
    annonces: [
      { id: 'demo-ann-2', titre: 'Convocation — AG extraordinaire du 19 novembre', contenu: 'L’assemblée générale extraordinaire se tiendra le jeudi 19 novembre 2026 à 18 h 00 à la salle polyvalente. Ordre du jour : remplacement de la chaudière collective, financement des travaux, DPE collectif. Vote par correspondance possible en ligne jusqu’au 16 novembre 2026.', categorie: 'assembleia', priorite: 'importante', epinglee: true, date: '2026-10-05', immeuble: PROFILE_DEMO.immeuble },
      { id: 'demo-ann-1', titre: 'Coupure d’eau froide — mardi 20 octobre', contenu: 'Une coupure d’eau froide est prévue le mardi 20 octobre 2026 de 9 h à 12 h pour le remplacement d’une vanne dans le local technique. Merci de prévoir vos réserves.', categorie: 'manutencao', priorite: 'urgente', epinglee: false, date: '2026-10-08', immeuble: PROFILE_DEMO.immeuble },
      { id: 'demo-ann-3', titre: 'Ravalement de la façade : calendrier des travaux', contenu: 'Les travaux de ravalement votés lors de l’AG du 11 juin 2026 débuteront le lundi 1er mars 2027, pour une durée estimée de 3 mois. Un échafaudage sera installé côté rue. Le premier appel de fonds (50 % de votre quote-part) est fixé au 1er décembre 2026.', categorie: 'manutencao', priorite: 'importante', epinglee: false, date: '2026-09-28', immeuble: PROFILE_DEMO.immeuble },
      { id: 'demo-ann-4', titre: 'Nouvelle gardienne', contenu: 'Mme Sophie Bernard a pris ses fonctions de gardienne le 1er septembre 2026. Elle est joignable à la loge du lundi au vendredi, de 8 h à 12 h et de 14 h à 18 h.', categorie: 'social', priorite: 'normal', epinglee: false, date: '2026-08-25', immeuble: '' },
    ],
  }
}
