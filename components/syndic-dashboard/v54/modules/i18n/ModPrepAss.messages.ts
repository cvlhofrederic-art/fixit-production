import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes du module « Preparador de Assembleia » (route prepAss). */
interface PrepAssTextes {
  titre: string
  chapeau: string
  nouvelleAssemblee: string
  enDeveloppement: string
  cadre: { titre: string; texte: string }
  vide: { titre: string; desc: string; action: string }
}

export const PREP_ASS_MESSAGES = defineMessages<PrepAssTextes>({
  'pt-PT': {
    titre: 'Preparador de Assembleia',
    chapeau: 'Convocatória · Ordem de trabalhos · Quóruns · Lei 8/2022',
    nouvelleAssemblee: 'Nova Assembleia',
    enDeveloppement: 'Preparação de assembleias em desenvolvimento',
    cadre: {
      titre: 'Enquadramento Legal — Lei 8/2022',
      texte: 'Convocatória com antecedência mínima de 10 dias (CC art. 1432.°) · 2.ª convocação 30 min depois · Procuração com poderes especiais · Atas obrigatórias',
    },
    vide: {
      titre: 'Nenhuma assembleia preparada',
      desc: 'Crie a sua primeira assembleia de condóminos',
      action: 'Iniciar preparação',
    },
  },
  'fr-FR': {
    titre: "Préparation de l'assemblée générale",
    chapeau: 'Convocation · Ordre du jour · Majorités · Loi du 10 juillet 1965 et décret du 17 mars 1967',
    nouvelleAssemblee: 'Nouvelle assemblée',
    enDeveloppement: 'Préparation des assemblées en cours de développement',
    cadre: {
      titre: 'Cadre légal — loi du 10 juillet 1965 et décret du 17 mars 1967',
      texte: "Convocation notifiée au moins 21 jours avant la réunion, sauf urgence (art. 9 du décret) · Documents à joindre à la convocation (art. 11 du décret) · Aucun quorum requis : décisions aux majorités des art. 24, 25 et 26 de la loi · Trois délégations de vote au plus par mandataire, sauf si ses voix et celles de ses mandants n'excèdent pas 10 % des voix du syndicat (art. 22 de la loi) · Procès-verbal obligatoire (art. 17 du décret), notifié aux opposants et défaillants dans le mois (art. 42 de la loi)",
    },
    vide: {
      titre: 'Aucune assemblée préparée',
      desc: 'Créez votre première assemblée générale de copropriétaires',
      action: 'Lancer la préparation',
    },
  },
})
