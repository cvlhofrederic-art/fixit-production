import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { IconName } from '@/lib/syndic/icon-names'
import type { PillKind } from '../../primitives/pill'

/** Document de démonstration (preview anonyme) : icône, nom, résumé, type, couleur du type, immeuble, prestataire, date. */
export interface DocumentDemo {
  icon: IconName
  nome: string
  sub: string
  tipo: string
  tipoKind: PillKind
  edificio: string
  tecnico: string
  data: string
}

interface DocsGedTextes {
  titre: string
  chapeau: string
  grilleAria: string
  grilleTitre: string
  grilleBientot: string
  ajouter: string
  /** Ligne de synthèse : un fragment par nœud de texte (même découpage qu'à l'origine). */
  synthese: {
    prefixe: string
    documents: (n: number) => string
    rapports: (n: number) => string
    factures: (n: number) => string
    devis: (n: number) => string
  }
  kpi: { rapports: string; factures: string; devis: string; tous: string }
  rechercheAria: string
  recherchePlaceholder: string
  filtres: {
    immeubleAria: string
    immeubleTous: string
    prestataireAria: string
    prestataireTous: string
    typeAria: string
    typeTous: string
  }
  trouves: (n: number) => string
  vide: { titre: string; desc: string }
  colonnes: { document: string; type: string; immeuble: string; prestataire: string; date: string; actionsAria: string }
  ouvrirAria: string
  ouvrirTitre: string
  supprimerDocument: string
  supprimerTitre: string
  plusOptions: string
  optionsBientot: string
  suppression: { avant: string; apres: string; annuler: string; supprimer: string }
  demo: DocumentDemo[]
}

export const DOCS_GED_MESSAGES = defineMessages<DocsGedTextes>({
  'pt-PT': {
    titre: 'Documentos (GED)',
    chapeau: 'Arquivo digital de todos os documentos — pesquisa, filtros, transmissão à contabilidade',
    grilleAria: 'Mudar vista para grelha',
    grilleTitre: 'Vista grelha',
    grilleBientot: 'Vista em grelha',
    ajouter: 'Adicionar um documento',
    synthese: {
      prefixe: 'GED — ',
      documents: () => ' documentos · ',
      rapports: () => ' relatórios · ',
      factures: () => ' faturas · ',
      devis: () => ' orçamentos',
    },
    kpi: { rapports: 'Relatórios', factures: 'Faturas', devis: 'Orçamentos', tous: 'Todos' },
    rechercheAria: 'Pesquisar documento',
    recherchePlaceholder: 'Pesquisar em todos os documentos, tags, nomes…',
    filtres: {
      immeubleAria: 'Filtrar por edifício',
      immeubleTous: 'Todos os edifícios',
      prestataireAria: 'Filtrar por técnico',
      prestataireTous: 'Todos os técnicos',
      typeAria: 'Filtrar por tipo',
      typeTous: 'Todos os tipos',
    },
    trouves: () => ' documentos encontrados',
    vide: {
      titre: 'Nenhum documento',
      desc: 'Carregue o primeiro documento — a Léa extrai os dados (datas, valores, fornecedor) e indexa-o automaticamente para pesquisa.',
    },
    colonnes: { document: 'Documento', type: 'Tipo', immeuble: 'Edifício', prestataire: 'Técnico', date: 'Data', actionsAria: 'Ações' },
    ouvrirAria: 'Abrir documento',
    ouvrirTitre: 'Abrir',
    supprimerDocument: 'Eliminar documento',
    supprimerTitre: 'Eliminar',
    plusOptions: 'Mais opções',
    optionsBientot: 'Opções do documento',
    suppression: {
      avant: 'Pretende eliminar definitivamente ',
      apres: '? O ficheiro é removido do arquivo e do índice da Léa. Esta ação é irreversível.',
      annuler: 'Cancelar',
      supprimer: 'Eliminar',
    },
    demo: [
      { icon: 'key', nome: 'Ata AG Anual 2026 - Edifício Atlântico.pdf', sub: 'AG · 2026 · aprovação contas', tipo: 'Ata Assembleia', tipoKind: 'gold', edificio: 'Edifício Atlântico', tecnico: '—', data: '18/05/26' },
      { icon: 'key', nome: 'Ata AG Anual 2025 - Residencial Cedofeita.pdf', sub: 'AG · 2025', tipo: 'Ata Assembleia', tipoKind: 'gold', edificio: 'Residencial Cedofeita', tecnico: '—', data: '19/03/26' },
      { icon: 'clipboard', nome: 'Fatura EDP Comercial Janeiro.pdf', sub: 'energia · EDP', tipo: 'Fatura', tipoKind: 'sage', edificio: 'Edifício Atlântico', tecnico: 'EDP Comercial', data: '03/05/26' },
      { icon: 'stamp', nome: 'Contrato Seguro Fidelidade 2026.pdf', sub: 'seguro · Fidelidade', tipo: 'Contrato', tipoKind: 'rust', edificio: 'Condomínio Boavista Center', tecnico: 'Fidelidade', data: '17/02/26' },
      { icon: 'pencil', nome: 'Orçamento Impermeabilização Cobertura.pdf', sub: 'orçamento · cobertura', tipo: 'Orçamento', tipoKind: 'amber', edificio: 'Condomínio Boavista Center', tecnico: 'TelhaViva Lda.', data: '28/04/26' },
      { icon: 'doc', nome: 'Relatório intervenção fuga água.pdf', sub: 'Maria Costa · canalização · urgente', tipo: 'Relatório intervenção', tipoKind: 'rust', edificio: 'Edifício Atlântico', tecnico: 'Silva João', data: '17/05/26' },
      { icon: 'bank', nome: 'Certificado Energético Foz Douro.pdf', sub: 'SCE · A+', tipo: 'Diagnóstico legal', tipoKind: 'rust', edificio: 'Edifício Foz Douro', tecnico: '—', data: '19/11/25' },
      { icon: 'folder', nome: 'Inspeção Elevador 2026 - Atlântico.pdf', sub: 'elevador · inspeção', tipo: 'Controlo regulamentar', tipoKind: 'rust', edificio: 'Edifício Atlântico', tecnico: 'OTIS Portugal', data: '22/02/26' },
      { icon: 'shield', nome: 'Apólice RC Profissional Pereira Ana.pdf', sub: 'RC · pintor', tipo: 'Seguro / RC Pro', tipoKind: 'rust', edificio: '—', tecnico: 'Pereira Ana', data: '30/10/25' },
      { icon: 'construction', nome: 'Plano de Manutenção 2026.pdf', sub: 'plano · manutenção · 8 anos', tipo: 'Plano / Caderno', tipoKind: 'rust', edificio: 'Edifício Foz Douro', tecnico: '—', data: '18/01/26' },
    ],
  },
  'fr-FR': {
    titre: 'Documents (GED)',
    chapeau: 'Archives numériques de tous les documents — recherche, filtres, transmission à la comptabilité',
    grilleAria: "Passer à l'affichage en grille",
    grilleTitre: 'Affichage en grille',
    grilleBientot: 'Affichage en grille',
    ajouter: 'Ajouter un document',
    synthese: {
      prefixe: 'GED : ',
      documents: (n) => (n > 1 ? ' documents · ' : ' document · '),
      rapports: (n) => (n > 1 ? ' rapports · ' : ' rapport · '),
      factures: (n) => (n > 1 ? ' factures · ' : ' facture · '),
      devis: () => ' devis',
    },
    kpi: { rapports: 'Rapports', factures: 'Factures', devis: 'Devis', tous: 'Tous' },
    rechercheAria: 'Rechercher un document',
    recherchePlaceholder: 'Rechercher dans tous les documents, étiquettes, noms…',
    filtres: {
      immeubleAria: 'Filtrer par immeuble',
      immeubleTous: 'Tous les immeubles',
      prestataireAria: 'Filtrer par prestataire',
      prestataireTous: 'Tous les prestataires',
      typeAria: 'Filtrer par type',
      typeTous: 'Tous les types',
    },
    trouves: (n) => (n > 1 ? ' documents trouvés' : ' document trouvé'),
    vide: {
      titre: 'Aucun document',
      desc: "Déposez votre premier document : Léa en extrait les données (dates, montants, fournisseur) et l'indexe automatiquement pour la recherche.",
    },
    colonnes: { document: 'Document', type: 'Type', immeuble: 'Immeuble', prestataire: 'Prestataire', date: 'Date', actionsAria: 'Actions' },
    ouvrirAria: 'Ouvrir le document',
    ouvrirTitre: 'Ouvrir',
    supprimerDocument: 'Supprimer le document',
    supprimerTitre: 'Supprimer',
    plusOptions: "Plus d'options",
    optionsBientot: 'Options du document',
    suppression: {
      avant: 'Voulez-vous supprimer définitivement ',
      apres: " ? Le fichier est retiré des archives et de l'index de Léa. Cette action est irréversible.",
      annuler: 'Annuler',
      supprimer: 'Supprimer',
    },
    demo: [
      { icon: 'key', nome: 'PV AG annuelle 2026 - Résidence Atlantique.pdf', sub: 'AG · 2026 · approbation des comptes', tipo: "Procès-verbal d'AG", tipoKind: 'gold', edificio: 'Résidence Atlantique', tecnico: '—', data: '18/05/26' },
      { icon: 'key', nome: 'PV AG annuelle 2025 - Résidence Croix-Rousse.pdf', sub: 'AG · 2025', tipo: "Procès-verbal d'AG", tipoKind: 'gold', edificio: 'Résidence Croix-Rousse', tecnico: '—', data: '19/03/26' },
      { icon: 'clipboard', nome: 'Facture électricité janvier - Rhône Énergies.pdf', sub: 'énergie · électricité des parties communes', tipo: 'Facture', tipoKind: 'sage', edificio: 'Résidence Atlantique', tecnico: 'Rhône Énergies', data: '03/05/26' },
      { icon: 'stamp', nome: 'Contrat assurance multirisque 2026 - Mutuelle Rhodanienne.pdf', sub: 'assurance · Mutuelle Rhodanienne', tipo: 'Contrat', tipoKind: 'rust', edificio: 'Copropriété Bellecour Center', tecnico: 'Mutuelle Rhodanienne', data: '17/02/26' },
      { icon: 'pencil', nome: 'Devis étanchéité toiture-terrasse.pdf', sub: 'devis · toiture', tipo: 'Devis', tipoKind: 'amber', edificio: 'Copropriété Bellecour Center', tecnico: 'Toitures du Rhône SARL', data: '28/04/26' },
      { icon: 'doc', nome: "Rapport d'intervention fuite d'eau.pdf", sub: 'Marie Coste · plomberie · urgent', tipo: "Rapport d'intervention", tipoKind: 'rust', edificio: 'Résidence Atlantique', tecnico: 'Sylvain Jean', data: '17/05/26' },
      { icon: 'bank', nome: 'DPE collectif - Berges du Rhône.pdf', sub: 'DPE collectif · classe C', tipo: 'Diagnostic réglementaire', tipoKind: 'rust', edificio: 'Résidence Les Berges du Rhône', tecnico: '—', data: '19/11/25' },
      { icon: 'folder', nome: 'Contrôle technique ascenseur 2026 - Atlantique.pdf', sub: 'ascenseur · contrôle quinquennal', tipo: 'Contrôle réglementaire', tipoKind: 'rust', edificio: 'Résidence Atlantique', tecnico: 'Rhône Contrôle Technique', data: '22/02/26' },
      { icon: 'shield', nome: 'Attestation RC professionnelle Perrin Anne.pdf', sub: 'RC · peintre', tipo: 'Assurance / RC pro', tipoKind: 'rust', edificio: '—', tecnico: 'Perrin Anne', data: '30/10/25' },
      { icon: 'construction', nome: 'Projet de plan pluriannuel de travaux 2026.pdf', sub: 'PPT · travaux sur 10 ans', tipo: 'Plan / carnet', tipoKind: 'rust', edificio: 'Résidence Les Berges du Rhône', tecnico: '—', data: '18/01/26' },
    ],
  },
})
