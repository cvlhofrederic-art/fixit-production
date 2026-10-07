import { defineMessages } from '@/lib/syndic/v54/i18n'

interface FaturacaoTextes {
  titre: string
  chapeau: string
  emettre: string
  kpi: { totalFacture: string; nbFactures: (n: number) => string; emises: string; aRegler: string; reglees: string }
  onglets: { factures: string; transferts: string; specifique: string }
  panneau: string
  vide: { titre: string; description: string }
  colonnes: { numero: string; coproprietaire: string; emise: string; echeance: string; montantTtc: string; statut: string }
  /** Libellés des statuts (codes de l'API ; repli sur le code brut si inconnu). */
  statuts: Record<string, string>
  /** Taux de TVA proposé par défaut dans le formulaire (modifiable). */
  tauxTvaParDefaut: string
  formulaire: {
    titre: string
    numero: string
    numeroPlaceholder: string
    coproprietaire: string
    choisir: string
    dateEmission: string
    echeance: string
    montantHt: string
    tva: string
    ttc: (montant: string) => string
    description: string
    annuler: string
    emettre: string
  }
  erreurs: { montantHt: string }
  toasts: {
    emise: string
    erreurEmission: string
    reessayerPlusTard: string
    emiseDemo: string
    connexionRequise: string
  }
}

export const FATURACAO_MESSAGES = defineMessages<FaturacaoTextes>({
  'pt-PT': {
    titre: 'Faturação & Recibos Verdes',
    chapeau: 'Faturas, orçamentos e dossiês transferidos · Recibos verdes com retenção IRS automática',
    emettre: '+ Emitir fatura',
    kpi: { totalFacture: 'Faturado total', nbFactures: (n) => `${n} faturas`, emises: 'Faturas emitidas', aRegler: 'A regularizar', reglees: 'Liquidadas' },
    onglets: { factures: 'Faturas & Orçamentos', transferts: 'Dossiês transferidos', specifique: 'Recibos Verdes & IRS' },
    panneau: 'Faturas do condomínio',
    vide: { titre: 'Nenhuma fatura emitida', description: 'Emita a primeira fatura de condomínio — o montante TTC é calculado automaticamente' },
    colonnes: { numero: 'Nº', coproprietaire: 'Condómino', emise: 'Emitida', echeance: 'Vencimento', montantTtc: 'Montante TTC', statut: 'Estado' },
    statuts: { a_regler: 'A regularizar', partiellement_regle: 'Parcial', reglee: 'Liquidada', contestee: 'Contestada', annulee: 'Anulada' },
    tauxTvaParDefaut: '23',
    formulaire: {
      titre: 'Emitir fatura de condomínio',
      numero: 'Nº fatura',
      numeroPlaceholder: 'FT-2026-…',
      coproprietaire: 'Condómino',
      choisir: '— escolher —',
      dateEmission: 'Data de emissão',
      echeance: 'Vencimento',
      montantHt: 'Montante HT',
      tva: 'IVA',
      ttc: (montant) => `TTC: ${montant}`,
      description: 'Descrição',
      annuler: 'Cancelar',
      emettre: 'Emitir fatura',
    },
    erreurs: { montantHt: 'Indique o montante HT.' },
    toasts: {
      emise: 'Fatura emitida',
      erreurEmission: 'Erro ao emitir',
      reessayerPlusTard: 'Tente novamente mais tarde',
      emiseDemo: 'Fatura emitida (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    // Pas de recibos verdes ni de retenue d'IRS en France : le module couvre les honoraires
    // du syndic (contrat type, décret n° 2015-342 du 26 mars 2015) et les frais imputables
    // à un copropriétaire (art. 10-1 de la loi n° 65-557 du 10 juillet 1965).
    titre: 'Facturation & honoraires',
    chapeau: 'Factures, devis et dossiers transférés · Honoraires du syndic selon le contrat type (décret n° 2015-342)',
    emettre: '+ Émettre une facture',
    kpi: { totalFacture: 'Total facturé', nbFactures: (n) => `${n} ${n > 1 ? 'factures' : 'facture'}`, emises: 'Factures émises', aRegler: 'À régler', reglees: 'Réglées' },
    onglets: { factures: 'Factures & devis', transferts: 'Dossiers transférés', specifique: 'Honoraires du syndic' },
    panneau: 'Factures aux copropriétaires',
    vide: { titre: 'Aucune facture émise', description: 'Émettez la première facture (prestation particulière, frais imputables) — le montant TTC est calculé automatiquement' },
    colonnes: { numero: 'N°', coproprietaire: 'Copropriétaire', emise: 'Émise le', echeance: 'Échéance', montantTtc: 'Montant TTC', statut: 'Statut' },
    statuts: { a_regler: 'À régler', partiellement_regle: 'Partiellement réglée', reglee: 'Réglée', contestee: 'Contestée', annulee: 'Annulée' },
    // Taux normal de TVA en France : 20 % (CGI, art. 278).
    tauxTvaParDefaut: '20',
    formulaire: {
      titre: 'Émettre une facture à un copropriétaire',
      numero: 'N° de facture',
      numeroPlaceholder: 'FA-2026-…',
      coproprietaire: 'Copropriétaire',
      choisir: '— choisir —',
      dateEmission: "Date d'émission",
      echeance: 'Échéance',
      montantHt: 'Montant HT',
      tva: 'TVA',
      ttc: (montant) => `TTC : ${montant}`,
      description: 'Description',
      annuler: 'Annuler',
      emettre: 'Émettre la facture',
    },
    erreurs: { montantHt: 'Indiquez le montant HT.' },
    toasts: {
      emise: 'Facture émise',
      erreurEmission: "Erreur lors de l'émission",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      emiseDemo: 'Facture émise (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
