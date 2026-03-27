'use client'

import { useState, useEffect } from 'react'
import { StatCard } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'ativas' | 'historico' | 'regulamento' | 'configuracao'
type ViolationCategory = 'noise' | 'parking' | 'waste' | 'common_areas' | 'pets' | 'renovation' | 'other'
type ViolationStage = 'signalement' | 'avertissement_1' | 'avertissement_2' | 'mise_en_demeure' | 'vote_ag' | 'amende' | 'juridique' | 'clos'
type Severity = 'mineur' | 'moyen' | 'grave' | 'tres_grave'

interface ViolationEvidence {
  id: string; type: 'photo' | 'temoignage' | 'document' | 'audio'; description: string; date: string
}

interface ViolationEvent {
  id: string; date: string; stage: ViolationStage; action: string; author: string; notes?: string; evidences?: ViolationEvidence[]
}

interface Violation {
  id: string; condominoNome: string; condominoFracao: string; imovel: string
  category: ViolationCategory; severity: Severity; description: string
  dateSignalement: string; currentStage: ViolationStage
  timeline: ViolationEvent[]; isRecidive: boolean
  previousViolationIds?: string[]; montantAmende?: number; notes: string
}

interface ReglementArticle {
  id: string; numero: string; titre: string; contenu: string
  categoriesLiees: ViolationCategory[]; sanctionPrevue: string
}

interface EscalationConfig {
  signalement: number
  avertissement_1: number
  avertissement_2: number
  mise_en_demeure: number
  vote_ag: number
  amende: number
  juridique: number
}

interface InfractionsConfig {
  escalationDays: EscalationConfig
  defaultFines: Record<Severity, number>
  notifications: { email: boolean; sms: boolean; dashboard: boolean; autoReminder: boolean }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<ViolationCategory, { emoji: string; fr: string; pt: string }> = {
  noise: { emoji: '\u{1F50A}', fr: 'Bruit / Nuisances sonores', pt: 'Ruído / Perturbações' },
  parking: { emoji: '\u{1F697}', fr: 'Stationnement', pt: 'Estacionamento' },
  waste: { emoji: '\u{1F5D1}\uFE0F', fr: 'Déchets / Poubelles', pt: 'Lixo / Resíduos' },
  common_areas: { emoji: '\u{1F3E2}', fr: 'Parties communes', pt: 'Espaços comuns' },
  pets: { emoji: '\u{1F415}', fr: 'Animaux', pt: 'Animais' },
  renovation: { emoji: '\u{1F528}', fr: 'Travaux non autorisés', pt: 'Obras não autorizadas' },
  other: { emoji: '\u{1F4CB}', fr: 'Autre', pt: 'Outro' },
}

const STAGES: Record<ViolationStage, { emoji: string; fr: string; pt: string; color: string }> = {
  signalement: { emoji: '\u{1F4DD}', fr: 'Signalement', pt: 'Sinalização', color: '#6B7280' },
  avertissement_1: { emoji: '\u26A0\uFE0F', fr: '1er avertissement', pt: '1.º aviso', color: '#D4830A' },
  avertissement_2: { emoji: '\u26A0\uFE0F', fr: '2e avertissement', pt: '2.º aviso', color: '#D97706' },
  mise_en_demeure: { emoji: '\u{1F4CB}', fr: 'Mise en demeure', pt: 'Notificação formal', color: '#C0392B' },
  vote_ag: { emoji: '\u{1F3DB}\uFE0F', fr: 'Vote en AG', pt: 'Voto em AG', color: '#7C3AED' },
  amende: { emoji: '\u{1F4B6}', fr: 'Amende', pt: 'Multa', color: '#C0392B' },
  juridique: { emoji: '\u2696\uFE0F', fr: 'Action juridique', pt: 'Ação judicial', color: '#1E3A5F' },
  clos: { emoji: '\u2705', fr: 'Clos', pt: 'Encerrado', color: '#1A7A6E' },
}

const STAGE_ORDER: ViolationStage[] = ['signalement', 'avertissement_1', 'avertissement_2', 'mise_en_demeure', 'vote_ag', 'amende', 'juridique', 'clos']

const SEVERITIES: Record<Severity, { fr: string; pt: string; color: string }> = {
  mineur: { fr: 'Mineur', pt: 'Menor', color: '#6B7280' },
  moyen: { fr: 'Moyen', pt: 'Médio', color: '#D4830A' },
  grave: { fr: 'Grave', pt: 'Grave', color: '#C0392B' },
  tres_grave: { fr: 'Très grave', pt: 'Muito grave', color: '#7C3AED' },
}

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: 'dashboard', emoji: '\u{1F4CA}', label: 'Dashboard' },
  { id: 'ativas', emoji: '\u{1F6A8}', label: 'Infrações Ativas' },
  { id: 'historico', emoji: '\u{1F4C2}', label: 'Histórico' },
  { id: 'regulamento', emoji: '\u{1F4D6}', label: 'Regulamento' },
  { id: 'configuracao', emoji: '\u2699\uFE0F', label: 'Configuração' },
]

const EVIDENCE_TYPES: { value: ViolationEvidence['type']; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'temoignage', label: 'Témoignage' },
  { value: 'document', label: 'Document' },
  { value: 'audio', label: 'Audio' },
]

// ─── Demo Data ────────────────────────────────────────────────────────────────

function generateDemoViolations(): Violation[] {
  return [
    {
      id: 'v-001', condominoNome: 'Carlos Ferreira', condominoFracao: '3-D', imovel: 'Edifício Aurora',
      category: 'noise', severity: 'moyen', description: 'Música alta após as 23h, reportado por múltiplos vizinhos do 2.º e 4.º andar.',
      dateSignalement: '2026-01-15', currentStage: 'avertissement_2', isRecidive: true, previousViolationIds: ['v-old-1'],
      notes: 'Reincidente. Primeiro incidente em outubro 2025.',
      timeline: [
        { id: 'e-001', date: '2026-01-15', stage: 'signalement', action: 'Sinalização recebida', author: 'Maria Santos (2-C)', notes: 'Ruído constante após 23h' },
        { id: 'e-002', date: '2026-01-20', stage: 'avertissement_1', action: '1.º aviso enviado por carta', author: 'Gestão Syndic', notes: 'Carta registada enviada' },
        { id: 'e-003', date: '2026-02-10', stage: 'avertissement_2', action: '2.º aviso — reincidência confirmada', author: 'Gestão Syndic', notes: 'Nova queixa de 3 moradores' },
      ],
    },
    {
      id: 'v-002', condominoNome: 'Ana Rodrigues', condominoFracao: '1-A', imovel: 'Edifício Aurora',
      category: 'parking', severity: 'mineur', description: 'Veículo estacionado em lugar reservado a visitantes de forma recorrente.',
      dateSignalement: '2026-02-01', currentStage: 'avertissement_1', isRecidive: false,
      notes: '',
      timeline: [
        { id: 'e-004', date: '2026-02-01', stage: 'signalement', action: 'Sinalização recebida', author: 'Porteiro' },
        { id: 'e-005', date: '2026-02-08', stage: 'avertissement_1', action: '1.º aviso enviado', author: 'Gestão Syndic' },
      ],
    },
    {
      id: 'v-003', condominoNome: 'Pedro Mendes', condominoFracao: '5-B', imovel: 'Residência do Parque',
      category: 'waste', severity: 'grave', description: 'Lixo doméstico depositado no corredor comum em sacos abertos, gerando mau cheiro e insalubridade.',
      dateSignalement: '2025-12-10', currentStage: 'mise_en_demeure', isRecidive: true, previousViolationIds: ['v-old-2'],
      montantAmende: 150, notes: 'Situação grave, risco sanitário.',
      timeline: [
        { id: 'e-006', date: '2025-12-10', stage: 'signalement', action: 'Sinalização recebida com fotos', author: 'José Silva (5-A)' },
        { id: 'e-007', date: '2025-12-18', stage: 'avertissement_1', action: '1.º aviso', author: 'Gestão Syndic' },
        { id: 'e-008', date: '2026-01-05', stage: 'avertissement_2', action: '2.º aviso', author: 'Gestão Syndic' },
        { id: 'e-009', date: '2026-01-25', stage: 'mise_en_demeure', action: 'Notificação formal enviada', author: 'Advogado do condomínio' },
      ],
    },
    {
      id: 'v-004', condominoNome: 'Rita Sousa', condominoFracao: '2-C', imovel: 'Residência do Parque',
      category: 'pets', severity: 'moyen', description: 'Cão de grande porte sem trela nos espaços comuns. Ladridos constantes durante o dia.',
      dateSignalement: '2026-02-20', currentStage: 'signalement', isRecidive: false,
      notes: 'Aguarda contacto com condómina.',
      timeline: [
        { id: 'e-010', date: '2026-02-20', stage: 'signalement', action: 'Sinalização recebida', author: 'Luísa Martins (2-D)' },
      ],
    },
    {
      id: 'v-005', condominoNome: 'Manuel Costa', condominoFracao: '4-A', imovel: 'Edifício Aurora',
      category: 'renovation', severity: 'tres_grave', description: 'Obras de remodelação interior sem autorização prévia da AG. Possível alteração estrutural.',
      dateSignalement: '2025-11-05', currentStage: 'vote_ag', isRecidive: false,
      montantAmende: 500, notes: 'Perito técnico confirmou alteração de parede portante. AG extraordinária convocada.',
      timeline: [
        { id: 'e-011', date: '2025-11-05', stage: 'signalement', action: 'Sinalização por vizinho do 3.º andar', author: 'João Alves (3-A)' },
        { id: 'e-012', date: '2025-11-12', stage: 'avertissement_1', action: '1.º aviso + pedido de documentação', author: 'Gestão Syndic' },
        { id: 'e-013', date: '2025-11-28', stage: 'avertissement_2', action: '2.º aviso — sem resposta', author: 'Gestão Syndic' },
        { id: 'e-014', date: '2025-12-15', stage: 'mise_en_demeure', action: 'Notificação formal + relatório perito', author: 'Advogado do condomínio' },
        { id: 'e-015', date: '2026-01-10', stage: 'vote_ag', action: 'AG extraordinária convocada para 30/01', author: 'Gestão Syndic' },
      ],
    },
    {
      id: 'v-006', condominoNome: 'Sofia Lopes', condominoFracao: '1-B', imovel: 'Torre Atlântico',
      category: 'common_areas', severity: 'mineur', description: 'Objetos pessoais armazenados no hall de entrada do edifício (bicicleta, carrinho de compras).',
      dateSignalement: '2026-03-01', currentStage: 'signalement', isRecidive: false,
      notes: '',
      timeline: [
        { id: 'e-016', date: '2026-03-01', stage: 'signalement', action: 'Sinalização recebida', author: 'Administração' },
      ],
    },
    {
      id: 'v-007', condominoNome: 'Carlos Ferreira', condominoFracao: '3-D', imovel: 'Edifício Aurora',
      category: 'noise', severity: 'grave', description: 'Festa com música alta até às 4h da manhã. Polícia chamada por vizinhos.',
      dateSignalement: '2025-10-20', currentStage: 'clos', isRecidive: false,
      notes: 'Resolvido após 2.º aviso. Compromisso verbal do condómino.',
      timeline: [
        { id: 'e-017', date: '2025-10-20', stage: 'signalement', action: 'Sinalização recebida', author: 'Múltiplos vizinhos' },
        { id: 'e-018', date: '2025-10-25', stage: 'avertissement_1', action: '1.º aviso', author: 'Gestão Syndic' },
        { id: 'e-019', date: '2025-11-10', stage: 'avertissement_2', action: '2.º aviso', author: 'Gestão Syndic' },
        { id: 'e-020', date: '2025-11-20', stage: 'clos', action: 'Encerrado — compromisso do condómino', author: 'Gestão Syndic' },
      ],
    },
    {
      id: 'v-008', condominoNome: 'Teresa Vieira', condominoFracao: '6-C', imovel: 'Torre Atlântico',
      category: 'waste', severity: 'mineur', description: 'Sacos de lixo deixados fora do contentor no horário incorreto.',
      dateSignalement: '2025-09-15', currentStage: 'clos', isRecidive: false,
      notes: 'Resolvido após aviso verbal.',
      timeline: [
        { id: 'e-021', date: '2025-09-15', stage: 'signalement', action: 'Sinalização recebida', author: 'Porteiro' },
        { id: 'e-022', date: '2025-09-20', stage: 'avertissement_1', action: 'Aviso verbal', author: 'Gestão Syndic' },
        { id: 'e-023', date: '2025-10-01', stage: 'clos', action: 'Encerrado — situação resolvida', author: 'Gestão Syndic' },
      ],
    },
    {
      id: 'v-009', condominoNome: 'Bruno Oliveira', condominoFracao: '2-A', imovel: 'Residência do Parque',
      category: 'parking', severity: 'moyen', description: 'Garagem utilizada como armazém comercial, com entrada e saída frequente de mercadorias.',
      dateSignalement: '2026-03-10', currentStage: 'avertissement_1', isRecidive: false,
      notes: 'Verificar se há atividade comercial não autorizada.',
      timeline: [
        { id: 'e-024', date: '2026-03-10', stage: 'signalement', action: 'Sinalização recebida', author: 'Vizinhos do R/C' },
        { id: 'e-025', date: '2026-03-15', stage: 'avertissement_1', action: '1.º aviso enviado', author: 'Gestão Syndic' },
      ],
    },
  ]
}

function generateDemoArticles(): ReglementArticle[] {
  return [
    {
      id: 'art-1', numero: 'Art. 12', titre: 'Ruído e perturbações sonoras',
      contenu: 'É proibido produzir ruídos que perturbem o descanso dos condóminos entre as 22h e as 8h em dias úteis, e entre as 22h e as 10h aos fins de semana e feriados. Inclui música, televisão em volume elevado, obras e qualquer atividade ruidosa.',
      categoriesLiees: ['noise'], sanctionPrevue: '1.º aviso → 2.º aviso → multa 50-200€',
    },
    {
      id: 'art-2', numero: 'Art. 15', titre: 'Estacionamento e garagens',
      contenu: 'Os lugares de estacionamento destinam-se exclusivamente ao parqueamento de veículos ligeiros. É proibida a utilização das garagens como armazém ou para fins comerciais. Os lugares de visitantes não podem ser ocupados por residentes.',
      categoriesLiees: ['parking'], sanctionPrevue: '1.º aviso → multa 75-150€',
    },
    {
      id: 'art-3', numero: 'Art. 18', titre: 'Resíduos e limpeza',
      contenu: 'Os resíduos domésticos devem ser depositados nos contentores adequados, devidamente fechados, nos horários estabelecidos pela câmara municipal. É proibido deixar lixo nos corredores, halls ou outros espaços comuns.',
      categoriesLiees: ['waste', 'common_areas'], sanctionPrevue: '1.º aviso → multa 50-100€ + custos de limpeza',
    },
    {
      id: 'art-4', numero: 'Art. 22', titre: 'Animais domésticos',
      contenu: 'Os animais domésticos devem circular nos espaços comuns acompanhados e com trela. Os proprietários são responsáveis pela limpeza de dejetos. Latidos ou ruídos persistentes constituem perturbação do sossego.',
      categoriesLiees: ['pets', 'noise'], sanctionPrevue: '1.º aviso → 2.º aviso → multa 50-150€',
    },
    {
      id: 'art-5', numero: 'Art. 25', titre: 'Obras e remodelações',
      contenu: 'Qualquer obra de remodelação interior que afete a estrutura do edifício, fachada ou partes comuns carece de autorização prévia da Assembleia Geral. As obras autorizadas só podem decorrer entre as 9h e as 18h em dias úteis.',
      categoriesLiees: ['renovation', 'noise'], sanctionPrevue: 'Suspensão imediata das obras + multa 200-1000€ + reposição',
    },
  ]
}

const DEFAULT_CONFIG: InfractionsConfig = {
  escalationDays: {
    signalement: 7,
    avertissement_1: 14,
    avertissement_2: 14,
    mise_en_demeure: 30,
    vote_ag: 60,
    amende: 30,
    juridique: 90,
  },
  defaultFines: { mineur: 50, moyen: 150, grave: 300, tres_grave: 500 },
  notifications: { email: true, sms: false, dashboard: true, autoReminder: true },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextStage(current: ViolationStage): ViolationStage | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

function generateWarningLetter(v: Violation, stage: ViolationStage): string {
  const catLabel = CATEGORIES[v.category].pt
  const stageLabel = STAGES[stage].pt
  const today = new Date().toLocaleDateString('pt-PT')

  if (stage === 'avertissement_1' || stage === 'avertissement_2') {
    const num = stage === 'avertissement_1' ? '1.º' : '2.º'
    return `AVISO DE INFRAÇÃO — ${num} Aviso\n\nExmo(a) Sr(a) ${v.condominoNome}\nFração: ${v.condominoFracao} — ${v.imovel}\nData: ${today}\n\nAssunto: ${catLabel}\n\nVimos por este meio informar V. Exa. de que foi registada uma infração ao regulamento do condomínio, classificada como "${stageLabel}".\n\nDescrição: ${v.description}\n\nSolicitamos a regularização imediata da situação, sob pena de agravamento das medidas previstas no regulamento interno.\n\nCom os melhores cumprimentos,\nAdministração do Condomínio`
  }

  if (stage === 'mise_en_demeure') {
    return `NOTIFICAÇÃO FORMAL — MISE EN DEMEURE\n\nExmo(a) Sr(a) ${v.condominoNome}\nFração: ${v.condominoFracao} — ${v.imovel}\nData: ${today}\n\nAssunto: ${catLabel} — Notificação formal\n\nApós múltiplos avisos sem resolução, notificamos formalmente V. Exa. para que proceda à regularização da seguinte infração no prazo de 15 dias úteis:\n\n${v.description}\n\nO não cumprimento resultará na submissão do caso à Assembleia Geral para deliberação, podendo incluir a aplicação de multa.\n\nCom os melhores cumprimentos,\nAdministração do Condomínio`
  }

  return `COMUNICAÇÃO — ${stageLabel}\n\nExmo(a) Sr(a) ${v.condominoNome}\nFração: ${v.condominoFracao} — ${v.imovel}\nData: ${today}\n\nAssunto: ${catLabel}\n\n${v.description}\n\nCom os melhores cumprimentos,\nAdministração do Condomínio`
}

function checkRecidive(nome: string, violations: Violation[]): boolean {
  return violations.filter(v => v.condominoNome === nome).length > 1
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InfractionsSection({ user, userRole }: { user: any; userRole: string }) {
  const STORAGE_KEY = `fixit_infractions_${user?.id}`
  const CONFIG_KEY = `fixit_infractions_config_${user?.id}`
  const ARTICLES_KEY = `fixit_infractions_articles_${user?.id}`

  const [tab, setTab] = useState<TabId>('dashboard')
  const [violations, setViolations] = useState<Violation[]>([])
  const [articles, setArticles] = useState<ReglementArticle[]>([])
  const [config, setConfig] = useState<InfractionsConfig>(DEFAULT_CONFIG)

  // Filters for ativas tab
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStage, setFilterStage] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEvidenceModal, setShowEvidenceModal] = useState<string | null>(null)
  const [showLetterModal, setShowLetterModal] = useState<{ violation: Violation; stage: ViolationStage } | null>(null)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<ReglementArticle | null>(null)

  // New violation form
  const [newForm, setNewForm] = useState<Partial<Violation>>({
    category: 'noise', severity: 'mineur', condominoNome: '', condominoFracao: '', imovel: '', description: '', notes: '',
  })

  // Evidence form
  const [evidenceForm, setEvidenceForm] = useState<Partial<ViolationEvidence>>({ type: 'photo', description: '' })

  // Article form
  const [articleForm, setArticleForm] = useState<Partial<ReglementArticle>>({
    numero: '', titre: '', contenu: '', categoriesLiees: [], sanctionPrevue: '',
  })

  // ─── Load / Save ─────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      setViolations(stored ? JSON.parse(stored) : generateDemoViolations())
    } catch { setViolations(generateDemoViolations()) }

    try {
      const storedArt = localStorage.getItem(ARTICLES_KEY)
      setArticles(storedArt ? JSON.parse(storedArt) : generateDemoArticles())
    } catch { setArticles(generateDemoArticles()) }

    try {
      const storedCfg = localStorage.getItem(CONFIG_KEY)
      if (storedCfg) setConfig(JSON.parse(storedCfg))
    } catch { /* keep default */ }
  }, [])

  const saveViolations = (updated: Violation[]) => {
    setViolations(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const saveArticles = (updated: ReglementArticle[]) => {
    setArticles(updated)
    localStorage.setItem(ARTICLES_KEY, JSON.stringify(updated))
  }

  const saveConfig = (updated: InfractionsConfig) => {
    setConfig(updated)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated))
  }

  // ─── Core Functions ──────────────────────────────────────────────────────────

  const escalateViolation = (id: string) => {
    const updated = violations.map(v => {
      if (v.id !== id) return v
      const next = getNextStage(v.currentStage)
      if (!next) return v
      const event: ViolationEvent = {
        id: uid(), date: new Date().toISOString().split('T')[0],
        stage: next, action: `Escalada para: ${STAGES[next].pt}`,
        author: 'Gestão Syndic',
      }
      return { ...v, currentStage: next, timeline: [...v.timeline, event], isRecidive: checkRecidive(v.condominoNome, violations) }
    })
    saveViolations(updated)
  }

  const closeViolation = (id: string) => {
    const updated = violations.map(v => {
      if (v.id !== id) return v
      const event: ViolationEvent = {
        id: uid(), date: new Date().toISOString().split('T')[0],
        stage: 'clos', action: 'Infração encerrada',
        author: 'Gestão Syndic',
      }
      return { ...v, currentStage: 'clos' as ViolationStage, timeline: [...v.timeline, event] }
    })
    saveViolations(updated)
  }

  const addEvidence = (violationId: string) => {
    if (!evidenceForm.description) return
    const ev: ViolationEvidence = {
      id: uid(), type: evidenceForm.type || 'photo',
      description: evidenceForm.description, date: new Date().toISOString().split('T')[0],
    }
    const updated = violations.map(v => {
      if (v.id !== violationId) return v
      const lastEvent = v.timeline[v.timeline.length - 1]
      if (lastEvent) {
        lastEvent.evidences = [...(lastEvent.evidences || []), ev]
      }
      return { ...v, timeline: [...v.timeline] }
    })
    saveViolations(updated)
    setEvidenceForm({ type: 'photo', description: '' })
    setShowEvidenceModal(null)
  }

  const createViolation = () => {
    if (!newForm.condominoNome || !newForm.description || !newForm.imovel) return
    const v: Violation = {
      id: `v-${uid()}`, condominoNome: newForm.condominoNome || '',
      condominoFracao: newForm.condominoFracao || '', imovel: newForm.imovel || '',
      category: (newForm.category as ViolationCategory) || 'other',
      severity: (newForm.severity as Severity) || 'mineur',
      description: newForm.description || '',
      dateSignalement: new Date().toISOString().split('T')[0],
      currentStage: 'signalement', isRecidive: false,
      notes: newForm.notes || '',
      timeline: [{
        id: uid(), date: new Date().toISOString().split('T')[0],
        stage: 'signalement', action: 'Sinalização registada', author: 'Gestão Syndic',
      }],
    }
    v.isRecidive = checkRecidive(v.condominoNome, [...violations, v])
    saveViolations([...violations, v])
    setNewForm({ category: 'noise', severity: 'mineur', condominoNome: '', condominoFracao: '', imovel: '', description: '', notes: '' })
    setShowNewModal(false)
  }

  const saveArticle = () => {
    if (!articleForm.numero || !articleForm.titre || !articleForm.contenu) return
    if (editingArticle) {
      const updated = articles.map(a => a.id === editingArticle.id ? { ...editingArticle, ...articleForm } as ReglementArticle : a)
      saveArticles(updated)
    } else {
      const newArt: ReglementArticle = {
        id: `art-${uid()}`, numero: articleForm.numero || '',
        titre: articleForm.titre || '', contenu: articleForm.contenu || '',
        categoriesLiees: (articleForm.categoriesLiees as ViolationCategory[]) || [],
        sanctionPrevue: articleForm.sanctionPrevue || '',
      }
      saveArticles([...articles, newArt])
    }
    setArticleForm({ numero: '', titre: '', contenu: '', categoriesLiees: [], sanctionPrevue: '' })
    setEditingArticle(null)
    setShowArticleModal(false)
  }

  const deleteArticle = (id: string) => {
    saveArticles(articles.filter(a => a.id !== id))
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const getViolationStats = () => {
    const active = violations.filter(v => v.currentStage !== 'clos')
    const closed = violations.filter(v => v.currentStage === 'clos')
    const now = new Date()
    const thisMonth = closed.filter(v => {
      const last = v.timeline[v.timeline.length - 1]
      if (!last) return false
      const d = new Date(last.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const pendingEscalation = active.filter(v => {
      const last = v.timeline[v.timeline.length - 1]
      if (!last) return false
      const daysSince = Math.ceil((now.getTime() - new Date(last.date).getTime()) / 86400000)
      const cfgDays = config.escalationDays[v.currentStage as keyof EscalationConfig] || 14
      return daysSince >= cfgDays
    })
    const recidivists = new Set(violations.filter(v => v.isRecidive).map(v => v.condominoNome))

    const stageDistribution: Record<string, number> = {}
    STAGE_ORDER.forEach(s => { stageDistribution[s] = violations.filter(v => v.currentStage === s).length })

    const categoryDistribution: Record<string, number> = {}
    Object.keys(CATEGORIES).forEach(c => { categoryDistribution[c] = active.filter(v => v.category === c).length })

    // Avg resolution time for closed violations
    let avgDays = 0
    if (closed.length > 0) {
      const totalDays = closed.reduce((sum, v) => {
        const start = new Date(v.dateSignalement).getTime()
        const end = new Date(v.timeline[v.timeline.length - 1]?.date || v.dateSignalement).getTime()
        return sum + Math.ceil((end - start) / 86400000)
      }, 0)
      avgDays = Math.round(totalDays / closed.length)
    }

    // Most common category
    const catCounts: Record<string, number> = {}
    violations.forEach(v => { catCounts[v.category] = (catCounts[v.category] || 0) + 1 })
    const mostCommon = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      totalActive: active.length,
      pendingEscalation: pendingEscalation.length,
      closedThisMonth: thisMonth.length,
      recidivists: recidivists.size,
      stageDistribution,
      categoryDistribution,
      avgResolutionDays: avgDays,
      mostCommonCategory: mostCommon ? mostCommon[0] as ViolationCategory : null,
      recidiveRate: violations.length > 0 ? Math.round((violations.filter(v => v.isRecidive).length / violations.length) * 100) : 0,
      closed,
    }
  }

  const stats = getViolationStats()

  // Filtered active violations
  const activeViolations = violations.filter(v => {
    if (v.currentStage === 'clos') return false
    if (filterCategory && v.category !== filterCategory) return false
    if (filterStage && v.currentStage !== filterStage) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return v.condominoNome.toLowerCase().includes(q) || v.imovel.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
    }
    return true
  })

  const closedViolations = violations.filter(v => v.currentStage === 'clos')

  // ─── Shared Styles ──────────────────────────────────────────────────────────

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(13,27,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  }
  const modalBox: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: 32, maxWidth: 600, width: '90%',
    maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid #E4DDD0',
    borderRadius: 8, fontFamily: 'system-ui, -apple-system, sans-serif', outline: 'none',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as any }
  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff',
    background: '#C9A84C', border: 'none', borderRadius: 8, cursor: 'pointer',
  }
  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px', fontSize: 13, fontWeight: 500, color: '#4A5E78',
    background: '#F7F4EE', border: '1px solid #E4DDD0', borderRadius: 8, cursor: 'pointer',
  }
  const btnDanger: React.CSSProperties = {
    padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff',
    background: '#C0392B', border: 'none', borderRadius: 6, cursor: 'pointer',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#4A5E78', marginBottom: 4, display: 'block',
  }
  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 20, marginBottom: 12,
  }

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const renderStageBadge = (stage: ViolationStage) => {
    const s = STAGES[stage]
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: s.color + '18', color: s.color, whiteSpace: 'nowrap' }}>
        {s.emoji} {s.pt}
      </span>
    )
  }

  const renderSeverityBadge = (sev: Severity) => {
    const s = SEVERITIES[sev]
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: s.color + '15', color: s.color, whiteSpace: 'nowrap' }}>
        {s.pt}
      </span>
    )
  }

  // ─── Tab: Dashboard ─────────────────────────────────────────────────────────

  const renderDashboard = () => {
    const maxStageCount = Math.max(...Object.values(stats.stageDistribution), 1)
    const maxCatCount = Math.max(...Object.values(stats.categoryDistribution), 1)

    return (
      <div>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard emoji={'\u{1F6A8}'} label="Infrações ativas" value={stats.totalActive} sub="em curso" color="red" />
          <StatCard emoji={'\u{1F4E2}'} label="Escalada pendente" value={stats.pendingEscalation} sub="prazo ultrapassado" color="yellow" />
          <StatCard emoji={'\u2705'} label="Encerradas este mês" value={stats.closedThisMonth} sub="resolvidas" color="green" />
          <StatCard emoji={'\u{1F501}'} label="Reincidentes" value={stats.recidivists} sub="condóminos" color="red" />
        </div>

        {/* Pipeline */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', marginBottom: 16 }}>
            Pipeline de infrações
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STAGE_ORDER.map(stage => {
              const count = stats.stageDistribution[stage] || 0
              const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 140, fontSize: 12, color: '#4A5E78', flexShrink: 0 }}>
                    {STAGES[stage].emoji} {STAGES[stage].pt}
                  </div>
                  <div style={{ flex: 1, height: 22, background: '#F7F4EE', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', background: STAGES[stage].color,
                      borderRadius: 6, transition: 'width 0.3s', minWidth: count > 0 ? 24 : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                    }}>
                      {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{count}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category distribution */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', marginBottom: 16 }}>
            Distribuição por categoria (ativas)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(Object.keys(CATEGORIES) as ViolationCategory[]).map(cat => {
              const count = stats.categoryDistribution[cat] || 0
              const pct = maxCatCount > 0 ? (count / maxCatCount) * 100 : 0
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 180, fontSize: 12, color: '#4A5E78', flexShrink: 0 }}>
                    {CATEGORIES[cat].emoji} {CATEGORIES[cat].pt}
                  </div>
                  <div style={{ flex: 1, height: 20, background: '#F7F4EE', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', background: '#C9A84C',
                      borderRadius: 6, transition: 'width 0.3s', minWidth: count > 0 ? 20 : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                    }}>
                      {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{count}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Infrações Ativas ──────────────────────────────────────────────────

  const renderAtivas = () => (
    <div>
      {/* Filters + New button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ ...selectStyle, width: 200 }}>
          <option value="">Todas as categorias</option>
          {(Object.keys(CATEGORIES) as ViolationCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORIES[c].emoji} {CATEGORIES[c].pt}</option>
          ))}
        </select>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          style={{ ...selectStyle, width: 200 }}>
          <option value="">Todas as etapas</option>
          {STAGE_ORDER.filter(s => s !== 'clos').map(s => (
            <option key={s} value={s}>{STAGES[s].emoji} {STAGES[s].pt}</option>
          ))}
        </select>
        <input type="text" placeholder="Pesquisar condómino, edifício..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, width: 240 }} />
        <button onClick={() => setShowNewModal(true)} style={btnPrimary}>+ Nova infração</button>
      </div>

      {activeViolations.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#8A9BB0', fontSize: 14 }}>
          Nenhuma infração ativa encontrada.
        </div>
      )}

      {activeViolations.map(v => {
        const isExpanded = expandedId === v.id
        const nextStage = getNextStage(v.currentStage)
        return (
          <div key={v.id} style={cardStyle}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>{CATEGORIES[v.category].emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{CATEGORIES[v.category].pt}</span>
                {renderSeverityBadge(v.severity)}
                {renderStageBadge(v.currentStage)}
                {v.isRecidive && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#C0392B15', color: '#C0392B' }}>
                    Reincidente
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#8A9BB0' }}>{v.dateSignalement}</span>
            </div>

            {/* Info */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: '#0D1B2E', fontWeight: 600 }}>
                {v.condominoNome} — Fração {v.condominoFracao}
              </div>
              <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 2 }}>{v.imovel}</div>
              <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 6, lineHeight: 1.5 }}>{v.description}</div>
              {v.notes && <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 4, fontStyle: 'italic' }}>{v.notes}</div>}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setExpandedId(isExpanded ? null : v.id)} style={btnSecondary}>
                {isExpanded ? 'Fechar cronologia' : `Cronologia (${v.timeline.length})`}
              </button>
              {nextStage && (
                <button onClick={() => {
                  setShowLetterModal({ violation: v, stage: nextStage })
                }} style={{ ...btnPrimary, fontSize: 12, padding: '8px 14px' }}>
                  Escalader → {STAGES[nextStage].pt}
                </button>
              )}
              <button onClick={() => setShowEvidenceModal(v.id)} style={{ ...btnSecondary, fontSize: 12, padding: '8px 14px' }}>
                + Prova
              </button>
              <button onClick={() => closeViolation(v.id)} style={{ ...btnSecondary, fontSize: 12, padding: '8px 14px', color: '#1A7A6E' }}>
                Encerrar
              </button>
            </div>

            {/* Timeline */}
            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: '1px solid #E4DDD0', paddingTop: 16 }}>
                {v.timeline.map((ev, idx) => (
                  <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: STAGES[ev.stage].color, border: '2px solid #fff', boxShadow: '0 0 0 1px ' + STAGES[ev.stage].color,
                      }} />
                      {idx < v.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: '#E4DDD0', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {renderStageBadge(ev.stage)}
                        <span style={{ fontSize: 11, color: '#8A9BB0' }}>{ev.date}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#0D1B2E', marginTop: 4 }}>{ev.action}</div>
                      <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 2 }}>por {ev.author}</div>
                      {ev.notes && <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 4, fontStyle: 'italic' }}>{ev.notes}</div>}
                      {ev.evidences && ev.evidences.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          {ev.evidences.map(e => (
                            <div key={e.id} style={{ fontSize: 11, color: '#4A5E78', padding: '4px 8px', background: '#F7F4EE', borderRadius: 4, marginBottom: 4, display: 'inline-block', marginRight: 4 }}>
                              {e.type === 'photo' ? '\u{1F4F7}' : e.type === 'document' ? '\u{1F4C4}' : e.type === 'audio' ? '\u{1F3A4}' : '\u{1F4AC}'} {e.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ─── Tab: Histórico ─────────────────────────────────────────────────────────

  const renderHistorico = () => (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard emoji={'\u{1F4C5}'} label="Tempo médio resolução" value={`${stats.avgResolutionDays}d`} sub="dias" color="blue" />
        <StatCard emoji={'\u{1F3C6}'} label="Categoria mais frequente"
          value={stats.mostCommonCategory ? CATEGORIES[stats.mostCommonCategory].emoji : '—'}
          sub={stats.mostCommonCategory ? CATEGORIES[stats.mostCommonCategory].pt : 'N/A'} color="yellow" />
        <StatCard emoji={'\u{1F501}'} label="Taxa de reincidência" value={`${stats.recidiveRate}%`} sub="das infrações" color="red" />
      </div>

      {closedViolations.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#8A9BB0', fontSize: 14 }}>
          Nenhuma infração encerrada.
        </div>
      )}

      {closedViolations.map(v => (
        <div key={v.id} style={{ ...cardStyle, opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{CATEGORIES[v.category].emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E' }}>{v.condominoNome}</span>
              <span style={{ fontSize: 12, color: '#8A9BB0' }}>— {v.condominoFracao}, {v.imovel}</span>
            </div>
            {renderStageBadge('clos')}
          </div>
          <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 8 }}>{v.description}</div>
          <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 6 }}>
            Sinalizado: {v.dateSignalement} — Encerrado: {v.timeline[v.timeline.length - 1]?.date || '—'} — Etapas: {v.timeline.length}
          </div>
        </div>
      ))}
    </div>
  )

  // ─── Tab: Regulamento ───────────────────────────────────────────────────────

  const renderRegulamento = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', margin: 0 }}>
          Artigos do regulamento
        </h3>
        <button onClick={() => { setEditingArticle(null); setArticleForm({ numero: '', titre: '', contenu: '', categoriesLiees: [], sanctionPrevue: '' }); setShowArticleModal(true) }}
          style={btnPrimary}>+ Novo artigo</button>
      </div>

      {articles.map(art => (
        <div key={art.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{art.numero}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', marginLeft: 8 }}>{art.titre}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => {
                setEditingArticle(art)
                setArticleForm({ numero: art.numero, titre: art.titre, contenu: art.contenu, categoriesLiees: art.categoriesLiees, sanctionPrevue: art.sanctionPrevue })
                setShowArticleModal(true)
              }} style={{ ...btnSecondary, fontSize: 11, padding: '5px 10px' }}>Editar</button>
              <button onClick={() => deleteArticle(art.id)} style={{ ...btnDanger, fontSize: 11, padding: '5px 10px' }}>Apagar</button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 10, lineHeight: 1.6 }}>{art.contenu}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#8A9BB0', fontWeight: 600 }}>Categorias:</span>
            {art.categoriesLiees.map(c => (
              <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F7F4EE', color: '#4A5E78' }}>
                {CATEGORIES[c]?.emoji} {CATEGORIES[c]?.pt}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#C0392B', marginTop: 6, fontWeight: 500 }}>
            Sanção: {art.sanctionPrevue}
          </div>
        </div>
      ))}
    </div>
  )

  // ─── Tab: Configuração ──────────────────────────────────────────────────────

  const renderConfiguracao = () => (
    <div>
      {/* Escalation timing */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', marginBottom: 16 }}>
          Prazos de escalada (dias)
        </h3>
        <p style={{ fontSize: 12, color: '#8A9BB0', marginBottom: 16 }}>
          Número de dias antes de gerar um lembrete automático para cada etapa.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {STAGE_ORDER.filter(s => s !== 'clos').map(stage => (
            <div key={stage}>
              <label style={labelStyle}>{STAGES[stage].emoji} {STAGES[stage].pt}</label>
              <input type="number" value={config.escalationDays[stage as keyof EscalationConfig] || 14}
                onChange={e => saveConfig({
                  ...config,
                  escalationDays: { ...config.escalationDays, [stage]: parseInt(e.target.value) || 0 },
                })}
                style={{ ...inputStyle, width: 80 }} min={1} />
            </div>
          ))}
        </div>
      </div>

      {/* Default fines */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', marginBottom: 16 }}>
          Multas padrão por gravidade (\u20AC)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {(Object.keys(SEVERITIES) as Severity[]).map(sev => (
            <div key={sev}>
              <label style={labelStyle}>
                <span style={{ color: SEVERITIES[sev].color }}>{SEVERITIES[sev].pt}</span>
              </label>
              <input type="number" value={config.defaultFines[sev]}
                onChange={e => saveConfig({
                  ...config,
                  defaultFines: { ...config.defaultFines, [sev]: parseInt(e.target.value) || 0 },
                })}
                style={{ ...inputStyle, width: 100 }} min={0} />
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0D1B2E', marginBottom: 16 }}>
          Notificações
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'email' as const, label: 'Notificações por e-mail' },
            { key: 'sms' as const, label: 'Notificações por SMS' },
            { key: 'dashboard' as const, label: 'Alertas no dashboard' },
            { key: 'autoReminder' as const, label: 'Lembretes automáticos de escalada' },
          ].map(n => (
            <label key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#0D1B2E', cursor: 'pointer' }}>
              <input type="checkbox" checked={config.notifications[n.key]}
                onChange={e => saveConfig({
                  ...config,
                  notifications: { ...config.notifications, [n.key]: e.target.checked },
                })}
                style={{ width: 18, height: 18, accentColor: '#C9A84C' }} />
              {n.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  // ─── Modals ─────────────────────────────────────────────────────────────────

  const renderNewViolationModal = () => {
    if (!showNewModal) return null
    return (
      <div style={modalOverlay} onClick={() => setShowNewModal(false)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D1B2E', marginBottom: 20 }}>
            Nova infração
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Nome do condómino *</label>
                <input value={newForm.condominoNome || ''} onChange={e => setNewForm({ ...newForm, condominoNome: e.target.value })} style={inputStyle} placeholder="Ex: João Silva" />
              </div>
              <div>
                <label style={labelStyle}>Fração *</label>
                <input value={newForm.condominoFracao || ''} onChange={e => setNewForm({ ...newForm, condominoFracao: e.target.value })} style={inputStyle} placeholder="Ex: 3-A" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Edifício / Imóvel *</label>
              <input value={newForm.imovel || ''} onChange={e => setNewForm({ ...newForm, imovel: e.target.value })} style={inputStyle} placeholder="Ex: Edifício Aurora" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={newForm.category || 'noise'} onChange={e => setNewForm({ ...newForm, category: e.target.value as ViolationCategory })} style={selectStyle}>
                  {(Object.keys(CATEGORIES) as ViolationCategory[]).map(c => (
                    <option key={c} value={c}>{CATEGORIES[c].emoji} {CATEGORIES[c].pt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Gravidade</label>
                <select value={newForm.severity || 'mineur'} onChange={e => setNewForm({ ...newForm, severity: e.target.value as Severity })} style={selectStyle}>
                  {(Object.keys(SEVERITIES) as Severity[]).map(s => (
                    <option key={s} value={s}>{SEVERITIES[s].pt}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Descrição *</label>
              <textarea value={newForm.description || ''} onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Descreva a infração..." />
            </div>
            <div>
              <label style={labelStyle}>Notas internas</label>
              <textarea value={newForm.notes || ''} onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} placeholder="Notas internas (opcional)" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowNewModal(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={createViolation} style={btnPrimary}>Criar infração</button>
          </div>
        </div>
      </div>
    )
  }

  const renderEvidenceModal = () => {
    if (!showEvidenceModal) return null
    return (
      <div style={modalOverlay} onClick={() => setShowEvidenceModal(null)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D1B2E', marginBottom: 20 }}>
            Adicionar prova
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Tipo de prova</label>
              <select value={evidenceForm.type || 'photo'} onChange={e => setEvidenceForm({ ...evidenceForm, type: e.target.value as ViolationEvidence['type'] })} style={selectStyle}>
                {EVIDENCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Descrição *</label>
              <textarea value={evidenceForm.description || ''} onChange={e => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Descreva a prova..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setShowEvidenceModal(null)} style={btnSecondary}>Cancelar</button>
            <button onClick={() => addEvidence(showEvidenceModal)} style={btnPrimary}>Adicionar</button>
          </div>
        </div>
      </div>
    )
  }

  const renderLetterModal = () => {
    if (!showLetterModal) return null
    const { violation, stage } = showLetterModal
    const letter = generateWarningLetter(violation, stage)
    return (
      <div style={modalOverlay} onClick={() => setShowLetterModal(null)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D1B2E', marginBottom: 8 }}>
            Confirmar escalada
          </h2>
          <p style={{ fontSize: 13, color: '#4A5E78', marginBottom: 16 }}>
            Avançar para: <strong>{STAGES[stage].emoji} {STAGES[stage].pt}</strong>
          </p>
          <div style={{ background: '#F7F4EE', border: '1px solid #E4DDD0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A9BB0', marginBottom: 8 }}>Modelo de carta:</div>
            <pre style={{ fontSize: 12, color: '#0D1B2E', whiteSpace: 'pre-wrap', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.6, margin: 0 }}>
              {letter}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowLetterModal(null)} style={btnSecondary}>Cancelar</button>
            <button onClick={() => { escalateViolation(violation.id); setShowLetterModal(null) }}
              style={{ ...btnPrimary, background: STAGES[stage].color }}>
              Confirmar escalada
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderArticleModal = () => {
    if (!showArticleModal) return null
    return (
      <div style={modalOverlay} onClick={() => setShowArticleModal(false)}>
        <div style={modalBox} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D1B2E', marginBottom: 20 }}>
            {editingArticle ? 'Editar artigo' : 'Novo artigo'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Número *</label>
                <input value={articleForm.numero || ''} onChange={e => setArticleForm({ ...articleForm, numero: e.target.value })} style={inputStyle} placeholder="Art. X" />
              </div>
              <div>
                <label style={labelStyle}>Título *</label>
                <input value={articleForm.titre || ''} onChange={e => setArticleForm({ ...articleForm, titre: e.target.value })} style={inputStyle} placeholder="Título do artigo" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Conteúdo *</label>
              <textarea value={articleForm.contenu || ''} onChange={e => setArticleForm({ ...articleForm, contenu: e.target.value })}
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} placeholder="Texto do artigo..." />
            </div>
            <div>
              <label style={labelStyle}>Categorias relacionadas</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(CATEGORIES) as ViolationCategory[]).map(c => {
                  const selected = (articleForm.categoriesLiees || []).includes(c)
                  return (
                    <button key={c} onClick={() => {
                      const curr = articleForm.categoriesLiees || []
                      setArticleForm({
                        ...articleForm,
                        categoriesLiees: selected ? curr.filter(x => x !== c) : [...curr, c],
                      })
                    }} style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                      border: selected ? '1px solid #C9A84C' : '1px solid #E4DDD0',
                      background: selected ? '#C9A84C15' : '#fff',
                      color: selected ? '#C9A84C' : '#8A9BB0', fontWeight: selected ? 600 : 400,
                    }}>
                      {CATEGORIES[c].emoji} {CATEGORIES[c].pt}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Sanção prevista</label>
              <input value={articleForm.sanctionPrevue || ''} onChange={e => setArticleForm({ ...articleForm, sanctionPrevue: e.target.value })}
                style={inputStyle} placeholder="Ex: 1.º aviso → multa 50-200€" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => { setShowArticleModal(false); setEditingArticle(null) }} style={btnSecondary}>Cancelar</button>
            <button onClick={saveArticle} style={btnPrimary}>{editingArticle ? 'Guardar' : 'Criar'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: '#0D1B2E', marginBottom: 6 }}>
          Gestão de Infrações
        </h2>
        <p style={{ fontSize: 14, color: '#8A9BB0', margin: 0 }}>
          Acompanhamento de violações ao regulamento interno dos condomínios
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E4DDD0', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? '#0D1B2E' : '#8A9BB0',
              borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && renderDashboard()}
      {tab === 'ativas' && renderAtivas()}
      {tab === 'historico' && renderHistorico()}
      {tab === 'regulamento' && renderRegulamento()}
      {tab === 'configuracao' && renderConfiguracao()}

      {/* Modals */}
      {renderNewViolationModal()}
      {renderEvidenceModal()}
      {renderLetterModal()}
      {renderArticleModal()}
    </div>
  )
}
