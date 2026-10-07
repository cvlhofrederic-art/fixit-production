import { defineMessages } from '@/lib/syndic/v54/i18n'

interface DocsIntervTextes {
  titre: string
  chapeau: string
  ajouterDocument: string
  kpi: {
    total: string
    totalSous: string
    nonTransmis: string
    nonTransmisSous: string
    transmis: string
    transmisSous: string
    factures: string
    facturesSous: string
  }
  onglets: { tous: string; aEnvoyer: string; envoyes: string }
  rechercheAria: string
  recherchePlaceholder: string
  tousTypes: string
  filtrerType: string
  tousPrestataires: string
  filtrerPrestataire: string
  vide: { titre: string; description: string }
  colonnes: { document: string; type: string; comptabilite: string; date: string }
  aucunDansCategorie: string
  transmis: string
  aEnvoyer: string
}

export const DOCS_INTERV_MESSAGES = defineMessages<DocsIntervTextes>({
  'pt-PT': {
    titre: 'Documentos de Intervenções',
    chapeau: 'Faturas · Orçamentos · Relatórios · Fotos — Transmissão à contabilidade',
    ajouterDocument: 'Adicionar documento',
    kpi: {
      total: 'Total documentos',
      totalSous: 'Todas as categorias',
      nonTransmis: 'Não transmitidas à contabilidade',
      nonTransmisSous: 'A tratar',
      transmis: 'Transmitidas à contabilidade',
      transmisSous: 'Classificados',
      factures: 'Faturas',
      facturesSous: 'Este mês',
    },
    onglets: { tous: 'Todos', aEnvoyer: '● A enviar', envoyes: '● Enviados & classificados' },
    rechercheAria: 'Pesquisar documento',
    recherchePlaceholder: 'Pesquisar por profissional, edifício, ficheiro, notas…',
    tousTypes: 'Todos os tipos',
    filtrerType: 'Filtrar por tipo',
    tousPrestataires: 'Todos os profissionais',
    filtrerPrestataire: 'Filtrar por profissional',
    vide: { titre: 'Nenhum documento', description: 'Adicione faturas, orçamentos e relatórios de intervenção' },
    colonnes: { document: 'Documento', type: 'Tipo', comptabilite: 'Contabilidade', date: 'Data' },
    aucunDansCategorie: 'Nenhum documento nesta categoria.',
    transmis: 'Transmitida',
    aEnvoyer: 'A enviar',
  },
  'fr-FR': {
    titre: "Documents d'intervention",
    chapeau: 'Factures · Devis · Rapports · Photos — Transmission à la comptabilité',
    ajouterDocument: 'Ajouter un document',
    kpi: {
      total: 'Total des documents',
      totalSous: 'Toutes catégories',
      nonTransmis: 'Non transmis à la comptabilité',
      nonTransmisSous: 'À traiter',
      transmis: 'Transmis à la comptabilité',
      transmisSous: 'Classés',
      factures: 'Factures',
      // Le compteur n'est pas filtré par mois : « Toutes périodes » plutôt que « Ce mois-ci ».
      facturesSous: 'Toutes périodes',
    },
    onglets: { tous: 'Tous', aEnvoyer: '● À envoyer', envoyes: '● Envoyés & classés' },
    rechercheAria: 'Rechercher un document',
    recherchePlaceholder: 'Rechercher par prestataire, immeuble, fichier, notes…',
    tousTypes: 'Tous les types',
    filtrerType: 'Filtrer par type',
    tousPrestataires: 'Tous les prestataires',
    filtrerPrestataire: 'Filtrer par prestataire',
    vide: { titre: 'Aucun document', description: "Ajoutez les factures, devis et rapports d'intervention" },
    colonnes: { document: 'Document', type: 'Type', comptabilite: 'Comptabilité', date: 'Date' },
    aucunDansCategorie: 'Aucun document dans cette catégorie.',
    transmis: 'Transmis',
    aEnvoyer: 'À envoyer',
  },
})
