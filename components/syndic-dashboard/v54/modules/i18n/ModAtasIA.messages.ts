import { defineMessages } from '@/lib/syndic/v54/i18n'

interface AtasIaTextes {
  titre: string
  nouveau: string
  sousTitre: string
  onglets: { ger: string; atas: string; mod: string }
  accueil: { titre: string; desc: string; partirDeZero: string; voirModeles: string }
  modelesBientot: { titre: string; desc: string }
  notesLabel: string
  notesPlaceholder: string
  generer: string
  generation: string
  annuler: string
  redaction: string
  toasts: {
    genere: string
    pretRelecture: string
    erreur: string
    indisponible: string
    demo: string
    connexionRequise: string
  }
  /** Message envoyé à l'agent Alfredo (consigne de rédaction + notes collées). */
  consigne: (notes: string) => string
}

export const ATAS_IA_MESSAGES = defineMessages<AtasIaTextes>({
  'pt-PT': {
    titre: 'Atas com IA — Atas de Assembleia',
    nouveau: '+ Nova Ata',
    sousTitre: 'Geração inteligente de atas de assembleia de condóminos',
    onglets: { ger: 'Gerar Ata', atas: 'Atas Geradas', mod: 'Modelos' },
    accueil: {
      titre: 'Gerar uma nova ata',
      desc: 'Utilize o assistente passo a passo para criar uma ata de assembleia completa, ou comece a partir de um modelo.',
      partirDeZero: 'Começar do zero',
      voirModeles: 'Ver modelos',
    },
    modelesBientot: { titre: 'Modelos', desc: 'Em breve — comece do zero entretanto' },
    notesLabel: 'Ordem de trabalhos / notas da reunião',
    notesPlaceholder: 'Ex.:\n1. Aprovação das contas 2025\n2. Orçamento 2026 (votado, 720/1000 milésimos a favor)\n3. Obras de reabilitação da fachada\n4. Assuntos diversos',
    generer: 'Gerar ata com IA',
    generation: 'A gerar…',
    annuler: 'Cancelar',
    redaction: 'O Alfredo está a redigir a ata…',
    toasts: {
      genere: 'Ata gerada',
      pretRelecture: 'Pronta para revisão',
      erreur: 'Erro ao gerar',
      indisponible: 'O Alfredo está indisponível, tente novamente',
      demo: 'Geração de ata (demo)',
      connexionRequise: 'Conecte-se como síndico para gerar com o Alfredo',
    },
    consigne: (notes) => `Gera uma ata de assembleia de condóminos em português de Portugal, bem estruturada (cabeçalho com data e local, presenças e quórum, ordem de trabalhos, deliberações e votações por ponto, encerramento), a partir destes pontos/notas:\n\n${notes}`,
  },
  'fr-FR': {
    titre: "Procès-verbaux IA — PV d'assemblée générale",
    nouveau: '+ Nouveau PV',
    sousTitre: "Rédaction assistée des procès-verbaux d'assemblée générale des copropriétaires (art. 17 du décret du 17 mars 1967)",
    onglets: { ger: 'Rédiger un PV', atas: 'PV générés', mod: 'Modèles' },
    accueil: {
      titre: 'Rédiger un nouveau procès-verbal',
      desc: "Utilisez l'assistant pas à pas pour établir un procès-verbal d'AG complet, ou partez d'un modèle.",
      partirDeZero: 'Partir de zéro',
      voirModeles: 'Voir les modèles',
    },
    modelesBientot: { titre: 'Modèles', desc: 'Bientôt disponible — partez de zéro en attendant' },
    notesLabel: 'Ordre du jour / notes de séance',
    notesPlaceholder: 'Ex. :\n1. Approbation des comptes 2025 (art. 24)\n2. Budget prévisionnel 2026 (adopté, 720/1000 tantièmes pour)\n3. Travaux de ravalement de la façade\n4. Questions diverses',
    generer: "Générer le PV avec l'IA",
    generation: 'Génération en cours…',
    annuler: 'Annuler',
    redaction: 'Alfredo rédige le procès-verbal…',
    toasts: {
      genere: 'Procès-verbal généré',
      pretRelecture: 'Prêt pour relecture',
      erreur: 'Erreur lors de la génération',
      indisponible: 'Alfredo est indisponible, veuillez réessayer',
      demo: 'Génération du PV (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour générer avec Alfredo',
    },
    consigne: (notes) => `Rédige en français le procès-verbal d'une assemblée générale de copropriétaires, conforme à l'article 17 du décret n° 67-223 du 17 mars 1967 et à la loi n° 65-557 du 10 juillet 1965. Structure attendue :
1. En-tête : syndicat des copropriétaires et immeuble, date, heure et lieu de la séance, modalités de participation (en présentiel, par visioconférence, vote par correspondance).
2. Bureau : président de séance, secrétaire et, le cas échéant, scrutateurs.
3. Feuille de présence (art. 14 du décret) : nombre de copropriétaires et de tantièmes présents, représentés et ayant voté par correspondance, sur le total des tantièmes.
4. Pour chaque question de l'ordre du jour : texte de la résolution, majorité applicable (art. 24, 25 avec passerelle de l'art. 25-1, 26 ou unanimité), résultat du vote en tantièmes (pour, contre, abstentions), noms et voix des copropriétaires opposants ou abstentionnistes, et réserves éventuelles.
5. Clôture de la séance (heure) et emplacements de signature du président, du secrétaire et des scrutateurs.
Ne mentionne aucun quorum : il n'en existe pas en assemblée de copropriété. N'invente aucun nom ni aucun chiffre absent des notes : laisse un champ à compléter entre crochets. Points et notes de la séance :

${notes}`,
  },
})
