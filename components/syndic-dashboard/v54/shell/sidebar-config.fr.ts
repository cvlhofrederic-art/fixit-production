// Sidebar française du dashboard syndic v54 : même structure que SIDEBAR
// (sidebar-config.ts, inchangé pour le portugais), mêmes ids, icônes et
// compteurs ; seuls les libellés changent, et les modules sans équivalent en
// droit français sont masqués. Ces libellés font foi pour tout l'écran FR
// (titres de page, « Mes modules », fil d'Ariane).

import { SIDEBAR, isItem, type SidebarEntry, type SidebarSection } from './sidebar-config'

export const SECTIONS_FR: Readonly<Record<string, string>> = {
  'Agentes IA': 'Agents IA',
  'Gestão': 'Gestion',
  'Património': 'Patrimoine',
  'Técnico': 'Technique',
  'Acompanhamento': 'Suivi',
  'Condomínio': 'Copropriété',
  'Gestão Condóminos': 'Relation copropriétaires',
  'Ferramentas Avançadas': 'Outils avancés',
  'Obrigações Legais': 'Obligations légales',
  'Ferramentas IA': 'Outils IA',
  'Conta': 'Compte',
}

export const SOUS_TITRES_FR: Readonly<Record<string, string>> = {
  'Compliance Geral': 'Conformité générale',
  'AG & Deliberações': 'AG & décisions',
  'Seguros & Riscos': 'Assurances & risques',
  'Judicial & Privacidade': 'Contentieux & données personnelles',
  'Energia & Extranet': 'Énergie & extranet',
}

export const LIBELLES_FR: Readonly<Record<string, string>> = {
  fixy: 'Fixy',
  max: 'Max Expert',
  lea: 'Léa',
  alfredo: 'Alfredo',
  tempo: 'Tempo',
  dashboard: 'Tableau de bord',
  ordens: 'Ordres de service',
  canal: 'Canal de communication',
  planeamento: 'Planning',
  urgencias: 'Urgences techniques',
  equipa: 'Mon équipe',
  edificios: 'Immeubles',
  profissionais: 'Prestataires',
  condominos: 'Copropriétaires',
  elevadores: 'Ascenseurs',
  contratos: 'Contrats',
  cctv: 'Vidéoprotection',
  histEdificio: "Historique de l'immeuble",
  docsInterv: "Documents d'intervention",
  contabTec: 'Comptabilité technique',
  analiseOrc: 'Analyse devis & factures',
  faturacao: 'Facturation',
  alertas: 'Alertes',
  relMensal: 'Rapport mensuel',
  calReg: 'Calendrier réglementaire',
  docsGED: 'Documents (GED)',
  contabCond: 'Comptabilité copropriété',
  agDigit: 'Assemblées générales',
  valoresDiv: 'Impayés',
  caderneta: "Carnet d'entretien",
  mapaFiscal: 'Récapitulatif fiscal des charges',
  openBanking: 'Open Banking',
  portal: 'Espace copropriétaire',
  avisos: "Panneau d'affichage",
  enquetes: 'Sondages',
  reserva: "Réservation d'espaces",
  ocorrencias: 'Incidents',
  whatsapp: 'WhatsApp/SMS',
  chatbot: 'Chatbot WhatsApp 24/7',
  reembolsos: 'Remboursements',
  npsPosIntervencao: 'Satisfaction post-intervention',
  relGestao: 'Rapport de gestion',
  prepAss: "Préparation de l'AG",
  planoMan: 'Plan pluriannuel de travaux',
  vistoria: 'Visites techniques',
  pontuacao: 'Score de santé',
  orcIA: 'Budget prévisionnel IA',
  contacto: 'Contact proactif',
  ocClassif: 'Incidents (classificateur)',
  seguros: 'Gestion des assurances',
  checklists: 'Checklists IA',
  procLote: 'Traitements par lots',
  agLive: 'AG en direct',
  marketplace: 'Annuaire des prestataires',
  predicao: 'Maintenance prédictive',
  qrcode: 'QR code par lot',
  dashCond: 'Tableau de bord copropriétaire',
  compEnergia: "Comparateur d'énergie",
  assinaturaCMD: 'Signature électronique',
  multiImoveis: 'Multi-copropriétés',
  benchmarking: 'Comparatif des immeubles',
  efatura: 'Facturation électronique',
  votacaoOnline: 'Vote en ligne',
  atasIA: 'Procès-verbaux IA',
  pagDigitais: 'Paiements en ligne',
  mapaQuotas: 'Répartition des charges',
  orc3: 'Mise en concurrence',
  cobrJud: 'Recouvrement judiciaire',
  carregamentoVE: 'Bornes de recharge',
  monitorizacao: 'Suivi des consommations',
  arquivoDig: 'Archives numériques',
  declEncargos: 'État daté',
  obrigPrazos: 'Obligations & échéances',
  prazosLegais: 'Délais légaux',
  acessibilidade: 'Accessibilité',
  preparadorAG: "Préparateur d'AG",
  trackerDelibs: 'Suivi des résolutions',
  procuracoes: 'Pouvoirs & présences',
  seguroObr: 'Assurance obligatoire',
  fcr: 'Fonds de travaux',
  sinistros: 'Sinistres',
  segEdificio: 'Sécurité incendie',
  notificJud: 'Procédures judiciaires',
  infracoes: 'Infractions au règlement',
  cobrAuto: 'Relances automatiques',
  rgpdCenter: 'Centre RGPD',
  certEnerg: 'DPE collectif',
  extranet: 'Extranet copropriétaires',
  lancFat: 'Saisie IA des factures',
  comunicDig: 'Communication numérique',
  emailsFixy: 'E-mails Fixy',
  modulos: 'Mes modules',
  definicoes: 'Paramètres',
  logout: 'Se déconnecter',
}

/**
 * Modules masqués en français : sans objet pour un syndicat de copropriété
 * français. efatura : transmission des factures à l'administration fiscale
 * portugaise (AT).
 */
export const MASQUES_FR: ReadonlySet<string> = new Set(['efatura'])

const traduireEntree = (e: SidebarEntry): SidebarEntry =>
  isItem(e) ? { ...e, label: LIBELLES_FR[e.id] ?? e.label } : { header: SOUS_TITRES_FR[e.header] ?? e.header }

export const SIDEBAR_FR: SidebarSection[] = SIDEBAR.map((s) => ({
  title: SECTIONS_FR[s.title] ?? s.title,
  entries: s.entries.filter((e) => !isItem(e) || !MASQUES_FR.has(e.id)).map(traduireEntree),
}))

/** Map id → libellé FR (fil d'Ariane, titres de repli). */
export const SIDE_TITLES_FR: Record<string, string> = Object.fromEntries(
  SIDEBAR_FR.flatMap((s) => s.entries.filter(isItem).map((i) => [i.id, i.label])),
)
