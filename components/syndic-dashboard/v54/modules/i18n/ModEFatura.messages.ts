import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes de l'écran « Integração e-Fatura AT ». Module masqué en français (sans objet
 * pour une copropriété française, cf. MASQUES_FR) : traduction simple, sans adaptation.
 */
interface EFaturaTextes {
  titre: string
  chapeau: string
  kpi: { soumises: string; montant: string; acceptees: string; rejetees: string }
  onglets: { sub: string; hist: string; saft: string; cfg: string }
  panneau: string
  champs: {
    nifEmetteur: string
    nifDestinataire: string
    dateDocument: string
    dateAria: string
    typeDocument: string
    typeFacture: string
  }
  lignes: string
  colonnes: { description: string; quantite: string; prixUnitaire: string; taux: string; sousTotal: string }
  aria: { description: string; quantite: string; prixUnitaire: string; taux: string }
  descriptionPlaceholder: string
  tauxNormal: string
  ajouterLigne: string
  ajouterLigneToast: string
  totaux: { ht: string; tva: string; ttc: string }
  soumettre: string
  enDeveloppement: string
}

export const EFATURA_MESSAGES = defineMessages<EFaturaTextes>({
  'pt-PT': {
    titre: 'Integração e-Fatura AT',
    chapeau: 'Submissão de faturas e documentos à Autoridade Tributária e Aduaneira',
    kpi: { soumises: 'Total faturas submetidas', montant: 'Valor total', acceptees: 'Aceites AT', rejetees: 'Rejeitadas' },
    onglets: { sub: 'Submissão', hist: 'Histórico', saft: 'SAF-T PT', cfg: 'Configuração' },
    panneau: 'Nova Submissão e-Fatura',
    champs: {
      nifEmetteur: 'NIF Emitente *',
      nifDestinataire: 'NIF Destinatário *',
      dateDocument: 'Data do Documento *',
      dateAria: 'Data',
      typeDocument: 'Tipo de Documento *',
      typeFacture: 'Fatura',
    },
    lignes: 'Itens do Documento',
    colonnes: { description: 'Descrição *', quantite: 'QTD', prixUnitaire: 'Preço unit. (EUR)', taux: 'Taxa IVA', sousTotal: 'Subtotal' },
    aria: { description: 'Descrição', quantite: 'Quantidade', prixUnitaire: 'Preço unitário', taux: 'Taxa IVA' },
    descriptionPlaceholder: 'Descrição do serviço ou produto',
    tauxNormal: '23% (Normal)',
    ajouterLigne: '+ Adicionar linha',
    ajouterLigneToast: 'Adicionar linha',
    totaux: { ht: 'Total s/ IVA (HT)', tva: 'IVA', ttc: 'Total c/ IVA (TTC)' },
    soumettre: 'Submeter ao e-Fatura',
    enDeveloppement: 'Integração e-Fatura (AT) em desenvolvimento',
  },
  'fr-FR': {
    titre: 'Facturation électronique (e-Fatura AT)',
    chapeau: "Transmission des factures et documents à l'administration fiscale portugaise (AT)",
    kpi: { soumises: 'Total des factures transmises', montant: 'Montant total', acceptees: "Acceptées par l'AT", rejetees: 'Rejetées' },
    onglets: { sub: 'Transmission', hist: 'Historique', saft: 'SAF-T PT', cfg: 'Configuration' },
    panneau: 'Nouvelle transmission e-Fatura',
    champs: {
      nifEmetteur: 'NIF émetteur *',
      nifDestinataire: 'NIF destinataire *',
      dateDocument: 'Date du document *',
      dateAria: 'Date',
      typeDocument: 'Type de document *',
      typeFacture: 'Facture',
    },
    lignes: 'Lignes du document',
    colonnes: { description: 'Description *', quantite: 'Qté', prixUnitaire: 'Prix unit. (EUR)', taux: 'Taux de TVA', sousTotal: 'Sous-total' },
    aria: { description: 'Description', quantite: 'Quantité', prixUnitaire: 'Prix unitaire', taux: 'Taux de TVA' },
    descriptionPlaceholder: 'Description du service ou du produit',
    tauxNormal: '23 % (taux normal)',
    ajouterLigne: '+ Ajouter une ligne',
    ajouterLigneToast: 'Ajouter une ligne',
    totaux: { ht: 'Total HT', tva: 'TVA', ttc: 'Total TTC' },
    soumettre: "Transmettre à l'e-Fatura",
    enDeveloppement: 'Intégration e-Fatura (AT) en cours de développement',
  },
})
