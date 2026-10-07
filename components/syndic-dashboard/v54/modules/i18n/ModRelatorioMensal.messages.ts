import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Indicateur de l'aperçu : valeur, libellé, teinte. */
export type StatRapport = readonly [string, string, string]

/** Intervention de l'aperçu : intitulé, prestataire, date, montant. */
export type InterventionRapport = readonly [string, string, string, string]

interface RelatorioMensalTextes {
  titre: string
  chapeau: string
  /** Noms des mois, de janvier à décembre. */
  mois: string[]
  champMois: string
  champAnnee: string
  envoyer: string
  envoiEmail: string
  enDeveloppement: string
  telecharger: string
  connexionRequise: string
  apercu: string
  rapportTitre: string
  /** Libellé précédant la date de génération (nœud de texte distinct de la date). */
  genereLe: string
  interventionsMois: string
  aucuneIntervention: string
  intervention: string
  stats: { immeubles: string; interventionsMois: string; montantTravaux: string; budgetConsomme: string }
  pourcentage: (n: number) => string
  pdf: {
    fichier: (periode: string) => string
    titre: string
    sousTitre: string
    tableau: string
    colonnes: [string, string, string, string]
  }
  demo: {
    stats: StatRapport[]
    interventions: InterventionRapport[]
    mois: string[]
    periode: string
  }
}

export const RELATORIO_MENSAL_MESSAGES = defineMessages<RelatorioMensalTextes>({
  'pt-PT': {
    titre: 'Relatório Mensal',
    chapeau: 'Síntese mensal de gestão — descarregar PDF ou enviar aos condóminos',
    mois: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    champMois: 'Mês',
    champAnnee: 'Ano',
    envoyer: 'Enviar aos condóminos',
    envoiEmail: 'Envio por email',
    enDeveloppement: 'Funcionalidade em desenvolvimento.',
    telecharger: 'Descarregar PDF',
    connexionRequise: 'Conecte-se como síndico para gerar o relatório.',
    apercu: 'Pré-visualização do relatório — este conteúdo será gerado em PDF',
    rapportTitre: 'Relatório Mensal de Gestão',
    genereLe: 'Gerado a ',
    interventionsMois: 'Intervenções do mês',
    aucuneIntervention: 'Nenhuma intervenção neste mês.',
    intervention: 'Intervenção',
    stats: { immeubles: 'Edifícios', interventionsMois: 'Intervenções do mês', montantTravaux: 'Montante obras', budgetConsomme: 'Orçamento consumido' },
    pourcentage: (n) => `${n}%`,
    pdf: {
      fichier: (periode) => `relatorio-mensal-${periode}.pdf`,
      titre: 'Relatório Mensal de Gestão',
      sousTitre: 'Síntese mensal de gestão',
      tableau: 'Intervenções do mês',
      colonnes: ['Descrição', 'Profissional', 'Data', 'Montante'],
    },
    demo: {
      stats: [
        ['4', 'Edifícios', 'gold'],
        ['2', 'Intervenções do mês', 'gold'],
        ['0 €', 'Montante obras', 'sage'],
        ['55%', 'Orçamento consumido', 'sage'],
      ],
      interventions: [
        ['Residencial Cedofeita — Inspeção técnica', 'Bruno Tavares', '12/04/2026', '0 €'],
        ['Edifício Atlântico — Manutenção corrente', 'Diogo Pereira', '29/04/2026', '0 €'],
      ],
      mois: ['Abril', 'Maio'],
      periode: 'Abril 2026',
    },
  },
  'fr-FR': {
    titre: 'Rapport mensuel',
    chapeau: 'Synthèse mensuelle de gestion — télécharger le PDF ou envoyer aux copropriétaires',
    mois: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    champMois: 'Mois',
    champAnnee: 'Année',
    envoyer: 'Envoyer aux copropriétaires',
    envoiEmail: 'Envoi par e-mail',
    enDeveloppement: 'Fonctionnalité en cours de développement.',
    telecharger: 'Télécharger le PDF',
    connexionRequise: 'Connectez-vous en tant que syndic pour générer le rapport.',
    apercu: 'Aperçu du rapport — ce contenu sera généré en PDF',
    rapportTitre: 'Rapport mensuel de gestion',
    genereLe: 'Généré le ',
    interventionsMois: 'Interventions du mois',
    aucuneIntervention: 'Aucune intervention ce mois-ci.',
    intervention: 'Intervention',
    stats: { immeubles: 'Immeubles', interventionsMois: 'Interventions du mois', montantTravaux: 'Montant des travaux', budgetConsomme: 'Budget consommé' },
    pourcentage: (n) => `${n} %`,
    pdf: {
      fichier: (periode) => `rapport-mensuel-${periode}.pdf`,
      titre: 'Rapport mensuel de gestion',
      sousTitre: 'Synthèse mensuelle de gestion',
      tableau: 'Interventions du mois',
      colonnes: ['Description', 'Prestataire', 'Date', 'Montant'],
    },
    demo: {
      stats: [
        ['4', 'Immeubles', 'gold'],
        ['2', 'Interventions du mois', 'gold'],
        ['0 €', 'Montant des travaux', 'sage'],
        ['55 %', 'Budget consommé', 'sage'],
      ],
      interventions: [
        ['Résidence Croix-Rousse — Contrôle technique', 'Bruno Tessier', '12/04/2026', '0 €'],
        ['Résidence Atlantique — Entretien courant', 'Damien Perrin', '29/04/2026', '0 €'],
      ],
      mois: ['Avril', 'Mai'],
      periode: 'Avril 2026',
    },
  },
})
