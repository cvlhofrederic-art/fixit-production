'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { StatCard } from '../types'
import type { User } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'conversas' | 'conhecimento' | 'configuracao'
type IntentType = 'incident' | 'payment' | 'info' | 'complaint' | 'ag' | 'other'
type ConversationStatus = 'active' | 'waiting_human' | 'resolved' | 'escalated'

interface ChatMessage {
  id: string
  sender: 'resident' | 'bot' | 'human_agent'
  content: string
  timestamp: string
  intent?: IntentType
  confidence?: number
}

interface Conversation {
  id: string
  condominoNome: string
  condominoTelefone: string
  fracao: string
  imovel: string
  status: ConversationStatus
  lastMessage: string
  lastMessageAt: string
  messages: ChatMessage[]
  detectedIntent: IntentType
  confidence: number
  incidentCreated?: boolean
  assignedTo?: string
}

interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  category: 'horarios' | 'pagamentos' | 'obras' | 'regulamento' | 'contactos' | 'outro'
  lastUpdated: string
  usageCount: number
}

interface ChatbotConfig {
  isActive: boolean
  autoReplyHours: { start: number; end: number }
  escalationThreshold: number
  createIncidentThreshold: number
  welcomeMessage: string
  languages: string[]
}

interface ChatbotStats {
  totalConversations: number
  resolvedAutomatic: number
  escalatedToHuman: number
  avgResponseTime: number
  incidentsCreated: number
  satisfactionRate: number
}

// ─── Colors ─────────────────────────────────────────────────────────────────────

const NAVY = '#0D1B2E'
const GOLD = '#C9A84C'
const TEAL = '#1A7A6E'
const BORDER = '#E4DDD0'
const BG = '#F7F4EE'
const RED = '#C0392B'
const AMBER = '#D4830A'
const WHATSAPP_GREEN = '#25D366'

const INTENT_COLORS: Record<IntentType, string> = {
  incident: RED,
  payment: AMBER,
  info: TEAL,
  complaint: '#8E44AD',
  ag: GOLD,
  other: '#7F8C8D',
}

const INTENT_LABELS: Record<IntentType, string> = {
  incident: 'Ocorrência',
  payment: 'Pagamento',
  info: 'Informação',
  complaint: 'Reclamação',
  ag: 'Assembleia',
  other: 'Outro',
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  active: WHATSAPP_GREEN,
  waiting_human: AMBER,
  resolved: TEAL,
  escalated: RED,
}

const STATUS_LABELS: Record<ConversationStatus, string> = {
  active: 'Ativa',
  waiting_human: 'Aguarda Humano',
  resolved: 'Resolvida',
  escalated: 'Escalada',
}

const CATEGORY_LABELS: Record<string, string> = {
  horarios: 'Horários',
  pagamentos: 'Pagamentos',
  obras: 'Obras',
  regulamento: 'Regulamento',
  contactos: 'Contactos',
  outro: 'Outro',
}

// ─── Demo Data ──────────────────────────────────────────────────────────────────

function buildDemoConversations(): Conversation[] {
  return [
    {
      id: 'conv-1',
      condominoNome: 'Maria Santos',
      condominoTelefone: '+351 912 345 678',
      fracao: 'R/C Esq.',
      imovel: 'Edifício Aurora',
      status: 'escalated',
      lastMessage: 'Está a pingar cada vez mais, preciso de ajuda urgente!',
      lastMessageAt: '2026-03-25T09:42:00',
      detectedIntent: 'incident',
      confidence: 0.95,
      incidentCreated: true,
      messages: [
        { id: 'm1-1', sender: 'resident', content: 'Bom dia, tenho uma fuga de água na cozinha. Está a pingar do teto há duas horas.', timestamp: '2026-03-25T09:30:00', intent: 'incident', confidence: 0.95 },
        { id: 'm1-2', sender: 'bot', content: 'Bom dia, Maria. Lamento a situação. Registei uma ocorrência de fuga de água na sua fração (R/C Esq.). O gestor será notificado imediatamente. Consegue fechar a torneira de segurança da cozinha enquanto aguarda?', timestamp: '2026-03-25T09:30:15', intent: 'incident', confidence: 0.95 },
        { id: 'm1-3', sender: 'resident', content: 'Já fechei mas continua a pingar. Acho que vem do andar de cima.', timestamp: '2026-03-25T09:35:00' },
        { id: 'm1-4', sender: 'bot', content: 'Entendido. Vou escalar para o gestor do condomínio para que possa contactar o vizinho do 1.º andar e enviar um canalizador. Aguarde por favor.', timestamp: '2026-03-25T09:35:12' },
        { id: 'm1-5', sender: 'resident', content: 'Está a pingar cada vez mais, preciso de ajuda urgente!', timestamp: '2026-03-25T09:42:00' },
      ],
    },
    {
      id: 'conv-2',
      condominoNome: 'João Ferreira',
      condominoTelefone: '+351 913 456 789',
      fracao: '2.º Dto.',
      imovel: 'Edifício Aurora',
      status: 'resolved',
      lastMessage: 'Perfeito, obrigado pela informação!',
      lastMessageAt: '2026-03-25T08:15:00',
      detectedIntent: 'payment',
      confidence: 0.88,
      messages: [
        { id: 'm2-1', sender: 'resident', content: 'Olá, quanto é a quota deste mês? Ainda não recebi o aviso.', timestamp: '2026-03-25T08:00:00', intent: 'payment', confidence: 0.88 },
        { id: 'm2-2', sender: 'bot', content: 'Olá, João. A quota mensal da sua fração (2.º Dto.) é de 85€. O pagamento pode ser feito por transferência bancária até ao dia 8 de cada mês. IBAN: PT50 0035 0000 1234 5678 9012.', timestamp: '2026-03-25T08:00:10' },
        { id: 'm2-3', sender: 'resident', content: 'Perfeito, obrigado pela informação!', timestamp: '2026-03-25T08:15:00' },
      ],
    },
    {
      id: 'conv-3',
      condominoNome: 'Ana Oliveira',
      condominoTelefone: '+351 914 567 890',
      fracao: '1.º Esq.',
      imovel: 'Edifício Belém',
      status: 'active',
      lastMessage: 'Será presencial ou online?',
      lastMessageAt: '2026-03-25T10:05:00',
      detectedIntent: 'ag',
      confidence: 0.92,
      messages: [
        { id: 'm3-1', sender: 'resident', content: 'Boa tarde, quando é a próxima assembleia geral?', timestamp: '2026-03-25T10:00:00', intent: 'ag', confidence: 0.92 },
        { id: 'm3-2', sender: 'bot', content: 'Boa tarde, Ana. A próxima Assembleia Geral está agendada para 15 de abril de 2026, às 19h00. A convocatória será enviada com 15 dias de antecedência conforme o regulamento.', timestamp: '2026-03-25T10:00:12' },
        { id: 'm3-3', sender: 'resident', content: 'Será presencial ou online?', timestamp: '2026-03-25T10:05:00' },
      ],
    },
    {
      id: 'conv-4',
      condominoNome: 'Carlos Mendes',
      condominoTelefone: '+351 915 678 901',
      fracao: '3.º Dto.',
      imovel: 'Edifício Aurora',
      status: 'escalated',
      lastMessage: 'É inaceitável, todas as noites até às 2 da manhã!',
      lastMessageAt: '2026-03-24T23:30:00',
      detectedIntent: 'complaint',
      confidence: 0.87,
      messages: [
        { id: 'm4-1', sender: 'resident', content: 'Quero fazer uma reclamação sobre o barulho do vizinho do 3.º Esq. Música altíssima todas as noites.', timestamp: '2026-03-24T23:10:00', intent: 'complaint', confidence: 0.87 },
        { id: 'm4-2', sender: 'bot', content: 'Lamento o incómodo, Carlos. Registei a sua reclamação sobre ruído noturno. O regulamento interno prevê silêncio entre as 22h e as 8h. O gestor será informado para contactar o condómino em causa.', timestamp: '2026-03-24T23:10:14' },
        { id: 'm4-3', sender: 'resident', content: 'É inaceitável, todas as noites até às 2 da manhã!', timestamp: '2026-03-24T23:30:00' },
        { id: 'm4-4', sender: 'human_agent', content: 'Carlos, boa noite. Sou o gestor Pedro. Vou enviar um aviso formal ao condómino amanhã de manhã. Se persistir, tomaremos medidas legais conforme o regulamento.', timestamp: '2026-03-24T23:45:00' },
      ],
    },
    {
      id: 'conv-5',
      condominoNome: 'Rita Almeida',
      condominoTelefone: '+351 916 789 012',
      fracao: '4.º Esq.',
      imovel: 'Edifício Belém',
      status: 'active',
      lastMessage: 'O elevador está parado desde ontem, alguém já reportou?',
      lastMessageAt: '2026-03-25T07:45:00',
      detectedIntent: 'incident',
      confidence: 0.93,
      incidentCreated: true,
      messages: [
        { id: 'm5-1', sender: 'resident', content: 'O elevador está parado desde ontem, alguém já reportou?', timestamp: '2026-03-25T07:45:00', intent: 'incident', confidence: 0.93 },
        { id: 'm5-2', sender: 'bot', content: 'Bom dia, Rita. Sim, já temos conhecimento da avaria do elevador. A empresa de manutenção (Otis) foi contactada e tem intervenção prevista para hoje às 14h. Pedimos desculpa pelo incómodo.', timestamp: '2026-03-25T07:45:10' },
      ],
    },
    {
      id: 'conv-6',
      condominoNome: 'Pedro Silva',
      condominoTelefone: '+351 917 890 123',
      fracao: '1.º Dto.',
      imovel: 'Edifício Aurora',
      status: 'resolved',
      lastMessage: 'Obrigado, vou consultar.',
      lastMessageAt: '2026-03-24T14:20:00',
      detectedIntent: 'info',
      confidence: 0.85,
      messages: [
        { id: 'm6-1', sender: 'resident', content: 'Posso fazer obras de renovação na minha fração? Quero mudar a cozinha.', timestamp: '2026-03-24T14:00:00', intent: 'info', confidence: 0.85 },
        { id: 'm6-2', sender: 'bot', content: 'Olá, Pedro. Sim, pode realizar obras na sua fração desde que: 1) Comunique ao administrador com 15 dias de antecedência; 2) As obras decorram em dias úteis entre as 8h e as 18h; 3) Não afetem a estrutura do edifício. O regulamento interno (Art. 12) tem os detalhes completos.', timestamp: '2026-03-24T14:00:12' },
        { id: 'm6-3', sender: 'resident', content: 'Obrigado, vou consultar.', timestamp: '2026-03-24T14:20:00' },
      ],
    },
    {
      id: 'conv-7',
      condominoNome: 'Teresa Costa',
      condominoTelefone: '+351 918 901 234',
      fracao: '2.º Esq.',
      imovel: 'Edifício Belém',
      status: 'waiting_human',
      lastMessage: 'Já paguei mas continua a dizer que estou em atraso.',
      lastMessageAt: '2026-03-25T11:00:00',
      detectedIntent: 'payment',
      confidence: 0.55,
      messages: [
        { id: 'm7-1', sender: 'resident', content: 'Já paguei a quota de março mas no portal continua a dizer que estou em atraso. Podem verificar?', timestamp: '2026-03-25T10:50:00', intent: 'payment', confidence: 0.55 },
        { id: 'm7-2', sender: 'bot', content: 'Olá, Teresa. Obrigado por reportar. Vou encaminhar para o gestor verificar o registo do seu pagamento. Poderia enviar o comprovativo de transferência para agilizar?', timestamp: '2026-03-25T10:50:11' },
        { id: 'm7-3', sender: 'resident', content: 'Já paguei mas continua a dizer que estou em atraso.', timestamp: '2026-03-25T11:00:00' },
      ],
    },
    {
      id: 'conv-8',
      condominoNome: 'Miguel Rodrigues',
      condominoTelefone: '+351 919 012 345',
      fracao: 'R/C Dto.',
      imovel: 'Edifício Aurora',
      status: 'resolved',
      lastMessage: 'Ah ótimo, obrigado!',
      lastMessageAt: '2026-03-23T16:30:00',
      detectedIntent: 'info',
      confidence: 0.90,
      messages: [
        { id: 'm8-1', sender: 'resident', content: 'Qual é o horário do porteiro?', timestamp: '2026-03-23T16:20:00', intent: 'info', confidence: 0.90 },
        { id: 'm8-2', sender: 'bot', content: 'Olá, Miguel. O porteiro está presente de segunda a sexta, das 8h às 20h, e aos sábados das 9h às 13h. Ao domingo e feriados não há serviço de portaria.', timestamp: '2026-03-23T16:20:08' },
        { id: 'm8-3', sender: 'resident', content: 'Ah ótimo, obrigado!', timestamp: '2026-03-23T16:30:00' },
      ],
    },
  ]
}

function buildDemoKnowledge(): KnowledgeEntry[] {
  return [
    { id: 'kb-1', question: 'Qual é o valor da quota mensal?', answer: 'A quota mensal varia por fração. Consulte o mapa de quotas aprovado na última AG ou contacte o administrador para saber o valor exato da sua fração.', category: 'pagamentos', lastUpdated: '2026-03-01', usageCount: 142 },
    { id: 'kb-2', question: 'Como pagar a quota do condomínio?', answer: 'O pagamento pode ser feito por transferência bancária para o IBAN do condomínio ou por débito direto. O prazo limite é o dia 8 de cada mês.', category: 'pagamentos', lastUpdated: '2026-03-01', usageCount: 118 },
    { id: 'kb-3', question: 'Qual o horário do porteiro?', answer: 'O porteiro está presente de segunda a sexta das 8h às 20h e aos sábados das 9h às 13h. Domingos e feriados sem serviço.', category: 'horarios', lastUpdated: '2026-02-15', usageCount: 95 },
    { id: 'kb-4', question: 'Quando é a próxima assembleia geral?', answer: 'A data da próxima AG é comunicada com pelo menos 15 dias de antecedência por carta registada e por email. Consulte os avisos no hall de entrada ou contacte o administrador.', category: 'horarios', lastUpdated: '2026-03-10', usageCount: 87 },
    { id: 'kb-5', question: 'Posso fazer obras na minha fração?', answer: 'Sim, desde que comunique ao administrador com 15 dias de antecedência, as obras ocorram em dias úteis entre 8h e 18h, e não afetem a estrutura do edifício (Art. 12 do regulamento interno).', category: 'obras', lastUpdated: '2026-02-20', usageCount: 63 },
    { id: 'kb-6', question: 'Quais são as regras de silêncio?', answer: 'O regulamento interno prevê silêncio entre as 22h e as 8h. Ruído excessivo fora deste horário também pode ser objeto de reclamação.', category: 'regulamento', lastUpdated: '2026-01-15', usageCount: 78 },
    { id: 'kb-7', question: 'Como reportar uma avaria?', answer: 'Envie mensagem por WhatsApp ou contacte o administrador por telefone. Para emergências (fugas de água, problemas elétricos), ligue diretamente para o número de emergência do condomínio.', category: 'contactos', lastUpdated: '2026-03-05', usageCount: 104 },
    { id: 'kb-8', question: 'Onde posso estacionar?', answer: 'Cada fração tem um lugar de estacionamento atribuído na garagem. Os lugares estão numerados conforme a escritura. Visitantes podem usar os lugares marcados como "Visitas" (máximo 24h).', category: 'regulamento', lastUpdated: '2026-02-10', usageCount: 52 },
  ]
}

function buildDemoConfig(): ChatbotConfig {
  return {
    isActive: true,
    autoReplyHours: { start: 8, end: 22 },
    escalationThreshold: 60,
    createIncidentThreshold: 80,
    welcomeMessage: 'Olá! Sou o assistente virtual do seu condomínio. Como posso ajudar?',
    languages: ['PT'],
  }
}

function buildDemoStats(): ChatbotStats {
  return {
    totalConversations: 247,
    resolvedAutomatic: 189,
    escalatedToHuman: 34,
    avgResponseTime: 8,
    incidentsCreated: 24,
    satisfactionRate: 4.2,
  }
}

function buildHourlyData(): number[] {
  return [0, 0, 0, 0, 0, 1, 3, 8, 15, 22, 18, 14, 10, 12, 16, 19, 17, 20, 24, 18, 12, 7, 3, 1]
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ChatbotWhatsAppSection({ user, userRole }: { user: User; userRole: string }) {
  const STORAGE_KEY = `fixit_chatbot_whatsapp_${user?.id}`
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [config, setConfig] = useState<ChatbotConfig>(buildDemoConfig())
  const [stats] = useState<ChatbotStats>(buildDemoStats())
  const [hourlyData] = useState<number[]>(buildHourlyData())

  // Conversas tab state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all')
  const [agentMessage, setAgentMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Knowledge tab state
  const [knowledgeCategoryFilter, setKnowledgeCategoryFilter] = useState<string>('all')
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null)
  const [kbForm, setKbForm] = useState({ question: '', answer: '', category: 'outro' as KnowledgeEntry['category'] })

  // Load from localStorage or use demo data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        setConversations(data.conversations || buildDemoConversations())
        setKnowledge(data.knowledge || buildDemoKnowledge())
        setConfig(data.config || buildDemoConfig())
      } else {
        setConversations(buildDemoConversations())
        setKnowledge(buildDemoKnowledge())
      }
    } catch {
      setConversations(buildDemoConversations())
      setKnowledge(buildDemoKnowledge())
    }
  }, [STORAGE_KEY])

  // Persist changes
  useEffect(() => {
    if (conversations.length === 0 && knowledge.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, knowledge, config }))
    } catch { /* quota exceeded */ }
  }, [conversations, knowledge, config, STORAGE_KEY])

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedConvId, conversations])

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  )

  const filteredConversations = useMemo(() => {
    if (statusFilter === 'all') return conversations
    return conversations.filter(c => c.status === statusFilter)
  }, [conversations, statusFilter])

  const filteredKnowledge = useMemo(() => {
    const sorted = [...knowledge].sort((a, b) => b.usageCount - a.usageCount)
    if (knowledgeCategoryFilter === 'all') return sorted
    return sorted.filter(k => k.category === knowledgeCategoryFilter)
  }, [knowledge, knowledgeCategoryFilter])

  // ─── Intent stats ───
  const intentCounts = useMemo(() => {
    const counts: Record<IntentType, number> = { incident: 0, payment: 0, info: 0, complaint: 0, ag: 0, other: 0 }
    conversations.forEach(c => { counts[c.detectedIntent]++ })
    return counts
  }, [conversations])

  const escalatedConversations = useMemo(
    () => conversations.filter(c => c.status === 'escalated' || c.status === 'waiting_human'),
    [conversations]
  )

  // ─── Actions ───
  function handleSendAgentMessage() {
    if (!agentMessage.trim() || !selectedConvId) return
    setSendingMessage(true)
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'human_agent',
      content: agentMessage.trim(),
      timestamp: new Date().toISOString(),
    }
    setConversations(prev => prev.map(c =>
      c.id === selectedConvId
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: newMsg.content, lastMessageAt: newMsg.timestamp, status: 'active' as ConversationStatus }
        : c
    ))
    setAgentMessage('')
    setTimeout(() => setSendingMessage(false), 300)
  }

  function handleResolveConversation(convId: string) {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, status: 'resolved' as ConversationStatus } : c
    ))
  }

  function handleCreateIncident(convId: string) {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, incidentCreated: true } : c
    ))
  }

  function handleSaveKnowledge() {
    if (!kbForm.question.trim() || !kbForm.answer.trim()) return
    if (editingEntry) {
      setKnowledge(prev => prev.map(k =>
        k.id === editingEntry.id
          ? { ...k, question: kbForm.question, answer: kbForm.answer, category: kbForm.category, lastUpdated: new Date().toISOString().split('T')[0] }
          : k
      ))
    } else {
      const newEntry: KnowledgeEntry = {
        id: `kb-${Date.now()}`,
        question: kbForm.question,
        answer: kbForm.answer,
        category: kbForm.category,
        lastUpdated: new Date().toISOString().split('T')[0],
        usageCount: 0,
      }
      setKnowledge(prev => [...prev, newEntry])
    }
    setKbForm({ question: '', answer: '', category: 'outro' })
    setEditingEntry(null)
    setShowKnowledgeModal(false)
  }

  function handleDeleteKnowledge(id: string) {
    setKnowledge(prev => prev.filter(k => k.id !== id))
  }

  function formatTime(ts: string) {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  function formatDate(ts: string) {
    try {
      const d = new Date(ts)
      const today = new Date()
      if (d.toDateString() === today.toDateString()) return 'Hoje'
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
      return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
    } catch { return '' }
  }

  const maxHourly = Math.max(...hourlyData, 1)

  // ─── Tabs ───
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'conversas', label: 'Conversas Ativas', icon: '💬' },
    { id: 'conhecimento', label: 'Base de Conhecimento', icon: '📚' },
    { id: 'configuracao', label: 'Configuração', icon: '⚙️' },
  ]

  // ─── Render ───
  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: WHATSAPP_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤖</div>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: NAVY, margin: 0 }}>Chatbot WhatsApp IA</h2>
          <p style={{ fontSize: 13, color: '#4A5E78', margin: 0 }}>Assistente automatizado para condóminos via WhatsApp</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: config.isActive ? WHATSAPP_GREEN : RED, display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: config.isActive ? TEAL : RED, fontWeight: 600 }}>
            {config.isActive ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${BORDER}`, marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? NAVY : '#4A5E78',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? `3px solid ${GOLD}` : '3px solid transparent',
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Dashboard Tab ─── */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Stat cards row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <StatCard emoji="💬" label="Conversas hoje" value={stats.totalConversations} sub="Total acumulado" color="green" />
            <StatCard emoji="✅" label="Resolução automática" value={`${Math.round((stats.resolvedAutomatic / stats.totalConversations) * 100)}%`} sub={`${stats.resolvedAutomatic} de ${stats.totalConversations}`} color="green" />
            <StatCard emoji="⚡" label="Tempo médio resposta" value={`${stats.avgResponseTime}s`} sub="Média do chatbot" color="blue" />
          </div>
          {/* Stat cards row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard emoji="🔧" label="Ocorrências criadas" value={stats.incidentsCreated} sub="Auto-detectadas pela IA" color="yellow" />
            <StatCard emoji="🧑‍💼" label="Escaladas para humano" value={stats.escalatedToHuman} sub={`${Math.round((stats.escalatedToHuman / stats.totalConversations) * 100)}% do total`} color="red" />
            <StatCard emoji="⭐" label="Satisfação" value={`${stats.satisfactionRate}/5`} sub="Avaliação média" color="yellow" />
          </div>

          {/* Intent distribution + hourly chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Intent distribution */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 16px' }}>Distribuição por Intenção</h3>
              {(Object.keys(INTENT_LABELS) as IntentType[]).map(intent => {
                const count = intentCounts[intent]
                const maxCount = Math.max(...Object.values(intentCounts), 1)
                return (
                  <div key={intent} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: INTENT_COLORS[intent] + '18', color: INTENT_COLORS[intent], minWidth: 80, textAlign: 'center',
                    }}>
                      {INTENT_LABELS[intent]}
                    </span>
                    <div style={{ flex: 1, height: 16, background: '#F0EDE7', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: INTENT_COLORS[intent], borderRadius: 8, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: NAVY, minWidth: 20, textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
            </div>

            {/* Hourly chart */}
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 16px' }}>Atividade por Hora</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                {hourlyData.map((val, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '100%', minHeight: 2, height: `${(val / maxHourly) * 100}px`,
                        background: val > 15 ? WHATSAPP_GREEN : val > 5 ? TEAL : '#C8D6DF',
                        borderRadius: '3px 3px 0 0', transition: 'height 0.3s',
                      }}
                      title={`${i}h: ${val} mensagens`}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {[0, 6, 12, 18, 23].map(h => (
                  <span key={h} style={{ fontSize: 10, color: '#8A9BB0' }}>{h}h</span>
                ))}
              </div>
            </div>
          </div>

          {/* Conversations needing attention */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 16px' }}>Conversas que Necessitam Atenção</h3>
            {escalatedConversations.length === 0 && (
              <p style={{ fontSize: 13, color: '#8A9BB0', textAlign: 'center', padding: 20 }}>Nenhuma conversa escalada de momento.</p>
            )}
            {escalatedConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => { setSelectedConvId(conv.id); setActiveTab('conversas') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                  background: conv.status === 'escalated' ? RED + '08' : AMBER + '08',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', background: INTENT_COLORS[conv.detectedIntent] + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
                  color: INTENT_COLORS[conv.detectedIntent],
                }}>
                  {conv.condominoNome.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{conv.condominoNome} <span style={{ fontWeight: 400, color: '#8A9BB0' }}>({conv.fracao})</span></div>
                  <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 350 }}>{conv.lastMessage}</div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: STATUS_COLORS[conv.status] + '18', color: STATUS_COLORS[conv.status],
                }}>
                  {STATUS_LABELS[conv.status]}
                </span>
                <span style={{ fontSize: 12, color: '#8A9BB0' }}>{formatTime(conv.lastMessageAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Conversas Tab ─── */}
      {activeTab === 'conversas' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, minHeight: 520 }}>
          {/* Left panel: list */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Status filter */}
            <div style={{ display: 'flex', gap: 4, padding: '12px 12px 8px', borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
              {(['all', 'active', 'escalated', 'waiting_human', 'resolved'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: statusFilter === s ? NAVY : '#F0EDE7',
                    color: statusFilter === s ? '#fff' : '#4A5E78',
                  }}
                >
                  {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredConversations.length === 0 && (
                <p style={{ fontSize: 13, color: '#8A9BB0', textAlign: 'center', padding: 30 }}>Nenhuma conversa encontrada.</p>
              )}
              {filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer',
                    borderBottom: `1px solid ${BORDER}`,
                    background: selectedConvId === conv.id ? GOLD + '12' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: INTENT_COLORS[conv.detectedIntent] + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, fontWeight: 700, color: INTENT_COLORS[conv.detectedIntent],
                  }}>
                    {conv.condominoNome.charAt(0)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{conv.condominoNome}</span>
                      <span style={{ fontSize: 10, color: '#8A9BB0' }}>{formatDate(conv.lastMessageAt)} {formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#4A5E78', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {conv.lastMessage}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                        background: STATUS_COLORS[conv.status] + '18', color: STATUS_COLORS[conv.status],
                      }}>
                        {STATUS_LABELS[conv.status]}
                      </span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                        background: INTENT_COLORS[conv.detectedIntent] + '18', color: INTENT_COLORS[conv.detectedIntent],
                      }}>
                        {INTENT_LABELS[conv.detectedIntent]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel: message thread */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedConversation ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#8A9BB0', fontSize: 14 }}>
                Selecione uma conversa para ver as mensagens
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, background: BG }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: WHATSAPP_GREEN + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: WHATSAPP_GREEN,
                  }}>
                    {selectedConversation.condominoNome.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>{selectedConversation.condominoNome}</div>
                    <div style={{ fontSize: 11, color: '#4A5E78' }}>
                      {selectedConversation.fracao} | {selectedConversation.imovel} | {selectedConversation.condominoTelefone}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!selectedConversation.incidentCreated && selectedConversation.detectedIntent === 'incident' && (
                      <button
                        onClick={() => handleCreateIncident(selectedConversation.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: RED + '12', color: RED, border: `1px solid ${RED}30`, cursor: 'pointer',
                        }}
                      >
                        🔧 Criar ocorrência
                      </button>
                    )}
                    {selectedConversation.incidentCreated && (
                      <span style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: TEAL + '12', color: TEAL }}>
                        ✓ Ocorrência criada
                      </span>
                    )}
                    {selectedConversation.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolveConversation(selectedConversation.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: TEAL + '12', color: TEAL, border: `1px solid ${TEAL}30`, cursor: 'pointer',
                        }}
                      >
                        ✅ Marcar como resolvido
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', background: '#ECE5DD' }}>
                  {selectedConversation.messages.map(msg => {
                    const isResident = msg.sender === 'resident'
                    const isBot = msg.sender === 'bot'
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isResident ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
                        <div style={{
                          maxWidth: '72%', padding: '8px 12px', borderRadius: 10,
                          background: isResident ? '#fff' : isBot ? '#DCF8C6' : '#D1ECFF',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          borderTopLeftRadius: isResident ? 2 : 10,
                          borderTopRightRadius: isResident ? 10 : 2,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: isResident ? '#4A5E78' : isBot ? TEAL : '#2980B9', marginBottom: 3 }}>
                            {isResident ? selectedConversation.condominoNome : isBot ? '🤖 Bot IA' : '🧑‍💼 Agente'}
                          </div>
                          <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.45 }}>{msg.content}</div>
                          <div style={{ fontSize: 10, color: '#8A9BB0', textAlign: 'right', marginTop: 4 }}>
                            {formatTime(msg.timestamp)}
                            {msg.confidence !== undefined && (
                              <span style={{ marginLeft: 6, color: msg.confidence > 0.7 ? TEAL : AMBER }}>
                                ({Math.round(msg.confidence * 100)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${BORDER}`, background: BG }}>
                  <input
                    type="text"
                    placeholder="Responder como agente humano..."
                    value={agentMessage}
                    onChange={e => setAgentMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendAgentMessage() }}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 20, border: `1px solid ${BORDER}`,
                      fontSize: 13, outline: 'none', background: '#fff',
                    }}
                  />
                  <button
                    onClick={handleSendAgentMessage}
                    disabled={!agentMessage.trim() || sendingMessage}
                    style={{
                      width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: agentMessage.trim() ? WHATSAPP_GREEN : '#C8D6DF',
                      color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                  >
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Conhecimento Tab ─── */}
      {activeTab === 'conhecimento' && (
        <div>
          {/* Category filter + add button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'horarios', 'pagamentos', 'obras', 'regulamento', 'contactos', 'outro'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setKnowledgeCategoryFilter(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: knowledgeCategoryFilter === cat ? NAVY : '#F0EDE7',
                    color: knowledgeCategoryFilter === cat ? '#fff' : '#4A5E78',
                  }}
                >
                  {cat === 'all' ? 'Todas' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setEditingEntry(null); setKbForm({ question: '', answer: '', category: 'outro' }); setShowKnowledgeModal(true) }}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: GOLD, color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              + Adicionar
            </button>
          </div>

          {/* Knowledge entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredKnowledge.map(entry => (
              <div key={entry.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginBottom: 6 }}>❓ {entry.question}</div>
                    <div style={{ fontSize: 13, color: '#4A5E78', lineHeight: 1.5 }}>{entry.answer}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditingEntry(entry); setKbForm({ question: entry.question, answer: entry.answer, category: entry.category }); setShowKnowledgeModal(true) }}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: GOLD + '15', color: GOLD, border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteKnowledge(entry.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: RED + '12', color: RED, border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: TEAL + '12', color: TEAL }}>
                    {CATEGORY_LABELS[entry.category]}
                  </span>
                  <span style={{ fontSize: 11, color: '#8A9BB0' }}>Utilizado {entry.usageCount}x</span>
                  <span style={{ fontSize: 11, color: '#8A9BB0' }}>Atualizado: {entry.lastUpdated}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Knowledge Modal */}
          {showKnowledgeModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520, maxHeight: '80vh', overflow: 'auto' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: '0 0 20px' }}>
                  {editingEntry ? 'Editar Entrada' : 'Nova Entrada'}
                </h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5E78', marginBottom: 4 }}>Pergunta</label>
                  <input
                    type="text"
                    value={kbForm.question}
                    onChange={e => setKbForm(f => ({ ...f, question: e.target.value }))}
                    placeholder="Ex: Qual é o horário do porteiro?"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5E78', marginBottom: 4 }}>Resposta</label>
                  <textarea
                    value={kbForm.answer}
                    onChange={e => setKbForm(f => ({ ...f, answer: e.target.value }))}
                    placeholder="Resposta completa que o chatbot irá usar..."
                    rows={4}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5E78', marginBottom: 4 }}>Categoria</label>
                  <select
                    value={kbForm.category}
                    onChange={e => setKbForm(f => ({ ...f, category: e.target.value as KnowledgeEntry['category'] }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowKnowledgeModal(false); setEditingEntry(null) }}
                    style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#F0EDE7', color: '#4A5E78', border: 'none', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveKnowledge}
                    disabled={!kbForm.question.trim() || !kbForm.answer.trim()}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: kbForm.question.trim() && kbForm.answer.trim() ? GOLD : '#C8D6DF',
                      color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                  >
                    {editingEntry ? 'Guardar' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Configuração Tab ─── */}
      {activeTab === 'configuracao' && (
        <div style={{ maxWidth: 640 }}>
          {/* Active toggle */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Chatbot Ativo</div>
                <div style={{ fontSize: 12, color: '#4A5E78', marginTop: 2 }}>Ativar ou desativar o chatbot WhatsApp para todos os condóminos</div>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, isActive: !c.isActive }))}
                style={{
                  width: 56, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', position: 'relative',
                  background: config.isActive ? WHATSAPP_GREEN : '#C8D6DF', transition: 'background 0.3s',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                  left: config.isActive ? 29 : 3, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          </div>

          {/* Auto-reply hours */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Horário de Resposta Automática</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 12, color: '#4A5E78', display: 'block', marginBottom: 4 }}>Início</label>
                <select
                  value={config.autoReplyHours.start}
                  onChange={e => setConfig(c => ({ ...c, autoReplyHours: { ...c.autoReplyHours, start: Number(e.target.value) } }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', background: '#fff' }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: 14, color: '#8A9BB0', marginTop: 18 }}>a</span>
              <div>
                <label style={{ fontSize: 12, color: '#4A5E78', display: 'block', marginBottom: 4 }}>Fim</label>
                <select
                  value={config.autoReplyHours.end}
                  onChange={e => setConfig(c => ({ ...c, autoReplyHours: { ...c.autoReplyHours, end: Number(e.target.value) } }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', background: '#fff' }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Escalation threshold */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Limiar de Escalação para Humano</div>
            <div style={{ fontSize: 12, color: '#4A5E78', marginBottom: 12 }}>Se a confiança do chatbot ficar abaixo deste valor, a conversa é escalada.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={0} max={100}
                value={config.escalationThreshold}
                onChange={e => setConfig(c => ({ ...c, escalationThreshold: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: GOLD }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY, minWidth: 45, textAlign: 'right' }}>{config.escalationThreshold}%</span>
            </div>
          </div>

          {/* Incident creation threshold */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Limiar de Criação de Ocorrência</div>
            <div style={{ fontSize: 12, color: '#4A5E78', marginBottom: 12 }}>Se a IA detetar uma ocorrência com confiança acima deste valor, cria automaticamente.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={0} max={100}
                value={config.createIncidentThreshold}
                onChange={e => setConfig(c => ({ ...c, createIncidentThreshold: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: GOLD }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: NAVY, minWidth: 45, textAlign: 'right' }}>{config.createIncidentThreshold}%</span>
            </div>
          </div>

          {/* Welcome message */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Mensagem de Boas-vindas</div>
            <textarea
              value={config.welcomeMessage}
              onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {/* Language selection */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Idiomas</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {['PT', 'FR'].map(lang => (
                <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: NAVY }}>
                  <input
                    type="checkbox"
                    checked={config.languages.includes(lang)}
                    onChange={e => {
                      if (e.target.checked) setConfig(c => ({ ...c, languages: [...c.languages, lang] }))
                      else setConfig(c => ({ ...c, languages: c.languages.filter(l => l !== lang) }))
                    }}
                    style={{ accentColor: GOLD, width: 18, height: 18 }}
                  />
                  {lang === 'PT' ? '🇵🇹 Português' : '🇫🇷 Français'}
                </label>
              ))}
            </div>
          </div>

          {/* Stats summary */}
          <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Estatísticas Gerais</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, background: BG, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#4A5E78' }}>Total mensagens processadas</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, fontFamily: "'Playfair Display',serif" }}>1,847</div>
              </div>
              <div style={{ padding: 14, background: BG, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#4A5E78' }}>Tempo de atividade</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: TEAL, fontFamily: "'Playfair Display',serif" }}>99.7%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
