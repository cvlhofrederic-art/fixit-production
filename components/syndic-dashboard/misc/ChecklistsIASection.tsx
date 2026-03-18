'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TabId = 'ativas' | 'modelos' | 'historico'
type TipoChecklist = 'inspecao_mensal' | 'preparacao_ag' | 'entrada_condomino' | 'saida_condomino' | 'inspecao_incendio' | 'inspecao_elevador' | 'inspecao_gas' | 'limpeza' | 'obras' | 'cloture_exercice' | 'personalizada'
type EstadoItem = 'pendente' | 'concluido' | 'nao_aplicavel'

interface ChecklistItem {
  id: string
  texto: string
  estado: EstadoItem
  notas: string
  obrigatorio: boolean
  responsavel: string
  prazo?: string
  geradoPorIA: boolean
}

interface Checklist {
  id: string
  tipo: TipoChecklist
  titulo: string
  immeubleId: string
  immeubleNom: string
  items: ChecklistItem[]
  dataCriacao: string
  dataConclusao?: string
  estado: 'em_curso' | 'concluida' | 'expirada'
  criadaPorIA: boolean
  responsavel: string
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TIPO_CFG: Record<TipoChecklist, { label: string; icon: string; color: string }> = {
  inspecao_mensal:    { label: 'Inspeção Mensal',        icon: '🔍', color: 'bg-blue-100 text-blue-700' },
  preparacao_ag:     { label: 'Preparação AG',           icon: '🏛️', color: 'bg-purple-100 text-purple-700' },
  entrada_condomino: { label: 'Entrada Novo Condómino',  icon: '👋', color: 'bg-green-100 text-green-700' },
  saida_condomino:   { label: 'Saída de Condómino',      icon: '🚪', color: 'bg-amber-100 text-amber-700' },
  inspecao_incendio: { label: 'Inspeção Incêndio',       icon: '🔥', color: 'bg-red-100 text-red-700' },
  inspecao_elevador: { label: 'Inspeção Elevador',       icon: '🛗', color: 'bg-indigo-100 text-indigo-700' },
  inspecao_gas:      { label: 'Inspeção Gás',            icon: '⛽', color: 'bg-orange-100 text-orange-700' },
  limpeza:           { label: 'Verificação Limpeza',     icon: '🧹', color: 'bg-emerald-100 text-emerald-700' },
  obras:             { label: 'Acompanhamento Obras',    icon: '🏗️', color: 'bg-yellow-100 text-yellow-700' },
  cloture_exercice:  { label: 'Encerramento Exercício',  icon: '📊', color: 'bg-slate-100 text-slate-700' },
  personalizada:     { label: 'Personalizada',           icon: '📋', color: 'bg-gray-100 text-gray-600' },
}

const TEMPLATES: Record<TipoChecklist, { texto: string; obrigatorio: boolean; responsavel: string }[]> = {
  inspecao_mensal: [
    { texto: 'Verificar iluminação partes comuns (hall, escadas, garagem)', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Testar intercomunicadores e campaínhas', obrigatorio: false, responsavel: 'Técnico' },
    { texto: 'Verificar estado das portas de entrada e fechaduras', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Inspecionar caleiras e drenos (escoamento)', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar extintores (validade e pressão)', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar caixas de correio (estado geral)', obrigatorio: false, responsavel: 'Administração' },
    { texto: 'Confirmar funcionamento do elevador (se aplicável)', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Registar leituras de contadores (água, eletricidade, gás)', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar estado do jardim e espaços exteriores', obrigatorio: false, responsavel: 'Jardineiro' },
    { texto: 'Fotografar anomalias encontradas', obrigatorio: false, responsavel: 'Técnico' },
  ],
  preparacao_ag: [
    { texto: 'Preparar relatório de gestão anual (Art.º 1436.º CC)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Elaborar mapa de receitas e despesas do exercício', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Preparar proposta de orçamento para o próximo ano', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Redigir ordem de trabalhos', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Enviar convocatórias (mínimo 10 dias antes — Lei 8/2022)', obrigatorio: true, responsavel: 'Secretário' },
    { texto: 'Preparar folha de presenças e procurações', obrigatorio: true, responsavel: 'Secretário' },
    { texto: 'Verificar quórum necessário por tipo de deliberação', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Configurar votação online no Portal do Condómino', obrigatorio: false, responsavel: 'Administração' },
    { texto: 'Reservar sala ou configurar videoconferência', obrigatorio: true, responsavel: 'Secretário' },
    { texto: 'Preparar documentação de suporte (orçamentos, relatórios técnicos)', obrigatorio: false, responsavel: 'Administração' },
  ],
  entrada_condomino: [
    { texto: 'Registar novo condómino no sistema (nome, NIF, contactos)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Entregar cópia do regulamento do condomínio', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Comunicar código de acesso à garagem/portão', obrigatorio: false, responsavel: 'Administração' },
    { texto: 'Fornecer acesso ao Portal do Condómino', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Informar sobre dias e horários de recolha de lixo', obrigatorio: false, responsavel: 'Administração' },
    { texto: 'Comunicar contactos de emergência', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Verificar e atualizar permilagem/tantièmes', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Enviar mensagem de boas-vindas', obrigatorio: false, responsavel: 'Administração' },
  ],
  saida_condomino: [
    { texto: 'Emitir declaração de encargos (obrigatório venda — Lei 8/2022)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Verificar existência de dívidas pendentes', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Recolher chaves/comandos de acesso', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Desativar acesso ao Portal do Condómino', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Atualizar registo de condóminos', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Informar empresa de limpeza (se necessário)', obrigatorio: false, responsavel: 'Administração' },
  ],
  inspecao_incendio: [
    { texto: 'Verificar validade de todos os extintores', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Testar alarme de incêndio e detetores de fumo', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar sinalética de emergência e saídas', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Confirmar desobstrução de vias de evacuação', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar iluminação de emergência', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Testar portas corta-fogo', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar hidrantes e bocas de incêndio (se existentes)', obrigatorio: false, responsavel: 'Técnico' },
    { texto: 'Registar data e resultado da inspeção', obrigatorio: true, responsavel: 'Administração' },
  ],
  inspecao_elevador: [
    { texto: 'Confirmar contrato de manutenção em vigor', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Verificar certificado de inspeção (validade 2-6 anos)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Testar botão de emergência / intercomunicador cabina', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar nivelamento nos pisos', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar iluminação da cabina', obrigatorio: false, responsavel: 'Técnico' },
    { texto: 'Confirmar afixação de informações obrigatórias', obrigatorio: true, responsavel: 'Administração' },
  ],
  inspecao_gas: [
    { texto: 'Confirmar data da última inspeção (obrigatória 5 em 5 anos)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Verificar tubagens de gás nas partes comuns', obrigatorio: true, responsavel: 'Técnico gás' },
    { texto: 'Testar detetores de gás (se instalados)', obrigatorio: true, responsavel: 'Técnico gás' },
    { texto: 'Verificar ventilação da casa das caldeiras', obrigatorio: true, responsavel: 'Técnico gás' },
    { texto: 'Solicitar relatório da entidade inspetora', obrigatorio: true, responsavel: 'Administração' },
  ],
  limpeza: [
    { texto: 'Hall de entrada limpo e sem obstáculos', obrigatorio: true, responsavel: 'Limpeza' },
    { texto: 'Escadarias varridas e lavadas', obrigatorio: true, responsavel: 'Limpeza' },
    { texto: 'Elevador limpo (chão, espelhos, botões)', obrigatorio: true, responsavel: 'Limpeza' },
    { texto: 'Garagem varrida sem derrames', obrigatorio: true, responsavel: 'Limpeza' },
    { texto: 'Contentores de lixo limpos e em bom estado', obrigatorio: true, responsavel: 'Limpeza' },
    { texto: 'Vidros das portas de entrada limpos', obrigatorio: false, responsavel: 'Limpeza' },
    { texto: 'Corrimões desinfetados', obrigatorio: false, responsavel: 'Limpeza' },
  ],
  obras: [
    { texto: 'Confirmar licença de obras (se necessária)', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Notificar condóminos sobre início e duração', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Verificar seguro de obra do empreiteiro', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Visita de acompanhamento semanal', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Fotografar progresso das obras', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Verificar cumprimento do caderno de encargos', obrigatorio: true, responsavel: 'Técnico' },
    { texto: 'Receção provisória de obra', obrigatorio: true, responsavel: 'Administração' },
    { texto: 'Receção definitiva (após garantia)', obrigatorio: true, responsavel: 'Administração' },
  ],
  cloture_exercice: [
    { texto: 'Reconciliar conta bancária do condomínio', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Fechar lançamentos contabilísticos do exercício', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Calcular regularizações de quotas', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Emitir mapa de receitas e despesas', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Verificar saldo do fundo de reserva (mín. 10%)', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Preparar balancete para AG', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Arquivar documentos fiscais (SAF-T se aplicável)', obrigatorio: true, responsavel: 'Contabilidade' },
    { texto: 'Renovar seguros que expiram no exercício seguinte', obrigatorio: true, responsavel: 'Administração' },
  ],
  personalizada: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10)

// ─── Composant ───────────────────────────────────────────────────────────────

interface Props { user: any; userRole: string }

export default function ChecklistsIASection({ user }: Props) {
  const uid = user?.id || 'demo'
  const lsKey = (k: string) => `fixit_syndic_${uid}_${k}`

  const [tab, setTab] = useState<TabId>('ativas')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [selectedCL, setSelectedCL] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newTipo, setNewTipo] = useState<TipoChecklist>('inspecao_mensal')
  const [newImm, setNewImm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        const data = await res.json()
        const imms = (data.immeubles || []).map((i: any) => ({ id: i.id, nom: i.nom }))
        setImmeubles(imms)
        if (imms.length > 0) setNewImm(imms[0].id)
      } catch {}
      setChecklists(JSON.parse(localStorage.getItem(lsKey('checklists_ia')) || '[]'))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const saveCLs = useCallback((cls: Checklist[]) => {
    setChecklists(cls)
    localStorage.setItem(lsKey('checklists_ia'), JSON.stringify(cls))
  }, [lsKey])

  // ── Créer checklist depuis template ────────────────────────────────────────
  const handleCreate = () => {
    const immNom = immeubles.find(i => i.id === newImm)?.nom || ''
    const template = TEMPLATES[newTipo]
    const items: ChecklistItem[] = template.map(t => ({
      id: genId(), texto: t.texto, estado: 'pendente', notas: '',
      obrigatorio: t.obrigatorio, responsavel: t.responsavel, geradoPorIA: true,
    }))

    const cl: Checklist = {
      id: genId(), tipo: newTipo, titulo: `${TIPO_CFG[newTipo].label} — ${immNom}`,
      immeubleId: newImm, immeubleNom: immNom, items, dataCriacao: new Date().toISOString(),
      estado: 'em_curso', criadaPorIA: true, responsavel: 'Administração',
    }
    const updated = [cl, ...checklists]
    saveCLs(updated)
    setSelectedCL(cl.id)
    setShowNew(false)
  }

  // ── Toggle item ────────────────────────────────────────────────────────────
  const toggleItem = (clId: string, itemId: string) => {
    const updated = checklists.map(cl => {
      if (cl.id !== clId) return cl
      const newItems = cl.items.map(it => {
        if (it.id !== itemId) return it
        const nextState: EstadoItem = it.estado === 'pendente' ? 'concluido' : it.estado === 'concluido' ? 'nao_aplicavel' : 'pendente'
        return { ...it, estado: nextState }
      })
      const allDone = newItems.every(it => it.estado !== 'pendente')
      return { ...cl, items: newItems, estado: allDone ? 'concluida' as const : 'em_curso' as const, dataConclusao: allDone ? new Date().toISOString() : undefined }
    })
    saveCLs(updated)
  }

  const currentCL = useMemo(() => checklists.find(cl => cl.id === selectedCL), [checklists, selectedCL])

  const stats = useMemo(() => ({
    emCurso: checklists.filter(cl => cl.estado === 'em_curso').length,
    concluidas: checklists.filter(cl => cl.estado === 'concluida').length,
    total: checklists.length,
  }), [checklists])

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0D1B2E]">📋 Checklists Inteligentes com IA</h2>
          <p className="text-sm text-gray-500 mt-1">Processos padronizados — inspeções, AG, entradas/saídas, obras</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all">
          ➕ Nova Checklist
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Em Curso</p>
          <p className="text-2xl font-bold text-amber-600">{stats.emCurso}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Concluídas</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.concluidas}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-[#0D1B2E]">{stats.total}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'ativas' as TabId, label: 'Em Curso', icon: '🔄' },
          { id: 'modelos' as TabId, label: 'Modelos', icon: '📝' },
          { id: 'historico' as TabId, label: 'Concluídas', icon: '✅' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${tab === t.id ? 'bg-white text-[#0D1B2E] shadow-sm' : 'text-gray-500'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Em Curso ═══ */}
      {tab === 'ativas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste */}
          <div className="lg:col-span-1 space-y-2">
            {checklists.filter(cl => cl.estado === 'em_curso').length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-gray-500">Nenhuma checklist em curso</p>
              </div>
            ) : (
              checklists.filter(cl => cl.estado === 'em_curso').map(cl => {
                const done = cl.items.filter(i => i.estado === 'concluido').length
                const total = cl.items.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                const tipoCfg = TIPO_CFG[cl.tipo]
                return (
                  <button key={cl.id} onClick={() => setSelectedCL(cl.id)} className={`w-full rounded-xl border p-4 text-left transition-all ${selectedCL === cl.id ? 'border-[#C9A84C] bg-[#C9A84C]/5 shadow-md' : 'border-gray-100 hover:shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoCfg.color}`}>{tipoCfg.icon} {tipoCfg.label}</span>
                    </div>
                    <p className="text-sm font-medium text-[#0D1B2E] truncate">{cl.immeubleNom}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{done}/{total}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Détail */}
          <div className="lg:col-span-2">
            {currentCL && currentCL.estado === 'em_curso' ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-[#0D1B2E] to-[#1a2d4a] text-white">
                  <h3 className="font-bold">{currentCL.titulo}</h3>
                  <p className="text-xs text-gray-300 mt-1">
                    {currentCL.items.filter(i => i.estado === 'concluido').length}/{currentCL.items.length} concluídos •{' '}
                    {new Date(currentCL.dataCriacao).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {currentCL.items.map(item => (
                    <button key={item.id} onClick={() => toggleItem(currentCL.id, item.id)} className="w-full flex items-start gap-3 px-6 py-3 hover:bg-gray-50/50 transition-all text-left">
                      <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        item.estado === 'concluido' ? 'bg-emerald-500 border-emerald-500 text-white' :
                        item.estado === 'nao_aplicavel' ? 'bg-gray-300 border-gray-300 text-white' :
                        'border-gray-300'
                      }`}>
                        {item.estado === 'concluido' && '✓'}
                        {item.estado === 'nao_aplicavel' && '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.estado === 'concluido' ? 'text-gray-400 line-through' : item.estado === 'nao_aplicavel' ? 'text-gray-400' : 'text-[#0D1B2E]'}`}>
                          {item.texto}
                          {item.obrigatorio && <span className="text-red-500 ml-1 text-xs">*</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">👤 {item.responsavel}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500">
                  Clique para alternar: ⬜ Pendente → ✅ Concluído → ➖ Não aplicável → ⬜ Pendente
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <div className="text-center"><p className="text-4xl mb-2">👈</p><p className="text-sm">Selecione uma checklist</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: Modelos ═══ */}
      {tab === 'modelos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.entries(TIPO_CFG) as [TipoChecklist, typeof TIPO_CFG[TipoChecklist]][]).filter(([k]) => k !== 'personalizada').map(([key, cfg]) => {
            const template = TEMPLATES[key]
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{template.length} itens • {template.filter(t => t.obrigatorio).length} obrigatórios</p>
                <div className="space-y-1 mb-3">
                  {template.slice(0, 3).map((t, i) => (
                    <p key={i} className="text-xs text-gray-400 truncate">• {t.texto}</p>
                  ))}
                  {template.length > 3 && <p className="text-xs text-gray-300">+ {template.length - 3} mais...</p>}
                </div>
                <button onClick={() => { setNewTipo(key); setShowNew(true) }} className="w-full px-3 py-1.5 bg-[#0D1B2E]/5 text-[#0D1B2E] rounded-lg text-xs font-medium hover:bg-[#0D1B2E]/10 transition-all">
                  Usar este modelo
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TAB: Concluídas ═══ */}
      {tab === 'historico' && (
        <div className="space-y-3">
          {checklists.filter(cl => cl.estado === 'concluida').length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><p className="text-4xl mb-2">✅</p><p className="text-sm text-gray-500">Nenhuma checklist concluída</p></div>
          ) : (
            checklists.filter(cl => cl.estado === 'concluida').map(cl => {
              const tipoCfg = TIPO_CFG[cl.tipo]
              return (
                <div key={cl.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoCfg.color}`}>{tipoCfg.icon} {tipoCfg.label}</span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">✅ Concluída</span>
                      </div>
                      <p className="text-sm font-medium text-[#0D1B2E]">{cl.titulo}</p>
                      <p className="text-xs text-gray-400">{cl.items.length} itens • {cl.dataConclusao ? new Date(cl.dataConclusao).toLocaleDateString('pt-PT') : '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ Modal Nova Checklist ═══ */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-bold text-[#0D1B2E]">📋 Nova Checklist</h3></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                <select value={newTipo} onChange={e => setNewTipo(e.target.value as TipoChecklist)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Edifício</label>
                <select value={newImm} onChange={e => setNewImm(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">
                {TEMPLATES[newTipo].length > 0 ? `${TEMPLATES[newTipo].length} itens serão gerados automaticamente pela IA` : 'Checklist vazia (personalizável)'}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-[#0D1B2E] text-white rounded-lg text-sm font-medium hover:bg-[#0D1B2E]/90">🤖 Gerar Checklist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
