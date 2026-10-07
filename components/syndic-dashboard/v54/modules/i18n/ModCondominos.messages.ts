import { defineMessages } from '@/lib/syndic/v54/i18n'

interface CondominosTextes {
  titre: string
  chapeau: string
  importer: { bouton: string; titre: string; desc: string }
  exporter: { bouton: string; titre: string; aucun: string; connexionRequise: string }
  ajouter: string
  recherche: { aria: string; placeholder: string }
  filtre: { aria: string; tous: string }
  kpi: {
    lots: string
    lotsSous: string
    occupes: string
    occupesSous: string
    vacants: string
    vacantsSous: string
  }
  onglets: { prop: string; inq: string; frac: string }
  colonnes: { lot: string; proprietaire: string; contact: string; occupation: string }
  /** Étage affiché sous le lot (valeur non nulle). */
  etage: (n: number) => string
  occupe: string
  vacant: string
  vide: { titre: string; desc: string; action: string }
  csv: { fichier: string; entetes: string[] }
  formulaire: {
    titre: string
    proprietaire: string
    proprietairePlaceholder: string
    email: string
    emailPlaceholder: string
    telephone: string
    telephonePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    batiment: string
    batimentPlaceholder: string
    etage: string
    porte: string
    portePlaceholder: string
    tantiemes: string
    tantiemesAide: string
    occupation: string
    annuler: string
    creer: string
  }
  erreurNom: string
  ajoute: string
}

export const CONDOMINOS_MESSAGES = defineMessages<CondominosTextes>({
  'pt-PT': {
    titre: 'Condóminos & Inquilinos',
    chapeau: 'Proprietários · Arrendatários · Frações · Permilagens',
    importer: { bouton: 'Import Gecond', titre: 'Importar Gecond', desc: 'Importação Gecond em desenvolvimento' },
    exporter: {
      bouton: 'Export CSV',
      titre: 'Exportar CSV',
      aucun: 'Nenhum condómino para exportar.',
      connexionRequise: 'Conecte-se como síndico para exportar.',
    },
    ajouter: 'Adicionar',
    recherche: { aria: 'Pesquisar condómino', placeholder: 'Pesquisar por nome, fração…' },
    filtre: { aria: 'Filtrar por condomínio', tous: 'Todos os condomínios' },
    kpi: {
      lots: 'Frações total',
      lotsSous: 'No portefólio',
      occupes: 'Ocupados',
      occupesSous: 'Por condóminos',
      vacants: 'Vagos',
      vacantsSous: 'Sem ocupante',
    },
    onglets: { prop: 'Proprietários', inq: 'Inquilinos', frac: 'Frações' },
    colonnes: { lot: 'Fração', proprietaire: 'Proprietário', contact: 'Contacto', occupation: 'Ocupação' },
    etage: (n) => `${n}.º`,
    occupe: 'Ocupado',
    vacant: 'Vago',
    vide: {
      titre: 'Nenhum condómino encontrado',
      desc: 'Adicione condóminos manualmente ou importe-os via Gecond / CSV.',
      action: 'Adicionar primeiro condómino',
    },
    csv: {
      fichier: 'condominos.csv',
      entetes: ['Fração', 'Bloco', 'Andar', 'Porta', 'Proprietário', 'Email', 'Telefone', 'Permilagem', 'Ocupação', 'Saldo (€)'],
    },
    formulaire: {
      titre: 'Adicionar condómino',
      proprietaire: 'Proprietário',
      proprietairePlaceholder: 'Nome do proprietário',
      email: 'Email',
      emailPlaceholder: 'email@exemplo.pt',
      telephone: 'Telefone',
      telephonePlaceholder: '9XX XXX XXX',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Ex.: Edifício Aurora',
      batiment: 'Bloco',
      batimentPlaceholder: 'A, B…',
      etage: 'Andar',
      porte: 'Porta / Fração',
      portePlaceholder: 'Esq., Dto., 21…',
      tantiemes: 'Permilagem',
      tantiemesAide: '‰ (millièmes)',
      occupation: 'Ocupação',
      annuler: 'Cancelar',
      creer: 'Criar condómino',
    },
    erreurNom: 'Indique o nome do proprietário.',
    ajoute: 'Condómino adicionado',
  },
  'fr-FR': {
    titre: 'Copropriétaires & locataires',
    chapeau: 'Propriétaires · Locataires · Lots · Tantièmes',
    importer: {
      bouton: 'Importer un fichier',
      titre: 'Importer un fichier',
      desc: "L'import depuis un autre logiciel de syndic est en cours de développement",
    },
    exporter: {
      bouton: 'Exporter en CSV',
      titre: 'Exporter en CSV',
      aucun: 'Aucun copropriétaire à exporter.',
      connexionRequise: 'Connectez-vous en tant que syndic pour exporter.',
    },
    ajouter: 'Ajouter',
    recherche: { aria: 'Rechercher un copropriétaire', placeholder: 'Rechercher par nom, lot…' },
    filtre: { aria: 'Filtrer par copropriété', tous: 'Toutes les copropriétés' },
    kpi: {
      lots: 'Total des lots',
      lotsSous: 'Dans le portefeuille',
      occupes: 'Occupés',
      occupesSous: 'Propriétaire ou locataire',
      vacants: 'Vacants',
      vacantsSous: 'Sans occupant',
    },
    onglets: { prop: 'Propriétaires', inq: 'Locataires', frac: 'Lots' },
    colonnes: { lot: 'Lot', proprietaire: 'Propriétaire', contact: 'Contact', occupation: 'Occupation' },
    etage: (n) => (n < 0 ? `Niveau ${n}` : n === 1 ? '1er étage' : `${n}e étage`),
    occupe: 'Occupé',
    vacant: 'Vacant',
    vide: {
      titre: 'Aucun copropriétaire trouvé',
      desc: 'Ajoutez des copropriétaires manuellement ou importez-les depuis un fichier CSV.',
      action: 'Ajouter votre premier copropriétaire',
    },
    csv: {
      fichier: 'coproprietaires.csv',
      entetes: ['Immeuble', 'Bâtiment', 'Étage', 'Porte / lot', 'Propriétaire', 'E-mail', 'Téléphone', 'Tantièmes', 'Occupation', 'Solde (€)'],
    },
    formulaire: {
      titre: 'Ajouter un copropriétaire',
      proprietaire: 'Propriétaire',
      proprietairePlaceholder: 'Nom du propriétaire',
      email: 'E-mail',
      emailPlaceholder: 'prenom.nom@exemple.fr',
      telephone: 'Téléphone',
      telephonePlaceholder: '06 12 34 56 78',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Ex. : Résidence Aurore',
      batiment: 'Bâtiment',
      batimentPlaceholder: 'A, B…',
      etage: 'Étage',
      porte: 'Porte / lot',
      portePlaceholder: 'Porte gauche, lot 21…',
      tantiemes: 'Tantièmes',
      tantiemesAide: 'en millièmes (‰)',
      occupation: 'Occupation',
      annuler: 'Annuler',
      creer: 'Créer le copropriétaire',
    },
    erreurNom: 'Indiquez le nom du propriétaire.',
    ajoute: 'Copropriétaire ajouté',
  },
})
