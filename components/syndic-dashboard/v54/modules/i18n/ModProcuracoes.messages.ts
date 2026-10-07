import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Étape du traitement OCR : numéro, intitulé, détail. */
export type EtapeOcr = [string, string, string]

interface ProcuracoesTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrer: string
  genererFeuille: string
  cadre: { titre: string; texte: string }
  kpi: {
    archives: string
    confiance: string
    confianceVide: string
    controles: string
    erreurs: string
    aExpirer: string
    agCompletes: string
  }
  onglets: { pouvoirs: (n: number) => string; feuilles: string }
  vide: { titre: string; desc: string; action: string }
  representePar: string
  validite: string
  statuts: { expire: string; valide: string }
  traitement: { titre: string; sousTitre: string; etapes: EtapeOcr[] }
  modal: {
    titre: string
    mandant: string
    mandantPlaceholder: string
    mandataire: string
    mandatairePlaceholder: string
    lot: string
    lotPlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    ag: string
    agPlaceholder: string
    validite: string
    validitePlaceholder: string
    annuler: string
    enregistrer: string
  }
  erreurMandant: string
  toasts: {
    enregistre: string
    erreurEnregistrement: string
    reessayerPlusTard: string
    enregistreDemo: string
    connexionRequise: string
    feuilleTitre: string
    feuilleVide: string
    feuilleConnexion: string
  }
  pdf: { fichier: string; titre: string; sousTitre: string; colonnes: string[] }
}

export const PROCURACOES_MESSAGES = defineMessages<ProcuracoesTextes>({
  'pt-PT': {
    surtitre: 'OBRIGAÇÃO LEGAL · CC ART. 1433.° N.° 3',
    titre: 'Procurações & Lista de Presenças',
    chapeau: 'Arquivo de procurações escritas · Lista de presenças assinada · Léa OCR + validação NIF',
    enregistrer: 'Registar procuração',
    genererFeuille: 'Gerar lista presenças AG',
    cadre: {
      titre: 'Enquadramento legal',
      texte: 'Todo o condómino pode ser representado em assembleia por procuração escrita (CC art. 1433.°-3). A lista de presenças é obrigatória em qualquer AG (DL 268/94 art. 1.°-3) e deve ser conservada com a ata.',
    },
    kpi: {
      archives: 'Procurações arquivadas',
      confiance: 'OCR Léa confidence',
      confianceVide: '0%',
      controles: 'NIFs validados AT',
      erreurs: 'NIFs com erro',
      aExpirer: 'A expirar (próx. AG)',
      agCompletes: 'AGs com lista completa',
    },
    onglets: { pouvoirs: (n) => `Procurações (${n})`, feuilles: 'Listas de Presenças (0)' },
    vide: {
      titre: 'Nenhuma procuração arquivada',
      desc: 'Fazer upload das procurações em PDF. Léa extrai automaticamente: condómino representado, procurador, datas de validade, e valida NIFs contra AT.',
      action: '+ Registar primeira procuração',
    },
    representePar: 'Representado por ',
    validite: 'Validade: ',
    statuts: { expire: 'Expirada', valide: 'Válida' },
    traitement: {
      titre: 'Pipeline OCR Léa',
      sousTitre: 'Validação automática + alertas',
      etapes: [
        ['1', 'Upload PDF procuração', 'Léa extrai texto OCR · confidence score'],
        ['2', 'Identificação partes', 'Procurante (condómino) · procurador · fração'],
        ['3', 'Validação NIF', 'API AT.gov.pt — match contra lista condóminos'],
        ['4', 'Extração datas', 'Validade · AG específica ou geral'],
        ['5', 'Arquivo + sinalização', 'Disponível em AG Live · pré-cheka lista presenças'],
      ],
    },
    modal: {
      titre: 'Registar procuração',
      mandant: 'Condómino representado',
      mandantPlaceholder: 'Nome do condómino',
      mandataire: 'Procurador',
      mandatairePlaceholder: 'Quem representa',
      lot: 'Fração',
      lotPlaceholder: 'Ex.: 2C',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Opcional',
      ag: 'AG (referência)',
      agPlaceholder: 'Ex.: AG Ordinária 2026',
      validite: 'Validade',
      validitePlaceholder: 'AAAA-MM-DD',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurMandant: 'O condómino é obrigatório.',
    toasts: {
      enregistre: 'Procuração registada',
      erreurEnregistrement: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreDemo: 'Procuração registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      feuilleTitre: 'Lista de presenças AG',
      feuilleVide: 'Registe procurações para gerar a lista.',
      feuilleConnexion: 'Conecte-se como síndico para gerar a lista.',
    },
    pdf: {
      fichier: 'lista-presencas-ag.pdf',
      titre: 'Lista de Presenças — Assembleia Geral',
      sousTitre: 'CC art. 1433.º-3 · DL 268/94 art. 1.º-3',
      colonnes: ['Condómino', 'Fração', 'Representado por', 'Validade', 'Estado', 'Assinatura'],
    },
  },
  'fr-FR': {
    surtitre: 'CADRE LÉGAL · ART. 22 DE LA LOI DU 10 JUILLET 1965 · ART. 14 DU DÉCRET DU 17 MARS 1967',
    titre: 'Pouvoirs & feuille de présence',
    chapeau: 'Archivage des pouvoirs écrits · Feuille de présence émargée · OCR Léa + contrôle des délégations de vote',
    enregistrer: 'Enregistrer un pouvoir',
    genererFeuille: 'Générer la feuille de présence',
    cadre: {
      titre: 'Cadre légal',
      texte: "Tout copropriétaire peut déléguer son droit de vote à un mandataire de son choix, copropriétaire ou non (art. 22 de la loi du 10 juillet 1965). Un mandataire ne peut recevoir plus de trois délégations de vote, sauf si le total de ses voix et de celles de ses mandants n'excède pas 10 % des voix du syndicat ; le syndic, ses préposés et leurs proches (conjoint, partenaire de PACS, concubin, ascendants et descendants) ne peuvent recevoir aucun mandat. La feuille de présence, émargée par chaque copropriétaire présent ou son mandataire et certifiée exacte par le président de séance, est obligatoire (art. 14 du décret du 17 mars 1967) ; elle est annexée au procès-verbal.",
    },
    kpi: {
      archives: 'Pouvoirs archivés',
      confiance: 'Fiabilité OCR Léa',
      confianceVide: '0 %',
      controles: 'Mandataires contrôlés',
      erreurs: 'Délégations hors limite (art. 22)',
      aExpirer: 'À échéance (prochaine AG)',
      agCompletes: 'AG avec feuille de présence complète',
    },
    onglets: { pouvoirs: (n) => `Pouvoirs (${n})`, feuilles: 'Feuilles de présence (0)' },
    vide: {
      titre: 'Aucun pouvoir archivé',
      desc: "Déposez les pouvoirs au format PDF. Léa en extrait automatiquement le copropriétaire mandant, le mandataire et l'AG concernée, et signale tout mandataire qui dépasse la limite de délégations de vote (art. 22).",
      action: '+ Enregistrer un premier pouvoir',
    },
    representePar: 'Représenté par ',
    validite: 'Validité : ',
    statuts: { expire: 'Expiré', valide: 'Valide' },
    traitement: {
      titre: 'Traitement OCR par Léa',
      sousTitre: 'Contrôle automatique + alertes',
      etapes: [
        ['1', 'Dépôt du pouvoir en PDF', 'Léa extrait le texte par OCR · indice de confiance'],
        ['2', 'Identification des parties', 'Mandant (copropriétaire) · mandataire · lot'],
        ['3', 'Contrôle des délégations', 'Trois délégations au plus par mandataire, sauf total ≤ 10 % des voix · syndic, préposés et proches exclus (art. 22)'],
        ['4', 'Extraction des dates', 'AG concernée · date du pouvoir'],
        ['5', 'Archivage + signalement', 'Disponible dans « AG en direct » · préremplissage de la feuille de présence'],
      ],
    },
    modal: {
      titre: 'Enregistrer un pouvoir',
      mandant: 'Copropriétaire mandant',
      mandantPlaceholder: 'Nom du copropriétaire',
      mandataire: 'Mandataire',
      mandatairePlaceholder: 'Personne qui le représente',
      lot: 'Lot',
      lotPlaceholder: 'Ex. : Lot 12',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Facultatif',
      ag: 'AG concernée',
      agPlaceholder: 'Ex. : AG ordinaire 2026',
      validite: 'Validité',
      validitePlaceholder: 'AAAA-MM-JJ',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurMandant: 'Le copropriétaire mandant est obligatoire.',
    toasts: {
      enregistre: 'Pouvoir enregistré',
      erreurEnregistrement: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreDemo: 'Pouvoir enregistré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      feuilleTitre: "Feuille de présence de l'AG",
      feuilleVide: 'Enregistrez des pouvoirs pour générer la feuille de présence.',
      feuilleConnexion: 'Connectez-vous en tant que syndic pour générer la feuille de présence.',
    },
    pdf: {
      fichier: 'feuille-de-presence-ag.pdf',
      titre: 'Feuille de présence — Assemblée générale',
      sousTitre: 'Art. 14 du décret n° 67-223 du 17 mars 1967 · Art. 22 de la loi n° 65-557 du 10 juillet 1965',
      colonnes: ['Copropriétaire', 'Lot', 'Représenté par', 'Validité', 'Statut', 'Émargement'],
    },
  },
})
