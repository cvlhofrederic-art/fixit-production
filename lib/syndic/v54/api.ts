import type { Mission, Immeuble, Artisan, TeamMember } from '@/components/syndic-dashboard/types'
import { V54_LOCALE_PAR_DEFAUT, type V54Locale } from '@/lib/syndic/v54/i18n/locale'
import type { Locale as AgentLocale } from '@/lib/syndic/agent-types'

/**
 * Fetchers typés du dashboard syndic v54 (Phase 2) — réutilisent les routes
 * /api/syndic/* existantes (auth Bearer + filtrage cabinet RLS + mapping
 * snake_case→camelCase déjà faits côté serveur). On ne réécrit pas la couche
 * data : on la consomme.
 */

async function getList<T>(path: string, token: string, key: string): Promise<T[]> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  const json: unknown = await res.json()
  const list = (json as Record<string, unknown>)?.[key]
  return Array.isArray(list) ? (list as T[]) : []
}

export const fetchMissions = (token: string): Promise<Mission[]> =>
  getList<Mission>('/api/syndic/missions', token, 'missions')

export const fetchImmeubles = (token: string): Promise<Immeuble[]> =>
  getList<Immeuble>('/api/syndic/immeubles', token, 'immeubles')

/**
 * Artisan v54 (camelCase). GET /api/syndic/artisans renvoie les colonnes Supabase brutes
 * (vitfix_certifie, rc_pro_valide, nb_interventions…) : sans conversion, les modules qui lisent
 * rcProValide / vitfixCertifie voyaient tous les prestataires sans RC valide et non certifiés.
 *
 * `nom` est le nom affiché complet : POST /api/syndic/artisans enregistre `nom` = « Prénom Nom »
 * à côté de ses composantes `prenom` et `nom_famille`. Les modules l'affichent tel quel, sans lui
 * rajouter le prénom (sinon « João João Silva »). Colonne vide : composé de `prenom` et
 * `nom_famille`, même règle que l'ancien tableau de bord (ArtisansPageSection).
 */
export function normaliserArtisan(a: Artisan): Artisan {
  return {
    ...a,
    nom: a.nom || `${a.prenom || ''} ${a.nom_famille || ''}`.trim(),
    rcProValide: a.rcProValide ?? a.rc_pro_valide ?? false,
    rcProExpiration: a.rcProExpiration ?? a.rc_pro_expiration ?? '',
    decennaleValide: a.decennaleValide ?? a.assurance_decennale_valide ?? false,
    decennaleExpiration: a.decennaleExpiration ?? a.assurance_decennale_expiration ?? '',
    nbInterventions: a.nbInterventions ?? a.nb_interventions ?? 0,
    vitfixCertifie: a.vitfixCertifie ?? a.vitfix_certifie ?? false,
  }
}

export const fetchArtisans = async (token: string): Promise<Artisan[]> =>
  (await getList<Artisan>('/api/syndic/artisans', token, 'artisans')).map(normaliserArtisan)

/**
 * Copropriétaire/lot — forme v54 (camelCase). La route /api/syndic/coproprios
 * renvoie le brut Supabase en snake_case (`select('*')`), donc on mappe ici.
 */
export interface Coprop {
  id: string
  immeuble: string
  batiment: string
  etage: number
  numeroPorte: string
  proprietario: string
  email: string
  telefone: string
  ocupado: boolean
  /** Permilagem (tantième). Optionnel : consommateurs `?? 0`. */
  tantieme?: number
  /** Solde du condómino. Convention (ancien dashboard) : < 0 = doit/em dívida. */
  solde?: number
  /** Accès au portail condómino activé. */
  acessoPortal?: boolean
}

function rowToCoprop(r: Record<string, unknown>): Coprop {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0)
  return {
    id: s('id'),
    immeuble: s('immeuble'),
    batiment: s('batiment'),
    etage: typeof r['etage'] === 'number' ? (r['etage'] as number) : 0,
    numeroPorte: s('numero_porte'),
    proprietario: [s('prenom_proprietaire'), s('nom_proprietaire')].filter(Boolean).join(' ').trim(),
    email: s('email_proprietaire'),
    telefone: s('tel_proprietaire'),
    ocupado: r['est_occupe'] === true,
    tantieme: n('tantieme'),
    solde: n('solde'),
    acessoPortal: r['acces_portail'] === true,
  }
}

export async function fetchCoproprios(token: string): Promise<Coprop[]> {
  const res = await fetch('/api/syndic/coproprios', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`/api/syndic/coproprios → HTTP ${res.status}`)
  const json: unknown = await res.json()
  const list = (json as Record<string, unknown>)?.coproprios
  return Array.isArray(list) ? list.map((r) => rowToCoprop(r as Record<string, unknown>)) : []
}

/** Équipe du cabinet — TeamMember correspond déjà aux colonnes DB (full_name, is_active…). */
export const fetchTeam = (token: string): Promise<TeamMember[]> =>
  getList<TeamMember>('/api/syndic/team', token, 'members')

/** Contrat prestataire (Phase 3 — ModContratos). camelCase renvoyé par l'API. */
export interface Contrato {
  id: string
  immeuble: string
  fornecedor: string
  /** limpezas | elevadores | seguranca | jardinagem | outros */
  categoria: string
  custoMensal: number
  custoAnual: number
  dataInicio: string
  dataFim: string
  /** ativo | expirado | renovacao */
  statut: string
  notes: string
}

export const fetchContratos = (token: string): Promise<Contrato[]> =>
  getList<Contrato>('/api/syndic/contratos', token, 'contratos')

/** Apólice de seguro (Phase 3 — ModSeguros). camelCase renvoyé par l'API. */
export interface Seguro {
  id: string
  immeuble: string
  seguradora: string
  /** multirriscos | responsabilidade_civil | incendio | outros */
  tipo: string
  apolice: string
  premioAnual: number
  capital: number
  dataInicio: string
  dataFim: string
  /** ativa | expirada | renovacao */
  statut: string
  notes: string
}

export const fetchSeguros = (token: string): Promise<Seguro[]> =>
  getList<Seguro>('/api/syndic/seguros', token, 'seguros')

/**
 * Ocorrência / signalement (Phase 3 — ModOcorrencias). Lecture de la table
 * existante via /api/syndic/signalements (déjà mappée camelCase côté serveur).
 * Les occurrences proviennent des condóminos → module en lecture (KPIs + liste).
 */
export interface Signalement {
  id: string
  immeuble: string
  demandeurNom: string
  typeIntervention: string
  description: string
  /** Copropriétaire : urgente | normale | planifiee (anciennes lignes : basse | haute possibles). */
  priorite: string
  /** en_attente | acceptee | en_cours | terminee | annulee */
  statut: string
  /** Champs renvoyés par GET /api/syndic/signalements (optionnels : mocks et anciens consommateurs). */
  demandeurRole?: string
  demandeurEmail?: string
  demandeurTelephone?: string
  batiment?: string
  etage?: string
  numLot?: string
  estPartieCommune?: boolean
  zoneSignalee?: string
  /** Nom du prestataire à qui la demande a été confiée. */
  artisanAssigne?: string
  createdAt?: string
  updatedAt?: string
  /**
   * Provenance de la demande (colonne `origine`, migration 20261017) : 'portail' = déposée par un compte
   * rattaché à sa fiche (identité vérifiée) ; 'public' = formulaire sans compte / QR code (e-mail non
   * vérifié) ; null ou absent = inconnue (colonne pas encore en base).
   */
  origine?: 'portail' | 'public' | null
  /** Fil d'échanges avec le copropriétaire (syndic_signalement_messages). */
  messages?: SignalementMessage[]
}

export interface SignalementMessage {
  id: string
  auteur: string
  role: string
  texte: string
  createdAt: string
}

export const fetchSignalements = (token: string): Promise<Signalement[]> =>
  getList<Signalement>('/api/syndic/signalements', token, 'signalements')

// ── Canal de communication (ModCanal, données réelles) ────────────────────────

/** Erreur d'une route syndic : `code` = champ `error` de la réponse (ex. 'prestataire_sans_compte'). */
export class ErreurApiSyndic extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'ErreurApiSyndic'
  }
}

async function envoyerJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ErreurApiSyndic(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`, res.status)
  return json as T
}

/** Résultat de « Valider la mission » : notification = ordre de mission + notification in-app livrés. */
export interface ResultatValidationDemande {
  mission_id: string
  conversation_id: string | null
  notification: boolean
}

/** Confie un signalement à un prestataire du cabinet (ligne syndic_artisans avec compte Vitfix). */
export const validerDemande = (
  token: string,
  body: { signalement_id: string; syndic_artisan_id: string; date_intervention?: string; note?: string },
): Promise<ResultatValidationDemande> => envoyerJson('/api/syndic/demandes/valider', token, body)

/** Réponse du syndic dans le fil d'un signalement (visible par le copropriétaire). */
export const envoyerMessageSignalement = (token: string, signalementId: string, texte: string, auteur = 'Syndic'): Promise<{ message: unknown }> =>
  envoyerJson('/api/syndic/signalements', token, { signalementId, texte, auteur, role: 'syndic' })

export type CoteMessageCanal = 'donneur_ordre' | 'artisan'
export type StatutOrdreCanal = 'en_attente' | 'accepte' | 'refuse' | 'en_cours' | 'termine'

export interface OrdreMissionCanal {
  titre: string
  adresse: string
  /** AAAA-MM-JJ */
  dateSouhaitee: string
  description: string
  urgence: string
  statut: StatutOrdreCanal
  heureArrivee: string
  signalementId: string
  syndicMissionId: string
}

export interface DocumentCanal {
  type: 'devis' | 'rapport' | 'facture'
  reference: string
  montant_ttc?: number
  description: string
  date: string
}

export interface MessageCanalPro {
  id: string
  /** text | ordre_mission | system | photo | voice */
  type: string
  contenu: string
  creeLe: string
  cote: CoteMessageCanal
  ordreMission: OrdreMissionCanal | null
  document: DocumentCanal | null
}

export interface ConversationCanalPro {
  id: string
  artisanUserId: string
  prestataire: { nom: string; metier: string }
  derniereActivite: string | null
  apercu: string
  /** Dernier ordre de mission de la conversation (statut courant). */
  ordre: (OrdreMissionCanal & { messageId: string }) | null
  messages: MessageCanalPro[]
}

/** Conversations prestataires du cabinet (GET /api/syndic/canal-pro), jamais servies du cache. */
export const fetchCanalPro = (token: string): Promise<ConversationCanalPro[]> =>
  getList<ConversationCanalPro>('/api/syndic/canal-pro', token, 'conversations')

export const envoyerMessageCanalPro = async (token: string, conversationId: string, content: string): Promise<MessageCanalPro> =>
  (await envoyerJson<{ message: MessageCanalPro }>('/api/syndic/canal-pro', token, { conversation_id: conversationId, content })).message

/** Message du canal interne du cabinet (GET/POST /api/syndic/canal-interne). */
export interface MessageInterne {
  id: string
  auteur: string
  auteurRole: string
  texte: string
  heure: string
  lu: boolean
  sujet: string
  createdAt: string
}

export const fetchCanalInterne = (token: string): Promise<MessageInterne[]> =>
  getList<MessageInterne>('/api/syndic/canal-interne', token, 'messages')

export const envoyerMessageInterne = async (token: string, texte: string, auteur?: string): Promise<MessageInterne> =>
  (await envoyerJson<{ message: MessageInterne }>('/api/syndic/canal-interne', token, { texte, ...(auteur ? { auteur } : {}) })).message

/** Ascenseur (Phase 3 — ModElevadores). camelCase renvoyé par l'API. */
export interface Elevador {
  id: string
  immeuble: string
  marca: string
  /** comercial | misto | habitacional */
  categoria: string
  ema: string
  ultimaInspecao: string
  proximaInspecao: string
  /** conforme | prazo | atraso */
  estado: string
  notes: string
}

export const fetchElevadores = (token: string): Promise<Elevador[]> =>
  getList<Elevador>('/api/syndic/elevadores', token, 'elevadores')

/** Sinistre assurance (Phase 3 — ModSinistros). camelCase renvoyé par l'API. */
export interface Sinistro {
  id: string
  immeuble: string
  tipo: string
  descricao: string
  seguradora: string
  /** declarado | atribuido | peritagem | resolucao | indemnizado | encerrado */
  statut: string
  montanteEstimado: number
  indemnizacao: number
  dataDeclaracao: string
  urgente: boolean
  notes: string
}

export const fetchSinistros = (token: string): Promise<Sinistro[]> =>
  getList<Sinistro>('/api/syndic/sinistros', token, 'sinistros')

/** Vistoria technique (Phase 3 — ModVistoria). camelCase renvoyé par l'API. */
export interface Vistoria {
  id: string
  immeuble: string
  titulo: string
  /** em_curso | concluida | enviada */
  statut: string
  pontosVigiar: number
  pontosDeficientes: number
  dataVistoria: string
  notes: string
}

export const fetchVistorias = (token: string): Promise<Vistoria[]> =>
  getList<Vistoria>('/api/syndic/vistorias', token, 'vistorias')

/** Obligation légale / échéance (Phase 3 — ModPrazosLegais). camelCase. */
export interface PrazoLegal {
  id: string
  immeuble: string
  titulo: string
  tipo: string
  dataLimite: string
  /** pendente | realizado */
  statut: string
  notes: string
}

export const fetchPrazos = (token: string): Promise<PrazoLegal[]> =>
  getList<PrazoLegal>('/api/syndic/prazos', token, 'prazos')

/** Aviso / annonce quadro (Phase 3 — ModQuadroAvisos). camelCase. */
export interface Aviso {
  id: string
  immeuble: string
  titulo: string
  descricao: string
  /** manutencao | assembleia | financeiro | seguranca | social | outro */
  categoria: string
  /** normal | importante | urgente */
  prioridade: string
  fixado: boolean
  views: number
  createdAt: string
}

export const fetchAvisos = (token: string): Promise<Aviso[]> =>
  getList<Aviso>('/api/syndic/avisos', token, 'avisos')

/** Reembolso pro-rata (Phase 3 — ModReembolsos). camelCase renvoyé par l'API. */
export interface Reembolso {
  id: string
  immeuble: string
  antigoProprietario: string
  fracao: string
  dataVenda: string
  quotasPagas: number
  montanteReembolso: number
  metodo: string
  /** pendente | liquidado | bloqueado */
  statut: string
  notes: string
}

export const fetchReembolsos = (token: string): Promise<Reembolso[]> =>
  getList<Reembolso>('/api/syndic/reembolsos', token, 'reembolsos')

/** Procuration AG (Phase 3 — ModProcuracoes). camelCase renvoyé par l'API. */
export interface Procuracao {
  id: string
  immeuble: string
  condomino: string
  procurador: string
  fracao: string
  dataValidade: string
  agRef: string
  /** valida | expirada */
  statut: string
  notes: string
}

export const fetchProcuracoes = (token: string): Promise<Procuracao[]> =>
  getList<Procuracao>('/api/syndic/procuracoes', token, 'procuracoes')

/** Sécurité incendie / SCIE (Phase 3 — ModSegEdificio). camelCase. */
export interface SegEdificio {
  id: string
  immeuble: string
  /** 1 | 2 | 3 | 4 (catégorie de risque RT-SCIE) */
  categoria: string
  encarregado: string
  planoEmergencia: boolean
  ultimoExercicio: string
  notes: string
}

export const fetchSegEdificio = (token: string): Promise<SegEdificio[]> =>
  getList<SegEdificio>('/api/syndic/seg-edificio', token, 'segEdificios')

/** Intervention de la caderneta de manutenção (Phase 3 — ModCadernetaMan). camelCase. */
export interface Caderneta {
  id: string
  data: string
  /** realizado | planeado | em-curso | cancelado */
  estado: string
  /** manutencao-corrente | reparacao | diagnostico | obra-conservacao | obra-beneficiacao | inspeccao-legal */
  natureza: string
  edificio: string
  localizacao: string
  prestador: string
  custo: number
  garantia: string
  /** na | A+ | A | B | B- | C | D | E | F */
  cee: string
  notas: string
}

export const fetchCaderneta = (token: string): Promise<Caderneta[]> =>
  getList<Caderneta>('/api/syndic/caderneta', token, 'caderneta')

/** Certificat énergétique SCE (Phase 3 — ModCertEnerg). camelCase renvoyé par l'API. */
export interface CertEnergetico {
  id: string
  numero: string
  edificio: string
  perito: string
  /** A+ | A | B | B- | C | D | E | F */
  classe: string
  dataEmissao: string
  dataValidade: string
  notas: string
}

export const fetchCertEnerg = (token: string): Promise<CertEnergetico[]> =>
  getList<CertEnergetico>('/api/syndic/cert-energ', token, 'certificados')

/** Déclaration d'encargos (Phase 3 — ModDeclEncargos, Lei 8/2022). camelCase. */
export interface DeclEncargo {
  id: string
  fracao: string
  condomino: string
  edificio: string
  dataPedido: string
  prazoLimite: string
  encargosCorrentes: number
  divida: number
  /** pendente | emitida | concluida */
  estado: string
  notas: string
}

export const fetchDeclEncargos = (token: string): Promise<DeclEncargo[]> =>
  getList<DeclEncargo>('/api/syndic/decl-encargos', token, 'declaracoes')

/** Édifice configuré au FCR (Phase 3 — ModFCR). camelCase renvoyé par l'API. */
export interface FcrEdificio {
  id: string
  nome: string
  endereco: string
  orcamentoAnual: number
  percentagemFCR: number
  saldoInicial: number
}

/** Mouvement FCR (Phase 3 — ModFCR). camelCase renvoyé par l'API. */
export interface FcrMovimento {
  id: string
  edificio: string
  /** entrada | saida */
  tipo: string
  data: string
  montante: number
  descricao: string
}

export const fetchFcrEdificios = (token: string): Promise<FcrEdificio[]> =>
  getList<FcrEdificio>('/api/syndic/fcr-edificios', token, 'edificios')

export const fetchFcrMovimentos = (token: string): Promise<FcrMovimento[]> =>
  getList<FcrMovimento>('/api/syndic/fcr-movimentos', token, 'movimentos')

/** Assemblée générale v54 (Phase 3 — ModAGDigit). Réutilise syndic_assemblees (route /api/syndic/ag-v54, mapping PT↔FR côté serveur). */
export interface AgV54 {
  id: string
  titulo: string
  edificio: string
  dataHora: string
  /** ordinaria | extraordinaria | urgente */
  tipo: string
  local: string
  quorum: number
  milesimos: number
  ordem: string
  /** em-curso | encerrada */
  estado: string
}

export const fetchAgV54 = (token: string): Promise<AgV54[]> =>
  getList<AgV54>('/api/syndic/ag-v54', token, 'assembleias')

/** Contabilidade Condomínio (Phase 3 — ModContabCond) — 4 entités, route consolidée /api/syndic/contab. */
export interface ContabFracao { id: string; identificacao: string; permilagem: number; proprietario: string; tipo: string; notas: string }
export interface ContabChamada { id: string; titulo: string; edificio: string; dataEmissao: string; dataVencimento: string; montante: number; distribuicao: string; notas: string; liquidadas: number }
export interface ContabDiario { id: string; data: string; tipo: string; conta: string; montante: number; descricao: string }
export interface ContabOrcamento { id: string; ano: string; edificio: string; totalPrevisto: number; rubricas: string; notas: string; aprovado: boolean }
export interface ContabData { fracoes: ContabFracao[]; chamadas: ContabChamada[]; diario: ContabDiario[]; orcamentos: ContabOrcamento[] }

export async function fetchContab(token: string): Promise<ContabData> {
  const res = await fetch('/api/syndic/contab', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`/api/syndic/contab → HTTP ${res.status}`)
  const j = (await res.json()) as Partial<ContabData>
  return { fracoes: j.fracoes ?? [], chamadas: j.chamadas ?? [], diario: j.diario ?? [], orcamentos: j.orcamentos ?? [] }
}

/** Impayé (Phase 3 — ModCobrAuto, table syndic_impayes relationnelle). camelCase. */
export interface Impaye {
  id: string
  immeubleId: string
  coproprioId: string
  montant: number
  /** charges_courantes | travaux | fonds_reserve | interets_retard | frais_relance | autre */
  nature: string
  depuis: string
  derniereRelanceAt: string
  nbRelances: number
  /** ouvert | en_recouvrement | solde | passe_perte */
  statut: string
  notes: string
}

export const fetchImpayes = (token: string): Promise<Impaye[]> =>
  getList<Impaye>('/api/syndic/impayes', token, 'impayes')

/** Procédure de recouvrement (Phase 3 — ModCobrJud, table syndic_recouvrement). camelCase. */
export interface Recouvrement {
  id: string
  immeubleId: string
  coproprioId: string
  impayeId: string
  /** amiable | mise_en_demeure | huissier | tribunal | saisie | accord_paiement */
  procedure: string
  /** en_cours | suspendu | cloture_succes | cloture_echec */
  statut: string
  montantInitial: number
  montantRecouvre: number
  dateOuverture: string
  dateCloture: string
  avocatHuissier: string
  prochaineEcheance: string
  notes: string
}

export const fetchRecouvrement = (token: string): Promise<Recouvrement[]> =>
  getList<Recouvrement>('/api/syndic/recouvrement', token, 'recouvrements')

/** Facture condomínio (Phase 3 — ModFaturacao, table syndic_factures_copro). camelCase. */
export interface FaturaCopro {
  id: string
  coproprioId: string
  immeubleId: string
  numeroFatura: string
  emiseLe: string
  echeance: string
  montantHt: number
  tvaTaux: number
  montantTtc: number
  description: string
  /** a_regler | partiellement_regle | reglee | contestee | annulee */
  statut: string
  pdfUrl: string
}

export const fetchFaturas = (token: string): Promise<FaturaCopro[]> =>
  getList<FaturaCopro>('/api/syndic/factures-copro', token, 'faturas')

/** Endpoints des 5 agents IA syndic (route id → API). */
const AGENT_ENDPOINTS: Record<string, string> = {
  fixy: '/api/syndic/fixy-syndic',
  max: '/api/syndic/max-ai',
  lea: '/api/syndic/lea-comptable',
  alfredo: '/api/syndic/alfredo-chat',
  tempo: '/api/syndic/tempo-ai',
}

/** Message de l'historique de conversation transmis à un agent. */
export interface MessageHistorique {
  role: 'user' | 'assistant'
  content: string
}

/** Historique envoyé : 20 derniers messages, 3000 caractères chacun au plus. */
const HISTORIQUE_MAX_MESSAGES = 20
const HISTORIQUE_MAX_CARACTERES = 3000

/** Tronque sans couper une paire de substitution UTF-16 (emoji) en deux. */
function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte
  const coupe = texte.slice(0, max)
  return /[\uD800-\uDBFF]$/.test(coupe) ? coupe.slice(0, -1) : coupe
}

/**
 * Envoie un message à un agent IA syndic et retourne sa réponse texte.
 * Réponse : clé `response` (fixy/max/lea/tempo) ou `content` (alfredo).
 * Ne modifie aucun prompt (conforme ai-agents.md) — pur câblage UI → endpoint.
 * `locale` : langue du dashboard, toujours transmise à l'agent ('fr' ou 'pt').
 * Les 5 routes prennent le français quand la langue manque : sans 'pt', la
 * version portugaise recevait des réponses en français (prompt, corpus juridique
 * de Max et documents de Léa français). Défaut : portugais, langue du dashboard.
 * `historique` : messages précédents de la conversation, envoyés sous
 * `conversation_history` (nom lu par les 5 routes). Rôles user/assistant
 * uniquement (Max refuse tout autre rôle), contenus non vides, bornés pour
 * rester sous les limites des schémas (Max : 50 messages de 10 000 caractères,
 * Alfredo : 60 messages). Omis quand il est vide : corps inchangé.
 */
export async function askAgent(
  route: string,
  message: string,
  token: string,
  locale: V54Locale = V54_LOCALE_PAR_DEFAUT,
  historique: readonly MessageHistorique[] = [],
): Promise<string> {
  return (await askAgentDetaille(route, message, token, locale, historique)).texte
}

/** Réponse complète d'un agent : texte et, pour Fixy, action proposée (balise ##ACTION## extraite par la route). */
export interface ReponseAgentDetaillee {
  texte: string
  action: Record<string, unknown> | null
}

/** Comme askAgent, avec l'action proposée par l'agent (Fixy) à faire confirmer par l'utilisateur. */
export async function askAgentDetaille(
  route: string,
  message: string,
  token: string,
  locale: V54Locale = V54_LOCALE_PAR_DEFAUT,
  historique: readonly MessageHistorique[] = [],
): Promise<ReponseAgentDetaillee> {
  const francais = locale === 'fr-FR'
  const langueAgent: AgentLocale = francais ? 'fr' : 'pt'
  const endpoint = AGENT_ENDPOINTS[route]
  if (!endpoint) throw new Error(`Agent inconnu: ${route}`)
  const conversationHistory = historique
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-HISTORIQUE_MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: tronquer(m.content, HISTORIQUE_MAX_CARACTERES) }))
  const corps = conversationHistory.length
    ? { message, locale: langueAgent, conversation_history: conversationHistory }
    : { message, locale: langueAgent }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corps),
  })
  if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}`)
  const j = (await res.json()) as Record<string, unknown>
  // Texte de secours d'une IA injoignable (HTTP 200, ex. Fixy « service surchargé ») : traité comme une erreur,
  // pour que l'écran affiche son message d'erreur et qu'il ne reparte pas dans l'historique comme une réponse.
  if (j.fallback === true && typeof j.error === 'string') throw new Error(`${endpoint} → ${j.error}`)
  const text = typeof j.response === 'string' ? j.response : typeof j.content === 'string' ? j.content : ''
  const action = j.action && typeof j.action === 'object' && typeof (j.action as Record<string, unknown>).type === 'string'
    ? (j.action as Record<string, unknown>)
    : null
  return { texte: text || (francais ? 'Pas de réponse.' : 'Sem resposta.'), action }
}

/** Actions de Fixy exécutables par POST /api/syndic/fixy-syndic/execute-action (après confirmation). */
const ACTIONS_FIXY_EXECUTABLES = new Set([
  'create_mission', 'assign_mission', 'update_mission', 'create_alert', 'send_message', 'create_document', 'create_event',
])

const LIBELLES_ACTIONS: Record<'fr' | 'pt', Record<string, string>> = {
  fr: {
    create_mission: 'Créer une mission',
    assign_mission: 'Assigner une mission à un prestataire',
    update_mission: 'Mettre à jour une mission',
    create_alert: 'Créer une alerte',
    send_message: 'Envoyer un e-mail',
    create_document: 'Créer un document',
    create_event: 'Ajouter un rendez-vous au planning',
  },
  pt: {
    create_mission: 'Criar uma ordem de serviço',
    assign_mission: 'Atribuir uma ordem a um profissional',
    update_mission: 'Atualizar uma ordem de serviço',
    create_alert: 'Criar um alerta',
    send_message: 'Enviar um e-mail',
    create_document: 'Criar um documento',
    create_event: 'Adicionar uma marcação ao planeamento',
  },
}

const LIBELLES_CHAMPS: Record<'fr' | 'pt', Record<string, string>> = {
  fr: {
    immeuble: 'Immeuble', description: 'Description', priorite: 'Priorité', type_travaux: 'Type de travaux',
    artisan: 'Prestataire', date_intervention: "Date d'intervention", statut: 'Statut', message: 'Message',
    urgence: 'Urgence', to: 'Destinataire', subject: 'Objet', titre: 'Titre', date: 'Date', heure: 'Heure',
    type_doc: 'Type de document', destinataire: 'Destinataire',
  },
  pt: {
    immeuble: 'Edifício', description: 'Descrição', priorite: 'Prioridade', type_travaux: 'Tipo de trabalho',
    artisan: 'Profissional', date_intervention: 'Data de intervenção', statut: 'Estado', message: 'Mensagem',
    urgence: 'Urgência', to: 'Destinatário', subject: 'Assunto', titre: 'Título', date: 'Data', heure: 'Hora',
    type_doc: 'Tipo de documento', destinataire: 'Destinatário',
  },
}

/**
 * Description d'une action proposée par Fixy, pour la carte de confirmation. null si l'action n'est pas
 * exécutable côté serveur (ex. « navigate »).
 */
export function decrireActionFixy(
  action: Record<string, unknown>,
  locale: V54Locale = V54_LOCALE_PAR_DEFAUT,
): { libelle: string; details: string[] } | null {
  const type = String(action.type)
  if (!ACTIONS_FIXY_EXECUTABLES.has(type)) return null
  const langue = locale === 'fr-FR' ? 'fr' : 'pt'
  const details = Object.entries(LIBELLES_CHAMPS[langue])
    .filter(([cle]) => typeof action[cle] === 'string' || typeof action[cle] === 'number')
    .map(([cle, libelle]) => `${libelle} : ${String(action[cle]).slice(0, 200)}`)
  return { libelle: LIBELLES_ACTIONS[langue][type], details }
}

/** Exécute une action de Fixy confirmée par l'utilisateur ; renvoie le message de confirmation à afficher. */
export async function executerActionFixy(
  action: Record<string, unknown>,
  token: string,
  locale: V54Locale = V54_LOCALE_PAR_DEFAUT,
): Promise<string> {
  const { type, ...args } = action
  const res = await fetch('/api/syndic/fixy-syndic/execute-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: { type, args } }),
  })
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || j.ok !== true) throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`)
  return locale === 'fr-FR' ? '✅ Action exécutée.' : '✅ Ação executada.'
}

// ── Lot features net-new : Reservas, Infrações, Enquetes, Checklists ──
export interface Reserva {
  id: string
  espaco: string
  quem: string
  data: string
  hora: string
  estado: 'confirmada' | 'pendente' | 'cancelada'
  notes: string
}
export interface Infracao {
  id: string
  tipo: string
  condomino: string
  edificio: string
  etapa: 'sinalizada' | 'analise' | 'notificacao' | 'multa' | 'resolvida'
  multa: number
  descricao: string
}
export interface EnqueteOption {
  label: string
  votes: number
}
export interface Enquete {
  id: string
  titulo: string
  descricao: string
  estado: 'ativa' | 'a_decorrer' | 'encerrada'
  tipo: string
  edificio: string
  prazo: string
  total: number
  options: EnqueteOption[]
  anonima: boolean
}
export interface ChecklistItem {
  label: string
  done: boolean
}
export interface Checklist {
  id: string
  titulo: string
  tipo: string
  edificio: string
  estado: 'em_curso' | 'concluida'
  items: ChecklistItem[]
}

export const fetchReservas = (token: string): Promise<Reserva[]> =>
  getList<Reserva>('/api/syndic/reservas', token, 'reservas')
export const fetchInfracoes = (token: string): Promise<Infracao[]> =>
  getList<Infracao>('/api/syndic/infracoes', token, 'infracoes')
export const fetchEnquetes = (token: string): Promise<Enquete[]> =>
  getList<Enquete>('/api/syndic/enquetes', token, 'enquetes')
export const fetchChecklists = (token: string): Promise<Checklist[]> =>
  getList<Checklist>('/api/syndic/checklists', token, 'checklists')

// ── Lot 2 « gestão » : Plano de Manutenção, Deliberações, Notificações Judiciais ──
export interface PlanoMan {
  id: string
  titulo: string
  edificio: string
  estado: 'preparacao' | 'aprovado' | 'concluido'
  orcamento: number
  anoInicio: number | null
  periodicidade: string
  descricao: string
}
export interface Deliberacao {
  id: string
  deliberacao: string
  ag: string
  responsavel: string
  prazo: string
  estado: 'pendente' | 'em_curso' | 'concluida' | 'atrasada' | 'bloqueada'
  origem: 'manual' | 'ia'
}
export interface ProcessoJud {
  id: string
  tipo: string
  contraparte: string
  processo: string
  data: string
  prazo: string
  estado: 'ativo' | 'arquivado'
  valor: number
  descricao: string
}

export const fetchPlanosMan = (token: string): Promise<PlanoMan[]> =>
  getList<PlanoMan>('/api/syndic/planos-man', token, 'planos')
export const fetchDeliberacoes = (token: string): Promise<Deliberacao[]> =>
  getList<Deliberacao>('/api/syndic/deliberacoes', token, 'deliberacoes')
export const fetchProcessosJud = (token: string): Promise<ProcessoJud[]> =>
  getList<ProcessoJud>('/api/syndic/processos-jud', token, 'processos')

// ── Lot 3 : Calendário Regulamentar (obrigações) + Contacto (campanhas) ──
export interface Obrigacao {
  id: string
  edificio: string
  tipo: string
  descricao: string
  prazo: string
  concluido: boolean
}
export interface Campanha {
  id: string
  nome: string
  tipo: string
  edificio: string
  destinatarios: number
  estado: 'rascunho' | 'agendada' | 'enviada'
  mensagem: string
}

export const fetchObrigacoes = (token: string): Promise<Obrigacao[]> =>
  getList<Obrigacao>('/api/syndic/obrigacoes', token, 'obrigacoes')
export const fetchCampanhas = (token: string): Promise<Campanha[]> =>
  getList<Campanha>('/api/syndic/campanhas', token, 'campanhas')

// ── Lot 4 : Votação Online AG (deliberações + permilagem) ──
export interface VotacaoOption {
  label: string
  perm: number
}
export interface Votacao {
  id: string
  titulo: string
  descricao: string
  edificio: string
  estado: 'aberta' | 'aprovada' | 'rejeitada' | 'encerrada'
  maioria: 'simples' | 'qualificada' | 'unanimidade'
  artigo: string
  prazo: string
  permTotal: number
  options: VotacaoOption[]
}

export const fetchVotacoes = (token: string): Promise<Votacao[]> =>
  getList<Votacao>('/api/syndic/votacoes', token, 'votacoes')

// ── Lot 7 : NPS Pós-Intervenção + Orçamentos & Obras ──
export interface Nps {
  id: string
  prestador: string
  condomino: string
  intervencao: string
  tipo: string
  nota: number
  comentario: string
}
export interface Obra {
  id: string
  titulo: string
  tipo: string
  descricao: string
  local: string
  prazo: string
  estado: 'orcamentacao' | 'aprovacao_ag' | 'execucao' | 'concluida'
  orcamento: number
  empresa: string
  numOrcamentos: number
}

export const fetchNps = (token: string): Promise<Nps[]> =>
  getList<Nps>('/api/syndic/nps', token, 'nps')
export const fetchObras = (token: string): Promise<Obra[]> =>
  getList<Obra>('/api/syndic/obras', token, 'obras')

// ── Lot 8 : Planeamento (eventos agenda hebdomadaire) ──
export interface Evento {
  id: string
  titulo: string
  dia: string
  horaInicio: string
  horaFim: string
  tipo: string
  responsavel: string
  edificio: string
}
export const fetchEventos = (token: string): Promise<Evento[]> =>
  getList<Evento>('/api/syndic/eventos', token, 'eventos')

// ── Phase A : Orçamentos (devis individuels par obra — comparaison 3 orçamentos) ──
export interface Orcamento {
  id: string
  obraId: string
  empresa: string
  valor: number
  prazoDias: number | null
  validade: string
  notas: string
  recomendado: boolean
}
export const fetchOrcamentos = (token: string): Promise<Orcamento[]> =>
  getList<Orcamento>('/api/syndic/orcamentos', token, 'orcamentos')

// ── Boîte e-mail du cabinet (écran « E-mails Fixy », agent Alfredo) ────────────
// Gmail / Google Workspace ou Outlook / Microsoft 365 (une boîte par cabinet).

/** Fournisseur de la boîte (colonne syndic_oauth_tokens.provider). */
export type FournisseurBoiteEmail = 'gmail' | 'microsoft'

/** E-mail relevé et analysé par Alfredo (sans le corps complet). */
export interface EmailAnalyse {
  id: string
  from_email: string
  subject: string | null
  resume_ia: string | null
  received_at: string
  urgence: string | null
  type_demande: string | null
  draft_status: string | null
  draft_subject: string | null
}

export interface EtatBoiteEmail {
  cabinetId: string
  connecte: boolean
  /** Fournisseur de la boîte connectée (null hors connexion). */
  provider: FournisseurBoiteEmail | null
  email: string | null
  misAJour: string | null
  brouillonsEnAttente: number
  emails: EmailAnalyse[]
}
/** @deprecated nom d'avant Outlook / Microsoft 365 — utiliser EtatBoiteEmail. */
export type EtatBoiteGmail = EtatBoiteEmail

/** État de la boîte du cabinet : connectée ou non, fournisseur, adresse, derniers e-mails analysés. */
export async function fetchEtatBoite(token: string): Promise<EtatBoiteEmail> {
  const res = await fetch('/api/email-agent/status', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`/api/email-agent/status → HTTP ${res.status}`)
  return (await res.json()) as EtatBoiteEmail
}

/**
 * Adresse de connexion de la boîte chez le fournisseur choisi (Google ou Microsoft) :
 * le jeton de session reste dans l'en-tête, jamais dans l'URL.
 */
export async function urlConnexionBoite(token: string, provider: FournisseurBoiteEmail): Promise<string> {
  const res = await fetch(`/api/email-agent/connect?format=json&provider=${provider}`, { headers: { Authorization: `Bearer ${token}` } })
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !j.url) throw new Error(j.error || `/api/email-agent/connect → HTTP ${res.status}`)
  return j.url
}

/** Déconnecte la boîte du cabinet ; purger : efface aussi les e-mails analysés (hors démonstration). */
export async function deconnecterBoite(token: string, purger: boolean): Promise<{ boitesSupprimees: number; emailsSupprimes: number }> {
  const res = await fetch(`/api/email-agent/connect${purger ? '?purger=1' : ''}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = (await res.json().catch(() => ({}))) as { boitesSupprimees?: number; emailsSupprimes?: number; error?: string }
  if (!res.ok) throw new Error(j.error || `/api/email-agent/connect → HTTP ${res.status}`)
  return { boitesSupprimees: j.boitesSupprimees ?? 0, emailsSupprimes: j.emailsSupprimes ?? 0 }
}

/** Échec d'une relève, avec le code renvoyé par le poll (refresh_failed, lecture_impossible…). */
export class ErreurReleveBoite extends Error {
  readonly code: string | null
  constructor(message: string, code: string | null) {
    super(message)
    this.name = 'ErreurReleveBoite'
    this.code = code
  }
}

/**
 * Relève la boîte maintenant : Alfredo classe les derniers e-mails de la boîte de réception
 * (lus ou non) et prépare les brouillons — rien n'est envoyé.
 */
export async function releverBoite(token: string, cabinetId: string): Promise<{ nouveaux: number; traites: number; reportes: number }> {
  const res = await fetch('/api/email-agent/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ syndic_id: cabinetId, first_run: true }),
  })
  if (!res.ok) throw new Error(`/api/email-agent/poll → HTTP ${res.status}`)
  const j = (await res.json()) as { results?: Array<{ new_emails?: number; emails_processed?: number; deferred?: number; error?: string; code?: string }> }
  const r = j.results?.[0]
  if (r?.error) throw new ErreurReleveBoite(r.error, r.code ?? null)
  // reportes : e-mails laissés à la relève suivante (budget de temps du serveur atteint).
  return { nouveaux: r?.new_emails ?? 0, traites: r?.emails_processed ?? 0, reportes: r?.deferred ?? 0 }
}

/** @deprecated utiliser fetchEtatBoite. */
export const fetchEtatBoiteGmail = fetchEtatBoite
/** @deprecated utiliser urlConnexionBoite(token, 'gmail'). */
export const urlConnexionGmail = (token: string): Promise<string> => urlConnexionBoite(token, 'gmail')
/** @deprecated utiliser releverBoite. */
export const releverBoiteGmail = releverBoite
