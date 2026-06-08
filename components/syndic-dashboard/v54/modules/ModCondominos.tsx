'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { KPIGrid } from '../primitives/kpi'
import { Tabs } from '../primitives/tabs'
import { Panel } from '../primitives/panel'
import { Empty } from '../primitives/empty'
import { Pill } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { useComingSoon } from './use-coming-soon'
import { useToast } from '../primitives/toast'
import { useSyndicCreate } from './use-syndic-create'
import { downloadCsv } from '@/lib/syndic/v54/export-csv'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/**
 * Condóminos & Inquilinos — port byte-exact du ModCondominos du bundle V5.7.
 * Le bloc conditionnel `InquilinosSection` (window.Sections7) du bundle rend
 * null quand la section n'est pas chargée : on porte donc le corps principal.
 */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const selectStyle = { padding: '10px 14px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13, background: '#fff' } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

export default function ModCondominos() {
  const soon = useComingSoon()
  // Phase 2 : vrais condóminos du cabinet si syndic connecté, sinon mock/vide (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const coproprios = data.coproprios ?? []
  const ocupados = coproprios.filter((c) => c.ocupado).length
  const { push } = useToast()
  const exportCsv = () => {
    if (!real || coproprios.length === 0) {
      push({ kind: 'info', title: 'Exportar CSV', desc: real ? 'Nenhum condómino para exportar.' : 'Conecte-se como síndico para exportar.' })
      return
    }
    downloadCsv(
      'condominos.csv',
      ['Fração', 'Bloco', 'Andar', 'Porta', 'Proprietário', 'Email', 'Telefone', 'Permilagem', 'Ocupação', 'Saldo (€)'],
      coproprios.map((c) => [c.immeuble, c.batiment, c.etage, c.numeroPorte, c.proprietario, c.email, c.telefone, c.tantieme ?? '', c.ocupado ? 'Ocupado' : 'Vago', c.solde ?? '']),
    )
  }

  // Création condómino → POST /api/syndic/coproprios (mappé camelCase côté serveur).
  const { busy, create } = useSyndicCreate('/api/syndic/coproprios')
  const blank = { immeuble: '', batiment: '', etage: '', numeroPorte: '', nomProprietaire: '', emailProprietaire: '', telephoneProprietaire: '', tantieme: '', estOccupe: 'true' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const upd = (k: keyof typeof blank, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setForm(blank); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.nomProprietaire.trim()) { setErrors({ nomProprietaire: 'Indique o nome do proprietário.' }); return }
    create(
      {
        immeuble: form.immeuble, batiment: form.batiment, etage: Number(form.etage) || 0, numeroPorte: form.numeroPorte,
        nomProprietaire: form.nomProprietaire, emailProprietaire: form.emailProprietaire, telephoneProprietaire: form.telephoneProprietaire,
        tantieme: Number(form.tantieme) || 0, estOccupe: form.estOccupe === 'true',
      },
      { okTitle: 'Condómino adicionado', desc: form.nomProprietaire, onDone: () => setOpen(false) },
    )
  }
  return (
    <>
      <PageHead
        title="Condóminos & Inquilinos"
        lede="Proprietários · Arrendatários · Frações · Permilagens"
        actions={<>
          <Button onClick={soon('Importar Gecond', 'Importação Gecond em desenvolvimento')}><Icon name="upload" />Import Gecond</Button>
          <Button onClick={exportCsv}><Icon name="download" />Export CSV</Button>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />Adicionar</Button>
        </>}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label="Pesquisar condómino" style={inputStyle} placeholder="Pesquisar por nome, fração…" />
        </div>
        <select aria-label="Filtrar por condomínio" style={selectStyle}><option>Todos os condomínios</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'grid', num: real ? coproprios.length : 0, lbl: 'Frações total', sub: 'No portefólio', accent: 'gold' },
        { icon: 'check', num: real ? ocupados : 0, lbl: 'Ocupados', sub: 'Por condóminos', accent: 'sage' },
        { icon: 'building', num: real ? coproprios.length - ocupados : 0, lbl: 'Vagos', sub: 'Sem ocupante', accent: 'amber' },
      ]} />
      <Tabs defaultActive="prop" tabs={[
        { id: 'prop', icon: 'users', label: 'Proprietários' },
        { id: 'inq', icon: 'home', label: 'Inquilinos' },
        { id: 'frac', icon: 'grid', label: 'Frações' },
      ]} />
      <Panel flush={real && coproprios.length > 0}>
        {real && coproprios.length > 0 ? (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>Fração</th><th>Proprietário</th><th>Contacto</th><th>Ocupação</th></tr></thead>
              <tbody>
                {coproprios.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.immeuble || '—'}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{[c.batiment, c.etage ? `${c.etage}.º` : '', c.numeroPorte].filter(Boolean).join(' · ')}</div></td>
                    <td>{c.proprietario || '—'}</td>
                    <td className={m.mono} style={{ fontSize: 11.5 }}>{c.email || c.telefone || '—'}</td>
                    <td><Pill kind={c.ocupado ? 'sage' : 'amber'} noDot>{c.ocupado ? 'Ocupado' : 'Vago'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            illustration="condominos"
            title="Nenhum condómino encontrado"
            desc="Adicione condóminos manualmente ou importe-os via Gecond / CSV."
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />Adicionar primeiro condómino</Button>}
          />
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="copro-modal-title" size="md">
        <ModalHead icon="users" id="copro-modal-title" title="Adicionar condómino" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Proprietário" required full name="copro-nome" error={errors.nomProprietaire}>
              <input type="text" placeholder="Nome do proprietário" value={form.nomProprietaire} onChange={(e) => upd('nomProprietaire', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Email" name="copro-email">
                <input type="email" placeholder="email@exemplo.pt" value={form.emailProprietaire} onChange={(e) => upd('emailProprietaire', e.target.value)} />
              </Field>
              <Field label="Telefone" name="copro-tel">
                <input type="tel" placeholder="9XX XXX XXX" value={form.telephoneProprietaire} onChange={(e) => upd('telephoneProprietaire', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Edifício" name="copro-imovel">
                <input type="text" placeholder="Ex.: Edifício Aurora" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Bloco" name="copro-bloco">
                <input type="text" placeholder="A, B…" value={form.batiment} onChange={(e) => upd('batiment', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Andar" name="copro-andar">
                <input type="number" inputMode="numeric" placeholder="0" value={form.etage} onChange={(e) => upd('etage', e.target.value)} />
              </Field>
              <Field label="Porta / Fração" name="copro-porta">
                <input type="text" placeholder="Esq., Dto., 21…" value={form.numeroPorte} onChange={(e) => upd('numeroPorte', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Permilagem" hint="‰ (millièmes)" name="copro-perm">
                <input type="number" min="0" max="1000" inputMode="numeric" placeholder="0" value={form.tantieme} onChange={(e) => upd('tantieme', e.target.value)} />
              </Field>
              <Field label="Ocupação" name="copro-ocup">
                <select value={form.estOccupe} onChange={(e) => upd('estOccupe', e.target.value)}>
                  <option value="true">Ocupado</option>
                  <option value="false">Vago</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Criar condómino</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
