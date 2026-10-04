import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { creerModuleGenerique, type ConfigModuleGenerique } from '@/components/administrateur-judiciaire/modules/ModuleGenerique'

/**
 * Registre des écrans : route (ancre #route) → composant, chargé à la demande (next/dynamic), et statut de
 * branchement de chaque écran sur la base locale.
 */

/**
 * Configurations d'écrans génériques (route → configuration de creerModuleGenerique) : vide dans la maquette.
 * Une route ajoutée ici remplacerait l'écran du même id dans REGISTRE_ECRANS.
 */
export const CONFIGS_MODULES_GENERIQUES: Record<string, ConfigModuleGenerique> = {}

/**
 * Les 76 écrans, dans l'ordre de la maquette. Toutes les routes de SECTIONS_NAVIGATION y figurent, sauf la
 * pseudo-route « logout ».
 */
export const ECRANS_PAR_ROUTE: Record<string, ComponentType> = {
  fiche360: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/Fiche360CoproprieteModule').then((mod) => mod.Fiche360CoproprieteModule)),
  personne360: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/Fiche360PersonneModule').then((mod) => mod.Fiche360PersonneModule)),
  tresorerie: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/TresorerieModule').then((mod) => mod.TresorerieModule)),
  reprise: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/RepriseJudiciaireModule').then((mod) => mod.RepriseJudiciaireModule)),
  dossierJuge: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/DossierJugeModule').then((mod) => mod.DossierJugeModule)),
  pointage: dynamic(() => import('@/components/administrateur-judiciaire/modules/cabinet/PointageTerrainModule').then((mod) => mod.PointageTerrainModule)),
  tempsDossiers: dynamic(() => import('@/components/administrateur-judiciaire/modules/cabinet/SuiviDossiersModule').then((mod) => mod.SuiviDossiersModule)),
  cockpit: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/Cockpit').then((mod) => mod.CockpitModule)),
  fixy: dynamic(() => import('@/components/administrateur-judiciaire/modules/agents-ia/FixyModule').then((mod) => mod.FixyModule)),
  max: dynamic(() => import('@/components/administrateur-judiciaire/modules/agents-ia/MaxJuridiqueModule').then((mod) => mod.MaxJuridiqueModule)),
  lea: dynamic(() => import('@/components/administrateur-judiciaire/modules/agents-ia/LeaComptableModule').then((mod) => mod.LeaComptableModule)),
  alfredo: dynamic(() => import('@/components/administrateur-judiciaire/modules/agents-ia/AlfredoCourriersModule').then((mod) => mod.AlfredoCourriersModule)),
  tempo: dynamic(() => import('@/components/administrateur-judiciaire/modules/agents-ia/TempoEcheancesModule').then((mod) => mod.TempoEcheancesModule)),
  dashboard: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/TableauDeBordModule').then((mod) => mod.TableauDeBordModule)),
  mandats: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/OrdonnancesMissions').then((mod) => mod.OrdonnancesMissionsModule)),
  agElective: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/AgElectiveModule').then((mod) => mod.AgElectiveModule)),
  reddition: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/RedditionComptesModule').then((mod) => mod.RedditionComptesModule)),
  honoraires: dynamic(() => import('@/components/administrateur-judiciaire/modules/mandat/HonorairesTaxation').then((mod) => mod.HonorairesTaxationModule)),
  impayes: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/ImpayesRecouvrementModule').then((mod) => mod.ImpayesRecouvrementModule)),
  copros: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/CoproprietesModule').then((mod) => mod.CoproprietesModule)),
  lots: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/LotsCoproprietairesModule').then((mod) => mod.LotsCoproprietairesModule)),
  obligations: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/ObligationsEcheancesModule').then((mod) => mod.ObligationsEcheancesModule)),
  contrats: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/ContratsPrestatairesModule').then((mod) => mod.ContratsPrestatairesModule)),
  sinistres: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/SinistresModule').then((mod) => mod.SinistresModule)),
  interventions: dynamic(() => import('@/components/administrateur-judiciaire/modules/gestion/OrdresService').then((mod) => mod.OrdresServiceModule)),
  prestataires: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/Prestataires').then((mod) => mod.PrestatairesModule)),
  priseFonction: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/PriseFonction').then((mod) => mod.PriseFonctionModule)),
  dossierJud: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/DossierJuridictionnel').then((mod) => mod.DossierJuridictionnelModule)),
  pouvoirs: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/EtenduePouvoirsModule').then((mod) => mod.EtenduePouvoirsModule)),
  redressement: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/Redressement').then((mod) => mod.RedressementModule)),
  notifJud: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/RegistreNotificationsModule').then((mod) => mod.RegistreNotificationsModule)),
  journal: dynamic(() => import('@/components/administrateur-judiciaire/modules/pilotage/JournalActiviteModule').then((mod) => mod.JournalActiviteModule)),
  portefeuille: dynamic(() => import('@/components/administrateur-judiciaire/modules/cabinet/PortefeuilleMandatsModule').then((mod) => mod.PortefeuilleMandatsModule)),
  charge: dynamic(() => import('@/components/administrateur-judiciaire/modules/cabinet/ChargeCollaborateursModule').then((mod) => mod.ChargeCollaborateursModule)),
  validation: dynamic(() => import('@/components/administrateur-judiciaire/modules/cabinet/CircuitValidationModule').then((mod) => mod.CircuitValidationModule)),
  planning: dynamic(() => import('@/components/administrateur-judiciaire/modules/gestion/PlanningModule').then((mod) => mod.PlanningModule)),
  canal: dynamic(() => import('@/components/administrateur-judiciaire/modules/gestion/CanalCommunicationModule').then((mod) => mod.CanalCommunicationModule)),
  reservation: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/ReservationEspacesCommunsModule').then((mod) => mod.ReservationEspacesCommunsModule)),
  affichage: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/TableauAffichageModule').then((mod) => mod.TableauAffichageModule)),
  sondages: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/SondagesModule').then((mod) => mod.SondagesModule)),
  doleances: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/DoleancesModule').then((mod) => mod.DoleancesModule)),
  rgpd: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/CentreRgpdModule').then((mod) => mod.CentreRgpdModule)),
  accessibilite: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/AccessibiliteModule').then((mod) => mod.AccessibiliteModule)),
  procurations: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/ProcurationsModule').then((mod) => mod.ProcurationsModule)),
  equipe: dynamic(() => import('@/components/administrateur-judiciaire/modules/gestion/EquipeCabinetModule').then((mod) => mod.EquipeCabinetModule)),
  assurance: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/AssurancesModule').then((mod) => mod.AssurancesModule)),
  dpe: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/PerformanceEnergetiqueModule').then((mod) => mod.PerformanceEnergetiqueModule)),
  secIncendie: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/SecuriteIncendieModule').then((mod) => mod.SecuriteIncendieModule)),
  extranet: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/ExtranetCoproprietairesModule').then((mod) => mod.ExtranetCoproprietairesModule)),
  carnet: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/CarnetEntretienModule').then((mod) => mod.CarnetEntretienModule)),
  ged: dynamic(() => import('@/components/administrateur-judiciaire/modules/outils-ia/DocumentsGedModule').then((mod) => mod.DocumentsGedModule)),
  docsInterv: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/DocumentsInterventionModule').then((mod) => mod.DocumentsInterventionModule)),
  delibs: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/SuiviDeliberationsModule').then((mod) => mod.SuiviDeliberationsModule)),
  immat: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/ImmatriculationRegistreModule').then((mod) => mod.ImmatriculationRegistreModule)),
  ascenseurs: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/AscenseursModule').then((mod) => mod.AscenseursModule)),
  cctv: dynamic(() => import('@/components/administrateur-judiciaire/modules/patrimoine/VideoprotectionModule').then((mod) => mod.VideoprotectionModule)),
  dtg: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/DtgPlanPluriannuelModule').then((mod) => mod.DtgPlanPluriannuelModule)),
  calendrier: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/CalendrierReglementaireModule').then((mod) => mod.CalendrierReglementaireModule)),
  visite: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/VisitesTechniquesModule').then((mod) => mod.VisitesTechniquesModule)),
  sms: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/MessagesCoproprietairesModule').then((mod) => mod.MessagesCoproprietairesModule)),
  nps: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/NpsPostInterventionModule').then((mod) => mod.NpsPostInterventionModule)),
  analyseDevis: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/AnalyseDevisFacturesModule').then((mod) => mod.AnalyseDevisFacturesModule)),
  prepAG: dynamic(() => import('@/components/administrateur-judiciaire/modules/conformite/PreparateurAgModule').then((mod) => mod.PreparateurAgModule)),
  redactionPV: dynamic(() => import('@/components/administrateur-judiciaire/modules/outils-ia/RedactionPvModule').then((mod) => mod.RedactionPvModule)),
  comDigitale: dynamic(() => import('@/components/administrateur-judiciaire/modules/outils-ia/CommunicationDigitaleModule').then((mod) => mod.CommunicationDigitaleModule)),
  signature: dynamic(() => import('@/components/administrateur-judiciaire/modules/outils-ia/SignatureElectroniqueModule').then((mod) => mod.SignatureElectroniqueModule)),
  ppt: dynamic(() => import('@/components/administrateur-judiciaire/modules/technique/RapportMensuelModule').then((mod) => mod.RapportMensuelModule)),
  appels: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/AppelsDeFondsModule').then((mod) => mod.AppelsDeFondsModule)),
  fondsTravaux: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/FondsTravauxModule').then((mod) => mod.FondsTravauxModule)),
  openBanking: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/OpenBankingModule').then((mod) => mod.OpenBankingModule)),
  budget: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/BudgetPrevisionnelModule').then((mod) => mod.BudgetPrevisionnelModule)),
  saisieFactures: dynamic(() => import('@/components/administrateur-judiciaire/modules/outils-ia/SaisieFacturesModule').then((mod) => mod.SaisieFacturesModule)),
  remboursements: dynamic(() => import('@/components/administrateur-judiciaire/modules/extranet/RemboursementsModule').then((mod) => mod.RemboursementsModule)),
  modules: dynamic(() => import('@/components/administrateur-judiciaire/modules/compte/MesModulesModule').then((mod) => mod.MesModulesModule)),
  parametres: dynamic(() => import('@/components/administrateur-judiciaire/modules/compte/ParametresModule').then((mod) => mod.ParametresModule)),
  compta: dynamic(() => import('@/components/administrateur-judiciaire/modules/finances/ComptabiliteModule').then((mod) => mod.ComptabiliteModule)),
}

/**
 * Registre lu par le Shell (validation de l'ancre, choix de l'écran) : les écrans statiques, complétés par les écrans
 * génériques (aucun en pratique).
 */
export const REGISTRE_ECRANS: Record<string, ComponentType> = {
  ...ECRANS_PAR_ROUTE,
  ...Object.fromEntries(
    Object.entries(CONFIGS_MODULES_GENERIQUES).map(([route, config]) => [route, creerModuleGenerique(config)]),
  ),
}

/** Écrans branchés sur la base locale (reel) ou partiellement (partiel) ; tous les autres sont en démonstration. */
export const STATUTS_ECRANS = {
  reel: ['copros', 'prestataires', 'tresorerie', 'reprise', 'fiche360', 'personne360', 'dossierJuge', 'fixy'],
  partiel: [
    'cockpit',
    'dossierJud',
    'priseFonction',
    'notifJud',
    'obligations',
    'calendrier',
    'mandats',
    'pouvoirs',
    'journal',
    'honoraires',
    'redressement',
    'agElective',
  ],
} as const

export type StatutEcran = 'reel' | 'partiel' | 'demo'

const ROUTES_REELLES: readonly string[] = STATUTS_ECRANS.reel
const ROUTES_PARTIELLES: readonly string[] = STATUTS_ECRANS.partiel

/** Statut d'un écran ; une route inconnue vaut « demo ». */
export const statutEcran = (route: string): StatutEcran =>
  ROUTES_REELLES.includes(route) ? 'reel' : ROUTES_PARTIELLES.includes(route) ? 'partiel' : 'demo'
