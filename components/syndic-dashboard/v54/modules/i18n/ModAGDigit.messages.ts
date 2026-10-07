import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Type d'AG (code stocké par l'API ; le libellé dépend de la langue). */
export type TypeAg = 'ordinaria' | 'extraordinaria' | 'urgente'

interface AgDigitTextes {
  titre: string
  chapeau: string
  nouvelleAg: string
  kpi: { total: string; enCours: string; cloturees: string; resolutions: string }
  vide: { titre: string; desc: string; creerPremiere: string }
  colonnes: { titre: string; immeuble: string; date: string; type: string; seuil: string; statut: string }
  types: Record<TypeAg, string>
  etats: { enCours: string; cloturee: string }
  /** Unité accolée au seuil affiché dans le tableau. */
  pourcent: string
  modal: {
    titre: string
    champTitre: string
    titrePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    dateHeure: string
    type: string
    options: Record<TypeAg, string>
    lieu: string
    lieuPlaceholder: string
    seuil: string
    seuilAide: string
    tantiemes: string
    tantiemesAide: string
    ordreDuJour: string
    ordreDuJourAide: string
    ordreDuJourPlaceholder: string
    annuler: string
    creer: string
  }
  erreurs: { titre: string; dateHeure: string; seuil: string }
  toasts: { creee: string; erreurCreation: string; reessayerPlusTard: string; creeeDemo: string; connexionRequise: string }
}

export const AG_DIGIT_MESSAGES = defineMessages<AgDigitTextes>({
  'pt-PT': {
    titre: 'AG Digitais',
    chapeau: 'Convocação · Votação em sessão e por correspondência · Maiorias legais · Ata em PDF assinada',
    nouvelleAg: 'Nova AG',
    kpi: { total: 'Total AG', enCours: 'Em curso', cloturees: 'Encerradas', resolutions: 'Resoluções totais' },
    vide: {
      titre: 'Nenhuma AG',
      desc: 'Organize as suas assembleias gerais 100% online com votação por correspondência',
      creerPremiere: 'Criar a primeira AG',
    },
    colonnes: { titre: 'Título', immeuble: 'Edifício', date: 'Data', type: 'Tipo', seuil: 'Quórum', statut: 'Estado' },
    types: { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', urgente: 'Urgente' },
    etats: { enCours: 'Em curso', cloturee: 'Encerrada' },
    pourcent: '%',
    modal: {
      titre: 'Nova Assembleia Geral',
      champTitre: 'Título',
      titrePlaceholder: 'AG Anual 2026 — Residência Os Pinheiros',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência Os Pinheiros, 12 rua…',
      dateHeure: 'Data e hora',
      type: 'Tipo',
      options: { ordinaria: 'Ordinária (AGO)', extraordinaria: 'Extraordinária (AGE)', urgente: 'Urgente (CC art. 1432.º)' },
      lieu: 'Local',
      lieuPlaceholder: 'Sala de reuniões, 12 rua…',
      seuil: 'Quórum',
      seuilAide: 'Percentagem mínima para deliberar',
      tantiemes: 'Total milésimos',
      tantiemesAide: 'Capital total do condomínio',
      ordreDuJour: 'Ordem do dia',
      ordreDuJourAide: 'Um ponto por linha',
      ordreDuJourPlaceholder: 'Aprovação das contas 2025\nVotação do orçamento 2026\nObras de reabilitação\nAssuntos diversos',
      annuler: 'Cancelar',
      creer: 'Criar a AG',
    },
    erreurs: {
      titre: 'Indique o título da AG.',
      dateHeure: 'A data e hora são obrigatórias.',
      seuil: 'O quórum deve estar entre 0 e 100 %.',
    },
    toasts: {
      creee: 'AG criada',
      erreurCreation: 'Erro ao criar AG',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'AG criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Assemblées générales',
    chapeau: 'Convocation · Vote en séance, à distance et par correspondance · Majorités des art. 24, 25 et 26 · Procès-verbal signé en PDF',
    nouvelleAg: 'Nouvelle AG',
    kpi: { total: 'Total des AG', enCours: 'En cours', cloturees: 'Clôturées', resolutions: 'Résolutions (total)' },
    vide: {
      titre: 'Aucune AG',
      desc: 'Organisez vos assemblées générales à distance : visioconférence et vote par correspondance (art. 17-1 A de la loi du 10 juillet 1965)',
      creerPremiere: 'Créer la première AG',
    },
    colonnes: { titre: 'Intitulé', immeuble: 'Immeuble', date: 'Date', type: 'Type', seuil: 'Seuil', statut: 'Statut' },
    types: { ordinaria: 'Ordinaire', extraordinaria: 'Extraordinaire', urgente: 'Urgente' },
    etats: { enCours: 'En cours', cloturee: 'Clôturée' },
    pourcent: ' %',
    modal: {
      titre: 'Nouvelle assemblée générale',
      champTitre: 'Intitulé',
      titrePlaceholder: 'AG annuelle 2026 — Résidence Les Pins',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence Les Pins, 12 rue…',
      dateHeure: 'Date et heure',
      type: 'Type',
      options: {
        ordinaria: 'Ordinaire (AGO)',
        extraordinaria: 'Extraordinaire (AGE)',
        urgente: 'Urgente (délai de convocation réduit, art. 9 du décret de 1967)',
      },
      lieu: 'Lieu',
      lieuPlaceholder: 'Salle de réunion, 12 rue…',
      seuil: 'Seuil de participation',
      seuilAide: 'Indicatif : la loi ne fixe aucun quorum en copropriété',
      tantiemes: 'Total des tantièmes',
      tantiemesAide: 'Selon le règlement de copropriété (souvent 1 000 ou 10 000)',
      ordreDuJour: 'Ordre du jour',
      ordreDuJourAide: 'Une question par ligne',
      ordreDuJourPlaceholder: 'Approbation des comptes 2025\nVote du budget prévisionnel 2026\nTravaux de ravalement\nQuestions diverses',
      annuler: 'Annuler',
      creer: "Créer l'AG",
    },
    erreurs: {
      titre: "Indiquez l'intitulé de l'AG.",
      dateHeure: "La date et l'heure sont obligatoires.",
      seuil: 'Le seuil doit être compris entre 0 et 100 %.',
    },
    toasts: {
      creee: 'AG créée',
      erreurCreation: "Erreur lors de la création de l'AG",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'AG créée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
