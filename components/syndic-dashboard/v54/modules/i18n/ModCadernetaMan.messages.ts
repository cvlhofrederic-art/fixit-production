import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Nature des travaux (codes enregistrés par l'API, inchangés dans les deux langues). */
export type NatureCode = 'manutencao-corrente' | 'reparacao' | 'diagnostico' | 'obra-conservacao' | 'obra-beneficiacao' | 'inspeccao-legal'
/** État d'une intervention (codes de l'API). */
export type EtatCode = 'realizado' | 'planeado' | 'em-curso' | 'cancelado'

interface CadernetaTextes {
  titre: string
  chapeau: string
  exporterPdf: string
  nouvelleIntervention: string
  onglets: { cad: string; eq: string; ct: string; est: string; cee: string }
  kpi: { interventions: string; planifiees: string; coutTotal: string; immeubles: string }
  vide: { titre: string; desc: string; action: string }
  colonnes: { date: string; nature: string; immeuble: string; prestataire: string; cout: string; garantie: string; statut: string }
  natures: Record<NatureCode, string>
  etats: Record<EtatCode, string>
  modal: {
    titre: string
    date: string
    statut: string
    nature: string
    choisir: string
    immeuble: string
    immeublePlaceholder: string
    localisation: string
    localisationPlaceholder: string
    prestataire: string
    prestatairePlaceholder: string
    cout: string
    coutAide: string
    garantie: string
    garantieAide: string
    garantiePlaceholder: string
    classe: string
    classeAide: string
    sansObjet: string
    /** Classes énergétiques proposées (valeur enregistrée = libellé affiché). */
    classes: string[]
    notes: string
    annuler: string
    enregistrer: string
  }
  erreurs: { date: string; nature: string }
  toasts: {
    enregistree: string
    /** Détail du toast de succès : le PT affiche le code brut de la nature (comportement d'origine), le FR son libellé. */
    detailEnregistree: (libelle: string, code: string) => string
    erreur: string
    reessayerPlusTard: string
    enregistreeDemo: string
    connexionRequise: string
    exportTitre: string
    exportPremiere: string
    exportConnexion: string
  }
  pdf: {
    fichier: string
    titre: string
    sousTitre: string
    kpi: { interventions: string; planifiees: string; coutTotal: string; immeubles: string }
    colonnes: [string, string, string, string, string, string]
  }
}

export const CADERNETA_MESSAGES = defineMessages<CadernetaTextes>({
  'pt-PT': {
    titre: 'Caderneta de Manutenção & Técnica',
    chapeau: 'Obras · Equipamentos · Contratos manutenção · Estado datado · CEE',
    exporterPdf: 'Export PDF',
    nouvelleIntervention: '+ Intervenção',
    onglets: { cad: 'Caderneta de manutenção', eq: 'Equipamentos', ct: 'Contratos', est: 'Estado Datado', cee: 'CEE Coletivo' },
    kpi: { interventions: 'Intervenções', planifiees: 'Planeadas', coutTotal: 'Custo total', immeubles: 'Edifícios' },
    vide: { titre: 'Caderneta vazia', desc: 'Registe todas as intervenções para rastreabilidade completa', action: '+ Primeira intervenção' },
    colonnes: { date: 'Data', nature: 'Natureza', immeuble: 'Edifício', prestataire: 'Prestador', cout: 'Custo', garantie: 'Garantia', statut: 'Estado' },
    natures: {
      'manutencao-corrente': 'Manutenção corrente',
      'reparacao': 'Reparação',
      'diagnostico': 'Diagnóstico técnico',
      'obra-conservacao': 'Obra de conservação',
      'obra-beneficiacao': 'Obra de beneficiação',
      'inspeccao-legal': 'Inspeção legal obrigatória',
    },
    etats: { realizado: 'Realizado', planeado: 'Planeado', 'em-curso': 'Em curso', cancelado: 'Cancelado' },
    modal: {
      titre: 'Nova intervenção',
      date: 'Data',
      statut: 'Estado',
      nature: 'Natureza das obras',
      choisir: 'Escolher…',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      localisation: 'Localização',
      localisationPlaceholder: 'Bloco A, entrada 2…',
      prestataire: 'Prestador',
      prestatairePlaceholder: 'Nome da empresa',
      cout: 'Custo',
      coutAide: 'Valor em euros',
      garantie: 'Garantia',
      garantieAide: 'Ex.: 10 anos / até 2036',
      garantiePlaceholder: '10 anos / até 2036',
      classe: 'Classe CEE',
      classeAide: 'Se diagnóstico energético',
      sansObjet: 'Não aplicável',
      classes: ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F'],
      notes: 'Notas',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: { date: 'A data é obrigatória.', nature: 'Indique a natureza das obras.' },
    toasts: {
      enregistree: 'Intervenção registada',
      detailEnregistree: (_libelle, code) => code,
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreeDemo: 'Intervenção registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      exportTitre: 'Export PDF',
      exportPremiere: 'Registe a primeira intervenção para exportar.',
      exportConnexion: 'Conecte-se como síndico para exportar.',
    },
    pdf: {
      fichier: 'caderneta-manutencao.pdf',
      titre: 'Caderneta de Manutenção',
      sousTitre: 'Obras · Equipamentos · Estado datado',
      kpi: { interventions: 'Intervenções', planifiees: 'Planeadas', coutTotal: 'Custo total', immeubles: 'Edifícios' },
      colonnes: ['Data', 'Natureza', 'Edifício', 'Prestador', 'Custo', 'Estado'],
    },
  },
  'fr-FR': {
    titre: "Carnet d'entretien & suivi technique",
    chapeau: "Travaux · Équipements · Contrats d'entretien · État daté · DPE collectif — art. 18 de la loi du 10 juillet 1965, décret n° 2001-477",
    exporterPdf: 'Exporter en PDF',
    nouvelleIntervention: '+ Intervention',
    onglets: { cad: "Carnet d'entretien", eq: 'Équipements', ct: 'Contrats', est: 'État daté', cee: 'DPE collectif' },
    kpi: { interventions: 'Interventions', planifiees: 'Planifiées', coutTotal: 'Coût total', immeubles: 'Immeubles' },
    vide: { titre: "Carnet d'entretien vide", desc: 'Consignez chaque intervention pour une traçabilité complète', action: '+ Première intervention' },
    colonnes: { date: 'Date', nature: 'Nature', immeuble: 'Immeuble', prestataire: 'Prestataire', cout: 'Coût', garantie: 'Garantie', statut: 'Statut' },
    natures: {
      'manutencao-corrente': 'Entretien courant',
      'reparacao': 'Réparation',
      'diagnostico': 'Diagnostic technique',
      'obra-conservacao': 'Travaux de conservation',
      'obra-beneficiacao': "Travaux d'amélioration",
      'inspeccao-legal': 'Contrôle réglementaire obligatoire',
    },
    etats: { realizado: 'Réalisé', planeado: 'Planifié', 'em-curso': 'En cours', cancelado: 'Annulé' },
    modal: {
      titre: 'Nouvelle intervention',
      date: 'Date',
      statut: 'Statut',
      nature: 'Nature des travaux',
      choisir: 'Choisir…',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      localisation: 'Localisation',
      localisationPlaceholder: 'Bâtiment A, escalier 2…',
      prestataire: 'Prestataire',
      prestatairePlaceholder: "Nom de l'entreprise",
      cout: 'Coût',
      coutAide: 'Montant en euros',
      garantie: 'Garantie',
      garantieAide: "Ex. : décennale / jusqu'en 2036",
      garantiePlaceholder: "10 ans / jusqu'en 2036",
      classe: 'Étiquette DPE',
      classeAide: 'En cas de diagnostic de performance énergétique',
      sansObjet: 'Sans objet',
      classes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      notes: 'Remarques',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: { date: 'La date est obligatoire.', nature: 'Indiquez la nature des travaux.' },
    toasts: {
      enregistree: 'Intervention enregistrée',
      detailEnregistree: (libelle) => libelle,
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreeDemo: 'Intervention enregistrée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      exportTitre: 'Export en PDF',
      exportPremiere: 'Enregistrez une première intervention pour exporter.',
      exportConnexion: 'Connectez-vous en tant que syndic pour exporter.',
    },
    pdf: {
      fichier: 'carnet-entretien.pdf',
      titre: "Carnet d'entretien",
      sousTitre: 'Travaux · Équipements · État daté',
      kpi: { interventions: 'Interventions', planifiees: 'Planifiées', coutTotal: 'Coût total', immeubles: 'Immeubles' },
      colonnes: ['Date', 'Nature', 'Immeuble', 'Prestataire', 'Coût', 'Statut'],
    },
  },
})
