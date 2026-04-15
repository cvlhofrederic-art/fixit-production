'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { Users, ExternalLink, Mail, Phone, MapPin, HardHat, ToggleLeft, ToggleRight, Eye, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface ChantierItem {
  id: string
  titre: string
  client: string
  adresse: string
  dateDebut: string
  dateFin: string
  budget: string
  statut: string
  description: string
  equipe: string
}

interface PortalClient {
  name: string
  email: string
  phone: string
  address: string
  type: 'particulier' | 'syndic' | 'societe'
  chantiers: ChantierItem[]
  portalActive: boolean
  lastConsultation: string | null
}

// Contact info dérivé des champs du chantier (plus de données fictives hardcodées)
function getContactFromChantier(ch: ChantierItem): { email: string; phone: string; type: 'particulier' | 'syndic' | 'societe' } {
  const name = (ch.client || '').toLowerCase()
  const type = name.includes('syndic') || name.includes('copro') ? 'syndic' as const
    : name.includes('sci') || name.includes('sas') || name.includes('sarl') ? 'societe' as const
    : 'particulier' as const
  return { email: (ch as any).client_email || '', phone: (ch as any).client_phone || '', type }
}

function getTypeBadge(type: string, isPt: boolean): { label: string; cls: string } {
  const labels: Record<string, { fr: string; pt: string; cls: string }> = {
    particulier: { fr: 'Particulier', pt: 'Particular', cls: 'v5-badge v5-badge-blue' },
    syndic: { fr: 'Syndic', pt: 'Administração', cls: 'v5-badge v5-badge-purple' },
    societe: { fr: 'Société', pt: 'Empresa', cls: 'v5-badge v5-badge-orange' },
  }
  const entry = labels[type] || labels.particulier
  return { label: isPt ? entry.pt : entry.fr, cls: entry.cls }
}

const STATUS_BADGE: Record<string, string> = {
  'En cours': 'v5-badge v5-badge-green',
  'Terminé': 'v5-badge v5-badge-gray',
  'En attente': 'v5-badge v5-badge-orange',
  'Annulé': 'v5-badge v5-badge-red',
}

export default function PortailClientSection({ userId, artisanId, orgRole }: { userId: string; artisanId: string; orgRole?: string }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const { items: chantiers, loading } = useBTPData<ChantierItem>({ table: 'chantiers', artisanId, userId })

  const [portalStates, setPortalStates] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(`fixit_portal_states_${artisanId}`) || '{}') } catch { return {} }
  })
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  // Build clients from chantiers
  const clients: PortalClient[] = []
  const clientMap = new Map<string, PortalClient>()

  for (const ch of chantiers) {
    if (!ch.client) continue
    const existing = clientMap.get(ch.client)
    if (existing) {
      existing.chantiers.push(ch)
    } else {
      const contact = getContactFromChantier(ch)
      const client: PortalClient = {
        name: ch.client,
        email: contact.email,
        phone: contact.phone,
        address: ch.adresse || '',
        type: contact.type,
        chantiers: [ch],
        portalActive: portalStates[ch.client] || false,
        lastConsultation: null,
      }
      clientMap.set(ch.client, client)
      clients.push(client)
    }
  }

  // Also sync to manual clients in localStorage
  useEffect(() => {
    if (clients.length === 0 || !artisanId) return
    const storageKey = `fixit_manual_clients_${artisanId}`
    let existing: any[] = []
    try { existing = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { /* */ }

    const existingNames = new Set(existing.map((c: any) => c.name))
    let added = false

    for (const client of clients) {
      if (!existingNames.has(client.name)) {
        existing.push({
          id: `chantier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: client.name,
          email: client.email,
          phone: client.phone,
          type: client.type === 'syndic' ? 'syndic' : client.type === 'societe' ? 'societe' : 'particulier',
          mainAddress: client.address,
          mainAddressLabel: isPt ? (client.type === 'societe' ? 'Sede social' : 'Domicílio') : (client.type === 'societe' ? 'Siège social' : 'Domicile'),
          notes: isPt ? `Cliente proveniente das obras (${client.chantiers.map(c => c.titre).join(', ')})` : `Client issu des chantiers BTP (${client.chantiers.map(c => c.titre).join(', ')})`,
          source: 'manual',
        })
        added = true
      }
    }

    if (added) {
      localStorage.setItem(storageKey, JSON.stringify(existing))
    }
  }, [clients.length, artisanId]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePortal = (clientName: string) => {
    const updated = { ...portalStates, [clientName]: !portalStates[clientName] }
    setPortalStates(updated)
    localStorage.setItem(`fixit_portal_states_${artisanId}`, JSON.stringify(updated))
  }

  const activePortals = clients.filter(c => portalStates[c.name]).length
  const chantiersEnCours = chantiers.filter(c => c.statut === 'En cours').length

  const formatBudget = (b: string) => {
    const n = parseFloat(b)
    if (isNaN(n)) return '—'
    return n.toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  }

  if (loading) {
    return (
      <div className="v5-fade">
        <div className="v5-pg-t"><h1>{isPt ? 'Portal do cliente' : 'Portail client'}</h1><p>{isPt ? 'A carregar...' : 'Chargement...'}</p></div>
        <div className="v5-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="v5-spin" style={{ margin: '0 auto 12px', width: 28, height: 28 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="v5-fade">
      {/* Header */}
      <div className="v5-pg-t">
          <h1><Users size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Portal do cliente' : 'Portail client'}</h1>
          <p>{isPt ? 'Dê aos seus clientes acesso em tempo real às suas obras' : 'Donnez à vos clients un accès en temps réel à leurs chantiers'}</p>
      </div>

      {/* KPIs */}
      <div className="v5-kpi-g" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Portais ativos' : 'Portails actifs'}</div>
          <div className="v5-kpi-v">{activePortals}</div>
          <div className="v5-kpi-s">{isPt ? `de ${clients.length} clientes` : `sur ${clients.length} clients`}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Clientes ligados a uma obra' : 'Clients liés à un chantier'}</div>
          <div className="v5-kpi-v">{clients.length}</div>
          <div className="v5-kpi-s">{chantiersEnCours} {isPt ? 'obra(s) em curso' : 'chantier(s) en cours'}</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-l">{isPt ? 'Última consulta' : 'Dernière consultation'}</div>
          <div className="v5-kpi-v" style={{ fontSize: 16 }}>—</div>
          <div className="v5-kpi-s">{isPt ? 'Nenhuma consulta' : 'Aucune consultation'}</div>
        </div>
      </div>

      {/* Info cards */}
      <div className="v5-sg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1.25rem' }}>
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'O que o cliente vê' : 'Ce que le client voit'}</div>
          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.8 }}>
            {isPt ? <>
              📊 <strong>Progresso</strong> — Barra de avanço por lote, % global, próximas etapas<br/>
              📸 <strong>Fotos</strong> — Galeria de fotos da obra, filtradas por fase<br/>
              📈 <strong>Situações de obra</strong> — Consulta e validação online com assinatura eletrónica<br/>
              📄 <strong>Documentos</strong> — Atas, relatórios, plantas partilhadas pela empresa<br/>
              💬 <strong>Mensagens</strong> — Canal de discussão dedicado à obra<br/>
              🌤️ <strong>Meteorologia</strong> — Previsões e impacto no planeamento (só leitura)
            </> : <>
              📊 <strong>Avancement</strong> — Barre de progression par lot, % global, prochaines etapes<br/>
              📸 <strong>Photos</strong> — Galerie de photos du chantier, filtrees par phase<br/>
              📈 <strong>Situations de travaux</strong> — Consultation et validation en ligne avec signature electronique<br/>
              📄 <strong>Documents</strong> — PV, rapports, plans partages par l&apos;entreprise<br/>
              💬 <strong>Messagerie</strong> — Canal de discussion dedie au chantier<br/>
              🌤️ <strong>Meteo</strong> — Previsions et impact sur le planning (lecture seule)
            </>}
          </div>
        </div>
        <div className="v5-card">
          <div className="v5-st">{isPt ? 'Como funciona' : 'Comment ca fonctionne'}</div>
          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.8 }}>
            {isPt ? <>
              <strong>1.</strong> Ative o portal para um cliente (botão abaixo)<br/>
              <strong>2.</strong> Escolha os módulos visíveis pelo cliente<br/>
              <strong>3.</strong> O cliente recebe um e-mail automático com o seu link de acesso<br/>
              <strong>4.</strong> Sem palavra-passe: acesso por link seguro + código SMS<br/>
              <strong>5.</strong> O cliente consulta em modo de leitura (exceto validação de situações)<br/>
              <strong>6.</strong> Vê quem consultou o quê e quando
            </> : <>
              <strong>1.</strong> Activez le portail pour un client (toggle ci-dessous)<br/>
              <strong>2.</strong> Choisissez les modules visibles par le client<br/>
              <strong>3.</strong> Le client recoit un email automatique avec son lien d&apos;acces<br/>
              <strong>4.</strong> Pas de mot de passe : acces par lien securise + code SMS<br/>
              <strong>5.</strong> Le client consulte en lecture seule (sauf validation des situations)<br/>
              <strong>6.</strong> Vous voyez qui a consulte quoi et quand
            </>}
          </div>
        </div>
      </div>

      {/* Client list */}
      <div className="v5-st" style={{ marginBottom: 8 }}>{isPt ? `Os seus clientes (${clients.length})` : `Vos clients (${clients.length})`}</div>

      {clients.length === 0 ? (
        <div className="v5-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Users size={36} style={{ color: '#ccc', marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: '#999' }}>{isPt ? 'Nenhum cliente associado às suas obras. Crie uma obra com nome de cliente para o ver aparecer aqui.' : 'Aucun client associe a vos chantiers. Creez un chantier avec un nom de client pour le voir apparaitre ici.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(client => {
            const isExpanded = expandedClient === client.name
            const isActive = portalStates[client.name] || false
            const badge = getTypeBadge(client.type, isPt)
            const totalBudget = client.chantiers.reduce((s, c) => s + (parseFloat(c.budget) || 0), 0)

            return (
              <div key={client.name} className="v5-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Client header */}
                <div
                  style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpandedClient(isExpanded ? null : client.name)}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: isActive ? '#E8F5E9' : '#F5F5F5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: isActive ? '#2E7D32' : '#999',
                    flexShrink: 0,
                  }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{client.name}</span>
                      <span className={badge.cls} style={{ fontSize: 10 }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><HardHat size={11} /> {client.chantiers.length} {isPt ? 'obra(s)' : 'chantier(s)'}</span>
                      <span style={{ color: '#555', fontWeight: 600 }}>{totalBudget.toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Toggle portal */}
                  <div
                    onClick={(e) => { e.stopPropagation(); togglePortal(client.name) }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    title={isActive ? (isPt ? 'Desativar o portal' : 'Desactiver le portail') : (isPt ? 'Ativar o portal' : 'Activer le portail')}
                  >
                    {isActive ? (
                      <ToggleRight size={28} style={{ color: '#FFC107' }} />
                    ) : (
                      <ToggleLeft size={28} style={{ color: '#CCC' }} />
                    )}
                    <span style={{ fontSize: 10, color: isActive ? '#FFA000' : '#999', fontWeight: 600 }}>
                      {isActive ? (isPt ? 'Ativo' : 'Actif') : (isPt ? 'Inativo' : 'Inactif')}
                    </span>
                  </div>

                  {/* Expand icon */}
                  {isExpanded ? <ChevronUp size={16} style={{ color: '#999' }} /> : <ChevronDown size={16} style={{ color: '#999' }} />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F0F0F0', padding: '12px 16px', background: '#FAFAFA' }}>
                    {/* Contact info */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', fontSize: 12, color: '#555' }}>
                      {client.phone && <span><Phone size={12} style={{ verticalAlign: '-1px' }} /> {client.phone}</span>}
                      {client.email && <span><Mail size={12} style={{ verticalAlign: '-1px' }} /> {client.email}</span>}
                      {client.address && <span><MapPin size={12} style={{ verticalAlign: '-1px' }} /> {client.address}</span>}
                    </div>

                    {/* Chantiers list */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                      {isPt ? `Obras associadas (${client.chantiers.length})` : `Chantiers associes (${client.chantiers.length})`}
                    </div>
                    {client.chantiers.map(ch => (
                      <div key={ch.id} style={{
                        background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8,
                        padding: '10px 12px', marginBottom: 6,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{ch.titre}</span>
                          <span className={STATUS_BADGE[ch.statut] || 'v5-badge v5-badge-gray'} style={{ fontSize: 10 }}>{ch.statut}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#888', flexWrap: 'wrap' }}>
                          <span><MapPin size={10} style={{ verticalAlign: '-1px' }} /> {ch.adresse}</span>
                          <span><Clock size={10} style={{ verticalAlign: '-1px' }} /> {ch.dateDebut || '?'} → {ch.dateFin || '?'}</span>
                          <span>{formatBudget(ch.budget)}</span>
                        </div>
                      </div>
                    ))}

                    {/* Portal actions */}
                    {isActive && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <button className="v5-btn v5-btn-s" style={{ fontSize: 11 }}>
                          <Eye size={12} /> {isPt ? 'Pré-visualizar portal' : 'Apercu portail'}
                        </button>
                        <button className="v5-btn v5-btn-s" style={{ fontSize: 11 }}>
                          <ExternalLink size={12} /> {isPt ? 'Copiar link de acesso' : 'Copier le lien d\'acces'}
                        </button>
                        <button className="v5-btn v5-btn-s" style={{ fontSize: 11 }}>
                          <Mail size={12} /> {isPt ? 'Enviar convite' : 'Envoyer l\'invitation'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
