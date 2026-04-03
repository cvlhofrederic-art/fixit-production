'use client'

import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EtapaCobranca =
  | 'atraso_identificado'
  | 'contacto_amigavel'
  | 'notificacao_formal'
  | 'prazo_90_dias'
  | 'injuncao_acao'
  | 'penhora_hipoteca'

type StatusProcesso = 'em_curso' | 'pendente_judicial' | 'recuperado' | 'prescrito'

interface AcaoHistorico {
  id: string
  data: string
  descricao: string
  tipo: 'automatico' | 'manual' | 'documento' | 'comunicacao'
  documento?: string
}

interface ProcessoCobranca {
  id: string
  condomino: string
  fracao: string
  edificio: string
  nif?: string
  valorDivida: number
  valorOriginal: number
  jurosMora: number
  dataInicio: string
  dataVencimentoOriginal: string
  etapa: EtapaCobranca
  status: StatusProcesso
  ultimaAcao: string
  proximaAcao: string
  dataLimite: string
  historico: AcaoHistorico[]
  documentosGerados: string[]
  observacoes?: string
  dataPrescricao: string // 5 anos a partir do vencimento
}

interface Props {
  user: User
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ETAPAS: { key: EtapaCobranca; label: string; icon: string; descricao: string; prazo: string }[] = [
  { key: 'atraso_identificado',  label: 'Atraso identificado',           icon: '🔴', descricao: 'Dívida detetada no sistema',              prazo: 'Imediato' },
  { key: 'contacto_amigavel',    label: 'Contacto amigável',             icon: '📞', descricao: 'Primeiro contacto informal (15 dias)',     prazo: '15 dias' },
  { key: 'notificacao_formal',   label: 'Notificação formal (LRAR)',     icon: '📨', descricao: 'Carta registada com aviso de receção',     prazo: '30 dias' },
  { key: 'prazo_90_dias',        label: 'Prazo 90 dias (Lei 8/2022)',    icon: '⚖️', descricao: 'Prazo legal obrigatório antes de ação',    prazo: '90 dias' },
  { key: 'injuncao_acao',        label: 'Injunção / Ação judicial',      icon: '🏛️', descricao: 'Procedimento judicial instaurado',         prazo: 'Variável' },
  { key: 'penhora_hipoteca',     label: 'Penhora / Hipoteca legal',      icon: '🔒', descricao: 'Execução patrimonial',                    prazo: 'Até decisão' },
]

const ETAPA_ORDER: EtapaCobranca[] = [
  'atraso_identificado', 'contacto_amigavel', 'notificacao_formal',
  'prazo_90_dias', 'injuncao_acao', 'penhora_hipoteca',
]

const STATUS_CONFIG: Record<StatusProcesso, { label: string; bg: string; color: string; dot: string }> = {
  em_curso:           { label: 'Em curso',           bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' },
  pendente_judicial:  { label: 'Pendente judicial',  bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  recuperado:         { label: 'Recuperado',         bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  prescrito:          { label: 'Prescrito',          bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
}

const TAXA_JUROS_MORA_ANUAL = 0.04 // 4% taxa legal de juros de mora

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatDateLong = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const diasEntre = (a: string, b: string) => {
  const diff = new Date(b).getTime() - new Date(a).getTime()
  return Math.ceil(diff / 86400000)
}

const diasAte = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

const addDias = (dateStr: string, dias: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

// ─── Dados demo ──────────────────────────────────────────────────────────────

const gerarDemoData = (): ProcessoCobranca[] => {
  const hoje = new Date().toISOString().split('T')[0]
  return [
    {
      id: 'cob_001',
      condomino: 'Manuel Ferreira dos Santos',
      fracao: 'Fração A - 1.º Esq.',
      edificio: 'Edifício Marquês',
      nif: '234567891',
      valorDivida: 2_450.00,
      valorOriginal: 2_300.00,
      jurosMora: 150.00,
      dataInicio: '2025-06-15',
      dataVencimentoOriginal: '2025-03-01',
      etapa: 'prazo_90_dias',
      status: 'em_curso',
      ultimaAcao: 'Carta registada enviada (LRAR)',
      proximaAcao: 'Verificar cumprimento prazo 90 dias',
      dataLimite: '2025-09-13',
      historico: [
        { id: 'h1', data: '2025-06-15', descricao: 'Atraso identificado - quotas março a maio', tipo: 'automatico' },
        { id: 'h2', data: '2025-06-20', descricao: 'Contacto telefónico sem resposta', tipo: 'comunicacao' },
        { id: 'h3', data: '2025-07-05', descricao: 'Carta registada LRAR enviada', tipo: 'documento', documento: 'Notificação formal' },
      ],
      documentosGerados: ['Lembrete amigável', 'Notificação formal (LRAR)'],
      dataPrescricao: '2030-03-01',
    },
    {
      id: 'cob_002',
      condomino: 'Ana Beatriz Oliveira',
      fracao: 'Fração C - 3.º Dto.',
      edificio: 'Residencial Boavista',
      nif: '198765432',
      valorDivida: 875.00,
      valorOriginal: 850.00,
      jurosMora: 25.00,
      dataInicio: '2025-11-01',
      dataVencimentoOriginal: '2025-09-01',
      etapa: 'contacto_amigavel',
      status: 'em_curso',
      ultimaAcao: 'Email de lembrete enviado',
      proximaAcao: 'Contacto telefónico (prazo 15 dias)',
      dataLimite: '2025-11-16',
      historico: [
        { id: 'h4', data: '2025-11-01', descricao: 'Atraso detetado - quotas set/out', tipo: 'automatico' },
        { id: 'h5', data: '2025-11-03', descricao: 'Email de lembrete amigável enviado', tipo: 'comunicacao' },
      ],
      documentosGerados: ['Lembrete amigável'],
      dataPrescricao: '2030-09-01',
    },
    {
      id: 'cob_003',
      condomino: 'Carlos Miguel Pinto',
      fracao: 'Fração E - R/C Esq.',
      edificio: 'Edifício Marquês',
      nif: '276543210',
      valorDivida: 5_890.00,
      valorOriginal: 5_200.00,
      jurosMora: 690.00,
      dataInicio: '2024-09-01',
      dataVencimentoOriginal: '2024-01-01',
      etapa: 'injuncao_acao',
      status: 'pendente_judicial',
      ultimaAcao: 'Requerimento de injunção apresentado',
      proximaAcao: 'Aguardar notificação do tribunal',
      dataLimite: '2026-06-01',
      historico: [
        { id: 'h6', data: '2024-09-01', descricao: 'Processo aberto - acumulação 8 meses', tipo: 'automatico' },
        { id: 'h7', data: '2024-09-15', descricao: 'Contacto telefónico - promessa não cumprida', tipo: 'comunicacao' },
        { id: 'h8', data: '2024-10-10', descricao: 'Carta registada LRAR n.º 4521', tipo: 'documento', documento: 'Notificação formal' },
        { id: 'h9', data: '2025-01-10', descricao: 'Prazo 90 dias expirado sem pagamento', tipo: 'automatico' },
        { id: 'h10', data: '2025-02-15', descricao: 'Requerimento de injunção submetido ao Balcão Nacional', tipo: 'documento', documento: 'Requerimento de injunção' },
      ],
      documentosGerados: ['Lembrete amigável', 'Notificação formal (LRAR)', 'Requerimento de injunção'],
      dataPrescricao: '2029-01-01',
    },
    {
      id: 'cob_004',
      condomino: 'Maria Luísa Gomes',
      fracao: 'Fração B - 2.º Dto.',
      edificio: 'Residencial Boavista',
      nif: '312456789',
      valorDivida: 0,
      valorOriginal: 1_600.00,
      jurosMora: 0,
      dataInicio: '2025-02-01',
      dataVencimentoOriginal: '2024-10-01',
      etapa: 'notificacao_formal',
      status: 'recuperado',
      ultimaAcao: 'Pagamento integral recebido',
      proximaAcao: '---',
      dataLimite: '---',
      historico: [
        { id: 'h11', data: '2025-02-01', descricao: 'Processo aberto', tipo: 'automatico' },
        { id: 'h12', data: '2025-02-10', descricao: 'Lembrete amigável enviado', tipo: 'comunicacao' },
        { id: 'h13', data: '2025-03-05', descricao: 'Carta registada enviada', tipo: 'documento' },
        { id: 'h14', data: '2025-03-20', descricao: 'Pagamento integral recebido - processo encerrado', tipo: 'manual' },
      ],
      documentosGerados: ['Lembrete amigável', 'Notificação formal (LRAR)'],
      dataPrescricao: '2029-10-01',
    },
    {
      id: 'cob_005',
      condomino: 'Joaquim Alberto Reis',
      fracao: 'Fração D - 4.º Esq.',
      edificio: 'Edifício Marquês',
      nif: '456789012',
      valorDivida: 8_350.00,
      valorOriginal: 7_200.00,
      jurosMora: 1_150.00,
      dataInicio: '2023-11-01',
      dataVencimentoOriginal: '2023-06-01',
      etapa: 'penhora_hipoteca',
      status: 'pendente_judicial',
      ultimaAcao: 'Penhora de rendimentos requerida',
      proximaAcao: 'Aguardar execução judicial',
      dataLimite: '2026-12-31',
      historico: [
        { id: 'h15', data: '2023-11-01', descricao: 'Processo aberto - dívida acumulada grave', tipo: 'automatico' },
        { id: 'h16', data: '2023-11-20', descricao: 'Contacto amigável sem resultado', tipo: 'comunicacao' },
        { id: 'h17', data: '2023-12-15', descricao: 'Carta registada LRAR', tipo: 'documento' },
        { id: 'h18', data: '2024-03-15', descricao: 'Prazo 90 dias esgotado', tipo: 'automatico' },
        { id: 'h19', data: '2024-05-01', descricao: 'Injunção apresentada no Tribunal', tipo: 'documento' },
        { id: 'h20', data: '2024-10-15', descricao: 'Sentença favorável ao condomínio', tipo: 'automatico' },
        { id: 'h21', data: '2025-01-10', descricao: 'Penhora de rendimentos requerida', tipo: 'documento', documento: 'Requerimento de penhora' },
      ],
      documentosGerados: ['Lembrete amigável', 'Notificação formal (LRAR)', 'Requerimento de injunção', 'Comunicação à AG'],
      dataPrescricao: '2028-06-01',
    },
  ]
}

// ─── Modelos documentos ──────────────────────────────────────────────────────

const MODELOS_DOCUMENTOS = [
  {
    id: 'lembrete_amigavel',
    titulo: 'Lembrete amigável (1.o contacto)',
    descricao: 'Comunicação informal ao condómino devedor, solicitando o pagamento das quotas em atraso.',
    icon: '📧',
    etapaRelacionada: 'contacto_amigavel' as EtapaCobranca,
  },
  {
    id: 'notificacao_lrar',
    titulo: 'Notificacao formal (carta registada LRAR)',
    descricao: 'Carta registada com aviso de recepcao, exigindo o pagamento sob pena de acao judicial conforme Lei 8/2022.',
    icon: '📨',
    etapaRelacionada: 'notificacao_formal' as EtapaCobranca,
  },
  {
    id: 'requerimento_injuncao',
    titulo: 'Requerimento de injuncao (Tribunal)',
    descricao: 'Formulario para procedimento de injuncao no Balcao Nacional de Injuncoes (DL 269/98).',
    icon: '🏛️',
    etapaRelacionada: 'injuncao_acao' as EtapaCobranca,
  },
  {
    id: 'comunicacao_ag',
    titulo: 'Comunicacao a AG sobre dividas',
    descricao: 'Relatorio para apresentacao em Assembleia Geral com o ponto de situacao das dividas.',
    icon: '📋',
    etapaRelacionada: 'prazo_90_dias' as EtapaCobranca,
  },
]

// ─── Legislacao ──────────────────────────────────────────────────────────────

const LEGISLACAO = [
  {
    id: 'art1424_cc',
    titulo: 'Art.o 1424.o Codigo Civil',
    subtitulo: 'Obrigacao de pagamento de quotas',
    resumo: 'Cada condomino e obrigado a contribuir para as despesas comuns do condominio na proporcao do valor da sua fracao, salvo disposicao em contrario do titulo constitutivo.',
    icon: '📜',
    tag: 'Quotas',
    tagColor: '#1E40AF',
  },
  {
    id: 'lei_8_2022',
    titulo: 'Lei 8/2022 (novo regime)',
    subtitulo: 'Prazo 90 dias para acao judicial',
    resumo: 'O administrador e obrigado a instaurar acao judicial para cobranca das contribuicoes devidas ao condominio quando o atraso no pagamento exceda 90 dias, sob pena de responsabilidade.',
    icon: '⚖️',
    tag: 'Obrigatorio',
    tagColor: '#DC2626',
  },
  {
    id: 'art310_cc',
    titulo: 'Art.o 310.o Codigo Civil',
    subtitulo: 'Prescricao de 5 anos',
    resumo: 'As quotas de condominio prescrevem no prazo de 5 anos, contados a partir da data de vencimento de cada prestacao. Apos este prazo, a divida nao pode ser judicialmente exigida.',
    icon: '⏰',
    tag: 'Prescricao',
    tagColor: '#92400E',
  },
  {
    id: 'dl_269_98',
    titulo: 'Art.o 1.o DL 269/98',
    subtitulo: 'Procedimento de injuncao',
    resumo: 'O condominio pode recorrer ao procedimento de injuncao para cobranca de dividas de quotas. Procedimento simplificado, rapido e com custas reduzidas no Balcao Nacional de Injuncoes.',
    icon: '🏛️',
    tag: 'Injuncao',
    tagColor: '#6C5CE7',
  },
  {
    id: 'hipoteca_legal',
    titulo: 'Hipoteca legal do condominio',
    subtitulo: 'Art.o 705.o CC + Propriedade horizontal',
    resumo: 'O condominio goza de hipoteca legal sobre a fracao autonoma do condomino devedor para garantia do pagamento das contribuicoes devidas, incluindo juros de mora e custas judiciais.',
    icon: '🔒',
    tag: 'Garantia',
    tagColor: '#0D1B2E',
  },
  {
    id: 'juros_mora',
    titulo: 'Juros de mora (taxa legal)',
    subtitulo: 'Portaria anual + Art.o 806.o CC',
    resumo: 'O condomino em mora deve juros a taxa legal (atualmente 4% ao ano) sobre as quantias em divida, a contar da data de vencimento de cada prestacao, sem necessidade de interpelacao.',
    icon: '📈',
    tag: 'Juros',
    tagColor: '#1A7A6E',
  },
  {
    id: 'custas_devedor',
    titulo: 'Custas a cargo do devedor',
    subtitulo: 'Art.o 527.o CPC',
    resumo: 'Em caso de acao judicial bem-sucedida, todas as custas do processo (judiciais, advogado, peritos) sao suportadas pelo condomino devedor, incluindo as despesas de cobranca extrajudicial.',
    icon: '💰',
    tag: 'Custas',
    tagColor: '#6B7280',
  },
]

// ─── Componente principal ────────────────────────────────────────────────────

export default function CobrancaJudicialSection({ user, userRole }: Props) {
  const STORAGE_KEY = `fixit_cobranca_${user.id}`

  // ── State
  const [processos, setProcessos] = useState<ProcessoCobranca[]>([])
  const [activeTab, setActiveTab] = useState<'pipeline' | 'processos' | 'modelos' | 'legislacao'>('pipeline')
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoCobranca | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDocPreview, setShowDocPreview] = useState<string | null>(null)
  const [selectedDevedor, setSelectedDevedor] = useState<ProcessoCobranca | null>(null)
  const [copiedDoc, setCopiedDoc] = useState(false)

  // ── Form state
  const [formCondomino, setFormCondomino] = useState('')
  const [formFracao, setFormFracao] = useState('')
  const [formEdificio, setFormEdificio] = useState('')
  const [formNif, setFormNif] = useState('')
  const [formValor, setFormValor] = useState('')
  const [formDataVencimento, setFormDataVencimento] = useState('')
  const [formObs, setFormObs] = useState('')

  // ── Load/Save
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setProcessos(JSON.parse(stored))
      } else {
        const demo = gerarDemoData()
        setProcessos(demo)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = gerarDemoData()
      setProcessos(demo)
    }
  }, [STORAGE_KEY])

  const saveProcessos = (list: ProcessoCobranca[]) => {
    setProcessos(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  // ── KPIs
  const kpis = useMemo(() => {
    const ativos = processos.filter(p => p.status !== 'recuperado' && p.status !== 'prescrito')
    const totalDivida = ativos.reduce((s, p) => s + p.valorDivida, 0)
    const nDevedores = ativos.length
    const mediaAtraso = ativos.length > 0
      ? Math.round(ativos.reduce((s, p) => s + diasEntre(p.dataVencimentoOriginal, new Date().toISOString().split('T')[0]), 0) / ativos.length)
      : 0
    const recuperadoAno = processos
      .filter(p => p.status === 'recuperado')
      .reduce((s, p) => s + p.valorOriginal, 0)
    return { totalDivida, nDevedores, mediaAtraso, recuperadoAno }
  }, [processos])

  // ── Alertas 90 dias
  const alertas90dias = useMemo(() => {
    return processos.filter(p => {
      if (p.status === 'recuperado' || p.status === 'prescrito') return false
      if (p.etapa === 'injuncao_acao' || p.etapa === 'penhora_hipoteca') return false
      const diasDesdeVencimento = diasEntre(p.dataVencimentoOriginal, new Date().toISOString().split('T')[0])
      return diasDesdeVencimento >= 75 // Alerta a partir de 75 dias (15 dias antes do limite)
    })
  }, [processos])

  // ── Handlers
  const handleAddProcesso = () => {
    if (!formCondomino.trim() || !formValor || !formDataVencimento) return
    const hoje = new Date().toISOString().split('T')[0]
    const valor = parseFloat(formValor)
    const novo: ProcessoCobranca = {
      id: `cob_${Date.now().toString(36)}`,
      condomino: formCondomino,
      fracao: formFracao,
      edificio: formEdificio,
      nif: formNif || undefined,
      valorDivida: valor,
      valorOriginal: valor,
      jurosMora: 0,
      dataInicio: hoje,
      dataVencimentoOriginal: formDataVencimento,
      etapa: 'atraso_identificado',
      status: 'em_curso',
      ultimaAcao: 'Processo de cobranca aberto',
      proximaAcao: 'Contacto amigavel (15 dias)',
      dataLimite: addDias(hoje, 15),
      historico: [{ id: `h_${Date.now()}`, data: hoje, descricao: 'Processo de cobranca judicial aberto', tipo: 'automatico' }],
      documentosGerados: [],
      observacoes: formObs || undefined,
      dataPrescricao: addDias(formDataVencimento, 5 * 365),
    }
    saveProcessos([novo, ...processos])
    setShowAddModal(false)
    setFormCondomino(''); setFormFracao(''); setFormEdificio(''); setFormNif(''); setFormValor(''); setFormDataVencimento(''); setFormObs('')
  }

  const avancarEtapa = (id: string) => {
    const updated = processos.map(p => {
      if (p.id !== id) return p
      const idx = ETAPA_ORDER.indexOf(p.etapa)
      if (idx >= ETAPA_ORDER.length - 1) return p
      const nextEtapa = ETAPA_ORDER[idx + 1]
      const nextInfo = ETAPAS.find(e => e.key === nextEtapa)!
      const hoje = new Date().toISOString().split('T')[0]
      const newStatus: StatusProcesso = (nextEtapa === 'injuncao_acao' || nextEtapa === 'penhora_hipoteca') ? 'pendente_judicial' : 'em_curso'
      return {
        ...p,
        etapa: nextEtapa,
        status: newStatus,
        ultimaAcao: nextInfo.descricao,
        proximaAcao: idx + 2 < ETAPA_ORDER.length ? ETAPAS[idx + 2].label : 'Aguardar decisao judicial',
        dataLimite: nextEtapa === 'contacto_amigavel' ? addDias(hoje, 15)
          : nextEtapa === 'notificacao_formal' ? addDias(hoje, 30)
          : nextEtapa === 'prazo_90_dias' ? addDias(p.dataVencimentoOriginal, 90)
          : addDias(hoje, 180),
        historico: [...p.historico, { id: `h_${Date.now()}`, data: hoje, descricao: `Avancar para: ${nextInfo.label}`, tipo: 'manual' as const }],
      }
    })
    saveProcessos(updated)
    if (selectedProcesso?.id === id) setSelectedProcesso(updated.find(p => p.id === id) || null)
  }

  const marcarRecuperado = (id: string) => {
    const hoje = new Date().toISOString().split('T')[0]
    const updated = processos.map(p =>
      p.id !== id ? p : {
        ...p,
        status: 'recuperado' as StatusProcesso,
        valorDivida: 0,
        ultimaAcao: 'Divida recuperada integralmente',
        proximaAcao: '---',
        dataLimite: '---',
        historico: [...p.historico, { id: `h_${Date.now()}`, data: hoje, descricao: 'Pagamento recebido - divida recuperada', tipo: 'manual' as const }],
      }
    )
    saveProcessos(updated)
    setSelectedProcesso(null)
  }

  const gerarDocumento = (modeloId: string, processo?: ProcessoCobranca) => {
    const p = processo || selectedDevedor
    if (!p) return ''
    const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

    switch (modeloId) {
      case 'lembrete_amigavel':
        return `LEMBRETE DE PAGAMENTO\n\nExmo(a) Sr(a) ${p.condomino}\nFracao: ${p.fracao}\nEdificio: ${p.edificio}\n\nVimos, por este meio, informar V. Exa. de que se encontra em atraso o pagamento das quotas de condominio, no valor total de ${formatEur(p.valorDivida)}.\n\nData de vencimento original: ${formatDate(p.dataVencimentoOriginal)}\n\nSolicitamos a regularizacao desta situacao no prazo de 15 dias. Caso ja tenha efetuado o pagamento, queira por favor desconsiderar esta comunicacao.\n\nPara qualquer esclarecimento ou acordo de pagamento, nao hesite em contactar-nos.\n\nCom os melhores cumprimentos,\nA Administracao do Condominio\n${hoje}`

      case 'notificacao_lrar':
        return `NOTIFICACAO FORMAL — CARTA REGISTADA COM AVISO DE RECECAO\n\nExmo(a) Sr(a) ${p.condomino}\n${p.nif ? `NIF: ${p.nif}\n` : ''}Fracao: ${p.fracao}\nEdificio: ${p.edificio}\n\nAssunto: Quotas de condominio em divida — Notificacao nos termos da Lei 8/2022\n\nPela presente, notificamos V. Exa. de que se encontra em divida para com o condominio do edificio acima identificado, no montante de ${formatEur(p.valorDivida)} (capital: ${formatEur(p.valorOriginal)} + juros de mora: ${formatEur(p.jurosMora)}), referente a quotas vencidas desde ${formatDate(p.dataVencimentoOriginal)}.\n\nNos termos do Art.o 1424.o do Codigo Civil e da Lei 8/2022, o administrador e obrigado a instaurar acao judicial quando o atraso exceda 90 dias.\n\nConcedemos-lhe o prazo de 30 (trinta) dias a contar da rececao desta carta para proceder ao pagamento integral ou propor um plano de pagamento.\n\nFindo este prazo sem que se verifique qualquer pagamento ou acordo, seremos forcados a instaurar procedimento de injuncao (DL 269/98) ou acao judicial, sendo que todas as custas serao imputadas a V. Exa.\n\nInformamos ainda que o condominio goza de hipoteca legal sobre a fracao autonoma de V. Exa. para garantia da divida.\n\nFicamos ao dispor para qualquer esclarecimento.\n\nA Administracao do Condominio\n${hoje}\n\n[Enviar por carta registada com aviso de rececao (LRAR)]`

      case 'requerimento_injuncao':
        return `REQUERIMENTO DE INJUNCAO\n(Decreto-Lei n.o 269/98, de 1 de setembro)\n\nBalcao Nacional de Injuncoes\n\nREQUERENTE:\nCondominio do ${p.edificio}\nNIPE: [Inserir NIPE do condominio]\nMorada: [Morada do edificio]\nRepresentado pelo Administrador: [Nome]\n\nREQUERIDO:\n${p.condomino}\n${p.nif ? `NIF: ${p.nif}\n` : ''}Fracao: ${p.fracao}\n\nVALOR: ${formatEur(p.valorDivida)}\n(Capital: ${formatEur(p.valorOriginal)} + Juros de mora: ${formatEur(p.jurosMora)})\n\nFACTOS:\n1. O Requerido e proprietario da ${p.fracao} do ${p.edificio}.\n2. Encontram-se em divida quotas de condominio vencidas desde ${formatDate(p.dataVencimentoOriginal)}.\n3. O Requerido foi interpelado por carta registada (LRAR) em [data], sem que tenha procedido ao pagamento.\n4. O prazo de 90 dias previsto na Lei 8/2022 ja se encontra ultrapassado.\n5. Os juros de mora ascendem a ${formatEur(p.jurosMora)} (taxa legal de ${TAXA_JUROS_MORA_ANUAL * 100}%).\n\nFUNDAMENTOS DE DIREITO:\n- Art.o 1424.o do Codigo Civil (obrigacao de pagamento de quotas)\n- Lei 8/2022 (prazo de 90 dias para acao judicial)\n- Art.o 1.o do DL 269/98 (procedimento de injuncao)\n- Art.o 806.o do Codigo Civil (juros de mora)\n\nPEDIDO:\nRequer-se a notificacao do Requerido para pagar ao Requerente a quantia de ${formatEur(p.valorDivida)}, acrescida de juros de mora vincendos ate efetivo pagamento.\n\nData: ${hoje}\n\nO Administrador do Condominio\n[Assinatura]`

      case 'comunicacao_ag':
        const ativos = processos.filter(p => p.status !== 'recuperado' && p.status !== 'prescrito')
        const totalAtivo = ativos.reduce((s, p) => s + p.valorDivida, 0)
        return `PONTO DE SITUACAO — DIVIDAS DE CONDOMINOS\nPara apresentacao em Assembleia Geral\n\n${hoje}\n\nRESUMO:\n- Total em divida: ${formatEur(totalAtivo)}\n- Numero de processos ativos: ${ativos.length}\n- Valor recuperado este ano: ${formatEur(kpis.recuperadoAno)}\n\nDETALHE DOS PROCESSOS:\n${ativos.map((proc, i) => `\n${i + 1}. ${proc.condomino} — ${proc.fracao}\n   Divida: ${formatEur(proc.valorDivida)} | Etapa: ${ETAPAS.find(e => e.key === proc.etapa)?.label}\n   Ultima acao: ${proc.ultimaAcao}`).join('\n')}\n\nNOTAS LEGAIS:\n- Conforme Lei 8/2022, o administrador e obrigado a instaurar acao judicial apos 90 dias de atraso.\n- O prazo de prescricao e de 5 anos (Art.o 310.o CC).\n- Os juros de mora sao calculados a taxa legal de ${TAXA_JUROS_MORA_ANUAL * 100}% ao ano.\n\nSolicitamos mandato da AG para [prosseguir/instaurar] os procedimentos judiciais necessarios.\n\nO Administrador`

      default:
        return ''
    }
  }

  // ── Tabs config
  const TABS: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'pipeline',   label: 'Pipeline',    icon: '📊' },
    { key: 'processos',  label: 'Processos',   icon: '📁' },
    { key: 'modelos',    label: 'Modelos',      icon: '📄' },
    { key: 'legislacao', label: 'Legislacao', icon: '⚖️' },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>
            Cobranca Judicial
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
            Gestao automatizada de cobranca de dividas ao condominio (Lei portuguesa)
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition hover:opacity-90"
          style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff' }}
        >
          + Novo processo
        </button>
      </div>

      {/* Alertas 90 dias */}
      {alertas90dias.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: '#FEF3C7', borderColor: '#F59E0B' }}>
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#92400E' }}>
                Alerta Lei 8/2022 — Prazo de 90 dias a expirar
              </p>
              <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                {alertas90dias.length} processo(s) com atraso superior a 75 dias. A lei obriga a instauracao de acao judicial apos 90 dias.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {alertas90dias.map(p => (
                  <span key={p.id} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#FDE68A', color: '#78350F' }}>
                    {p.condomino} — {diasEntre(p.dataVencimentoOriginal, new Date().toISOString().split('T')[0])} dias
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            style={{
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'var(--sd-ink-3, #8B8178)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════ Tab 1: Pipeline ═══════════ */}
      {activeTab === 'pipeline' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total em divida',    value: formatEur(kpis.totalDivida),     icon: '💰', bg: '#FEE2E2', color: '#991B1B' },
              { label: 'N.o devedores',       value: kpis.nDevedores.toString(),      icon: '👥', bg: '#DBEAFE', color: '#1E40AF' },
              { label: 'Media dias atraso',   value: `${kpis.mediaAtraso} dias`,      icon: '📅', bg: '#FEF3C7', color: '#92400E' },
              { label: 'Recuperado este ano', value: formatEur(kpis.recuperadoAno),   icon: '✅', bg: '#D1FAE5', color: '#065F46' },
            ].map((kpi, i) => (
              <div key={i} className="rounded-xl border p-4 text-center" style={{ background: kpi.bg, borderColor: 'var(--sd-border, #E4DDD0)' }}>
                <span className="text-lg">{kpi.icon}</span>
                <p className="text-xl font-bold mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: kpi.color, opacity: 0.8 }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Kanban Pipeline */}
          <div className="rounded-2xl border shadow-sm p-4 overflow-x-auto" style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
              Pipeline de cobranca
            </p>
            <div className="flex gap-3 min-w-max">
              {ETAPAS.map((etapa, idx) => {
                const cardsNaEtapa = processos.filter(p => p.etapa === etapa.key && p.status !== 'recuperado' && p.status !== 'prescrito')
                return (
                  <div
                    key={etapa.key}
                    className="flex-1 min-w-[200px] rounded-xl border p-3"
                    style={{ background: cardsNaEtapa.length > 0 ? 'var(--sd-cream, #F7F4EE)' : '#FAFAF9', borderColor: 'var(--sd-border, #E4DDD0)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{etapa.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{etapa.label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>{etapa.prazo}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cardsNaEtapa.length > 0 ? 'var(--sd-gold, #C9A84C)' : '#D1D5DB', color: '#fff' }}>
                        {cardsNaEtapa.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {cardsNaEtapa.map(p => {
                        const diasAtraso = diasEntre(p.dataVencimentoOriginal, new Date().toISOString().split('T')[0])
                        const diasRestantes = p.dataLimite !== '---' ? diasAte(p.dataLimite) : null
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProcesso(p)}
                            className="rounded-lg border p-3 cursor-pointer hover:shadow-md transition"
                            style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}
                          >
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{p.condomino}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>{p.fracao}</p>
                            <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--sd-gold, #C9A84C)' }}>{formatEur(p.valorDivida)}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                                {diasAtraso} dias atraso
                              </span>
                              {diasRestantes !== null && diasRestantes <= 15 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                                  {diasRestantes}d restantes
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] mt-1.5 truncate" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
                              Proxima: {p.proximaAcao}
                            </p>
                          </div>
                        )
                      })}
                      {cardsNaEtapa.length === 0 && (
                        <p className="text-[10px] text-center py-3" style={{ color: '#D1D5DB' }}>Sem processos</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Tab 2: Processos ═══════════ */}
      {activeTab === 'processos' && (
        <div className="space-y-4">
          {/* Table */}
          <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    {['Condomino', 'Fracao', 'Valor', 'Inicio', 'Etapa', 'Ultima acao', 'Proxima acao', 'Data limite', 'Status'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processos.map(p => {
                    const statusCfg = STATUS_CONFIG[p.status]
                    const diasPrescricao = diasAte(p.dataPrescricao)
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProcesso(p)}
                        className="border-t cursor-pointer hover:bg-gray-50 transition"
                        style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}
                      >
                        <td className="px-3 py-3 font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{p.condomino}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{p.fracao}</td>
                        <td className="px-3 py-3 font-bold" style={{ color: p.valorDivida > 0 ? '#DC2626' : '#059669' }}>{formatEur(p.valorDivida)}</td>
                        <td className="px-3 py-3 text-xs">{formatDate(p.dataInicio)}</td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] px-2 py-1 rounded-lg font-medium whitespace-nowrap" style={{ background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-navy, #0D1B2E)' }}>
                            {ETAPAS.find(e => e.key === p.etapa)?.icon} {ETAPAS.find(e => e.key === p.etapa)?.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{p.ultimaAcao}</td>
                        <td className="px-3 py-3 text-xs max-w-[150px] truncate" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{p.proximaAcao}</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{p.dataLimite !== '---' ? formatDate(p.dataLimite) : '---'}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap"
                            style={{ background: statusCfg.bg, color: statusCfg.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Prescricao tracker */}
          <div className="rounded-2xl border shadow-sm p-4" style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
              Tracker de prescricao (Art.o 310.o CC — 5 anos)
            </p>
            <div className="space-y-2">
              {processos.filter(p => p.status !== 'recuperado').map(p => {
                const diasTotal = 5 * 365
                const diasPassados = diasEntre(p.dataVencimentoOriginal, new Date().toISOString().split('T')[0])
                const percentagem = Math.min(100, Math.max(0, (diasPassados / diasTotal) * 100))
                const diasRestantes = diasAte(p.dataPrescricao)
                const urgente = diasRestantes < 365
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <p className="text-xs font-medium min-w-[160px] truncate" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{p.condomino}</p>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentagem}%`,
                          background: urgente ? '#EF4444' : percentagem > 60 ? '#F59E0B' : '#10B981',
                        }}
                      />
                    </div>
                    <p className="text-[10px] font-bold min-w-[80px] text-right" style={{ color: urgente ? '#EF4444' : 'var(--sd-ink-2, #6B6560)' }}>
                      {diasRestantes > 0 ? `${diasRestantes} dias` : 'PRESCRITO'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Tab 3: Modelos ═══════════ */}
      {activeTab === 'modelos' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>
            Modelos de documentos pre-preenchidos com os dados do devedor. Selecione um devedor e gere o documento.
          </p>

          {/* Selecionar devedor */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--sd-cream, #F7F4EE)', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>Selecionar devedor:</p>
            <div className="flex flex-wrap gap-2">
              {processos.filter(p => p.status !== 'recuperado').map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedDevedor(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition border"
                  style={{
                    background: selectedDevedor?.id === p.id ? 'var(--sd-navy, #0D1B2E)' : '#fff',
                    color: selectedDevedor?.id === p.id ? '#fff' : 'var(--sd-navy, #0D1B2E)',
                    borderColor: 'var(--sd-border, #E4DDD0)',
                  }}
                >
                  {p.condomino} — {formatEur(p.valorDivida)}
                </button>
              ))}
            </div>
          </div>

          {/* Modelos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODELOS_DOCUMENTOS.map(modelo => (
              <div
                key={modelo.id}
                className="rounded-2xl border p-5 space-y-3"
                style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{modelo.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{modelo.titulo}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>{modelo.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-ink-2, #6B6560)' }}>
                    Etapa: {ETAPAS.find(e => e.key === modelo.etapaRelacionada)?.label}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!selectedDevedor && modelo.id !== 'comunicacao_ag') return
                    setShowDocPreview(modelo.id)
                    setCopiedDoc(false)
                  }}
                  disabled={!selectedDevedor && modelo.id !== 'comunicacao_ag'}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{
                    background: (selectedDevedor || modelo.id === 'comunicacao_ag') ? 'var(--sd-gold, #C9A84C)' : '#E5E7EB',
                    color: (selectedDevedor || modelo.id === 'comunicacao_ag') ? '#fff' : '#9CA3AF',
                    cursor: (selectedDevedor || modelo.id === 'comunicacao_ag') ? 'pointer' : 'not-allowed',
                  }}
                >
                  Gerar documento
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ Tab 4: Legislacao ═══════════ */}
      {activeTab === 'legislacao' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>
            Referencias legais aplicaveis a cobranca de dividas em condominio (legislacao portuguesa).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LEGISLACAO.map(lei => (
              <div
                key={lei.id}
                className="rounded-2xl border p-5 space-y-3"
                style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{lei.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{lei.titulo}</p>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${lei.tagColor}18`, color: lei.tagColor }}
                      >
                        {lei.tag}
                      </span>
                    </div>
                    <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--sd-gold, #C9A84C)' }}>{lei.subtitulo}</p>
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{lei.resumo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ Modal: Detail processo ═══════════ */}
      {selectedProcesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-xl p-6" style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{selectedProcesso.condomino}</h2>
                <p className="text-sm" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{selectedProcesso.fracao} — {selectedProcesso.edificio}</p>
              </div>
              <button onClick={() => setSelectedProcesso(null)} className="text-xl p-1 hover:bg-gray-100 rounded-lg transition">X</button>
            </div>

            {/* Status + etapa */}
            <div className="flex items-center gap-3 mb-5">
              <span
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: STATUS_CONFIG[selectedProcesso.status].bg, color: STATUS_CONFIG[selectedProcesso.status].color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: STATUS_CONFIG[selectedProcesso.status].dot }} />
                {STATUS_CONFIG[selectedProcesso.status].label}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-navy, #0D1B2E)' }}>
                {ETAPAS.find(e => e.key === selectedProcesso.etapa)?.icon} {ETAPAS.find(e => e.key === selectedProcesso.etapa)?.label}
              </span>
            </div>

            {/* Dados financeiros */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}>
                <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{formatEur(selectedProcesso.valorDivida)}</p>
                <p className="text-[10px]" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>Divida total</p>
              </div>
              <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{formatEur(selectedProcesso.valorOriginal)}</p>
                <p className="text-[10px]" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>Capital</p>
              </div>
              <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}>
                <p className="text-lg font-bold" style={{ color: '#F59E0B' }}>{formatEur(selectedProcesso.jurosMora)}</p>
                <p className="text-[10px]" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>Juros mora</p>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5 text-xs" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>
              <div>Data vencimento: <span className="font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{formatDateLong(selectedProcesso.dataVencimentoOriginal)}</span></div>
              <div>Data inicio processo: <span className="font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{formatDateLong(selectedProcesso.dataInicio)}</span></div>
              <div>Data limite: <span className="font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{selectedProcesso.dataLimite !== '---' ? formatDateLong(selectedProcesso.dataLimite) : '---'}</span></div>
              <div>Prescricao: <span className="font-medium" style={{ color: diasAte(selectedProcesso.dataPrescricao) < 365 ? '#DC2626' : 'var(--sd-navy, #0D1B2E)' }}>{formatDateLong(selectedProcesso.dataPrescricao)} ({diasAte(selectedProcesso.dataPrescricao)} dias)</span></div>
              {selectedProcesso.nif && <div>NIF: <span className="font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{selectedProcesso.nif}</span></div>}
            </div>

            {/* Timeline */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
                Historico de acoes
              </p>
              <div className="space-y-0">
                {selectedProcesso.historico.map((h, i) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full mt-1" style={{
                        background: h.tipo === 'automatico' ? '#3B82F6'
                          : h.tipo === 'documento' ? 'var(--sd-gold, #C9A84C)'
                          : h.tipo === 'comunicacao' ? '#10B981'
                          : 'var(--sd-navy, #0D1B2E)',
                      }} />
                      {i < selectedProcesso.historico.length - 1 && (
                        <div className="w-px flex-1 min-h-[20px]" style={{ background: 'var(--sd-border, #E4DDD0)' }} />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-medium" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{h.descricao}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>{formatDateLong(h.data)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documentos gerados */}
            {selectedProcesso.documentosGerados.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--sd-ink-3, #8B8178)' }}>
                  Documentos gerados
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedProcesso.documentosGerados.map((doc, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--sd-border, #E4DDD0)', color: 'var(--sd-navy, #0D1B2E)' }}>
                      📄 {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {selectedProcesso.status !== 'recuperado' && selectedProcesso.status !== 'prescrito' && (
              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--sd-border, #E4DDD0)' }}>
                <button
                  onClick={() => avancarEtapa(selectedProcesso.id)}
                  disabled={selectedProcesso.etapa === 'penhora_hipoteca'}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                  style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff' }}
                >
                  Avancar etapa
                </button>
                <button
                  onClick={() => marcarRecuperado(selectedProcesso.id)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                  style={{ background: '#D1FAE5', color: '#065F46' }}
                >
                  Marcar recuperado
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Modal: Novo processo ═══════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl border shadow-xl p-6" style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>Novo processo de cobranca</h2>
              <button onClick={() => setShowAddModal(false)} className="text-xl p-1 hover:bg-gray-100 rounded-lg transition">X</button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Condomino *', value: formCondomino, set: setFormCondomino, placeholder: 'Nome completo' },
                { label: 'Fracao', value: formFracao, set: setFormFracao, placeholder: 'Ex: Fracao A - 1.o Esq.' },
                { label: 'Edificio', value: formEdificio, set: setFormEdificio, placeholder: 'Nome do edificio' },
                { label: 'NIF', value: formNif, set: setFormNif, placeholder: 'Numero de contribuinte' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-medium" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>{f.label}</label>
                  <input
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none transition focus:ring-2"
                    style={{ borderColor: 'var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)' }}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>Valor da divida (EUR) *</label>
                  <input
                    type="number"
                    value={formValor}
                    onChange={e => setFormValor(e.target.value)}
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none transition focus:ring-2"
                    style={{ borderColor: 'var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>Data vencimento *</label>
                  <input
                    type="date"
                    value={formDataVencimento}
                    onChange={e => setFormDataVencimento(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none transition focus:ring-2"
                    style={{ borderColor: 'var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: 'var(--sd-ink-2, #6B6560)' }}>Observacoes</label>
                <textarea
                  value={formObs}
                  onChange={e => setFormObs(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none transition focus:ring-2 resize-none"
                  style={{ borderColor: 'var(--sd-border, #E4DDD0)', background: 'var(--sd-cream, #F7F4EE)' }}
                />
              </div>
              <button
                onClick={handleAddProcesso}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90"
                style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff' }}
              >
                Criar processo de cobranca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Modal: Document preview ═══════════ */}
      {showDocPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-xl p-6" style={{ background: '#fff', borderColor: 'var(--sd-border, #E4DDD0)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--sd-navy, #0D1B2E)' }}>
                {MODELOS_DOCUMENTOS.find(m => m.id === showDocPreview)?.titulo}
              </h2>
              <button onClick={() => { setShowDocPreview(null); setCopiedDoc(false) }} className="text-xl p-1 hover:bg-gray-100 rounded-lg transition">X</button>
            </div>
            <pre
              className="whitespace-pre-wrap text-xs leading-relaxed p-4 rounded-xl border overflow-auto max-h-[50vh]"
              style={{ background: 'var(--sd-cream, #F7F4EE)', borderColor: 'var(--sd-border, #E4DDD0)', color: 'var(--sd-navy, #0D1B2E)', fontFamily: 'inherit' }}
            >
              {gerarDocumento(showDocPreview)}
            </pre>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(gerarDocumento(showDocPreview))
                  setCopiedDoc(true)
                  setTimeout(() => setCopiedDoc(false), 2000)
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                style={{ background: copiedDoc ? '#D1FAE5' : 'var(--sd-navy, #0D1B2E)', color: copiedDoc ? '#065F46' : '#fff' }}
              >
                {copiedDoc ? 'Copiado!' : 'Copiar documento'}
              </button>
              <button
                onClick={() => { setShowDocPreview(null); setCopiedDoc(false) }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition"
                style={{ borderColor: 'var(--sd-border, #E4DDD0)', color: 'var(--sd-ink-2, #6B6560)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
