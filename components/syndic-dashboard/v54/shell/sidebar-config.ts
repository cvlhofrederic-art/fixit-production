// Config sidebar du dashboard syndic v54 — port byte-exact du SIDEBAR du bundle
// V5.7 (12 sections, 80 entrées). Items typés en objets (icon: IconName vérifié
// au compile). `header` = sous-en-tête thématique non-cliquable (bundle '__H__').

import type { IconName } from '@/lib/syndic/icon-names'

export interface SidebarItem {
  id: string
  label: string
  icon: IconName
  /** Compteur affiché à droite (badge). */
  count?: number
  /** Pastille d'état active (dot-st). */
  dot?: boolean
}
export interface SidebarHeader {
  header: string
}
export type SidebarEntry = SidebarItem | SidebarHeader
export interface SidebarSection {
  title: string
  entries: SidebarEntry[]
}

export const isItem = (e: SidebarEntry): e is SidebarItem => 'id' in e

export const SIDEBAR: SidebarSection[] = [
  { title: 'Agentes IA', entries: [
    { id: 'fixy', label: 'Fixy', icon: 'bot', dot: true },
    { id: 'max', label: 'Max Expert', icon: 'grad' },
    { id: 'lea', label: 'Léa', icon: 'sparkle' },
    { id: 'alfredo', label: 'Alfredo', icon: 'mail' },
    { id: 'tempo', label: 'Tempo', icon: 'clock' },
  ] },
  { title: 'Gestão', entries: [
    { id: 'dashboard', label: 'Painel de controlo', icon: 'grid' },
    { id: 'ordens', label: 'Ordens de serviço', icon: 'clipboard', count: 4 },
    { id: 'canal', label: 'Canal de Comunicações', icon: 'chat', count: 1 },
    { id: 'planeamento', label: 'Planeamento', icon: 'calendar' },
    { id: 'urgencias', label: 'Urgências Técnicas', icon: 'siren' },
    { id: 'equipa', label: 'A Minha Equipa', icon: 'team' },
  ] },
  { title: 'Património', entries: [
    { id: 'edificios', label: 'Edifícios', icon: 'building', count: 4 },
    { id: 'profissionais', label: 'Profissionais', icon: 'wrench', count: 9 },
    { id: 'condominos', label: 'Condóminos', icon: 'users' },
    { id: 'elevadores', label: 'Elevadores', icon: 'monitor' },
    { id: 'contratos', label: 'Contratos', icon: 'handshake' },
    { id: 'cctv', label: 'Câmaras Vigilância', icon: 'monitor' },
    { id: 'histEdificio', label: 'Histórico Edifício', icon: 'bank' },
  ] },
  { title: 'Técnico', entries: [
    { id: 'docsInterv', label: 'Documentos de Intervenções', icon: 'folder' },
    { id: 'contabTec', label: 'Contabilidade Técnica', icon: 'chart' },
    { id: 'analiseOrc', label: 'Análise Orçamentos/Faturas', icon: 'search' },
    { id: 'faturacao', label: 'Faturação', icon: 'coin' },
  ] },
  { title: 'Acompanhamento', entries: [
    { id: 'alertas', label: 'Alertas', icon: 'bell' },
    { id: 'relMensal', label: 'Relatório mensal', icon: 'doc' },
    { id: 'calReg', label: 'Calendário regulamentar', icon: 'calendar' },
    { id: 'docsGED', label: 'Documentos (GED)', icon: 'folder' },
  ] },
  { title: 'Condomínio', entries: [
    { id: 'contabCond', label: 'Contabilidade Condomínio', icon: 'chart' },
    { id: 'agDigit', label: 'AG Digitais', icon: 'bank' },
    { id: 'valoresDiv', label: 'Valores em dívida', icon: 'alert' },
    { id: 'caderneta', label: 'Caderneta de Manutenção', icon: 'book' },
    { id: 'mapaFiscal', label: 'Mapa Fiscal Anual', icon: 'fact' },
    { id: 'openBanking', label: 'Open Banking', icon: 'bank' },
  ] },
  { title: 'Gestão Condóminos', entries: [
    { id: 'portal', label: 'Portal do Condómino', icon: 'home' },
    { id: 'avisos', label: 'Quadro de Avisos', icon: 'pin' },
    { id: 'enquetes', label: 'Enquetes', icon: 'poll' },
    { id: 'reserva', label: 'Reserva Espaços', icon: 'calendar' },
    { id: 'ocorrencias', label: 'Ocorrências', icon: 'wrench' },
    { id: 'whatsapp', label: 'WhatsApp/SMS', icon: 'chat' },
    { id: 'chatbot', label: 'Chatbot WhatsApp 24/7', icon: 'bot' },
    { id: 'reembolsos', label: 'Reembolsos', icon: 'refresh' },
    { id: 'npsPosIntervencao', label: 'NPS Pós-Intervenção', icon: 'poll' },
  ] },
  { title: 'Ferramentas Avançadas', entries: [
    { id: 'relGestao', label: 'Relatório de Gestão', icon: 'doc' },
    { id: 'prepAss', label: 'Preparador Assembleia', icon: 'pencil' },
    { id: 'planoMan', label: 'Plano Manutenção', icon: 'construction' },
    { id: 'vistoria', label: 'Vistoria Técnica', icon: 'clipboard' },
    { id: 'pontuacao', label: 'Pontuação Saúde', icon: 'target' },
    { id: 'orcIA', label: 'Orçamento IA', icon: 'sparkle' },
    { id: 'contacto', label: 'Contacto Proativo', icon: 'sat' },
    { id: 'ocClassif', label: 'Ocorrências (Classificador)', icon: 'bot' },
    { id: 'seguros', label: 'Gestão Seguros', icon: 'shield' },
    { id: 'checklists', label: 'Checklists IA', icon: 'clipboard' },
    { id: 'procLote', label: 'Processamentos Lote', icon: 'cog' },
    { id: 'agLive', label: 'AG Live Digital', icon: 'bank' },
    { id: 'marketplace', label: 'Marketplace Profissionais', icon: 'handshake' },
    { id: 'predicao', label: 'Predição Manutenção', icon: 'bot' },
    { id: 'qrcode', label: 'QR Code Fração', icon: 'qr' },
    { id: 'dashCond', label: 'Dashboard Condómino', icon: 'users' },
    { id: 'compEnergia', label: 'Comparador Energia', icon: 'bolt' },
    { id: 'assinaturaCMD', label: 'Assinatura CMD', icon: 'pencil' },
    { id: 'multiImoveis', label: 'Multi-Imóveis', icon: 'building' },
    { id: 'benchmarking', label: 'Benchmarking Imóveis', icon: 'chart' },
    { id: 'efatura', label: 'e-Fatura AT', icon: 'fact' },
    { id: 'votacaoOnline', label: 'Votação Online', icon: 'poll' },
    { id: 'atasIA', label: 'Atas com IA', icon: 'pencil' },
    { id: 'pagDigitais', label: 'Pagamentos Digitais', icon: 'coin' },
    { id: 'mapaQuotas', label: 'Mapa de Quotas', icon: 'coin' },
    { id: 'orc3', label: '3 Orçamentos', icon: 'clipboard' },
    { id: 'cobrJud', label: 'Cobrança Judicial', icon: 'scale' },
    { id: 'carregamentoVE', label: 'Carregamento VE', icon: 'bolt' },
    { id: 'monitorizacao', label: 'Monitorização Consumos', icon: 'monitor' },
    { id: 'arquivoDig', label: 'Arquivo Digital', icon: 'archive' },
  ] },
  { title: 'Obrigações Legais', entries: [
    { header: 'Compliance Geral' },
    { id: 'declEncargos', label: 'Declaração de Encargos', icon: 'doc' },
    { id: 'obrigPrazos', label: 'Obrigações e Prazos', icon: 'scale' },
    { id: 'prazosLegais', label: 'Prazos legais', icon: 'calendar' },
    { id: 'acessibilidade', label: 'Acessibilidade DL 163', icon: 'target' },
    { header: 'AG & Deliberações' },
    { id: 'preparadorAG', label: 'Preparador AG', icon: 'pencil' },
    { id: 'trackerDelibs', label: 'Tracker Deliberações', icon: 'bot' },
    { id: 'procuracoes', label: 'Procurações & Presenças', icon: 'doc' },
    { header: 'Seguros & Riscos' },
    { id: 'seguroObr', label: 'Seguro Obrigatório', icon: 'shield' },
    { id: 'fcr', label: 'Fundo Comum de Reserva', icon: 'bank' },
    { id: 'sinistros', label: 'Sinistros', icon: 'shield' },
    { id: 'segEdificio', label: 'Segurança Edifício', icon: 'shield' },
    { header: 'Judicial & Privacidade' },
    { id: 'notificJud', label: 'Notificações Judiciais', icon: 'scale' },
    { id: 'infracoes', label: 'Acompanhamento de Infrações', icon: 'alert' },
    { id: 'cobrAuto', label: 'Cobrança automática', icon: 'coin' },
    { id: 'rgpdCenter', label: 'RGPD Center', icon: 'archive' },
    { header: 'Energia & Extranet' },
    { id: 'certEnerg', label: 'Certificação Energética', icon: 'bolt' },
    { id: 'extranet', label: 'Extranet Condóminos', icon: 'team' },
  ] },
  { title: 'Ferramentas IA', entries: [
    { id: 'lancFat', label: 'Lançamento IA Faturas', icon: 'sparkle' },
    { id: 'comunicDig', label: 'Comunicação digital', icon: 'chat' },
    { id: 'emailsFixy', label: 'Emails Fixy', icon: 'mail' },
  ] },
  { title: 'Conta', entries: [
    { id: 'modulos', label: 'Os Meus Módulos', icon: 'puzzle' },
    { id: 'definicoes', label: 'Definições', icon: 'cog' },
    { id: 'logout', label: 'Terminar sessão', icon: 'logout' },
  ] },
]

/** Map id → label (titre du breadcrumb), dérivé de SIDEBAR. */
export const SIDE_TITLES: Record<string, string> = Object.fromEntries(
  SIDEBAR.flatMap((s) => s.entries.filter(isItem).map((i) => [i.id, i.label])),
)

/** Routes « agent » qui rendent AgentChatPage plutôt qu'un placeholder. */
export const AGENT_ROUTES = new Set(['fixy', 'max', 'lea', 'alfredo', 'tempo'])

// ── Phase A3 : préférences sidebar (ordre + masqués) ──────────────────────────
/** Items jamais masquables (anti-verrouillage : accès garanti à l'éditeur + logout). */
export const NEVER_HIDE = new Set(['modulos', 'logout'])

/**
 * Applique les préférences (ordre + masqués) à la sidebar. Réordonne les items
 * À L'INTÉRIEUR de chaque section (les sous-en-têtes gardent leur position),
 * masque les items cachés, retire les sections vides. Sans prefs → SIDEBAR
 * inchangée (gated → préserve le rendu byte-exact par défaut).
 */
export function applySidebarPrefs(sidebar: SidebarSection[], prefs?: { itemOrder?: string[]; itemsHidden?: string[] }): SidebarSection[] {
  const order = prefs?.itemOrder ?? []
  const hidden = (prefs?.itemsHidden ?? []).filter((id) => !NEVER_HIDE.has(id))
  if (order.length === 0 && hidden.length === 0) return sidebar
  const hiddenSet = new Set(hidden)
  const orderIdx = new Map(order.map((id, i) => [id, i] as const))
  const rank = (id: string) => orderIdx.get(id) ?? Number.MAX_SAFE_INTEGER
  return sidebar
    .map((sec) => {
      const kept = sec.entries.filter((e) => !isItem(e) || !hiddenSet.has(e.id))
      const queue = kept.filter(isItem).sort((a, b) => rank(a.id) - rank(b.id))
      const entries: SidebarEntry[] = kept.map((e) => (isItem(e) ? (queue.shift() ?? e) : e))
      return { ...sec, entries }
    })
    .filter((sec) => sec.entries.some(isItem))
}

/** Toutes les entrées-items (hors logout), à plat avec leur section — pour l'éditeur de préférences. */
export const SIDEBAR_EDITABLE: { section: string; id: string; label: string; icon: IconName }[] =
  SIDEBAR.flatMap((sec) => sec.entries.filter(isItem).filter((e) => e.id !== 'logout').map((e) => ({ section: sec.title, id: e.id, label: e.label, icon: e.icon })))
