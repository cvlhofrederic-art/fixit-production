import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Document de démonstration de l'arborescence. */
export interface ArqDoc { nome: string; data: string; tam: string; imovel: string; hash: string }
/** Catégorie de l'arborescence (docs null = catégorie repliée). */
export interface ArqCat { nome: string; count: number; docs: ArqDoc[] | null }

/** Titre et description d'un toast « en développement ». */
interface Bientot { titre: string; desc: string }

interface ArquivoDigitalTextes {
  titre: string
  chapeau: string
  onglets: { arq: string; pesq: string; cert: string; proj: string; cfg: string }
  kpi: { total: string; categories: string; stockage: string; stockageNum: string; dernierDepot: string; dernierDepotNum: string }
  arborescence: string
  ajouterDocument: string
  bientotAjouter: Bientot
  categories: ArqCat[]
  colonnes: { nom: string; date: string; taille: string; immeuble: string; empreinte: string; actions: string }
  voirAria: string
  voirTitre: string
  bientotVoir: Bientot
  telechargerAria: string
  bientotTelecharger: Bientot
  separateur: { surtitre: string; titre: string; sous: string }
  projet: {
    surtitre: string
    titre: string
    chapeau: string
    deposerCertifie: string
    bientotDeposerCertifie: Bientot
    alerteTitre: string
    alerteTexte: string
    kpi: { certifies: string; couverts: string; audit: string; sansDoc: string }
    onglets: { todos: string; proj: string; alv: string; lic: string; imi: string; audit: string }
    videTitre: string
    videDesc: string
    deposerPremier: string
    bientotDeposer: Bientot
  }
}

export const ARQUIVO_DIGITAL_MESSAGES = defineMessages<ArquivoDigitalTextes>({
  'pt-PT': {
    titre: 'Arquivo Digital Certificado',
    chapeau: 'Arquivo eletrónico com integridade garantida por hash SHA-256 · Pesquisa avançada · Retenção legal · Projeto aprovado & licenças',
    onglets: { arq: 'Arquivo', pesq: 'Pesquisa', cert: 'Certificação', proj: 'Projeto Aprovado & Licenças', cfg: 'Configuração' },
    kpi: { total: 'Total documentos', categories: 'Categorias', stockage: 'Armazenamento', stockageNum: '2.5 MB', dernierDepot: 'Último upload', dernierDepotNum: '2025-02-10' },
    arborescence: 'Árvore de documentos',
    ajouterDocument: '+ Carregar documento',
    bientotAjouter: { titre: 'Carregar documento', desc: 'Carregamento de documentos em desenvolvimento' },
    categories: [
      {
        nome: 'Atas', count: 2, docs: [
          { nome: 'Ata AG Ordinária 2025.pdf', data: '2025-03-15', tam: '245 KB', imovel: 'Edifício Aurora', hash: '2e36304434cc...' },
          { nome: 'Ata AG Extraordinária Obras.pdf', data: '2025-01-20', tam: '189 KB', imovel: 'Edifício Aurora', hash: '3405a65293a4...' },
        ],
      },
      { nome: 'Convocatórias', count: 1, docs: null },
      { nome: 'Regulamentos', count: 1, docs: null },
      { nome: 'Orçamentos', count: 1, docs: null },
    ],
    colonnes: { nom: 'Nome', date: 'Data', taille: 'Tamanho', immeuble: 'Imóvel', empreinte: 'Hash', actions: 'Ações' },
    voirAria: 'Ver fatura',
    voirTitre: 'Ver',
    bientotVoir: { titre: 'Ver documento', desc: 'Visualização de documentos em desenvolvimento' },
    telechargerAria: 'Descarregar',
    bientotTelecharger: { titre: 'Descarregar documento', desc: 'Descarregamento em desenvolvimento' },
    separateur: {
      surtitre: 'OBRIGAÇÃO LEGAL · DL 268/94 ART. 2.°',
      titre: 'Projeto Aprovado & Licenças',
      sous: 'Cópias autenticadas · Projeto aprovado Câmara · Alvará · Licença utilização · Audit trail imutável',
    },
    projet: {
      surtitre: 'OBRIGAÇÃO LEGAL · DL 268/94 ART. 2.°',
      titre: 'Arquivo Projeto Aprovado & Licenças',
      chapeau: 'Cópias autenticadas · Projeto aprovado Câmara · Alvará · Licença utilização · Audit trail imutável',
      deposerCertifie: 'Upload documento autenticado',
      bientotDeposerCertifie: { titre: 'Upload documento autenticado', desc: 'Depósito de documentos em desenvolvimento' },
      alerteTitre: 'DL 268/94 art. 2.° — Documentos obrigatórios',
      alerteTexte: 'Devem ficar depositadas à guarda do administrador as cópias autenticadas dos documentos utilizados para instruir o processo de constituição da propriedade horizontal, designadamente o projeto aprovado pela entidade pública competente.',
      kpi: { certifies: 'Documentos autenticados', couverts: 'Edifícios cobertos', audit: 'Audit trail verificado', sansDoc: 'Edifícios sem documentação' },
      onglets: { todos: 'Todos', proj: 'Projeto Aprovado', alv: 'Alvará', lic: 'Licença Utilização', imi: 'Caderneta Predial IMI', audit: 'Audit Trail' },
      videTitre: 'Arquivo vazio',
      videDesc: 'Os documentos depositados aqui são imutáveis. Cada acesso, upload ou substituição fica registado no audit trail.',
      deposerPremier: 'Depositar primeiro documento',
      bientotDeposer: { titre: 'Depositar documento', desc: 'Depósito de documentos em desenvolvimento' },
    },
  },
  'fr-FR': {
    titre: 'Archives numériques du syndicat',
    chapeau: "Archives dématérialisées à intégrité garantie par empreinte SHA-256 · Recherche avancée · Durées de conservation · Mise à disposition sur l'extranet · Plans, permis & diagnostics",
    onglets: { arq: 'Archives', pesq: 'Recherche', cert: 'Certification', proj: 'Plans, permis & diagnostics', cfg: 'Configuration' },
    kpi: { total: 'Total des documents', categories: 'Catégories', stockage: 'Stockage', stockageNum: '2,5 Mo', dernierDepot: 'Dernier dépôt', dernierDepotNum: '10/02/2025' },
    arborescence: 'Arborescence des documents',
    ajouterDocument: '+ Ajouter un document',
    bientotAjouter: { titre: 'Ajouter un document', desc: "L'ajout de documents est en cours de développement" },
    categories: [
      {
        nome: "Procès-verbaux d'AG", count: 2, docs: [
          { nome: 'PV AG ordinaire 2025.pdf', data: '15/03/2025', tam: '245 Ko', imovel: 'Résidence Aurore', hash: '2e36304434cc...' },
          { nome: 'PV AG extraordinaire travaux.pdf', data: '20/01/2025', tam: '189 Ko', imovel: 'Résidence Aurore', hash: '3405a65293a4...' },
        ],
      },
      { nome: 'Convocations', count: 1, docs: null },
      { nome: 'Règlement de copropriété & EDD', count: 1, docs: null },
      { nome: 'Devis', count: 1, docs: null },
    ],
    colonnes: { nom: 'Nom', date: 'Date', taille: 'Taille', immeuble: 'Immeuble', empreinte: 'Empreinte', actions: 'Actions' },
    voirAria: 'Voir le document',
    voirTitre: 'Voir',
    bientotVoir: { titre: 'Voir le document', desc: 'La consultation des documents est en cours de développement' },
    telechargerAria: 'Télécharger le document',
    bientotTelecharger: { titre: 'Télécharger le document', desc: 'Le téléchargement est en cours de développement' },
    separateur: {
      surtitre: 'OBLIGATION LÉGALE · DÉCRET DU 17 MARS 1967, ART. 33',
      titre: 'Plans, permis & diagnostics',
      sous: "Copies certifiées · Plans de l'immeuble · Permis de construire · Conformité des travaux · Diagnostics techniques · Journal d'audit inaltérable",
    },
    projet: {
      surtitre: 'OBLIGATION LÉGALE · DÉCRET DU 17 MARS 1967, ART. 33',
      titre: "Archives : plans, permis & diagnostics de l'immeuble",
      chapeau: "Copies certifiées · Plans de l'immeuble · Permis de construire · Conformité des travaux · Diagnostics techniques · Journal d'audit inaltérable",
      deposerCertifie: 'Déposer un document certifié',
      bientotDeposerCertifie: { titre: 'Déposer un document certifié', desc: 'Le dépôt de documents est en cours de développement' },
      alerteTitre: 'Décret du 17 mars 1967, art. 33 — Archives du syndicat',
      alerteTexte: "Le syndic détient les archives du syndicat : règlement de copropriété et état descriptif de division, conventions, correspondances, plans, registres des procès-verbaux d'assemblée générale et pièces annexes, documents comptables, carnet d'entretien et, le cas échéant, diagnostics techniques. En cas de changement de syndic, l'ancien syndic les remet au nouveau (loi du 10 juillet 1965, art. 18-2).",
      kpi: { certifies: 'Documents certifiés', couverts: 'Immeubles couverts', audit: "Journal d'audit vérifié", sansDoc: 'Immeubles sans documentation' },
      onglets: { todos: 'Tous', proj: 'Plans', alv: 'Permis de construire', lic: 'Conformité des travaux', imi: 'Diagnostics techniques', audit: "Journal d'audit" },
      videTitre: 'Archives vides',
      videDesc: "Les documents déposés ici sont inaltérables. Chaque consultation, dépôt ou remplacement est enregistré dans le journal d'audit.",
      deposerPremier: 'Déposer un premier document',
      bientotDeposer: { titre: 'Déposer un document', desc: 'Le dépôt de documents est en cours de développement' },
    },
  },
})
