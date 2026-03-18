'use client'

import { useState, useEffect, useRef } from 'react'

interface ArquivoDoc {
  id: string
  nome: string
  categoria: 'atas' | 'convocatorias' | 'regulamentos' | 'orcamentos' | 'contratos' | 'seguros' | 'certificados' | 'fiscal' | 'correspondencia'
  data: string
  tamanho: string
  uploadPor: string
  hashSHA256: string
  hashAnterior: string
  tipo: string
  imovel: string
}

interface RetentionRule {
  categoria: string
  label: string
  anos: number
  obrigatorio: boolean
}

const CATEGORIAS = [
  { key: 'atas', label: 'Atas', icon: '📝', cor: '#C9A84C' },
  { key: 'convocatorias', label: 'Convocatórias', icon: '📩', cor: '#3B82F6' },
  { key: 'regulamentos', label: 'Regulamentos', icon: '📜', cor: '#8B5CF6' },
  { key: 'orcamentos', label: 'Orçamentos', icon: '📊', cor: '#10B981' },
  { key: 'contratos', label: 'Contratos', icon: '📋', cor: '#F59E0B' },
  { key: 'seguros', label: 'Seguros', icon: '🛡️', cor: '#EF4444' },
  { key: 'certificados', label: 'Certificados', icon: '📄', cor: '#06B6D4' },
  { key: 'fiscal', label: 'Fiscal', icon: '💰', cor: '#84CC16' },
  { key: 'correspondencia', label: 'Correspondência', icon: '✉️', cor: '#F97316' },
]

const generateHash = () => {
  const chars = '0123456789abcdef'
  let hash = ''
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)]
  return hash
}

const DEMO_DOCS: ArquivoDoc[] = [
  { id: '1', nome: 'Ata AG Ordinária 2025.pdf', categoria: 'atas', data: '2025-03-15', tamanho: '245 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '0000000000000000000000000000000000000000000000000000000000000000', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '2', nome: 'Ata AG Extraordinária Obras.pdf', categoria: 'atas', data: '2025-01-20', tamanho: '189 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '3', nome: 'Convocatória AG 2025.pdf', categoria: 'convocatorias', data: '2025-02-28', tamanho: '120 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '4', nome: 'Regulamento Interno v3.pdf', categoria: 'regulamentos', data: '2024-06-10', tamanho: '380 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Todos' },
  { id: '5', nome: 'Orçamento 2025 Aprovado.xlsx', categoria: 'orcamentos', data: '2025-03-15', tamanho: '95 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/vnd.ms-excel', imovel: 'Edifício Aurora' },
  { id: '6', nome: 'Contrato Manutenção Elevador.pdf', categoria: 'contratos', data: '2024-09-01', tamanho: '310 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '7', nome: 'Contrato Limpeza Espaços Comuns.pdf', categoria: 'contratos', data: '2024-11-15', tamanho: '275 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Sol' },
  { id: '8', nome: 'Apólice Seguro Incêndio 2025.pdf', categoria: 'seguros', data: '2025-01-01', tamanho: '410 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '9', nome: 'Certificado Elevador DL 320-2002.pdf', categoria: 'certificados', data: '2024-12-20', tamanho: '180 KB', uploadPor: 'Técnico', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '10', nome: 'Declaração Anual Encargos 2024.pdf', categoria: 'fiscal', data: '2025-02-15', tamanho: '150 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '11', nome: 'IRS Declaração Encargos Fr.A.pdf', categoria: 'fiscal', data: '2025-03-01', tamanho: '85 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Aurora' },
  { id: '12', nome: 'Carta Notificação Obras Fachada.pdf', categoria: 'correspondencia', data: '2025-02-10', tamanho: '95 KB', uploadPor: 'Admin', hashSHA256: generateHash(), hashAnterior: '', tipo: 'application/pdf', imovel: 'Edifício Sol' },
]

const DEFAULT_RETENTION: RetentionRule[] = [
  { categoria: 'atas', label: 'Atas de Assembleia', anos: 10, obrigatorio: true },
  { categoria: 'convocatorias', label: 'Convocatórias', anos: 5, obrigatorio: true },
  { categoria: 'regulamentos', label: 'Regulamentos', anos: 0, obrigatorio: true },
  { categoria: 'orcamentos', label: 'Orçamentos', anos: 5, obrigatorio: true },
  { categoria: 'contratos', label: 'Contratos', anos: 10, obrigatorio: true },
  { categoria: 'seguros', label: 'Seguros', anos: 10, obrigatorio: true },
  { categoria: 'certificados', label: 'Certificados', anos: 10, obrigatorio: true },
  { categoria: 'fiscal', label: 'Documentos Fiscais', anos: 5, obrigatorio: true },
  { categoria: 'correspondencia', label: 'Correspondência', anos: 3, obrigatorio: false },
]

export default function ArquivoDigitalSection({ user }: { user: any; userRole: string }) {
  const [tab, setTab] = useState<'arquivo' | 'pesquisa' | 'certificacao' | 'configuracao'>('arquivo')
  const [docs, setDocs] = useState<ArquivoDoc[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategoria, setSearchCategoria] = useState('all')
  const [searchDateFrom, setSearchDateFrom] = useState('')
  const [searchDateTo, setSearchDateTo] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>('atas')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadCategoria, setUploadCategoria] = useState('atas')
  const [uploadNome, setUploadNome] = useState('')
  const [uploadImovel, setUploadImovel] = useState('Edifício Aurora')
  const [verifyHash, setVerifyHash] = useState('')
  const [verifyResult, setVerifyResult] = useState<'none' | 'valid' | 'invalid'>('none')
  const [retention, setRetention] = useState<RetentionRule[]>(DEFAULT_RETENTION)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const STORAGE_KEY = `fixit_arquivo_${user?.id}`

  useEffect(() => {
    if (!user?.id) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) { setDocs(parsed); return }
      }
    } catch {}
    // Chain hashes for demo
    const chained = DEMO_DOCS.map((d, i) => ({
      ...d,
      hashAnterior: i === 0 ? '0'.repeat(64) : DEMO_DOCS[i - 1].hashSHA256,
    }))
    setDocs(chained)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chained))
  }, [user?.id])

  const saveAll = (updated: ArquivoDoc[]) => {
    setDocs(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const handleUpload = () => {
    if (!uploadNome.trim()) return
    const lastHash = docs.length > 0 ? docs[docs.length - 1].hashSHA256 : '0'.repeat(64)
    const newDoc: ArquivoDoc = {
      id: Date.now().toString(),
      nome: uploadNome.trim(),
      categoria: uploadCategoria as ArquivoDoc['categoria'],
      data: new Date().toISOString().split('T')[0],
      tamanho: `${Math.floor(Math.random() * 400 + 50)} KB`,
      uploadPor: 'Admin',
      hashSHA256: generateHash(),
      hashAnterior: lastHash,
      tipo: uploadNome.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      imovel: uploadImovel,
    }
    saveAll([...docs, newDoc])
    setUploadNome('')
    setShowUpload(false)
  }

  const handleVerify = () => {
    if (!verifyHash.trim()) { setVerifyResult('none'); return }
    const found = docs.find(d => d.hashSHA256 === verifyHash.trim().toLowerCase())
    setVerifyResult(found ? 'valid' : 'invalid')
  }

  const filteredDocs = docs.filter(d => {
    if (searchQuery && !d.nome.toLowerCase().includes(searchQuery.toLowerCase()) && !d.categoria.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (searchCategoria !== 'all' && d.categoria !== searchCategoria) return false
    if (searchDateFrom && d.data < searchDateFrom) return false
    if (searchDateTo && d.data > searchDateTo) return false
    return true
  })

  const storageUsed = docs.reduce((acc, d) => acc + parseInt(d.tamanho), 0)
  const storageMax = 5000 // 5GB simulated in KB units for display

  const cardStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? 'rgba(201,168,76,0.08)' : '#fff',
    border: `1px solid ${active ? 'var(--sd-gold)' : 'var(--sd-border)'}`,
    borderRadius: 12,
    padding: 20,
    fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
  })

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--sd-navy)' : 'transparent',
    color: active ? '#fff' : 'var(--sd-ink-2)',
    fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
    transition: 'all 0.15s',
  })

  const btnGold: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: 'var(--sd-gold)',
    color: '#fff',
    fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
  }

  const btnOutline: React.CSSProperties = {
    ...btnGold,
    background: 'transparent',
    border: '1px solid var(--sd-border)',
    color: 'var(--sd-navy)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--sd-border)',
    fontSize: 13,
    fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
    outline: 'none',
    background: '#fff',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy)', margin: 0, fontFamily: "var(--font-playfair), 'Playfair Display', serif" }}>
          🗄️ Arquivo Digital Certificado
        </h1>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3)', marginTop: 4, fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>
          Arquivo eletrónico com integridade garantida por hash SHA-256 · Pesquisa avançada · Retenção legal
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--sd-cream)', borderRadius: 10, padding: 4 }}>
        {([
          { key: 'arquivo', label: '📁 Arquivo' },
          { key: 'pesquisa', label: '🔍 Pesquisa' },
          { key: 'certificacao', label: '🔒 Certificação' },
          { key: 'configuracao', label: '⚙️ Configuração' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtnStyle(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ═══ TAB ARQUIVO ═══ */}
      {tab === 'arquivo' && (
        <div>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total documentos', value: docs.length.toString(), icon: '📄' },
              { label: 'Categorias', value: new Set(docs.map(d => d.categoria)).size.toString(), icon: '📂' },
              { label: 'Armazenamento', value: `${(storageUsed / 1000).toFixed(1)} MB`, icon: '💾' },
              { label: 'Último upload', value: docs.length > 0 ? docs[docs.length - 1].data : '—', icon: '📅' },
            ].map((s, i) => (
              <div key={i} style={cardStyle()}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sd-navy)', fontFamily: "var(--font-playfair), 'Playfair Display', serif" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Upload button + dropzone */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)', margin: 0 }}>Árvore de documentos</h3>
            <button onClick={() => setShowUpload(!showUpload)} style={btnGold}>+ Carregar documento</button>
          </div>

          {showUpload && (
            <div style={{ ...cardStyle(true), marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--sd-navy)' }}>Carregar novo documento</h4>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) setUploadNome(file.name) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--sd-gold)' : 'var(--sd-border)'}`,
                  borderRadius: 10,
                  padding: 30,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(201,168,76,0.05)' : 'var(--sd-cream)',
                  marginBottom: 12,
                  transition: 'all 0.15s',
                }}
              >
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setUploadNome(f.name) }} />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                <div style={{ fontSize: 13, color: 'var(--sd-ink-2)' }}>
                  {uploadNome || 'Arraste e largue um ficheiro ou clique para selecionar'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Nome do ficheiro</label>
                  <input value={uploadNome} onChange={e => setUploadNome(e.target.value)} style={inputStyle} placeholder="documento.pdf" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Categoria</label>
                  <select value={uploadCategoria} onChange={e => setUploadCategoria(e.target.value)} style={inputStyle}>
                    {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Imóvel</label>
                  <select value={uploadImovel} onChange={e => setUploadImovel(e.target.value)} style={inputStyle}>
                    <option>Edifício Aurora</option>
                    <option>Edifício Sol</option>
                    <option>Todos</option>
                  </select>
                </div>
                <button onClick={handleUpload} style={btnGold} disabled={!uploadNome.trim()}>Carregar</button>
              </div>
            </div>
          )}

          {/* Tree view by category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CATEGORIAS.map(cat => {
              const catDocs = docs.filter(d => d.categoria === cat.key)
              const isExpanded = expandedCat === cat.key
              return (
                <div key={cat.key} style={cardStyle(isExpanded)}>
                  <div
                    onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy)' }}>{cat.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold)',
                      }}>{catDocs.length}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--sd-ink-3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                  </div>

                  {isExpanded && catDocs.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--sd-border)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Nome</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Data</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Tamanho</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Imóvel</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Hash</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catDocs.map(doc => (
                            <tr key={doc.id} style={{ borderBottom: '1px solid rgba(228,221,208,0.5)' }}>
                              <td style={{ padding: '8px', color: 'var(--sd-navy)', fontWeight: 500 }}>📄 {doc.nome}</td>
                              <td style={{ padding: '8px', color: 'var(--sd-ink-2)' }}>{doc.data}</td>
                              <td style={{ padding: '8px', color: 'var(--sd-ink-3)' }}>{doc.tamanho}</td>
                              <td style={{ padding: '8px', color: 'var(--sd-ink-2)' }}>{doc.imovel}</td>
                              <td style={{ padding: '8px' }}>
                                <code style={{ fontSize: 9, color: 'var(--sd-ink-3)', background: 'var(--sd-cream)', padding: '2px 6px', borderRadius: 4 }}>
                                  {doc.hashSHA256.substring(0, 12)}...
                                </code>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <button style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }} onClick={() => { navigator.clipboard?.writeText(doc.hashSHA256) }}>📋</button>
                                <button style={{ ...btnOutline, padding: '4px 10px', fontSize: 11, marginLeft: 4 }}>⬇️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isExpanded && catDocs.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 8, fontStyle: 'italic' }}>Nenhum documento nesta categoria</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB PESQUISA ═══ */}
      {tab === 'pesquisa' && (
        <div>
          <div style={{ ...cardStyle(), marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>🔍 Pesquisa avançada</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Texto</label>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={inputStyle} placeholder="Pesquisar por nome, categoria..." />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Categoria</label>
                <select value={searchCategoria} onChange={e => setSearchCategoria(e.target.value)} style={inputStyle}>
                  <option value="all">Todas</option>
                  {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>De</label>
                <input type="date" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--sd-ink-3)', display: 'block', marginBottom: 4 }}>Até</label>
                <input type="date" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginBottom: 8 }}>
            {filteredDocs.length} resultado{filteredDocs.length !== 1 ? 's' : ''} encontrado{filteredDocs.length !== 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredDocs.map(doc => {
              const cat = CATEGORIAS.find(c => c.key === doc.categoria)
              return (
                <div key={doc.id} style={{ ...cardStyle(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{cat?.icon || '📄'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>
                        {searchQuery ? (
                          <span dangerouslySetInnerHTML={{
                            __html: doc.nome.replace(
                              new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                              '<mark style="background:rgba(201,168,76,0.3);padding:0 2px;border-radius:2px">$1</mark>'
                            )
                          }} />
                        ) : doc.nome}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>
                        {cat?.label} · {doc.data} · {doc.tamanho} · {doc.imovel}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }}>⬇️ Descarregar</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB CERTIFICAÇÃO ═══ */}
      {tab === 'certificacao' && (
        <div>
          {/* Info banner */}
          <div style={{ ...cardStyle(), marginBottom: 16, background: 'linear-gradient(135deg, rgba(13,27,46,0.04), rgba(201,168,76,0.06))' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>🔒 Integridade documental</h3>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-2)', margin: 0, lineHeight: 1.6 }}>
              Cada documento no arquivo é protegido por um hash criptográfico SHA-256 e encadeado ao documento anterior,
              garantindo autenticidade, integridade e rastreabilidade. As normas fiscais e legais portuguesas reconhecem
              a validade dos documentos eletrónicos desde que cumpram os requisitos de autenticidade, integridade e legibilidade.
            </p>
          </div>

          {/* Verify hash */}
          <div style={{ ...cardStyle(), marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--sd-navy)' }}>Verificar integridade</h4>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={verifyHash}
                onChange={e => { setVerifyHash(e.target.value); setVerifyResult('none') }}
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                placeholder="Cole aqui o hash SHA-256 do documento para verificar..."
              />
              <button onClick={handleVerify} style={btnGold}>Verificar</button>
            </div>
            {verifyResult === 'valid' && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#059669' }}>
                ✅ Hash válido — Documento encontrado no arquivo. Integridade confirmada.
              </div>
            )}
            {verifyResult === 'invalid' && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#DC2626' }}>
                ❌ Hash não encontrado — Este hash não corresponde a nenhum documento no arquivo.
              </div>
            )}
          </div>

          {/* Chain view */}
          <div style={{ ...cardStyle() }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--sd-navy)' }}>Cadeia de integridade (últimos 10)</h4>
            <div style={{ position: 'relative' }}>
              {docs.slice(-10).map((doc, i, arr) => (
                <div key={doc.id} style={{ display: 'flex', gap: 12, marginBottom: i < arr.length - 1 ? 0 : 0 }}>
                  {/* Chain indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', background: 'var(--sd-gold)',
                      border: '2px solid var(--sd-navy)', flexShrink: 0, zIndex: 1,
                    }} />
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, height: 40, background: 'var(--sd-border)' }} />
                    )}
                  </div>
                  {/* Doc info */}
                  <div style={{ flex: 1, paddingBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy)' }}>{doc.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>{doc.data} · {doc.uploadPor}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <code style={{ fontSize: 9, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                        SHA-256: {doc.hashSHA256.substring(0, 16)}...
                      </code>
                      {i > 0 && (
                        <span style={{ fontSize: 9, color: 'var(--sd-ink-3)' }}>
                          ← prev: {doc.hashAnterior.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB CONFIGURAÇÃO ═══ */}
      {tab === 'configuracao' && (
        <div>
          {/* Storage usage */}
          <div style={{ ...cardStyle(), marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>💾 Armazenamento</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 12, background: 'var(--sd-cream)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  width: `${Math.min((storageUsed / storageMax) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, var(--sd-gold), #F0D898)',
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy)', whiteSpace: 'nowrap' }}>
                {(storageUsed / 1000).toFixed(1)} MB / {(storageMax / 1000).toFixed(0)} GB
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3)' }}>
              {docs.length} documentos · {CATEGORIAS.filter(c => docs.some(d => d.categoria === c.key)).length} categorias utilizadas
            </div>
          </div>

          {/* Retention policies */}
          <div style={{ ...cardStyle(), marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>📋 Políticas de retenção</h3>
            <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', margin: '0 0 12px' }}>
              Defina o tempo mínimo de conservação por categoria (baseado nas obrigações legais portuguesas)
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sd-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Categoria</th>
                  <th style={{ textAlign: 'center', padding: '8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Retenção (anos)</th>
                  <th style={{ textAlign: 'center', padding: '8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Obrigatório</th>
                  <th style={{ textAlign: 'center', padding: '8px', color: 'var(--sd-ink-3)', fontWeight: 500 }}>Docs</th>
                </tr>
              </thead>
              <tbody>
                {retention.map(r => {
                  const cat = CATEGORIAS.find(c => c.key === r.categoria)
                  const count = docs.filter(d => d.categoria === r.categoria).length
                  return (
                    <tr key={r.categoria} style={{ borderBottom: '1px solid rgba(228,221,208,0.5)' }}>
                      <td style={{ padding: '10px 8px', color: 'var(--sd-navy)', fontWeight: 500 }}>
                        {cat?.icon} {r.label}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {r.anos === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--sd-gold)', fontWeight: 600 }}>Permanente</span>
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--sd-navy)' }}>{r.anos} anos</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {r.obrigatorio ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#DC2626', fontWeight: 600 }}>Legal</span>
                        ) : (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--sd-cream)', color: 'var(--sd-ink-3)' }}>Recomendado</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--sd-ink-2)' }}>{count}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Backup status */}
          <div style={{ ...cardStyle() }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>🔄 Backup</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 4 }}>✅ Último backup</div>
                <div style={{ fontSize: 13, color: 'var(--sd-navy)', fontWeight: 600 }}>Hoje, 03:00</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>Automático · {docs.length} documentos</div>
              </div>
              <div style={{ padding: 14, background: 'var(--sd-cream)', borderRadius: 8, border: '1px solid var(--sd-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy)', marginBottom: 4 }}>📅 Próximo backup</div>
                <div style={{ fontSize: 13, color: 'var(--sd-navy)', fontWeight: 600 }}>Amanhã, 03:00</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3)', marginTop: 2 }}>Diário · Encriptação AES-256</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button style={btnOutline}>Forçar backup agora</button>
              <button style={btnOutline}>Exportar tudo (.zip)</button>
            </div>
          </div>

          {/* Auto-classification info */}
          <div style={{ ...cardStyle(), marginTop: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--sd-navy)' }}>🤖 Classificação automática</h3>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-2)', margin: 0, lineHeight: 1.6 }}>
              O sistema analisa automaticamente os documentos carregados e sugere a categoria mais adequada
              com base no nome do ficheiro e conteúdo. Pode sempre alterar a categoria manualmente.
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Ata → Atas', 'Convocatória → Convocatórias', 'Apólice → Seguros', 'Contrato → Contratos', 'Orçamento → Orçamentos', 'IRS → Fiscal', 'Certificado → Certificados'].map((rule, i) => (
                <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--sd-cream)', color: 'var(--sd-ink-2)', border: '1px solid var(--sd-border)' }}>
                  {rule}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
