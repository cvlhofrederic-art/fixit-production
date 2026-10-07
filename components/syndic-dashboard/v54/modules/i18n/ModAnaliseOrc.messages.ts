import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Carte de fonctionnalité : titre et description (l'icône reste dans le module). */
export interface FonctionnaliteAnalyse {
  titre: string
  description: string
}

interface AnaliseOrcTextes {
  titre: string
  surtitre: string
  /** Trois cartes, dans l'ordre des icônes du module (balance, pièce, bouclier). */
  fonctionnalites: FonctionnaliteAnalyse[]
  onglets: { pdf: string; texte: string; assurance: string }
  depot: { titre: string; sousTitre: string; bouton: string; formats: string }
  textePlaceholder: string
  assuranceInfo: string
  analyser: string
  analyseEnCours: string
  resultat: string
  leaAnalyse: string
  /** Message envoyé à Léa (agent lea-comptable), suivi du texte collé. */
  prompt: (texte: string) => string
  toasts: {
    pdfTitre: string
    pdfDesc: string
    termineeTitre: string
    termineeDesc: string
    erreurTitre: string
    erreurDesc: string
    demoTitre: string
    demoDesc: string
  }
}

export const ANALISE_ORC_MESSAGES = defineMessages<AnaliseOrcTextes>({
  'pt-PT': {
    titre: 'Análise Orçamentos & Faturas',
    surtitre: 'Conformidade jurídica · Referência de preços · Prevenção de litígios',
    fonctionnalites: [
      { titre: 'Conformidade jurídica', description: 'NIF, IVA, Seguro RC, garantia decenal' },
      { titre: 'Referência de preços de mercado', description: 'Tarifas 2024-2025 por ofício' },
      { titre: 'Prevenção de litígios', description: 'Deteção de riscos jurídicos' },
    ],
    onglets: { pdf: 'Enviar um PDF', texte: 'Inserir o texto', assurance: 'Seguro' },
    depot: {
      titre: 'Arraste o seu PDF aqui',
      sousTitre: 'ou clique para selecionar um ficheiro',
      bouton: 'Escolher um PDF',
      formats: 'Orçamento, fatura, nota de encomenda — máx 20 MB',
    },
    textePlaceholder: 'Cole aqui o texto do orçamento ou fatura a analisar…',
    assuranceInfo: 'Verificação do seguro de responsabilidade civil do prestador e da garantia decenal. Cole a apólice ou os respetivos dados no separador « Inserir o texto » para análise pela Léa.',
    analyser: 'Analisar o documento',
    analyseEnCours: 'A analisar…',
    resultat: 'Resultado da análise',
    leaAnalyse: 'A Léa está a analisar o documento…',
    prompt: (texte) => `Analisa este orçamento/fatura de prestador para um condomínio em Portugal. Verifica: (1) conformidade jurídica (NIF, IVA, seguro RC, garantia decenal), (2) referência de preços de mercado 2024-2025 por ofício, (3) riscos de litígio. Apresenta conclusões claras e acionáveis.\n\n---\n${texte}`,
    toasts: {
      pdfTitre: 'Análise de PDF',
      pdfDesc: 'Use o separador « Inserir o texto » para análise imediata pela Léa',
      termineeTitre: 'Análise concluída',
      termineeDesc: 'Resultado pronto para revisão',
      erreurTitre: 'Erro na análise',
      erreurDesc: 'A Léa está indisponível, tente novamente',
      demoTitre: 'Análise IA (demo)',
      demoDesc: 'Conecte-se como síndico para analisar com a Léa',
    },
  },
  'fr-FR': {
    titre: 'Analyse devis & factures',
    surtitre: 'Conformité juridique · Prix de référence · Prévention des litiges',
    fonctionnalites: [
      { titre: 'Conformité juridique', description: 'SIRET, TVA, RC Pro, assurance décennale' },
      { titre: 'Prix de référence du marché', description: 'Tarifs 2024-2025 par corps de métier' },
      { titre: 'Prévention des litiges', description: 'Détection des risques juridiques' },
    ],
    onglets: { pdf: 'Envoyer un PDF', texte: 'Saisir le texte', assurance: 'Assurance' },
    depot: {
      titre: 'Glissez-déposez votre PDF ici',
      sousTitre: 'ou cliquez pour sélectionner un fichier',
      bouton: 'Choisir un PDF',
      formats: 'Devis, facture, bon de commande — 20 Mo max.',
    },
    textePlaceholder: 'Collez ici le texte du devis ou de la facture à analyser…',
    assuranceInfo: "Vérification de l'assurance de responsabilité civile professionnelle du prestataire et de son assurance décennale. Collez l'attestation d'assurance ou ses références dans l'onglet « Saisir le texte » pour une analyse par Léa.",
    analyser: 'Analyser le document',
    analyseEnCours: 'Analyse en cours…',
    resultat: "Résultat de l'analyse",
    leaAnalyse: 'Léa analyse le document…',
    prompt: (texte) => `Analyse le document ci-dessous, devis ou facture d'un prestataire adressé au syndicat des copropriétaires d'un immeuble situé en France, au regard du droit français. Vérifie : (1) la conformité juridique : mentions attendues d'un devis (identification de l'entreprise, date et durée de validité, désignation et décompte détaillé des prestations, prix unitaires, montants HT et TTC) et de la facture (Code de commerce, art. L441-9 ; CGI, annexe II, art. 242 nonies A), numéro SIREN ou SIRET, numéro de TVA intracommunautaire, taux de TVA appliqué (taux normal de 20 %, ou taux réduit de 10 % ou de 5,5 % pour certains travaux dans des locaux d'habitation achevés depuis plus de deux ans, sous conditions), mention de l'assurance professionnelle, attestation de responsabilité civile professionnelle et assurance décennale lorsque les travaux relèvent des articles 1792 et suivants du Code civil (Code des assurances, art. L241-1) ; (2) la conformité au contrat : prestations, quantités et prix conformes au devis accepté, à l'ordre de service ou au contrat d'entretien, et mise en concurrence lorsque le montant dépasse le seuil fixé par l'assemblée générale (loi n° 65-557 du 10 juillet 1965, art. 21) ; (3) la cohérence des prix avec les prix du marché 2024-2025 par corps de métier ; (4) les risques de litige (garanties de parfait achèvement, biennale et décennale, réserves, pénalités). Présente des conclusions claires et directement exploitables. Réponds en français.\n\n---\n${texte}`,
    toasts: {
      pdfTitre: 'Analyse de PDF',
      pdfDesc: "Utilisez l'onglet « Saisir le texte » pour une analyse immédiate par Léa",
      termineeTitre: 'Analyse terminée',
      termineeDesc: 'Résultat prêt à être relu',
      erreurTitre: "Erreur lors de l'analyse",
      erreurDesc: 'Léa est indisponible, veuillez réessayer',
      demoTitre: 'Analyse IA (démonstration)',
      demoDesc: "Connectez-vous en tant que syndic pour lancer l'analyse avec Léa",
    },
  },
})
