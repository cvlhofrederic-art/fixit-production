import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Couleur d'une carte « type de communication ». */
export type CorComunicacao = 'sage' | 'gold' | 'amber' | 'rust'

/** Statuts d'un processus (codes de l'API, inchangés dans les deux langues). */
type EstadoProcesso = 'ativo' | 'arquivado'

/**
 * Textes de l'écran « Centro de Notificações Judiciais » (CC art. 1436.° o) e p), Lei 8/2022) /
 * « Procédures judiciaires & information des copropriétaires » (décret n° 67-223 du 17 mars 1967 :
 * art. 59, information de chaque copropriétaire ; art. 55, autorisation de l'AG et compte rendu).
 */
interface NotificJudTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrerActe: string
  genererRapport: string
  rapport: { titre: string; actifs: (n: number) => string; aucun: string }
  alerte: {
    titre: string
    l1Fort: string
    l1Texte: string
    l2Fort: string
    l2Avant: string
    l2Fort2: string
    l2Apres: string
  }
  kpi: { actifs: string; total: string; valeur: string; archives: string; prochainNum: string; prochain: string; leaNum: string; ocr: string }
  onglets: { proc: (n: number) => string; inbox: string; com: string; rel: string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { type: string; contrepartie: string; numero: string; date: string; valeur: string; statut: string }
  /** Statuts d'un processus (codes de l'API) ; repli sur la valeur brute si inconnue. */
  statuts: Record<EstadoProcesso, string>
  typesTitre: string
  types: [string, string, CorComunicacao][]
  formulaire: {
    titre: string
    type: string
    typePlaceholder: string
    contrepartie: string
    contrepartiePlaceholder: string
    numero: string
    numeroPlaceholder: string
    date: string
    delai: string
    delaiAide: string
    statut: string
    valeur: string
    valeurAide: string
    description: string
    descriptionPlaceholder: string
    annuler: string
    enregistrer: string
  }
  erreurType: string
  okTitre: string
}

export const NOTIFIC_JUD_MESSAGES = defineMessages<NotificJudTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · CC ART. 1436.° o) e p)',
    titre: 'Centro de Notificações Judiciais',
    chapeau: 'Citações · Notificações · Sentenças · Relatório semestral automático · Léa OCR + Fixy redação',
    enregistrerActe: 'Upload notificação',
    genererRapport: 'Gerar relatório semestral',
    rapport: {
      titre: 'Relatório semestral',
      actifs: (n) => `${n} processos ativos a incluir`,
      aucun: 'Registe o primeiro processo para gerar o relatório',
    },
    alerte: {
      titre: 'Obrigação dupla — Lei 8/2022',
      l1Fort: 'Alínea o)',
      l1Texte: ' — Informar condóminos sempre que o condomínio é citado/notificado (processo judicial, arbitral, injunção, contraordenacional ou administrativo).',
      l2Fort: 'Alínea p)',
      l2Avant: ' — Informar ',
      l2Fort2: 'pelo menos semestralmente',
      l2Apres: ' sobre o desenvolvimento dos processos em curso.',
    },
    kpi: {
      actifs: 'Processos ativos',
      total: 'Total processos',
      valeur: 'Valor em causa',
      archives: 'Arquivados',
      prochainNum: 'semestral',
      prochain: 'Próximo relatório',
      leaNum: 'Léa',
      ocr: 'OCR + classificação',
    },
    onglets: {
      proc: (n) => `Processos (${n})`,
      inbox: 'Inbox notificações',
      com: 'Comunicações enviadas',
      rel: 'Relatórios semestrais',
    },
    vide: {
      titre: 'Nenhum processo judicial em curso',
      desc: 'Quando uma notificação chegar, faça upload. Léa classifica (citação · notificação · sentença), extrai partes + prazos, Fixy redige a comunicação aos condóminos afetados.',
      action: '+ Primeira notificação',
    },
    colonnes: { type: 'Tipo', contrepartie: 'Contraparte', numero: 'Processo n.º', date: 'Data', valeur: 'Valor', statut: 'Estado' },
    statuts: { ativo: 'Ativo', arquivado: 'Arquivado' },
    typesTitre: 'Tipos de comunicação automática',
    types: [
      ['Citação tribunal', 'Email a todos os condóminos · cópia notificação · prazo defesa', 'rust'],
      ['Notificação injunção', 'Email + carta registada · explicação simples · próximos passos', 'amber'],
      ['Sentença favorável', 'Email all · resumo + acta arquivo', 'sage'],
      ['Sentença contrária', 'Email all · análise impactos + plano resposta', 'rust'],
      ['Procedimento contraord.', 'Email all · descrição + defesa em curso', 'amber'],
      ['Update semestral', 'Auto-gerado · sumário evolução todos processos', 'gold'],
    ],
    formulaire: {
      titre: 'Novo processo / notificação',
      type: 'Tipo',
      typePlaceholder: 'Citação, injunção, sentença…',
      contrepartie: 'Contraparte',
      contrepartiePlaceholder: 'Nome / entidade',
      numero: 'N.º de processo',
      numeroPlaceholder: 'Ex.: 1234/26.0T8PRT',
      date: 'Data',
      delai: 'Prazo',
      delaiAide: 'Defesa / resposta',
      statut: 'Estado',
      valeur: 'Valor em causa',
      valeurAide: 'Euros',
      description: 'Descrição',
      descriptionPlaceholder: 'Objeto do processo, partes, estado…',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurType: 'Indique o tipo de processo.',
    okTitre: 'Processo registado',
  },
  'fr-FR': {
    surtitre: 'OBLIGATION LÉGALE · DÉCRET DU 17 MARS 1967, ART. 55 ET 59',
    titre: 'Procédures judiciaires & information des copropriétaires',
    chapeau: "Assignations · Actes de procédure · Jugements · Compte rendu automatique à l'AG · OCR Léa + rédaction Fixy",
    enregistrerActe: 'Enregistrer un acte reçu',
    genererRapport: "Préparer le compte rendu à l'AG",
    rapport: {
      titre: 'Compte rendu des procédures',
      actifs: (n) => `${n} ${n > 1 ? 'procédures en cours' : 'procédure en cours'} à inclure`,
      aucun: 'Enregistrez une première procédure pour préparer le compte rendu',
    },
    alerte: {
      titre: 'Double obligation — décret du 17 mars 1967',
      l1Fort: 'Art. 59',
      l1Texte: " — Aviser chaque copropriétaire de l'existence et de l'objet de toute instance qui concerne le fonctionnement du syndicat ou dans laquelle le syndicat est partie (assignation, injonction de payer, référé, recours devant une juridiction administrative…).",
      l2Fort: 'Art. 55',
      l2Avant: ' — Rendre compte ',
      l2Fort2: 'à la prochaine assemblée générale',
      l2Apres: " des actions introduites. Sauf exceptions (recouvrement de créances, mesures conservatoires, référé, défense du syndicat), le syndic ne peut agir en justice qu'avec l'autorisation préalable de l'AG.",
    },
    kpi: {
      actifs: 'Procédures en cours',
      total: 'Total des procédures',
      valeur: 'Montant en jeu',
      archives: 'Archivées',
      prochainNum: 'AG',
      prochain: 'Prochain compte rendu',
      leaNum: 'Léa',
      ocr: 'OCR + classement',
    },
    onglets: {
      proc: (n) => `Procédures (${n})`,
      inbox: 'Actes reçus',
      com: 'Communications envoyées',
      rel: "Comptes rendus à l'AG",
    },
    vide: {
      titre: 'Aucune procédure judiciaire en cours',
      desc: "Dès qu'un acte arrive, enregistrez-le. Léa le classe (assignation · injonction · jugement) et en extrait les parties et les délais, puis Fixy rédige l'avis destiné à chaque copropriétaire.",
      action: '+ Premier acte reçu',
    },
    colonnes: { type: 'Type', contrepartie: 'Partie adverse', numero: 'N° de procédure', date: 'Date', valeur: 'Montant', statut: 'Statut' },
    statuts: { ativo: 'En cours', arquivado: 'Archivée' },
    typesTitre: 'Types de communication automatique',
    types: [
      ['Assignation du syndicat', "E-mail à chaque copropriétaire · copie de l'acte · délai pour se défendre", 'rust'],
      ['Injonction de payer', 'E-mail + lettre recommandée avec AR · explication simple · prochaines étapes', 'amber'],
      ['Jugement favorable', 'E-mail à tous · résumé + archivage du jugement', 'sage'],
      ['Jugement défavorable', 'E-mail à tous · analyse des conséquences + plan de réponse', 'rust'],
      ['Procédure administrative', 'E-mail à tous · description + défense en cours', 'amber'],
      ["Compte rendu à l'AG", 'Généré automatiquement · synthèse de toutes les procédures (art. 55)', 'gold'],
    ],
    formulaire: {
      titre: 'Nouvelle procédure / nouvel acte',
      type: 'Type',
      typePlaceholder: 'Assignation, injonction de payer, jugement…',
      contrepartie: 'Partie adverse',
      contrepartiePlaceholder: 'Nom / organisme',
      numero: 'N° de procédure',
      numeroPlaceholder: 'Ex. : RG n° 26/01234',
      date: 'Date',
      delai: 'Échéance',
      delaiAide: 'Défense / réponse',
      statut: 'Statut',
      valeur: 'Montant en jeu',
      valeurAide: 'En euros',
      description: 'Description',
      descriptionPlaceholder: "Objet de la procédure, parties, état d'avancement…",
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurType: 'Indiquez le type de procédure.',
    okTitre: 'Procédure enregistrée',
  },
})
