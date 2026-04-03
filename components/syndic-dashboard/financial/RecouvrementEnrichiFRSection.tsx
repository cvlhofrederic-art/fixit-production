'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type EtapePipeline =
  | 'relance_amiable'
  | 'mise_en_demeure_lrar'
  | 'commandement_payer'
  | 'assignation_tribunal'
  | 'jugement'
  | 'execution'

interface ActionTimeline {
  id: string
  date: string
  label: string
  type: 'courrier' | 'huissier' | 'tribunal' | 'auto' | 'paiement'
}

interface Debiteur {
  id: string
  coproprietaire: string
  lot: string
  immeuble: string
  email: string
  montantImpaye: number
  montantOriginal: number
  fraisLRAR: number
  fraisHuissier: number
  fraisAvocat: number
  joursRetard: number
  dateDebutImpaye: string
  dateEcheance: string
  etape: EtapePipeline
  derniereAction: string
  prochaineEtape: string
  dateDerniereRelance: string
  timeline: ActionTimeline[]
  recouvre: boolean
  montantRecouvre: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ETAPES_PIPELINE: { key: EtapePipeline; label: string; delai: string; icon: string }[] = [
  { key: 'relance_amiable',      label: 'Relance amiable',          delai: 'J+15',  icon: '\u2709' },
  { key: 'mise_en_demeure_lrar', label: 'Mise en demeure LRAR',     delai: 'J+30',  icon: '\u2709\uFE0F' },
  { key: 'commandement_payer',   label: 'Commandement de payer',    delai: 'J+60',  icon: '\u2696' },
  { key: 'assignation_tribunal', label: 'Assignation tribunal',     delai: 'J+90',  icon: '\uD83C\uDFDB' },
  { key: 'jugement',             label: 'Jugement',                 delai: 'Variable', icon: '\u2696\uFE0F' },
  { key: 'execution',            label: 'Execution',                delai: 'Variable', icon: '\uD83D\uDD12' },
]

const ETAPE_ORDER: EtapePipeline[] = [
  'relance_amiable', 'mise_en_demeure_lrar', 'commandement_payer',
  'assignation_tribunal', 'jugement', 'execution',
]

const TAUX_INTERET_LEGAL = 0.0422 // art. 36 decret 1967 — taux 2e semestre 2024

const TABS = [
  { key: 'pipeline',    label: 'Pipeline' },
  { key: 'debiteurs',   label: 'Suivi debiteurs' },
  { key: 'courriers',   label: 'Courriers types' },
  { key: 'stats',       label: 'Statistiques' },
] as const

type TabKey = (typeof TABS)[number]['key']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatDateLong = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const daysAgo = (d: number): string => {
  const dt = new Date()
  dt.setDate(dt.getDate() - d)
  return dt.toISOString().split('T')[0]
}

const calculerInteretsLegaux = (montant: number, joursRetard: number): number => {
  if (joursRetard <= 0) return 0
  return montant * TAUX_INTERET_LEGAL * (joursRetard / 365)
}

const calculerTotalCreance = (d: Debiteur): number => {
  const interets = calculerInteretsLegaux(d.montantOriginal, d.joursRetard)
  return d.montantImpaye + interets + d.fraisLRAR + d.fraisHuissier + d.fraisAvocat
}

const prescriptionDate = (dateEcheance: string): string => {
  const d = new Date(dateEcheance)
  d.setFullYear(d.getFullYear() + 5)
  return d.toISOString().split('T')[0]
}

const joursAvantPrescription = (dateEcheance: string): number => {
  const pDate = new Date(prescriptionDate(dateEcheance))
  return Math.ceil((pDate.getTime() - Date.now()) / 86400000)
}

// ─── Demo data (8 debiteurs) ─────────────────────────────────────────────────

const buildDemoData = (): Debiteur[] => [
  {
    id: 'deb_1',
    coproprietaire: 'Jean-Pierre Dumont',
    lot: '12',
    immeuble: 'Residence Les Oliviers',
    email: 'jp.dumont@email.fr',
    montantImpaye: 3450.00,
    montantOriginal: 3200.00,
    fraisLRAR: 8.50,
    fraisHuissier: 0,
    fraisAvocat: 0,
    joursRetard: 35,
    dateDebutImpaye: daysAgo(35),
    dateEcheance: daysAgo(50),
    etape: 'mise_en_demeure_lrar',
    derniereAction: 'Envoi mise en demeure LRAR',
    prochaineEtape: 'Commandement de payer si pas de reglement sous 15 jours',
    dateDerniereRelance: daysAgo(5),
    timeline: [
      { id: 't1', date: daysAgo(35), label: 'Retard de paiement constate', type: 'auto' },
      { id: 't2', date: daysAgo(20), label: 'Relance amiable email envoyee', type: 'courrier' },
      { id: 't3', date: daysAgo(5),  label: 'Mise en demeure LRAR expediee (AR 1A 234 567 890)', type: 'courrier' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_2',
    coproprietaire: 'Marie-Claire Bertrand',
    lot: '05A',
    immeuble: 'Residence Les Oliviers',
    email: 'mc.bertrand@gmail.com',
    montantImpaye: 1875.50,
    montantOriginal: 1875.50,
    fraisLRAR: 0,
    fraisHuissier: 0,
    fraisAvocat: 0,
    joursRetard: 18,
    dateDebutImpaye: daysAgo(18),
    dateEcheance: daysAgo(33),
    etape: 'relance_amiable',
    derniereAction: 'Relance amiable envoyee par email',
    prochaineEtape: 'Mise en demeure LRAR si pas de reponse sous 12 jours',
    dateDerniereRelance: daysAgo(3),
    timeline: [
      { id: 't4', date: daysAgo(18), label: 'Retard constate — Appel T1 2026', type: 'auto' },
      { id: 't5', date: daysAgo(3),  label: 'Relance amiable par email', type: 'courrier' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_3',
    coproprietaire: 'SCI Les Marronniers',
    lot: '22',
    immeuble: 'Immeuble Haussmann',
    email: 'sci.marronniers@cabinet.fr',
    montantImpaye: 12840.00,
    montantOriginal: 11500.00,
    fraisLRAR: 8.50,
    fraisHuissier: 180.00,
    fraisAvocat: 1500.00,
    joursRetard: 120,
    dateDebutImpaye: daysAgo(120),
    dateEcheance: daysAgo(150),
    etape: 'assignation_tribunal',
    derniereAction: 'Assignation devant le tribunal judiciaire',
    prochaineEtape: 'Audience prevue — attente date du greffe',
    dateDerniereRelance: daysAgo(10),
    timeline: [
      { id: 't6',  date: daysAgo(120), label: 'Retard constate — charges annuelles', type: 'auto' },
      { id: 't7',  date: daysAgo(105), label: 'Relance amiable envoyee', type: 'courrier' },
      { id: 't8',  date: daysAgo(90),  label: 'Mise en demeure LRAR', type: 'courrier' },
      { id: 't9',  date: daysAgo(60),  label: 'Commandement de payer par huissier', type: 'huissier' },
      { id: 't10', date: daysAgo(10),  label: 'Assignation devant TJ de Paris', type: 'tribunal' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_4',
    coproprietaire: 'Ahmed Benali',
    lot: '08',
    immeuble: 'Immeuble Haussmann',
    email: 'a.benali@hotmail.fr',
    montantImpaye: 680.00,
    montantOriginal: 680.00,
    fraisLRAR: 0,
    fraisHuissier: 0,
    fraisAvocat: 0,
    joursRetard: 16,
    dateDebutImpaye: daysAgo(16),
    dateEcheance: daysAgo(31),
    etape: 'relance_amiable',
    derniereAction: 'Relance amiable envoyee',
    prochaineEtape: 'Si pas de reglement : mise en demeure LRAR',
    dateDerniereRelance: daysAgo(1),
    timeline: [
      { id: 't11', date: daysAgo(16), label: 'Echeance non honoree — Appel T1 2026', type: 'auto' },
      { id: 't12', date: daysAgo(1),  label: 'Relance amiable courrier simple', type: 'courrier' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_5',
    coproprietaire: 'Francoise Moreau',
    lot: '15',
    immeuble: 'Residence Les Oliviers',
    email: 'f.moreau@orange.fr',
    montantImpaye: 4200.00,
    montantOriginal: 4200.00,
    fraisLRAR: 8.50,
    fraisHuissier: 180.00,
    fraisAvocat: 0,
    joursRetard: 65,
    dateDebutImpaye: daysAgo(65),
    dateEcheance: daysAgo(80),
    etape: 'commandement_payer',
    derniereAction: 'Commandement de payer delivre par huissier',
    prochaineEtape: 'Assignation devant tribunal si pas de reglement sous 30 jours',
    dateDerniereRelance: daysAgo(5),
    timeline: [
      { id: 't13', date: daysAgo(65), label: 'Retard constate — T3+T4 2025', type: 'auto' },
      { id: 't14', date: daysAgo(50), label: 'Relance amiable email', type: 'courrier' },
      { id: 't15', date: daysAgo(35), label: 'Mise en demeure LRAR expediee', type: 'courrier' },
      { id: 't16', date: daysAgo(5),  label: 'Commandement de payer signifie par huissier', type: 'huissier' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_6',
    coproprietaire: 'Philippe Garnier',
    lot: '03B',
    immeuble: 'Residence du Parc',
    email: 'ph.garnier@free.fr',
    montantImpaye: 8920.00,
    montantOriginal: 7800.00,
    fraisLRAR: 8.50,
    fraisHuissier: 180.00,
    fraisAvocat: 2200.00,
    joursRetard: 200,
    dateDebutImpaye: daysAgo(200),
    dateEcheance: daysAgo(215),
    etape: 'jugement',
    derniereAction: 'Jugement rendu — condamnation au paiement',
    prochaineEtape: 'Signification du jugement puis execution forcee',
    dateDerniereRelance: daysAgo(15),
    timeline: [
      { id: 't17', date: daysAgo(200), label: 'Retard constate — cumul 2024', type: 'auto' },
      { id: 't18', date: daysAgo(185), label: 'Relance amiable envoyee', type: 'courrier' },
      { id: 't19', date: daysAgo(170), label: 'Mise en demeure LRAR', type: 'courrier' },
      { id: 't20', date: daysAgo(140), label: 'Commandement de payer', type: 'huissier' },
      { id: 't21', date: daysAgo(110), label: 'Assignation TJ', type: 'tribunal' },
      { id: 't22', date: daysAgo(15),  label: 'Jugement rendu — condamnation avec depens', type: 'tribunal' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_7',
    coproprietaire: 'Nathalie Lefevre',
    lot: '11',
    immeuble: 'Residence du Parc',
    email: 'n.lefevre@yahoo.fr',
    montantImpaye: 2150.00,
    montantOriginal: 2150.00,
    fraisLRAR: 8.50,
    fraisHuissier: 180.00,
    fraisAvocat: 2200.00,
    joursRetard: 280,
    dateDebutImpaye: daysAgo(280),
    dateEcheance: daysAgo(300),
    etape: 'execution',
    derniereAction: 'Saisie-attribution sur compte bancaire en cours',
    prochaineEtape: 'Attente retour huissier sur saisie',
    dateDerniereRelance: daysAgo(8),
    timeline: [
      { id: 't23', date: daysAgo(280), label: 'Retard constate', type: 'auto' },
      { id: 't24', date: daysAgo(265), label: 'Relance amiable', type: 'courrier' },
      { id: 't25', date: daysAgo(250), label: 'Mise en demeure LRAR', type: 'courrier' },
      { id: 't26', date: daysAgo(220), label: 'Commandement de payer', type: 'huissier' },
      { id: 't27', date: daysAgo(190), label: 'Assignation TJ', type: 'tribunal' },
      { id: 't28', date: daysAgo(60),  label: 'Jugement — condamnation', type: 'tribunal' },
      { id: 't29', date: daysAgo(8),   label: 'Saisie-attribution sur compte (art. L211-1 CPCE)', type: 'huissier' },
    ],
    recouvre: false,
    montantRecouvre: 0,
  },
  {
    id: 'deb_8',
    coproprietaire: 'Robert Marchand',
    lot: '19',
    immeuble: 'Immeuble Haussmann',
    email: 'r.marchand@wanadoo.fr',
    montantImpaye: 0,
    montantOriginal: 5600.00,
    fraisLRAR: 8.50,
    fraisHuissier: 180.00,
    fraisAvocat: 0,
    joursRetard: 95,
    dateDebutImpaye: daysAgo(95),
    dateEcheance: daysAgo(110),
    etape: 'commandement_payer',
    derniereAction: 'Reglement integral recu apres commandement',
    prochaineEtape: 'Dossier clos',
    dateDerniereRelance: daysAgo(10),
    timeline: [
      { id: 't30', date: daysAgo(95), label: 'Retard constate', type: 'auto' },
      { id: 't31', date: daysAgo(80), label: 'Relance amiable', type: 'courrier' },
      { id: 't32', date: daysAgo(65), label: 'Mise en demeure LRAR', type: 'courrier' },
      { id: 't33', date: daysAgo(35), label: 'Commandement de payer', type: 'huissier' },
      { id: 't34', date: daysAgo(10), label: 'Reglement integral recu par virement', type: 'paiement' },
    ],
    recouvre: true,
    montantRecouvre: 5788.50,
  },
]

// ─── Modeles de courriers (5 types) ─────────────────────────────────────────

interface ModeleCourrier {
  id: string
  titre: string
  refLegale: string
  description: string
}

const MODELES_COURRIERS: ModeleCourrier[] = [
  {
    id: 'mc_1',
    titre: 'Relance amiable',
    refLegale: 'Art. 19 loi 10 juillet 1965',
    description: 'Rappel courtois informant le coproprietaire de son retard de paiement et l\'invitant a regulariser.',
  },
  {
    id: 'mc_2',
    titre: 'Mise en demeure',
    refLegale: 'Art. 19 loi 1965 — delai 30 jours',
    description: 'Lettre recommandee avec accuse de reception mettant formellement en demeure de payer sous 30 jours.',
  },
  {
    id: 'mc_3',
    titre: 'Commandement de payer',
    refLegale: 'Art. 19-1 loi 1965 — par huissier',
    description: 'Acte d\'huissier enjoignant le debiteur de payer sous peine de saisie ou procedure judiciaire.',
  },
  {
    id: 'mc_4',
    titre: 'Decheance du terme',
    refLegale: 'Art. 19-2 loi 1965 — exigibilite immediate',
    description: 'Rend immediatement exigibles toutes les provisions futures de l\'exercice apres mise en demeure restee infructueuse.',
  },
  {
    id: 'mc_5',
    titre: 'Saisie sur compte bancaire',
    refLegale: 'Art. L211-1 CPCE',
    description: 'Demande de saisie-attribution sur les comptes bancaires du debiteur en execution d\'un titre executoire.',
  },
]

const genererCourrier = (modele: ModeleCourrier, deb: Debiteur | null): string => {
  const nom = deb?.coproprietaire || '[NOM DU COPROPRIETAIRE]'
  const lot = deb?.lot || '[N. LOT]'
  const imm = deb?.immeuble || '[NOM IMMEUBLE]'
  const montant = deb ? formatEur(deb.montantImpaye) : '[MONTANT]'
  const montantOrig = deb ? formatEur(deb.montantOriginal) : '[MONTANT ORIGINAL]'
  const interets = deb ? formatEur(calculerInteretsLegaux(deb.montantOriginal, deb.joursRetard)) : '[INTERETS]'
  const total = deb ? formatEur(calculerTotalCreance(deb)) : '[TOTAL CREANCE]'
  const dateJour = formatDateLong(new Date().toISOString().split('T')[0])

  switch (modele.id) {
    case 'mc_1':
      return `SYNDICAT DES COPROPRIETAIRES\n${imm}\n\nA l'attention de : ${nom}\nLot n. ${lot}\n\nDate : ${dateJour}\n\nObjet : Rappel amiable — Arrieres de charges de copropriete\n\nMadame, Monsieur,\n\nNous nous permettons de vous signaler que votre compte presente un solde debiteur de ${montant} au titre des charges de copropriete.\n\nCe montant correspond aux appels de fonds demeures impayes a ce jour.\n\nNous vous serions reconnaissants de bien vouloir regulariser cette situation dans les meilleurs delais, par virement bancaire ou cheque a l'ordre du syndicat des coproprietaires.\n\nEn cas de difficulte financiere, nous vous invitons a prendre contact avec nous afin d'envisager un echelonnement de paiement.\n\nVeuillez agreer, Madame, Monsieur, l'expression de nos salutations distinguees.\n\nLe Syndic\n[Signature]\n\n---\nRef. : Lot ${lot} — ${imm}`

    case 'mc_2':
      return `LETTRE RECOMMANDEE AVEC ACCUSE DE RECEPTION\n\nSYNDICAT DES COPROPRIETAIRES\n${imm}\n\nA l'attention de : ${nom}\nLot n. ${lot}\n\nDate : ${dateJour}\n\nObjet : MISE EN DEMEURE — Charges de copropriete impayees\n\nMadame, Monsieur,\n\nPar la presente, nous vous mettons en demeure de regler, dans un delai de TRENTE (30) jours a compter de la reception du present courrier, la somme de ${montant} representant vos charges de copropriete impayees.\n\nDetail de la creance :\n- Charges impayees : ${montantOrig}\n- Interets de retard (art. 36 decret 17 mars 1967, taux legal ${(TAUX_INTERET_LEGAL * 100).toFixed(2)}%) : ${interets}\n- Total : ${total}\n\nConformement a l'article 19 de la loi du 10 juillet 1965, le syndicat des coproprietaires est fonde a poursuivre le recouvrement des charges dues.\n\nA defaut de reglement dans le delai imparti, nous serons contraints d'engager une procedure judiciaire a votre encontre, les frais etant a votre charge.\n\nNous attirons votre attention sur le fait qu'en application de l'article 19-2 de la loi du 10 juillet 1965, a defaut de paiement a l'issue du delai de mise en demeure, les provisions non encore echues de l'exercice deviendront immediatement exigibles.\n\nFait a ______, le ${dateJour}\n\nLe Syndic\n[Signature]`

    case 'mc_3':
      return `COMMANDEMENT DE PAYER\n(a faire signifier par huissier de justice)\n\nA la requete de :\nSyndicat des coproprietaires de ${imm}\nrepresente par son syndic en exercice\n\nA : ${nom}\nLot n. ${lot} — ${imm}\n\nDate : ${dateJour}\n\nIl est enjoint a ${nom} de payer au syndicat des coproprietaires la somme totale de ${total} decomposee comme suit :\n\n- Principal (charges impayees) : ${montantOrig}\n- Interets legaux art. 36 decret 1967 : ${interets}\n- Frais anterieurs (LRAR, relances) : ${deb ? formatEur(deb.fraisLRAR) : '[FRAIS]'}\n\nFaute de paiement dans un delai de HUIT (8) jours, le creancier pourra poursuivre le recouvrement par toutes voies de droit, y compris la saisie des biens mobiliers et immobiliers du debiteur.\n\nConformement aux articles 19 et 19-1 de la loi du 10 juillet 1965.\n\nFait a ______, le ${dateJour}\n\nL'huissier de justice\n[Nom et signature]`

    case 'mc_4':
      return `NOTIFICATION DE DECHEANCE DU TERME\n(Art. 19-2 loi du 10 juillet 1965)\n\nLETTRE RECOMMANDEE AVEC ACCUSE DE RECEPTION\n\nSYNDICAT DES COPROPRIETAIRES\n${imm}\n\nA l'attention de : ${nom}\nLot n. ${lot}\n\nDate : ${dateJour}\n\nObjet : Decheance du terme — Exigibilite immediate des provisions futures\n\nMadame, Monsieur,\n\nPar courrier recommande du ______, nous vous avons mis en demeure de regler la somme de ${montant} correspondant a vos charges de copropriete impayees.\n\nCette mise en demeure etant restee sans effet a l'expiration du delai de 30 jours, nous vous informons que, conformement a l'article 19-2 de la loi du 10 juillet 1965, l'ensemble des provisions non encore echues de l'exercice en cours deviennent immediatement exigibles.\n\nEn consequence, la creance totale s'eleve desormais a ${total}, incluant :\n- Arrieres constates : ${montantOrig}\n- Provisions futures exigibles : [MONTANT PROVISIONS]\n- Interets de retard : ${interets}\n- Frais de recouvrement : ${deb ? formatEur(deb.fraisLRAR + deb.fraisHuissier) : '[FRAIS]'}\n\nA defaut de reglement sous HUIT (8) jours, le syndicat saisira le tribunal judiciaire competent.\n\nFait a ______, le ${dateJour}\n\nLe Syndic\n[Signature]`

    case 'mc_5':
      return `SAISIE-ATTRIBUTION SUR COMPTE BANCAIRE\n(Art. L211-1 et suivants du Code des procedures civiles d'execution)\n\nA la requete de :\nSyndicat des coproprietaires de ${imm}\nrepresente par son syndic en exercice\n\nEn vertu de : Jugement du Tribunal Judiciaire de ______ en date du ______\n(titre executoire — grosse en forme executoire)\n\nA l'encontre de : ${nom}\nLot n. ${lot} — ${imm}\n\nIl est procede, par le present acte, a la saisie-attribution des sommes detenues par :\n[NOM DE LA BANQUE]\n[ADRESSE DE LA BANQUE]\n\nMontant de la creance a recouvrer : ${total}\n\nDecomposition :\n- Principal : ${montantOrig}\n- Interets : ${interets}\n- Frais de justice : ${deb ? formatEur(deb.fraisAvocat) : '[FRAIS AVOCAT]'}\n- Frais d'execution : ${deb ? formatEur(deb.fraisHuissier) : '[FRAIS HUISSIER]'}\n\nLe tiers saisi est tenu de declarer l'etendue de ses obligations a l'egard du debiteur (art. L211-3 CPCE).\n\nFait a ______, le ${dateJour}\n\nL'huissier de justice\n[Nom et signature]`

    default:
      return ''
  }
}

// ─── Simulated monthly recoveries (12 months) ──────────────────────────────

const MONTHLY_RECOVERIES = [
  { mois: 'Avr 2025', montant: 4200 },
  { mois: 'Mai 2025', montant: 1850 },
  { mois: 'Jun 2025', montant: 6700 },
  { mois: 'Jul 2025', montant: 2300 },
  { mois: 'Aou 2025', montant: 0 },
  { mois: 'Sep 2025', montant: 5100 },
  { mois: 'Oct 2025', montant: 3400 },
  { mois: 'Nov 2025', montant: 8200 },
  { mois: 'Dec 2025', montant: 1200 },
  { mois: 'Jan 2026', montant: 4600 },
  { mois: 'Fev 2026', montant: 2900 },
  { mois: 'Mar 2026', montant: 5788 },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecouvrementEnrichiFRSection({ user, userRole }: { user: User; userRole: string }) {
  const storageKey = `fixit_recouvrement_fr_${user.id}`

  const [activeTab, setActiveTab] = useState<TabKey>('pipeline')
  const [debiteurs, setDebiteurs] = useState<Debiteur[]>([])
  const [selectedDebiteur, setSelectedDebiteur] = useState<Debiteur | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [courrierPreview, setCourrierPreview] = useState<string | null>(null)
  const [courrierModele, setCourrierModele] = useState<string | null>(null)
  const [courrierDebiteurId, setCourrierDebiteurId] = useState<string>('')
  const [filterEtape, setFilterEtape] = useState<EtapePipeline | 'all'>('all')
  const [filterMontantMin, setFilterMontantMin] = useState('')
  const [filterAncienneteMin, setFilterAncienneteMin] = useState('')
  const [copied, setCopied] = useState(false)

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try { setDebiteurs(JSON.parse(stored)) } catch { setDebiteurs(buildDemoData()) }
    } else {
      setDebiteurs(buildDemoData())
    }
  }, [storageKey])

  const save = (list: Debiteur[]) => {
    setDebiteurs(list)
    localStorage.setItem(storageKey, JSON.stringify(list))
  }

  // Escalate debtor to next pipeline step
  const escalader = (id: string) => {
    const updated = debiteurs.map(d => {
      if (d.id !== id) return d
      const idx = ETAPE_ORDER.indexOf(d.etape)
      if (idx >= ETAPE_ORDER.length - 1) return d
      const nextEtape = ETAPE_ORDER[idx + 1]
      const etapeInfo = ETAPES_PIPELINE.find(e => e.key === nextEtape)!
      return {
        ...d,
        etape: nextEtape,
        derniereAction: `Passage a : ${etapeInfo.label}`,
        dateDerniereRelance: new Date().toISOString().split('T')[0],
        timeline: [...d.timeline, {
          id: `t_esc_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          label: `Escalade vers ${etapeInfo.label}`,
          type: 'auto' as const,
        }],
      }
    })
    save(updated)
    if (selectedDebiteur?.id === id) {
      setSelectedDebiteur(updated.find(d => d.id === id) || null)
    }
  }

  // ─── Computed stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const actifs = debiteurs.filter(d => !d.recouvre)
    const totalImpayes = actifs.reduce((s, d) => s + d.montantImpaye, 0)
    const nbDebiteurs = actifs.length
    const montantMoyen = nbDebiteurs > 0 ? totalImpayes / nbDebiteurs : 0
    const totalRecouvre12m = MONTHLY_RECOVERIES.reduce((s, m) => s + m.montant, 0)
    const totalDu12m = totalImpayes + totalRecouvre12m
    const tauxRecouvrement = totalDu12m > 0 ? (totalRecouvre12m / totalDu12m) * 100 : 0

    const parEtape: Record<EtapePipeline, number> = {
      relance_amiable: 0, mise_en_demeure_lrar: 0, commandement_payer: 0,
      assignation_tribunal: 0, jugement: 0, execution: 0,
    }
    actifs.forEach(d => { parEtape[d.etape] = (parEtape[d.etape] || 0) + 1 })

    const aging = { '0_30': 0, '31_60': 0, '61_90': 0, '91_180': 0, 'plus_180': 0 }
    actifs.forEach(d => {
      if (d.joursRetard <= 30) aging['0_30'] += d.montantImpaye
      else if (d.joursRetard <= 60) aging['31_60'] += d.montantImpaye
      else if (d.joursRetard <= 90) aging['61_90'] += d.montantImpaye
      else if (d.joursRetard <= 180) aging['91_180'] += d.montantImpaye
      else aging['plus_180'] += d.montantImpaye
    })

    return { totalImpayes, nbDebiteurs, montantMoyen, tauxRecouvrement, parEtape, aging, totalRecouvre12m }
  }, [debiteurs])

  // Filtered debiteurs for Suivi table
  const filteredDebiteurs = useMemo(() => {
    let list = debiteurs
    if (filterEtape !== 'all') list = list.filter(d => d.etape === filterEtape)
    if (filterMontantMin) {
      const min = parseFloat(filterMontantMin)
      if (!isNaN(min)) list = list.filter(d => d.montantImpaye >= min)
    }
    if (filterAncienneteMin) {
      const min = parseInt(filterAncienneteMin)
      if (!isNaN(min)) list = list.filter(d => d.joursRetard >= min)
    }
    return list
  }, [debiteurs, filterEtape, filterMontantMin, filterAncienneteMin])

  // ─── Style constants ────────────────────────────────────────────────────────

  const navy = 'var(--sd-navy, #0D1B2E)'
  const gold = 'var(--sd-gold, #C9A84C)'
  const cream = 'var(--sd-cream, #F7F4EE)'
  const border = 'var(--sd-border, #E4DDD0)'
  const ink2 = 'var(--sd-ink-2, #4A5568)'
  const ink3 = 'var(--sd-ink-3, #718096)'
  const headingFont = "'Playfair Display', Georgia, serif"
  const bodyFont = "'Outfit', system-ui, sans-serif"

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: 20,
    fontFamily: bodyFont,
  }

  const btnPrimary: React.CSSProperties = {
    background: gold,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontFamily: bodyFont,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  }

  const btnOutline: React.CSSProperties = {
    background: 'transparent',
    color: navy,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '6px 14px',
    fontFamily: bodyFont,
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
  }

  // ─── Sub-renders ────────────────────────────────────────────────────────────

  const renderSummaryCards = () => {
    const cards = [
      { label: 'Total impayes', value: formatEur(stats.totalImpayes), color: '#EF4444' },
      { label: 'Debiteurs actifs', value: String(stats.nbDebiteurs), color: navy },
      { label: 'Montant moyen', value: formatEur(stats.montantMoyen), color: '#F59E0B' },
      { label: 'Taux recouvrement 12 mois', value: `${stats.tauxRecouvrement.toFixed(1)}%`, color: '#10B981' },
    ]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ ...cardStyle, padding: 16, borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 12, color: ink3, fontFamily: bodyFont, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: navy, fontFamily: headingFont }}>{c.value}</div>
          </div>
        ))}
      </div>
    )
  }

  // ─── Pipeline tab ───────────────────────────────────────────────────────────

  const renderPipeline = () => {
    const actifs = debiteurs.filter(d => !d.recouvre)
    return (
      <div>
        {renderSummaryCards()}
        <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 14, minWidth: ETAPES_PIPELINE.length * 240 }}>
            {ETAPES_PIPELINE.map(etape => {
              const items = actifs.filter(d => d.etape === etape.key)
              return (
                <div key={etape.key} style={{ flex: '0 0 230px', minHeight: 300 }}>
                  {/* Column header */}
                  <div style={{
                    background: navy,
                    color: '#fff',
                    borderRadius: '10px 10px 0 0',
                    padding: '10px 14px',
                    fontFamily: headingFont,
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>{etape.icon} {etape.label}</span>
                    <span style={{
                      background: gold,
                      color: '#fff',
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontFamily: bodyFont,
                    }}>{etape.delai}</span>
                  </div>
                  <div style={{
                    background: cream,
                    borderRadius: '0 0 10px 10px',
                    border: `1px solid ${border}`,
                    borderTop: 'none',
                    padding: 8,
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {items.length === 0 && (
                      <div style={{ color: ink3, fontSize: 12, fontFamily: bodyFont, padding: 10, textAlign: 'center' }}>
                        Aucun dossier
                      </div>
                    )}
                    {items.map(deb => (
                      <div
                        key={deb.id}
                        onClick={() => { setSelectedDebiteur(deb); setShowDetail(true) }}
                        style={{
                          background: '#fff',
                          border: `1px solid ${border}`,
                          borderRadius: 8,
                          padding: 10,
                          cursor: 'pointer',
                          transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                      >
                        <div style={{ fontFamily: bodyFont, fontWeight: 600, fontSize: 13, color: navy, marginBottom: 4 }}>
                          {deb.coproprietaire}
                        </div>
                        <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont, marginBottom: 2 }}>
                          Lot {deb.lot} — {deb.immeuble}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', fontFamily: bodyFont, margin: '4px 0' }}>
                          {formatEur(deb.montantImpaye)}
                        </div>
                        <div style={{ fontSize: 11, color: ink2, fontFamily: bodyFont }}>
                          {deb.joursRetard} jours de retard
                        </div>
                        <div style={{ fontSize: 10, color: ink3, fontFamily: bodyFont, marginTop: 4, borderTop: `1px solid ${border}`, paddingTop: 4 }}>
                          <div>Derniere : {deb.derniereAction.substring(0, 40)}{deb.derniereAction.length > 40 ? '...' : ''}</div>
                          <div style={{ color: gold, fontWeight: 500, marginTop: 2 }}>
                            Prochaine : {deb.prochaineEtape.substring(0, 40)}{deb.prochaineEtape.length > 40 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                    {items.length > 0 && (
                      <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont, textAlign: 'center', padding: '4px 0' }}>
                        {items.length} dossier{items.length > 1 ? 's' : ''} — {formatEur(items.reduce((s, d) => s + d.montantImpaye, 0))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail modal */}
        {showDetail && selectedDebiteur && renderDetailModal()}
      </div>
    )
  }

  // ─── Detail modal ───────────────────────────────────────────────────────────

  const renderDetailModal = () => {
    const d = selectedDebiteur!
    const interets = calculerInteretsLegaux(d.montantOriginal, d.joursRetard)
    const totalCreance = calculerTotalCreance(d)
    const jPresc = joursAvantPrescription(d.dateEcheance)
    const etapeInfo = ETAPES_PIPELINE.find(e => e.key === d.etape)!
    const etapeIdx = ETAPE_ORDER.indexOf(d.etape)

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(13,27,46,0.5)', zIndex: 9999,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 20,
      }} onClick={() => setShowDetail(false)}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: 16,
            maxWidth: 700,
            width: '100%',
            maxHeight: '85vh',
            overflow: 'auto',
            padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontFamily: headingFont, fontSize: 20, color: navy, margin: 0 }}>{d.coproprietaire}</h3>
              <div style={{ fontSize: 13, color: ink2, fontFamily: bodyFont, marginTop: 2 }}>
                Lot {d.lot} — {d.immeuble}
              </div>
              <div style={{ fontSize: 12, color: ink3, fontFamily: bodyFont }}>{d.email}</div>
            </div>
            <button onClick={() => setShowDetail(false)} style={{ ...btnOutline, padding: '4px 12px', fontSize: 16 }}>
              \u2715
            </button>
          </div>

          {/* Pipeline progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: ink3, fontFamily: bodyFont, marginBottom: 6 }}>Progression pipeline</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {ETAPES_PIPELINE.map((et, i) => (
                <React.Fragment key={et.key}>
                  <div style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: i <= etapeIdx ? gold : border,
                    transition: 'background 0.3s',
                  }} />
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {ETAPES_PIPELINE.map((et, i) => (
                <div key={et.key} style={{
                  fontSize: 9,
                  color: i <= etapeIdx ? navy : ink3,
                  fontFamily: bodyFont,
                  fontWeight: i === etapeIdx ? 700 : 400,
                  textAlign: 'center',
                  flex: 1,
                }}>
                  {et.label.split(' ')[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Financial summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ ...cardStyle, padding: 12, background: cream }}>
              <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Impaye</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444', fontFamily: bodyFont }}>{formatEur(d.montantImpaye)}</div>
            </div>
            <div style={{ ...cardStyle, padding: 12, background: cream }}>
              <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Interets legaux</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', fontFamily: bodyFont }}>{formatEur(interets)}</div>
              <div style={{ fontSize: 9, color: ink3, fontFamily: bodyFont }}>art. 36 decret 1967</div>
            </div>
            <div style={{ ...cardStyle, padding: 12, background: cream }}>
              <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Total creance</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: navy, fontFamily: bodyFont }}>{formatEur(totalCreance)}</div>
            </div>
          </div>

          {/* Frais detail */}
          {(d.fraisLRAR > 0 || d.fraisHuissier > 0 || d.fraisAvocat > 0) && (
            <div style={{ ...cardStyle, padding: 12, marginBottom: 16, background: cream }}>
              <div style={{ fontSize: 12, color: ink2, fontFamily: bodyFont, fontWeight: 600, marginBottom: 6 }}>Detail des frais</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: ink2, fontFamily: bodyFont }}>
                {d.fraisLRAR > 0 && <span>LRAR : {formatEur(d.fraisLRAR)}</span>}
                {d.fraisHuissier > 0 && <span>Huissier : {formatEur(d.fraisHuissier)}</span>}
                {d.fraisAvocat > 0 && <span>Avocat : {formatEur(d.fraisAvocat)}</span>}
              </div>
            </div>
          )}

          {/* Prescription warning */}
          <div style={{
            ...cardStyle,
            padding: 12,
            marginBottom: 16,
            background: jPresc < 365 ? '#FEF3C7' : jPresc < 1460 ? '#FFF7ED' : cream,
            borderColor: jPresc < 365 ? '#F59E0B' : border,
          }}>
            <div style={{ fontSize: 12, fontFamily: bodyFont, color: ink2 }}>
              <strong>Prescription :</strong> {formatDate(prescriptionDate(d.dateEcheance))}
              {' '}({jPresc > 0 ? `${jPresc} jours restants` : 'PRESCRIT'})
              {jPresc < 365 && jPresc > 0 && (
                <span style={{ color: '#EF4444', fontWeight: 700, marginLeft: 8 }}>
                  ALERTE — Prescription imminente (art. 42 loi 1965 / art. 2224 CC)
                </span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: navy, fontFamily: headingFont, marginBottom: 10 }}>Chronologie</div>
            {d.timeline.map((ev, i) => {
              const typeColors: Record<string, string> = {
                courrier: '#3B82F6', huissier: '#F59E0B', tribunal: '#8B5CF6', auto: ink3, paiement: '#10B981'
              }
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: typeColors[ev.type] || ink3,
                      flexShrink: 0,
                    }} />
                    {i < d.timeline.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: border, marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>{formatDate(ev.date)}</div>
                    <div style={{ fontSize: 13, color: navy, fontFamily: bodyFont }}>{ev.label}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {etapeIdx < ETAPE_ORDER.length - 1 && !d.recouvre && (
              <button
                onClick={() => { escalader(d.id); setShowDetail(false) }}
                style={btnPrimary}
              >
                Escalader vers {ETAPES_PIPELINE[etapeIdx + 1]?.label}
              </button>
            )}
            <button
              onClick={() => {
                setCourrierDebiteurId(d.id)
                setActiveTab('courriers')
                setShowDetail(false)
              }}
              style={btnOutline}
            >
              Generer un courrier
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Suivi debiteurs tab ────────────────────────────────────────────────────

  const renderSuiviDebiteurs = () => (
    <div>
      {renderSummaryCards()}

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: navy, fontFamily: bodyFont }}>Filtres :</div>
        <select
          value={filterEtape}
          onChange={e => setFilterEtape(e.target.value as EtapePipeline | 'all')}
          style={{
            border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px',
            fontFamily: bodyFont, fontSize: 13, color: navy, background: cream,
          }}
        >
          <option value="all">Toutes les etapes</option>
          {ETAPES_PIPELINE.map(et => (
            <option key={et.key} value={et.key}>{et.label}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Montant min (EUR)"
          value={filterMontantMin}
          onChange={e => setFilterMontantMin(e.target.value)}
          style={{
            border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px',
            fontFamily: bodyFont, fontSize: 13, width: 140, color: navy,
          }}
        />
        <input
          type="number"
          placeholder="Anciennete min (jours)"
          value={filterAncienneteMin}
          onChange={e => setFilterAncienneteMin(e.target.value)}
          style={{
            border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px',
            fontFamily: bodyFont, fontSize: 13, width: 160, color: navy,
          }}
        />
        {(filterEtape !== 'all' || filterMontantMin || filterAncienneteMin) && (
          <button
            onClick={() => { setFilterEtape('all'); setFilterMontantMin(''); setFilterAncienneteMin('') }}
            style={{ ...btnOutline, fontSize: 12, padding: '5px 10px' }}
          >
            Reinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: bodyFont, fontSize: 12 }}>
          <thead>
            <tr style={{ background: navy, color: '#fff' }}>
              {['Coproprietaire', 'Lots', 'Montant du', 'Anciennete', 'Interets legaux', 'Frais', 'Total creance', 'Etape', 'Derniere relance'].map(h => (
                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDebiteurs.map((d, idx) => {
              const interets = calculerInteretsLegaux(d.montantOriginal, d.joursRetard)
              const fraisTotal = d.fraisLRAR + d.fraisHuissier + d.fraisAvocat
              const totalCr = calculerTotalCreance(d)
              const etapeInfo = ETAPES_PIPELINE.find(e => e.key === d.etape)
              return (
                <tr
                  key={d.id}
                  onClick={() => { setSelectedDebiteur(d); setShowDetail(true) }}
                  style={{
                    background: idx % 2 === 0 ? '#fff' : cream,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${border}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FFF8E7')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : cream)}
                >
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: navy }}>
                    {d.coproprietaire}
                    {d.recouvre && <span style={{ color: '#10B981', fontSize: 10, marginLeft: 6 }}>REGLE</span>}
                  </td>
                  <td style={{ padding: '10px 8px', color: ink2 }}>Lot {d.lot}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: d.montantImpaye > 0 ? '#EF4444' : '#10B981' }}>
                    {formatEur(d.montantImpaye)}
                  </td>
                  <td style={{ padding: '10px 8px', color: d.joursRetard > 90 ? '#EF4444' : ink2 }}>
                    {d.joursRetard} j
                  </td>
                  <td style={{ padding: '10px 8px', color: '#F59E0B' }}>{formatEur(interets)}</td>
                  <td style={{ padding: '10px 8px', color: ink2 }}>{formatEur(fraisTotal)}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: navy }}>{formatEur(totalCr)}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 12,
                      fontSize: 10,
                      fontWeight: 600,
                      background: d.recouvre ? '#D1FAE5' : '#FEF3C7',
                      color: d.recouvre ? '#065F46' : '#92400E',
                    }}>
                      {d.recouvre ? 'Recouvre' : etapeInfo?.label || d.etape}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', color: ink3, fontSize: 11 }}>{formatDate(d.dateDerniereRelance)}</td>
                </tr>
              )
            })}
            {filteredDebiteurs.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: ink3, fontFamily: bodyFont }}>
                  Aucun debiteur ne correspond aux filtres selectionnes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDetail && selectedDebiteur && renderDetailModal()}
    </div>
  )

  // ─── Courriers types tab ────────────────────────────────────────────────────

  const renderCourriersTypes = () => {
    const actifs = debiteurs.filter(d => !d.recouvre)
    const selectedDeb = actifs.find(d => d.id === courrierDebiteurId) || null

    return (
      <div>
        <div style={{ fontSize: 14, color: ink2, fontFamily: bodyFont, marginBottom: 16 }}>
          5 modeles de courriers types couvrant l'integralite de la procedure de recouvrement en copropriete,
          conformes aux articles 19, 19-1, 19-2 de la loi du 10 juillet 1965 et au Code des procedures civiles d'execution.
        </div>

        {/* Debtor selector */}
        <div style={{ ...cardStyle, padding: 14, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: navy, fontFamily: bodyFont }}>
            Pre-remplir avec un debiteur :
          </label>
          <select
            value={courrierDebiteurId}
            onChange={e => setCourrierDebiteurId(e.target.value)}
            style={{
              border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px',
              fontFamily: bodyFont, fontSize: 13, color: navy, background: cream, minWidth: 220,
            }}
          >
            <option value="">-- Selectionner --</option>
            {actifs.map(d => (
              <option key={d.id} value={d.id}>{d.coproprietaire} (Lot {d.lot})</option>
            ))}
          </select>
        </div>

        {/* Model cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {MODELES_COURRIERS.map(mc => (
            <div key={mc.id} style={{ ...cardStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h4 style={{ fontFamily: headingFont, fontSize: 15, color: navy, margin: 0 }}>{mc.titre}</h4>
                <span style={{
                  fontSize: 10, color: gold, fontWeight: 600, fontFamily: bodyFont,
                  background: '#FFF8E7', padding: '2px 8px', borderRadius: 8,
                }}>{mc.refLegale}</span>
              </div>
              <p style={{ fontSize: 12, color: ink2, fontFamily: bodyFont, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                {mc.description}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const text = genererCourrier(mc, selectedDeb)
                    setCourrierPreview(text)
                    setCourrierModele(mc.titre)
                    setCopied(false)
                  }}
                  style={btnPrimary}
                >
                  {selectedDeb ? 'Generer' : 'Apercu'}
                </button>
                <button
                  onClick={() => {
                    const text = genererCourrier(mc, selectedDeb)
                    setCourrierPreview(text)
                    setCourrierModele(mc.titre)
                    setCopied(false)
                  }}
                  style={btnOutline}
                >
                  Voir modele
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Preview modal */}
        {courrierPreview && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(13,27,46,0.5)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20,
          }} onClick={() => setCourrierPreview(null)}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%',
                maxHeight: '85vh', overflow: 'auto', padding: 28,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontFamily: headingFont, fontSize: 18, color: navy, margin: 0 }}>
                  {courrierModele}
                </h3>
                <button onClick={() => setCourrierPreview(null)} style={{ ...btnOutline, padding: '4px 12px', fontSize: 16 }}>
                  \u2715
                </button>
              </div>
              <pre style={{
                fontFamily: bodyFont,
                fontSize: 13,
                color: navy,
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                background: cream,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: 20,
                lineHeight: 1.6,
              }}>
                {courrierPreview}
              </pre>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(courrierPreview).then(() => setCopied(true))
                  }}
                  style={btnPrimary}
                >
                  {copied ? 'Copie !' : 'Copier dans le presse-papier'}
                </button>
                <button onClick={() => setCourrierPreview(null)} style={btnOutline}>Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Statistiques tab ───────────────────────────────────────────────────────

  const renderStatistiques = () => {
    const maxRecovery = Math.max(...MONTHLY_RECOVERIES.map(m => m.montant), 1)
    const etapeCounts = stats.parEtape
    const totalEtapes = Object.values(etapeCounts).reduce((s, n) => s + n, 0)
    const pieColors: Record<EtapePipeline, string> = {
      relance_amiable: '#3B82F6',
      mise_en_demeure_lrar: '#F59E0B',
      commandement_payer: '#EF4444',
      assignation_tribunal: '#8B5CF6',
      jugement: '#EC4899',
      execution: '#0D1B2E',
    }

    const agingLabels = [
      { key: '0_30', label: '0-30 j', color: '#10B981' },
      { key: '31_60', label: '31-60 j', color: '#3B82F6' },
      { key: '61_90', label: '61-90 j', color: '#F59E0B' },
      { key: '91_180', label: '91-180 j', color: '#EF4444' },
      { key: 'plus_180', label: '>180 j', color: '#991B1B' },
    ]
    const maxAging = Math.max(...Object.values(stats.aging), 1)

    // Prescription tracker
    const debiteursPrescription = debiteurs.filter(d => !d.recouvre).map(d => ({
      ...d,
      jRestants: joursAvantPrescription(d.dateEcheance),
      datePres: prescriptionDate(d.dateEcheance),
    })).sort((a, b) => a.jRestants - b.jRestants)

    // Recovery rate trend (simple: compare last 3 months average to previous 3)
    const recent3 = MONTHLY_RECOVERIES.slice(-3).reduce((s, m) => s + m.montant, 0) / 3
    const prev3 = MONTHLY_RECOVERIES.slice(-6, -3).reduce((s, m) => s + m.montant, 0) / 3
    const trendUp = recent3 >= prev3

    return (
      <div>
        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ ...cardStyle, padding: 16, borderLeft: '4px solid #10B981' }}>
            <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Recouvre 12 mois</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981', fontFamily: headingFont }}>
              {formatEur(stats.totalRecouvre12m)}
            </div>
          </div>
          <div style={{ ...cardStyle, padding: 16, borderLeft: '4px solid #3B82F6' }}>
            <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Taux recouvrement</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3B82F6', fontFamily: headingFont, display: 'flex', alignItems: 'center', gap: 6 }}>
              {stats.tauxRecouvrement.toFixed(1)}%
              <span style={{ fontSize: 14, color: trendUp ? '#10B981' : '#EF4444' }}>
                {trendUp ? '\u2191' : '\u2193'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: ink3, fontFamily: bodyFont }}>
              Tendance {trendUp ? 'haussiere' : 'baissiere'} sur 3 mois
            </div>
          </div>
          <div style={{ ...cardStyle, padding: 16, borderLeft: `4px solid ${navy}` }}>
            <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Dossiers actifs</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: navy, fontFamily: headingFont }}>{stats.nbDebiteurs}</div>
          </div>
          <div style={{ ...cardStyle, padding: 16, borderLeft: '4px solid #EF4444' }}>
            <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont }}>Encours total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444', fontFamily: headingFont }}>
              {formatEur(stats.totalImpayes)}
            </div>
          </div>
        </div>

        {/* Bar chart: montants recouvres par mois */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h4 style={{ fontFamily: headingFont, fontSize: 16, color: navy, margin: '0 0 16px 0' }}>
            Montants recouvres par mois (12 derniers mois)
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, padding: '0 4px' }}>
            {MONTHLY_RECOVERIES.map((m, i) => {
              const h = maxRecovery > 0 ? (m.montant / maxRecovery) * 160 : 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: ink2, fontFamily: bodyFont, fontWeight: 600 }}>
                    {m.montant > 0 ? `${(m.montant / 1000).toFixed(1)}k` : '0'}
                  </div>
                  <div style={{
                    width: '100%',
                    maxWidth: 32,
                    height: Math.max(h, 2),
                    background: m.montant > 0 ? `linear-gradient(to top, ${gold}, #E8C96A)` : border,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s',
                  }} />
                  <div style={{ fontSize: 8, color: ink3, fontFamily: bodyFont, textAlign: 'center', lineHeight: 1.1 }}>
                    {m.mois.split(' ')[0]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          {/* Pie chart: repartition par etape */}
          <div style={{ ...cardStyle }}>
            <h4 style={{ fontFamily: headingFont, fontSize: 15, color: navy, margin: '0 0 14px 0' }}>
              Repartition par etape pipeline
            </h4>
            {totalEtapes === 0 ? (
              <div style={{ color: ink3, fontSize: 13, fontFamily: bodyFont, padding: 20, textAlign: 'center' }}>
                Aucun dossier actif
              </div>
            ) : (
              <div>
                {/* Simple horizontal stacked bar as pie substitute */}
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, marginBottom: 12 }}>
                  {ETAPES_PIPELINE.map(et => {
                    const count = etapeCounts[et.key] || 0
                    if (count === 0) return null
                    const pct = (count / totalEtapes) * 100
                    return (
                      <div key={et.key} style={{
                        width: `${pct}%`,
                        background: pieColors[et.key],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: bodyFont,
                        minWidth: count > 0 ? 20 : 0,
                      }}>
                        {pct > 15 ? `${count}` : ''}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ETAPES_PIPELINE.map(et => {
                    const count = etapeCounts[et.key] || 0
                    if (count === 0) return null
                    return (
                      <div key={et.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: bodyFont }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: pieColors[et.key], flexShrink: 0 }} />
                        <span style={{ color: ink2 }}>{et.label}</span>
                        <span style={{ color: navy, fontWeight: 600, marginLeft: 'auto' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Aging analysis */}
          <div style={{ ...cardStyle }}>
            <h4 style={{ fontFamily: headingFont, fontSize: 15, color: navy, margin: '0 0 14px 0' }}>
              Analyse par anciennete (aging)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agingLabels.map(a => {
                const val = stats.aging[a.key as keyof typeof stats.aging]
                const pct = maxAging > 0 ? (val / maxAging) * 100 : 0
                return (
                  <div key={a.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: bodyFont, marginBottom: 2 }}>
                      <span style={{ color: ink2 }}>{a.label}</span>
                      <span style={{ color: navy, fontWeight: 600 }}>{formatEur(val)}</span>
                    </div>
                    <div style={{ height: 8, background: cream, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: a.color,
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Prescription tracker */}
        <div style={{ ...cardStyle }}>
          <h4 style={{ fontFamily: headingFont, fontSize: 15, color: navy, margin: '0 0 4px 0' }}>
            Suivi de la prescription
          </h4>
          <div style={{ fontSize: 11, color: ink3, fontFamily: bodyFont, marginBottom: 14 }}>
            Delai de prescription : 5 ans (art. 42 loi 1965 / art. 2224 Code civil). Alerte lorsque le delai residuel est inferieur a 1 an.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: bodyFont, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${border}` }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: navy, fontWeight: 600 }}>Debiteur</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: navy, fontWeight: 600 }}>Echeance initiale</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: navy, fontWeight: 600 }}>Date prescription</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: navy, fontWeight: 600 }}>Jours restants</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: navy, fontWeight: 600 }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {debiteursPrescription.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${border}` }}>
                    <td style={{ padding: '8px 6px', color: navy, fontWeight: 500 }}>{d.coproprietaire}</td>
                    <td style={{ padding: '8px 6px', color: ink2 }}>{formatDate(d.dateEcheance)}</td>
                    <td style={{ padding: '8px 6px', color: ink2 }}>{formatDate(d.datePres)}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 600, color: d.jRestants < 365 ? '#EF4444' : d.jRestants < 1460 ? '#F59E0B' : '#10B981' }}>
                      {d.jRestants > 0 ? `${d.jRestants} j` : 'PRESCRIT'}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {d.jRestants <= 0 && (
                        <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                          PRESCRIT
                        </span>
                      )}
                      {d.jRestants > 0 && d.jRestants < 365 && (
                        <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                          ALERTE &lt;1 an
                        </span>
                      )}
                      {d.jRestants >= 365 && d.jRestants < 1460 && (
                        <span style={{ background: '#FFF7ED', color: '#C2410C', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                          Attention &lt;4 ans
                        </span>
                      )}
                      {d.jRestants >= 1460 && (
                        <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: bodyFont }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: headingFont, fontSize: 24, color: navy, margin: '0 0 4px 0' }}>
          Recouvrement enrichi
        </h2>
        <p style={{ fontSize: 13, color: ink2, fontFamily: bodyFont, margin: 0 }}>
          Procedure complete de recouvrement des impayes de charges de copropriete — art. 19, 19-1, 19-2 loi 1965, art. 36 decret 1967, art. 42 loi 1965, art. 2224 Code civil.
        </p>
      </div>

      {/* Legal references banner */}
      <div style={{
        ...cardStyle,
        padding: 12,
        marginBottom: 16,
        background: '#FFFBEB',
        borderColor: '#FDE68A',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18 }}>{'\u2696\uFE0F'}</span>
        <div style={{ fontSize: 11, color: '#92400E', fontFamily: bodyFont, lineHeight: 1.5 }}>
          <strong>References legales :</strong> Art. 19 (obligation de paiement), art. 19-1 (privilege du syndicat),
          art. 19-2 (decheance du terme) de la loi du 10 juillet 1965. Art. 36 du decret du 17 mars 1967 (interets de retard).
          Art. 42 de la loi 1965 (prescription 5 ans pour les charges, etendu a 10 ans par la loi du 9 avril 2024 pour les charges exigibles apres cette date).
          Art. 2224 du Code civil (prescription de droit commun). Art. L211-1 CPCE (saisie-attribution).
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `2px solid ${border}`,
        marginBottom: 20,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontFamily: bodyFont,
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? navy : ink3,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? `3px solid ${gold}` : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'pipeline' && renderPipeline()}
      {activeTab === 'debiteurs' && renderSuiviDebiteurs()}
      {activeTab === 'courriers' && renderCourriersTypes()}
      {activeTab === 'stats' && renderStatistiques()}
    </div>
  )
}
