'use client'

import { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClasseSCE = 'A+' | 'A' | 'B' | 'B-' | 'C' | 'D' | 'E' | 'F'

interface CertificadoEnergetico {
  id: string
  edificioNom: string
  edificioMorada: string
  nbFracoes: number
  classeSCE: ClasseSCE
  consumoKWh: number
  emissoesCO2: number
  dataCertificado: string
  dataExpiracao: string
  perito: string
  numeroCertificado: string
  recomendacoes: string
  notas?: string
  createdAt: string
  updatedAt: string
}

// ─── Config SCE ───────────────────────────────────────────────────────────────

const CLASSE_CONFIG: Record<ClasseSCE, { label: string; bg: string; text: string; kwh: string }> = {
  'A+': { label: 'A+', bg: 'bg-[#006837]', text: 'text-white', kwh: '≤ 25' },
  'A':  { label: 'A',  bg: 'bg-[#009a6e]', text: 'text-white', kwh: '26-50' },
  'B':  { label: 'B',  bg: 'bg-[#51b84b]', text: 'text-white', kwh: '51-75' },
  'B-': { label: 'B-', bg: 'bg-[#abce50]', text: 'text-white', kwh: '76-100' },
  'C':  { label: 'C',  bg: 'bg-[#f7e64b]', text: 'text-gray-800', kwh: '101-150' },
  'D':  { label: 'D',  bg: 'bg-[#f0b429]', text: 'text-white', kwh: '151-200' },
  'E':  { label: 'E',  bg: 'bg-[#e8731a]', text: 'text-white', kwh: '201-250' },
  'F':  { label: 'F',  bg: 'bg-[#d9231e]', text: 'text-white', kwh: '> 250' },
}

const CLASSES: ClasseSCE[] = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F']

const diasRestantes = (dataStr: string) => Math.ceil((new Date(dataStr).getTime() - Date.now()) / 86400000)
const formatDate = (s: string) => { try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) } catch { return s } }

function ClasseBadge({ classe, size = 'md' }: { classe: ClasseSCE; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = CLASSE_CONFIG[classe]
  const sizeClass = size === 'sm' ? 'w-8 h-7 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl font-black' : 'w-10 h-10 text-sm font-bold'
  return <div className={`${cfg.bg} ${cfg.text} ${sizeClass} rounded-lg flex items-center justify-center font-bold shadow-sm`}>{classe}</div>
}

function EscalaSCE({ classe }: { classe: ClasseSCE }) {
  return (
    <div className="flex flex-col gap-0.5">
      {CLASSES.map(c => (
        <div key={c} className={`flex items-center gap-1.5 ${c === classe ? 'opacity-100' : 'opacity-25'}`}>
          <div className={`${CLASSE_CONFIG[c].bg} ${CLASSE_CONFIG[c].text} text-[10px] font-bold w-6 h-4 flex items-center justify-center rounded-sm`}>{c}</div>
          <div className={`${CLASSE_CONFIG[c].bg} rounded-r-sm h-4`} style={{ width: `${(CLASSES.indexOf(c) + 1) * 8 + 10}px` }} />
          {c === classe && <span className="text-[10px] font-bold text-gray-700">◀ {CLASSE_CONFIG[c].kwh} kWh/m²/ano</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function CertificacaoEnergeticaSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_sce_${user.id}`

  const [certs, setCerts] = useState<CertificadoEnergetico[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CertificadoEnergetico | null>(null)
  const [selected, setSelected] = useState<CertificadoEnergetico | null>(null)
  const [form, setForm] = useState<Partial<CertificadoEnergetico>>({ classeSCE: 'C' })

  useEffect(() => {
    try { setCerts(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: CertificadoEnergetico[]) => { setCerts(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) }

  const openCreate = () => { setEditing(null); setForm({ classeSCE: 'C', nbFracoes: 10 }); setShowModal(true) }
  const openEdit = (c: CertificadoEnergetico) => { setEditing(c); setForm({ ...c }); setShowModal(true) }

  const handleSave = () => {
    if (!form.edificioNom || !form.classeSCE || !form.dataCertificado) return
    const now = new Date().toISOString()
    if (editing) {
      save(certs.map(c => c.id === editing.id ? { ...editing, ...form, updatedAt: now } as CertificadoEnergetico : c))
    } else {
      save([...certs, { id: crypto.randomUUID(), edificioNom: form.edificioNom!, edificioMorada: form.edificioMorada || '', nbFracoes: form.nbFracoes || 1, classeSCE: form.classeSCE!, consumoKWh: form.consumoKWh || 0, emissoesCO2: form.emissoesCO2 || 0, dataCertificado: form.dataCertificado!, dataExpiracao: form.dataExpiracao || '', perito: form.perito || '', numeroCertificado: form.numeroCertificado || '', recomendacoes: form.recomendacoes || '', notas: form.notas, createdAt: now, updatedAt: now } as CertificadoEnergetico])
    }
    setShowModal(false); setEditing(null)
  }

  const stats = useMemo(() => ({
    total: certs.length,
    eficientes: certs.filter(c => ['A+', 'A', 'B', 'B-'].includes(c.classeSCE)).length,
    ineficientes: certs.filter(c => ['E', 'F'].includes(c.classeSCE)).length,
    expirados: certs.filter(c => c.dataExpiracao && diasRestantes(c.dataExpiracao) < 0).length,
    aRenovar: certs.filter(c => c.dataExpiracao && diasRestantes(c.dataExpiracao) >= 0 && diasRestantes(c.dataExpiracao) <= 365).length,
  }), [certs])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚡ Certificação Energética</h1>
          <p className="text-sm text-gray-500 mt-0.5">SCE — DL 101-D/2020 · EPBD 2024 · Classes A+ a F</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Adicionar certificado</button>
      </div>

      <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-emerald-800 text-sm">Sistema de Certificação Energética (SCE) — DL 101-D/2020</p>
          <p className="text-emerald-700 text-sm mt-0.5">
            O certificado energético é obrigatório para todos os edifícios. Validade de 10 anos.
            Diretiva EPBD 2024: todos os edifícios devem atingir classe E até 2030 e classe D até 2033.
            Frações classe F ficam impedidas de arrendamento (MEPS).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Certificados', value: stats.total, color: 'text-gray-900' },
          { label: 'Eficientes (A+ a B-)', value: stats.eficientes, color: 'text-green-600' },
          { label: 'Ineficientes (E & F)', value: stats.ineficientes, color: stats.ineficientes > 0 ? 'text-red-600 font-black' : 'text-gray-900' },
          { label: 'Expirados', value: stats.expirados, color: stats.expirados > 0 ? 'text-red-600' : 'text-gray-900' },
          { label: 'A renovar <1 ano', value: stats.aRenovar, color: stats.aRenovar > 0 ? 'text-orange-600' : 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {stats.expirados > 0 && <div className="mb-4 bg-red-100 border border-red-300 rounded-xl p-3 flex items-center gap-2"><span>🔴</span><p className="text-sm text-red-700 font-semibold">{stats.expirados} certificado{stats.expirados > 1 ? 's' : ''} expirado{stats.expirados > 1 ? 's' : ''} — Ação imediata necessária</p></div>}

      {certs.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum certificado registado</h3>
          <p className="text-gray-400 text-sm mb-6">Comece por registar o certificado energético dos seus edifícios.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Adicionar certificado</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {certs.map(cert => {
            const diasExp = cert.dataExpiracao ? diasRestantes(cert.dataExpiracao) : null
            const expirado = diasExp !== null && diasExp < 0
            const brevemente = diasExp !== null && diasExp >= 0 && diasExp <= 365
            return (
              <div key={cert.id} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer ${expirado ? 'border-red-200' : brevemente ? 'border-orange-200' : 'border-gray-200'}`} onClick={() => setSelected(s => s?.id === cert.id ? null : cert)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{cert.edificioNom}</h3>
                    {cert.edificioMorada && <p className="text-xs text-gray-400 truncate">{cert.edificioMorada}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{cert.nbFracoes} frações</p>
                  </div>
                  <div className="flex-shrink-0 ml-3"><ClasseBadge classe={cert.classeSCE} size="lg" /></div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div><p className="text-xs text-gray-400">Consumo energia</p><p className="font-bold text-gray-900">{cert.consumoKWh > 0 ? `${cert.consumoKWh} kWh/m²/ano` : '—'}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-400">Emissões CO₂</p><p className="font-bold text-gray-900">{cert.emissoesCO2 > 0 ? `${cert.emissoesCO2} kgCO₂/m²/ano` : '—'}</p></div>
                </div>
                {cert.dataExpiracao && (
                  <div className={`mb-3 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium ${expirado ? 'bg-red-100 text-red-700' : brevemente ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                    <span>{expirado ? '🔴' : brevemente ? '🟠' : '✅'}</span>
                    {expirado ? `Expirado há ${Math.abs(diasExp!)} dias` : brevemente ? `Expira em ${diasExp} dias` : `Válido até ${formatDate(cert.dataExpiracao)}`}
                  </div>
                )}
                {cert.perito && <p className="text-xs text-gray-400 mb-3">Perito: {cert.perito}</p>}
                {selected?.id === cert.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3" onClick={e => e.stopPropagation()}>
                    <EscalaSCE classe={cert.classeSCE} />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Data certificado</span><p className="font-semibold">{formatDate(cert.dataCertificado)}</p></div>
                      <div><span className="text-gray-400">N.º certificado</span><p className="font-semibold">{cert.numeroCertificado || '—'}</p></div>
                    </div>
                    {cert.recomendacoes && <div className="bg-blue-50 rounded-xl p-3"><p className="text-xs font-semibold text-blue-700 mb-1">💡 Recomendações</p><p className="text-xs text-blue-800">{cert.recomendacoes}</p></div>}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSelected(s => s?.id === cert.id ? null : cert)} className="flex-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors">{selected?.id === cert.id ? '▲ Reduzir' : '▼ Detalhe'}</button>
                  <button onClick={() => openEdit(cert)} className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition-colors">✏️</button>
                  <button onClick={() => { if (confirm('Eliminar este certificado?')) save(certs.filter(c => c.id !== cert.id)) }} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">{editing ? '✏️ Modificar' : '+ Novo Certificado Energético'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Edifício</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Nome *</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Edifício Sol Nascente" value={form.edificioNom || ''} onChange={e => setForm({ ...form, edificioNom: e.target.value })} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Morada</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.edificioMorada || ''} onChange={e => setForm({ ...form, edificioMorada: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Frações</label><input type="number" min={1} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nbFracoes || ''} onChange={e => setForm({ ...form, nbFracoes: parseInt(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">N.º Certificado</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.numeroCertificado || ''} onChange={e => setForm({ ...form, numeroCertificado: e.target.value })} /></div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ Classe SCE *</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {CLASSES.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, classeSCE: c })} className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${CLASSE_CONFIG[c].bg} ${CLASSE_CONFIG[c].text} ${form.classeSCE === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'opacity-40 hover:opacity-80'}`}>{c}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Consumo (kWh/m²/ano)</label><input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.consumoKWh || ''} onChange={e => setForm({ ...form, consumoKWh: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Emissões (kgCO₂/m²/ano)</label><input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.emissoesCO2 || ''} onChange={e => setForm({ ...form, emissoesCO2: parseFloat(e.target.value) || 0 })} /></div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📅 Datas</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Data do certificado *</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dataCertificado || ''} onChange={e => setForm({ ...form, dataCertificado: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Data de expiração</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dataExpiracao || ''} onChange={e => setForm({ ...form, dataExpiracao: e.target.value })} /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Perito qualificado</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome do perito" value={form.perito || ''} onChange={e => setForm({ ...form, perito: e.target.value })} /></div>
                </div>
              </section>
              <section><label className="text-xs text-gray-500 mb-1 block">Recomendações de obras</label><textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Isolamento cobertura, substituição caldeira, painéis solares..." value={form.recomendacoes || ''} onChange={e => setForm({ ...form, recomendacoes: e.target.value })} /></section>
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={!form.edificioNom || !form.classeSCE || !form.dataCertificado} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">{editing ? '💾 Guardar' : '✅ Criar certificado'}</button>
                <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
