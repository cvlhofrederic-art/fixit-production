'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TabId = 'campanhas' | 'modelos' | 'historico' | 'config'
type CanalEnvio = 'email' | 'whatsapp' | 'sms' | 'app_push'
type TipoCampanha = 'cobranca' | 'aviso_obras' | 'convocatoria_ag' | 'boas_vindas' | 'relatorio_mensal' | 'alerta_consumo' | 'lembrete_seguro' | 'personalizada'
type EstadoCampanha = 'rascunho' | 'agendada' | 'enviada' | 'parcial'

interface Condomino {
  id: string
  nome: string
  fracao: string
  email?: string
  telefone?: string
  immeuble: string
  quotaEmAtraso: boolean
  diasAtraso: number
  valorDivida: number
}

interface ModeloMensagem {
  id: string
  tipo: TipoCampanha
  titulo: string
  assunto: string
  corpo: string
  variaveis: string[]    // ex: {{nome}}, {{fracao}}, {{valor_divida}}
  canais: CanalEnvio[]
  ativo: boolean
}

interface CampanhaEnvio {
  id: string
  tipo: TipoCampanha
  titulo: string
  modelo: string
  canal: CanalEnvio
  destinatarios: { condominoId: string; nome: string; fracao: string; estado: 'pendente' | 'enviado' | 'erro' | 'lido' }[]
  dataAgendada?: string
  dataCriacao: string
  dataEnvio?: string
  estado: EstadoCampanha
  immeuble: string
  immeubleNom: string
  filtros: string
}

// ─── Modèles par défaut ──────────────────────────────────────────────────────

const MODELOS_PADRAO: ModeloMensagem[] = [
  {
    id: 'cobranca_amigavel',
    tipo: 'cobranca',
    titulo: 'Cobrança Amigável',
    assunto: 'Lembrete: quota em atraso — {{fracao}}',
    corpo: `Estimado(a) {{nome}},

Verificámos que a quota referente à fração {{fracao}} se encontra em atraso há {{dias_atraso}} dias, no valor de {{valor_divida}}.

Solicitamos a regularização do pagamento até ao final da próxima semana, usando a referência Multibanco habitual.

Em caso de dificuldade, contacte-nos para encontrarmos uma solução.

Com os melhores cumprimentos,
A Administração`,
    variaveis: ['nome', 'fracao', 'dias_atraso', 'valor_divida'],
    canais: ['email', 'whatsapp', 'sms'],
    ativo: true,
  },
  {
    id: 'cobranca_formal',
    tipo: 'cobranca',
    titulo: 'Cobrança Formal (pré-contencioso)',
    assunto: 'AVISO FORMAL: dívida de condomínio — {{fracao}}',
    corpo: `Exmo(a) Sr(a) {{nome}},

Vimos por este meio notificar que a fração {{fracao}} apresenta um débito de {{valor_divida}} referente a quotas de condomínio, com {{dias_atraso}} dias de atraso.

Nos termos do Art.º 310.º do Código Civil, informamos que caso não regularize no prazo de 15 dias, iniciaremos procedimento de injunção (DL 269/98).

Atentamente,
A Administração do Condomínio`,
    variaveis: ['nome', 'fracao', 'dias_atraso', 'valor_divida'],
    canais: ['email'],
    ativo: true,
  },
  {
    id: 'aviso_obras',
    tipo: 'aviso_obras',
    titulo: 'Aviso de Obras',
    assunto: 'Obras programadas — {{immeuble}}',
    corpo: `Estimado(a) {{nome}},

Informamos que serão realizadas obras de {{tipo_obra}} no edifício {{immeuble}}, com início previsto para {{data_inicio}} e duração estimada de {{duracao}}.

Durante este período, poderão ocorrer alguns constrangimentos. Pedimos a sua compreensão.

Para qualquer questão, contacte a administração.

Cumprimentos,
A Administração`,
    variaveis: ['nome', 'immeuble', 'tipo_obra', 'data_inicio', 'duracao'],
    canais: ['email', 'whatsapp', 'app_push'],
    ativo: true,
  },
  {
    id: 'convocatoria_ag',
    tipo: 'convocatoria_ag',
    titulo: 'Convocatória AG',
    assunto: 'Convocatória: Assembleia Geral — {{immeuble}}',
    corpo: `Estimado(a) {{nome}},

Convocamos V. Exa. para a Assembleia Geral do condomínio {{immeuble}}, a realizar no dia {{data_ag}} às {{hora_ag}}, com a seguinte ordem de trabalhos:

{{ordem_trabalhos}}

Caso não possa comparecer, poderá votar online através do Portal do Condómino ou delegar voto por procuração (Lei 8/2022).

Cumprimentos,
A Administração`,
    variaveis: ['nome', 'immeuble', 'data_ag', 'hora_ag', 'ordem_trabalhos'],
    canais: ['email', 'app_push'],
    ativo: true,
  },
  {
    id: 'boas_vindas',
    tipo: 'boas_vindas',
    titulo: 'Boas-vindas Novo Condómino',
    assunto: 'Bem-vindo ao condomínio {{immeuble}}!',
    corpo: `Estimado(a) {{nome}},

Damos-lhe as boas-vindas como novo condómino da fração {{fracao}} do edifício {{immeuble}}!

Para sua comodidade, pode aceder ao Portal do Condómino onde encontrará:
• Extratos e recibos
• Documentos do condomínio
• Canal de comunicação com a administração
• Votação online em assembleias

Para qualquer questão, não hesite em contactar-nos.

Cumprimentos,
A Administração`,
    variaveis: ['nome', 'fracao', 'immeuble'],
    canais: ['email', 'whatsapp'],
    ativo: true,
  },
  {
    id: 'relatorio_mensal',
    tipo: 'relatorio_mensal',
    titulo: 'Relatório Mensal',
    assunto: 'Relatório mensal — {{immeuble}} — {{mes}}',
    corpo: `Estimado(a) {{nome}},

Segue o resumo mensal do condomínio {{immeuble}} para {{mes}}:

📊 Receitas: {{receitas}}
📉 Despesas: {{despesas}}
💰 Saldo: {{saldo}}
🔧 Intervenções: {{nb_intervencoes}}
📋 Ocorrências: {{nb_ocorrencias}} ({{nb_resolvidas}} resolvidas)

Para mais detalhes, consulte o Portal do Condómino.

Cumprimentos,
A Administração`,
    variaveis: ['nome', 'immeuble', 'mes', 'receitas', 'despesas', 'saldo', 'nb_intervencoes', 'nb_ocorrencias', 'nb_resolvidas'],
    canais: ['email', 'app_push'],
    ativo: true,
  },
  {
    id: 'alerta_consumo',
    tipo: 'alerta_consumo',
    titulo: 'Alerta Consumo Anormal',
    assunto: '⚠️ Consumo anormal detetado — {{immeuble}}',
    corpo: `Estimado(a) condómino,

Foi detetado um consumo anormal de {{tipo_consumo}} no edifício {{immeuble}} durante o mês de {{mes}}.

Consumo atual: {{consumo_atual}}
Média habitual: {{media_habitual}}
Variação: {{variacao}}

Recomendamos verificar possíveis fugas ou anomalias.

Cumprimentos,
A Administração`,
    variaveis: ['immeuble', 'tipo_consumo', 'mes', 'consumo_atual', 'media_habitual', 'variacao'],
    canais: ['email', 'whatsapp', 'app_push'],
    ativo: true,
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10)
const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}
const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const TIPO_LABELS: Record<TipoCampanha, { label: string; icon: string; color: string }> = {
  cobranca: { label: 'Cobrança', icon: '💸', color: 'bg-red-100 text-red-700' },
  aviso_obras: { label: 'Aviso Obras', icon: '🏗️', color: 'bg-amber-100 text-amber-700' },
  convocatoria_ag: { label: 'Convocatória AG', icon: '🏛️', color: 'bg-purple-100 text-purple-700' },
  boas_vindas: { label: 'Boas-vindas', icon: '👋', color: 'bg-green-100 text-green-700' },
  relatorio_mensal: { label: 'Relatório Mensal', icon: '📊', color: 'bg-blue-100 text-blue-700' },
  alerta_consumo: { label: 'Alerta Consumo', icon: '⚠️', color: 'bg-orange-100 text-orange-700' },
  lembrete_seguro: { label: 'Lembrete Seguro', icon: '🛡️', color: 'bg-teal-100 text-teal-700' },
  personalizada: { label: 'Personalizada', icon: '✏️', color: 'bg-gray-100 text-gray-700' },
}

const CANAL_LABELS: Record<CanalEnvio, { label: string; icon: string }> = {
  email: { label: 'Email', icon: '📧' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  sms: { label: 'SMS', icon: '📱' },
  app_push: { label: 'Push App', icon: '🔔' },
}

// ─── Composant Principal ─────────────────────────────────────────────────────

interface Props {
  user: any
  userRole: string
}

export default function ContactoProativoIASection({ user }: Props) {
  const uid = user?.id || 'demo'
  const lsKey = (k: string) => `fixit_syndic_${uid}_${k}`

  const [tab, setTab] = useState<TabId>('campanhas')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [condominos, setCondominos] = useState<Condomino[]>([])
  const [modelos, setModelos] = useState<ModeloMensagem[]>([])
  const [campanhas, setCampanhas] = useState<CampanhaEnvio[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [showNewCampanha, setShowNewCampanha] = useState(false)
  const [newTipo, setNewTipo] = useState<TipoCampanha>('cobranca')
  const [newCanal, setNewCanal] = useState<CanalEnvio>('email')
  const [newImm, setNewImm] = useState('')
  const [newFiltro, setNewFiltro] = useState<'todos' | 'devedores' | 'manual'>('todos')
  const [selectedCondominos, setSelectedCondominos] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
      const data = await res.json()
      const imms = (data.immeubles || []).map((i: any) => ({ id: i.id, nom: i.nom }))
      setImmeubles(imms)
      if (imms.length > 0 && !newImm) setNewImm(imms[0].id)

      // Condóminos depuis localStorage ou API
      const savedCondos: Condomino[] = JSON.parse(localStorage.getItem(lsKey('condominos_proativo')) || '[]')
      if (savedCondos.length > 0) {
        setCondominos(savedCondos)
      }

      // Modèles
      const savedModelos = JSON.parse(localStorage.getItem(lsKey('modelos_proativo')) || 'null')
      setModelos(savedModelos || MODELOS_PADRAO)

      // Campagnes
      const savedCampanhas = JSON.parse(localStorage.getItem(lsKey('campanhas_proativo')) || '[]')
      setCampanhas(savedCampanhas)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveCampanhas = useCallback((c: CampanhaEnvio[]) => {
    setCampanhas(c)
    localStorage.setItem(lsKey('campanhas_proativo'), JSON.stringify(c))
  }, [lsKey])

  const saveModelos = useCallback((m: ModeloMensagem[]) => {
    setModelos(m)
    localStorage.setItem(lsKey('modelos_proativo'), JSON.stringify(m))
  }, [lsKey])

  // ── Créer campagne ────────────────────────────────────────────────────────
  const handleCreateCampanha = () => {
    setSending(true)
    const immNom = immeubles.find(i => i.id === newImm)?.nom || 'Edifício'
    const modelo = modelos.find(m => m.tipo === newTipo && m.ativo)

    // Filtrer destinataires
    let dest = condominos.filter(c => c.immeuble === newImm || c.immeuble === immNom)
    if (newFiltro === 'devedores') dest = dest.filter(c => c.quotaEmAtraso)
    if (newFiltro === 'manual') dest = dest.filter(c => selectedCondominos.includes(c.id))

    // Si pas de condóminos, simuler quelques-uns pour la démo
    if (dest.length === 0) {
      dest = [
        { id: 'demo1', nome: 'João Silva', fracao: 'A - R/C', email: 'joao@demo.pt', telefone: '912345678', immeuble: newImm, quotaEmAtraso: true, diasAtraso: 45, valorDivida: 150 },
        { id: 'demo2', nome: 'Maria Santos', fracao: 'B - 1.º', email: 'maria@demo.pt', telefone: '923456789', immeuble: newImm, quotaEmAtraso: false, diasAtraso: 0, valorDivida: 0 },
        { id: 'demo3', nome: 'Pedro Costa', fracao: 'C - 2.º', email: 'pedro@demo.pt', telefone: '934567890', immeuble: newImm, quotaEmAtraso: true, diasAtraso: 90, valorDivida: 450 },
      ]
      if (newFiltro === 'devedores') dest = dest.filter(c => c.quotaEmAtraso)
    }

    const campanha: CampanhaEnvio = {
      id: genId(),
      tipo: newTipo,
      titulo: modelo?.titulo || TIPO_LABELS[newTipo].label,
      modelo: modelo?.id || '',
      canal: newCanal,
      destinatarios: dest.map(d => ({ condominoId: d.id, nome: d.nome, fracao: d.fracao, estado: 'pendente' as const })),
      dataCriacao: new Date().toISOString(),
      estado: 'rascunho',
      immeuble: newImm,
      immeubleNom: immNom,
      filtros: newFiltro === 'todos' ? 'Todos os condóminos' : newFiltro === 'devedores' ? 'Condóminos com quotas em atraso' : `${selectedCondominos.length} selecionados`,
    }

    setTimeout(() => {
      saveCampanhas([campanha, ...campanhas])
      setSending(false)
      setShowNewCampanha(false)
    }, 800)
  }

  // ── Envoyer campagne ──────────────────────────────────────────────────────
  const handleEnviarCampanha = (id: string) => {
    const updated = campanhas.map(c => {
      if (c.id !== id) return c
      return {
        ...c,
        estado: 'enviada' as EstadoCampanha,
        dataEnvio: new Date().toISOString(),
        destinatarios: c.destinatarios.map(d => ({ ...d, estado: 'enviado' as const })),
      }
    })
    saveCampanhas(updated)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: campanhas.length,
    enviadas: campanhas.filter(c => c.estado === 'enviada').length,
    totalDest: campanhas.reduce((s, c) => s + c.destinatarios.length, 0),
    enviados: campanhas.reduce((s, c) => s + c.destinatarios.filter(d => d.estado === 'enviado').length, 0),
  }), [campanhas])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">A carregar sistema de contacto proativo...</p>
        </div>
      </div>
    )
  }

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'campanhas', label: 'Campanhas', icon: '📤' },
    { id: 'modelos', label: 'Modelos IA', icon: '📝' },
    { id: 'historico', label: 'Histórico', icon: '📊' },
    { id: 'config', label: 'Configuração', icon: '⚙️' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0D1B2E] flex items-center gap-2">
            📡 Contacto Proativo IA
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Comunicação automática e personalizada com condóminos — cobranças, avisos, relatórios
          </p>
        </div>
        <button
          onClick={() => setShowNewCampanha(true)}
          className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all flex items-center gap-2"
        >
          ➕ Nova Campanha
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Campanhas Criadas</p>
          <p className="text-2xl font-bold text-[#0D1B2E]">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Enviadas</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.enviadas}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Destinatários</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalDest}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Mensagens Enviadas</p>
          <p className="text-2xl font-bold text-[#C9A84C]">{stats.enviados}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
              tab === t.id ? 'bg-white text-[#0D1B2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Modal Nova Campanha ═══ */}
      {showNewCampanha && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNewCampanha(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[#0D1B2E] text-lg">📡 Nova Campanha Proativa</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">Tipo de campanha</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(TIPO_LABELS) as [TipoCampanha, typeof TIPO_LABELS[TipoCampanha]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNewTipo(key)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                        newTipo === key ? 'ring-2 ring-[#C9A84C] bg-[#C9A84C]/10' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canal */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">Canal de envio</label>
                <div className="flex gap-2">
                  {(Object.entries(CANAL_LABELS) as [CanalEnvio, typeof CANAL_LABELS[CanalEnvio]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNewCanal(key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        newCanal === key ? 'ring-2 ring-[#C9A84C] bg-[#C9A84C]/10' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Immeuble */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Edifício</label>
                <select
                  value={newImm}
                  onChange={e => setNewImm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C9A84C]/40"
                >
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>

              {/* Filtre */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">Destinatários</label>
                <div className="flex gap-2">
                  {[
                    { key: 'todos' as const, label: '👥 Todos', desc: 'Todos os condóminos' },
                    { key: 'devedores' as const, label: '💸 Devedores', desc: 'Com quotas em atraso' },
                    { key: 'manual' as const, label: '✋ Manual', desc: 'Seleção manual' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setNewFiltro(f.key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        newFiltro === f.key ? 'ring-2 ring-[#C9A84C] bg-[#C9A84C]/10' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <p>{f.label}</p>
                      <p className="text-gray-400 font-normal mt-0.5">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview modelo */}
              {modelos.find(m => m.tipo === newTipo && m.ativo) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">📝 Pré-visualização do modelo:</p>
                  <p className="text-xs text-gray-500 font-mono whitespace-pre-line leading-relaxed">
                    {modelos.find(m => m.tipo === newTipo && m.ativo)?.corpo.slice(0, 200)}...
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Variáveis: {modelos.find(m => m.tipo === newTipo && m.ativo)?.variaveis.map(v => `{{${v}}}`).join(', ')}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowNewCampanha(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCampanha}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-[#0D1B2E] text-white rounded-lg text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : '📤'}{' '}
                Criar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Campanhas ═══ */}
      {tab === 'campanhas' && (
        <div className="space-y-3">
          {campanhas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📡</p>
              <p className="font-semibold text-[#0D1B2E]">Sem campanhas</p>
              <p className="text-sm text-gray-500 mt-1">Crie a sua primeira campanha proativa para contactar condóminos automaticamente</p>
            </div>
          ) : (
            campanhas.map(camp => {
              const tipoCfg = TIPO_LABELS[camp.tipo]
              const canalCfg = CANAL_LABELS[camp.canal]
              const enviados = camp.destinatarios.filter(d => d.estado === 'enviado').length
              const total = camp.destinatarios.length

              return (
                <div key={camp.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoCfg.color}`}>
                          {tipoCfg.icon} {tipoCfg.label}
                        </span>
                        <span className="text-xs text-gray-400">{canalCfg.icon} {canalCfg.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          camp.estado === 'rascunho' ? 'bg-gray-100 text-gray-600' :
                          camp.estado === 'agendada' ? 'bg-blue-100 text-blue-600' :
                          camp.estado === 'enviada' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {camp.estado === 'rascunho' ? '📝 Rascunho' :
                           camp.estado === 'agendada' ? '🕐 Agendada' :
                           camp.estado === 'enviada' ? '✅ Enviada' : '⏳ Parcial'}
                        </span>
                      </div>
                      <p className="font-semibold text-[#0D1B2E] text-sm">{camp.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {camp.immeubleNom} • {camp.filtros} • {formatDate(camp.dataCriacao)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0D1B2E]">{enviados}/{total}</p>
                      <p className="text-xs text-gray-400">destinatário(s)</p>
                      {/* Progress bar */}
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: total > 0 ? `${(enviados / total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </div>
                  {camp.estado === 'rascunho' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEnviarCampanha(camp.id)}
                        className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-all"
                      >
                        📤 Enviar Agora
                      </button>
                    </div>
                  )}
                  {/* Liste destinataires */}
                  {camp.destinatarios.length > 0 && camp.destinatarios.length <= 10 && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="flex flex-wrap gap-1">
                        {camp.destinatarios.map(d => (
                          <span key={d.condominoId} className={`text-xs px-2 py-0.5 rounded-full ${
                            d.estado === 'enviado' ? 'bg-emerald-50 text-emerald-600' :
                            d.estado === 'erro' ? 'bg-red-50 text-red-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {d.nome} ({d.fracao})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ TAB: Modelos ═══ */}
      {tab === 'modelos' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Modelos de mensagem pré-configurados. Personalize ou crie novos.</p>
          {modelos.map(modelo => {
            const tipoCfg = TIPO_LABELS[modelo.tipo]
            return (
              <div key={modelo.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoCfg.color}`}>
                        {tipoCfg.icon} {tipoCfg.label}
                      </span>
                      {modelo.canais.map(c => (
                        <span key={c} className="text-xs text-gray-400">{CANAL_LABELS[c].icon}</span>
                      ))}
                    </div>
                    <p className="font-semibold text-[#0D1B2E] text-sm">{modelo.titulo}</p>
                    <p className="text-xs text-gray-500 mt-1">Assunto: {modelo.assunto}</p>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{modelo.corpo.slice(0, 120)}...</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {modelo.variaveis.map(v => (
                        <span key={v} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const updated = modelos.map(m => m.id === modelo.id ? { ...m, ativo: !m.ativo } : m)
                      saveModelos(updated)
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      modelo.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {modelo.ativo ? '✅ Ativo' : '⏸️ Inativo'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TAB: Histórico ═══ */}
      {tab === 'historico' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-[#0D1B2E] text-sm">📊 Histórico de Envios</h3>
          {campanhas.filter(c => c.estado === 'enviada').length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm text-gray-500">Nenhum envio registado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50">
                    <th className="text-left px-4 py-3">Campanha</th>
                    <th className="text-left px-3 py-3">Tipo</th>
                    <th className="text-left px-3 py-3">Canal</th>
                    <th className="text-right px-3 py-3">Destinatários</th>
                    <th className="text-left px-3 py-3">Data Envio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campanhas.filter(c => c.estado === 'enviada').map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-[#0D1B2E]">{c.titulo}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_LABELS[c.tipo].color}`}>
                          {TIPO_LABELS[c.tipo].icon} {TIPO_LABELS[c.tipo].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{CANAL_LABELS[c.canal].icon} {CANAL_LABELS[c.canal].label}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{c.destinatarios.length}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{c.dataEnvio ? formatDate(c.dataEnvio) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Config ═══ */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-[#0D1B2E] text-sm mb-4">⚙️ Automatismos (IA Proativa)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Configure regras para que a IA contacte automaticamente os condóminos em certas situações.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Lembrete quota em atraso (> 30 dias)', desc: 'Enviar cobrança amigável automaticamente', key: 'auto_cobranca_30' },
                { label: 'Aviso pré-contencioso (> 90 dias)', desc: 'Enviar cobrança formal antes de injunção', key: 'auto_cobranca_90' },
                { label: 'Relatório mensal automático', desc: 'Enviar resumo financeiro ao 1.º de cada mês', key: 'auto_relatorio' },
                { label: 'Boas-vindas novo condómino', desc: 'Enviar welcome pack automaticamente', key: 'auto_boas_vindas' },
                { label: 'Alerta consumo anormal', desc: 'Notificar se consumo > 150% da média', key: 'auto_consumo' },
                { label: 'Lembrete renovação seguro', desc: 'Avisar 60 dias antes da expiração', key: 'auto_seguro' },
              ].map(rule => (
                <div key={rule.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#0D1B2E]">{rule.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rule.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      const current = JSON.parse(localStorage.getItem(lsKey('auto_rules')) || '{}')
                      current[rule.key] = !current[rule.key]
                      localStorage.setItem(lsKey('auto_rules'), JSON.stringify(current))
                    }}
                    className="relative w-12 h-6 rounded-full bg-gray-300 transition-colors focus:outline-none"
                  >
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
