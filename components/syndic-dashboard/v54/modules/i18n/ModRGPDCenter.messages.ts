import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Couleur d'une carte « droit de la personne concernée ». */
export type CorDireito = 'sage' | 'gold' | 'amber' | 'rust'

/**
 * Textes de l'écran « RGPD Compliance Center » / « Centre RGPD ».
 * Règlement (UE) 2016/679 : art. 12 (réponse dans un délai d'un mois, prolongeable de deux mois),
 * art. 15 à 21 (droits), art. 30 (registre), art. 33 (notification à l'autorité de contrôle sous
 * 72 heures) ; en France, l'autorité de contrôle est la CNIL (loi n° 78-17 du 6 janvier 1978).
 */
interface RGPDCenterTextes {
  surtitre: string
  titre: string
  chapeau: string
  nouvelleDemande: string
  /** Titre du toast « en développement » du bouton « nouvelle demande ». */
  nouvelleDemandeToast: string
  exporterRegistre: string
  exporterRegistreToast: string
  alerte: { titre: string; a: string; fort1: string; b: string; fort2: string; c: string; fort3: string; d: string }
  kpi: { traitements: string; demandes: string; dansLesDelais: string; prochesEcheance: string; violations: string; fixyNum: string; fixy: string }
  onglets: { sol: string; trat: string; log: string; pol: string; viol: string }
  vide: { titre: string; desc: string; action: string; actionToast: string }
  droitsTitre: string
  droits: [string, string, CorDireito][]
}

export const RGPD_CENTER_MESSAGES = defineMessages<RGPDCenterTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · REGULAMENTO (UE) 2016/679 + EAA 2025',
    titre: 'RGPD Compliance Center',
    chapeau: 'Registo tratamentos · Direitos titulares · Resposta em 30 dias · Logs imutáveis · Fixy classifica + redige',
    nouvelleDemande: 'Nova solicitação titular',
    nouvelleDemandeToast: 'Nova solicitação titular',
    exporterRegistre: 'Exportar registo tratamentos',
    exporterRegistreToast: 'Exportar registo de tratamentos',
    alerte: {
      titre: 'Obrigações RGPD para administradores de condomínio',
      a: 'Manter ',
      fort1: 'registo de atividades de tratamento',
      b: ' (art. 30.°). Responder a pedidos de exercício de direitos (acesso, retificação, oposição, esquecimento, portabilidade) em ',
      fort2: '30 dias',
      c: '. Notificar CNPD violações em ',
      fort3: '72h',
      d: '.',
    },
    kpi: {
      traitements: 'Tratamentos registados',
      demandes: 'Solicitações ativas',
      dansLesDelais: 'Respondidas em prazo',
      prochesEcheance: 'A < 5 dias do prazo',
      violations: 'Violações declaradas',
      fixyNum: 'Fixy',
      fixy: 'Classificação + draft',
    },
    onglets: {
      sol: 'Solicitações (0)',
      trat: 'Registo Tratamentos',
      log: 'Logs eliminação/exportação',
      pol: 'Políticas privacidade',
      viol: 'Violações',
    },
    vide: {
      titre: 'Nenhuma solicitação ativa',
      desc: 'Quando um condómino exerce um direito RGPD, Fixy classifica em 5 segundos (acesso · retificação · oposição · esquecimento · portabilidade) e prepara o draft de resposta com a data coletada.',
      action: 'Simular solicitação',
      actionToast: 'Simular solicitação',
    },
    droitsTitre: 'Direitos RGPD do titular — 30 dias resposta',
    droits: [
      ['Direito de acesso', 'Art. 15.° · cópia dos dados pessoais', 'sage'],
      ['Direito de retificação', 'Art. 16.° · correção dados imprecisos', 'sage'],
      ['Direito de oposição', 'Art. 21.° · cessar tratamento específico', 'amber'],
      ['Direito de esquecimento', 'Art. 17.° · eliminar dados', 'rust'],
      ['Direito de portabilidade', 'Art. 20.° · export formato estruturado', 'sage'],
      ['Direito de limitação', 'Art. 18.° · suspender tratamento', 'amber'],
    ],
  },
  'fr-FR': {
    surtitre: 'OBLIGATION LÉGALE · RÈGLEMENT (UE) 2016/679 + LOI INFORMATIQUE ET LIBERTÉS',
    titre: 'Centre RGPD',
    chapeau: 'Registre des traitements · Droits des personnes · Réponse sous 1 mois · Journaux inaltérables · Fixy classe et rédige',
    nouvelleDemande: "Nouvelle demande d'exercice de droits",
    nouvelleDemandeToast: "Nouvelle demande d'exercice de droits",
    exporterRegistre: 'Exporter le registre des traitements',
    exporterRegistreToast: 'Exporter le registre des traitements',
    alerte: {
      titre: 'Obligations RGPD du syndic de copropriété',
      a: 'Tenir un ',
      fort1: 'registre des activités de traitement',
      b: " (art. 30). Répondre aux demandes d'exercice des droits (accès, rectification, opposition, effacement, portabilité) dans un délai d'",
      fort2: 'un mois',
      c: ', prolongeable de deux mois si nécessaire (art. 12). Notifier à la CNIL toute violation de données présentant un risque pour les personnes, si possible dans les ',
      fort3: '72 heures',
      d: ' suivant sa découverte (art. 33).',
    },
    kpi: {
      traitements: 'Traitements enregistrés',
      demandes: 'Demandes en cours',
      dansLesDelais: 'Traitées dans les délais',
      prochesEcheance: "À moins de 5 jours de l'échéance",
      violations: 'Violations notifiées',
      fixyNum: 'Fixy',
      fixy: 'Classement + brouillon',
    },
    onglets: {
      sol: 'Demandes (0)',
      trat: 'Registre des traitements',
      log: "Journaux d'effacement et d'export",
      pol: 'Politiques de confidentialité',
      viol: 'Violations de données',
    },
    vide: {
      titre: 'Aucune demande en cours',
      desc: "Lorsqu'un copropriétaire exerce un droit RGPD, Fixy classe sa demande en 5 secondes (accès · rectification · opposition · effacement · portabilité) et prépare un brouillon de réponse à partir des données collectées.",
      action: 'Simuler une demande',
      actionToast: 'Simuler une demande',
    },
    droitsTitre: 'Droits RGPD de la personne concernée — réponse sous 1 mois',
    droits: [
      ["Droit d'accès", 'Art. 15 · copie des données personnelles', 'sage'],
      ['Droit de rectification', 'Art. 16 · correction des données inexactes', 'sage'],
      ["Droit d'opposition", "Art. 21 · arrêt d'un traitement déterminé", 'amber'],
      ["Droit à l'effacement", 'Art. 17 · suppression des données', 'rust'],
      ['Droit à la portabilité', 'Art. 20 · export dans un format structuré', 'sage'],
      ['Droit à la limitation', 'Art. 18 · suspension du traitement', 'amber'],
    ],
  },
})
