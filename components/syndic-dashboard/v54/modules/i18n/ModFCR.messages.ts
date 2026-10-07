import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes de l'écran « Fundo Comum de Reserva » / « Fonds de travaux ». */
interface FcrTextes {
  /**
   * Taux minimal légal de la cotisation, en % du budget annuel : 10 % au Portugal
   * (DL 268/94, art. 4.º) ; 5 % du budget prévisionnel en France (art. 14-2-1 de la
   * loi n° 65-557 du 10 juillet 1965). Sert de valeur par défaut, de repli et de seuil
   * de conformité.
   */
  tauxMinimal: number
  titre: string
  chapeau: string
  nouvelImmeuble: string
  enregistrerMouvement: string
  kpi: { solde: string; entrees: string; sorties: string; immeubles: string; cotisation: string; conformite: string; ok: string; ko: string }
  onglets: { vg: (n: number) => string; mov: (n: number) => string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { immeuble: string; adresse: string; budget: string; taux: string; soldeInitial: string; conformite: string }
  conforme: string
  insuffisant: string
  immeuble: {
    titre: string
    nom: string
    nomPlaceholder: string
    adresse: string
    adressePlaceholder: string
    budget: string
    taux: string
    tauxAide: string
    soldeInitial: string
    annuler: string
    ajouter: string
  }
  mouvement: {
    titre: string
    type: string
    entree: string
    sortie: string
    date: string
    immeuble: string
    choisirImmeuble: string
    montant: string
    description: string
    descriptionPlaceholder: string
    annuler: string
    enregistrer: string
  }
  erreurs: { nom: string; taux: string; description: string; montant: string }
  toasts: {
    immeubleAjoute: string
    immeubleDetail: (nom: string, taux: number | string) => string
    erreurAjout: string
    reessayerPlusTard: string
    immeubleAjouteDemo: string
    connexionRequise: string
    entreeEnregistree: string
    sortieEnregistree: string
    erreurEnregistrement: string
    entreeEnregistreeDemo: string
    sortieEnregistreeDemo: string
  }
}

export const FCR_MESSAGES = defineMessages<FcrTextes>({
  'pt-PT': {
    tauxMinimal: 10,
    titre: 'Fundo Comum de Reserva',
    chapeau: 'Mínimo legal 10% do orçamento anual · DL 268/94, Art.° 4.° · Código Civil Art.° 1424.°',
    nouvelImmeuble: 'Novo Edifício',
    enregistrerMouvement: '+ Registar Movimento',
    kpi: {
      solde: 'Saldo Total',
      entrees: 'Total Entradas',
      sorties: 'Total Saídas',
      immeubles: 'Edifícios',
      cotisation: 'Contribuição Anual Devida',
      conformite: 'Conformidade Legal',
      ok: 'OK',
      ko: 'KO',
    },
    onglets: { vg: (n) => `Visão Geral (${n})`, mov: (n) => `Movimentos (${n})` },
    vide: {
      titre: 'Nenhum edifício configurado',
      desc: 'Registe os edifícios do seu portefólio para gerir o fundo comum de reserva',
      action: 'Adicionar Edifício',
    },
    colonnes: { immeuble: 'Edifício', adresse: 'Endereço', budget: 'Orçamento anual', taux: 'FCR %', soldeInitial: 'Saldo inicial', conformite: 'Conformidade' },
    conforme: 'Conforme',
    insuffisant: 'Insuficiente',
    immeuble: {
      titre: 'Adicionar edifício ao FCR',
      nom: 'Nome do edifício',
      nomPlaceholder: 'Residência Os Pinheiros',
      adresse: 'Endereço',
      adressePlaceholder: 'Rua…',
      budget: 'Orçamento anual',
      taux: '% FCR',
      tauxAide: 'Mín. legal 10 %',
      soldeInitial: 'Saldo inicial FCR',
      annuler: 'Cancelar',
      ajouter: 'Adicionar edifício',
    },
    mouvement: {
      titre: 'Registar movimento no FCR',
      type: 'Tipo',
      entree: 'Entrada',
      sortie: 'Saída',
      date: 'Data',
      immeuble: 'Edifício',
      choisirImmeuble: '— escolher edifício —',
      montant: 'Montante',
      description: 'Descrição',
      descriptionPlaceholder: 'Origem do movimento, justificação…',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: {
      nom: 'O nome do edifício é obrigatório.',
      taux: 'O FCR não pode ser inferior a 10 % (DL 268/94 art. 4.°).',
      description: 'Descreva o movimento.',
      montant: 'Indique o montante.',
    },
    toasts: {
      immeubleAjoute: 'Edifício adicionado',
      immeubleDetail: (nom, taux) => `${nom} · FCR ${taux} %`,
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      immeubleAjouteDemo: 'Edifício adicionado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      entreeEnregistree: 'Entrada registada',
      sortieEnregistree: 'Saída registada',
      erreurEnregistrement: 'Erro ao registar',
      entreeEnregistreeDemo: 'Entrada registada (demo)',
      sortieEnregistreeDemo: 'Saída registada (demo)',
    },
  },
  'fr-FR': {
    tauxMinimal: 5,
    titre: 'Fonds de travaux',
    chapeau: 'Cotisation minimale : 5 % du budget prévisionnel et, si un PPT est adopté, 2,5 % du montant de ses travaux · Cotisations attachées aux lots, non remboursées à la vente · Art. 14-2-1 de la loi du 10 juillet 1965',
    nouvelImmeuble: 'Nouvel immeuble',
    enregistrerMouvement: '+ Enregistrer un mouvement',
    kpi: {
      solde: 'Solde total',
      entrees: 'Total des versements',
      sorties: 'Total des utilisations',
      immeubles: 'Immeubles',
      cotisation: 'Cotisation annuelle due',
      conformite: 'Conformité légale',
      ok: 'Oui',
      ko: 'Non',
    },
    onglets: { vg: (n) => `Vue d'ensemble (${n})`, mov: (n) => `Mouvements (${n})` },
    vide: {
      titre: 'Aucun immeuble configuré',
      desc: 'Enregistrez les immeubles de votre portefeuille pour gérer leur fonds de travaux',
      action: 'Ajouter un immeuble',
    },
    colonnes: { immeuble: 'Immeuble', adresse: 'Adresse', budget: 'Budget prévisionnel', taux: 'Taux de cotisation', soldeInitial: 'Solde initial', conformite: 'Conformité' },
    conforme: 'Conforme',
    insuffisant: 'Insuffisant',
    immeuble: {
      titre: 'Ajouter un immeuble au fonds de travaux',
      nom: "Nom de l'immeuble",
      nomPlaceholder: 'Résidence Les Pins',
      adresse: 'Adresse',
      adressePlaceholder: 'Rue…',
      budget: 'Budget prévisionnel annuel',
      taux: 'Taux de cotisation',
      tauxAide: 'Minimum légal : 5 % du budget',
      soldeInitial: 'Solde initial du fonds',
      annuler: 'Annuler',
      ajouter: "Ajouter l'immeuble",
    },
    mouvement: {
      titre: 'Enregistrer un mouvement du fonds de travaux',
      type: 'Type',
      entree: 'Versement',
      sortie: 'Utilisation',
      date: 'Date',
      immeuble: 'Immeuble',
      choisirImmeuble: '— choisir un immeuble —',
      montant: 'Montant',
      description: 'Description',
      descriptionPlaceholder: 'Origine du mouvement, justificatif…',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: {
      nom: "Le nom de l'immeuble est obligatoire.",
      taux: 'La cotisation ne peut être inférieure à 5 % du budget prévisionnel (art. 14-2-1 de la loi du 10 juillet 1965).',
      description: 'Décrivez le mouvement.',
      montant: 'Indiquez le montant.',
    },
    toasts: {
      immeubleAjoute: 'Immeuble ajouté',
      immeubleDetail: (nom, taux) => `${nom} · cotisation ${taux} %`,
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      immeubleAjouteDemo: 'Immeuble ajouté (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      entreeEnregistree: 'Versement enregistré',
      sortieEnregistree: 'Utilisation enregistrée',
      erreurEnregistrement: "Erreur lors de l'enregistrement",
      entreeEnregistreeDemo: 'Versement enregistré (démonstration)',
      sortieEnregistreeDemo: 'Utilisation enregistrée (démonstration)',
    },
  },
})
