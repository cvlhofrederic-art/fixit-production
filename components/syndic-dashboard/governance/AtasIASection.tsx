'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabAtas = 'gerar' | 'geradas' | 'modelos'
type WizardStep = 1 | 2 | 3 | 4
type TipoLocal = 'presencial' | 'videoconferencia' | 'hibrido'
type TipoAG = 'ordinaria' | 'extraordinaria'
type TipoMaioria = 'simples' | 'qualificada' | 'unanimidade'
type VotoTipo = 'favoravel' | 'contra' | 'abstencao'
type EstadoAta = 'rascunho' | 'final' | 'assinada'
type PresencaStatus = 'presente' | 'ausente' | 'representado'

interface Condomino {
  id: string
  nome: string
  fracao: string
  permilagem: number
  presenca: PresencaStatus
  representante?: string
  horaEntrada?: string
}

interface VotoCondomino {
  condominoId: string
  voto: VotoTipo
}

interface Deliberacao {
  id: string
  pontoOrdem: number
  titulo: string
  descricao: string
  tipoMaioria: TipoMaioria
  votos: VotoCondomino[]
  resultado?: 'aprovada' | 'rejeitada' | 'sem_quorum'
}

interface Assinatura {
  cargo: string
  nome: string
  assinado: boolean
  dataAssinatura?: string
}

interface DadosAssembleia {
  data: string
  horaInicio: string
  horaFim: string
  local: string
  tipoLocal: TipoLocal
  tipoAG: TipoAG
  convocatoriaNr: string
  edificioNom: string
}

interface Ata {
  id: string
  numero: number
  dados: DadosAssembleia
  condominos: Condomino[]
  deliberacoes: Deliberacao[]
  assinaturas: Assinatura[]
  estado: EstadoAta
  textoGerado?: string
  criadaEm: string
  atualizadaEm: string
}

interface ModeloAta {
  id: string
  nome: string
  descricao: string
  icon: string
  pontosOrdem: { titulo: string; descricao: string; tipoMaioria: TipoMaioria }[]
  condominosDefault: Omit<Condomino, 'id' | 'presenca' | 'horaEntrada'>[]
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const formatDateShort = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

const TIPO_LOCAL_LABELS: Record<TipoLocal, string> = {
  presencial: 'Presencial',
  videoconferencia: 'Videoconferencia',
  hibrido: 'Hibrido',
}

const TIPO_AG_LABELS: Record<TipoAG, string> = {
  ordinaria: 'Ordinaria',
  extraordinaria: 'Extraordinaria',
}

const TIPO_MAIORIA_LABELS: Record<TipoMaioria, { label: string; ref: string }> = {
  simples: { label: 'Maioria Simples', ref: 'Art.o 1432.o CC' },
  qualificada: { label: 'Maioria Qualificada (2/3)', ref: 'Art.o 1433.o CC' },
  unanimidade: { label: 'Unanimidade', ref: 'Unanimidade requerida' },
}

const ESTADO_CONFIG: Record<EstadoAta, { label: string; bg: string; color: string; dot: string }> = {
  rascunho: { label: 'Rascunho', bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  final: { label: 'Final', bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  assinada: { label: 'Assinada', bg: '#F7F4EE', color: '#0D1B2E', dot: '#0D1B2E' },
}

const WIZARD_STEPS = [
  { num: 1 as WizardStep, label: 'Dados da Assembleia', icon: '📋' },
  { num: 2 as WizardStep, label: 'Presencas', icon: '👥' },
  { num: 3 as WizardStep, label: 'Deliberacoes', icon: '🗳️' },
  { num: 4 as WizardStep, label: 'Revisao & Gerar', icon: '✅' },
]

const ASSINATURAS_DEFAULT: Assinatura[] = [
  { cargo: 'Presidente da Mesa', nome: '', assinado: false },
  { cargo: 'Secretario', nome: '', assinado: false },
  { cargo: '1.o Escrutinador', nome: '', assinado: false },
  { cargo: '2.o Escrutinador', nome: '', assinado: false },
]

// ─── Modelos ─────────────────────────────────────────────────────────────────

const MODELOS: ModeloAta[] = [
  {
    id: 'ag_ordinaria',
    nome: 'AG Ordinaria Anual',
    descricao: 'Modelo completo para assembleia geral ordinaria anual com pontos obrigatorios.',
    icon: '📅',
    pontosOrdem: [
      { titulo: 'Aprovação das contas do exercício anterior', descricao: 'Apresentação e discussão do relatório de contas e parecer do conselho fiscal.', tipoMaioria: 'simples' },
      { titulo: 'Aprovação do orçamento para o exercício seguinte', descricao: 'Proposta de orçamento com detalhe das quotas ordinárias e extraordinárias.', tipoMaioria: 'simples' },
      { titulo: 'Eleição dos órgãos sociais', descricao: 'Eleição do administrador, conselho fiscal e mesa da assembleia.', tipoMaioria: 'simples' },
      { titulo: 'Aprovação do seguro do edifício', descricao: 'Renovação ou alteração da apólice de seguro obrigatório (DL 268/94).', tipoMaioria: 'simples' },
      { titulo: 'Fundo comum de reserva', descricao: 'Definição da contribuição mínima de 10% para o fundo de reserva (Art.o 4.o DL 268/94).', tipoMaioria: 'simples' },
      { titulo: 'Outros assuntos', descricao: 'Assuntos diversos apresentados pelos condóminos.', tipoMaioria: 'simples' },
    ],
    condominosDefault: [
      { nome: 'Maria Silva', fracao: 'A', permilagem: 85 },
      { nome: 'Joao Santos', fracao: 'B', permilagem: 120 },
      { nome: 'Ana Costa', fracao: 'C', permilagem: 95 },
      { nome: 'Pedro Oliveira', fracao: 'D', permilagem: 110 },
      { nome: 'Carla Ferreira', fracao: 'E', permilagem: 75 },
      { nome: 'Rui Mendes', fracao: 'F', permilagem: 130 },
      { nome: 'Teresa Lopes', fracao: 'G', permilagem: 90 },
      { nome: 'Miguel Rodrigues', fracao: 'H', permilagem: 105 },
      { nome: 'Sofia Almeida', fracao: 'I', permilagem: 100 },
      { nome: 'Bruno Pereira', fracao: 'J', permilagem: 90 },
    ],
  },
  {
    id: 'ag_extra_obras',
    nome: 'AG Extraordinaria — Obras',
    descricao: 'Modelo para votação de obras de conservação ou valorização do edifício.',
    icon: '🏗️',
    pontosOrdem: [
      { titulo: 'Apresentação do projeto de obras', descricao: 'Descrição detalhada das obras propostas, justificação técnica e prazos previstos.', tipoMaioria: 'simples' },
      { titulo: 'Análise dos orçamentos apresentados', descricao: 'Comparação de, no mínimo, 3 orçamentos de empresas diferentes.', tipoMaioria: 'simples' },
      { titulo: 'Aprovação do orçamento e empresa executante', descricao: 'Votação para seleção da empresa e aprovação do valor.', tipoMaioria: 'qualificada' },
      { titulo: 'Forma de financiamento', descricao: 'Definicao das quotas extraordinarias ou utilizacao do fundo de reserva.', tipoMaioria: 'qualificada' },
      { titulo: 'Acompanhamento e fiscalizacao', descricao: 'Nomeacao de responsavel pelo acompanhamento da obra.', tipoMaioria: 'simples' },
    ],
    condominosDefault: [
      { nome: 'Maria Silva', fracao: 'A', permilagem: 85 },
      { nome: 'Joao Santos', fracao: 'B', permilagem: 120 },
      { nome: 'Ana Costa', fracao: 'C', permilagem: 95 },
      { nome: 'Pedro Oliveira', fracao: 'D', permilagem: 110 },
      { nome: 'Carla Ferreira', fracao: 'E', permilagem: 75 },
      { nome: 'Rui Mendes', fracao: 'F', permilagem: 130 },
    ],
  },
  {
    id: 'ag_extra_admin',
    nome: 'AG Extraordinaria — Eleicao Administrador',
    descricao: 'Modelo para eleicao ou substituicao do administrador do condominio.',
    icon: '👔',
    pontosOrdem: [
      { titulo: 'Cessacao de funcoes do administrador atual', descricao: 'Apresentacao dos motivos para a cessacao (renuncia, destituicao ou fim de mandato).', tipoMaioria: 'simples' },
      { titulo: 'Apresentacao de candidaturas', descricao: 'Apresentacao dos candidatos a administrador (condomino ou empresa externa).', tipoMaioria: 'simples' },
      { titulo: 'Eleicao do novo administrador', descricao: 'Votacao para eleicao do administrador por maioria dos votos (Art.o 1435.o CC).', tipoMaioria: 'simples' },
      { titulo: 'Definicao da remuneracao', descricao: 'Aprovacao dos honorarios do novo administrador.', tipoMaioria: 'simples' },
      { titulo: 'Entrega de documentacao', descricao: 'Definicao de prazo para entrega de toda a documentacao pelo administrador cessante.', tipoMaioria: 'simples' },
    ],
    condominosDefault: [
      { nome: 'Maria Silva', fracao: 'A', permilagem: 85 },
      { nome: 'Joao Santos', fracao: 'B', permilagem: 120 },
      { nome: 'Ana Costa', fracao: 'C', permilagem: 95 },
      { nome: 'Pedro Oliveira', fracao: 'D', permilagem: 110 },
      { nome: 'Carla Ferreira', fracao: 'E', permilagem: 75 },
      { nome: 'Rui Mendes', fracao: 'F', permilagem: 130 },
      { nome: 'Teresa Lopes', fracao: 'G', permilagem: 90 },
      { nome: 'Miguel Rodrigues', fracao: 'H', permilagem: 105 },
    ],
  },
]

// ─── Demo data ───────────────────────────────────────────────────────────────

function generateDemoData(): Ata[] {
  const condominosDemo: Condomino[] = [
    { id: 'c1', nome: 'Maria Silva', fracao: 'A', permilagem: 85, presenca: 'presente', horaEntrada: '19:05' },
    { id: 'c2', nome: 'Joao Santos', fracao: 'B', permilagem: 120, presenca: 'presente', horaEntrada: '19:00' },
    { id: 'c3', nome: 'Ana Costa', fracao: 'C', permilagem: 95, presenca: 'representado', representante: 'Luis Costa', horaEntrada: '19:10' },
    { id: 'c4', nome: 'Pedro Oliveira', fracao: 'D', permilagem: 110, presenca: 'ausente' },
    { id: 'c5', nome: 'Carla Ferreira', fracao: 'E', permilagem: 75, presenca: 'presente', horaEntrada: '19:02' },
    { id: 'c6', nome: 'Rui Mendes', fracao: 'F', permilagem: 130, presenca: 'presente', horaEntrada: '19:00' },
    { id: 'c7', nome: 'Teresa Lopes', fracao: 'G', permilagem: 90, presenca: 'presente', horaEntrada: '19:08' },
    { id: 'c8', nome: 'Miguel Rodrigues', fracao: 'H', permilagem: 105, presenca: 'ausente' },
    { id: 'c9', nome: 'Sofia Almeida', fracao: 'I', permilagem: 100, presenca: 'presente', horaEntrada: '19:15' },
    { id: 'c10', nome: 'Bruno Pereira', fracao: 'J', permilagem: 90, presenca: 'presente', horaEntrada: '19:03' },
  ]

  return [
    {
      id: 'ata-demo-1',
      numero: 1,
      dados: {
        data: '2026-01-15',
        horaInicio: '19:00',
        horaFim: '21:30',
        local: 'Sala de reunioes do edificio',
        tipoLocal: 'presencial',
        tipoAG: 'ordinaria',
        convocatoriaNr: '1/2026',
        edificioNom: 'Edificio Marques de Pombal',
      },
      condominos: condominosDemo,
      deliberacoes: [
        {
          id: 'd1', pontoOrdem: 1, titulo: 'Aprovacao das contas 2025',
          descricao: 'Aprovacao do relatorio de contas do exercicio de 2025.',
          tipoMaioria: 'simples',
          votos: [
            { condominoId: 'c1', voto: 'favoravel' }, { condominoId: 'c2', voto: 'favoravel' },
            { condominoId: 'c3', voto: 'favoravel' }, { condominoId: 'c5', voto: 'favoravel' },
            { condominoId: 'c6', voto: 'contra' }, { condominoId: 'c7', voto: 'favoravel' },
            { condominoId: 'c9', voto: 'favoravel' }, { condominoId: 'c10', voto: 'abstencao' },
          ],
          resultado: 'aprovada',
        },
        {
          id: 'd2', pontoOrdem: 2, titulo: 'Orcamento 2026',
          descricao: 'Aprovacao do orcamento e quotas para o exercicio de 2026.',
          tipoMaioria: 'simples',
          votos: [
            { condominoId: 'c1', voto: 'favoravel' }, { condominoId: 'c2', voto: 'favoravel' },
            { condominoId: 'c3', voto: 'favoravel' }, { condominoId: 'c5', voto: 'favoravel' },
            { condominoId: 'c6', voto: 'favoravel' }, { condominoId: 'c7', voto: 'favoravel' },
            { condominoId: 'c9', voto: 'contra' }, { condominoId: 'c10', voto: 'favoravel' },
          ],
          resultado: 'aprovada',
        },
      ],
      assinaturas: [
        { cargo: 'Presidente da Mesa', nome: 'Joao Santos', assinado: true, dataAssinatura: '2026-01-15' },
        { cargo: 'Secretario', nome: 'Maria Silva', assinado: true, dataAssinatura: '2026-01-15' },
        { cargo: '1.o Escrutinador', nome: 'Rui Mendes', assinado: true, dataAssinatura: '2026-01-15' },
        { cargo: '2.o Escrutinador', nome: 'Teresa Lopes', assinado: true, dataAssinatura: '2026-01-15' },
      ],
      estado: 'assinada',
      criadaEm: '2026-01-15T19:00:00Z',
      atualizadaEm: '2026-01-15T22:00:00Z',
    },
    {
      id: 'ata-demo-2',
      numero: 2,
      dados: {
        data: '2026-03-05',
        horaInicio: '20:00',
        horaFim: '22:00',
        local: 'Zoom — link enviado por email',
        tipoLocal: 'videoconferencia',
        tipoAG: 'extraordinaria',
        convocatoriaNr: '2/2026',
        edificioNom: 'Edificio Marques de Pombal',
      },
      condominos: condominosDemo.map(c => ({ ...c, presenca: ['c1', 'c2', 'c5', 'c6', 'c9'].includes(c.id) ? 'presente' as const : 'ausente' as const, horaEntrada: ['c1', 'c2', 'c5', 'c6', 'c9'].includes(c.id) ? '20:00' : undefined })),
      deliberacoes: [
        {
          id: 'd3', pontoOrdem: 1, titulo: 'Obras de reabilitacao da fachada',
          descricao: 'Aprovacao do projeto de reabilitacao da fachada por valor de 45.000 EUR.',
          tipoMaioria: 'qualificada',
          votos: [
            { condominoId: 'c1', voto: 'favoravel' }, { condominoId: 'c2', voto: 'favoravel' },
            { condominoId: 'c5', voto: 'favoravel' }, { condominoId: 'c6', voto: 'contra' },
            { condominoId: 'c9', voto: 'favoravel' },
          ],
          resultado: 'aprovada',
        },
      ],
      assinaturas: ASSINATURAS_DEFAULT.map(a => ({ ...a })),
      estado: 'rascunho',
      criadaEm: '2026-03-05T20:00:00Z',
      atualizadaEm: '2026-03-05T22:00:00Z',
    },
  ]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AtasIASection({ user, userRole }: Props) {
  const STORAGE_KEY = `fixit_atas_${user?.id || 'demo'}`

  // ── State principal
  const [activeTab, setActiveTab] = useState<TabAtas>('gerar')
  const [atas, setAtas] = useState<Ata[]>([])

  // ── Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [wizardActive, setWizardActive] = useState(false)
  const [editingAtaId, setEditingAtaId] = useState<string | null>(null)

  // ── Step 1: Dados da Assembleia
  const [formDados, setFormDados] = useState<DadosAssembleia>({
    data: '', horaInicio: '19:00', horaFim: '', local: '',
    tipoLocal: 'presencial', tipoAG: 'ordinaria', convocatoriaNr: '', edificioNom: '',
  })

  // ── Step 2: Presencas
  const [condominos, setCondominos] = useState<Condomino[]>([])
  const [novoCondominoNome, setNovoCondominoNome] = useState('')
  const [novoCondominoFracao, setNovoCondominoFracao] = useState('')
  const [novoCondominoPerm, setNovoCondominoPerm] = useState('')

  // ── Step 3: Deliberacoes
  const [deliberacoes, setDeliberacoes] = useState<Deliberacao[]>([])
  const [novaDelibTitulo, setNovaDelibTitulo] = useState('')
  const [novaDelibDesc, setNovaDelibDesc] = useState('')
  const [novaDelibMaioria, setNovaDelibMaioria] = useState<TipoMaioria>('simples')

  // ── Step 4: Assinaturas
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>(ASSINATURAS_DEFAULT.map(a => ({ ...a })))
  const [iaLoading, setIaLoading] = useState(false)
  const [textoPreview, setTextoPreview] = useState('')

  // ── Tab 2: Atas geradas filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoAta | 'todos'>('todos')

  // ── Persistencia
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAtas(parsed)
          return
        }
      }
      // Load demo data if empty
      const demo = generateDemoData()
      setAtas(demo)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    } catch {
      const demo = generateDemoData()
      setAtas(demo)
    }
  }, [STORAGE_KEY])

  const save = useCallback((updated: Ata[]) => {
    setAtas(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [STORAGE_KEY])

  // ── Calculos
  const presentesCondominos = useMemo(() => condominos.filter(c => c.presenca === 'presente' || c.presenca === 'representado'), [condominos])
  const totalPermilagem = useMemo(() => condominos.reduce((s, c) => s + c.permilagem, 0), [condominos])
  const permilagemPresente = useMemo(() => presentesCondominos.reduce((s, c) => s + c.permilagem, 0), [presentesCondominos])
  const quorumPercentage = useMemo(() => totalPermilagem > 0 ? (permilagemPresente / totalPermilagem * 100) : 0, [totalPermilagem, permilagemPresente])

  // Quorum: Lei 8/2022 — 2a convocatoria 25%
  const temQuorum = quorumPercentage >= 25

  // ── Calcular resultado de deliberacao
  const calcularResultado = useCallback((delib: Deliberacao): Deliberacao['resultado'] => {
    if (!temQuorum) return 'sem_quorum'
    const favoraveis = delib.votos.filter(v => v.voto === 'favoravel')
    const contra = delib.votos.filter(v => v.voto === 'contra')
    const permilagemFav = favoraveis.reduce((s, v) => {
      const c = condominos.find(cc => cc.id === v.condominoId)
      return s + (c?.permilagem || 0)
    }, 0)
    const permilagemContra = contra.reduce((s, v) => {
      const c = condominos.find(cc => cc.id === v.condominoId)
      return s + (c?.permilagem || 0)
    }, 0)
    const permilagemTotal = permilagemFav + permilagemContra + delib.votos.filter(v => v.voto === 'abstencao').reduce((s, v) => {
      const c = condominos.find(cc => cc.id === v.condominoId)
      return s + (c?.permilagem || 0)
    }, 0)

    switch (delib.tipoMaioria) {
      case 'simples':
        return permilagemFav > permilagemContra ? 'aprovada' : 'rejeitada'
      case 'qualificada':
        return permilagemTotal > 0 && permilagemFav >= (permilagemTotal * 2 / 3) ? 'aprovada' : 'rejeitada'
      case 'unanimidade':
        return permilagemContra === 0 && permilagemFav > 0 ? 'aprovada' : 'rejeitada'
    }
  }, [condominos, temQuorum])

  // ── Wizard actions
  const resetWizard = () => {
    setWizardActive(false)
    setWizardStep(1)
    setEditingAtaId(null)
    setFormDados({ data: '', horaInicio: '19:00', horaFim: '', local: '', tipoLocal: 'presencial', tipoAG: 'ordinaria', convocatoriaNr: '', edificioNom: '' })
    setCondominos([])
    setDeliberacoes([])
    setAssinaturas(ASSINATURAS_DEFAULT.map(a => ({ ...a })))
    setTextoPreview('')
    setNovoCondominoNome(''); setNovoCondominoFracao(''); setNovoCondominoPerm('')
    setNovaDelibTitulo(''); setNovaDelibDesc(''); setNovaDelibMaioria('simples')
  }

  const startNewAta = () => {
    resetWizard()
    setWizardActive(true)
    setActiveTab('gerar')
  }

  const loadFromModelo = (modelo: ModeloAta) => {
    resetWizard()
    setWizardActive(true)
    setActiveTab('gerar')
    setFormDados(prev => ({ ...prev, tipoAG: modelo.id.includes('extra') ? 'extraordinaria' : 'ordinaria' }))
    setCondominos(modelo.condominosDefault.map((c, i) => ({
      id: `mc-${i}`,
      ...c,
      presenca: 'presente' as PresencaStatus,
      horaEntrada: '',
    })))
    setDeliberacoes(modelo.pontosOrdem.map((p, i) => ({
      id: `md-${i}`,
      pontoOrdem: i + 1,
      titulo: p.titulo,
      descricao: p.descricao,
      tipoMaioria: p.tipoMaioria,
      votos: [],
    })))
  }

  const editAta = (ata: Ata) => {
    setEditingAtaId(ata.id)
    setFormDados(ata.dados)
    setCondominos(ata.condominos)
    setDeliberacoes(ata.deliberacoes)
    setAssinaturas(ata.assinaturas)
    setTextoPreview(ata.textoGerado || '')
    setWizardStep(1)
    setWizardActive(true)
    setActiveTab('gerar')
  }

  const deleteAta = (id: string) => {
    save(atas.filter(a => a.id !== id))
  }

  // ── Adicionar condomino
  const addCondomino = () => {
    if (!novoCondominoNome.trim()) return
    setCondominos(prev => [...prev, {
      id: crypto.randomUUID(),
      nome: novoCondominoNome.trim(),
      fracao: novoCondominoFracao.trim() || '-',
      permilagem: parseFloat(novoCondominoPerm) || 0,
      presenca: 'presente',
      horaEntrada: '',
    }])
    setNovoCondominoNome(''); setNovoCondominoFracao(''); setNovoCondominoPerm('')
  }

  // ── Adicionar deliberacao
  const addDeliberacao = () => {
    if (!novaDelibTitulo.trim()) return
    setDeliberacoes(prev => [...prev, {
      id: crypto.randomUUID(),
      pontoOrdem: prev.length + 1,
      titulo: novaDelibTitulo.trim(),
      descricao: novaDelibDesc.trim(),
      tipoMaioria: novaDelibMaioria,
      votos: [],
    }])
    setNovaDelibTitulo(''); setNovaDelibDesc(''); setNovaDelibMaioria('simples')
  }

  // ── Votar (bulk)
  const votarTodosFavoravel = (delibId: string) => {
    setDeliberacoes(prev => prev.map(d => {
      if (d.id !== delibId) return d
      const votantes = presentesCondominos.map(c => ({ condominoId: c.id, voto: 'favoravel' as VotoTipo }))
      return { ...d, votos: votantes }
    }))
  }

  const votarCondomino = (delibId: string, condominoId: string, voto: VotoTipo) => {
    setDeliberacoes(prev => prev.map(d => {
      if (d.id !== delibId) return d
      const existing = d.votos.filter(v => v.condominoId !== condominoId)
      return { ...d, votos: [...existing, { condominoId, voto }] }
    }))
  }

  // ── Gerar texto com IA (simulado)
  const gerarComIA = async () => {
    setIaLoading(true)
    // Simulate IA processing
    await new Promise(r => setTimeout(r, 2000))

    const presentes = presentesCondominos.map(c => `${c.nome} (Fracao ${c.fracao}, ${c.permilagem}‰${c.presenca === 'representado' ? `, representado por ${c.representante || '—'}` : ''})`).join('; ')
    const ausentes = condominos.filter(c => c.presenca === 'ausente').map(c => `${c.nome} (Fracao ${c.fracao})`).join('; ')

    const delibTexto = deliberacoes.map(d => {
      const r = calcularResultado(d)
      const fav = d.votos.filter(v => v.voto === 'favoravel').length
      const contra = d.votos.filter(v => v.voto === 'contra').length
      const abs = d.votos.filter(v => v.voto === 'abstencao').length
      return `PONTO ${d.pontoOrdem} DA ORDEM DO DIA — ${d.titulo.toUpperCase()}\n${d.descricao}\nTipo de maioria: ${TIPO_MAIORIA_LABELS[d.tipoMaioria].label} (${TIPO_MAIORIA_LABELS[d.tipoMaioria].ref})\nResultado da votacao: ${fav} favoraveis, ${contra} contra, ${abs} abstencoes.\nDeliberacao: ${r === 'aprovada' ? 'APROVADA' : r === 'rejeitada' ? 'REJEITADA' : 'SEM QUORUM'}`
    }).join('\n\n')

    const texto = `ATA N.o ${(atas.length + 1)} DA ASSEMBLEIA GERAL ${formDados.tipoAG === 'extraordinaria' ? 'EXTRAORDINARIA' : 'ORDINARIA'} DE CONDOMINOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EDIFICIO: ${formDados.edificioNom || '[Nome do edificio]'}
DATA: ${formDados.data ? formatDate(formDados.data) : '[Data]'}
HORA: ${formDados.horaInicio || '[Inicio]'} as ${formDados.horaFim || '[Fim]'}
LOCAL: ${formDados.local || '[Local]'} (${TIPO_LOCAL_LABELS[formDados.tipoLocal]})
CONVOCATORIA N.o: ${formDados.convocatoriaNr || '[N.o]'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRESENCAS

Presentes e representados (${presentesCondominos.length} de ${condominos.length} condominos):
${presentes || 'Nenhum'}

Ausentes:
${ausentes || 'Nenhum'}

Permilagem presente: ${permilagemPresente}‰ de ${totalPermilagem}‰ (${quorumPercentage.toFixed(1)}%)
Quorum verificado: ${temQuorum ? 'SIM — nos termos da Lei 8/2022 (minimo 25% em 2.a convocatoria)' : 'NAO — quorum insuficiente'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DELIBERACOES

${delibTexto || 'Nenhuma deliberacao registada.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A presente ata foi lida, aprovada e assinada pelos membros da mesa da assembleia.

${assinaturas.map(a => `${a.cargo}: ${a.nome || '________________________'}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Documento gerado por Fixit — Gestao de Condominios
Data de geracao: ${new Date().toLocaleDateString('pt-PT')}`

    setTextoPreview(texto)
    setIaLoading(false)
  }

  // ── Guardar ata
  const guardarAta = (estado: EstadoAta = 'rascunho') => {
    const now = new Date().toISOString()
    const delibsComResultado = deliberacoes.map(d => ({ ...d, resultado: calcularResultado(d) }))

    if (editingAtaId) {
      save(atas.map(a => a.id === editingAtaId ? {
        ...a,
        dados: formDados,
        condominos,
        deliberacoes: delibsComResultado,
        assinaturas,
        estado,
        textoGerado: textoPreview,
        atualizadaEm: now,
      } : a))
    } else {
      const novaAta: Ata = {
        id: crypto.randomUUID(),
        numero: atas.length + 1,
        dados: formDados,
        condominos,
        deliberacoes: delibsComResultado,
        assinaturas,
        estado,
        textoGerado: textoPreview,
        criadaEm: now,
        atualizadaEm: now,
      }
      save([novaAta, ...atas])
    }
    resetWizard()
    setActiveTab('geradas')
  }

  // ── Filtered atas
  const filteredAtas = useMemo(() => {
    let filtered = [...atas]
    if (filterEstado !== 'todos') filtered = filtered.filter(a => a.estado === filterEstado)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.dados.edificioNom.toLowerCase().includes(q) ||
        a.dados.convocatoriaNr.toLowerCase().includes(q) ||
        a.deliberacoes.some(d => d.titulo.toLowerCase().includes(q))
      )
    }
    return filtered
  }, [atas, filterEstado, searchTerm])

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 12, padding: 20 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--sd-navy,#0D1B2E)', outline: 'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as const }
  const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: 'var(--sd-navy,#0D1B2E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const btnSecondary: React.CSSProperties = { padding: '8px 18px', background: 'transparent', color: 'var(--sd-navy,#0D1B2E)', border: '1px solid var(--sd-border,#E4DDD0)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const btnGold: React.CSSProperties = { padding: '8px 18px', background: 'var(--sd-gold,#C9A84C)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 4, display: 'block' }

  // ─── Render: Tabs ─────────────────────────────────────────────────────────────

  const TAB_ITEMS: { key: TabAtas; label: string; icon: string }[] = [
    { key: 'gerar', label: 'Gerar Ata', icon: '📝' },
    { key: 'geradas', label: 'Atas Geradas', icon: '📚' },
    { key: 'modelos', label: 'Modelos', icon: '📋' },
  ]

  // ─── Render: Step 1 — Dados da Assembleia ──────────────────────────────────

  const renderStep1 = () => (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>📋 Dados da Assembleia</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Edificio</label>
          <input style={inputStyle} placeholder="Nome do edificio" value={formDados.edificioNom} onChange={e => setFormDados(p => ({ ...p, edificioNom: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Convocatoria N.o</label>
          <input style={inputStyle} placeholder="Ex: 1/2026" value={formDados.convocatoriaNr} onChange={e => setFormDados(p => ({ ...p, convocatoriaNr: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Data</label>
          <input style={inputStyle} type="date" value={formDados.data} onChange={e => setFormDados(p => ({ ...p, data: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Hora Inicio</label>
          <input style={inputStyle} type="time" value={formDados.horaInicio} onChange={e => setFormDados(p => ({ ...p, horaInicio: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Hora Fim</label>
          <input style={inputStyle} type="time" value={formDados.horaFim} onChange={e => setFormDados(p => ({ ...p, horaFim: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Tipo de AG</label>
          <select style={selectStyle} value={formDados.tipoAG} onChange={e => setFormDados(p => ({ ...p, tipoAG: e.target.value as TipoAG }))}>
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Modalidade</label>
          <select style={selectStyle} value={formDados.tipoLocal} onChange={e => setFormDados(p => ({ ...p, tipoLocal: e.target.value as TipoLocal }))}>
            <option value="presencial">Presencial</option>
            <option value="videoconferencia">Videoconferencia</option>
            <option value="hibrido">Hibrido</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Local / Link</label>
        <input style={inputStyle} placeholder="Morada ou link de videoconferencia" value={formDados.local} onChange={e => setFormDados(p => ({ ...p, local: e.target.value }))} />
      </div>
    </div>
  )

  // ─── Render: Step 2 — Presencas ────────────────────────────────────────────

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Quorum indicator */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)' }}>Quorum</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: temQuorum ? '#1A7A6E' : '#C0392B' }}>{quorumPercentage.toFixed(1)}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--sd-cream,#F7F4EE)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(quorumPercentage, 100)}%`, background: temQuorum ? '#1A7A6E' : '#C0392B', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>{permilagemPresente}‰ / {totalPermilagem}‰</span>
            <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Min. 25% (Lei 8/2022, 2.a conv.)</span>
          </div>
        </div>
        <div style={{ padding: '6px 14px', borderRadius: 8, background: temQuorum ? '#E6F4F2' : '#FDECEA', color: temQuorum ? '#1A7A6E' : '#C0392B', fontWeight: 700, fontSize: 12 }}>
          {temQuorum ? 'Quorum atingido' : 'Sem quorum'}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ ...cardStyle, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1A7A6E' }}>{condominos.filter(c => c.presenca === 'presente').length}</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Presentes</div>
        </div>
        <div style={{ ...cardStyle, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--sd-gold,#C9A84C)' }}>{condominos.filter(c => c.presenca === 'representado').length}</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Representados</div>
        </div>
        <div style={{ ...cardStyle, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#C0392B' }}>{condominos.filter(c => c.presenca === 'ausente').length}</div>
          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>Ausentes</div>
        </div>
      </div>

      {/* Condominos list */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: '0 0 12px 0' }}>👥 Lista de Condominos ({condominos.length})</h3>

        {condominos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3,#8A9BB0)', fontSize: 13 }}>
            Nenhum condomino adicionado. Adicione manualmente ou utilize um modelo.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {condominos.map((c, idx) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: idx % 2 === 0 ? 'var(--sd-cream,#F7F4EE)' : '#fff', borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', minWidth: 140 }}>{c.nome}</span>
              <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', minWidth: 50 }}>Fr. {c.fracao}</span>
              <span style={{ fontSize: 11, color: 'var(--sd-ink-2,#4A5E78)', minWidth: 60 }}>{c.permilagem}‰</span>

              <select
                style={{ ...selectStyle, width: 'auto', padding: '4px 8px', fontSize: 11 }}
                value={c.presenca}
                onChange={e => setCondominos(prev => prev.map(cc => cc.id === c.id ? { ...cc, presenca: e.target.value as PresencaStatus } : cc))}
              >
                <option value="presente">Presente</option>
                <option value="ausente">Ausente</option>
                <option value="representado">Representado</option>
              </select>

              {c.presenca === 'representado' && (
                <input
                  style={{ ...inputStyle, width: 120, padding: '4px 8px', fontSize: 11 }}
                  placeholder="Representante"
                  value={c.representante || ''}
                  onChange={e => setCondominos(prev => prev.map(cc => cc.id === c.id ? { ...cc, representante: e.target.value } : cc))}
                />
              )}

              {(c.presenca === 'presente' || c.presenca === 'representado') && (
                <input
                  style={{ ...inputStyle, width: 70, padding: '4px 8px', fontSize: 11 }}
                  type="time"
                  value={c.horaEntrada || ''}
                  onChange={e => setCondominos(prev => prev.map(cc => cc.id === c.id ? { ...cc, horaEntrada: e.target.value } : cc))}
                />
              )}

              <button
                onClick={() => setCondominos(prev => prev.filter(cc => cc.id !== c.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#C0392B', padding: 4 }}
                title="Remover"
              >
                x
              </button>
            </div>
          ))}
        </div>

        {/* Add condomino */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} placeholder="Nome do condomino" value={novoCondominoNome} onChange={e => setNovoCondominoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCondomino()} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fracao</label>
            <input style={inputStyle} placeholder="A, B..." value={novoCondominoFracao} onChange={e => setNovoCondominoFracao(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Permilagem</label>
            <input style={inputStyle} type="number" placeholder="100" value={novoCondominoPerm} onChange={e => setNovoCondominoPerm(e.target.value)} />
          </div>
          <button onClick={addCondomino} style={btnPrimary}>+ Adicionar</button>
        </div>
      </div>
    </div>
  )

  // ─── Render: Step 3 — Deliberacoes ──────────────────────────────────────────

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {deliberacoes.map((d, idx) => {
        const resultado = calcularResultado(d)
        const fav = d.votos.filter(v => v.voto === 'favoravel')
        const contra = d.votos.filter(v => v.voto === 'contra')
        const abs = d.votos.filter(v => v.voto === 'abstencao')
        const favPerm = fav.reduce((s, v) => { const c = condominos.find(cc => cc.id === v.condominoId); return s + (c?.permilagem || 0) }, 0)
        const contraPerm = contra.reduce((s, v) => { const c = condominos.find(cc => cc.id === v.condominoId); return s + (c?.permilagem || 0) }, 0)

        return (
          <div key={d.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-navy,#0D1B2E)' }}>Ponto {d.pontoOrdem}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: d.tipoMaioria === 'unanimidade' ? '#FDECEA' : d.tipoMaioria === 'qualificada' ? '#FEF5E4' : '#E6F4F2', color: d.tipoMaioria === 'unanimidade' ? '#C0392B' : d.tipoMaioria === 'qualificada' ? '#D4830A' : '#1A7A6E' }}>
                    {TIPO_MAIORIA_LABELS[d.tipoMaioria].label}
                  </span>
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>{d.titulo}</h4>
                {d.descricao && <p style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', margin: '4px 0 0' }}>{d.descricao}</p>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {resultado && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: resultado === 'aprovada' ? '#E6F4F2' : resultado === 'rejeitada' ? '#FDECEA' : '#FEF5E4', color: resultado === 'aprovada' ? '#1A7A6E' : resultado === 'rejeitada' ? '#C0392B' : '#D4830A' }}>
                    {resultado === 'aprovada' ? 'Aprovada' : resultado === 'rejeitada' ? 'Rejeitada' : 'Sem quorum'}
                  </span>
                )}
                <button
                  onClick={() => setDeliberacoes(prev => prev.filter(dd => dd.id !== d.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#C0392B' }}
                  title="Remover"
                >
                  x
                </button>
              </div>
            </div>

            {/* Quick vote */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button onClick={() => votarTodosFavoravel(d.id)} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 11 }}>Todos a favor</button>
              <span style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', display: 'flex', alignItems: 'center' }}>
                {fav.length} favoravel ({favPerm}‰) | {contra.length} contra ({contraPerm}‰) | {abs.length} abstencao
              </span>
            </div>

            {/* Individual votes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {presentesCondominos.map(c => {
                const votoAtual = d.votos.find(v => v.condominoId === c.id)?.voto
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 6, background: 'var(--sd-cream,#F7F4EE)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', minWidth: 130 }}>{c.nome}</span>
                    <span style={{ fontSize: 10, color: 'var(--sd-ink-3,#8A9BB0)', minWidth: 40 }}>{c.permilagem}‰</span>
                    {(['favoravel', 'contra', 'abstencao'] as VotoTipo[]).map(v => (
                      <button
                        key={v}
                        onClick={() => votarCondomino(d.id, c.id, v)}
                        style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          background: votoAtual === v ? (v === 'favoravel' ? '#E6F4F2' : v === 'contra' ? '#FDECEA' : '#FEF5E4') : 'transparent',
                          color: votoAtual === v ? (v === 'favoravel' ? '#1A7A6E' : v === 'contra' ? '#C0392B' : '#D4830A') : 'var(--sd-ink-3,#8A9BB0)',
                          borderColor: votoAtual === v ? (v === 'favoravel' ? '#1A7A6E' : v === 'contra' ? '#C0392B' : '#D4830A') : 'var(--sd-border,#E4DDD0)',
                        }}
                      >
                        {v === 'favoravel' ? 'A favor' : v === 'contra' ? 'Contra' : 'Abst.'}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Add deliberacao */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: '0 0 12px 0' }}>+ Adicionar Deliberacao</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Titulo / Ponto da Ordem do Dia</label>
            <input style={inputStyle} placeholder="Ex: Aprovacao do orcamento 2026" value={novaDelibTitulo} onChange={e => setNovaDelibTitulo(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Descricao</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Descricao detalhada..." value={novaDelibDesc} onChange={e => setNovaDelibDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tipo de Maioria</label>
              <select style={selectStyle} value={novaDelibMaioria} onChange={e => setNovaDelibMaioria(e.target.value as TipoMaioria)}>
                <option value="simples">Art.o 1432.o — Maioria Simples</option>
                <option value="qualificada">Art.o 1433.o — Maioria Qualificada (2/3)</option>
                <option value="unanimidade">Unanimidade</option>
              </select>
            </div>
            <button onClick={addDeliberacao} style={btnPrimary}>+ Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Render: Step 4 — Revisao & Gerar ────────────────────────────────────────

  const renderStep4 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumo */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: '0 0 12px 0' }}>Resumo da Assembleia</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)' }}>
          <div><strong>Edificio:</strong> {formDados.edificioNom || '—'}</div>
          <div><strong>Data:</strong> {formDados.data ? formatDate(formDados.data) : '—'}</div>
          <div><strong>Tipo:</strong> {TIPO_AG_LABELS[formDados.tipoAG]}</div>
          <div><strong>Modalidade:</strong> {TIPO_LOCAL_LABELS[formDados.tipoLocal]}</div>
          <div><strong>Presentes:</strong> {presentesCondominos.length} / {condominos.length}</div>
          <div><strong>Quorum:</strong> {quorumPercentage.toFixed(1)}% ({temQuorum ? 'OK' : 'Insuficiente'})</div>
          <div><strong>Deliberacoes:</strong> {deliberacoes.length}</div>
          <div><strong>Aprovadas:</strong> {deliberacoes.filter(d => calcularResultado(d) === 'aprovada').length}</div>
        </div>
      </div>

      {/* Assinaturas */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: '0 0 12px 0' }}>Assinatura Eletronica — Mesa da Assembleia</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assinaturas.map((a, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--sd-cream,#F7F4EE)', borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy,#0D1B2E)', minWidth: 160 }}>{a.cargo}</span>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Nome completo"
                value={a.nome}
                onChange={e => setAssinaturas(prev => prev.map((aa, i) => i === idx ? { ...aa, nome: e.target.value } : aa))}
              />
              <button
                onClick={() => setAssinaturas(prev => prev.map((aa, i) => i === idx ? { ...aa, assinado: !aa.assinado, dataAssinatura: !aa.assinado ? new Date().toISOString().split('T')[0] : undefined } : aa))}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: a.assinado ? '#E6F4F2' : '#FEF5E4',
                  color: a.assinado ? '#1A7A6E' : '#D4830A',
                }}
              >
                {a.assinado ? 'Assinado' : 'Assinar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* IA Generate button */}
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <button
          onClick={gerarComIA}
          disabled={iaLoading}
          style={{ ...btnGold, padding: '12px 32px', fontSize: 15, opacity: iaLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {iaLoading ? (
            <>
              <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Gerando com IA...
            </>
          ) : (
            <>Gerar Ata com IA</>
          )}
        </button>
        <p style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 8 }}>
          A IA formata todos os dados numa ata legal completa conforme a legislacao portuguesa.
        </p>
      </div>

      {/* Preview texto */}
      {textoPreview && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>Pre-visualizacao da Ata</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(textoPreview) }} style={btnSecondary}>Copiar</button>
              <button onClick={() => guardarAta('rascunho')} style={btnSecondary}>Guardar Rascunho</button>
              <button onClick={() => guardarAta('final')} style={btnPrimary}>Finalizar Ata</button>
            </div>
          </div>
          <pre style={{ background: 'var(--sd-cream,#F7F4EE)', padding: 20, borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: 'var(--sd-navy,#0D1B2E)', whiteSpace: 'pre-wrap', fontFamily: "'Courier New', monospace", maxHeight: 500, overflow: 'auto', border: '1px solid var(--sd-border,#E4DDD0)' }}>
            {textoPreview}
          </pre>
        </div>
      )}
    </div>
  )

  // ─── Render: Tab 2 — Atas Geradas ────────────────────────────────────────────

  const renderAtasGeradas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            style={inputStyle}
            placeholder="Pesquisar atas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select style={{ ...selectStyle, width: 'auto' }} value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoAta | 'todos')}>
          <option value="todos">Todos os estados</option>
          <option value="rascunho">Rascunho</option>
          <option value="final">Final</option>
          <option value="assinada">Assinada</option>
        </select>
        <button onClick={startNewAta} style={btnPrimary}>+ Nova Ata</button>
      </div>

      {filteredAtas.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
          <p style={{ fontSize: 14, color: 'var(--sd-ink-2,#4A5E78)', fontWeight: 600 }}>Nenhuma ata encontrada</p>
          <p style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>Comece por gerar uma nova ata ou utilize um modelo.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredAtas.map(ata => {
            const cfg = ESTADO_CONFIG[ata.estado]
            return (
              <div key={ata.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--sd-cream,#F7F4EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {ata.dados.tipoAG === 'extraordinaria' ? '⚡' : '📅'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)' }}>Ata N.o {ata.numero}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'var(--sd-cream,#F7F4EE)', color: 'var(--sd-ink-2,#4A5E78)' }}>
                      {TIPO_AG_LABELS[ata.dados.tipoAG]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)' }}>
                    {ata.dados.edificioNom} — {ata.dados.data ? formatDateShort(ata.dados.data) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)', marginTop: 2 }}>
                    {ata.deliberacoes.length} deliberacao(oes) | {ata.condominos.filter(c => c.presenca !== 'ausente').length} presentes
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {ata.textoGerado && (
                    <button
                      onClick={() => {
                        const blob = new Blob([ata.textoGerado || ''], { type: 'text/plain;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `ata-${ata.numero}-${ata.dados.data || 'rascunho'}.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      style={btnSecondary}
                      title="Descarregar"
                    >
                      Descarregar
                    </button>
                  )}
                  <button onClick={() => editAta(ata)} style={btnSecondary} title="Editar">
                    Editar
                  </button>
                  <button
                    onClick={() => deleteAta(ata.id)}
                    style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B' }}
                    title="Eliminar"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Render: Tab 3 — Modelos ──────────────────────────────────────────────────

  const renderModelos = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {MODELOS.map(modelo => (
        <div key={modelo.id} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {modelo.icon}
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', margin: 0 }}>{modelo.nome}</h3>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--sd-ink-2,#4A5E78)', margin: 0, lineHeight: 1.5 }}>{modelo.descricao}</p>

          <div style={{ fontSize: 12, color: 'var(--sd-ink-3,#8A9BB0)' }}>
            <strong>{modelo.pontosOrdem.length}</strong> pontos da ordem do dia:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {modelo.pontosOrdem.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--sd-ink-2,#4A5E78)' }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--sd-cream,#F7F4EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{p.titulo}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: p.tipoMaioria === 'qualificada' ? '#FEF5E4' : '#E6F4F2', color: p.tipoMaioria === 'qualificada' ? '#D4830A' : '#1A7A6E', fontWeight: 600, flexShrink: 0 }}>
                  {TIPO_MAIORIA_LABELS[p.tipoMaioria].label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--sd-ink-3,#8A9BB0)' }}>
            {modelo.condominosDefault.length} condominos pre-configurados
          </div>

          <button onClick={() => loadFromModelo(modelo)} style={{ ...btnGold, marginTop: 'auto' }}>
            Usar este modelo
          </button>
        </div>
      ))}
    </div>
  )

  // ─── Main render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--sd-navy,#0D1B2E)', margin: 0, fontFamily: "'Playfair Display',serif" }}>
            Atas de Assembleia — IA
          </h1>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', margin: '4px 0 0' }}>
            Geracao inteligente de atas de assembleia de condominos
          </p>
        </div>
        {!wizardActive && (
          <button onClick={startNewAta} style={btnPrimary}>+ Nova Ata</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--sd-border,#E4DDD0)', paddingBottom: 0 }}>
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); if (tab.key !== 'gerar') setWizardActive(false) }}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--sd-gold,#C9A84C)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--sd-navy,#0D1B2E)' : 'var(--sd-ink-3,#8A9BB0)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'gerar' && !wizardActive && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 50 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy,#0D1B2E)', marginBottom: 8 }}>Gerar uma nova ata</h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-2,#4A5E78)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Utilize o assistente passo a passo para criar uma ata de assembleia completa, ou comece a partir de um modelo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={startNewAta} style={btnPrimary}>Comecar do zero</button>
            <button onClick={() => setActiveTab('modelos')} style={btnSecondary}>Ver modelos</button>
          </div>
        </div>
      )}

      {activeTab === 'gerar' && wizardActive && (
        <div>
          {/* Wizard progress */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 }}>
            {WIZARD_STEPS.map((s, idx) => (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => setWizardStep(s.num)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: wizardStep === s.num ? 'var(--sd-navy,#0D1B2E)' : wizardStep > s.num ? '#E6F4F2' : 'var(--sd-cream,#F7F4EE)',
                    color: wizardStep === s.num ? '#fff' : wizardStep > s.num ? '#1A7A6E' : 'var(--sd-ink-3,#8A9BB0)',
                    fontWeight: 600, fontSize: 12,
                  }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: wizardStep === s.num ? 'rgba(255,255,255,0.2)' : 'transparent' }}>
                    {wizardStep > s.num ? '✓' : s.num}
                  </span>
                  <span style={{ display: idx < 3 ? 'inline' : 'inline' }}>{s.label}</span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: wizardStep > s.num ? '#1A7A6E' : 'var(--sd-border,#E4DDD0)', margin: '0 4px' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          {wizardStep === 1 && renderStep1()}
          {wizardStep === 2 && renderStep2()}
          {wizardStep === 3 && renderStep3()}
          {wizardStep === 4 && renderStep4()}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {wizardStep > 1 && (
                <button onClick={() => setWizardStep((wizardStep - 1) as WizardStep)} style={btnSecondary}>Anterior</button>
              )}
              <button onClick={resetWizard} style={{ ...btnSecondary, color: '#C0392B', borderColor: '#C0392B' }}>Cancelar</button>
            </div>
            {wizardStep < 4 && (
              <button onClick={() => setWizardStep((wizardStep + 1) as WizardStep)} style={btnPrimary}>Seguinte</button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'geradas' && renderAtasGeradas()}
      {activeTab === 'modelos' && renderModelos()}
    </div>
  )
}
