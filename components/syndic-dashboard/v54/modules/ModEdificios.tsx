'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Pill } from '../primitives/pill'
import { KPIGrid } from '../primitives/kpi'
import { Progress } from '../primitives/progress'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import btnCss from '../primitives/button/Button.module.css'
import m from './modules.module.css'
import { NovaMissaoModal } from './NovaMissaoModal'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import type { Immeuble } from '@/components/syndic-dashboard/types'

/** Edifícios — port byte-exact du ModEdificios du bundle V5.7 (utilise Progress). */

const BUILDINGS = [
  ['Edifício Atlântico', 'Avenida da Boavista, 1247, 4100-130 Porto', 12, 2008, '15/09', '8', 28450, 48000, 'Regulamento em falta'],
  ['Condomínio Boavista Center', 'Avenida da Boavista, 3265, 4100-138 Porto', 8, 2015, '30/06', '4', 18700, 36000, 'Regulamento em falta'],
  ['Residencial Cedofeita', 'Rua de Cedofeita, 421, 4050-180 Porto', 10, 1998, '22/04', '11', 33820, 42000, 'Regulamento em falta'],
  ['Edifício Foz Douro', 'Rua do Passeio Alegre, 78, 4150-573 Porto', 10, 2020, '10/01', '2', 21500, 62000, 'Regulamento em falta'],
] as const

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)
const eur = (n: number) => n.toLocaleString('pt-PT')

type Row = readonly [string, string, number, number, string, string, number, number, string]

/** Mappe un immeuble réel vers la tuple de rendu d'une carte (Phase 2). */
function immToRow(i: Immeuble): Row {
  return [
    i.nom,
    [i.adresse, i.codePostal, i.ville].filter(Boolean).join(', '),
    i.nbLots ?? 0,
    i.anneeConstruction ?? 0,
    i.prochainControle ?? '—',
    String(i.nbInterventions ?? 0),
    i.depensesAnnee ?? 0,
    i.budgetAnnuel ?? 0,
    i.reglementTexte ? 'Regulamento OK' : 'Regulamento em falta',
  ]
}

export default function ModEdificios() {
  // Phase 2 : vraies données du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const items: ReadonlyArray<{ row: Row; im: Immeuble | null }> = real
    ? data.immeubles.map((i) => ({ row: immToRow(i), im: i }))
    : BUILDINGS.map((r) => ({ row: r, im: null }))
  const buildings = items.map((it) => it.row)
  const totalFracoes = buildings.reduce((acc, b) => acc + b[2], 0)

  // Phase 2 écritures : « Adicionar edifício » → POST /api/syndic/immeubles.
  const { push } = useToast()
  const blank = { nom: '', adresse: '', ville: '', codePostal: '', nbLots: '', budgetAnnuel: '' }
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = () => { setEditId(null); setForm(blank); setErrors({}); setOpen(true) }
  const openEdit = (im: Immeuble | null) => {
    setEditId(im?.id ?? null)
    setForm(im
      ? { nom: im.nom ?? '', adresse: im.adresse ?? '', ville: im.ville ?? '', codePostal: im.codePostal ?? '', nbLots: im.nbLots != null ? String(im.nbLots) : '', budgetAnnuel: im.budgetAnnuel != null ? String(im.budgetAnnuel) : '' }
      : blank)
    setErrors({}); setOpen(true)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.nom.trim()) errs.nom = 'O nome é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    const fields = { nom: form.nom, adresse: form.adresse, ville: form.ville, codePostal: form.codePostal, nbLots: Number(form.nbLots) || 1, budgetAnnuel: Number(form.budgetAnnuel) || 0 }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/immeubles', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify(editId ? { id: editId, ...fields } : fields),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: editId ? 'Edifício atualizado' : 'Edifício adicionado', desc: form.nom }) })
        .catch(() => push({ kind: 'error', title: editId ? 'Erro ao atualizar' : 'Erro ao adicionar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: editId ? 'Edifício atualizado (demo)' : 'Edifício adicionado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  // Phase 2 raccourci : « Nova missão » sur une carte → Nova missão pré-remplie pour cet edifício.
  const [missaoImovel, setMissaoImovel] = useState<string | null>(null)
  return (
    <>
      <PageHead
        title="Edifícios"
        lede={`${buildings.length} edifícios na sua carteira · ${real ? totalFracoes : 40} frações totais`}
        actions={<Button variant="gold" onClick={openNew}><Icon name="plus" />Adicionar um edifício</Button>}
      />
      <KPIGrid items={[
        { icon: 'building', num: real ? data.immeubles.length : 4, lbl: 'Edifícios geridos', sub: 'Carteira ativa' },
        { icon: 'grid', num: real ? totalFracoes : 40, lbl: 'Frações totais', sub: 'Total de frações', accent: 'gold' },
        { icon: 'clipboard', num: real ? data.missions.filter((mi) => mi.statut === 'en_cours' || mi.statut === 'acceptee').length : 25, lbl: 'Intervenções ativas', sub: 'Em curso', accent: 'sage' },
        { icon: 'alert', num: real ? data.immeubles.filter((i) => !i.reglementTexte).length : 4, lbl: 'Documentos em falta', sub: 'Regulamentos a adicionar', accent: 'amber' },
      ]} />
      {items.map(({ row: b, im }) => (
        <div key={b[0]} className={m.card} style={{ marginBottom: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name="building" style={{ width: 24, height: 24 }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em' }}>{b[0]}</div>
              <div style={{ fontSize: 12.5, color: 'var(--v54-navy-300)', marginTop: 2 }}>{b[1]}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill noDot>{b[2]} frações</Pill>
                <Pill noDot>Construído em {b[3]}</Pill>
                <Pill kind={b[8] === 'Regulamento OK' ? 'sage' : 'amber'} noDot>{b[8]}</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => openEdit(im)}><Icon name="pencil" />Editar</Button>
              <Button aria-label="Suspender edifício" title="Suspender"><Icon name="ban" /></Button>
              <Button variant="gold" onClick={() => setMissaoImovel(b[0])}><Icon name="plus" />Nova missão</Button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 18 }}>
            <div><div className={m.statKey}>Frações</div><div className={m.statBig}>{b[2]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Total de frações</div></div>
            <div><div className={m.statKey}>Construído em</div><div className={m.statBig}>{b[3]}</div></div>
            <div><div className={m.statKey}>Intervenções</div><div className={m.statBig}>{b[5]}</div><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Em curso</div></div>
            <div><div className={m.statKey}>Próxima inspeção</div><div className={m.statBig}>{b[4]}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}><span style={{ color: 'var(--v54-gold-700)', fontWeight: 600 }}>Orçamento 2026</span><span className={m.mono} style={{ color: 'var(--v54-navy-500)' }}>{eur(b[6])} € / {eur(b[7])} €</span></div>
          <Progress pct={pct(b[6], b[7])} />
          <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 12, color: 'var(--v54-navy-300)' }}>
            <span style={{ color: 'var(--v54-gold-700)', fontWeight: 600, cursor: 'pointer' }}>Adicionar o regulamento de condomínio</span>
            <div style={{ flex: 1 }} />
            <span style={{ cursor: 'pointer' }}>Condóminos</span>
            <span style={{ cursor: 'pointer' }}>Documentos (GED)</span>
            <span style={{ cursor: 'pointer' }}>Histórico</span>
          </div>
        </div>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ne-title" size="md">
        <ModalHead icon="building" id="ne-title" title={editId ? 'Editar edifício' : 'Adicionar edifício'} onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Nome do edifício" required full name="ne-nom" error={errors.nom}>
              <input type="text" placeholder="Ex.: Edifício Aurora" value={form.nom} onChange={(e) => upd('nom', e.target.value)} />
            </Field>
            <Field label="Morada" full name="ne-adr">
              <input type="text" placeholder="Rua, número" value={form.adresse} onChange={(e) => upd('adresse', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Cidade" name="ne-ville">
                <input type="text" placeholder="Porto" value={form.ville} onChange={(e) => upd('ville', e.target.value)} />
              </Field>
              <Field label="Código postal" name="ne-cp">
                <input type="text" placeholder="4000-000" value={form.codePostal} onChange={(e) => upd('codePostal', e.target.value)} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="N.º de frações" name="ne-lots">
                <input type="number" min="1" inputMode="numeric" placeholder="1" value={form.nbLots} onChange={(e) => upd('nbLots', e.target.value)} />
              </Field>
              <Field label="Orçamento anual (€)" name="ne-budget">
                <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.budgetAnnuel} onChange={(e) => upd('budgetAnnuel', e.target.value)} />
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>{editId ? 'Guardar' : 'Adicionar'}</button>
          </ModalFoot>
        </form>
      </Modal>

      <NovaMissaoModal open={missaoImovel != null} onClose={() => setMissaoImovel(null)} prefillImmeuble={missaoImovel ?? ''} lockImmeuble />
    </>
  )
}
