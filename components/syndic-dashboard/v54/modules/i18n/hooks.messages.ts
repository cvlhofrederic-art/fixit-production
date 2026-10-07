import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes des hooks partagés des modules (use-coming-soon, use-syndic-create, use-document-upload, use-lea-documents). */
interface HooksTextes {
  enDeveloppement: string
  erreurEnregistrement: string
  reessayerPlusTard: string
  demo: (titre: string) => string
  connexionRequise: string
  upload: {
    erreurs: Record<'file_too_large' | 'unsupported_mime_type' | 'quota_exceeded' | 'missing_file' | 'unauthorized' | 'forbidden' | 'invalid_metadata', string>
    enCours: string
    echec: string
    echecGenerique: string
    charge: string
    traitementLea: (fichier: string) => string
    quotaTitre: string
    quotaDetail: string
    erreurReseau: string
    serveurInjoignable: string
  }
  documents: {
    ouvertureImpossible: string
    indisponible: string
    erreurReseau: string
    ouvertureReseau: string
    erreurSuppression: string
    reessayerPlusTardPoint: string
    supprime: string
    suppressionReseau: string
  }
}

export const HOOKS_MESSAGES = defineMessages<HooksTextes>({
  'pt-PT': {
    enDeveloppement: 'Funcionalidade em desenvolvimento',
    erreurEnregistrement: 'Erro ao gravar',
    reessayerPlusTard: 'Tente novamente mais tarde',
    demo: (titre) => `${titre} (demo)`,
    connexionRequise: 'Conecte-se como síndico para gravar a sério',
    upload: {
      erreurs: {
        file_too_large: 'Ficheiro demasiado grande (máximo 25 MB).',
        unsupported_mime_type: 'Formato não suportado. Use PDF, PNG, JPG ou WEBP.',
        quota_exceeded: 'Limite de armazenamento do gabinete atingido.',
        missing_file: 'Nenhum ficheiro selecionado.',
        unauthorized: 'Sessão expirada. Inicie sessão novamente.',
        forbidden: 'Sem permissões para carregar documentos.',
        invalid_metadata: 'Dados do documento inválidos.',
      },
      enCours: 'A carregar documento…',
      echec: 'Falha no carregamento',
      echecGenerique: 'Não foi possível carregar. Tente novamente.',
      charge: 'Documento carregado',
      traitementLea: (fichier) => `${fichier} — em processamento pela Léa.`,
      quotaTitre: 'Armazenamento quase cheio',
      quotaDetail: 'Mais de 80% do limite do gabinete utilizado.',
      erreurReseau: 'Erro de rede',
      serveurInjoignable: 'Não foi possível contactar o servidor.',
    },
    documents: {
      ouvertureImpossible: 'Não foi possível abrir',
      indisponible: 'Documento indisponível ou sessão expirada.',
      erreurReseau: 'Erro de rede',
      ouvertureReseau: 'Não foi possível abrir o documento.',
      erreurSuppression: 'Erro ao eliminar',
      reessayerPlusTardPoint: 'Tente novamente mais tarde.',
      supprime: 'Documento eliminado',
      suppressionReseau: 'Não foi possível eliminar o documento.',
    },
  },
  'fr-FR': {
    enDeveloppement: 'Fonctionnalité en cours de développement',
    erreurEnregistrement: "Erreur lors de l'enregistrement",
    reessayerPlusTard: 'Veuillez réessayer plus tard',
    demo: (titre) => `${titre} (démonstration)`,
    connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    upload: {
      erreurs: {
        file_too_large: 'Fichier trop volumineux (25 Mo maximum).',
        unsupported_mime_type: 'Format non pris en charge. Utilisez PDF, PNG, JPG ou WEBP.',
        quota_exceeded: 'Limite de stockage du cabinet atteinte.',
        missing_file: 'Aucun fichier sélectionné.',
        unauthorized: 'Session expirée. Veuillez vous reconnecter.',
        forbidden: "Vous n'avez pas les droits pour déposer des documents.",
        invalid_metadata: 'Données du document invalides.',
      },
      enCours: 'Dépôt du document…',
      echec: 'Échec du dépôt',
      echecGenerique: 'Le dépôt a échoué. Veuillez réessayer.',
      charge: 'Document déposé',
      traitementLea: (fichier) => `${fichier} — en cours de traitement par Léa.`,
      quotaTitre: 'Stockage presque plein',
      quotaDetail: 'Plus de 80 % de la limite du cabinet utilisés.',
      erreurReseau: 'Erreur réseau',
      serveurInjoignable: 'Impossible de contacter le serveur.',
    },
    documents: {
      ouvertureImpossible: "Impossible d'ouvrir le document",
      indisponible: 'Document indisponible ou session expirée.',
      erreurReseau: 'Erreur réseau',
      ouvertureReseau: "Impossible d'ouvrir le document.",
      erreurSuppression: 'Erreur lors de la suppression',
      reessayerPlusTardPoint: 'Veuillez réessayer plus tard.',
      supprime: 'Document supprimé',
      suppressionReseau: 'Impossible de supprimer le document.',
    },
  },
})

/** Libellés des types de documents Léa (codes de l'API). */
export const TYPES_DOCUMENT = defineMessages<Record<string, string>>({
  'pt-PT': {
    facture_artisan: 'Fatura',
    facture_syndic: 'Fatura',
    devis: 'Orçamento',
    contrat: 'Contrato',
    rib: 'RIB',
    ata_ag: 'Ata Assembleia',
    releve_bancaire: 'Extrato bancário',
    pv_assemblee: 'Ata Assembleia',
    autre: 'Documento',
  },
  'fr-FR': {
    facture_artisan: 'Facture',
    facture_syndic: 'Facture',
    devis: 'Devis',
    contrat: 'Contrat',
    rib: 'RIB',
    ata_ag: "Procès-verbal d'AG",
    releve_bancaire: 'Relevé bancaire',
    pv_assemblee: "Procès-verbal d'AG",
    autre: 'Document',
  },
})

/** Libellés des statuts de traitement Léa. */
export const STATUTS_DOCUMENT = defineMessages<Record<'pending' | 'processing' | 'processed' | 'error', string>>({
  'pt-PT': { pending: 'Em fila', processing: 'A processar', processed: 'Processado', error: 'Erro' },
  'fr-FR': { pending: "En file d'attente", processing: 'En cours de traitement', processed: 'Traité', error: 'Erreur' },
})
