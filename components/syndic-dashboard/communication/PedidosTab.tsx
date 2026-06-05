'use client'

import React, { useState } from 'react'
import type { Mission, Artisan } from '../types'

// ── Onglet « Pedidos » du Canal de Comunicações ───────────────────────────────
// Liste les demandes d'intervention envoyées par les condóminos (signalements).
// Pour la démo, 2 demandes sont câblées en dur (état local). Cliquer sur
// « Criar ordem de missão » ouvre un modal pour assigner un profissional/técnico
// et créer la mission via onAddMission.

export interface Pedido {
  id: string
  condominoNom: string
  condominoEmail: string
  condominoTelefone: string
  condominoFracao: string  // ex: "Fração C — 2.º Direito"
  imovelNom: string
  imovelMorada: string
  batiment?: string
  etage?: string
  zonaSinalizada: string
  estPartieCommune: boolean
  tipoIntervencao: string
  descricao: string
  prioridade: 'urgente' | 'normale' | 'planifiee'
  dataCriacao: string  // ISO
  fotoUrl?: string  // optionnel — placeholder pour vraies pièces jointes
}

const INITIAL_PEDIDOS: Pedido[] = [
  {
    id: 'ped-demo-1',
    condominoNom: 'Maria João Ferreira',
    condominoEmail: 'mj.ferreira@gmail.com',
    condominoTelefone: '+351 912 458 731',
    condominoFracao: 'Fração D — 3.º Esquerdo',
    imovelNom: 'Condomínio Efficiente',
    imovelMorada: 'Rua das Camélias, 124, 4400-018 Vila Nova de Gaia',
    batiment: 'Bloco A',
    etage: '3.º',
    zonaSinalizada: 'Cobertura / telhado — parte comum',
    estPartieCommune: true,
    tipoIntervencao: 'Fuga de água',
    descricao: 'Há uma infiltração visível no teto da minha sala desde o último temporal. A água escorre pela parede e suspeito que venha do telhado do prédio. Já apareceram manchas castanhas e a tinta começa a descolar. Preciso de uma intervenção urgente antes que piore.',
    prioridade: 'urgente',
    dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // -5h
  },
  {
    id: 'ped-demo-2',
    condominoNom: 'António Silva Pereira',
    condominoEmail: 'antonio.pereira@hotmail.com',
    condominoTelefone: '+351 936 217 904',
    condominoFracao: 'Fração B — Rés-do-chão',
    imovelNom: 'Edifício Marina Plaza',
    imovelMorada: 'Avenida da Boavista, 891, 4100-128 Porto',
    batiment: 'Bloco Único',
    etage: 'R/C',
    zonaSinalizada: 'Hall de entrada e escadas — partes comuns',
    estPartieCommune: true,
    tipoIntervencao: 'Iluminação',
    descricao: 'As lâmpadas do hall de entrada e do patamar do 1.º andar estão fundidas há vários dias. À noite o acesso ao prédio fica praticamente às escuras, o que é um risco de segurança especialmente para os idosos. Pedia que fosse marcada uma intervenção do eletricista o mais rápido possível.',
    prioridade: 'normale',
    dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // -30h
  },
]

const PRIO_BADGE: Record<Pedido['prioridade'], { label: string; bg: string; color: string }> = {
  urgente:   { label: 'Urgente',    bg: '#FEE2E2', color: '#B91C1C' },
  normale:   { label: 'Normal',     bg: '#FEF3C7', color: '#92400E' },
  planifiee: { label: 'Planeado',   bg: '#DBEAFE', color: '#1E40AF' },
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'há menos de 1h'
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export default function PedidosTab({
  artisans,
  onAddMission,
  userName,
}: {
  artisans: Artisan[]
  onAddMission: (m: Mission) => void
  userName: string
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>(INITIAL_PEDIDOS)
  const [openPedidoId, setOpenPedidoId] = useState<string | null>(null)
  const [selectedArtisanId, setSelectedArtisanId] = useState<string>('')

  const openPedido = pedidos.find(p => p.id === openPedidoId) ?? null

  function handleCreateMission() {
    if (!openPedido) return
    const artisan = artisans.find(a => a.id === selectedArtisanId)
    if (!artisan) return

    const newMission: Mission = {
      id: `m-${Date.now()}`,
      immeuble: openPedido.imovelNom,
      artisan: artisan.nom,
      type: openPedido.tipoIntervencao,
      description: openPedido.descricao,
      priorite: openPedido.prioridade,
      statut: 'en_attente',
      dateCreation: new Date().toISOString(),
      batiment: openPedido.batiment,
      etage: openPedido.etage,
      demandeurNom: openPedido.condominoNom,
      demandeurRole: 'coproprio',
      demandeurEmail: openPedido.condominoEmail,
      zoneSignalee: openPedido.zonaSinalizada,
      estPartieCommune: openPedido.estPartieCommune,
    }
    onAddMission(newMission)
    setPedidos(prev => prev.filter(p => p.id !== openPedido.id))
    setOpenPedidoId(null)
    setSelectedArtisanId('')
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--sd-cream, #F7F4EE)', padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
            Pedidos dos condóminos
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #5A6378)' }}>
            Solicitações de intervenção enviadas pelos condóminos. Criar uma ordem de missão atribui o pedido a um profissional ou técnico.
          </p>
        </div>

        {pedidos.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--sd-border, #E5E0D6)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, color: 'var(--sd-ink-3, #5A6378)' }}>Sem pedidos pendentes.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pedidos.map(p => {
              const prio = PRIO_BADGE[p.prioridade]
              const initials = p.condominoNom.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
              return (
                <div key={p.id} style={{ background: 'white', border: '1px solid var(--sd-border, #E5E0D6)', borderRadius: 12, padding: 18, boxShadow: '0 1px 2px rgba(13,27,46,0.04)' }}>
                  {/* Header: avatar + name + priority + time */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--sd-gold, #C9A84C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{p.condominoNom}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: prio.bg, color: prio.color, fontWeight: 600 }}>{prio.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #5A6378)' }}>· {timeAgo(p.dataCriacao)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #5A6378)', marginTop: 2 }}>
                        {p.condominoEmail} · {p.condominoTelefone}
                      </div>
                    </div>
                  </div>

                  {/* Building + location */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12, padding: '10px 12px', background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #5A6378)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Edifício</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{p.imovelNom}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #5A6378)' }}>{p.imovelMorada}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #5A6378)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Localização</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{p.condominoFracao}</div>
                      <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #5A6378)' }}>{p.batiment} · {p.zonaSinalizada}</div>
                    </div>
                  </div>

                  {/* Type + description */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sd-gold, #C9A84C)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        🔧 {p.tipoIntervencao}
                      </span>
                      {p.estPartieCommune && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#E0E7FF', color: '#3730A3', fontWeight: 600 }}>Parte comum</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1.5, margin: 0 }}>{p.descricao}</p>
                  </div>

                  {/* Action button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setOpenPedidoId(p.id); setSelectedArtisanId('') }}
                      style={{
                        background: 'var(--sd-gold, #C9A84C)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      📋 Criar ordem de missão
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal d'attribution ─────────────────────────────────────────────── */}
      {openPedido && (
        <div
          onClick={() => setOpenPedidoId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
              Criar ordem de missão
            </h3>
            <p style={{ fontSize: 12, color: 'var(--sd-ink-3, #5A6378)', marginBottom: 16 }}>
              Pedido de <strong>{openPedido.condominoNom}</strong> — {openPedido.tipoIntervencao}
            </p>

            <div style={{ background: 'var(--sd-cream, #F7F4EE)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--sd-ink-3, #5A6378)' }}>
              <div><strong>Edifício :</strong> {openPedido.imovelNom}</div>
              <div><strong>Local :</strong> {openPedido.zonaSinalizada}</div>
              <div><strong>Prioridade :</strong> {PRIO_BADGE[openPedido.prioridade].label}</div>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 6 }}>
              Atribuir a um profissional ou técnico
            </label>
            <select
              value={selectedArtisanId}
              onChange={e => setSelectedArtisanId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--sd-border, #E5E0D6)', borderRadius: 8, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', background: 'white', marginBottom: 16 }}
            >
              <option value="">— Selecionar —</option>
              {artisans.length === 0 ? (
                <option disabled>Nenhum profissional disponível. Adicione um na secção « Profissionais ».</option>
              ) : (
                artisans.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nom} — {a.metier}{a.rcProValide ? ' ✓' : ''}
                  </option>
                ))
              )}
            </select>

            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #5A6378)', marginBottom: 18 }}>
              Ordem criada por <strong>{userName}</strong> · será visível imediatamente no separador <strong>Pro</strong>.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpenPedidoId(null)}
                style={{ background: 'transparent', color: 'var(--sd-ink-3, #5A6378)', border: '1px solid var(--sd-border, #E5E0D6)', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateMission}
                disabled={!selectedArtisanId}
                style={{
                  background: selectedArtisanId ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E5E0D6)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selectedArtisanId ? 'pointer' : 'not-allowed',
                }}
              >
                ✅ Criar missão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
