// Registre des modules FR — miroir du `BESPOKE` du mockup v8 (route id → composant).
// 69 entrées : chaque id de la sidebar (hors `logout`) doit avoir son module ;
// l'intégrité est vérifiée par tests/components/syndic-v54-fr-integrity.test.tsx.

import type { ComponentType } from 'react'

import ModFixy from './ModFixy'
import ModMax from './ModMax'
import ModLea from './ModLea'
import ModAlfredo from './ModAlfredo'
import ModTempo from './ModTempo'
import ModCockpit from './ModCockpit'
import ModDashboard from './ModDashboard'
import ModMandats from './ModMandats'
import ModAGElective from './ModAGElective'
import ModReddition from './ModReddition'
import ModHonoraires from './ModHonoraires'
import ModPriseFonction from './ModPriseFonction'
import ModDossierJud from './ModDossierJud'
import ModPouvoirs from './ModPouvoirs'
import ModRedressement from './ModRedressement'
import ModNotifJud from './ModNotifJud'
import ModJournal from './ModJournal'
import ModPortefeuille from './ModPortefeuille'
import ModCharge from './ModCharge'
import ModValidation from './ModValidation'
import ModInterventions from './ModInterventions'
import ModCanal from './ModCanal'
import ModPlanning from './ModPlanning'
import ModEquipe from './ModEquipe'
import ModCopros from './ModCopros'
import ModLots from './ModLots'
import ModPrestataires from './ModPrestataires'
import ModContrats from './ModContrats'
import ModAscenseurs from './ModAscenseurs'
import ModCCTV from './ModCCTV'
import ModCompta from './ModCompta'
import ModAppels from './ModAppels'
import ModImpayes from './ModImpayes'
import ModFondsTravaux from './ModFondsTravaux'
import ModOpenBanking from './ModOpenBanking'
import ModBudget from './ModBudget'
import ModExtranet from './ModExtranet'
import ModAffichage from './ModAffichage'
import ModSondages from './ModSondages'
import ModReservation from './ModReservation'
import ModDoleances from './ModDoleances'
import ModSMS from './ModSMS'
import ModRemboursements from './ModRemboursements'
import ModNPS from './ModNPS'
import ModDocsInterv from './ModDocsInterv'
import ModAnalyseDevis from './ModAnalyseDevis'
import ModPPT from './ModPPT'
import ModCarnet from './ModCarnet'
import ModVisite from './ModVisite'
import ModDTG from './ModDTG'
import ModSinistres from './ModSinistres'
import ModObligations from './ModObligations'
import ModCalendrier from './ModCalendrier'
import ModImmat from './ModImmat'
import ModAssurance from './ModAssurance'
import ModDPE from './ModDPE'
import ModAccessibilite from './ModAccessibilite'
import ModPrepAG from './ModPrepAG'
import ModDelibs from './ModDelibs'
import ModProcurations from './ModProcurations'
import ModRGPD from './ModRGPD'
import ModSecIncendie from './ModSecIncendie'
import ModSaisieFactures from './ModSaisieFactures'
import ModRedactionPV from './ModRedactionPV'
import ModComDigitale from './ModComDigitale'
import ModSignature from './ModSignature'
import ModGED from './ModGED'
import ModMesModules from './ModMesModules'
import ModParametres from './ModParametres'

export interface ModuleProps {
  /** Navigation interne du dashboard (remplace le hash-routing du mockup). */
  onNavigate?: (id: string) => void
}

export const MODULES_FR: Record<string, ComponentType<ModuleProps>> = {
  // Agents IA
  fixy: ModFixy,
  max: ModMax,
  lea: ModLea,
  alfredo: ModAlfredo,
  tempo: ModTempo,
  // Mandat judiciaire
  cockpit: ModCockpit,
  dashboard: ModDashboard,
  mandats: ModMandats,
  agElective: ModAGElective,
  reddition: ModReddition,
  honoraires: ModHonoraires,
  // Pilotage judiciaire
  priseFonction: ModPriseFonction,
  dossierJud: ModDossierJud,
  pouvoirs: ModPouvoirs,
  redressement: ModRedressement,
  notifJud: ModNotifJud,
  journal: ModJournal,
  // Cabinet & supervision
  portefeuille: ModPortefeuille,
  charge: ModCharge,
  validation: ModValidation,
  // Gestion courante
  interventions: ModInterventions,
  canal: ModCanal,
  planning: ModPlanning,
  equipe: ModEquipe,
  // Patrimoine
  copros: ModCopros,
  lots: ModLots,
  prestataires: ModPrestataires,
  contrats: ModContrats,
  ascenseurs: ModAscenseurs,
  cctv: ModCCTV,
  // Comptabilité & finances
  compta: ModCompta,
  appels: ModAppels,
  impayes: ModImpayes,
  fondsTravaux: ModFondsTravaux,
  openBanking: ModOpenBanking,
  budget: ModBudget,
  // Copropriétaires (Extranet)
  extranet: ModExtranet,
  affichage: ModAffichage,
  sondages: ModSondages,
  reservation: ModReservation,
  doleances: ModDoleances,
  sms: ModSMS,
  remboursements: ModRemboursements,
  nps: ModNPS,
  // Technique & travaux
  docsInterv: ModDocsInterv,
  analyseDevis: ModAnalyseDevis,
  ppt: ModPPT,
  carnet: ModCarnet,
  visite: ModVisite,
  dtg: ModDTG,
  sinistres: ModSinistres,
  // Conformité légale
  obligations: ModObligations,
  calendrier: ModCalendrier,
  immat: ModImmat,
  assurance: ModAssurance,
  dpe: ModDPE,
  accessibilite: ModAccessibilite,
  prepAG: ModPrepAG,
  delibs: ModDelibs,
  procurations: ModProcurations,
  rgpd: ModRGPD,
  secIncendie: ModSecIncendie,
  // Outils IA
  saisieFactures: ModSaisieFactures,
  redactionPV: ModRedactionPV,
  comDigitale: ModComDigitale,
  signature: ModSignature,
  ged: ModGED,
  // Compte
  modules: ModMesModules,
  parametres: ModParametres,
}
