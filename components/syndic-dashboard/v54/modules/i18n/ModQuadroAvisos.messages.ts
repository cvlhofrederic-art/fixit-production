import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Catégorie d'un avis (valeur stockée par l'API : manutencao | assembleia | financeiro | seguranca | social | outro). */
export type CategorieAviso = 'manutencao' | 'assembleia' | 'financeiro' | 'seguranca' | 'social' | 'outro'

/** Pastille de priorité affichée ('' : aucune pastille). « expirado » n'existe que dans la démonstration. */
export type PrioriteAviso = 'urgente' | 'importante' | 'expirado' | ''

/** Avis de démonstration (aperçu anonyme). */
export interface AvisoDemo {
  fixado: boolean
  categorie: CategorieAviso
  priorite: PrioriteAviso
  expire: boolean
  titre: string
  desc: string
  edificio: string
  views: number
  color: string
  data: string
}

interface QuadroAvisosTextes {
  titre: string
  chapeau: string
  nouvelAvis: string
  filtres: {
    rechercheAria: string
    recherchePlaceholder: string
    statutAria: string
    statutActifs: string
    categorieAria: string
    toutesCategories: string
    prioriteAria: string
    toutesPriorites: string
    immeubleAria: string
    tousImmeubles: string
  }
  aucunAvis: string
  /** Pastilles des cartes. */
  fixe: string
  expire: string
  /** Libellé d'une catégorie (clé = valeur API ; repli sur la valeur brute si inconnue). */
  categories: Record<string, string>
  priorites: Record<Exclude<PrioriteAviso, ''>, string>
  /** Auteur affiché au pied de la carte : sans immeuble / avec immeuble. */
  auteurGeneral: string
  auteurImmeuble: string
  resumeTitre: string
  resume: { actifs: string; vues: string; epingles: string; ceMois: string; plusVu: string }
  distributionTitre: string
  actionsTitre: string
  actionsRapides: { urgent: string; ag: string; financier: string }
  demo: AvisoDemo[]
  formulaire: {
    titreModale: string
    titre: string
    titrePlaceholder: string
    description: string
    descriptionPlaceholder: string
    categorie: string
    priorite: string
    priorites: { normal: string; importante: string; urgente: string }
    immeuble: string
    immeublePlaceholder: string
    epingler: string
    non: string
    oui: string
    annuler: string
    publier: string
  }
  erreurs: { titre: string }
  toasts: {
    publie: string
    erreurPublication: string
    reessayerPlusTard: string
    publieDemo: string
    connexionRequise: string
  }
}

export const QUADRO_AVISOS_MESSAGES = defineMessages<QuadroAvisosTextes>({
  'pt-PT': {
    titre: 'Quadro de Avisos',
    chapeau: 'Comunique com os condóminos de forma clara e organizada',
    nouvelAvis: 'Novo Aviso',
    filtres: {
      rechercheAria: 'Pesquisar avisos',
      recherchePlaceholder: 'Pesquisar avisos…',
      statutAria: 'Estado',
      statutActifs: 'Ativos',
      categorieAria: 'Categoria',
      toutesCategories: 'Todas as categorias',
      prioriteAria: 'Prioridade',
      toutesPriorites: 'Todas as prioridades',
      immeubleAria: 'Imóvel',
      tousImmeubles: 'Todos os imóveis',
    },
    aucunAvis: 'Nenhum aviso publicado. Comunique com os seus condóminos com « Novo Aviso ».',
    fixe: 'Fixado',
    expire: 'Expirado',
    categories: { manutencao: 'Manutenção', assembleia: 'Assembleia', financeiro: 'Financeiro', seguranca: 'Segurança', social: 'Social', outro: 'Outro' },
    priorites: { urgente: 'Urgente', importante: 'Importante', expirado: 'Expirado' },
    auteurGeneral: 'Administração',
    auteurImmeuble: 'Gestor',
    resumeTitre: 'Resumo',
    resume: { actifs: 'Avisos ativos', vues: 'Total visualizações', epingles: 'Avisos fixados', ceMois: 'Avisos este mês', plusVu: 'Elevador fora de serviço — Rep…' },
    distributionTitre: 'Distribuição por Categoria',
    actionsTitre: 'Ações Rápidas',
    actionsRapides: { urgent: 'Aviso Urgente', ag: 'Convocatória AG', financier: 'Aviso Financeiro' },
    demo: [
      { fixado: true, categorie: 'manutencao', priorite: 'urgente', expire: true, titre: 'Corte de água — Manutenção urgente da canalização', desc: 'Informamos que haverá corte de água no dia 15 de março, das 09h às 14h, para reparação urgente de uma fuga na canalização principal do edifício', edificio: 'Edifício Aurora', views: 47, color: 'rust', data: '11/03/26' },
      { fixado: true, categorie: 'assembleia', priorite: 'importante', expire: true, titre: 'Convocatória — Assembleia Geral Ordinária 2026', desc: 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que se realizará no dia 28 de março de 2026, às 19h00', edificio: 'Edifício Aurora', views: 38, color: 'gold', data: '08/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: 'urgente', expire: false, titre: 'Elevador fora de serviço — Reparação em curso', desc: 'O elevador do Edifício Solaris encontra-se fora de serviço desde hoje. A empresa de manutenção foi contactada e a reparação está prevista para os próximos 2 dias úteis', edificio: 'Edifício Solaris', views: 62, color: 'amber', data: '10/03/26' },
      { fixado: false, categorie: 'financeiro', priorite: 'importante', expire: false, titre: 'Renovação do Seguro Multirriscos', desc: 'Informamos que o seguro multirriscos do condomínio foi renovado com a Fidelidade Seguros, com efeito a partir de 1 de abril', edificio: '—', views: 25, color: 'sage', data: '07/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: '', expire: false, titre: 'Horário de limpeza das áreas comuns', desc: 'A partir de 1 de abril, o horário de limpeza das áreas comuns será alterado para as manhãs (08h-11h) em vez do período da tarde', edificio: '—', views: 19, color: '', data: '06/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: '', expire: false, titre: 'Manutenção do jardim — Primavera 2026', desc: 'Iniciamos esta semana os trabalhos de manutenção do jardim e espaços verdes. Serão realizados podas, plantação de novas flores', edificio: 'Edifício Atlântico', views: 14, color: '', data: '05/03/26' },
      { fixado: false, categorie: 'seguranca', priorite: '', expire: false, titre: 'Regras de segurança — Portas de acesso', desc: 'Relembramos todos os condóminos da importância de manter as portas de acesso ao edifício sempre fechadas. Não abram a porta a pessoas desconhecidas', edificio: '—', views: 31, color: '', data: '04/03/26' },
      { fixado: false, categorie: 'social', priorite: 'expirado', expire: false, titre: 'Festa de Vizinhos — 20 de março', desc: 'Convidamos todos os moradores para a Festa de Vizinhos que se realizará no dia 20 de março, às 18h30, no terraço do Edifício Aurora', edificio: 'Edifício Aurora', views: 42, color: 'sage', data: '03/03/26' },
    ],
    formulaire: {
      titreModale: 'Novo aviso',
      titre: 'Título',
      titrePlaceholder: 'Ex.: Corte de água programado',
      description: 'Descrição',
      descriptionPlaceholder: 'Mensagem aos condóminos…',
      categorie: 'Categoria',
      priorite: 'Prioridade',
      priorites: { normal: 'Normal', importante: 'Importante', urgente: 'Urgente' },
      immeuble: 'Edifício',
      immeublePlaceholder: 'Opcional — todos se vazio',
      epingler: 'Fixar no topo',
      non: 'Não',
      oui: 'Sim',
      annuler: 'Cancelar',
      publier: 'Publicar',
    },
    erreurs: { titre: 'O título é obrigatório.' },
    toasts: {
      publie: 'Aviso publicado',
      erreurPublication: 'Erro ao publicar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      publieDemo: 'Aviso publicado (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: "Panneau d'affichage",
    chapeau: 'Informez les copropriétaires et les occupants de façon claire et organisée',
    nouvelAvis: 'Nouvel avis',
    filtres: {
      rechercheAria: 'Rechercher un avis',
      recherchePlaceholder: 'Rechercher un avis…',
      statutAria: 'Filtrer par statut',
      statutActifs: 'Actifs',
      categorieAria: 'Filtrer par catégorie',
      toutesCategories: 'Toutes les catégories',
      prioriteAria: 'Filtrer par priorité',
      toutesPriorites: 'Toutes les priorités',
      immeubleAria: 'Filtrer par immeuble',
      tousImmeubles: 'Tous les immeubles',
    },
    aucunAvis: 'Aucun avis publié. Informez vos copropriétaires avec « Nouvel avis ».',
    fixe: 'Épinglé',
    expire: 'Expiré',
    categories: { manutencao: 'Entretien', assembleia: 'Assemblée générale', financeiro: 'Finances', seguranca: 'Sécurité', social: 'Vie de la résidence', outro: 'Autre' },
    priorites: { urgente: 'Urgent', importante: 'Important', expirado: 'Expiré' },
    auteurGeneral: 'Syndic',
    auteurImmeuble: 'Gestionnaire',
    resumeTitre: 'Résumé',
    resume: { actifs: 'Avis actifs', vues: 'Vues au total', epingles: 'Avis épinglés', ceMois: 'Avis ce mois-ci', plusVu: "Ascenseur à l'arrêt — répar…" },
    distributionTitre: 'Répartition par catégorie',
    actionsTitre: 'Actions rapides',
    actionsRapides: { urgent: 'Avis urgent', ag: 'Information AG', financier: 'Avis financier' },
    demo: [
      { fixado: true, categorie: 'manutencao', priorite: 'urgente', expire: true, titre: "Coupure d'eau — réparation urgente des canalisations", desc: "Nous vous informons que l'eau sera coupée le 15 mars, de 9 h à 14 h, pour la réparation urgente d'une fuite sur la canalisation principale de l'immeuble", edificio: 'Résidence Aurore', views: 47, color: 'rust', data: '11/03/26' },
      { fixado: true, categorie: 'assembleia', priorite: 'importante', expire: true, titre: 'Assemblée générale ordinaire 2026', desc: "L'assemblée générale ordinaire des copropriétaires se tiendra le 28 mars 2026 à 19 h. La convocation et ses annexes ont été notifiées à chaque copropriétaire (lettre recommandée ou voie électronique)", edificio: 'Résidence Aurore', views: 38, color: 'gold', data: '08/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: 'urgente', expire: false, titre: "Ascenseur à l'arrêt — réparation en cours", desc: "L'ascenseur de la Résidence Solaris est à l'arrêt depuis ce matin. L'entreprise de maintenance a été prévenue et la réparation est prévue dans les 2 jours ouvrés", edificio: 'Résidence Solaris', views: 62, color: 'amber', data: '10/03/26' },
      { fixado: false, categorie: 'financeiro', priorite: 'importante', expire: false, titre: "Renouvellement de l'assurance multirisque immeuble", desc: "Nous vous informons que le contrat d'assurance multirisque de la copropriété a été renouvelé auprès de la Mutuelle Rhodanienne, avec effet au 1er avril", edificio: '—', views: 25, color: 'sage', data: '07/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: '', expire: false, titre: 'Horaires de nettoyage des parties communes', desc: "À compter du 1er avril, le nettoyage des parties communes aura lieu le matin (8 h - 11 h) et non plus l'après-midi", edificio: '—', views: 19, color: '', data: '06/03/26' },
      { fixado: false, categorie: 'manutencao', priorite: '', expire: false, titre: 'Entretien du jardin — printemps 2026', desc: "Les travaux d'entretien du jardin et des espaces verts commencent cette semaine : taille des arbustes et plantation de nouvelles fleurs", edificio: 'Résidence Atlantique', views: 14, color: '', data: '05/03/26' },
      { fixado: false, categorie: 'seguranca', priorite: '', expire: false, titre: "Consignes de sécurité — portes d'accès", desc: "Nous rappelons à tous les occupants l'importance de toujours refermer les portes d'accès à l'immeuble. N'ouvrez pas à des personnes inconnues", edificio: '—', views: 31, color: '', data: '04/03/26' },
      { fixado: false, categorie: 'social', priorite: 'expirado', expire: false, titre: 'Fête des voisins — 20 mars', desc: 'Tous les résidents sont invités à la fête des voisins, le 20 mars à 18 h 30, sur la terrasse de la Résidence Aurore', edificio: 'Résidence Aurore', views: 42, color: 'sage', data: '03/03/26' },
    ],
    formulaire: {
      titreModale: 'Nouvel avis',
      titre: 'Titre',
      titrePlaceholder: "Ex. : Coupure d'eau programmée",
      description: 'Description',
      descriptionPlaceholder: 'Message aux copropriétaires…',
      categorie: 'Catégorie',
      priorite: 'Priorité',
      priorites: { normal: 'Normale', importante: 'Importante', urgente: 'Urgente' },
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Facultatif — tous les immeubles si vide',
      epingler: 'Épingler en haut',
      non: 'Non',
      oui: 'Oui',
      annuler: 'Annuler',
      publier: 'Publier',
    },
    erreurs: { titre: 'Le titre est obligatoire.' },
    toasts: {
      publie: 'Avis publié',
      erreurPublication: 'Erreur lors de la publication',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      publieDemo: 'Avis publié (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
