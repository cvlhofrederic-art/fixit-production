import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Libellés des six champs du formulaire, dans l'ordre d'affichage. */
interface ChampsRapport {
  immeublesGeres: string
  interventionsMois: string
  montantTravaux: string
  budgetAnnuel: string
  depensesAnnee: string
  budgetConsomme: string
}

/** Textes de l'écran « Relatório de Gestão » / « Rapport de gestion ». */
interface RelGestaoTextes {
  titre: string
  chapeau: string
  alerte: { titre: string; texte: string }
  periode: string
  moisAria: string
  mois: string
  anneeAria: string
  telecharger: string
  champs: ChampsRapport
  observations: string
  observationsPlaceholder: string
  apercu: string
  enteteApercu: string
  periodeApercu: string
  genere: string
  stats: { immeubles: string; interventions: string; montantTravaux: string; budgetConsomme: string }
  invitation: string
  /** Taux de consommation du budget (entier déjà arrondi). */
  pourcentage: (n: number) => string
  toastConnexion: string
  pdf: { fichier: string; titre: string; sousTitre: string }
}

export const REL_GESTAO_MESSAGES = defineMessages<RelGestaoTextes>({
  'pt-PT': {
    titre: 'Relatório de Gestão',
    chapeau: 'Relatório anual · Prestação de contas · Art.° 1436.° CC · Lei 8/2022',
    alerte: {
      titre: 'Relatório de Gestão — Art.° 1436.° do Código Civil',
      texte: 'O administrador do condomínio é obrigado a prestar contas à assembleia de condóminos (Lei 8/2022). Este relatório facilita a prestação de contas mensal e anual.',
    },
    periode: 'Dados do período — Abril 2026',
    moisAria: 'Mês',
    mois: 'Abril',
    anneeAria: 'Ano',
    telecharger: 'Descarregar PDF',
    champs: {
      immeublesGeres: 'Edifícios geridos',
      interventionsMois: 'Intervenções do mês',
      montantTravaux: 'Montante obras (€)',
      budgetAnnuel: 'Orçamento anual (€)',
      depensesAnnee: 'Despesas do ano (€)',
      budgetConsomme: 'Orçamento consumido',
    },
    observations: 'Observações',
    observationsPlaceholder: 'Notas adicionais, alertas regulamentares, decisões pendentes…',
    apercu: 'Pré-visualização do relatório',
    enteteApercu: 'Relatório Mensal de Gestão',
    periodeApercu: 'Abril 2026',
    genere: 'Gerado a 24/05/2026',
    stats: { immeubles: 'Edifícios', interventions: 'Intervenções', montantTravaux: 'Montante obras', budgetConsomme: 'Orçamento consumido' },
    invitation: 'Preencha os dados acima para gerar o relatório de gestão de Abril 2026',
    pourcentage: (n) => `${n}%`,
    toastConnexion: 'Conecte-se como síndico para gerar o relatório.',
    pdf: { fichier: 'relatorio-gestao.pdf', titre: 'Relatório de Gestão', sousTitre: 'Art.º 1436.º CC · Lei 8/2022' },
  },
  'fr-FR': {
    titre: 'Rapport de gestion',
    chapeau: 'Rapport annuel · Approbation des comptes en AG · Art. 18 et 21 de la loi n° 65-557 du 10 juillet 1965',
    alerte: {
      titre: "Rapport de gestion — approbation des comptes par l'assemblée générale",
      texte: "Le syndic établit les comptes du syndicat et leurs annexes, puis les soumet au vote de l'assemblée générale des copropriétaires (art. 18 de la loi n° 65-557 du 10 juillet 1965). Le conseil syndical l'assiste et contrôle sa gestion (art. 21). Ce rapport facilite le suivi mensuel et la préparation de l'approbation annuelle des comptes.",
    },
    periode: 'Données de la période — avril 2026',
    moisAria: 'Mois',
    mois: 'Avril',
    anneeAria: 'Année',
    telecharger: 'Télécharger le PDF',
    champs: {
      immeublesGeres: 'Immeubles gérés',
      interventionsMois: 'Interventions du mois',
      montantTravaux: 'Montant des travaux (€)',
      budgetAnnuel: 'Budget prévisionnel (€)',
      depensesAnnee: "Charges de l'exercice (€)",
      budgetConsomme: 'Budget consommé',
    },
    observations: 'Observations',
    observationsPlaceholder: 'Notes complémentaires, alertes réglementaires, décisions en attente…',
    apercu: 'Aperçu du rapport',
    enteteApercu: 'Rapport mensuel de gestion',
    periodeApercu: 'Avril 2026',
    genere: 'Généré le 24/05/2026',
    stats: { immeubles: 'Immeubles', interventions: 'Interventions', montantTravaux: 'Montant des travaux', budgetConsomme: 'Budget consommé' },
    invitation: "Renseignez les données ci-dessus pour générer le rapport de gestion d'avril 2026",
    pourcentage: (n) => `${n} %`,
    toastConnexion: 'Connectez-vous en tant que syndic pour générer le rapport.',
    pdf: { fichier: 'rapport-gestion.pdf', titre: 'Rapport de gestion', sousTitre: 'Loi n° 65-557 du 10 juillet 1965 · art. 18 et 21' },
  },
})
