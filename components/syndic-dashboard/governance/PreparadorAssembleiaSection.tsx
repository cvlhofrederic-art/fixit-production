'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PassoAG = 'infos' | 'ordem_trabalhos' | 'documentos' | 'convocatoria' | 'resumo'
type EstadoAG = 'rascunho' | 'convocatorias_enviadas' | 'concluida'

interface Deliberacao {
  id: string
  tipo: 'maioria_simples' | 'dois_tercos' | 'unanimidade'
  titulo: string
  descricao: string
  obrigatoria: boolean
}

interface ProjetoAG {
  id: string
  edificio: string
  data_ag: string
  hora_ag: string
  local: string
  tipo_ag: 'ordinaria' | 'extraordinaria'
  deliberacoes: Deliberacao[]
  notas_presidente: string
  created_at: string
  estado: EstadoAG
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DELIBERACOES_STD: Deliberacao[] = [
  { id: 'aprovacao_contas', tipo: 'maioria_simples', titulo: 'Aprovação das contas do exercício', descricao: 'CC art. 1431.º — Prestação de contas do administrador', obrigatoria: true },
  { id: 'orcamento_previsional', tipo: 'maioria_simples', titulo: 'Aprovação do orçamento anual', descricao: 'CC art. 1431.º — Orçamento para o exercício seguinte', obrigatoria: true },
  { id: 'fundo_reserva', tipo: 'maioria_simples', titulo: 'Contribuição para o fundo comum de reserva', descricao: 'CC art. 1424.º — Mínimo 10% do orçamento', obrigatoria: true },
  { id: 'seguro', tipo: 'maioria_simples', titulo: 'Renovação do seguro do edifício', descricao: 'DL 267/94 — Seguro obrigatório contra incêndios', obrigatoria: true },
  { id: 'eleicao_admin', tipo: 'maioria_simples', titulo: 'Eleição do administrador', descricao: 'CC art. 1435.º — Mandato de 1 ano renovável', obrigatoria: false },
  { id: 'obras_partes_comuns', tipo: 'dois_tercos', titulo: 'Aprovação de obras nas partes comuns', descricao: 'CC art. 1425.º — Maioria de 2/3 do valor do edifício', obrigatoria: false },
  { id: 'regulamento', tipo: 'maioria_simples', titulo: 'Alteração do regulamento interno', descricao: 'CC art. 1429.º-A — Regulamento do condomínio', obrigatoria: false },
  { id: 'assuntos_diversos', tipo: 'maioria_simples', titulo: 'Assuntos diversos', descricao: 'Questões levantadas pelos condóminos', obrigatoria: false },
]

const PASSOS_NAV: { key: PassoAG; label: string; icon: string }[] = [
  { key: 'infos', label: 'Informações', icon: '📋' },
  { key: 'ordem_trabalhos', label: 'Ordem de trabalhos', icon: '📝' },
  { key: 'documentos', label: 'Documentos', icon: '📁' },
  { key: 'convocatoria', label: 'Convocatória', icon: '📧' },
  { key: 'resumo', label: 'Resumo', icon: '✅' },
]

const DOCS_CHECKLIST = [
  { doc: 'Contas do exercício anterior', obrigatoria: true, nota: 'Balanço e demonstração de resultados assinados pelo administrador' },
  { doc: 'Orçamento previsional detalhado', obrigatoria: true, nota: 'Detalhe por rubrica de despesa' },
  { doc: 'Mapa de quotas individuais', obrigatoria: true, nota: 'Por fração — repartição por permilagem' },
  { doc: 'Estado das dívidas do condomínio', obrigatoria: true, nota: 'Valores em dívida, provisões e créditos' },
  { doc: 'Formulário de procuração', obrigatoria: true, nota: 'Para representação em assembleia' },
  { doc: 'Proposta de contrato de administração', obrigatoria: false, nota: 'Se renovação do administrador na ordem de trabalhos' },
  { doc: 'Orçamentos comparativos (3 mínimo)', obrigatoria: false, nota: 'Obrigatórios se votação de obras' },
]

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PreparadorAssembleiaSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const storageKey = `fixit_ag_pt_${user.id}`
  const [projetos, setProjetos] = useState<ProjetoAG[]>([])
  const [current, setCurrent] = useState<ProjetoAG | null>(null)
  const [passo, setPasso] = useState<PassoAG>('infos')
  const [convocatoria, setConvocatoria] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setProjetos(JSON.parse(s)) } catch {}
  }, [storageKey])

  const saveProjetos = (list: ProjetoAG[]) => { setProjetos(list); localStorage.setItem(storageKey, JSON.stringify(list)) }

  const updateCurrent = (p: ProjetoAG) => {
    setCurrent(p)
    const updated = projetos.find(x => x.id === p.id) ? projetos.map(x => x.id === p.id ? p : x) : [...projetos, p]
    saveProjetos(updated)
  }

  const createNew = () => {
    const p: ProjetoAG = { id: Date.now().toString(36), edificio: '', data_ag: '', hora_ag: '18:00', local: '', tipo_ag: 'ordinaria', deliberacoes: DELIBERACOES_STD.filter(d => d.obrigatoria), notas_presidente: '', created_at: new Date().toISOString(), estado: 'rascunho' }
    setCurrent(p)
    setPasso('infos')
  }

  const toggleDelib = (d: Deliberacao) => {
    if (!current) return
    const exists = current.deliberacoes.find(x => x.id === d.id)
    updateCurrent({ ...current, deliberacoes: exists ? current.deliberacoes.filter(x => x.id !== d.id) : [...current.deliberacoes, d] })
  }

  const genConvocatoria = () => {
    if (!current) return
    const dataAG = current.data_ag ? new Date(current.data_ag).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '[DATA A DEFINIR]'
    const dataEnvio = current.data_ag ? new Date(new Date(current.data_ag).getTime() - 10 * 86400000).toLocaleDateString('pt-PT') : '[10 dias antes da AG]'
    const tipoLabel: Record<string, string> = { maioria_simples: 'Maioria simples — CC art. 1432.º', dois_tercos: 'Maioria de 2/3 — CC art. 1425.º', unanimidade: 'Unanimidade — CC art. 1419.º' }
    const odj = current.deliberacoes.map((d, i) => `  ${i + 1}. ${d.titulo}\n     → ${d.descricao}\n     → Votação: ${tipoLabel[d.tipo] || d.tipo}`).join('\n\n')
    const conv = `CONVOCATÓRIA PARA ASSEMBLEIA ${current.tipo_ag === 'extraordinaria' ? 'EXTRAORDINÁRIA' : 'ORDINÁRIA'} DE CONDÓMINOS\n\nEdifício: ${current.edificio || '[NOME DO EDIFÍCIO]'}\n\nData de envio da convocatória: ${dataEnvio}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nExmo(a) Senhor(a) Condómino(a),\n\nNos termos do artigo 1432.º do Código Civil e da Lei 8/2022, vimos por este meio convocar V. Exa. para a Assembleia ${current.tipo_ag === 'extraordinaria' ? 'Extraordinária' : 'Ordinária'} de Condóminos, que se realizará:\n\n  📅 Data: ${dataAG}\n  🕐 Hora: ${current.hora_ag || '[HORA]'}\n  📍 Local: ${current.local || '[LOCAL A DEFINIR]'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nORDEM DE TRABALHOS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${odj}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAs peças justificativas (contas, orçamento, contratos) estão à disposição no escritório do administrador. Pode fazer-se representar por procurador com poderes especiais (formulário de procuração em anexo).\n\nNota: A assembleia reúne em 2.ª convocação 30 minutos após a hora marcada, com qualquer número de condóminos presentes (CC art. 1432.º, n.º 4).\n\nCom os melhores cumprimentos,\n\nO Administrador do Condomínio\nData: ${new Date().toLocaleDateString('pt-PT')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️  Documento gerado por Fixit — Adaptar conforme as especificidades do condomínio\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    setConvocatoria(conv)
  }

  const tipoClsDelib: Record<string, string> = { maioria_simples: 'bg-blue-50 text-blue-600 border-blue-200', dois_tercos: 'bg-orange-50 text-[#C9A84C] border-orange-200', unanimidade: 'bg-red-50 text-red-600 border-red-200' }
  const tipoLabels: Record<string, string> = { maioria_simples: 'Maioria simples', dois_tercos: '2/3 do valor', unanimidade: 'Unanimidade' }

  if (!current) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0D1B2E]">📝 Preparador de Assembleia</h1>
            <p className="text-sm text-gray-500 mt-0.5">Convocatória · Ordem de trabalhos · Quórums · Lei 8/2022</p>
          </div>
          <button onClick={createNew} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Nova Assembleia</button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <span className="text-xl">⚖️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">Enquadramento Legal — Lei 8/2022</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Convocatória com antecedência mínima de 10 dias (CC art. 1432.º) · 2.ª convocação 30 min depois ·
              Procuração com poderes especiais · Atas obrigatórias
            </p>
          </div>
        </div>

        {projetos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="text-5xl mb-3">🏛️</div>
            <h3 className="font-bold text-gray-700 mb-1">Nenhuma assembleia preparada</h3>
            <p className="text-sm text-gray-500 mb-4">Crie a sua primeira assembleia de condóminos</p>
            <button onClick={createNew} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Iniciar preparação</button>
          </div>
        ) : (
          <div className="space-y-2">
            {projetos.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-[#E4DDD0] transition cursor-pointer" onClick={() => { setCurrent(p); setPasso('infos') }}>
                <div className="text-2xl">🏛️</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">AG {p.tipo_ag === 'extraordinaria' ? 'Extraordinária' : 'Ordinária'} — {p.edificio || 'Edifício não definido'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.data_ag ? new Date(p.data_ag).toLocaleDateString('pt-PT') : 'Data não definida'} · {p.deliberacoes.length} deliberações</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold flex-shrink-0 ${p.estado === 'concluida' ? 'bg-green-100 text-green-700' : p.estado === 'convocatorias_enviadas' ? 'bg-blue-100 text-blue-700' : 'bg-[#F7F4EE] text-gray-500'}`}>
                  {p.estado === 'concluida' ? '✅ Concluída' : p.estado === 'convocatorias_enviadas' ? '📧 Convocada' : '✏️ Rascunho'}
                </span>
                <button onClick={ev => { ev.stopPropagation(); saveProjetos(projetos.filter(x => x.id !== p.id)) }} className="text-red-400 hover:text-red-600 text-sm p-1 flex-shrink-0">🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const passoIdx = PASSOS_NAV.findIndex(s => s.key === passo)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => { setCurrent(null); setConvocatoria('') }} className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition">← Voltar à lista</button>

      <div className="bg-gradient-to-r from-[#0D1B2E] to-[#152338] rounded-2xl p-5 mb-4 text-white">
        <h2 className="font-bold text-lg mb-1">📝 AG {current.tipo_ag === 'extraordinaria' ? 'Extraordinária' : 'Ordinária'} — {current.edificio || 'Edifício'}</h2>
        <p className="text-[#C9A84C] text-sm">{current.data_ag ? new Date(current.data_ag).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Data a definir'} · {current.local || 'Local a definir'}</p>
        <div className="flex gap-1 mt-3">
          {PASSOS_NAV.map((s, i) => (
            <button key={s.key} onClick={() => setPasso(s.key)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${passo === s.key ? 'bg-white text-[#C9A84C]' : i < passoIdx ? 'bg-[#C9A84C] text-white' : 'bg-[#152338]/50 text-[#C9A84C]'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {passo === 'infos' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Informações gerais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Edifício</label>
                <input type="text" placeholder="Nome do edifício / condomínio" value={current.edificio} onChange={e => updateCurrent({ ...current, edificio: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de assembleia</label>
                <select value={current.tipo_ag} onChange={e => updateCurrent({ ...current, tipo_ag: e.target.value as 'ordinaria' | 'extraordinaria' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]">
                  <option value="ordinaria">Ordinária (anual)</option>
                  <option value="extraordinaria">Extraordinária</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data da assembleia</label>
                <input type="date" value={current.data_ag} onChange={e => updateCurrent({ ...current, data_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" value={current.hora_ag} onChange={e => updateCurrent({ ...current, hora_ag: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                <input type="text" placeholder="Sala de reuniões, salão do edifício..." value={current.local} onChange={e => updateCurrent({ ...current, local: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>
            {current.data_ag && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                📧 Prazo limite para envio das convocatórias: <strong>{new Date(new Date(current.data_ag).getTime() - 10 * 86400000).toLocaleDateString('pt-PT')}</strong> (10 dias antes — CC art. 1432.º)
              </div>
            )}
            <button onClick={() => setPasso('ordem_trabalhos')} className="w-full py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Seguinte → Ordem de trabalhos</button>
          </div>
        )}

        {passo === 'ordem_trabalhos' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Ordem de Trabalhos ({current.deliberacoes.length} deliberações)</h3>
            <div className="space-y-2">
              {DELIBERACOES_STD.map(d => {
                const sel = !!current.deliberacoes.find(x => x.id === d.id)
                return (
                  <div key={d.id} onClick={() => !d.obrigatoria && toggleDelib(d)} className={`rounded-xl border p-3 flex items-start gap-3 transition ${sel ? 'border-[#C9A84C] bg-[#F7F4EE]' : 'border-gray-200 bg-white'} ${!d.obrigatoria ? 'cursor-pointer hover:border-[#E4DDD0]' : ''}`}>
                    <div className={`w-5 h-5 rounded mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${sel ? 'bg-[#0D1B2E] border-[#C9A84C]' : 'border-gray-300'}`}>
                      {sel && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{d.titulo}</p>
                        {d.obrigatoria && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">Obrigatória</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${tipoClsDelib[d.tipo]}`}>{tipoLabels[d.tipo]}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{d.descricao}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPasso('infos')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">Anterior</button>
              <button onClick={() => setPasso('documentos')} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Seguinte → Documentos</button>
            </div>
          </div>
        )}

        {passo === 'documentos' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Checklist de documentos</h3>
            <p className="text-sm text-gray-500">Documentos a preparar e anexar à convocatória (Lei 8/2022)</p>
            <div className="space-y-2">
              {DOCS_CHECKLIST.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.obrigatoria ? 'bg-blue-50 border-blue-200' : 'bg-[#F7F4EE] border-gray-200'}`}>
                  <div className={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 border-2 flex items-center justify-center ${item.obrigatoria ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {item.obrigatoria && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.doc} {item.obrigatoria && <span className="text-xs text-blue-600 font-medium">(obrigatório)</span>}</p>
                    <p className="text-xs text-gray-500">{item.nota}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas para o presidente da mesa</label>
              <textarea rows={3} value={current.notas_presidente} onChange={e => updateCurrent({ ...current, notas_presidente: e.target.value })} placeholder="Pontos de atenção, quórums especiais necessários..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPasso('ordem_trabalhos')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">Anterior</button>
              <button onClick={() => setPasso('convocatoria')} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Seguinte → Convocatória</button>
            </div>
          </div>
        )}

        {passo === 'convocatoria' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800">Gerar convocatória</h3>
            {!convocatoria ? (
              <div className="bg-gradient-to-br from-[#F7F4EE] to-[#F7F4EE] border border-[#E4DDD0] rounded-2xl p-8 text-center">
                <div className="text-5xl mb-3">📧</div>
                <h4 className="font-bold text-[#0D1B2E] mb-1">Convocatória pronta para gerar</h4>
                <p className="text-sm text-[#C9A84C] mb-4">{current.deliberacoes.length} deliberações na ordem de trabalhos</p>
                <button onClick={genConvocatoria} className="px-6 py-3 bg-[#0D1B2E] text-white rounded-xl font-semibold hover:bg-[#152338] transition text-sm">📄 Gerar convocatória</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">Pré-visualização da convocatória</p>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(convocatoria); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${copied ? 'bg-green-100 text-green-700' : 'bg-[#F7F4EE] text-[#C9A84C] hover:bg-[#F7F4EE]'}`}>{copied ? '✓ Copiado' : '📋 Copiar'}</button>
                    <button onClick={() => setConvocatoria('')} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 border border-gray-200 hover:bg-[#F7F4EE]">↩ Regenerar</button>
                  </div>
                </div>
                <textarea readOnly value={convocatoria} rows={18} className="w-full px-4 py-3 bg-[#F7F4EE] border border-gray-200 rounded-xl text-xs font-mono resize-none focus:outline-none" />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPasso('documentos')} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-[#F7F4EE]">Anterior</button>
              <button onClick={() => { updateCurrent({ ...current, estado: 'convocatorias_enviadas' }); setPasso('resumo') }} className="flex-1 py-2.5 bg-[#0D1B2E] text-white rounded-xl text-sm font-semibold hover:bg-[#152338] transition">Seguinte → Resumo</button>
            </div>
          </div>
        )}

        {passo === 'resumo' && (
          <div className="space-y-4 text-center">
            <div className="text-6xl mb-2">✅</div>
            <h3 className="font-bold text-gray-800 text-xl">Assembleia preparada</h3>
            <p className="text-gray-500 text-sm">A convocatória e os documentos estão prontos para enviar aos condóminos.</p>
            <div className="grid grid-cols-3 gap-3 text-left mt-4">
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-2xl font-bold text-gray-800">{current.deliberacoes.length}</p><p className="text-xs text-gray-500">Deliberações</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.data_ag ? new Date(current.data_ag).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : 'N/A'}</p><p className="text-xs text-gray-500">Data da AG</p></div>
              <div className="bg-[#F7F4EE] rounded-xl p-3 text-center"><p className="text-lg font-bold text-gray-800">{current.hora_ag}</p><p className="text-xs text-gray-500">Hora</p></div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-4">
              <button onClick={() => { genConvocatoria(); setPasso('convocatoria') }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">📋 Ver convocatória</button>
              <button onClick={() => { updateCurrent({ ...current, estado: 'concluida' }); setCurrent(null) }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">✅ Marcar como concluída</button>
              <button onClick={() => setCurrent(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-[#F7F4EE]">Voltar à lista</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
