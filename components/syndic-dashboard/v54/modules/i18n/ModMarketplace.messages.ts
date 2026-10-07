import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Fiche de démonstration d'un prestataire. */
export type ProDemo = {
  nome: string
  empresa: string
  espec: string
  distrito: string
  rating: number
  avaliacoes: number
  preco: string
  resposta: string
  anos: string
  trabalhos: string
  cert: string
  destaque: boolean
}

interface MarketplaceTextes {
  titre: string
  chapeau: string
  kpi: { disponibles: string; demandes: string; favoris: string; noteMoyenne: string; noteMoyenneValeur: string }
  onglets: { pesq: string; ped: string; av: string; fav: string }
  rechercheAria: string
  recherchePlaceholder: string
  categorieAria: string
  toutesCategories: string
  zoneAria: string
  toutesZones: string
  trierAria: string
  mieuxNotes: string
  categories: string[]
  pros: ProDemo[]
  enAvant: string
  /** Note affichée (même valeur dans les deux langues, séparateur décimal de la langue). */
  note: (n: number) => string
  /** Fin du libellé « (n avis) » : le nombre et la parenthèse ouvrante restent dans le JSX. */
  avisSuffixe: string
  disponible: string
}

export const MARKETPLACE_MESSAGES = defineMessages<MarketplaceTextes>({
  'pt-PT': {
    titre: 'Marketplace de Profissionais',
    chapeau: 'Encontre prestadores certificados · Compare orçamentos · Avalie serviços',
    kpi: { disponibles: 'Profissionais disponíveis', demandes: 'Pedidos ativos', favoris: 'Favoritos', noteMoyenne: 'Avaliação média', noteMoyenneValeur: '4.7' },
    onglets: { pesq: 'Pesquisar', ped: 'Pedidos de Orçamento', av: 'Avaliações', fav: 'Favoritos' },
    rechercheAria: 'Pesquisar profissional',
    recherchePlaceholder: 'Pesquisar profissional, empresa ou especialidade…',
    categorieAria: 'Categoria',
    toutesCategories: 'Todas as categorias',
    zoneAria: 'Distrito',
    toutesZones: 'Todos os distritos',
    trierAria: 'Ordenar',
    mieuxNotes: 'Melhor avaliação',
    categories: ['Canalização', 'Eletricidade', 'Pintura', 'Serralharia', 'Elevadores', 'Limpeza', 'Paisagismo', 'Poda / Arboricultura'],
    pros: [
      { nome: 'Maria Santos', empresa: 'ElectroMaria', espec: 'Eletricidade', distrito: 'Porto', rating: 4.9, avaliacoes: 89, preco: '40€/h', resposta: '< 4h', anos: '12 anos', trabalhos: '198 trabalhos', cert: 'DGEG Eletricista Cat. IV', destaque: true },
      { nome: 'António Silva', empresa: 'CanalFix Lda', espec: 'Canalização', distrito: 'Lisboa', rating: 4.8, avaliacoes: 127, preco: '35€/h', resposta: '< 2h', anos: '15 anos', trabalhos: '342 trabalhos', cert: 'CERTIF Canalização Nível III', destaque: true },
      { nome: 'Pedro Mendes', empresa: 'ElevaPT', espec: 'Elevadores', distrito: 'Lisboa', rating: 4.7, avaliacoes: 45, preco: 'Contrato anual', resposta: '< 1h', anos: '20 anos', trabalhos: '89 trabalhos', cert: 'ASAE Elevadores · ISO 9001', destaque: true },
      { nome: 'João Costa', empresa: 'PintaCerta', espec: 'Pintura', distrito: 'Sintra', rating: 4.5, avaliacoes: 63, preco: '28€/h', resposta: '24h', anos: '8 anos', trabalhos: '156 trabalhos', cert: 'CCP Pintura Industrial', destaque: false },
    ],
    enAvant: 'DESTAQUE',
    note: (n) => String(n),
    avisSuffixe: ' avaliações)',
    disponible: '● Disponível',
  },
  'fr-FR': {
    titre: 'Annuaire des prestataires',
    chapeau: 'Trouvez des prestataires qualifiés et assurés · Comparez les devis · Évaluez les interventions',
    kpi: { disponibles: 'Prestataires disponibles', demandes: 'Demandes en cours', favoris: 'Favoris', noteMoyenne: 'Note moyenne', noteMoyenneValeur: '4,7' },
    onglets: { pesq: 'Rechercher', ped: 'Demandes de devis', av: 'Avis', fav: 'Favoris' },
    rechercheAria: 'Rechercher un prestataire',
    recherchePlaceholder: 'Rechercher un prestataire, une entreprise ou une spécialité…',
    categorieAria: 'Catégorie',
    toutesCategories: 'Toutes les catégories',
    zoneAria: 'Département',
    toutesZones: 'Tous les départements',
    trierAria: 'Trier',
    mieuxNotes: 'Mieux notés',
    categories: ['Plomberie', 'Électricité', 'Peinture', 'Serrurerie', 'Ascenseurs', 'Nettoyage', 'Espaces verts', 'Élagage / arboriculture'],
    pros: [
      { nome: 'Marie Sanchez', empresa: 'ÉlectroMarie SARL', espec: 'Électricité', distrito: 'Rhône (69)', rating: 4.9, avaliacoes: 89, preco: '40 €/h', resposta: '< 4 h', anos: '12 ans', trabalhos: '198 interventions', cert: 'Qualifelec · Garantie décennale', destaque: true },
      { nome: 'Antoine Sylvestre', empresa: 'CanalFix SARL', espec: 'Plomberie', distrito: 'Paris (75)', rating: 4.8, avaliacoes: 127, preco: '35 €/h', resposta: '< 2 h', anos: '15 ans', trabalhos: '342 interventions', cert: 'Qualibat · Garantie décennale', destaque: true },
      { nome: 'Pierre Ménard', empresa: 'ElevaSeine SAS', espec: 'Ascenseurs', distrito: 'Paris (75)', rating: 4.7, avaliacoes: 45, preco: 'Contrat annuel', resposta: '< 1 h', anos: '20 ans', trabalhos: '89 interventions', cert: 'RC professionnelle · ISO 9001', destaque: true },
      { nome: 'Jean Costes', empresa: 'Pinceau Juste SARL', espec: 'Peinture', distrito: 'Yvelines (78)', rating: 4.5, avaliacoes: 63, preco: '28 €/h', resposta: '24 h', anos: '8 ans', trabalhos: '156 interventions', cert: 'Qualibat · RC professionnelle', destaque: false },
    ],
    enAvant: 'À LA UNE',
    note: (n) => String(n).replace('.', ','),
    avisSuffixe: ' avis)',
    disponible: '● Disponible',
  },
})
