import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes du module « Preparador AG » (route preparadorAG). */
interface PreparadorAgTextes {
  titre: string
  chapeau: string
  nouvelleAg: string
  /** Libellé du bouton (avec le « + » du bundle). */
  nouvelleAgBouton: string
  enDeveloppement: string
  vide: { titre: string; desc: string; action: string; toast: string }
}

export const PREPARADOR_AG_MESSAGES = defineMessages<PreparadorAgTextes>({
  'pt-PT': {
    titre: 'Preparador AG',
    chapeau: 'Gere convocatórias e ordem do dia em poucos cliques',
    nouvelleAg: 'Nova AG',
    nouvelleAgBouton: '+ Nova AG',
    enDeveloppement: 'Preparação de assembleias em desenvolvimento',
    vide: {
      titre: 'Nenhuma AG preparada',
      desc: 'Prepare a sua próxima assembleia geral com convocatória, ordem do dia e lista de verificação de documentos',
      action: 'Começar a preparação',
      toast: 'Preparar AG',
    },
  },
  'fr-FR': {
    titre: "Préparateur d'AG",
    chapeau: 'Préparez convocations et ordres du jour en quelques clics',
    nouvelleAg: 'Nouvelle AG',
    nouvelleAgBouton: '+ Nouvelle AG',
    enDeveloppement: 'Préparation des assemblées en cours de développement',
    vide: {
      titre: 'Aucune AG préparée',
      desc: 'Préparez votre prochaine assemblée générale : convocation, ordre du jour et liste de contrôle des documents à joindre',
      action: 'Commencer la préparation',
      toast: "Préparer l'AG",
    },
  },
})
