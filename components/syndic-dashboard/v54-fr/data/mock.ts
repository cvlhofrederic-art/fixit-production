// Données mock partagées du dashboard syndic judiciaire FR — port byte-exact du
// mockup v8 (« DONNÉES (cohérentes, fictives) »). Consommées par ~30 modules.
// Cabinet fictif désigné par le TJ de Nanterre (92). Le branchement aux vraies
// données (/api/syndic/*) viendra dans des lots ultérieurs, comme côté PT.

import type { PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import type { IconName } from '@/lib/syndic/icon-names'

export interface Copro {
  id: string
  code: string
  nom: string
  lots: number
  adresse: string
  fondement: string
  motif: string
  tribunal: string
  rg: string
  ordonnance: string
  dureeMois: number
  echeance: string
  statut: string
  pill: PillKind
  budget: number
  depense: number
  impayes: number
  fondsTravaux: number
  notifOrdonnance: string
}

export const COPROS: Copro[] = [
  { id: 'C1', code: 'LM', nom: 'Résidence Le Méridien', lots: 36, adresse: '14 rue de Verdun, 92000 Nanterre',
    fondement: 'art. 46 — carence', motif: "AG régulièrement convoquée n'a pu désigner de syndic (majorité art. 25 non atteinte)",
    tribunal: 'TJ Nanterre', rg: '26/00892', ordonnance: '12/03/2026', dureeMois: 12, echeance: '12/03/2027',
    statut: 'En cours', pill: 'sage', budget: 142000, depense: 58400, impayes: 8460, fondsTravaux: 14200, notifOrdonnance: 'Effectuée' },
  { id: 'C2', code: 'CV', nom: 'Le Clos des Vignes', lots: 48, adresse: '8 av. du Château, 92500 Rueil-Malmaison',
    fondement: 'art. 46 — carence', motif: "Démission du syndic, AG n'a pu réélire (égalité des voix)",
    tribunal: 'TJ Nanterre', rg: '25/03517', ordonnance: '22/07/2025', dureeMois: 12, echeance: '22/07/2026',
    statut: 'Échéance proche', pill: 'amber', budget: 198000, depense: 151200, impayes: 21750, fondsTravaux: 31400, notifOrdonnance: 'Effectuée' },
  { id: 'C3', code: 'TL', nom: 'Copropriété Les Tilleuls', lots: 24, adresse: '3 rue des Lilas, 92100 Boulogne-Billancourt',
    fondement: 'art. 29-1 — difficulté', motif: 'Administration provisoire — déséquilibre financier grave (impayés > 25 %)',
    tribunal: 'TJ Nanterre', rg: '24/04521', ordonnance: '05/11/2024', dureeMois: 18, echeance: '05/05/2026',
    statut: 'Prorogation demandée', pill: 'rust', budget: 96000, depense: 88200, impayes: 34800, fondsTravaux: 2100, notifOrdonnance: 'Effectuée' },
  { id: 'C4', code: 'VM', nom: 'Villa Montaigne', lots: 12, adresse: '21 bd Victor Hugo, 92200 Neuilly-sur-Seine',
    fondement: 'art. 46 — carence', motif: "Syndicat dépourvu de syndic, requête d'un copropriétaire",
    tribunal: 'TJ Nanterre', rg: '26/01044', ordonnance: '28/04/2026', dureeMois: 9, echeance: '28/01/2027',
    statut: 'Notification en cours', pill: 'gold', budget: 54000, depense: 9800, impayes: 0, fondsTravaux: 6300, notifOrdonnance: 'En cours' },
]

export const TOTAL_LOTS = COPROS.reduce((s, c) => s + c.lots, 0)
export const TOTAL_BUDGET = COPROS.reduce((s, c) => s + c.budget, 0)
export const TOTAL_DEPENSE = COPROS.reduce((s, c) => s + c.depense, 0)
export const TOTAL_IMPAYES = COPROS.reduce((s, c) => s + c.impayes, 0)

export const COPRO_NAMES = COPROS.map((c) => c.nom)

/** Copropriété par code (fallback : la première). */
export const byCode = (c: string): Copro => COPROS.find((x) => x.code === c) || COPROS[0]

export interface Coproprietaire {
  id: string
  nom: string
  copro: string
  lot: string
  tantiemes: string
  solde: number
  statut: string
  pill: PillKind
  tel: string
  mail: string
}

export const COPROPRIETAIRES: Coproprietaire[] = [
  { id: 'P1', nom: 'Laurent Mercier', copro: 'Résidence Le Méridien', lot: 'Lot 12 — Apt B3', tantiemes: '412/10000', solde: 0, statut: 'À jour', pill: 'sage', tel: '06 12 34 56 78', mail: 'l.mercier@email.fr' },
  { id: 'P2', nom: 'Sophie Garnier', copro: 'Le Clos des Vignes', lot: 'Lot 27 — Apt 4G', tantiemes: '308/10000', solde: -1840, statut: 'Impayé', pill: 'rust', tel: '06 22 11 90 04', mail: 'sophie.garnier@email.fr' },
  { id: 'P3', nom: 'Karim Benali', copro: 'Le Clos des Vignes', lot: 'Lot 5 — Apt 1B', tantiemes: '276/10000', solde: -620, statut: 'Retard', pill: 'amber', tel: '07 60 18 22 41', mail: 'k.benali@email.fr' },
  { id: 'P4', nom: 'Inès Lefèvre', copro: 'Résidence Le Méridien', lot: 'Lot 31 — Apt C2', tantiemes: '350/10000', solde: 0, statut: 'À jour', pill: 'sage', tel: '06 84 55 12 33', mail: 'ines.lefevre@email.fr' },
  { id: 'P5', nom: 'SCI Belvédère', copro: 'Copropriété Les Tilleuls', lot: 'Lots 8-9 — Local', tantiemes: '640/10000', solde: -9200, statut: 'Contentieux', pill: 'rust', tel: '01 47 02 88 10', mail: 'gestion@sci-belvedere.fr' },
  { id: 'P6', nom: 'Hélène Dubois', copro: 'Villa Montaigne', lot: 'Lot 4 — Apt 2A', tantiemes: '820/10000', solde: 0, statut: 'À jour', pill: 'sage', tel: '06 33 77 41 09', mail: 'h.dubois@email.fr' },
  { id: 'P7', nom: 'Antoine Rousseau', copro: 'Copropriété Les Tilleuls', lot: 'Lot 14 — Apt 3C', tantiemes: '395/10000', solde: -2480, statut: 'Impayé', pill: 'rust', tel: '07 81 24 60 55', mail: 'a.rousseau@email.fr' },
  { id: 'P8', nom: 'Mathilde Faure', copro: 'Résidence Le Méridien', lot: 'Lot 7 — Apt A1', tantiemes: '288/10000', solde: 0, statut: 'À jour', pill: 'sage', tel: '06 19 44 72 88', mail: 'm.faure@email.fr' },
]

export interface Prestataire {
  id: string
  nom: string
  metier: string
  ville: string
  note: string
  interventions: number
  statut: string
  pill: PillKind
  siret: string
  decennale: string
}

export const PRESTATAIRES: Prestataire[] = [
  { id: 'F1', nom: 'Atlantic Plomberie SARL', metier: 'Plomberie / chauffage', ville: 'Nanterre', note: '4,8', interventions: 12, statut: 'Référencé', pill: 'sage', siret: '492 118 332 00027', decennale: 'Oui' },
  { id: 'F2', nom: 'ELEC92 Services', metier: 'Électricité', ville: 'Rueil-Malmaison', note: '4,6', interventions: 9, statut: 'Référencé', pill: 'sage', siret: '811 204 559 00018', decennale: 'Oui' },
  { id: 'F3', nom: 'OTIS Maintenance', metier: 'Ascensoriste', ville: 'Île-de-France', note: '4,5', interventions: 4, statut: 'Contrat cadre', pill: 'gold', siret: '542 097 904 00115', decennale: 'N/A' },
  { id: 'F4', nom: 'Couverture Île-de-France', metier: 'Couverture / étanchéité', ville: 'Boulogne', note: '4,7', interventions: 6, statut: 'Référencé', pill: 'sage', siret: '790 553 118 00022', decennale: 'Oui' },
  { id: 'F5', nom: 'Vert Pro Espaces', metier: 'Espaces verts', ville: 'Neuilly', note: '4,4', interventions: 5, statut: 'Référencé', pill: 'sage', siret: '833 661 209 00010', decennale: 'N/A' },
  { id: 'F6', nom: 'Net Hall Propreté', metier: 'Nettoyage parties communes', ville: 'Nanterre', note: '4,3', interventions: 14, statut: 'Référencé', pill: 'sage', siret: '521 480 663 00031', decennale: 'N/A' },
  { id: 'F7', nom: 'Serrurerie Express 92', metier: 'Serrurerie / urgences', ville: 'Courbevoie', note: '4,2', interventions: 3, statut: 'Sur appel', pill: 'amber', siret: '884 552 100 00014', decennale: 'N/A' },
  { id: 'F8', nom: 'Façade & Ravalement IDF', metier: 'Façades / ravalement', ville: 'Rueil', note: '4,6', interventions: 2, statut: 'Devis en cours', pill: 'amber', siret: '901 226 778 00019', decennale: 'Oui' },
  { id: 'F9', nom: 'Sécurité Incendie 92', metier: 'Sécurité incendie', ville: 'Nanterre', note: '4,9', interventions: 7, statut: 'Contrat cadre', pill: 'gold', siret: '448 990 221 00025', decennale: 'N/A' },
]

export interface Obligation {
  id: string
  objet: string
  copro: string
  base: string
  date: string
  statut: string
  pill: PillKind
  note: string
}

/** Échéances / obligations légales — moteur de conformité. */
export const OBLIGATIONS: Obligation[] = [
  { id: 'O1', objet: 'Convocation AG élective', copro: 'Le Clos des Vignes', base: 'art. 17 L.1965 / art. 46 décret', date: '22/05/2026', statut: 'À faire', pill: 'rust', note: 'Au plus tard 2 mois avant fin de mission (22/07/2026)' },
  { id: 'O2', objet: "Notification de l'ordonnance", copro: 'Villa Montaigne', base: 'art. 64 décret 1967', date: '28/05/2026', statut: 'En cours', pill: 'amber', note: 'Dans le mois suivant le prononcé (28/04/2026)' },
  { id: 'O3', objet: 'Reddition de comptes au tribunal', copro: 'Copropriété Les Tilleuls', base: 'art. 29-1 et s. L.1965', date: '05/06/2026', statut: 'À faire', pill: 'rust', note: "Rapport de gestion de la période d'administration" },
  { id: 'O4', objet: 'État de frais et honoraires (taxation)', copro: 'Résidence Le Méridien', base: 'art. 704-718 CPC', date: '30/06/2026', statut: 'À préparer', pill: 'amber', note: 'Soumis au juge taxateur (président du TJ)' },
  { id: 'O5', objet: 'Immatriculation / MAJ registre des copropriétés', copro: 'Villa Montaigne', base: 'loi ALUR — art. L.711-2 CCH', date: '28/07/2026', statut: 'À faire', pill: 'amber', note: "Registre tenu par l'ANAH" },
  { id: 'O6', objet: 'Renouvellement assurance RC', copro: 'Le Clos des Vignes', base: 'art. 9-1 L.1965', date: '31/08/2026', statut: 'Planifié', pill: 'sage', note: 'Assurance obligatoire de la copropriété' },
  { id: 'O7', objet: 'Compte bancaire séparé — vérification', copro: 'Résidence Le Méridien', base: 'art. 18 L.1965', date: '15/06/2026', statut: 'Conforme', pill: 'sage', note: 'Compte séparé ouvert au nom du syndicat' },
  { id: 'O8', objet: 'DPE collectif', copro: 'Copropriété Les Tilleuls', base: 'loi Climat 2021', date: '31/12/2026', statut: 'Planifié', pill: 'sage', note: 'Obligation échelonnée selon nombre de lots' },
  { id: 'O9', objet: 'Plan pluriannuel de travaux (PPT)', copro: 'Le Clos des Vignes', base: 'loi Climat — art. 14-2 L.1965', date: '01/01/2027', statut: 'À engager', pill: 'amber', note: "Projet à soumettre au vote de l'AG" },
  { id: 'O10', objet: 'Alimentation fonds de travaux', copro: 'Copropriété Les Tilleuls', base: 'loi ALUR — art. 14-2 L.1965', date: 'En continu', statut: 'Sous-doté', pill: 'rust', note: 'Cotisation min. 5 % du budget prévisionnel' },
]

export interface Honoraire {
  id: string
  copro: string
  periode: string
  diligences: string
  montant: number
  statut: string
  pill: PillKind
}

/** Honoraires (auxiliaire de justice — CPC 704-718). */
export const HONORAIRES: Honoraire[] = [
  { id: 'H1', copro: 'Résidence Le Méridien', periode: 'T1 2026', diligences: 'Gestion courante + convocation AG', montant: 6200, statut: 'En attente de taxation', pill: 'amber' },
  { id: 'H2', copro: 'Le Clos des Vignes', periode: 'T4 2025', diligences: 'Reprise des comptes + recouvrement', montant: 8900, statut: 'Taxé', pill: 'sage' },
  { id: 'H3', copro: 'Copropriété Les Tilleuls', periode: '2025', diligences: 'Administration provisoire — exercice complet', montant: 14400, statut: 'Taxé', pill: 'sage' },
  { id: 'H4', copro: 'Villa Montaigne', periode: 'T2 2026', diligences: 'Constitution dossier + notification ordonnance', montant: 3100, statut: 'Provisionné', pill: 'gold' },
]

export type NotificationKind = 'legal' | 'debt' | 'payment' | 'mission' | 'insurance' | 'ag' | 'message' | 'equipa'

export interface NotificationItem {
  id: string
  kind: NotificationKind
  icon: IconName
  time: string
  title: string
  desc: string
}

/** Notifications (topbar). */
export const NOTIFICATIONS: NotificationItem[] = [
  { id: 'n01', kind: 'legal', icon: 'scale', time: 'il y a 8 min', title: 'AG élective à convoquer', desc: 'Le Clos des Vignes · échéance de mission 22/07/2026 · convocation requise avant le 22/05' },
  { id: 'n02', kind: 'debt', icon: 'alert', time: 'il y a 25 min', title: 'Impayé en contentieux', desc: 'SCI Belvédère · Les Tilleuls · 9 200 € · mise en demeure à signifier' },
  { id: 'n03', kind: 'payment', icon: 'coin', time: 'il y a 40 min', title: 'Honoraires taxés', desc: 'Les Tilleuls · état de frais 2025 taxé par le juge (14 400 €)' },
  { id: 'n04', kind: 'mission', icon: 'doc', time: 'il y a 1 h', title: 'Notification ordonnance', desc: 'Villa Montaigne · 9/12 copropriétaires notifiés (art. 64 décret)' },
  { id: 'n05', kind: 'insurance', icon: 'shield', time: 'il y a 2 h', title: 'Sinistre déclaré', desc: 'Le Clos des Vignes · dégât des eaux 4e étage · #SIN-2026-014' },
  { id: 'n06', kind: 'ag', icon: 'bank', time: 'il y a 3 h', title: 'PV en attente de signature', desc: 'Le Méridien · AG du 18/05 · signature électronique du président' },
  { id: 'n07', kind: 'legal', icon: 'scale', time: 'hier', title: 'Prorogation à demander', desc: 'Les Tilleuls · mission art. 29-1 expirée le 05/05 · requête au TJ' },
  { id: 'n08', kind: 'message', icon: 'chat', time: 'hier', title: 'Léa — anomalies comptables', desc: 'Le Clos des Vignes · 3 écritures à valider sur le compte séparé' },
  { id: 'n09', kind: 'equipa', icon: 'users', time: 'il y a 2 j', title: 'Collaborateur ajouté', desc: 'Camille Noël a rejoint le cabinet — Juriste copropriété' },
  { id: 'n10', kind: 'payment', icon: 'bank', time: 'il y a 2 j', title: 'Mouvement fonds de travaux', desc: '+1 800 € · fonds de travaux du Méridien (loi ALUR)' },
  { id: 'n11', kind: 'mission', icon: 'fact', time: 'il y a 3 j', title: 'Immatriculation registre', desc: "Villa Montaigne · mise à jour à transmettre à l'ANAH avant le 28/07" },
  { id: 'n12', kind: 'ag', icon: 'pencil', time: 'il y a 4 j', title: 'Ordre du jour à finaliser', desc: 'AG élective Clos des Vignes · désignation du syndic à inscrire' },
]
