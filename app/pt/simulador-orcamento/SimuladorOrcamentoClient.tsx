'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { PHONE_PT } from '@/lib/constants'

const SERVICE_KEYWORDS_PT: Record<string, { name: string; icon: string; slug: string; keywords: string[] }> = {
  canalizador: {
    slug: 'canalizador', name: 'Canalização', icon: '🔧',
    keywords: ['fuga', 'água', 'canalização', 'torneira', 'cano', 'wc', 'sanita', 'esquentador', 'desentupimento', 'tubo', 'sanitário', 'canalizador', 'duche', 'banheira', 'lavatório', 'sifão'],
  },
  eletricista: {
    slug: 'eletricista', name: 'Eletricidade', icon: '⚡',
    keywords: ['eletricidade', 'tomada', 'quadro', 'disjuntor', 'cabo', 'iluminação', 'luz', 'eletricista', 'corrente', 'avaria', 'curto-circuito', 'interruptor', 'instalação elétrica'],
  },
  serralheiro: {
    slug: 'serralheiro', name: 'Serralharia', icon: '🔩',
    keywords: ['serralheiro', 'ferro', 'alumínio', 'grade', 'portão', 'varanda', 'escada', 'corrimão', 'soldadura', 'inox'],
  },
  pintor: {
    slug: 'pintor', name: 'Pintura', icon: '🎨',
    keywords: ['pintura', 'pintar', 'fachada', 'parede', 'teto', 'pintor', 'tinta', 'verniz', 'estuque', 'reboco'],
  },
  telhador: {
    slug: 'telhador', name: 'Telhados', icon: '🏠',
    keywords: ['telhado', 'telha', 'cobertura', 'infiltração', 'caleira', 'impermeabilização', 'goteira', 'chaminé'],
  },
  pedreiro: {
    slug: 'pedreiro', name: 'Alvenaria', icon: '🧱',
    keywords: ['pedreiro', 'alvenaria', 'betão', 'muro', 'parede', 'reboco', 'cimento', 'construção', 'tijolo', 'fissura'],
  },
  carpinteiro: {
    slug: 'carpinteiro', name: 'Carpintaria', icon: '🪚',
    keywords: ['carpinteiro', 'madeira', 'porta', 'janela', 'armário', 'cozinha', 'soalho', 'deck', 'móvel'],
  },
  climatizacao: {
    slug: 'ar-condicionado', name: 'Climatização', icon: '❄️',
    keywords: ['ar condicionado', 'climatização', 'split', 'bomba calor', 'aquecimento', 'ventilação', 'ar-condicionado'],
  },
  remodelacao: {
    slug: 'obras-remodelacao', name: 'Remodelação', icon: '🏡',
    keywords: ['remodelação', 'renovação', 'obra', 'remodelações', 'reabilitação', 'reforma', 'casa banho', 'cozinha nova'],
  },
  desentupimento: {
    slug: 'desentupimento', name: 'Desentupimento', icon: '🚿',
    keywords: ['desentupimento', 'entupido', 'esgoto', 'fossa', 'cano entupido', 'sanita entupida', 'ralo'],
  },
}

const SERVICE_PRICES_PT: Record<string, { label: string; detail: string; color: string }> = {
  canalizador:     { label: '40 € – 200 €', detail: 'por intervenção simples', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  eletricista:     { label: '50 € – 300 €', detail: 'segundo tipo de trabalho', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  serralheiro:     { label: '80 € – 500 €', detail: 'fabricação + montagem', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  pintor:          { label: '8 € – 25 €/m²', detail: 'mão de obra', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  telhador:        { label: '150 € – 600 €', detail: 'reparação / limpeza', color: 'bg-stone-50 text-stone-700 border-stone-200' },
  pedreiro:        { label: '40 € – 2.000 €', detail: 'segundo dimensão', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  carpinteiro:     { label: '60 € – 400 €', detail: 'por intervenção', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'ar-condicionado': { label: '600 € – 3.000 €', detail: 'fornecimento + instalação', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'obras-remodelacao': { label: '200 € – 15.000 €', detail: 'segundo dimensão da obra', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  desentupimento:  { label: '60 € – 250 €', detail: 'urgência incluída', color: 'bg-red-50 text-red-700 border-red-200' },
}

const PT_CITIES = [
  'Marco de Canaveses', 'Penafiel', 'Amarante', 'Baião', 'Felgueiras',
  'Lousada', 'Paços de Ferreira', 'Paredes', 'Porto', 'Vila Nova de Gaia',
  'Braga', 'Maia',
]

const EXAMPLE_SEARCHES_PT = [
  'Tenho uma fuga de água na casa de banho em Marco de Canaveses',
  'Preciso de eletricista para mudar o quadro elétrico em Penafiel',
  'Pintura do apartamento T3 no Porto',
  'Desentupimento urgente em Braga',
  'Remodelação de cozinha em Amarante',
  'Instalação de ar condicionado em Vila Nova de Gaia',
]

function detectService(text: string): string | null {
  const lower = text.toLowerCase()
  let best: string | null = null
  let bestScore = 0
  for (const [key, config] of Object.entries(SERVICE_KEYWORDS_PT)) {
    const score = config.keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; best = key }
  }
  return bestScore > 0 ? best : null
}

function detectCity(text: string): string | null {
  const lower = text.toLowerCase()
  for (const city of PT_CITIES) {
    if (lower.includes(city.toLowerCase())) return city
  }
  return null
}

export default function SimuladorOrcamentoClient() {
  const [query, setQuery] = useState('')
  const [detectedService, setDetectedService] = useState<string | null>(null)
  const [detectedCity, setDetectedCity] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [searched, setSearched] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = setInterval(() => setExampleIdx(i => (i + 1) % EXAMPLE_SEARCHES_PT.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const full = query + (cityInput ? ` em ${cityInput}` : '')
    setDetectedService(detectService(full))
    const city = detectCity(full) || cityInput
    if (city) setDetectedCity(city)
  }, [query, cityInput])

  const handleSearch = () => {
    if (!query.trim() && !cityInput.trim()) return
    setSearched(true)
  }

  const handleExample = (ex: string) => {
    setQuery(ex)
    const svc = detectService(ex)
    const city = detectCity(ex)
    setDetectedService(svc)
    if (city) { setDetectedCity(city); setCityInput(city) }
    inputRef.current?.focus()
  }

  const reset = () => {
    setQuery('')
    setDetectedService(null)
    setDetectedCity('')
    setCityInput('')
    setSearched(false)
  }

  const svcConfig = detectedService ? SERVICE_KEYWORDS_PT[detectedService] : null
  const priceInfo = svcConfig ? (SERVICE_PRICES_PT[svcConfig.slug] ?? SERVICE_PRICES_PT[detectedService!] ?? null) : null

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* Hero */}
      <div className="bg-dark text-white pt-14 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-yellow/20 text-yellow rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            🧮 Gratuito · Resultado instantâneo
          </div>
          <h1 className="font-display text-[clamp(1.7rem,4vw,2.8rem)] font-extrabold tracking-tight mb-3">
            Descreva as suas obras, encontre o profissional
          </h1>
          <p className="text-white/60 text-base max-w-lg mx-auto">
            Escreva o que precisa em linguagem natural. Detetamos o serviço, a cidade e os preços em tempo real.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-border p-4 space-y-3">
          <textarea
            ref={inputRef}
            rows={2}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch() } }}
            placeholder={EXAMPLE_SEARCHES_PT[exampleIdx]}
            className="w-full resize-none border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow placeholder:text-text-muted/60 transition-colors"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">📍</span>
              <input
                type="text"
                placeholder="A sua cidade (ex: Marco de Canaveses)"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                className="w-full border border-border rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-yellow"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim() && !cityInput.trim()}
              className="bg-yellow text-dark font-bold rounded-xl px-6 py-3 text-sm hover:bg-yellow/80 transition-colors disabled:opacity-40 flex items-center gap-2 shrink-0"
            >
              🔍 Procurar
            </button>
          </div>

          {(svcConfig || detectedCity) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {svcConfig && (
                <span className="inline-flex items-center gap-1.5 bg-dark/5 text-dark rounded-full px-3 py-1 text-xs font-semibold">
                  {svcConfig.icon} {svcConfig.name} detetado
                </span>
              )}
              {detectedCity && (
                <span className="inline-flex items-center gap-1.5 bg-yellow/20 text-dark rounded-full px-3 py-1 text-xs font-semibold">
                  📍 {detectedCity}
                </span>
              )}
              {priceInfo && (
                <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-semibold ${priceInfo.color}`}>
                  💰 {priceInfo.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Examples */}
      {!searched && (
        <div className="max-w-3xl mx-auto px-4 mt-8">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">Exemplos de pedidos</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SEARCHES_PT.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExample(ex)}
                className="text-xs bg-white border border-border rounded-full px-4 py-2 text-text-muted hover:border-yellow hover:text-dark transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="max-w-3xl mx-auto px-4 mt-8 pb-16 space-y-6">
          {priceInfo && svcConfig && (
            <div className={`rounded-2xl border p-5 flex items-start gap-4 ${priceInfo.color}`}>
              <span className="text-3xl">{svcConfig.icon}</span>
              <div>
                <p className="font-bold text-base">{svcConfig.name} · preço indicativo Portugal 2026</p>
                <p className="text-2xl font-extrabold mt-0.5">{priceInfo.label}</p>
                <p className="text-xs opacity-70 mt-1">{priceInfo.detail} · Orçamento gratuito confirmado pelo profissional</p>
              </div>
            </div>
          )}

          <div className="bg-dark rounded-2xl p-6 text-center text-white">
            <p className="font-bold text-lg mb-1">Encontrar um profissional verificado VITFIX</p>
            <p className="text-white/60 text-sm mb-4">Profissionais certificados, preços transparentes, reserva direta.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/pesquisar${detectedCity ? `?loc=${encodeURIComponent(detectedCity)}` : ''}${svcConfig ? `&cat=${svcConfig.slug}` : ''}`}
                className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-bold rounded-full px-7 py-3 text-sm hover:bg-yellow/80 transition-colors"
              >
                🔍 Ver profissionais disponíveis
              </Link>
              <a
                href={`https://wa.me/${PHONE_PT.replace('+', '')}?text=${encodeURIComponent(`Olá VITFIX! Preciso de um profissional${query ? ` para: ${query}` : ''}${detectedCity ? ` em ${detectedCity}` : ''}. Podem ajudar?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold rounded-full px-7 py-3 text-sm hover:bg-[#20ba59] transition-colors"
              >
                💬 WhatsApp VITFIX
              </a>
            </div>
            <button onClick={reset} className="mt-3 text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors">
              Nova pesquisa
            </button>
          </div>

          <p className="text-xs text-text-muted text-center max-w-md mx-auto">
            Os preços apresentados são indicativos, baseados nas médias Portugal 2026. O orçamento definitivo é confirmado gratuitamente pelo profissional após visita.
          </p>
        </div>
      )}

      {/* City links */}
      {!searched && (
        <div className="max-w-3xl mx-auto px-4 mt-12 pb-16">
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-4">Simulador disponível em toda a região Norte</p>
          <div className="flex flex-wrap gap-2">
            {PT_CITIES.map(city => {
              const slug = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-')
              return (
                <Link
                  key={slug}
                  href={`/pt/cidade/${slug}/`}
                  className="text-xs bg-white border border-border rounded-full px-3 py-1.5 text-text-muted hover:border-yellow hover:text-dark transition-colors"
                >
                  {city}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
