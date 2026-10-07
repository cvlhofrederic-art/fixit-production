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
import { useMessages } from '@/lib/syndic/v54/i18n'
import { CONDOMINOS_MESSAGES } from './i18n/ModCondominos.messages'

/**
 * Condóminos & Inquilinos — port byte-exact du ModCondominos du bundle V5.7.
 * Le bloc conditionnel `InquilinosSection` (window.Sections7) du bundle rend
 * null quand la section n'est pas chargée : on porte donc le corps principal.
 */

const inputStyle = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const selectStyle = { padding: '10px 14px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13, background: '#fff' } as const
const searchIcon = { position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' } as const

export default function ModCondominos() {
  const t = useMessages(CONDOMINOS_MESSAGES)
  const soon = useComingSoon()
  // Phase 2 : vrais condóminos du cabinet si syndic connecté, sinon mock/vide (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const coproprios = data.coproprios ?? []
  const ocupados = coproprios.filter((c) => c.ocupado).length
  const { push } = useToast()
  const exportCsv = () => {
    if (!real || coproprios.length === 0) {
      push({ kind: 'info', title: t.exporter.titre, desc: real ? t.exporter.aucun : t.exporter.connexionRequise })
      return
    }
    downloadCsv(
      t.csv.fichier,
      t.csv.entetes,
      coproprios.map((c) => [c.immeuble, c.batiment, c.etage, c.numeroPorte, c.proprietario, c.email, c.telefone, c.tantieme ?? '', c.ocupado ? t.occupe : t.vacant, c.solde ?? '']),
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
    if (!form.nomProprietaire.trim()) { setErrors({ nomProprietaire: t.erreurNom }); return }
    create(
      {
        immeuble: form.immeuble, batiment: form.batiment, etage: Number(form.etage) || 0, numeroPorte: form.numeroPorte,
        nomProprietaire: form.nomProprietaire, emailProprietaire: form.emailProprietaire, telephoneProprietaire: form.telephoneProprietaire,
        tantieme: Number(form.tantieme) || 0, estOccupe: form.estOccupe === 'true',
      },
      { okTitle: t.ajoute, desc: form.nomProprietaire, onDone: () => setOpen(false) },
    )
  }
  const f = t.formulaire
  return (
    <>
      <PageHead
        title={t.titre}
        lede={t.chapeau}
        actions={<>
          <Button onClick={soon(t.importer.titre, t.importer.desc)}><Icon name="upload" />{t.importer.bouton}</Button>
          <Button onClick={exportCsv}><Icon name="download" />{t.exporter.bouton}</Button>
          <Button variant="gold" onClick={openNew}><Icon name="plus" />{t.ajouter}</Button>
        </>}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" style={searchIcon} />
          <input aria-label={t.recherche.aria} style={inputStyle} placeholder={t.recherche.placeholder} />
        </div>
        <select aria-label={t.filtre.aria} style={selectStyle}><option>{t.filtre.tous}</option></select>
      </div>
      <KPIGrid items={[
        { icon: 'grid', num: real ? coproprios.length : 0, lbl: t.kpi.lots, sub: t.kpi.lotsSous, accent: 'gold' },
        { icon: 'check', num: real ? ocupados : 0, lbl: t.kpi.occupes, sub: t.kpi.occupesSous, accent: 'sage' },
        { icon: 'building', num: real ? coproprios.length - ocupados : 0, lbl: t.kpi.vacants, sub: t.kpi.vacantsSous, accent: 'amber' },
      ]} />
      <Tabs defaultActive="prop" tabs={[
        { id: 'prop', icon: 'users', label: t.onglets.prop },
        { id: 'inq', icon: 'home', label: t.onglets.inq },
        { id: 'frac', icon: 'grid', label: t.onglets.frac },
      ]} />
      <Panel flush={real && coproprios.length > 0}>
        {real && coproprios.length > 0 ? (
          <div className={m.tblWrap}>
            <table className={m.tbl}>
              <thead><tr><th>{t.colonnes.lot}</th><th>{t.colonnes.proprietaire}</th><th>{t.colonnes.contact}</th><th>{t.colonnes.occupation}</th></tr></thead>
              <tbody>
                {coproprios.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.immeuble || '—'}</b><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{[c.batiment, c.etage ? t.etage(c.etage) : '', c.numeroPorte].filter(Boolean).join(' · ')}</div></td>
                    <td>{c.proprietario || '—'}</td>
                    <td className={m.mono} style={{ fontSize: 11.5 }}>{c.email || c.telefone || '—'}</td>
                    <td><Pill kind={c.ocupado ? 'sage' : 'amber'} noDot>{c.ocupado ? t.occupe : t.vacant}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            illustration="condominos"
            title={t.vide.titre}
            desc={t.vide.desc}
            action={<Button variant="gold" onClick={openNew}><Icon name="plus" />{t.vide.action}</Button>}
          />
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="copro-modal-title" size="md">
        <ModalHead icon="users" id="copro-modal-title" title={f.titre} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label={f.proprietaire} required full name="copro-nome" error={errors.nomProprietaire}>
              <input type="text" placeholder={f.proprietairePlaceholder} value={form.nomProprietaire} onChange={(e) => upd('nomProprietaire', e.target.value)} />
            </Field>
            <FormRow>
              <Field label={f.email} name="copro-email">
                <input type="email" placeholder={f.emailPlaceholder} value={form.emailProprietaire} onChange={(e) => upd('emailProprietaire', e.target.value)} />
              </Field>
              <Field label={f.telephone} name="copro-tel">
                <input type="tel" placeholder={f.telephonePlaceholder} value={form.telephoneProprietaire} onChange={(e) => upd('telephoneProprietaire', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.immeuble} name="copro-imovel">
                <input type="text" placeholder={f.immeublePlaceholder} value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label={f.batiment} name="copro-bloco">
                <input type="text" placeholder={f.batimentPlaceholder} value={form.batiment} onChange={(e) => upd('batiment', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.etage} name="copro-andar">
                <input type="number" inputMode="numeric" placeholder="0" value={form.etage} onChange={(e) => upd('etage', e.target.value)} />
              </Field>
              <Field label={f.porte} name="copro-porta">
                <input type="text" placeholder={f.portePlaceholder} value={form.numeroPorte} onChange={(e) => upd('numeroPorte', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={f.tantiemes} hint={f.tantiemesAide} name="copro-perm">
                <input type="number" min="0" max="1000" inputMode="numeric" placeholder="0" value={form.tantieme} onChange={(e) => upd('tantieme', e.target.value)} />
              </Field>
              <Field label={f.occupation} name="copro-ocup">
                <select value={form.estOccupe} onChange={(e) => upd('estOccupe', e.target.value)}>
                  <option value="true">{t.occupe}</option>
                  <option value="false">{t.vacant}</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>{f.annuler}</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{f.creer}</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
