'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Tabs } from '../primitives/tabs'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'

/** Canal de Comunicações — port byte-exact du ModCanal du bundle V5.7.
 * CSS bespoke dans ./canal.css (scopé #syndic-dashboard-v54). Icônes paperclip/camera/info
 * absentes du jeu d'icônes du bundle → fallback `doc` (paths[name] || paths.doc), reproduit ici. */

type Mission = { id: string; building: string; area: string; professional: string; status: string; priority: string; date: string; amount: number | null; duration: string | null; requester: string; tags: string[]; unread: number }
const MISSIONS: Mission[] = [
  { id: 'MSN-2026-1314', building: 'Condomínio Boavista Center', area: 'Pequenas reparações', professional: 'Diogo Pereira', status: 'em-espera', priority: 'normal', date: '18 de maio de 2026', amount: null, duration: null, requester: 'Joana Ribeiro', tags: ['em-espera'], unread: 0 },
  { id: 'MSN-2026-1308', building: 'Edifício Atlântico — Bloco A', area: 'Limpeza áreas comuns', professional: 'Diogo Pereira', status: 'concluida', priority: 'normal', date: '12 de maio de 2026', amount: 480, duration: '2h', requester: 'Joana Ribeiro', tags: ['concluida'], unread: 0 },
  { id: 'MSN-2026-1311', building: 'Edifício Atlântico — Bloco A', area: 'Fuga de água — apt 3B', professional: 'Diogo Pereira', status: 'em-curso', priority: 'urgente', date: '21 de maio de 2026', amount: 1200, duration: '4h', requester: 'Maria Costa', tags: ['urgente', 'em-curso'], unread: 2 },
  { id: 'MSN-2026-1305', building: 'Edifício Foz Douro', area: 'Inspeção elevador anual', professional: 'Tiago Mendes', status: 'em-curso', priority: 'normal', date: '22 de maio de 2026', amount: 340, duration: '1h30', requester: 'Joana Ribeiro', tags: ['em-curso'], unread: 0 },
  { id: 'MSN-2026-1299', building: 'Residencial Cedofeita — Bloco A', area: 'Pintura corredor', professional: 'Tiago Mendes', status: 'em-espera', priority: 'normal', date: '25 de maio de 2026', amount: 2800, duration: '2 dias', requester: 'Joana Ribeiro', tags: ['em-espera'], unread: 0 },
]
const TAG_KIND: Record<string, PillKind> = { urgente: 'rust', 'em-curso': 'amber', 'em-espera': 'gold', concluida: 'sage' }
const TAG_LABEL: Record<string, string> = { urgente: 'Urgente', 'em-curso': 'Em curso', 'em-espera': 'Em espera', concluida: 'Concluída' }
const fmtEUR = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)
const FILTERS: [string, string, string | null][] = [['todas', 'Todas', null], ['urgente', 'Urgente', 'rust'], ['em-curso', 'Em curso', 'amber'], ['em-espera', 'Em espera', 'gold']]

export default function ModCanal() {
  const [tab, setTab] = useState('pro')
  const [subTab, setSubTab] = useState('prest')
  const [filter, setFilter] = useState('todas')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(MISSIONS[0].id)
  const [draft, setDraft] = useState('')
  const { push } = useToast()

  const selected = MISSIONS.find(mi => mi.id === selectedId) || MISSIONS[0]
  const visible = MISSIONS.filter(mi =>
    (filter === 'todas' || mi.tags.includes(filter))
    && (!search || mi.building.toLowerCase().includes(search.toLowerCase()) || mi.professional.toLowerCase().includes(search.toLowerCase())))

  const progress = [
    { step: 'Missão criada', date: '15 de maio de 2026', state: 'done' },
    { step: 'Profissional atribuído', date: '15 de maio de 2026', state: 'done' },
    { step: 'Intervenção iniciada', date: null, state: 'current' },
    { step: 'Em espera de validação', date: null, state: 'pending' },
    { step: 'Missão encerrada', date: null, state: 'pending' },
  ]
  const participants = [
    { initials: 'G', name: 'Gestionnaire', role: 'Gestor técnico', online: true },
    { initials: 'D', name: selected.professional, role: 'Profissional certificado VitFix', online: true },
    { initials: 'J', name: selected.requester, role: 'Solicitante', online: false },
  ]
  const sendMessage = () => {
    if (!draft.trim()) return
    push({ kind: 'success', title: 'Mensagem enviada', desc: `Para ${selected.professional}` })
    setDraft('')
  }

  return (
    <>
      <PageHead title="Canal de Comunicações" lede="Mensagens com profissionais externos, equipa interna e pedidos de condóminos" />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'pro', label: 'Pro', icon: 'wrench', badge: 1 },
        { id: 'int', label: 'Interno', icon: 'building' },
        { id: 'ped', label: 'Pedidos', icon: 'doc', badge: 2 },
      ]} />

      <div className="canal-grid">
        <aside className="canal-missions-col" aria-label="Lista de missões">
          <div className="canal-missions-head">
            <div className="canal-missions-label">MISSÕES</div>
            <div className="canal-missions-subtabs">
              <button type="button" className={clsx('canal-chip', subTab === 'prest' && 'active')} onClick={() => setSubTab('prest')}>
                <Icon name="wrench" /> Prestadores <span className="canal-chip-count">5</span>
              </button>
              <button type="button" className={clsx('canal-chip', subTab === 'equip' && 'active')} onClick={() => setSubTab('equip')}>
                <Icon name="users" /> Equipa <span className="canal-chip-count">4</span>
              </button>
            </div>
            <div className="canal-search">
              <Icon name="search" />
              <input type="text" placeholder="Pesquisar profissional, edifício…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Pesquisar missões" />
            </div>
            <div className="canal-filters" role="group" aria-label="Filtros">
              {FILTERS.map(([k, lbl, kind]) => (
                <button key={k} type="button" className={clsx('canal-filter', filter === k && 'active', kind)} onClick={() => setFilter(k)}>
                  {kind && <span className="canal-filter-dot" />}
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="canal-missions-list">
            {visible.length === 0 ? (
              <p className="canal-empty">Nenhuma missão corresponde ao filtro.</p>
            ) : visible.map(mi => (
              <button key={mi.id} type="button" className={clsx('canal-mission-card', mi.id === selectedId && 'active')} onClick={() => setSelectedId(mi.id)} aria-current={mi.id === selectedId ? 'true' : undefined}>
                <div className="canal-mission-title">{mi.building}</div>
                <div className="canal-mission-sub"><span className="canal-mission-dot" />{mi.professional}</div>
                <div className="canal-mission-tags">
                  {mi.tags.map(t => <Pill key={t} kind={TAG_KIND[t]} noDot>{TAG_LABEL[t]}</Pill>)}
                </div>
                {mi.unread > 0 && <span className="canal-mission-unread">{mi.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className="canal-chat-col" aria-label="Conversa">
          <header className="canal-chat-head">
            <div className="canal-chat-head-info">
              <h3 className="canal-chat-title">{selected.building} <span className="canal-chat-title-sep">·</span> {selected.area}</h3>
              <p className="canal-chat-meta">
                <span className="canal-mission-dot" />{selected.professional}
                <span className="canal-chat-meta-sep">·</span>
                Missão <span className="canal-chat-meta-id">#{selected.id}</span>
                <span className="canal-chat-meta-sep">·</span>
                <a href="#" className="canal-chat-link" onClick={e => { e.preventDefault(); push({ kind: 'info', title: 'Vista profissional', desc: 'A abrir a vista do profissional' }) }}>Vista: Profissional →</a>
              </p>
            </div>
            <div className="canal-chat-head-actions">
              <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: 'Documentos', desc: 'Painel de documentos' })}><Icon name="doc" />Documentos</Button>
              <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: 'Detalhes', desc: 'Detalhes técnicos da missão' })}><Icon name="doc" />Detalhes</Button>
              <Button variant="primary" size="sm" onClick={() => push({ kind: 'success', title: 'Missão validada', desc: selected.building })}><Icon name="check" />Validar missão</Button>
            </div>
          </header>

          <div className="canal-chat-body">
            <div className="canal-chat-empty">
              <div className="canal-chat-empty-icon"><Icon name="wrench" /></div>
              <h4>Canal profissional aberto</h4>
              <p>A ordem de missão foi enviada para {selected.professional}.<br />Envie uma mensagem para iniciar a conversa.</p>
            </div>
          </div>

          <footer className="canal-chat-footer">
            <form className="canal-chat-input-row" onSubmit={e => { e.preventDefault(); sendMessage() }}>
              <button type="button" className="canal-chat-iconbtn" aria-label="Anexar ficheiro" title="Anexar"><Icon name="doc" /></button>
              <button type="button" className="canal-chat-iconbtn" aria-label="Tirar foto" title="Foto"><Icon name="doc" /></button>
              <input type="text" className="canal-chat-input" placeholder={`Responder a ${selected.professional}…`} value={draft} onChange={e => setDraft(e.target.value)} aria-label="Mensagem" />
              <button type="submit" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)} disabled={!draft.trim()} aria-label="Enviar"><Icon name="arrow" /></button>
            </form>
            <div className="canal-chat-footer-row">
              <p className="canal-chat-hint">Enter para enviar <span className="canal-chat-meta-sep">·</span> Shift+Enter para nova linha</p>
              <div className="canal-chat-quickactions">
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'success', title: 'Missão validada', desc: selected.building })}><Icon name="check" />Validar</Button>
                <Button variant="gold" size="sm" onClick={() => push({ kind: 'warning', title: 'Revisão solicitada', desc: selected.building })}><Icon name="refresh" />Pedir revisão</Button>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: 'Modelos', desc: 'Galeria de modelos de resposta' })}><Icon name="doc" />Modelos</Button>
              </div>
            </div>
          </footer>
        </section>

        <aside className="canal-details-col" aria-label="Detalhes da missão">
          <section className="canal-details-section">
            <h4 className="canal-details-label">MISSÃO</h4>
            <h3 className="canal-details-title">{selected.area} — {selected.building}</h3>
            <p className="canal-details-id">#{selected.id}</p>
            <div className="canal-details-pills">
              <Pill kind={selected.priority === 'urgente' ? 'rust' : 'dark'} noDot>{selected.priority === 'urgente' ? 'Urgente' : 'Normal'}</Pill>
              <Pill kind="amber" noDot>Em espera de validação</Pill>
            </div>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">INFORMAÇÕES</h4>
            <ul className="canal-info-list">
              <li><Icon name="building" /><div><div className="canal-info-k">Edifício</div><a href="#" className="canal-info-link" onClick={e => e.preventDefault()}>{selected.building}</a></div></li>
              <li><Icon name="wrench" /><div><div className="canal-info-k">Área profissional</div><div className="canal-info-v">{selected.area}</div></div></li>
              <li><Icon name="calendar" /><div><div className="canal-info-k">Data da intervenção</div><div className="canal-info-v">{selected.date}</div></div></li>
              <li><Icon name="clock" /><div><div className="canal-info-k">Duração estimada</div><div className="canal-info-v">{selected.duration || '—'}</div></div></li>
              <li><Icon name="coin" /><div><div className="canal-info-k">Montante sem IVA</div><div className="canal-info-v">{selected.amount ? fmtEUR(selected.amount) : '—'}</div></div></li>
              <li><Icon name="users" /><div><div className="canal-info-k">Solicitante</div><div className="canal-info-v">{selected.requester}</div></div></li>
            </ul>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">PROGRESSO</h4>
            <ol className="canal-progress">
              {progress.map((p, i) => (
                <li key={i} className={`canal-progress-step state-${p.state}`}>
                  <span className="canal-progress-marker" />
                  <div className="canal-progress-content">
                    <div className="canal-progress-step-name">{p.step}</div>
                    <div className="canal-progress-step-date">{p.date || '—'}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">PARTICIPANTES</h4>
            <ul className="canal-participants">
              {participants.map((p, i) => (
                <li key={i} className="canal-participant">
                  <span className="canal-participant-avatar">{p.initials}</span>
                  <div className="canal-participant-info">
                    <div className="canal-participant-name">{p.name}</div>
                    <div className="canal-participant-role">{p.role}</div>
                  </div>
                  {p.online && <span className="canal-participant-online" aria-label="Online" />}
                </li>
              ))}
            </ul>
          </section>

          <section className="canal-details-section">
            <h4 className="canal-details-label">AÇÕES RÁPIDAS</h4>
            <div className="canal-actions">
              <button type="button" className="canal-action sage" onClick={() => push({ kind: 'success', title: 'Missão encerrada', desc: selected.building })}><Icon name="check" /><span>Validar &amp; encerrar a missão</span></button>
              <button type="button" className="canal-action" onClick={() => push({ kind: 'info', title: 'Relatório PDF', desc: 'A gerar o relatório PDF…' })}><Icon name="doc" /><span>Gerar relatório PDF</span></button>
              <button type="button" className="canal-action gold" onClick={() => push({ kind: 'warning', title: 'Revisão solicitada', desc: selected.building })}><Icon name="refresh" /><span>Pedir revisão</span></button>
              <button type="button" className="canal-action rust" onClick={() => push({ kind: 'warning', title: 'Missão cancelada', desc: selected.building })}><Icon name="ban" /><span>Cancelar a missão</span></button>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
