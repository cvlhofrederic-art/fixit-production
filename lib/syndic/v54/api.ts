import type { Mission, Immeuble, Artisan, TeamMember } from '@/components/syndic-dashboard/types'

/**
 * Fetchers typés du dashboard syndic v54 (Phase 2) — réutilisent les routes
 * /api/syndic/* existantes (auth Bearer + filtrage cabinet RLS + mapping
 * snake_case→camelCase déjà faits côté serveur). On ne réécrit pas la couche
 * data : on la consomme.
 */

async function getList<T>(path: string, token: string, key: string): Promise<T[]> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  const json: unknown = await res.json()
  const list = (json as Record<string, unknown>)?.[key]
  return Array.isArray(list) ? (list as T[]) : []
}

export const fetchMissions = (token: string): Promise<Mission[]> =>
  getList<Mission>('/api/syndic/missions', token, 'missions')

export const fetchImmeubles = (token: string): Promise<Immeuble[]> =>
  getList<Immeuble>('/api/syndic/immeubles', token, 'immeubles')

export const fetchArtisans = (token: string): Promise<Artisan[]> =>
  getList<Artisan>('/api/syndic/artisans', token, 'artisans')

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
  const res = await fetch('/api/syndic/coproprios', { headers: { Authorization: `Bearer ${token}` } })
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
  /** basse | normale | haute | urgente */
  priorite: string
  /** en_attente | en_cours | en_reparation | resolu … */
  statut: string
}

export const fetchSignalements = (token: string): Promise<Signalement[]> =>
  getList<Signalement>('/api/syndic/signalements', token, 'signalements')

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

/** Endpoints des 5 agents IA syndic (route id → API). */
const AGENT_ENDPOINTS: Record<string, string> = {
  fixy: '/api/syndic/fixy-syndic',
  max: '/api/syndic/max-ai',
  lea: '/api/syndic/lea-comptable',
  alfredo: '/api/syndic/alfredo-chat',
  tempo: '/api/syndic/tempo-ai',
}

/**
 * Envoie un message à un agent IA syndic et retourne sa réponse texte.
 * Réponse : clé `response` (fixy/max/lea/tempo) ou `content` (alfredo).
 * Ne modifie aucun prompt (conforme ai-agents.md) — pur câblage UI → endpoint.
 */
export async function askAgent(route: string, message: string, token: string): Promise<string> {
  const endpoint = AGENT_ENDPOINTS[route]
  if (!endpoint) throw new Error(`Agent inconnu: ${route}`)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}`)
  const j = (await res.json()) as Record<string, unknown>
  const text = typeof j.response === 'string' ? j.response : typeof j.content === 'string' ? j.content : ''
  return text || 'Sem resposta.'
}
