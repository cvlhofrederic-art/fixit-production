import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Votacao } from '@/lib/syndic/v54/api'

/** Statut d'une délibération (code stocké par l'API). */
export type EtatVotacao = Votacao['estado']
/** Majorité exigée (code stocké par l'API). */
export type MajoriteVotacao = Votacao['maioria']

interface VotacaoTextes {
  titre: string
  chapeau: string
  nouvelle: string
  kpi: { ouvertes: string; adoptees: string; rejetees: string; participation: string }
  /** Participation moyenne affichée dans l'indicateur. */
  pourcentKpi: (n: number) => string
  onglets: { ativ: string; hist: string; cfg: string }
  enCours: string
  vide: { titre: string; desc: string }
  /** Préfixe de la date limite (suivi de la date brute). */
  echeance: string
  etats: Record<EtatVotacao, string>
  majorites: Record<MajoriteVotacao, string>
  /** Fragments de la ligne de progression (même découpage qu'à l'origine). */
  progression: string
  pourcent: string
  totalVoix: string
  /** Fin de la parenthèse des voix d'une option (ex. « ‰) »). */
  voixOption: string
  modal: {
    champTitre: string
    titrePlaceholder: string
    description: string
    immeuble: string
    immeublePlaceholder: string
    article: string
    articlePlaceholder: string
    majorite: string
    statut: string
    echeance: string
    totalVoix: string
    totalVoixAide: string
    options: string
    optionsAide: string
    annuler: string
    creer: string
  }
  /** Options de vote proposées par défaut (texte libre modifiable, une par ligne). */
  optionsParDefaut: string
  erreurTitre: string
  creee: string
  demo: Votacao[]
}

export const VOTACAO_ONLINE_MESSAGES = defineMessages<VotacaoTextes>({
  'pt-PT': {
    titre: 'Votação Online AG',
    chapeau: 'Gestão de deliberações e votações eletrónicas para assembleias de condóminos',
    nouvelle: 'Nova deliberação',
    kpi: { ouvertes: 'Ativas', adoptees: 'Aprovadas', rejetees: 'Rejeitadas', participation: 'Participação média' },
    pourcentKpi: (n) => `${n}%`,
    onglets: { ativ: 'Votações Ativas', hist: 'Histórico', cfg: 'Configuração' },
    enCours: 'Deliberações em curso',
    vide: { titre: 'Sem deliberações', desc: 'Crie a primeira deliberação para votação eletrónica em AG' },
    echeance: 'Prazo: ',
    etats: { aberta: 'Aberta', aprovada: 'Aprovada', rejeitada: 'Rejeitada', encerrada: 'Encerrada' },
    majorites: { simples: 'Maioria Simples', qualificada: 'Maioria Qualificada', unanimidade: 'Unanimidade' },
    progression: 'Progresso: ',
    pourcent: '%',
    totalVoix: ' permilagem',
    voixOption: '‰)',
    modal: {
      champTitre: 'Título da deliberação',
      titrePlaceholder: 'Ex.: Aprovação do orçamento anual 2026',
      description: 'Descrição',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      article: 'Artigo (CC)',
      articlePlaceholder: 'Art.° 1432.° CC',
      majorite: 'Maioria exigida',
      statut: 'Estado',
      echeance: 'Prazo',
      totalVoix: 'Permilagem total',
      totalVoixAide: 'Ex.: 1000',
      options: 'Opções de voto',
      optionsAide: 'Uma por linha',
      annuler: 'Cancelar',
      creer: 'Criar deliberação',
    },
    optionsParDefaut: 'A favor\nContra\nAbstenção',
    erreurTitre: 'Indique o título da deliberação.',
    creee: 'Deliberação criada',
    demo: [
      { id: 'v1', titulo: 'Aprovação do orçamento anual 2026', descricao: 'Deliberação sobre o orçamento previsto para o exercício de 2026, incluindo quotas ordinárias e fundo de reserva. Valor total proposto: 45.600 EUR', edificio: 'Edifício Sol Nascente', estado: 'aberta', maioria: 'simples', artigo: 'Art.° 1432.° CC', prazo: '2026-05-23', permTotal: 1000, options: [{ label: 'A favor', perm: 360 }, { label: 'Contra', perm: 140 }, { label: 'Abstenção', perm: 0 }] },
      { id: 'v2', titulo: 'Obras de reparação do telhado', descricao: 'Votação para aprovação das obras de reparação urgente do telhado do bloco B. Três orçamentos obtidos. Valor médio: 18.200 EUR. Necessária maioria qualificada.', edificio: 'Edifício Sol Nascente', estado: 'aberta', maioria: 'qualificada', artigo: 'Art.° 1433.° CC', prazo: '2026-05-19', permTotal: 1000, options: [{ label: 'A favor', perm: 250 }, { label: 'Contra', perm: 0 }, { label: 'Abstenção', perm: 0 }] },
    ],
  },
  'fr-FR': {
    titre: 'Vote en ligne (AG)',
    chapeau: "Résolutions soumises au vote de l'assemblée générale : participation par visioconférence et vote par correspondance (art. 17-1 A de la loi du 10 juillet 1965)",
    nouvelle: 'Nouvelle résolution',
    kpi: { ouvertes: 'Ouvertes', adoptees: 'Adoptées', rejetees: 'Rejetées', participation: 'Participation moyenne' },
    pourcentKpi: (n) => `${n} %`,
    onglets: { ativ: 'Votes ouverts', hist: 'Historique', cfg: 'Configuration' },
    enCours: 'Résolutions en cours de vote',
    vide: { titre: 'Aucune résolution', desc: 'Créez la première résolution soumise au vote électronique en AG' },
    echeance: 'Échéance : ',
    etats: { aberta: 'Ouverte', aprovada: 'Adoptée', rejeitada: 'Rejetée', encerrada: 'Clôturée' },
    majorites: { simples: 'Majorité simple (art. 24)', qualificada: 'Majorité absolue (art. 25)', unanimidade: 'Unanimité' },
    progression: 'Progression : ',
    pourcent: ' %',
    totalVoix: ' tantièmes',
    voixOption: ' tantièmes)',
    modal: {
      champTitre: 'Intitulé de la résolution',
      titrePlaceholder: 'Ex. : Approbation du budget prévisionnel 2026',
      description: 'Description',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      article: 'Article (loi de 1965)',
      articlePlaceholder: 'Art. 24, loi du 10 juillet 1965',
      majorite: 'Majorité requise',
      statut: 'Statut',
      echeance: 'Date limite de vote',
      totalVoix: 'Total des tantièmes',
      totalVoixAide: 'Ex. : 1 000 ou 10 000',
      options: 'Options de vote',
      optionsAide: 'Une par ligne',
      annuler: 'Annuler',
      creer: 'Créer la résolution',
    },
    optionsParDefaut: 'Pour\nContre\nAbstention',
    erreurTitre: "Indiquez l'intitulé de la résolution.",
    creee: 'Résolution créée',
    demo: [
      { id: 'v1', titulo: 'Approbation du budget prévisionnel 2026', descricao: "Vote du budget prévisionnel de l'exercice 2026 (art. 14-1 de la loi du 10 juillet 1965), qui sert de base aux appels de provisions sur charges. Montant total proposé : 45 600 €", edificio: 'Résidence Soleil Levant', estado: 'aberta', maioria: 'simples', artigo: 'Art. 24, loi du 10 juillet 1965', prazo: '2026-05-23', permTotal: 1000, options: [{ label: 'Pour', perm: 360 }, { label: 'Contre', perm: 140 }, { label: 'Abstention', perm: 0 }] },
      { id: 'v2', titulo: "Installation d'un contrôle d'accès au bâtiment B", descricao: "Vote de travaux d'amélioration : contrôle d'accès par badge et visiophone pour le bâtiment B. Trois devis obtenus. Montant moyen : 18 200 €. Majorité absolue de l'art. 25 requise ; à défaut, second vote possible à l'art. 24 si le projet recueille au moins le tiers des voix de tous les copropriétaires (art. 25-1).", edificio: 'Résidence Soleil Levant', estado: 'aberta', maioria: 'qualificada', artigo: 'Art. 25, loi du 10 juillet 1965', prazo: '2026-05-19', permTotal: 1000, options: [{ label: 'Pour', perm: 250 }, { label: 'Contre', perm: 0 }, { label: 'Abstention', perm: 0 }] },
    ],
  },
})
