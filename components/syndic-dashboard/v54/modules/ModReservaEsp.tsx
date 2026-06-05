import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'

/** Reserva de Espaços Comuns — port byte-exact du ModReservaEsp du bundle V5.7 (L37106-37172).
 * Statique (aucun hook). Calendrier mensuel → CSS bespoke ./reservaesp.css (scopé
 * #syndic-dashboard-v54, importé dans le layout dev). Tokens inline remappés --* → --v54-*. */

type Reserva = { icon: IconName | ''; espaco: string; quem: string; data: string; hora: string; estado: string; kind: PillKind }

const RESERVAS: Reserva[] = [
  { icon: '', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 2B', data: '25/05', hora: '10:00 - 13:00', estado: 'Confirmada', kind: 'sage' },
  { icon: 'flame', espaco: 'Churrasqueira Cobertura', quem: 'Carlos Mendes · Fração 4B', data: '27/05', hora: '10:00 - 13:00', estado: 'Pendente', kind: 'amber' },
  { icon: 'flame', espaco: 'Churrasqueira Cobertura', quem: 'Ana Silva · Fração 5A', data: '30/05', hora: '15:00 - 17:00', estado: 'Confirmada', kind: 'sage' },
  { icon: '', espaco: 'Sala de Reuniões B1', quem: 'Carlos Mendes · Fração 3A', data: '30/05', hora: '15:00 - 18:00', estado: 'Pendente', kind: 'amber' },
  { icon: '', espaco: 'Ginásio Condominial', quem: 'Pedro Costa · Fração 4A', data: '31/05', hora: '12:00 - 14:00', estado: 'Confirmada', kind: 'sage' },
  { icon: '', espaco: 'Salão de Festas Principal', quem: 'Rita Oliveira · Fração 4A', data: '31/05', hora: '13:00 - 15:00', estado: 'Confirmada', kind: 'sage' },
  { icon: '', espaco: 'Salão de Festas Principal', quem: 'Carlos Mendes · Fração 1A', data: '03/06', hora: '09:00 - 12:00', estado: 'Confirmada', kind: 'sage' },
  { icon: '', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 5A', data: '03/06', hora: '13:00 - 18:00', estado: 'Pendente', kind: 'amber' },
]

const DOWS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const LEGENDA: Array<[string, string]> = [
  ['Salão de Festas', 'var(--v54-gold-500)'],
  ['Churrasqueira', 'var(--v54-rust-500)'],
  ['Campo/Polidesportivo', 'var(--v54-sage-500)'],
  ['Piscina', 'var(--v54-sage-700)'],
  ['Ginásio', 'var(--v54-amber-500)'],
  ['Sala de Reuniões', 'var(--v54-gold-700)'],
]

const DAYS = [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]

export default function ModReservaEsp() {
  return (
    <>
      <PageHead
        title="Reserva de Espaços Comuns"
        lede="Gestão de reservas, espaços e regras de utilização do condomínio"
        actions={<Button variant="gold"><Icon name="plus" />+ Nova Reserva</Button>}
      />
      <Tabs defaultActive="cal" tabs={[
        { id: 'cal', icon: 'calendar', label: 'Calendário' },
        { id: 'esp', icon: 'home', label: 'Espaços' },
        { id: 'reg', icon: 'clipboard', label: 'Regras' },
        { id: 'rel', icon: 'chart', label: 'Relatório' },
      ]} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {LEGENDA.map((l, i) => (
          <Pill key={i} noDot>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l[1], display: 'inline-block', marginRight: 4 }}></span>{l[0]}
          </Pill>
        ))}
        <div style={{ flex: 1 }}></div>
        <Button variant="ghost" aria-label="Mês anterior" title="Mês anterior">←</Button>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, padding: '8px 16px' }}>Maio 2026</div>
        <Button variant="ghost" aria-label="Mês seguinte" title="Mês seguinte">→</Button>
        <Button>Hoje</Button><Button>Semana</Button><Button variant="primary">Mês</Button>
      </div>
      <Panel flush>
        <div className="calendar">
          {DOWS.map(d => <div key={d} className="dow">{d}</div>)}
          {DAYS.map((n, i) => (
            <div key={i} className={`day ${n === 24 ? 'today' : ''} ${n === 0 ? 'muted' : ''}`}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{n || ''}</div>
              {n === 6 && <div className="ev green">12:00 Piscina</div>}
              {n === 7 && <><div className="ev gold">13:00 Salão</div><div className="ev green">14:00 Piscina</div></>}
              {n === 8 && <div className="ev green">16:00 Campo</div>}
              {n === 11 && <><div className="ev gold">10:00 Salão</div><div className="ev green">15:00 Piscina</div></>}
              {n === 19 && <div className="ev green">13:00 Piscina</div>}
              {n === 22 && <><div className="ev green">15:00 Piscina</div><div className="ev amber">15:00 Ginásio</div></>}
              {n === 23 && <><div className="ev green">09:00 Piscina</div><div className="ev amber">13:00 Churrasqueira</div></>}
              {n === 24 && <div className="ev amber">09:00 Ginásio</div>}
              {n === 26 && <div className="ev rust">10:00 Sala</div>}
              {n === 28 && <div className="ev amber">10:00 Churrasqueira</div>}
              {n === 31 && <><div className="ev amber">15:00 Churrasqueira</div><div className="ev rust">15:00 Sala</div></>}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Próximas reservas" flush>
        {RESERVAS.map((r, i) => (
          <div key={i} style={{ padding: '14px 22px', borderBottom: i < RESERVAS.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={r.icon || 'doc'} /></div>
            <div style={{ flex: 1 }}><b>{r.espaco}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r.quem}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600 }}>{r.data}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{r.hora}</div></div>
            <Pill kind={r.kind} noDot>{r.estado}</Pill>
            <Button variant="danger" size="sm">Cancelar</Button>
          </div>
        ))}
      </Panel>
    </>
  )
}
