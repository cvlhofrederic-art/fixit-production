import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut d'un remboursement (valeur technique de l'API ; le libellé dépend de la langue). */
export type StatutReembolso = 'pendente' | 'liquidado' | 'bloqueado'

interface ReembolsosTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrerMutation: string
  voirEnAttente: string
  alerte: {
    titre: string
    /** Texte avant le libellé en gras (espace finale comprise). */
    debut: string
    libelleCalcul: string
    /** Séparateur entre le libellé en gras et la formule. */
    separateur: string
    formule: string
    /** Texte après la formule. */
    fin: string
  }
  kpi: { traites: string; totalRembourse: string; aTraiter: string; regleOpenBanking: string; bloques: string; moteur: string }
  onglets: { pendentes: (n: number) => string; liquidados: string; todos: string }
  colonnes: {
    ancienProprietaire: string
    lot: string
    dateVente: string
    provisionsVersees: string
    joursRestants: string
    remboursement: string
    methode: string
    statut: string
  }
  aucun: string
  statuts: Record<StatutReembolso, string>
  pipeline: string
  pipelineSous: string
  /** Étapes du traitement : numéro, titre, détail. */
  etapes: Array<[string, string, string]>
  formulaire: {
    titre: string
    ancienProprietaire: string
    nomVendeur: string
    lot: string
    lotExemple: string
    immeuble: string
    facultatif: string
    dateVente: string
    formatDate: string
    provisionsVersees: string
    remboursement: string
    statut: string
    annuler: string
    enregistrer: string
  }
  erreurs: { ancienProprietaire: string }
  toasts: {
    enregistre: string
    erreurEnregistrement: string
    reessayerPlusTard: string
    enregistreDemo: string
    connexionRequise: string
  }
}

export const REEMBOLSOS_MESSAGES = defineMessages<ReembolsosTextes>({
  'pt-PT': {
    surtitre: 'OPERACIONAL · MUDANÇA DE PROPRIEDADE',
    titre: 'Reembolsos Automáticos',
    chapeau: 'Pro-rata temporis na venda de fração · Max Expert calcula · Open Banking executa · Lei 8/2022 prazos',
    enregistrerMutation: 'Registar mudança proprietário',
    voirEnAttente: 'Ver reembolsos pendentes',
    alerte: {
      titre: 'Direito a reembolso pro-rata na venda',
      debut: 'Quando um condómino vende mid-year, as quotas pré-pagas devem ser reembolsadas proporcionalmente. ',
      libelleCalcul: 'Fórmula',
      separateur: ': ',
      formule: 'quotas_pagas × (dias_restantes / dias_periodo)',
      fin: '. Lei 8/2022 fixa prazo notificação venda em 15 dias.',
    },
    kpi: {
      traites: 'Reembolsos processados (ano)',
      totalRembourse: 'Total reembolsado (ano)',
      aTraiter: 'A processar',
      regleOpenBanking: 'Liquidado via Open Banking',
      bloques: 'Bloqueados (rever)',
      moteur: 'Motor cálculo',
    },
    onglets: { pendentes: (n) => `Pendentes (${n})`, liquidados: 'Liquidados', todos: 'Todos (12m)' },
    colonnes: {
      ancienProprietaire: 'Antigo proprietário',
      lot: 'Fração',
      dateVente: 'Data venda',
      provisionsVersees: 'Quotas pagas',
      joursRestants: 'Dias restantes',
      remboursement: 'Reembolso',
      methode: 'Método',
      statut: 'Estado',
    },
    aucun: 'Nenhum reembolso em curso.',
    statuts: { pendente: 'Pendente', liquidado: 'Liquidado', bloqueado: 'Bloqueado' },
    pipeline: 'Pipeline automático',
    pipelineSous: 'Lei 8/2022 — 15 dias',
    etapes: [
      ['1', 'Declaração venda fração', 'Por antigo proprietário · email/portal · prazo legal 15 dias'],
      ['2', 'Max Expert calcula reembolso', 'Pro-rata sobre quotas + FCR já pagos · prazo < 1h'],
      ['3', 'Validação administrador', '1-clique aprovação ou ajuste manual'],
      ['4', 'Execução Open Banking', 'Ordem virement automática via API AISP'],
      ['5', 'Confirmação + arquivo', 'Email antigo proprietário · arquivo contabilístico'],
    ],
    formulaire: {
      titre: 'Registar reembolso',
      ancienProprietaire: 'Antigo proprietário',
      nomVendeur: 'Nome do vendedor',
      lot: 'Fração',
      lotExemple: 'Ex.: 4B',
      immeuble: 'Edifício',
      facultatif: 'Opcional',
      dateVente: 'Data da venda',
      formatDate: 'AAAA-MM-DD',
      provisionsVersees: 'Quotas pagas (€)',
      remboursement: 'Reembolso (€)',
      statut: 'Estado',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: { ancienProprietaire: 'O antigo proprietário é obrigatório.' },
    toasts: {
      enregistre: 'Reembolso registado',
      erreurEnregistrement: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreDemo: 'Reembolso registado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  // Droit français : pas de prorata temporis opposable au syndicat lors d'une vente.
  // Répartition des provisions vendeur / acquéreur : art. 6-2 du décret n° 67-223 (convention
  // contraire valable entre les parties seulement, art. 6-3) ; avances remboursables : art. 45-1
  // du même décret ; fonds de travaux attaché au lot et non remboursé : art. 14-2-1 de la loi
  // n° 65-557 ; avis de mutation du notaire sous 15 jours et opposition du syndic : art. 20.
  'fr-FR': {
    surtitre: 'OPÉRATIONNEL · MUTATION DE LOT',
    titre: 'Remboursements automatisés',
    chapeau: "Apurement du compte vendeur lors d'une vente de lot · Max Expert calcule · Open Banking exécute · délais de l'art. 20 de la loi de 1965",
    enregistrerMutation: 'Enregistrer une mutation de lot',
    voirEnAttente: 'Voir les remboursements en attente',
    alerte: {
      titre: "Remboursements lors de la vente d'un lot",
      debut: "Lors de la vente d'un lot, le vendeur récupère ses avances (art. 45-1 du décret du 17 mars 1967) et les provisions versées d'avance non encore exigibles ; le trop-perçu révélé ensuite par l'approbation des comptes revient au copropriétaire en place à cette date (art. 6-2 du même décret). ",
      libelleCalcul: 'Calcul',
      separateur: ' : ',
      formule: 'provisions_versées - sommes_exigibles + avances',
      fin: ". Le fonds de travaux reste acquis au syndicat et n'est pas remboursé lors de la vente (art. 14-2-1 de la loi du 10 juillet 1965).",
    },
    kpi: {
      traites: 'Remboursements traités (année)',
      totalRembourse: 'Total remboursé (année)',
      aTraiter: 'À traiter',
      regleOpenBanking: 'Réglé via Open Banking',
      bloques: 'Bloqués (à revoir)',
      moteur: 'Moteur de calcul',
    },
    onglets: { pendentes: (n) => `En attente (${n})`, liquidados: 'Réglés', todos: 'Tous (12 mois)' },
    colonnes: {
      ancienProprietaire: 'Ancien copropriétaire',
      lot: 'Lot',
      dateVente: 'Date de vente',
      provisionsVersees: 'Provisions versées',
      joursRestants: "Délai d'opposition",
      remboursement: 'Remboursement',
      methode: 'Mode de règlement',
      statut: 'Statut',
    },
    aucun: 'Aucun remboursement en cours.',
    statuts: { pendente: 'En attente', liquidado: 'Réglé', bloqueado: 'Bloqué' },
    pipeline: 'Traitement automatisé',
    pipelineSous: 'Art. 20 de la loi de 1965 — 15 jours',
    etapes: [
      ['1', 'Avis de mutation', 'Adressé par le notaire au syndic · délai légal de 15 jours (art. 20 de la loi de 1965)'],
      ['2', 'Max Expert calcule le remboursement', "Avances et provisions versées d'avance · hors fonds de travaux · délai < 1 h"],
      ['3', 'Validation par le syndic', 'Approbation en un clic ou ajustement manuel'],
      ['4', 'Exécution Open Banking', "Virement SEPA depuis le compte séparé du syndicat (initiation de paiement)"],
      ['5', 'Confirmation et archivage', "E-mail à l'ancien copropriétaire · pièce comptable archivée"],
    ],
    formulaire: {
      titre: 'Enregistrer un remboursement',
      ancienProprietaire: 'Ancien copropriétaire',
      nomVendeur: 'Nom du vendeur',
      lot: 'Lot',
      lotExemple: 'Ex. : 4B',
      immeuble: 'Immeuble',
      facultatif: 'Facultatif',
      dateVente: 'Date de la vente',
      formatDate: 'AAAA-MM-JJ',
      provisionsVersees: 'Provisions versées (€)',
      remboursement: 'Remboursement (€)',
      statut: 'Statut',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: { ancienProprietaire: "L'ancien copropriétaire est obligatoire." },
    toasts: {
      enregistre: 'Remboursement enregistré',
      erreurEnregistrement: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreDemo: 'Remboursement enregistré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
