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
  const res = await fetch('/api/syndic/contab', { headers: { Authorization: `Bearer ${token}` } })
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
