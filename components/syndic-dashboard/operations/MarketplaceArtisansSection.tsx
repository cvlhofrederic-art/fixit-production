'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE ARTISANS BIDIRECTIONNEL — Pesquisa, comparação, avaliação
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  user: User
  userRole: string
}

interface ArtisanMarket {
  id: string
  nome: string
  empresa: string
  especialidade: string
  subespecialidades: string[]
  cidade: string
  distrito: string
  avaliacao: number // 1-5
  totalAvaliacoes: number
  precoMedio: string // €/hora ou forfait
  tempoResposta: string // ex: "< 2h", "24h"
  certificacoes: string[]
  alvara: string
  seguro: boolean
  seguroValidade: string
  disponivel: boolean
  fotos: string[]
  descricao: string
  anosExperiencia: number
  trabalhosConcluidos: number
  taxaAceitacao: number // %
  ultimaAtividade: string
  contatoEmail: string
  contatoTelefone: string
  destaque: boolean
}

interface PedidoOrcamento {
  id: string
  titulo: string
  descricao: string
  categoria: string
  urgencia: 'normal' | 'urgente' | 'emergencia'
  immeubleId: string
  immeubleNom: string
  dataCriacao: string
  dataLimite: string
  status: 'aberto' | 'em_analise' | 'orcamentado' | 'adjudicado' | 'cancelado'
  propostas: Proposta[]
  fotos: string[]
}

interface Proposta {
  id: string
  artisanId: string
  artisanNome: string
  artisanEmpresa: string
  valor: number
  prazoExecucao: string // ex: "3 dias"
  descricao: string
  incluiMaterial: boolean
  garantia: string
  dataEnvio: string
  aceite: boolean
}

interface AvaliacaoArtisan {
  id: string
  artisanId: string
  syndicNome: string
  nota: number
  comentario: string
  data: string
  trabalho: string
}

// ── Categories ──
const CATEGORIAS_PT = [
  { id: 'canalizacao', label: 'Canalização', emoji: '🔧' },
  { id: 'eletricidade', label: 'Eletricidade', emoji: '⚡' },
  { id: 'pintura', label: 'Pintura', emoji: '🎨' },
  { id: 'serralharia', label: 'Serralharia', emoji: '🔩' },
  { id: 'elevadores', label: 'Elevadores', emoji: '🛗' },
  { id: 'limpeza', label: 'Limpeza', emoji: '🧹' },
  { id: 'jardinagem', label: 'Paisagismo', emoji: '🌱' },
  { id: 'poda', label: 'Poda / Arboricultura', emoji: '🌳' },
  { id: 'impermeabilizacao', label: 'Impermeabilização', emoji: '💧' },
  { id: 'construcao', label: 'Construção Civil', emoji: '🏗️' },
  { id: 'climatizacao', label: 'Climatização / AVAC', emoji: '❄️' },
  { id: 'seguranca', label: 'Segurança / CCTV', emoji: '🔒' },
  { id: 'gas', label: 'Gás', emoji: '🔥' },
  { id: 'telhados', label: 'Telhados / Coberturas', emoji: '🏠' },
  { id: 'desentupimentos', label: 'Desentupimentos', emoji: '🚰' },
]

// ── Demo artisans ──
const DEMO_ARTISANS: ArtisanMarket[] = [
  {
    id: 'art_1', nome: 'António Silva', empresa: 'CanalFix Lda', especialidade: 'canalizacao',
    subespecialidades: ['Desentupimentos', 'Redes de água', 'Aquecimento central'],
    cidade: 'Lisboa', distrito: 'Lisboa', avaliacao: 4.8, totalAvaliacoes: 127,
    precoMedio: '35€/h', tempoResposta: '< 2h', certificacoes: ['CERTIF Canalização Nível III'],
    alvara: 'AL-2024/8834', seguro: true, seguroValidade: '2025-12-31', disponivel: true,
    fotos: [], descricao: 'Especialista em canalização predial com 15 anos de experiência.',
    anosExperiencia: 15, trabalhosConcluidos: 342, taxaAceitacao: 94, ultimaAtividade: '2026-03-13',
    contatoEmail: 'antonio@canalfix.pt', contatoTelefone: '+351 912 345 678', destaque: true,
  },
  {
    id: 'art_2', nome: 'Maria Santos', empresa: 'ElectroMaria', especialidade: 'eletricidade',
    subespecialidades: ['Quadros elétricos', 'Iluminação LED', 'Domótica'],
    cidade: 'Porto', distrito: 'Porto', avaliacao: 4.9, totalAvaliacoes: 89,
    precoMedio: '40€/h', tempoResposta: '< 4h', certificacoes: ['DGEG Eletricista Cat. IV'],
    alvara: 'AL-2023/5521', seguro: true, seguroValidade: '2026-06-30', disponivel: true,
    fotos: [], descricao: 'Eletricista certificada DGEG. Especialista em instalações prediais e domótica.',
    anosExperiencia: 12, trabalhosConcluidos: 198, taxaAceitacao: 97, ultimaAtividade: '2026-03-14',
    contatoEmail: 'maria@electromaria.pt', contatoTelefone: '+351 918 765 432', destaque: true,
  },
  {
    id: 'art_3', nome: 'João Costa', empresa: 'PintaCerta', especialidade: 'pintura',
    subespecialidades: ['Fachadas', 'Interiores', 'Impermeabilização'],
    cidade: 'Sintra', distrito: 'Lisboa', avaliacao: 4.5, totalAvaliacoes: 63,
    precoMedio: '28€/h', tempoResposta: '24h', certificacoes: ['CCP Pintura Industrial'],
    alvara: 'AL-2024/1192', seguro: true, seguroValidade: '2025-08-15', disponivel: true,
    fotos: [], descricao: 'Pintura de edifícios e condomínios. Trabalho garantido por 3 anos.',
    anosExperiencia: 8, trabalhosConcluidos: 156, taxaAceitacao: 88, ultimaAtividade: '2026-03-10',
    contatoEmail: 'joao@pintacerta.pt', contatoTelefone: '+351 926 543 210', destaque: false,
  },
  {
    id: 'art_4', nome: 'Pedro Mendes', empresa: 'ElevaPT', especialidade: 'elevadores',
    subespecialidades: ['Manutenção', 'Modernização', 'Inspeções ASAE'],
    cidade: 'Lisboa', distrito: 'Lisboa', avaliacao: 4.7, totalAvaliacoes: 45,
    precoMedio: 'Contrato anual', tempoResposta: '< 1h', certificacoes: ['ASAE Elevadores', 'ISO 9001'],
    alvara: 'AL-2022/3367', seguro: true, seguroValidade: '2026-03-31', disponivel: true,
    fotos: [], descricao: 'Empresa certificada para manutenção e modernização de elevadores.',
    anosExperiencia: 20, trabalhosConcluidos: 89, taxaAceitacao: 100, ultimaAtividade: '2026-03-14',
    contatoEmail: 'pedro@elevapt.pt', contatoTelefone: '+351 932 111 222', destaque: true,
  },
]

type TabMarket = 'pesquisar' | 'pedidos' | 'avaliacoes' | 'favoritos'

export default function MarketplaceArtisansSection({ user, userRole }: Props) {
  const [tab, setTab] = useState<TabMarket>('pesquisar')
  const [artisans, setArtisans] = useState<ArtisanMarket[]>(DEMO_ARTISANS)
  const [pedidos, setPedidos] = useState<PedidoOrcamento[]>([])
  const [favoritos, setFavoritos] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterCategoria, setFilterCategoria] = useState<string>('all')
  const [filterDistrito, setFilterDistrito] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'avaliacao' | 'preco' | 'experiencia'>('avaliacao')
  const [selectedArtisan, setSelectedArtisan] = useState<ArtisanMarket | null>(null)
  const [showNewPedido, setShowNewPedido] = useState(false)
  const [pedidoForm, setPedidoForm] = useState({
    titulo: '',
    descricao: '',
    categoria: '',
    urgencia: 'normal' as PedidoOrcamento['urgencia'],
    dataLimite: '',
    immeubleNom: '',
  })

  const uid = user?.id || 'local'
  const pedidosKey = `fixit_syndic_marketplace_pedidos_${uid}`
  const favoritosKey = `fixit_syndic_marketplace_favs_${uid}`

  useEffect(() => {
    const storedP = localStorage.getItem(pedidosKey)
    if (storedP) setPedidos(JSON.parse(storedP))
    const storedF = localStorage.getItem(favoritosKey)
    if (storedF) setFavoritos(JSON.parse(storedF))
  }, [])

  const savePedidos = (data: PedidoOrcamento[]) => {
    setPedidos(data)
    localStorage.setItem(pedidosKey, JSON.stringify(data))
  }

  const toggleFavorito = (id: string) => {
    const updated = favoritos.includes(id) ? favoritos.filter(f => f !== id) : [...favoritos, id]
    setFavoritos(updated)
    localStorage.setItem(favoritosKey, JSON.stringify(updated))
  }

  const createPedido = () => {
    const pedido: PedidoOrcamento = {
      id: `ped_${Date.now()}`,
      titulo: pedidoForm.titulo,
      descricao: pedidoForm.descricao,
      categoria: pedidoForm.categoria,
      urgencia: pedidoForm.urgencia,
      immeubleId: '',
      immeubleNom: pedidoForm.immeubleNom,
      dataCriacao: new Date().toISOString(),
      dataLimite: pedidoForm.dataLimite,
      status: 'aberto',
      propostas: [],
      fotos: [],
    }
    savePedidos([pedido, ...pedidos])
    setShowNewPedido(false)
    setPedidoForm({ titulo: '', descricao: '', categoria: '', urgencia: 'normal', dataLimite: '', immeubleNom: '' })
  }

  // ── Filter artisans ──
  const filteredArtisans = artisans
    .filter(a => {
      if (filterCategoria !== 'all' && a.especialidade !== filterCategoria) return false
      if (filterDistrito !== 'all' && a.distrito !== filterDistrito) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        return a.nome.toLowerCase().includes(q) || a.empresa.toLowerCase().includes(q) ||
          a.especialidade.toLowerCase().includes(q) || a.subespecialidades.some(s => s.toLowerCase().includes(q))
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'avaliacao') return b.avaliacao - a.avaliacao
      if (sortBy === 'experiencia') return b.anosExperiencia - a.anosExperiencia
      return 0
    })

  const distritos = [...new Set(artisans.map(a => a.distrito))].sort()

  // ── Stars renderer ──
  const renderStars = (rating: number) => {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))
  }

  const tabs: { id: TabMarket; label: string; emoji: string }[] = [
    { id: 'pesquisar', label: 'Pesquisar', emoji: '🔍' },
    { id: 'pedidos', label: 'Pedidos de Orçamento', emoji: '📝' },
    { id: 'avaliacoes', label: 'Avaliações', emoji: '⭐' },
    { id: 'favoritos', label: 'Favoritos', emoji: '❤️' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: '#0D1B2E', margin: 0 }}>
          🏪 Marketplace de Profissionais
        </h1>
        <p style={{ color: '#4A5E78', fontSize: 14, marginTop: 4 }}>
          Encontre prestadores certificados · Compare orçamentos · Avalie serviços
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '👷', label: 'Profissionais disponíveis', value: artisans.filter(a => a.disponivel).length, color: '#22C55E' },
          { emoji: '📝', label: 'Pedidos ativos', value: pedidos.filter(p => p.status === 'aberto').length, color: '#0EA5E9' },
          { emoji: '❤️', label: 'Favoritos', value: favoritos.length, color: '#EF4444' },
          { emoji: '⭐', label: 'Avaliação média', value: (artisans.reduce((s, a) => s + a.avaliacao, 0) / artisans.length).toFixed(1), color: '#C9A84C' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <span style={{ fontSize: 12, color: '#4A5E78' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E4DDD0' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
              background: tab === t.id ? '#F7F4EE' : 'transparent',
              color: tab === t.id ? '#0D1B2E' : '#4A5E78',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              marginBottom: -2,
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: PESQUISAR ═══ */}
      {tab === 'pesquisar' && !selectedArtisan && (
        <div>
          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="🔍 Pesquisar profissional, empresa ou especialidade..."
              style={{ flex: '1 1 300px', padding: '10px 14px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
            />
            <select
              value={filterCategoria}
              onChange={e => setFilterCategoria(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
            >
              <option value="all">Todas as categorias</option>
              {CATEGORIAS_PT.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <select
              value={filterDistrito}
              onChange={e => setFilterDistrito(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
            >
              <option value="all">Todos os distritos</option>
              {distritos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ padding: '10px 12px', border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
            >
              <option value="avaliacao">⭐ Melhor avaliação</option>
              <option value="experiencia">📅 Mais experiência</option>
            </select>
          </div>

          {/* Categories quick filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {CATEGORIAS_PT.slice(0, 8).map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCategoria(filterCategoria === c.id ? 'all' : c.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: filterCategoria === c.id ? '2px solid #C9A84C' : '1px solid #E4DDD0',
                  background: filterCategoria === c.id ? '#F7F4EE' : '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {/* Artisans grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {filteredArtisans.map(artisan => {
              const catConfig = CATEGORIAS_PT.find(c => c.id === artisan.especialidade)
              return (
                <div
                  key={artisan.id}
                  style={{
                    background: '#fff',
                    border: artisan.destaque ? '2px solid #C9A84C' : '1px solid #E4DDD0',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    position: 'relative',
                  }}
                  onClick={() => setSelectedArtisan(artisan)}
                >
                  {artisan.destaque && (
                    <span style={{
                      position: 'absolute',
                      top: -8,
                      right: 12,
                      padding: '2px 10px',
                      background: '#C9A84C',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 10,
                    }}>
                      ⭐ DESTAQUE
                    </span>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#0D1B2E' }}>{artisan.nome}</div>
                      <div style={{ fontSize: 13, color: '#4A5E78' }}>{artisan.empresa}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorito(artisan.id) }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 20,
                        cursor: 'pointer',
                        color: favoritos.includes(artisan.id) ? '#EF4444' : '#D1D5DB',
                      }}
                    >
                      {favoritos.includes(artisan.id) ? '❤️' : '🤍'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: '#F7F4EE', border: '1px solid #E4DDD0' }}>
                      {catConfig?.emoji} {catConfig?.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>📍 {artisan.cidade}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <span style={{ color: '#C9A84C', fontSize: 14, letterSpacing: 1 }}>{renderStars(artisan.avaliacao)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{artisan.avaliacao}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>({artisan.totalAvaliacoes} avaliações)</span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 12, color: '#6B7280' }}>
                    <span>💰 {artisan.precoMedio}</span>
                    <span>⏱ {artisan.tempoResposta}</span>
                    <span>📅 {artisan.anosExperiencia} anos</span>
                    <span>✅ {artisan.trabalhosConcluidos} trabalhos</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {artisan.certificacoes.map((cert, i) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#DCFCE7', color: '#166534' }}>
                        ✓ {cert}
                      </span>
                    ))}
                  </div>

                  <div style={{
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background: artisan.disponivel ? '#DCFCE7' : '#FEF2F2',
                    color: artisan.disponivel ? '#166534' : '#991B1B',
                    width: 'fit-content',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: artisan.disponivel ? '#22C55E' : '#EF4444',
                    }} />
                    {artisan.disponivel ? 'Disponível' : 'Indisponível'}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredArtisans.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div>Nenhum profissional encontrado com os filtros aplicados</div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ARTISAN DETAIL ═══ */}
      {tab === 'pesquisar' && selectedArtisan && (
        <div>
          <button
            onClick={() => setSelectedArtisan(null)}
            style={{ marginBottom: 16, padding: '8px 16px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            ← Voltar à pesquisa
          </button>

          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 24, color: '#0D1B2E' }}>
                  {selectedArtisan.nome}
                </h2>
                <div style={{ fontSize: 16, color: '#4A5E78', marginTop: 4 }}>{selectedArtisan.empresa}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#C9A84C', fontSize: 20 }}>{renderStars(selectedArtisan.avaliacao)}</div>
                <div style={{ fontSize: 14, color: '#0D1B2E', fontWeight: 600 }}>{selectedArtisan.avaliacao} / 5</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{selectedArtisan.totalAvaliacoes} avaliações</div>
              </div>
            </div>

            <p style={{ color: '#4A5E78', fontSize: 14, lineHeight: 1.6, marginTop: 16 }}>
              {selectedArtisan.descricao}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
              {[
                { label: 'Especialidade', value: CATEGORIAS_PT.find(c => c.id === selectedArtisan.especialidade)?.label || '', emoji: '🔧' },
                { label: 'Localização', value: `${selectedArtisan.cidade}, ${selectedArtisan.distrito}`, emoji: '📍' },
                { label: 'Preço médio', value: selectedArtisan.precoMedio, emoji: '💰' },
                { label: 'Tempo de resposta', value: selectedArtisan.tempoResposta, emoji: '⏱' },
                { label: 'Experiência', value: `${selectedArtisan.anosExperiencia} anos`, emoji: '📅' },
                { label: 'Trabalhos concluídos', value: selectedArtisan.trabalhosConcluidos.toString(), emoji: '✅' },
                { label: 'Taxa de aceitação', value: `${selectedArtisan.taxaAceitacao}%`, emoji: '📊' },
                { label: 'Alvará', value: selectedArtisan.alvara, emoji: '📜' },
              ].map(item => (
                <div key={item.label} style={{ padding: 12, border: '1px solid #E4DDD0', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.emoji} {item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', marginTop: 4 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 14, color: '#0D1B2E', marginBottom: 8 }}>🎯 Subespecialidades</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedArtisan.subespecialidades.map((s, i) => (
                  <span key={i} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: '#F7F4EE', border: '1px solid #E4DDD0' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 14, color: '#0D1B2E', marginBottom: 8 }}>📜 Certificações</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedArtisan.certificacoes.map((c, i) => (
                  <span key={i} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: '#DCFCE7', color: '#166534' }}>
                    ✓ {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => { setShowNewPedido(true); setPedidoForm({ ...pedidoForm, categoria: selectedArtisan.especialidade }) }}
                style={{ padding: '12px 24px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                📝 Pedir orçamento
              </button>
              <button
                onClick={() => toggleFavorito(selectedArtisan.id)}
                style={{ padding: '12px 24px', border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                {favoritos.includes(selectedArtisan.id) ? '❤️ Remover favorito' : '🤍 Adicionar favorito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: PEDIDOS ═══ */}
      {tab === 'pedidos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={() => setShowNewPedido(true)}
              style={{ padding: '10px 20px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              + Novo pedido de orçamento
            </button>
          </div>

          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <div>Nenhum pedido de orçamento</div>
            </div>
          ) : (
            pedidos.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#0D1B2E' }}>{p.titulo}</div>
                    <div style={{ fontSize: 13, color: '#4A5E78', marginTop: 4 }}>
                      {CATEGORIAS_PT.find(c => c.id === p.categoria)?.emoji} {CATEGORIAS_PT.find(c => c.id === p.categoria)?.label}
                      {' · '}{p.immeubleNom || 'Sem edifício'}
                      {' · '}{new Date(p.dataCriacao).toLocaleDateString('pt-PT')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: p.status === 'aberto' ? '#DBEAFE' : p.status === 'adjudicado' ? '#DCFCE7' : '#F3F4F6',
                      color: p.status === 'aberto' ? '#1E40AF' : p.status === 'adjudicado' ? '#166534' : '#6B7280',
                    }}>
                      {p.status === 'aberto' ? '🔵 Aberto' : p.status === 'adjudicado' ? '✅ Adjudicado' : p.status}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: p.urgencia === 'emergencia' ? '#FEE2E2' : p.urgencia === 'urgente' ? '#FEF3C7' : '#F3F4F6',
                      color: p.urgencia === 'emergencia' ? '#991B1B' : p.urgencia === 'urgente' ? '#92400E' : '#6B7280',
                    }}>
                      {p.urgencia === 'emergencia' ? '🔴 Emergência' : p.urgencia === 'urgente' ? '🟡 Urgente' : '🟢 Normal'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>{p.descricao}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
                  📩 {p.propostas.length} propostas recebidas
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ TAB: AVALIAÇÕES ═══ */}
      {tab === 'avaliacoes' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>⭐ Top Profissionais por Avaliação</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...artisans].sort((a, b) => b.avaliacao - a.avaliacao).map((a, idx) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, border: '1px solid #E4DDD0', borderRadius: 10 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: idx === 0 ? '#C9A84C' : idx === 1 ? '#9CA3AF' : idx === 2 ? '#CD7F32' : '#E5E7EB',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#0D1B2E' }}>{a.nome} — {a.empresa}</div>
                  <div style={{ fontSize: 12, color: '#4A5E78' }}>
                    {CATEGORIAS_PT.find(c => c.id === a.especialidade)?.emoji} {CATEGORIAS_PT.find(c => c.id === a.especialidade)?.label} · {a.cidade}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#C9A84C', fontSize: 14 }}>{renderStars(a.avaliacao)}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{a.avaliacao} ({a.totalAvaliacoes})</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: FAVORITOS ═══ */}
      {tab === 'favoritos' && (
        <div>
          {favoritos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>❤️</div>
              <div>Nenhum favorito ainda</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Marque profissionais como favoritos para os encontrar rapidamente</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {artisans.filter(a => favoritos.includes(a.id)).map(a => {
                const catConfig = CATEGORIAS_PT.find(c => c.id === a.especialidade)
                return (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, cursor: 'pointer' }} onClick={() => { setSelectedArtisan(a); setTab('pesquisar') }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#0D1B2E' }}>{a.nome}</div>
                    <div style={{ fontSize: 13, color: '#4A5E78' }}>{a.empresa}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
                      <span>{catConfig?.emoji} {catConfig?.label}</span>
                      <span style={{ color: '#C9A84C' }}>{renderStars(a.avaliacao)} {a.avaliacao}</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorito(a.id) }}
                      style={{ marginTop: 8, padding: '4px 12px', border: '1px solid #FCA5A5', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer' }}
                    >
                      ❌ Remover
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ MODAL: NOVO PEDIDO ═══ */}
      {showNewPedido && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: '#0D1B2E' }}>📝 Novo Pedido de Orçamento</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Título</label>
                <input
                  value={pedidoForm.titulo}
                  onChange={e => setPedidoForm({ ...pedidoForm, titulo: e.target.value })}
                  placeholder="Ex: Reparação canalização cave"
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
                <textarea
                  value={pedidoForm.descricao}
                  onChange={e => setPedidoForm({ ...pedidoForm, descricao: e.target.value })}
                  placeholder="Descreva o trabalho necessário..."
                  rows={4}
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Categoria</label>
                  <select
                    value={pedidoForm.categoria}
                    onChange={e => setPedidoForm({ ...pedidoForm, categoria: e.target.value })}
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIAS_PT.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Urgência</label>
                  <select
                    value={pedidoForm.urgencia}
                    onChange={e => setPedidoForm({ ...pedidoForm, urgencia: e.target.value as any })}
                    style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                  >
                    <option value="normal">🟢 Normal</option>
                    <option value="urgente">🟡 Urgente</option>
                    <option value="emergencia">🔴 Emergência</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Edifício</label>
                <input
                  value={pedidoForm.immeubleNom}
                  onChange={e => setPedidoForm({ ...pedidoForm, immeubleNom: e.target.value })}
                  placeholder="Nome do edifício"
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Data limite</label>
                <input
                  type="date"
                  value={pedidoForm.dataLimite}
                  onChange={e => setPedidoForm({ ...pedidoForm, dataLimite: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #E4DDD0', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowNewPedido(false)} style={{ flex: 1, padding: 12, border: '1px solid #E4DDD0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={createPedido}
                disabled={!pedidoForm.titulo || !pedidoForm.categoria}
                style={{ flex: 1, padding: 12, background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                ✅ Publicar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
