import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Catégorie de contrat telle qu'envoyée à l'API et stockée (code ; le libellé dépend de la langue). */
export type CategorieContrat = 'limpezas' | 'elevadores' | 'seguranca' | 'jardinagem' | 'outros'

/** Onglet de filtre (code interne). */
export type OngletContrat = 'todos' | 'limp' | 'elev' | 'seg' | 'jard' | 'outros'

/** Couleur d'une étape du cycle de vie. */
export type CouleurEtape = 'sage' | 'gold' | 'amber' | 'rust'

interface ContratosTextes {
  surtitre: string
  titre: string
  chapeau: string
  importerPdf: string
  nouveauContrat: string
  alerte: { titre: string; avant: string; fort: string; apres: string }
  kpi: { actifs: string; aRenouveler: string; coutMensuel: string; coutAnnuel: string; concurrence: string; expires: string }
  onglets: Record<OngletContrat, string>
  categories: Record<CategorieContrat, string>
  statuts: { expirado: string; renovacao: string; ativo: string }
  vide: { titre: string; texte: string; action: string }
  parMois: string
  fin: string
  cycle: { titre: string; sousTitre: string; etapes: [string, string, CouleurEtape][] }
  formulaire: {
    titre: string
    prestataire: string
    prestatairePlaceholder: string
    categorie: string
    immeuble: string
    facultatif: string
    coutMensuel: string
    coutAnnuel: string
    echeance: string
    echeancePlaceholder: string
    annuler: string
    ajouter: string
  }
  erreurs: { prestataire: string }
  toasts: {
    ajoute: string
    erreurAjout: string
    reessayerPlusTard: string
    ajouteDemo: string
    connexionRequise: string
  }
}

export const CONTRATOS_MESSAGES = defineMessages<ContratosTextes>({
  'pt-PT': {
    surtitre: 'GESTÃO OPERACIONAL · CENTRALIZADO',
    titre: 'Contratos com Prestadores',
    chapeau: 'Limpezas · Elevadores · Segurança · Jardim · Dedetização · Alertas renovação J-90/60/30 · 3 Orçamentos auto',
    importerPdf: 'Upload contrato PDF (Léa)',
    nouveauContrat: '+ Novo contrato',
    alerte: {
      titre: 'Tempo + Léa = renovações nunca esquecidas',
      avant: 'Léa extrai datas/valores/partes dos PDFs em segundos. Tempo agenda alertas J-90 · J-60 · J-30 antes do término. A J-60 auto-dispara workflow ',
      fort: '3 Orçamentos',
      apres: ' para re-concorrência.',
    },
    kpi: {
      actifs: 'Contratos ativos',
      aRenouveler: 'A renovar (≤ 90 dias)',
      coutMensuel: 'Custo mensal total',
      coutAnnuel: 'Custo anual total',
      concurrence: '3 Orçamentos em curso',
      expires: 'Expirados (atenção)',
    },
    onglets: { todos: 'Todos', limp: 'Limpezas', elev: 'Elevadores', seg: 'Segurança', jard: 'Jardinagem', outros: 'Outros' },
    categories: { limpezas: 'Limpezas', elevadores: 'Elevadores', seguranca: 'Segurança', jardinagem: 'Jardinagem', outros: 'Outros' },
    statuts: { expirado: 'Expirado', renovacao: 'Renovação', ativo: 'Ativo' },
    vide: {
      titre: 'Nenhum contrato centralizado',
      texte: 'Léa lê PDFs de contratos (limpezas, elevadores, segurança, jardim) em segundos e pré-preenche 90% da ficha. Renovações nunca esquecidas.',
      action: 'Adicionar primeiro contrato',
    },
    parMois: '/mês',
    fin: 'Fim: ',
    cycle: {
      titre: 'Lifecycle de um contrato',
      sousTitre: 'Léa + Tempo + 3 Orçamentos = ciclo fechado',
      etapes: [
        ['Upload PDF', 'Léa OCR · 30 segundos · ficha 90% pronta', 'sage'],
        ['Tracking ativo', 'Custo mensal · indexações · próxima revisão', 'gold'],
        ['Alerta J-90', 'Tempo notifica · revisão satisfação prestador', 'amber'],
        ['Workflow J-60', 'Auto-dispara 3 Orçamentos · concorrência', 'gold'],
        ['Decisão J-30', 'Renovar · trocar · negociar', 'amber'],
        ['Renovação/Substituição', 'Update auto · histórico preservado', 'sage'],
      ],
    },
    formulaire: {
      titre: 'Novo contrato',
      prestataire: 'Fornecedor',
      prestatairePlaceholder: 'Ex.: Limpezas Norte, Lda.',
      categorie: 'Categoria',
      immeuble: 'Edifício',
      facultatif: 'Opcional',
      coutMensuel: 'Custo mensal (€)',
      coutAnnuel: 'Custo anual (€)',
      echeance: 'Data de fim (renovação)',
      echeancePlaceholder: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    erreurs: { prestataire: 'O fornecedor é obrigatório.' },
    toasts: {
      ajoute: 'Contrato adicionado',
      erreurAjout: 'Erro ao adicionar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      ajouteDemo: 'Contrato adicionado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    surtitre: 'GESTION OPÉRATIONNELLE · CONTRATS CENTRALISÉS',
    titre: 'Contrats prestataires',
    chapeau: 'Nettoyage · Ascenseurs · Sécurité · Espaces verts · Dératisation et désinsectisation · Alertes de renouvellement J-90/60/30 · Mise en concurrence automatique',
    importerPdf: 'Importer un contrat PDF (Léa)',
    nouveauContrat: '+ Nouveau contrat',
    alerte: {
      titre: 'Tempo + Léa : aucun renouvellement oublié',
      avant: "Léa extrait en quelques secondes les dates, montants et parties des contrats PDF. Tempo programme des alertes J-90 · J-60 · J-30 avant l'échéance, pour ne pas laisser passer le délai de dénonciation d'une reconduction tacite. À J-60, la ",
      fort: 'mise en concurrence (3 devis)',
      apres: " se lance automatiquement : elle est obligatoire à partir du montant fixé par l'assemblée générale (art. 21 de la loi du 10 juillet 1965).",
    },
    kpi: {
      actifs: 'Contrats en vigueur',
      aRenouveler: 'À renouveler (≤ 90 jours)',
      coutMensuel: 'Coût mensuel total',
      coutAnnuel: 'Coût annuel total',
      concurrence: 'Mises en concurrence en cours',
      expires: 'Expirés (à traiter)',
    },
    onglets: { todos: 'Tous', limp: 'Nettoyage', elev: 'Ascenseurs', seg: 'Sécurité', jard: 'Espaces verts', outros: 'Autres' },
    categories: { limpezas: 'Nettoyage', elevadores: 'Ascenseurs', seguranca: 'Sécurité', jardinagem: 'Espaces verts', outros: 'Autres' },
    statuts: { expirado: 'Expiré', renovacao: 'À renouveler', ativo: 'En vigueur' },
    vide: {
      titre: 'Aucun contrat centralisé',
      texte: 'Léa lit vos contrats PDF (nettoyage, ascenseurs, sécurité, espaces verts) en quelques secondes et préremplit 90 % de la fiche. Aucun renouvellement oublié.',
      action: 'Ajouter un premier contrat',
    },
    parMois: '/mois',
    fin: 'Échéance : ',
    cycle: {
      titre: "Cycle de vie d'un contrat",
      sousTitre: 'Léa + Tempo + mise en concurrence = cycle complet',
      etapes: [
        ['Import du PDF', 'OCR Léa · 30 secondes · fiche remplie à 90 %', 'sage'],
        ['Suivi en continu', 'Coût mensuel · indexation · prochaine révision du prix', 'gold'],
        ['Alerte J-90', 'Notification Tempo · bilan de satisfaction · préavis de non-reconduction', 'amber'],
        ['Mise en concurrence J-60', 'Demande automatique de 3 devis · seuil voté en AG (art. 21 de la loi de 1965)', 'gold'],
        ['Décision J-30', 'Renouveler · changer de prestataire · renégocier · avis du conseil syndical', 'amber'],
        ['Renouvellement / remplacement', 'Mise à jour automatique · historique conservé', 'sage'],
      ],
    },
    formulaire: {
      titre: 'Nouveau contrat',
      prestataire: 'Prestataire',
      prestatairePlaceholder: 'Ex. : Nettoyage Rhône SARL',
      categorie: 'Catégorie',
      immeuble: 'Immeuble',
      facultatif: 'Facultatif',
      coutMensuel: 'Coût mensuel (€)',
      coutAnnuel: 'Coût annuel (€)',
      echeance: "Date d'échéance (renouvellement)",
      echeancePlaceholder: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    erreurs: { prestataire: 'Le nom du prestataire est obligatoire.' },
    toasts: {
      ajoute: 'Contrat ajouté',
      erreurAjout: "Erreur lors de l'ajout",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      ajouteDemo: 'Contrat ajouté (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
