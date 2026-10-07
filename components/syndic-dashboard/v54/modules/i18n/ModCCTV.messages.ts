import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes de l'écran « Câmaras de Vigilância » / « Vidéoprotection ».
 * FR : vidéoprotection des parties communes d'une copropriété — vote de l'AG
 * (loi n° 65-557 du 10 juillet 1965), aucune formalité préalable auprès de la
 * CNIL depuis le RGPD (inscription au registre des traitements), autorisation
 * préfectorale si la caméra filme un lieu ouvert au public, panneau
 * d'information (RGPD art. 13, loi Informatique et libertés art. 104),
 * conservation d'un mois au plus et accès réservé aux personnes habilitées
 * (fiche CNIL « La vidéosurveillance – vidéoprotection dans les immeubles d'habitation »).
 */
interface CctvTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrerCamera: string
  enregistrerCameraToast: string
  enregistrerCameraDesc: string
  genererPanneaux: string
  genererPanneauxToast: string
  alerte: {
    titre: string
    /** Quatre règles : partie en gras puis suite du texte. */
    fort1: string
    suite1: string
    fort2: string
    suite2: string
    fort3: string
    suite3: string
    fort4: string
    suite4: string
  }
  kpi: {
    cameras: string
    immeubles: string
    signalisation: string
    autorisations: string
    conservation: string
    journal: string
  }
  onglets: { cam: string; sin: string; logs: string }
  colonnes: {
    immeuble: string
    emplacement: string
    type: string
    conservation: string
    responsable: string
    autorisation: string
    signalisation: string
  }
  aucuneCamera: string
}

export const CCTV_MESSAGES = defineMessages<CctvTextes>({
  'pt-PT': {
    surtitre: 'RGPD + DL 35/2004',
    titre: 'Câmaras de Vigilância',
    chapeau: 'Inventário · Sinalização auto-gerada · Logs acesso · Retenção 30 dias máximo · CNPD compliance',
    enregistrerCamera: '+ Registar câmara',
    enregistrerCameraToast: 'Registar câmara',
    enregistrerCameraDesc: 'Gestão de videovigilância em desenvolvimento',
    genererPanneaux: 'Gerar cartazes sinalização',
    genererPanneauxToast: 'Gerar cartazes de sinalização',
    alerte: {
      titre: 'Videovigilância em condomínio — regras',
      fort1: 'Autorização CNPD',
      suite1: ' obrigatória (ou notificação simplificada). ',
      fort2: 'Sinalização visível',
      suite2: ' nas entradas (cartaz com fim · responsável · contactos). ',
      fort3: 'Retenção máxima 30 dias',
      suite3: '. ',
      fort4: 'Acesso restrito',
      suite4: ' (logs obrigatórios).',
    },
    kpi: {
      cameras: 'Câmaras registadas',
      immeubles: 'Edifícios cobertos',
      signalisation: 'Com sinalização',
      autorisations: 'Autorizações CNPD',
      conservation: 'Retenção > 30d (não-conforme)',
      journal: 'Logs acesso (mês)',
    },
    onglets: { cam: 'Câmaras (0)', sin: 'Sinalização', logs: 'Logs Acesso' },
    colonnes: {
      immeuble: 'Edifício',
      emplacement: 'Localização',
      type: 'Tipo',
      conservation: 'Retenção (dias)',
      responsable: 'Responsável acesso',
      autorisation: 'Autorização CNPD',
      signalisation: 'Sinalização',
    },
    aucuneCamera: 'Nenhuma câmara registada.',
  },
  'fr-FR': {
    surtitre: 'RGPD + loi Informatique et libertés',
    titre: 'Vidéoprotection',
    chapeau: "Inventaire · Panneaux d'information générés automatiquement · Journal des accès · Conservation d'un mois au plus · Conformité CNIL",
    enregistrerCamera: '+ Enregistrer une caméra',
    enregistrerCameraToast: 'Enregistrer une caméra',
    enregistrerCameraDesc: 'Gestion de la vidéoprotection en cours de développement',
    genererPanneaux: "Générer les panneaux d'information",
    genererPanneauxToast: "Générer les panneaux d'information",
    alerte: {
      titre: 'Vidéoprotection en copropriété — règles',
      fort1: "Vote de l'assemblée générale",
      suite1: " obligatoire avant toute installation dans les parties communes (aucune formalité auprès de la CNIL, inscription au registre des traitements ; autorisation préfectorale si un lieu ouvert au public est filmé). ",
      fort2: "Panneau d'information visible",
      suite2: ' à chaque entrée (pictogramme · finalités · responsable · durée de conservation · droits · contact CNIL). ',
      fort3: "Conservation d'un mois au plus",
      suite3: '. ',
      fort4: 'Accès réservé',
      suite4: ' aux personnes habilitées : syndic, membres du conseil syndical, gardien (accès journalisés).',
    },
    kpi: {
      cameras: 'Caméras enregistrées',
      immeubles: 'Immeubles couverts',
      signalisation: "Avec panneau d'information",
      autorisations: "Résolutions d'AG",
      conservation: 'Conservation > 30 j (non conforme)',
      journal: 'Accès journalisés (mois)',
    },
    onglets: { cam: 'Caméras (0)', sin: "Panneaux d'information", logs: 'Journal des accès' },
    colonnes: {
      immeuble: 'Immeuble',
      emplacement: 'Emplacement',
      type: 'Type',
      conservation: 'Conservation (jours)',
      responsable: 'Responsable des accès',
      autorisation: "Résolution d'AG",
      signalisation: "Panneau d'information",
    },
    aucuneCamera: 'Aucune caméra enregistrée.',
  },
})
