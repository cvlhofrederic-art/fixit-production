import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Couleur d'une carte de catégorie (PT) / de famille (FR). */
export type CouleurCategorie = 'sage' | 'gold' | 'amber' | 'rust'

/**
 * Code de catégorie envoyé à /api/syndic/seg-edificio et à l'agent (inchangé) :
 * catégorie de risque RT-SCIE au Portugal, famille d'habitation en France
 * (arrêté du 31 janvier 1986).
 */
export type CodeCategorie = '1' | '2' | '3' | '4'

/**
 * Textes de l'écran « Segurança Contra Incêndio » / « Sécurité incendie ».
 * En français, les champs de l'API gardent leur nom mais reçoivent l'équivalent du droit
 * français : categoria → famille d'habitation, encarregado → référent sécurité,
 * planoEmergencia → consignes de sécurité affichées, ultimoExercicio → dernière vérification
 * des équipements de sécurité.
 */
interface SegEdificioTextes {
  surtitre: string
  titre: string
  chapeau: string
  classer: string
  genererPlan: string
  alerte: { titre: string; avant: string; fort1: string; milieu: string; fort2: string; apres: string }
  kpi: { classes: string; referents: string; plans: string; exercices: string; cat4: string; enRetard: string }
  onglets: { ed: (n: number) => string; enc: (n: number) => string; plano: (n: number) => string; ex: string }
  vide: { titre: string; desc: string; action: string }
  ligne: { referent: (nom: string) => string; sansReferent: string; dernierExercice: (date: string) => string; planOk: string; categorie: (code: string) => string }
  panneauCategories: string
  /** Cartes : titre, description, couleur. */
  categories: [string, string, CouleurCategorie][]
  classement: {
    titre: string
    immeuble: string
    nomImmeuble: string
    categorie: string
    options: Record<CodeCategorie, string>
    plan: string
    non: string
    oui: string
    referent: string
    nomReferent: string
    dernierExercice: string
    formatDate: string
    annuler: string
    classer: string
  }
  plan: {
    titre: string
    immeuble: string
    nomImmeuble: string
    categorie: string
    options: Record<CodeCategorie, string>
    referent: string
    nomFacultatif: string
    fermer: string
    enCours: string
    regenerer: string
    generer: string
  }
  erreurImmeuble: string
  toasts: {
    classe: string
    erreurClassement: string
    reessayerPlusTard: string
    classeDemo: string
    connexionRequise: string
    immeuble: string
    indiquerImmeuble: string
    plan: string
    connexionAlfredo: string
    erreur: string
    erreurPlan: string
  }
}

export const SEG_EDIFICIO_MESSAGES = defineMessages<SegEdificioTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · DL 220/2008 (RSCIE) + PORTARIA 1532/2008',
    titre: 'Segurança Contra Incêndio',
    chapeau: 'Classificação UT 1-12 · Categoria risco 1/2/3/4 · Encarregado de Segurança · Plano emergência · Exercícios',
    classer: 'Classificar edifício',
    genererPlan: 'Gerar plano emergência (Alfredo)',
    alerte: {
      titre: 'Regime Jurídico de Segurança Contra Incêndio',
      avant: 'Todos os edifícios habitacionais (UT I) com altura > 9m ou > 9 pisos = ',
      fort1: 'categoria risco 3 ou 4',
      milieu: '. Obrigam ',
      fort2: 'Encarregado de Segurança',
      apres: ' designado + plano emergência + exercícios de evacuação anuais.',
    },
    kpi: {
      classes: 'Edifícios classificados',
      referents: 'Encarregados designados',
      plans: 'Planos emergência gerados IA',
      exercices: 'Exercícios realizados (12m)',
      cat4: 'Categoria 4 (risco elevado)',
      enRetard: 'Exercícios em atraso',
    },
    onglets: {
      ed: (n) => `Edifícios (${n})`,
      enc: (n) => `Encarregados (${n})`,
      plano: (n) => `Planos emergência (${n})`,
      ex: 'Exercícios',
    },
    vide: {
      titre: 'Nenhum edifício classificado',
      desc: 'Alfredo classifica automaticamente segundo RT-SCIE (utilização-tipo + altura + densidade) e gera plano de emergência 70%-pronto à medida.',
      action: 'Classificar primeiro edifício',
    },
    ligne: {
      referent: (nom) => `Encarregado: ${nom}`,
      sansReferent: 'Sem encarregado',
      dernierExercice: (date) => ` · Último exercício: ${date}`,
      planOk: 'Plano OK',
      categorie: (code) => `Categoria ${code}`,
    },
    panneauCategories: 'Categorias de Risco RT-SCIE',
    categories: [
      ['Categoria 1 — Reduzido', 'Altura ≤ 9m · até 100 ocupantes', 'sage'],
      ['Categoria 2 — Moderado', 'Altura ≤ 28m · até 500 ocupantes', 'sage'],
      ['Categoria 3 — Elevado', 'Altura ≤ 50m · até 1500 ocupantes', 'amber'],
      ['Categoria 4 — Muito Elevado', 'Altura > 50m · > 1500 ocupantes', 'rust'],
    ],
    classement: {
      titre: 'Classificar edifício (SCIE)',
      immeuble: 'Edifício',
      nomImmeuble: 'Nome do edifício',
      categorie: 'Categoria de risco',
      options: { 1: 'Categoria 1 — Reduzido', 2: 'Categoria 2 — Moderado', 3: 'Categoria 3 — Elevado', 4: 'Categoria 4 — Muito Elevado' },
      plan: 'Plano de emergência',
      non: 'Não',
      oui: 'Sim',
      referent: 'Encarregado de Segurança',
      nomReferent: 'Nome do encarregado',
      dernierExercice: 'Último exercício',
      formatDate: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      classer: 'Classificar',
    },
    plan: {
      titre: 'Gerar plano de emergência (Alfredo)',
      immeuble: 'Edifício',
      nomImmeuble: 'Nome do edifício',
      categorie: 'Categoria de risco',
      options: { 1: 'Categoria 1', 2: 'Categoria 2', 3: 'Categoria 3', 4: 'Categoria 4' },
      referent: 'Encarregado de Segurança',
      nomFacultatif: 'Nome (opcional)',
      fermer: 'Fechar',
      enCours: 'A gerar…',
      regenerer: 'Regenerar',
      generer: 'Gerar plano',
    },
    erreurImmeuble: 'O edifício é obrigatório.',
    toasts: {
      classe: 'Edifício classificado',
      erreurClassement: 'Erro ao classificar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      classeDemo: 'Edifício classificado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      immeuble: 'Edifício',
      indiquerImmeuble: 'Indique o edifício.',
      plan: 'Plano de emergência',
      connexionAlfredo: 'Conecte-se como síndico para usar o Alfredo.',
      erreur: 'Erro',
      erreurPlan: 'Não foi possível gerar o plano.',
    },
  },
  'fr-FR': {
    surtitre: "OBLIGATION LÉGALE · ARRÊTÉ DU 31 JANVIER 1986 (BÂTIMENTS D'HABITATION)",
    titre: 'Sécurité incendie',
    chapeau: 'Classement en familles 1 à 4 · Référent sécurité · Consignes et plans affichés · Vérification des équipements',
    classer: 'Classer un immeuble',
    genererPlan: 'Générer les consignes (Alfredo)',
    alerte: {
      titre: "Protection contre l'incendie des bâtiments d'habitation",
      avant: "Les bâtiments d'habitation sont classés en quatre familles selon leur type, leur nombre d'étages et la hauteur du plancher bas du logement le plus haut ; au-delà de 28 m, l'immeuble relève de la ",
      fort1: '4e famille',
      milieu: " (au-delà de 50 m : immeuble de grande hauteur). Le syndic fait afficher dans les halls d'entrée, près des escaliers et des ascenseurs, les ",
      fort2: "consignes en cas d'incendie et les plans des sous-sols et du rez-de-chaussée",
      apres: " (art. 100 de l'arrêté). Il fait vérifier au moins une fois par an la détection, le désenfumage, la ventilation et les colonnes sèches, s'assure du bon fonctionnement des portes coupe-feu et tient un registre de sécurité (art. 101).",
    },
    kpi: {
      classes: 'Immeubles classés',
      referents: 'Référents désignés',
      plans: 'Consignes affichées',
      exercices: 'Vérifications réalisées (12 mois)',
      cat4: '4e famille (plus de 28 m)',
      enRetard: 'Vérifications en retard',
    },
    onglets: {
      ed: (n) => `Immeubles (${n})`,
      enc: (n) => `Référents (${n})`,
      plano: (n) => `Consignes (${n})`,
      ex: 'Vérifications',
    },
    vide: {
      titre: 'Aucun immeuble classé',
      desc: "Alfredo détermine la famille d'habitation de l'immeuble (hauteur du plancher bas du logement le plus haut, nombre d'étages, accès des secours) et prépare des consignes de sécurité sur mesure, prêtes à 70 %.",
      action: 'Classer un premier immeuble',
    },
    ligne: {
      referent: (nom) => `Référent : ${nom}`,
      sansReferent: 'Sans référent',
      dernierExercice: (date) => ` · Dernière vérification : ${date}`,
      planOk: 'Consignes affichées',
      categorie: (code) => (code === '1' ? '1re famille' : `${code}e famille`),
    },
    panneauCategories: "Familles des bâtiments d'habitation (arrêté du 31 janvier 1986)",
    categories: [
      ['1re famille — maisons individuelles', 'Maisons isolées ou jumelées en R+1 au plus · maisons en bande en rez-de-chaussée', 'sage'],
      ["2e famille — collectif jusqu'à R+3", "Maisons individuelles de plus d'un étage · collectifs de 3 étages au plus sur rez-de-chaussée", 'sage'],
      ["3e famille — jusqu'à 28 m", "Plancher bas du logement le plus haut ≤ 28 m · 3A ou 3B selon les distances et l'accès des secours", 'amber'],
      ['4e famille — de 28 à 50 m', 'Plancher bas du logement le plus haut > 28 m et ≤ 50 m · au-delà : IGH', 'rust'],
    ],
    classement: {
      titre: 'Classer un immeuble (sécurité incendie)',
      immeuble: 'Immeuble',
      nomImmeuble: "Nom de l'immeuble",
      categorie: "Famille d'habitation",
      options: {
        1: '1re famille — maisons individuelles',
        2: "2e famille — collectif jusqu'à R+3",
        3: "3e famille — jusqu'à 28 m",
        4: '4e famille — de 28 à 50 m',
      },
      plan: 'Consignes de sécurité affichées',
      non: 'Non',
      oui: 'Oui',
      referent: 'Référent sécurité',
      nomReferent: 'Nom du référent',
      dernierExercice: 'Dernière vérification',
      formatDate: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      classer: 'Classer',
    },
    plan: {
      titre: 'Générer les consignes de sécurité (Alfredo)',
      immeuble: 'Immeuble',
      nomImmeuble: "Nom de l'immeuble",
      categorie: "Famille d'habitation",
      options: { 1: '1re famille', 2: '2e famille', 3: '3e famille', 4: '4e famille' },
      referent: 'Référent sécurité',
      nomFacultatif: 'Nom (facultatif)',
      fermer: 'Fermer',
      enCours: 'Génération…',
      regenerer: 'Régénérer',
      generer: 'Générer les consignes',
    },
    erreurImmeuble: "L'immeuble est obligatoire.",
    toasts: {
      classe: 'Immeuble classé',
      erreurClassement: 'Erreur lors du classement',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      classeDemo: 'Immeuble classé (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      immeuble: 'Immeuble',
      indiquerImmeuble: "Indiquez l'immeuble.",
      plan: 'Consignes de sécurité',
      connexionAlfredo: 'Connectez-vous en tant que syndic pour utiliser Alfredo.',
      erreur: 'Erreur',
      erreurPlan: 'Impossible de générer les consignes.',
    },
  },
})
