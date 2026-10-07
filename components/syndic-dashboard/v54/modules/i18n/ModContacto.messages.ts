import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Codes de type de campagne (valeurs envoyées à /api/syndic/campanhas). */
type TypeCampagne = 'cobranca' | 'aviso' | 'relatorio' | 'personalizada'
/** Codes de statut de campagne (valeurs de l'API). */
type EtatCampagne = 'rascunho' | 'agendada' | 'enviada'

/** Textes de l'écran « Contacto Proativo IA » / « Contact proactif IA ». */
interface ContactoTextes {
  titre: string
  chapeau: string
  nouvelleCampagne: string
  kpi: { creees: string; envoyees: string; destinataires: string; messages: string }
  onglets: { camp: string; mod: string; hist: string; cfg: string }
  vide: { titre: string; texte: string }
  colonnes: { campagne: string; type: string; immeuble: string; destinataires: string; statut: string }
  /** Type affiché dans le tableau : en PT la valeur brute de l'API (comportement d'origine), en FR son libellé. */
  typeTableau: (code: string) => string
  etats: Record<EtatCampagne, string>
  formulaire: {
    titre: string
    nom: string
    nomPlaceholder: string
    type: string
    types: Record<TypeCampagne, string>
    immeuble: string
    immeublePlaceholder: string
    destinataires: string
    destinatairesAide: string
    statut: string
    message: string
    messagePlaceholder: string
    annuler: string
    creer: string
  }
  erreurNom: string
  toastCreee: string
}

const TYPES_FR: Record<TypeCampagne, string> = {
  cobranca: "Relance d'impayés",
  aviso: 'Avis',
  relatorio: 'Compte rendu',
  personalizada: 'Personnalisée',
}

export const CONTACTO_MESSAGES = defineMessages<ContactoTextes>({
  'pt-PT': {
    titre: 'Contacto Proativo IA',
    chapeau: 'Comunicação automática e personalizada com condóminos — cobranças, avisos, relatórios',
    nouvelleCampagne: '+ Nova Campanha',
    kpi: { creees: 'Campanhas Criadas', envoyees: 'Enviadas', destinataires: 'Total Destinatários', messages: 'Mensagens Enviadas' },
    onglets: { camp: 'Campanhas', mod: 'Modelos IA', hist: 'Histórico', cfg: 'Configuração' },
    vide: { titre: 'Sem campanhas', texte: 'Crie a sua primeira campanha proativa para contactar condóminos automaticamente' },
    colonnes: { campagne: 'Campanha', type: 'Tipo', immeuble: 'Edifício', destinataires: 'Destinatários', statut: 'Estado' },
    typeTableau: (code) => code,
    etats: { rascunho: 'Rascunho', agendada: 'Agendada', enviada: 'Enviada' },
    formulaire: {
      titre: 'Nova campanha',
      nom: 'Nome da campanha',
      nomPlaceholder: 'Ex.: Aviso obras fachada — junho',
      type: 'Tipo',
      types: { cobranca: 'Cobrança', aviso: 'Aviso', relatorio: 'Relatório', personalizada: 'Personalizada' },
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício / todos…',
      destinataires: 'Destinatários',
      destinatairesAide: 'Número de condóminos',
      statut: 'Estado',
      message: 'Mensagem',
      messagePlaceholder: 'Conteúdo da comunicação…',
      annuler: 'Cancelar',
      creer: 'Criar campanha',
    },
    erreurNom: 'Indique o nome da campanha.',
    toastCreee: 'Campanha criada',
  },
  'fr-FR': {
    titre: 'Contact proactif IA',
    chapeau: "Communication automatique et personnalisée avec les copropriétaires — relances d'impayés, avis, comptes rendus",
    nouvelleCampagne: '+ Nouvelle campagne',
    kpi: { creees: 'Campagnes créées', envoyees: 'Envoyées', destinataires: 'Total des destinataires', messages: 'Messages envoyés' },
    onglets: { camp: 'Campagnes', mod: 'Modèles IA', hist: 'Historique', cfg: 'Configuration' },
    vide: { titre: 'Aucune campagne', texte: 'Créez votre première campagne proactive pour contacter automatiquement les copropriétaires' },
    colonnes: { campagne: 'Campagne', type: 'Type', immeuble: 'Immeuble', destinataires: 'Destinataires', statut: 'Statut' },
    typeTableau: (code) => (Object.prototype.hasOwnProperty.call(TYPES_FR, code) ? TYPES_FR[code as TypeCampagne] : code),
    etats: { rascunho: 'Brouillon', agendada: 'Programmée', enviada: 'Envoyée' },
    formulaire: {
      titre: 'Nouvelle campagne',
      nom: 'Nom de la campagne',
      nomPlaceholder: 'Ex. : Avis de travaux de façade — juin',
      type: 'Type',
      types: TYPES_FR,
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble / tous…',
      destinataires: 'Destinataires',
      destinatairesAide: 'Nombre de copropriétaires',
      statut: 'Statut',
      message: 'Message',
      messagePlaceholder: 'Contenu de la communication…',
      annuler: 'Annuler',
      creer: 'Créer la campagne',
    },
    erreurNom: 'Indiquez le nom de la campagne.',
    toastCreee: 'Campagne créée',
  },
})
