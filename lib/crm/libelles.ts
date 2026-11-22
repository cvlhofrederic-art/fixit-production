// ── CRM du secrétariat : textes de l'écran, en français et en portugais (PT-PT) ──
// Module pur. Une clé manquante dans une langue est une erreur de type (Record<LangueCrm, TextesCrm>).

import type { CanalCrm, LangueCrm, MotifCrm, PrioriteCrm, StatutCrm } from './types'

export interface TextesCrm {
  titre: string
  recherche: string
  nouvelAppel: string
  deconnexion: string
  chargement: string
  erreurChargement: string
  reessayer: string
  accesRefuse: string
  accesRefuseDetail: string
  compteurs: { aTraiter: string; enRetard: string; resolues: string }
  onglets: Record<StatutCrm | 'toutes', string>
  listeVide: string
  listeTronquee: string
  sansContact: string
  /** Fiche qui a un numéro mais pas encore de nom. */
  sansNom: string
  rappel: string
  enRetard: string
  motifs: Record<MotifCrm, string>
  canaux: Record<CanalCrm, string>
  priorites: Record<PrioriteCrm, string>
  statuts: Record<StatutCrm, string>
  fiche: {
    titre: string
    numero: string
    numeroInvalide: string
    clientConnu: (nom: string, nb: number) => string
    nouveauClient: string
    nom: string
    canal: string
    motif: string
    sujet: string
    sujetAide: string
    description: string
    rappel: string
    creer: string
    annuler: string
    creee: (numero: number) => string
    saisieIncomplete: string
    motifManquant: string
    rechercheImpossible: string
  }
  detail: {
    fermer: string
    statut: string
    priorite: string
    rappel: string
    enregistrerRappel: string
    effacerRappel: string
    historique: string
    note: string
    ajouterNote: string
    ouvrirWhatsApp: string
    appeler: string
    client: string
    modifierFiche: string
    enregistrer: string
    ville: string
    email: string
    notesClient: string
    evenements: { creation: string; statut: string; note: string; appel: string; message_entrant: string; message_sortant: string }
    enregistre: string
    numeroDejaUtilise: string
  }
  erreurServeur: string
  /** « il y a 12 min » : minutes écoulées, toujours inférieures à 24 h (formaterAnciennete). */
  ilYa: (minutes: number) => string
  /** Avant deux-points : espace insécable en français, aucune espace en portugais. */
  deuxPoints: string
  /** Abréviation de « numéro » devant le numéro d'une demande. */
  numero: string
}

const commun = {
  canauxWhatsApp: 'WhatsApp',
} as const

/** Ancienneté en minutes (moins de 24 h) : « à l'instant », puis en minutes, puis en heures. */
function anciennete(minutes: number, instant: string, phrase: (n: number, unite: 'min' | 'h') => string): string {
  if (minutes < 1) return instant
  if (minutes < 60) return phrase(minutes, 'min')
  return phrase(Math.floor(minutes / 60), 'h')
}

export const TEXTES_CRM: Record<LangueCrm, TextesCrm> = {
  fr: {
    titre: 'Vitfix CRM',
    recherche: 'Nom, numéro ou sujet',
    nouvelAppel: 'Nouvel appel',
    deconnexion: 'Se déconnecter',
    chargement: 'Chargement…',
    erreurChargement: 'Impossible de charger les demandes.',
    reessayer: 'Réessayer',
    accesRefuse: 'Accès réservé',
    accesRefuseDetail: 'Ce compte n’a pas accès au CRM. Connectez-vous avec le compte du secrétariat.',
    compteurs: { aTraiter: 'À traiter aujourd’hui', enRetard: 'En retard', resolues: 'Résolues cette semaine' },
    onglets: { nouvelle: 'Nouvelles', en_cours: 'En cours', en_attente: 'En attente', resolue: 'Résolues', toutes: 'Toutes' },
    listeVide: 'Aucune demande ici.',
    listeTronquee: 'Seules les 500 demandes les plus récentes sont affichées.',
    sansContact: 'Numéro inconnu',
    sansNom: 'Sans nom',
    rappel: 'Rappel',
    enRetard: 'En retard',
    motifs: { devis: 'Devis', urgence: 'Urgence', rdv: 'Rendez-vous', sav: 'SAV', info: 'Info', reclamation: 'Réclamation', autre: 'Autre' },
    canaux: { appel: 'Appel', appel_manque: 'Appel manqué', whatsapp: commun.canauxWhatsApp, telephone: 'Téléphone', email: 'E-mail', autre: 'Autre' },
    priorites: { normale: 'Normale', urgente: 'Urgente' },
    statuts: { nouvelle: 'Nouvelle', en_cours: 'En cours', en_attente: 'En attente', resolue: 'Résolue' },
    fiche: {
      titre: 'Appel en cours',
      numero: 'Numéro',
      numeroInvalide: 'Numéro non reconnu (exemple : +351 912 345 678).',
      clientConnu: (nom, nb) => `Client connu : ${nom || 'sans nom'} · ${nb} demande${nb > 1 ? 's' : ''}`,
      nouveauClient: 'Nouveau client',
      nom: 'Nom du client',
      canal: 'Canal',
      motif: 'Motif',
      sujet: 'Sujet',
      sujetAide: 'Facultatif : sinon, la première ligne de la description.',
      description: 'Ce que dit le client',
      rappel: 'Rappeler le',
      creer: 'Créer la demande',
      annuler: 'Annuler',
      creee: (numero) => `Demande n° ${numero} créée`,
      saisieIncomplete: 'Indiquez un sujet ou une description.',
      motifManquant: 'Choisissez un motif.',
      rechercheImpossible: 'Recherche du numéro impossible : la fiche sera retrouvée à l’enregistrement.',
    },
    detail: {
      fermer: 'Fermer',
      statut: 'Statut',
      priorite: 'Priorité',
      rappel: 'Rappel',
      enregistrerRappel: 'Enregistrer',
      effacerRappel: 'Effacer',
      historique: 'Historique',
      note: 'Ajouter une note',
      ajouterNote: 'Ajouter',
      ouvrirWhatsApp: 'Ouvrir dans WhatsApp',
      appeler: 'Appeler',
      client: 'Client',
      modifierFiche: 'Modifier la fiche',
      enregistrer: 'Enregistrer',
      ville: 'Ville',
      email: 'E-mail',
      notesClient: 'Notes sur le client',
      evenements: {
        creation: 'Demande créée',
        statut: 'Statut changé',
        note: 'Note',
        appel: 'Appel',
        message_entrant: 'Message reçu',
        message_sortant: 'Message envoyé',
      },
      enregistre: 'Enregistré',
      numeroDejaUtilise: 'Ce numéro a déjà une fiche.',
    },
    erreurServeur: 'L’enregistrement a échoué. Réessayez.',
    ilYa: (minutes) => anciennete(minutes, 'à l’instant', (n, unite) => `il y a ${n} ${unite}`),
    deuxPoints: '\u00a0: ',
    numero: 'n°',
  },
  pt: {
    titre: 'Vitfix CRM',
    recherche: 'Nome, número ou assunto',
    nouvelAppel: 'Nova chamada',
    deconnexion: 'Terminar sessão',
    chargement: 'A carregar…',
    erreurChargement: 'Não foi possível carregar os pedidos.',
    reessayer: 'Tentar de novo',
    accesRefuse: 'Acesso reservado',
    accesRefuseDetail: 'Esta conta não tem acesso ao CRM. Inicie sessão com a conta do secretariado.',
    compteurs: { aTraiter: 'Por tratar hoje', enRetard: 'Em atraso', resolues: 'Resolvidos esta semana' },
    onglets: { nouvelle: 'Novos', en_cours: 'Em curso', en_attente: 'Em espera', resolue: 'Resolvidos', toutes: 'Todos' },
    listeVide: 'Nenhum pedido aqui.',
    listeTronquee: 'Só são mostrados os 500 pedidos mais recentes.',
    sansContact: 'Número desconhecido',
    sansNom: 'Sem nome',
    rappel: 'Lembrete',
    enRetard: 'Em atraso',
    motifs: { devis: 'Orçamento', urgence: 'Urgência', rdv: 'Marcação', sav: 'Pós-venda', info: 'Informação', reclamation: 'Reclamação', autre: 'Outro' },
    canaux: { appel: 'Chamada', appel_manque: 'Chamada perdida', whatsapp: commun.canauxWhatsApp, telephone: 'Telefone', email: 'E-mail', autre: 'Outro' },
    priorites: { normale: 'Normal', urgente: 'Urgente' },
    statuts: { nouvelle: 'Novo', en_cours: 'Em curso', en_attente: 'Em espera', resolue: 'Resolvido' },
    fiche: {
      titre: 'Chamada em curso',
      numero: 'Número',
      numeroInvalide: 'Número não reconhecido (exemplo: +351 912 345 678).',
      clientConnu: (nom, nb) => `Cliente conhecido: ${nom || 'sem nome'} · ${nb} pedido${nb > 1 ? 's' : ''}`,
      nouveauClient: 'Cliente novo',
      nom: 'Nome do cliente',
      canal: 'Canal',
      motif: 'Motivo',
      sujet: 'Assunto',
      sujetAide: 'Opcional: senão, a primeira linha da descrição.',
      description: 'O que o cliente diz',
      rappel: 'Ligar de volta em',
      creer: 'Criar pedido',
      annuler: 'Cancelar',
      creee: (numero) => `Pedido n.º ${numero} criado`,
      saisieIncomplete: 'Indique um assunto ou uma descrição.',
      motifManquant: 'Escolha um motivo.',
      rechercheImpossible: 'Não foi possível procurar o número: a ficha será encontrada ao guardar.',
    },
    detail: {
      fermer: 'Fechar',
      statut: 'Estado',
      priorite: 'Prioridade',
      rappel: 'Lembrete',
      enregistrerRappel: 'Guardar',
      effacerRappel: 'Apagar',
      historique: 'Histórico',
      note: 'Adicionar uma nota',
      ajouterNote: 'Adicionar',
      ouvrirWhatsApp: 'Abrir no WhatsApp',
      appeler: 'Ligar',
      client: 'Cliente',
      modifierFiche: 'Editar ficha',
      enregistrer: 'Guardar',
      ville: 'Localidade',
      email: 'E-mail',
      notesClient: 'Notas sobre o cliente',
      evenements: {
        creation: 'Pedido criado',
        statut: 'Estado alterado',
        note: 'Nota',
        appel: 'Chamada',
        message_entrant: 'Mensagem recebida',
        message_sortant: 'Mensagem enviada',
      },
      enregistre: 'Guardado',
      numeroDejaUtilise: 'Este número já tem uma ficha.',
    },
    erreurServeur: 'Não foi possível guardar. Tente de novo.',
    ilYa: (minutes) => anciennete(minutes, 'agora mesmo', (n, unite) => `há ${n} ${unite}`),
    deuxPoints: ': ',
    numero: 'n.º',
  },
}

/**
 * Date et heure courtes dans la langue de l'écran, à l'heure du navigateur : la même que celle du champ « Rappeler le »
 * (datetime-local), pour qu'un rappel saisi à 10:00 se lise 10:00 partout, au Portugal comme en France.
 */
export function formaterDateHeure(iso: string, langue: LangueCrm): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleString(langue === 'pt' ? 'pt-PT' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** « il y a 12 min » jusqu'à 24 h, puis la date. */
export function formaterAnciennete(iso: string, langue: LangueCrm, maintenant: Date): string {
  const ecart = maintenant.getTime() - Date.parse(iso)
  if (!Number.isFinite(ecart)) return ''
  const minutes = Math.floor(ecart / 60_000)
  if (minutes < 24 * 60) return TEXTES_CRM[langue].ilYa(Math.max(0, minutes))
  return formaterDateHeure(iso, langue)
}
