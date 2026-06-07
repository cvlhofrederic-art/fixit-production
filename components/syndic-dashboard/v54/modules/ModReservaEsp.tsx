'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Tabs } from '../primitives/tabs'
import { Button } from '../primitives/button'
import { Empty } from '../primitives/empty'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Reserva } from '@/lib/syndic/v54/api'

/** Reserva de Espaços Comuns — port byte-exact V5.7 (calendrier + légende) + lot fonctionnel.
 * Calendrier/légende = design showcase statique ; « Próximas reservas » = data réelle du
 * cabinet (data.reservas) + création POST. Anonyme → preview byte-exact. */

type ResForm = { espaco: string; quem: string; data: string; hora: string; estado: Reserva['estado']; notes: string }

const estadoLabel = (v: string) => (({ confirmada: 'Confirmada', pendente: 'Pendente', cancelada: 'Cancelada' } as Record<string, string>)[v] || v)
const estadoKind = (v: string): PillKind => (({ confirmada: 'sage', pendente: 'amber', cancelada: 'rust' } as Record<string, PillKind>)[v] || 'amber')
const reservaIcon = (espaco: string): IconName => (espaco.includes('Churrasqueira') ? 'flame' : 'doc')

const PREVIEW: Reserva[] = [
  { id: 'p1', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 2B', data: '25/05', hora: '10:00 - 13:00', estado: 'confirmada', notes: '' },
  { id: 'p2', espaco: 'Churrasqueira Cobertura', quem: 'Carlos Mendes · Fração 4B', data: '27/05', hora: '10:00 - 13:00', estado: 'pendente', notes: '' },
  { id: 'p3', espaco: 'Churrasqueira Cobertura', quem: 'Ana Silva · Fração 5A', data: '30/05', hora: '15:00 - 17:00', estado: 'confirmada', notes: '' },
  { id: 'p4', espaco: 'Sala de Reuniões B1', quem: 'Carlos Mendes · Fração 3A', data: '30/05', hora: '15:00 - 18:00', estado: 'pendente', notes: '' },
  { id: 'p5', espaco: 'Ginásio Condominial', quem: 'Pedro Costa · Fração 4A', data: '31/05', hora: '12:00 - 14:00', estado: 'confirmada', notes: '' },
  { id: 'p6', espaco: 'Salão de Festas Principal', quem: 'Rita Oliveira · Fração 4A', data: '31/05', hora: '13:00 - 15:00', estado: 'confirmada', notes: '' },
  { id: 'p7', espaco: 'Salão de Festas Principal', quem: 'Carlos Mendes · Fração 1A', data: '03/06', hora: '09:00 - 12:00', estado: 'confirmada', notes: '' },
  { id: 'p8', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 5A', data: '03/06', hora: '13:00 - 18:00', estado: 'pendente', notes: '' },
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
  const data = useSyndicData()
  const real = data.authenticated
  const all: Reserva[] = real ? (data.reservas ?? []) : PREVIEW

  const blank: ResForm = { espaco: '', quem: '', data: '', hora: '', estado: 'pendente', notes: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ResForm>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof ResForm, string>>>({})
  const [busy, setBusy] = useState(false)
  const { push } = useToast()

  const upd = (k: keyof ResForm, v: string) => setForm(s => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.espaco.trim()) { setErrors({ espaco: 'Indique o espaço a reservar.' }); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ espaco: form.espaco, quem: form.quem, data: form.data || null, hora: form.hora, estado: form.estado, notes: form.notes }),
      })
        .then(r => { if (!r.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Reserva criada', desc: form.espaco }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao criar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Reserva criada (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead
        title="Reserva de Espaços Comuns"
        lede="Gestão de reservas, espaços e regras de utilização do condomínio"
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova Reserva</Button>}
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
        <Button variant="ghost" aria-label="Mês anterior" title="Mês anterior" onClick={() => push({ kind: 'info', title: 'Mês anterior', desc: 'Navegação dinâmica do calendário em breve' })}>←</Button>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, padding: '8px 16px' }}>Maio 2026</div>
        <Button variant="ghost" aria-label="Mês seguinte" title="Mês seguinte" onClick={() => push({ kind: 'info', title: 'Mês seguinte', desc: 'Navegação dinâmica do calendário em breve' })}>→</Button>
        <Button onClick={() => push({ kind: 'info', title: 'Hoje', desc: 'A mostrar a semana atual' })}>Hoje</Button><Button onClick={() => push({ kind: 'info', title: 'Vista semanal', desc: 'Em breve' })}>Semana</Button><Button variant="primary" onClick={() => push({ kind: 'info', title: 'Vista mensal', desc: 'Vista ativa' })}>Mês</Button>
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
        {real && all.length === 0 ? (
          <Empty illustration="documentos" title="Sem reservas" desc="Crie a primeira reserva de espaço comum do condomínio"
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />+ Nova Reserva</Button>} />
        ) : (
          all.map((r, i) => (
            <div key={r.id} style={{ padding: '14px 22px', borderBottom: i < all.length - 1 ? '1px solid var(--v54-line)' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={reservaIcon(r.espaco)} /></div>
              <div style={{ flex: 1 }}><b>{r.espaco}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{r.quem}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600 }}>{r.data}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{r.hora}</div></div>
              <Pill kind={estadoKind(r.estado)} noDot>{estadoLabel(r.estado)}</Pill>
              <Button variant="danger" size="sm" onClick={() => push({ kind: 'info', title: 'Cancelar reserva', desc: real ? 'Gestão de cancelamento em breve' : 'Conecte-se como síndico' })}>Cancelar</Button>
            </div>
          ))
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="res-modal-title" size="md">
        <ModalHead icon="calendar" id="res-modal-title" title="Nova reserva" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Espaço" required full name="res-espaco" error={errors.espaco}>
              <input type="text" placeholder="Ex.: Salão de Festas Principal" value={form.espaco} onChange={e => upd('espaco', e.target.value)} />
            </Field>
            <Field label="Quem reserva" full name="res-quem">
              <input type="text" placeholder="Nome · Fração" value={form.quem} onChange={e => upd('quem', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Data" name="res-data">
                <input type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
              </Field>
              <Field label="Horário" name="res-hora">
                <input type="text" placeholder="10:00 - 13:00" value={form.hora} onChange={e => upd('hora', e.target.value)} />
              </Field>
            </FormRow>
            <Field label="Estado" name="res-estado">
              <select value={form.estado} onChange={e => upd('estado', e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="confirmada">Confirmada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </Field>
            <Field label="Notas" full name="res-notes">
              <textarea rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} />
            </Field>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar reserva</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
