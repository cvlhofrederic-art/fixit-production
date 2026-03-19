'use client'

import React, { useState, useRef, useCallback } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
type CategoriaOcorrencia =
  | 'canalizacao' | 'eletricidade' | 'elevador' | 'infiltracao'
  | 'ruido' | 'limpeza' | 'jardim' | 'garagem' | 'fachada'
  | 'cobertura' | 'seguranca' | 'incendio' | 'pragas' | 'outro'

interface IAAnalysis {
  categoria: CategoriaOcorrencia
  prioridade: Prioridade
  descricaoFormatada: string
  localizacao: string
  recomendacoes: string[]
  artisanType: string
  urgencia: boolean
  confianca: number  // 0-100
}

interface OcorrenciaIA {
  id: string
  textoOriginal: string
  imagemBase64?: string
  analise: IAAnalysis
  dataCriacao: string
  estado: 'analisada' | 'criada' | 'rejeitada'
  immeubleId: string
  immeubleNom: string
}

// ─── Categorie config ────────────────────────────────────────────────────────

const CATEGORIAS: Record<CategoriaOcorrencia, { label: string; icon: string; color: string }> = {
  canalizacao:  { label: 'Canalização',   icon: '🚿', color: 'bg-blue-100 text-blue-700' },
  eletricidade: { label: 'Eletricidade',  icon: '⚡', color: 'bg-yellow-100 text-yellow-700' },
  elevador:     { label: 'Elevador',      icon: '🛗', color: 'bg-purple-100 text-purple-700' },
  infiltracao:  { label: 'Infiltração',   icon: '💧', color: 'bg-cyan-100 text-cyan-700' },
  ruido:        { label: 'Ruído',         icon: '🔊', color: 'bg-orange-100 text-orange-700' },
  limpeza:      { label: 'Limpeza',       icon: '🧹', color: 'bg-green-100 text-green-700' },
  jardim:       { label: 'Jardim',        icon: '🌿', color: 'bg-emerald-100 text-emerald-700' },
  garagem:      { label: 'Garagem',       icon: '🅿️', color: 'bg-gray-100 text-gray-700' },
  fachada:      { label: 'Fachada',       icon: '🏠', color: 'bg-amber-100 text-amber-700' },
  cobertura:    { label: 'Cobertura',     icon: '🏗️', color: 'bg-red-100 text-red-700' },
  seguranca:    { label: 'Segurança',     icon: '🔒', color: 'bg-slate-100 text-slate-700' },
  incendio:     { label: 'Incêndio',      icon: '🔥', color: 'bg-red-200 text-red-800' },
  pragas:       { label: 'Pragas',        icon: '🐛', color: 'bg-lime-100 text-lime-700' },
  outro:        { label: 'Outro',         icon: '📋', color: 'bg-gray-100 text-gray-600' },
}

const PRIORIDADE_CFG: Record<Prioridade, { label: string; icon: string; color: string }> = {
  baixa:   { label: 'Baixa',   icon: '🟢', color: 'bg-green-100 text-green-700' },
  media:   { label: 'Média',   icon: '🟡', color: 'bg-yellow-100 text-yellow-700' },
  alta:    { label: 'Alta',    icon: '🟠', color: 'bg-orange-100 text-orange-700' },
  urgente: { label: 'Urgente', icon: '🔴', color: 'bg-red-100 text-red-700' },
}

// ─── IA Classifier (local heuristic — no API needed) ─────────────────────────

function classifyOcorrencia(texto: string, hasImage: boolean): IAAnalysis {
  const t = texto.toLowerCase()

  // Catégorisation par mots-clés
  let categoria: CategoriaOcorrencia = 'outro'
  let prioridade: Prioridade = 'media'
  let artisanType = 'Técnico geral'
  let localizacao = 'Partes comuns'
  const recomendacoes: string[] = []

  // Canalizacao
  if (/cano|tubo|água|fuga|torneira|sanit[aá]rio|wc|casa de banho|descarga|entupido|entupimento|sif[aã]o/.test(t)) {
    categoria = 'canalizacao'
    artisanType = 'Canalizador'
    recomendacoes.push('Fechar registo de água mais próximo se possível')
    if (/fuga|inunda|urgente|emergência/.test(t)) {
      prioridade = 'urgente'
      recomendacoes.push('URGENTE: contactar canalizador de emergência')
    } else {
      prioridade = 'alta'
    }
  }
  // Eletricidade
  else if (/eletri|luz|lâmpada|quadro el|disjuntor|tomada|fiação|curto/.test(t)) {
    categoria = 'eletricidade'
    artisanType = 'Eletricista'
    prioridade = /curto|faísca|cheiro a queimado|emergência/.test(t) ? 'urgente' : 'alta'
    recomendacoes.push('Não tocar em fios expostos')
    if (prioridade === 'urgente') recomendacoes.push('URGENTE: desligar disjuntor geral')
  }
  // Elevador
  else if (/elevador|ascensor|cabina|preso no elevador/.test(t)) {
    categoria = 'elevador'
    artisanType = 'Empresa de elevadores'
    prioridade = /preso|bloqueado|parado/.test(t) ? 'urgente' : 'alta'
    recomendacoes.push('Contactar empresa de manutenção do elevador')
    if (/preso/.test(t)) recomendacoes.push('URGENTE: Ligar 112 se há pessoas presas')
  }
  // Infiltração
  else if (/infiltra|humidade|mancha|bolor|mofo|gota|gotejar|chuva/.test(t)) {
    categoria = 'infiltracao'
    artisanType = 'Impermeabilizador / Canalizador'
    prioridade = 'alta'
    recomendacoes.push('Fotografar a extensão da mancha/infiltração')
    recomendacoes.push('Verificar se existe fuga na fração superior')
  }
  // Ruído
  else if (/ruído|barulho|música|festa|obra|perturbação/.test(t)) {
    categoria = 'ruido'
    prioridade = /noite|madrugada|21h|22h|23h/.test(t) ? 'alta' : 'baixa'
    artisanType = 'Administração (mediação)'
    recomendacoes.push('Registar horário e duração do ruído')
  }
  // Limpeza
  else if (/limp|sujo|lixo|contentor|reciclagem|cheiro/.test(t)) {
    categoria = 'limpeza'
    prioridade = /cheiro|insalubre/.test(t) ? 'media' : 'baixa'
    artisanType = 'Empresa de limpeza'
    recomendacoes.push('Contactar empresa de limpeza')
  }
  // Jardim
  else if (/jardim|árvore|relva|rega|poda|canteiro/.test(t)) {
    categoria = 'jardim'
    prioridade = /árvore caída|perigo/.test(t) ? 'alta' : 'baixa'
    artisanType = 'Jardineiro'
    localizacao = 'Espaços exteriores'
  }
  // Garagem
  else if (/garag|estacion|portão|parking|cave/.test(t)) {
    categoria = 'garagem'
    prioridade = /portão|bloqueado|inunda/.test(t) ? 'alta' : 'media'
    artisanType = 'Técnico de portões / Canalizador'
    localizacao = 'Garagem / Cave'
  }
  // Fachada
  else if (/fachada|reboco|azulejo|pintura exterior|graffiti|varanda/.test(t)) {
    categoria = 'fachada'
    prioridade = /queda|desprendimento|perigo/.test(t) ? 'urgente' : 'media'
    artisanType = 'Empresa de construção'
    localizacao = 'Fachada exterior'
    if (prioridade === 'urgente') recomendacoes.push('URGENTE: isolar zona por risco de queda')
  }
  // Cobertura
  else if (/cobertura|telhado|telha|caleira/.test(t)) {
    categoria = 'cobertura'
    prioridade = 'alta'
    artisanType = 'Empresa de coberturas'
    localizacao = 'Cobertura / Telhado'
    recomendacoes.push('Inspecionar após chuva forte')
  }
  // Segurança
  else if (/seguran|porta|fechadura|arrombamento|vandalismo|câmara|alarme/.test(t)) {
    categoria = 'seguranca'
    prioridade = /arrombamento|vandalismo/.test(t) ? 'urgente' : 'alta'
    artisanType = 'Serralheiro / Empresa de segurança'
    recomendacoes.push('Apresentar queixa na PSP se vandalismo')
  }
  // Incêndio
  else if (/incêndio|fogo|fumo|extintor|sprinkler/.test(t)) {
    categoria = 'incendio'
    prioridade = 'urgente'
    artisanType = 'Bombeiros (112)'
    recomendacoes.push('URGENTE: Ligar 112 imediatamente')
    recomendacoes.push('Evacuar o edifício se necessário')
  }
  // Pragas
  else if (/prag|rato|ratazana|barata|cupim|térmita|pombo|vespa/.test(t)) {
    categoria = 'pragas'
    prioridade = 'media'
    artisanType = 'Empresa de desinfestação'
    recomendacoes.push('Não utilizar produtos tóxicos sem orientação profissional')
  }

  // Détection localisation dans le texte
  if (/hall|entrada|portaria/.test(t)) localizacao = 'Hall de entrada'
  else if (/escada|patamar/.test(t)) localizacao = 'Escadaria'
  else if (/terraço|cobertura/.test(t)) localizacao = 'Terraço / Cobertura'
  else if (/cave|garagem/.test(t)) localizacao = 'Cave / Garagem'
  else if (/piso|andar|(\d+)\.?º/.test(t)) {
    const match = t.match(/(\d+)\.?º\s*(?:andar|piso)?/)
    if (match) localizacao = `${match[1]}.º andar`
  }

  // Boost confiance si image
  const confianca = hasImage ? 85 : 65

  // Description formatée
  const descricaoFormatada = texto.charAt(0).toUpperCase() + texto.slice(1) +
    (texto.endsWith('.') ? '' : '.')

  return {
    categoria,
    prioridade,
    descricaoFormatada,
    localizacao,
    recomendacoes,
    artisanType,
    urgencia: prioridade === 'urgente',
    confianca,
  }
}

// ─── Composant Principal ─────────────────────────────────────────────────────

interface Props {
  user: any
  userRole: string
}

export default function OcorrenciasIASection({ user }: Props) {
  const uid = user?.id || 'demo'
  const lsKey = (k: string) => `fixit_syndic_${uid}_${k}`

  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [selectedImm, setSelectedImm] = useState('')
  const [textoInput, setTextoInput] = useState('')
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<IAAnalysis | null>(null)
  const [historico, setHistorico] = useState<OcorrenciaIA[]>([])
  const [editCategoria, setEditCategoria] = useState<CategoriaOcorrencia | null>(null)
  const [editPrioridade, setEditPrioridade] = useState<Prioridade | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        const data = await res.json()
        const imms = (data.immeubles || []).map((i: any) => ({ id: i.id, nom: i.nom }))
        setImmeubles(imms)
        if (imms.length > 0) setSelectedImm(imms[0].id)
      } catch {}
      const saved = JSON.parse(localStorage.getItem(lsKey('ocorrencias_ia_hist')) || '[]')
      setHistorico(saved)
      setLoaded(true)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // ── Image handling ────────────────────────────────────────────────────────
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImagemPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Analyze ────────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(() => {
    if (!textoInput.trim()) return
    setAnalyzing(true)
    setTimeout(() => {
      const analysis = classifyOcorrencia(textoInput, !!imagemPreview)
      setResult(analysis)
      setEditCategoria(analysis.categoria)
      setEditPrioridade(analysis.prioridade)
      setAnalyzing(false)
    }, 1200)
  }, [textoInput, imagemPreview])

  // ── Create occurrence ─────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!result) return
    const immNom = immeubles.find(i => i.id === selectedImm)?.nom || 'Edifício'

    const finalAnalysis = {
      ...result,
      categoria: editCategoria || result.categoria,
      prioridade: editPrioridade || result.prioridade,
    }

    const ocorrencia: OcorrenciaIA = {
      id: Math.random().toString(36).slice(2, 10),
      textoOriginal: textoInput,
      imagemBase64: imagemPreview || undefined,
      analise: finalAnalysis,
      dataCriacao: new Date().toISOString(),
      estado: 'criada',
      immeubleId: selectedImm,
      immeubleNom: immNom,
    }

    const updated = [ocorrencia, ...historico]
    setHistorico(updated)
    localStorage.setItem(lsKey('ocorrencias_ia_hist'), JSON.stringify(updated.slice(0, 100)))

    // Sauvegarder aussi dans le format ocorrências standard
    const existingOc = JSON.parse(localStorage.getItem(lsKey('ocorrencias')) || '[]')
    existingOc.push({
      id: ocorrencia.id,
      immeuble: immNom,
      date: ocorrencia.dataCriacao,
      statut: 'aberta',
      priorite: finalAnalysis.prioridade,
      categoria: finalAnalysis.categoria,
      descricao: finalAnalysis.descricaoFormatada,
      localizacao: finalAnalysis.localizacao,
      criadaPorIA: true,
    })
    localStorage.setItem(lsKey('ocorrencias'), JSON.stringify(existingOc))

    // Reset
    setTextoInput('')
    setImagemPreview(null)
    setResult(null)
    setEditCategoria(null)
    setEditPrioridade(null)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0D1B2E] flex items-center gap-2">
          🤖 Criação de Ocorrências com IA
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Envie texto e/ou foto — a IA categoriza, prioriza, localiza e cria a ocorrência automaticamente
        </p>
      </div>

      {/* Input zone */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Text + image input */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Edifício</label>
              <select
                value={selectedImm}
                onChange={e => setSelectedImm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C9A84C]/40"
              >
                {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Descrição do problema (texto livre, como uma mensagem WhatsApp)
              </label>
              <textarea
                value={textoInput}
                onChange={e => setTextoInput(e.target.value)}
                placeholder="Ex: Está a chover dentro do elevador do 3.º andar, parece uma fuga no telhado..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C9A84C]/40 resize-none"
              />
            </div>

            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                📷 {imagemPreview ? 'Substituir Foto' : 'Adicionar Foto'}
              </button>
              {imagemPreview && (
                <div className="mt-3 relative inline-block">
                  <img src={imagemPreview} alt="Preview" loading="lazy" width={128} height={128} className="w-32 h-32 object-cover rounded-xl border border-gray-200" />
                  <button
                    onClick={() => setImagemPreview(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !textoInput.trim()}
              className="w-full px-4 py-3 bg-[#0D1B2E] text-white rounded-xl text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  A analisar com IA...
                </>
              ) : (
                <>🤖 Analisar e Classificar</>
              )}
            </button>
          </div>

          {/* Result / Preview */}
          <div>
            {result ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-emerald-700">✅ Análise IA Concluída</span>
                    <span className="text-xs text-emerald-500">(confiança: {result.confianca}%)</span>
                  </div>
                  <p className="text-xs text-emerald-600">{result.descricaoFormatada}</p>
                </div>

                {/* Editable fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Categoria (pode alterar)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(Object.entries(CATEGORIAS) as [CategoriaOcorrencia, typeof CATEGORIAS[CategoriaOcorrencia]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setEditCategoria(key)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            editCategoria === key ? `ring-2 ring-[#C9A84C] ${cfg.color}` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {cfg.icon} {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Prioridade (pode alterar)</label>
                    <div className="flex gap-2">
                      {(Object.entries(PRIORIDADE_CFG) as [Prioridade, typeof PRIORIDADE_CFG[Prioridade]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setEditPrioridade(key)}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            editPrioridade === key ? `ring-2 ring-[#C9A84C] ${cfg.color}` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {cfg.icon} {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">📍 Localização</p>
                      <p className="text-sm font-medium text-[#0D1B2E]">{result.localizacao}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">🔧 Tipo Artesão</p>
                      <p className="text-sm font-medium text-[#0D1B2E]">{result.artisanType}</p>
                    </div>
                  </div>

                  {result.recomendacoes.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 mb-1">💡 Recomendações</p>
                      {result.recomendacoes.map((r, i) => (
                        <p key={i} className="text-xs text-amber-600">→ {r}</p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleCreate}
                    className="w-full px-4 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    ✅ Criar Ocorrência
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-gray-400 py-16">
                <div>
                  <p className="text-4xl mb-3">🤖</p>
                  <p className="text-sm font-medium">Escreva a descrição do problema</p>
                  <p className="text-xs mt-1">A IA irá categorizar, priorizar e localizar automaticamente</p>
                  <div className="mt-4 space-y-1 text-left max-w-xs mx-auto">
                    <p className="text-xs text-gray-400">💡 Exemplos:</p>
                    {[
                      '"Fuga de água no 2.º andar, está a pingar para o 1.º"',
                      '"Elevador avariado desde ontem, faz barulho estranho"',
                      '"Lâmpada fundida na escadaria entre o 3.º e 4.º andar"',
                    ].map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setTextoInput(ex.replace(/"/g, ''))}
                        className="block w-full text-left text-xs text-blue-500 hover:text-blue-700 py-0.5 transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-[#0D1B2E] text-sm">📋 Ocorrências Criadas por IA ({historico.length})</h3>
          {historico.slice(0, 20).map(oc => {
            const catCfg = CATEGORIAS[oc.analise.categoria]
            const prioCfg = PRIORIDADE_CFG[oc.analise.prioridade]
            return (
              <div key={oc.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {oc.imagemBase64 && (
                    <img src={oc.imagemBase64} alt="" loading="lazy" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catCfg.color}`}>
                        {catCfg.icon} {catCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${prioCfg.color}`}>
                        {prioCfg.icon} {prioCfg.label}
                      </span>
                      <span className="text-xs text-gray-400">{oc.immeubleNom}</span>
                    </div>
                    <p className="text-sm text-[#0D1B2E]">{oc.analise.descricaoFormatada}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      📍 {oc.analise.localizacao} • 🔧 {oc.analise.artisanType} •{' '}
                      {new Date(oc.dataCriacao).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    oc.estado === 'criada' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {oc.estado === 'criada' ? '✅ Criada' : oc.estado}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
