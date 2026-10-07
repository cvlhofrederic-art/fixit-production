import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { IconName } from '@/lib/syndic/icon-names'

/** Type de lot (valeur technique envoyée à l'API ; le libellé dépend de la langue). */
export type TypeLot = 'habitacao' | 'comercio' | 'garagem' | 'arrecadacao'

interface ContabCondTextes {
  titre: string
  chapeau: string
  onglets: {
    painel: string
    frac: (n: number) => string
    cq: (n: number) => string
    diar: (n: number) => string
    orc: (n: number) => string
    enc: string
    rel: string
  }
  typesLot: Record<TypeLot, string>
  sens: { debito: string; credito: string }
  painel: {
    lotsGeres: string
    tantiemes: (n: number) => string
    appels: string
    appelsSous: (envoyes: number, regles: number) => string
    totalCredits: string
    encaissements: string
    soldeTresorerie: string
    debits: (montant: string) => string
    derniersAppels: string
    aucunAppel: string
    dernieresEcritures: string
    aucuneEcriture: string
    pointsAttention: string
    aucunLot: string
  }
  frac: {
    titre: string
    /** Ligne « Total : x / 10 000 … · n … » découpée autour des deux nombres. */
    totalDebut: string
    totalMilieu: string
    totalFin: (n: number) => string
    ajouter: string
    videTitre: string
    videDesc: string
    ajouterPremier: string
    colonnes: { identification: string; type: string; tantiemes: string; proprietaire: string }
  }
  cq: {
    titre: string
    nouvel: string
    videTitre: string
    videDesc: string
    creerPremier: string
    colonnes: { titre: string; immeuble: string; emission: string; echeance: string; montant: string; regles: string }
  }
  diar: {
    titre: string
    /** Libellé devant le solde (espace finale comprise). */
    solde: string
    exporter: string
    ecriture: string
    totalDebits: string
    totalCredits: string
    soldeKpi: string
    ecritures: string
    videTitre: string
    videDesc: string
    premiere: string
    colonnes: { date: string; compte: string; libelle: string; sens: string; montant: string }
  }
  orc: {
    titre: string
    nouveau: string
    videTitre: string
    videDesc: string
    creer: string
    colonnes: { exercice: string; immeuble: string; totalPrevu: string; statut: string }
    vote: string
    enAttente: string
  }
  enc: {
    titre: string
    panneau: string
    etapes: string[]
  }
  rel: {
    titre: string
    /** Rapports : icône, intitulé, description. */
    rapports: Array<[IconName, string, string]>
    apercu: string
    pdf: string
    toastApercu: string
    toastPdf: string
  }
  formulaire: {
    annuler: string
    notes: string
    immeuble: string
    immeublePlaceholder: string
    frac: {
      titre: string
      identification: string
      identificationPlaceholder: string
      type: string
      tantiemes: string
      tantiemesAide: string
      proprietaire: string
      proprietairePlaceholder: string
      valider: string
    }
    cq: {
      titre: string
      intitule: string
      intitulePlaceholder: string
      dateEmission: string
      dateEcheance: string
      montantTotal: string
      repartition: string
      parTantiemes: string
      partsEgales: string
      valider: string
    }
    diar: {
      titre: string
      date: string
      sens: string
      compte: string
      compteAide: string
      comptePlaceholder: string
      libelle: string
      libellePlaceholder: string
      montant: string
      valider: string
    }
    orc: {
      titre: string
      exercice: string
      totalPrevu: string
      postes: string
      postesAide: string
      postesPlaceholder: string
      valider: string
    }
  }
  erreurs: {
    identification: string
    tantiemes: string
    intitule: string
    dateEcheance: string
    montantTotal: string
    compte: string
    libelle: string
    montant: string
    exercice: string
    totalPrevu: string
  }
  toasts: {
    lotAjoute: string
    lotAjouteDesc: (identification: string, tantiemes: string) => string
    appelCree: string
    ecritureEnregistree: string
    budgetCree: string
    budgetCreeDesc: (annee: string, montant: string) => string
    erreurEnregistrement: string
    reessayerPlusTard: string
    demo: (titre: string) => string
    connexionRequise: string
    exportTitre: string
    aucuneEcritureExport: string
    connexionExport: string
    exportTermine: string
    exportTermineDesc: (n: number) => string
    erreur: string
    exportImpossible: string
  }
  csv: {
    fichier: string
    entetes: string[]
    /** Valeur de la colonne « sens » : PT garde le code brut de l'API. */
    sens: (tipo: string) => string
  }
}

export const CONTAB_COND_MESSAGES = defineMessages<ContabCondTextes>({
  'pt-PT': {
    titre: 'Contabilidade Condomínio',
    chapeau: 'Ferramentas profissionais de contabilidade para administradores de condomínios',
    onglets: {
      painel: 'Painel de controlo',
      frac: (n) => `Frações & Permilagem (${n})`,
      cq: (n) => `Chamadas de quotas (${n})`,
      diar: (n) => `Diário contabilístico (${n})`,
      orc: (n) => `Orçamento previsional (${n})`,
      enc: 'Encerramento exercício',
      rel: 'Relatórios AG',
    },
    typesLot: { habitacao: 'Habitação', comercio: 'Comércio', garagem: 'Garagem', arrecadacao: 'Arrecadação' },
    sens: { debito: 'Débito', credito: 'Crédito' },
    painel: {
      lotsGeres: 'Frações geridas',
      tantiemes: (n) => `${n} milésimos`,
      appels: 'Chamadas de quotas',
      appelsSous: (envoyes, regles) => `${envoyes} enviadas · ${regles} liquidadas`,
      totalCredits: 'Total créditos',
      encaissements: 'recebimentos',
      soldeTresorerie: 'Saldo tesouraria',
      debits: (montant) => `${montant} débitos`,
      derniersAppels: 'Últimas chamadas de quotas',
      aucunAppel: 'Nenhuma chamada de quotas',
      dernieresEcritures: 'Últimos lançamentos',
      aucuneEcriture: 'Nenhum lançamento contabilístico',
      pointsAttention: 'Pontos de atenção',
      aucunLot: '• Nenhuma fração registada — comece por adicionar as frações do condomínio',
    },
    frac: {
      titre: 'Frações & Permilagem',
      totalDebut: 'Total : ',
      totalMilieu: ' / 10 000 milésimos · ',
      totalFin: () => ' frações',
      ajouter: '+ Adicionar fração',
      videTitre: 'Nenhuma fração',
      videDesc: 'Comece por registar as frações do seu condomínio',
      ajouterPremier: '+ Adicionar a primeira fração',
      colonnes: { identification: 'Identificação', type: 'Tipo', tantiemes: 'Permilagem', proprietaire: 'Proprietário' },
    },
    cq: {
      titre: 'Chamadas de quotas',
      nouvel: '+ Nova chamada',
      videTitre: 'Nenhuma chamada de quotas',
      videDesc: 'Crie as suas chamadas de quotas trimestrais ou mensais',
      creerPremier: '+ Criar a primeira chamada',
      colonnes: { titre: 'Título', immeuble: 'Edifício', emission: 'Emissão', echeance: 'Vencimento', montant: 'Montante', regles: 'Liquidadas' },
    },
    diar: {
      titre: 'Diário contabilístico',
      solde: 'Saldo : ',
      exporter: 'Exportar CSV',
      ecriture: '+ Lançamento',
      totalDebits: 'Total débitos',
      totalCredits: 'Total créditos',
      soldeKpi: 'Saldo',
      ecritures: 'Lançamentos',
      videTitre: 'Diário vazio',
      videDesc: 'Comece a introduzir os seus lançamentos contabilísticos',
      premiere: '+ Primeiro lançamento',
      colonnes: { date: 'Data', compte: 'Conta', libelle: 'Descrição', sens: 'Tipo', montant: 'Montante' },
    },
    orc: {
      titre: 'Orçamento previsional',
      nouveau: '+ Novo orçamento',
      videTitre: 'Nenhum orçamento',
      videDesc: 'Crie o orçamento previsional do seu condomínio',
      creer: '+ Criar um orçamento',
      colonnes: { exercice: 'Ano', immeuble: 'Edifício', totalPrevu: 'Total previsto', statut: 'Estado' },
      vote: 'Aprovado em AG',
      enAttente: 'Aguarda AG',
    },
    enc: {
      titre: 'Encerramento de exercício',
      panneau: 'Checklist de encerramento anual',
      etapes: ['Verificação do balancete geral', 'Reconciliação bancária efetuada', 'Todas as chamadas de quotas liquidadas', 'Mapa de repartição por milésimos verificado', 'Validação do orçamento previsional N+1', 'Preparação do relatório para a AG anual', 'Exportação dos documentos contabilísticos', 'Arquivo dos documentos (10 anos)'],
    },
    rel: {
      titre: 'Relatórios para a Assembleia Geral',
      rapports: [
        ['coin', 'Relatório financeiro anual', 'Balanço contabilístico, encargos por rubrica, comparativo N/N-1'],
        ['home', 'Mapa de encargos por fração', 'Repartição por milésimos para cada condómino'],
        ['clipboard', 'Orçamento previsional N+1', 'Propostas de orçamento para o próximo exercício'],
        ['mail', 'Chamadas de quotas — resumo', 'Todas as chamadas enviadas e o seu estado de pagamento'],
        ['construction', 'Fundo de reserva (art. 4° DL 268/94)', 'Estado do fundo de reserva obrigatório'],
        ['doc', 'Contratos em vigor', 'Lista dos contratos de manutenção e prestadores'],
      ],
      apercu: 'Pré-visualizar',
      pdf: 'PDF',
      toastApercu: 'Pré-visualização',
      toastPdf: 'PDF gerado',
    },
    formulaire: {
      annuler: 'Cancelar',
      notes: 'Notas',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência…',
      frac: {
        titre: 'Adicionar fração',
        identification: 'Identificação',
        identificationPlaceholder: 'Apt 3.° E',
        type: 'Tipo',
        tantiemes: 'Permilagem',
        tantiemesAide: 'Total deve somar 10 000 milésimos',
        proprietaire: 'Proprietário',
        proprietairePlaceholder: 'Nome do proprietário',
        valider: 'Adicionar',
      },
      cq: {
        titre: 'Nova chamada de quotas',
        intitule: 'Título',
        intitulePlaceholder: 'Q1 2026 — Quotas trimestrais',
        dateEmission: 'Data de emissão',
        dateEcheance: 'Data de vencimento',
        montantTotal: 'Montante total',
        repartition: 'Distribuição',
        parTantiemes: 'Por milésimos',
        partsEgales: 'Igualitária',
        valider: 'Criar chamada',
      },
      diar: {
        titre: 'Novo lançamento contabilístico',
        date: 'Data',
        sens: 'Tipo',
        compte: 'Conta SNC',
        compteAide: 'Ex.: 62.21 (Fornecimentos serviços externos)',
        comptePlaceholder: '62.21',
        libelle: 'Descrição',
        libellePlaceholder: 'Manutenção elevador 03/2026',
        montant: 'Montante',
        valider: 'Registar',
      },
      orc: {
        titre: 'Novo orçamento previsional',
        exercice: 'Ano',
        totalPrevu: 'Total previsto',
        postes: 'Rúbricas',
        postesAide: 'Uma rubrica por linha',
        postesPlaceholder: 'Manutenção corrente: 8 000\nLimpeza áreas comuns: 4 800\nSeguro do edifício: 1 200\nFundo de reserva (10 %): X €',
        valider: 'Criar orçamento',
      },
    },
    erreurs: {
      identification: 'A identificação é obrigatória.',
      tantiemes: 'Indique a permilagem.',
      intitule: 'O título é obrigatório.',
      dateEcheance: 'A data de vencimento é obrigatória.',
      montantTotal: 'Indique o montante total.',
      compte: 'Indique a conta SNC.',
      libelle: 'Descreva o lançamento.',
      montant: 'Indique o montante.',
      exercice: 'Indique o ano (formato AAAA).',
      totalPrevu: 'Indique o total previsto.',
    },
    toasts: {
      lotAjoute: 'Fração adicionada',
      lotAjouteDesc: (identification, tantiemes) => `${identification} · ${tantiemes} milésimos`,
      appelCree: 'Chamada de quotas criada',
      ecritureEnregistree: 'Lançamento registado',
      budgetCree: 'Orçamento criado',
      budgetCreeDesc: (annee, montant) => `Ano ${annee} · ${montant}`,
      erreurEnregistrement: 'Erro ao gravar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      demo: (titre) => `${titre} (demo)`,
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      exportTitre: 'Exportar CSV',
      aucuneEcritureExport: 'Nenhum lançamento para exportar.',
      connexionExport: 'Conecte-se como síndico para exportar',
      exportTermine: 'Exportação concluída',
      exportTermineDesc: (n) => `${n} lançamentos`,
      erreur: 'Erro',
      exportImpossible: 'Não foi possível exportar.',
    },
    csv: {
      fichier: 'diario-contabilistico.csv',
      entetes: ['Data', 'Tipo', 'Conta', 'Descrição', 'Montante'],
      sens: (tipo) => tipo,
    },
  },
  'fr-FR': {
    titre: 'Comptabilité de la copropriété',
    chapeau: 'Outils comptables professionnels pour les syndics de copropriété',
    onglets: {
      painel: 'Tableau de bord',
      frac: (n) => `Lots & tantièmes (${n})`,
      cq: (n) => `Appels de fonds (${n})`,
      diar: (n) => `Journal comptable (${n})`,
      orc: (n) => `Budget prévisionnel (${n})`,
      enc: "Clôture de l'exercice",
      rel: "Documents pour l'AG",
    },
    typesLot: { habitacao: 'Habitation', comercio: 'Commerce', garagem: 'Parking', arrecadacao: 'Cave' },
    sens: { debito: 'Débit', credito: 'Crédit' },
    painel: {
      lotsGeres: 'Lots gérés',
      tantiemes: (n) => `${n} tantième${n > 1 ? 's' : ''}`,
      appels: 'Appels de fonds',
      appelsSous: (envoyes, regles) => `${envoyes} émis · ${regles} réglé${regles > 1 ? 's' : ''}`,
      totalCredits: 'Total des crédits',
      encaissements: 'encaissements',
      soldeTresorerie: 'Solde de trésorerie',
      debits: (montant) => `${montant} de débits`,
      derniersAppels: 'Derniers appels de fonds',
      aucunAppel: 'Aucun appel de fonds',
      dernieresEcritures: 'Dernières écritures',
      aucuneEcriture: 'Aucune écriture comptable',
      pointsAttention: "Points d'attention",
      aucunLot: '• Aucun lot enregistré — commencez par ajouter les lots de la copropriété',
    },
    frac: {
      titre: 'Lots & tantièmes',
      totalDebut: 'Total des tantièmes : ',
      totalMilieu: ' / 10 000 · ',
      totalFin: (n) => ` lot${n > 1 ? 's' : ''}`,
      ajouter: '+ Ajouter un lot',
      videTitre: 'Aucun lot',
      videDesc: 'Commencez par enregistrer les lots de votre copropriété et leurs tantièmes',
      ajouterPremier: '+ Ajouter le premier lot',
      colonnes: { identification: 'Désignation', type: 'Type', tantiemes: 'Tantièmes', proprietaire: 'Copropriétaire' },
    },
    cq: {
      titre: 'Appels de fonds',
      nouvel: '+ Nouvel appel',
      videTitre: 'Aucun appel de fonds',
      videDesc: 'Créez vos appels de provisions, trimestriels ou selon la périodicité votée en AG',
      creerPremier: '+ Créer le premier appel',
      colonnes: { titre: 'Intitulé', immeuble: 'Immeuble', emission: 'Émission', echeance: 'Échéance', montant: 'Montant', regles: 'Réglés' },
    },
    diar: {
      titre: 'Journal comptable',
      solde: 'Solde : ',
      exporter: 'Exporter en CSV',
      ecriture: '+ Écriture',
      totalDebits: 'Total des débits',
      totalCredits: 'Total des crédits',
      soldeKpi: 'Solde',
      ecritures: 'Écritures',
      videTitre: 'Journal vide',
      videDesc: "Commencez à saisir vos écritures comptables (comptabilité d'engagement)",
      premiere: '+ Première écriture',
      colonnes: { date: 'Date', compte: 'Compte', libelle: 'Libellé', sens: 'Sens', montant: 'Montant' },
    },
    orc: {
      titre: 'Budget prévisionnel',
      nouveau: '+ Nouveau budget',
      videTitre: 'Aucun budget',
      videDesc: 'Établissez le budget prévisionnel de votre copropriété, voté chaque année en AG (art. 14-1 de la loi du 10 juillet 1965)',
      creer: '+ Créer un budget',
      colonnes: { exercice: 'Exercice', immeuble: 'Immeuble', totalPrevu: 'Total prévu', statut: 'Statut' },
      vote: 'Voté en AG',
      enAttente: 'En attente du vote en AG',
    },
    enc: {
      titre: "Clôture de l'exercice",
      panneau: 'Liste de contrôle de la clôture annuelle',
      etapes: [
        'Vérification de la balance générale des comptes',
        'Rapprochement bancaire du compte séparé du syndicat (art. 18 de la loi du 10 juillet 1965)',
        'Point sur les appels de fonds : encaissements et impayés',
        'Répartition des charges générales et spéciales vérifiée selon les clés du règlement de copropriété (art. 10 de la loi de 1965)',
        'Préparation du budget prévisionnel N+1 (art. 14-1 de la loi de 1965)',
        'Établissement des annexes comptables 1 à 5 (art. 8 du décret n° 2005-240 du 14 mars 2005)',
        'Contrôle des comptes par le conseil syndical (art. 26 du décret du 17 mars 1967)',
        'Archivage des pièces justificatives pendant dix ans (art. 6 du décret n° 2005-240)',
      ],
    },
    rel: {
      titre: "Documents pour l'assemblée générale",
      rapports: [
        ['coin', 'Annexe 1 — État financier', "Situation financière et trésorerie à la clôture de l'exercice, dettes et créances"],
        ['home', 'Annexe 2 — Compte de gestion général', "Charges et produits de l'exercice, comparatif avec l'exercice N-1"],
        ['clipboard', 'Annexe 3 — Gestion courante et budget prévisionnel', "Opérations courantes de l'exercice clos et budget prévisionnel N+1"],
        ['mail', 'Annexe 4 — Travaux et opérations exceptionnelles', 'Compte de gestion des travaux et opérations exceptionnelles hors budget prévisionnel'],
        ['construction', 'Annexe 5 — Travaux votés non clôturés', "Travaux et opérations exceptionnelles votés et non encore clôturés à la fin de l'exercice"],
        ['doc', 'Fonds de travaux (art. 14-2-1)', 'Situation du fonds de travaux obligatoire (cotisation annuelle ≥ 5 % du budget prévisionnel et, si un PPT est adopté, ≥ 2,5 % du montant de ses travaux)'],
      ],
      apercu: 'Aperçu',
      pdf: 'PDF',
      toastApercu: 'Aperçu',
      toastPdf: 'PDF généré',
    },
    formulaire: {
      annuler: 'Annuler',
      notes: 'Notes',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence…',
      frac: {
        titre: 'Ajouter un lot',
        identification: 'Désignation du lot',
        identificationPlaceholder: 'Lot 12 — Apt B3',
        type: 'Type',
        tantiemes: 'Tantièmes',
        tantiemesAide: 'Le total des lots doit atteindre 10 000 tantièmes',
        proprietaire: 'Copropriétaire',
        proprietairePlaceholder: 'Nom du copropriétaire',
        valider: 'Ajouter',
      },
      cq: {
        titre: 'Nouvel appel de fonds',
        intitule: 'Intitulé',
        intitulePlaceholder: 'T1 2026 — Appel de provisions trimestriel',
        dateEmission: "Date d'émission",
        dateEcheance: "Date d'échéance",
        montantTotal: 'Montant total',
        repartition: 'Répartition',
        parTantiemes: 'Au prorata des tantièmes',
        partsEgales: 'Parts égales',
        valider: "Créer l'appel",
      },
      diar: {
        titre: 'Nouvelle écriture comptable',
        date: 'Date',
        sens: 'Sens',
        compte: 'Compte',
        compteAide: 'Plan comptable des copropriétés — ex. : 614 (Contrats de maintenance)',
        comptePlaceholder: '614',
        libelle: 'Libellé',
        libellePlaceholder: 'Maintenance ascenseur 03/2026',
        montant: 'Montant',
        valider: 'Enregistrer',
      },
      orc: {
        titre: 'Nouveau budget prévisionnel',
        exercice: 'Exercice',
        totalPrevu: 'Total prévu',
        postes: 'Postes budgétaires',
        postesAide: 'Un poste par ligne',
        postesPlaceholder: "Entretien et petites réparations : 8 000\nNettoyage des parties communes : 4 800\nAssurance de l'immeuble : 1 200\nHonoraires du syndic : X €",
        valider: 'Créer le budget',
      },
    },
    erreurs: {
      identification: 'La désignation du lot est obligatoire.',
      tantiemes: 'Indiquez les tantièmes du lot.',
      intitule: "L'intitulé est obligatoire.",
      dateEcheance: "La date d'échéance est obligatoire.",
      montantTotal: 'Indiquez le montant total.',
      compte: 'Indiquez le compte comptable.',
      libelle: "Saisissez le libellé de l'écriture.",
      montant: 'Indiquez le montant.',
      exercice: "Indiquez l'année de l'exercice (format AAAA).",
      totalPrevu: 'Indiquez le total prévu.',
    },
    toasts: {
      lotAjoute: 'Lot ajouté',
      lotAjouteDesc: (identification, tantiemes) => `${identification} · ${tantiemes} tantième${Number(tantiemes) > 1 ? 's' : ''}`,
      appelCree: 'Appel de fonds créé',
      ecritureEnregistree: 'Écriture enregistrée',
      budgetCree: 'Budget créé',
      budgetCreeDesc: (annee, montant) => `Exercice ${annee} · ${montant}`,
      erreurEnregistrement: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      demo: (titre) => `${titre} (démonstration)`,
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      exportTitre: 'Export CSV',
      aucuneEcritureExport: 'Aucune écriture à exporter.',
      connexionExport: 'Connectez-vous en tant que syndic pour exporter',
      exportTermine: 'Export terminé',
      exportTermineDesc: (n) => `${n} écriture${n > 1 ? 's' : ''}`,
      erreur: 'Erreur',
      exportImpossible: "L'export a échoué.",
    },
    csv: {
      fichier: 'journal-comptable.csv',
      entetes: ['Date', 'Sens', 'Compte', 'Libellé', 'Montant'],
      sens: (tipo) => (tipo === 'credito' ? 'Crédit' : tipo === 'debito' ? 'Débit' : tipo),
    },
  },
})
