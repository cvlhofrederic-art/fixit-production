/**
 * Détection de textes portugais restés dans la version française du dashboard v54.
 *
 * Deux signaux :
 *  - orthographe : í, ó, ú, ã, õ n'existent pas en français ;
 *  - vocabulaire : mots portugais courants de l'interface, sans homographe français usuel.
 * Les chaînes légitimement identiques dans les deux langues (marques, sigles, noms des
 * agents, nombres) passent ; une exception explicite se déclare dans IDENTIQUES_AUTORISES.
 */

import { AUTORISES_PAR_LOT } from './autorises'

const ORTHOGRAPHE_PT = /[íóúãõÍÓÚÃÕ]/

const MOTS_PT = [
  // Exclus car français aussi : dos, sim (carte SIM), ver, urgente, total, normal.
  'não', 'nenhum', 'nenhuma', 'em curso', 'de hoje', 'da', 'do', 'das', 'em', 'um', 'uma', 'para', 'pelo', 'pela',
  'com o', 'com a', 'novo', 'nova', 'novos', 'novas', 'todos', 'todas', 'ontem', 'semana', 'mês', 'meses', 'ano', 'anos',
  'adicionar', 'guardar', 'eliminar', 'registar', 'pesquisar', 'procurar', 'selecione', 'selecionar', 'carregar', 'descarregar',
  'enviar', 'fechar', 'abrir', 'criar', 'editar', 'gerir', 'gerar', 'analisar', 'cancelar', 'confirmar', 'voltar', 'seguinte',
  'obrigatório', 'obrigatória', 'gestão', 'serviço', 'serviços', 'você', 'também', 'até', 'está', 'estão', 'são', 'sem',
  'condomínio', 'condómino', 'condóminos', 'edifício', 'edifícios', 'fração', 'frações', 'morada', 'telemóvel', 'ficheiro',
  'relatório', 'orçamento', 'orçamentos', 'fatura', 'faturas', 'dívida', 'quota', 'quotas', 'assembleia', 'ata', 'atas',
  'reunião', 'seguro', 'seguros', 'sinistro', 'elevador', 'elevadores', 'obra', 'obras', 'prazo', 'prazos', 'missão',
  'missões', 'profissional', 'profissionais', 'equipa', 'definições', 'pagamento', 'pagamentos', 'aviso', 'avisos',
  'despesa', 'despesas', 'receita', 'receitas', 'saldo', 'estado', 'concluída', 'concluídas', 'concluído', 'pendente',
  'pendentes', 'ativo', 'ativa', 'ativos', 'ativas', 'inativo', 'vazio', 'vazia', 'erro', 'falha', 'sucesso',
  'carregamento', 'manutenção', 'intervenção', 'intervenções', 'deliberação', 'deliberações', 'procuração', 'procurações',
  'filtros', 'detalhe', 'detalhes', 'resumo', 'próximo', 'próxima', 'último', 'última', 'mensal', 'anual', 'diário',
] as const

const MOTS_RE = new RegExp(
  `(?:^|[^\\p{L}])(${MOTS_PT.map((m) => m.replace(/ /g, '\\s+')).join('|')})(?=$|[^\\p{L}])`,
  'iu',
)

/** Chaînes identiques en PT et en FR, acceptées telles quelles (préciser pourquoi). */
export const IDENTIQUES_AUTORISES: ReadonlySet<string> = new Set<string>([
  // Noms propres et marques : agents, produit, sigles internationaux.
  'Fixy', 'Max Expert', 'Léa', 'Alfredo', 'Tempo', 'VitFix', 'VitFix Pro', 'VITFIX', 'Super Admin',
  'Open Banking', 'WhatsApp', 'WhatsApp/SMS', 'SMS', 'NPS', 'SLA', 'RGPD', 'GED', 'PDF', 'CSV', 'IA', 'QR Code', 'IBAN',
  'Total', 'Normal', 'Info', 'Email', 'E-mail', 'Gmail', 'Dashboard', 'Benchmarking', 'Checklists IA', 'Marketplace',
  // Libellés de la sidebar FR identiques au PT, corrects en français.
  'Chatbot WhatsApp 24/7',
  // Mots identiques et corrects en français.
  'Urgente', 'Urgent', 'Type', 'Description', 'Code', 'Date', 'Note', 'Message', 'Messages', 'Document', 'Documents',
  // Exceptions déclarées par les lots de modules (tests/syndic-v54-i18n/autorises/lot-NN.ts).
  ...AUTORISES_PAR_LOT,
])

/** Texte relevé par le parcours (« @attribut=valeur » pour les attributs). */
const valeur = (s: string): string => s.replace(/^@[\w-]+=/, '')

/** Vrai si la chaîne semble portugaise. */
export function semblePortugais(s: string): boolean {
  const v = valeur(s)
  if (IDENTIQUES_AUTORISES.has(v)) return false
  return ORTHOGRAPHE_PT.test(v) || MOTS_RE.test(v)
}

/**
 * Chaînes suspectes d'un relevé FR. Avec `referencePt` (instantané PT complet, en
 * local), toute chaîne contenant des lettres et identique à une chaîne PT est aussi
 * signalée, sauf exception déclarée.
 */
export function residusPortugais(textes: Iterable<string>, referencePt?: ReadonlySet<string>): string[] {
  const out = new Set<string>()
  for (const s of textes) {
    const v = valeur(s)
    if (semblePortugais(s)) out.add(s)
    else if (referencePt && /\p{L}{3,}/u.test(v) && referencePt.has(s) && !IDENTIQUES_AUTORISES.has(v)) out.add(s)
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'fr'))
}
