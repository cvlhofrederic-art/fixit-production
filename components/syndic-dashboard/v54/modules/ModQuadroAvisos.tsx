'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { PageHead } from '../primitives/page-head'
import { Panel } from '../primitives/panel'
import { Pill, type PillKind } from '../primitives/pill'
import { Button } from '../primitives/button'
import { Modal, ModalHead, ModalBody, ModalFoot } from '../primitives/modal'
import { Field } from '../primitives/field'
import { FormRow } from '../primitives/form-row'
import { useToast } from '../primitives/toast'
import Icon from '../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../primitives/button/Button.module.css'
import { useSyndicData } from '@/lib/syndic/v54/data-context'

/** Quadro de Avisos — port byte-exact V5.7 + Phase 3 : avisos réels. */

type Aviso = { id: string | null; fixado: string; categoria: string; prioridade: string; expirado: string; titulo: string; desc: string; edificio: string; views: number; color: string; data: string }
const AVISOS: Aviso[] = [
  { id: null, fixado: 'Fixado', categoria: 'Manutenção', prioridade: 'Urgente', expirado: 'Expirado', titulo: 'Corte de água — Manutenção urgente da canalização', desc: 'Informamos que haverá corte de água no dia 15 de março, das 09h às 14h, para reparação urgente de uma fuga na canalização principal do edifício', edificio: 'Edifício Aurora', views: 47, color: 'rust', data: '11/03/26' },
  { id: null, fixado: 'Fixado', categoria: 'Assembleia', prioridade: 'Importante', expirado: 'Expirado', titulo: 'Convocatória — Assembleia Geral Ordinária 2026', desc: 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que se realizará no dia 28 de março de 2026, às 19h00', edificio: 'Edifício Aurora', views: 38, color: 'gold', data: '08/03/26' },
  { id: null, fixado: '', categoria: 'Manutenção', prioridade: 'Urgente', expirado: '', titulo: 'Elevador fora de serviço — Reparação em curso', desc: 'O elevador do Edifício Solaris encontra-se fora de serviço desde hoje. A empresa de manutenção foi contactada e a reparação está prevista para os próximos 2 dias úteis', edificio: 'Edifício Solaris', views: 62, color: 'amber', data: '10/03/26' },
  { id: null, fixado: '', categoria: 'Financeiro', prioridade: 'Importante', expirado: '', titulo: 'Renovação do Seguro Multirriscos', desc: 'Informamos que o seguro multirriscos do condomínio foi renovado com a Fidelidade Seguros, com efeito a partir de 1 de abril', edificio: '—', views: 25, color: 'sage', data: '07/03/26' },
  { id: null, fixado: '', categoria: 'Manutenção', prioridade: '', expirado: '', titulo: 'Horário de limpeza das áreas comuns', desc: 'A partir de 1 de abril, o horário de limpeza das áreas comuns será alterado para as manhãs (08h-11h) em vez do período da tarde', edificio: '—', views: 19, color: '', data: '06/03/26' },
  { id: null, fixado: '', categoria: 'Manutenção', prioridade: '', expirado: '', titulo: 'Manutenção do jardim — Primavera 2026', desc: 'Iniciamos esta semana os trabalhos de manutenção do jardim e espaços verdes. Serão realizados podas, plantação de novas flores', edificio: 'Edifício Atlântico', views: 14, color: '', data: '05/03/26' },
  { id: null, fixado: '', categoria: 'Segurança', prioridade: '', expirado: '', titulo: 'Regras de segurança — Portas de acesso', desc: 'Relembramos todos os condóminos da importância de manter as portas de acesso ao edifício sempre fechadas. Não abram a porta a pessoas desconhecidas', edificio: '—', views: 31, color: '', data: '04/03/26' },
  { id: null, fixado: '', categoria: 'Social', prioridade: 'Expirado', expirado: '', titulo: 'Festa de Vizinhos — 20 de março', desc: 'Convidamos todos os moradores para a Festa de Vizinhos que se realizará no dia 20 de março, às 18h30, no terraço do Edifício Aurora', edificio: 'Edifício Aurora', views: 42, color: 'sage', data: '03/03/26' },
]
const COR: Record<string, string> = { rust: 'var(--v54-rust-500)', amber: 'var(--v54-amber-500)', gold: 'var(--v54-gold-500)', sage: 'var(--v54-sage-500)' }
const avisoCard = { background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 14, boxShadow: 'var(--v54-shadow-card)', padding: '18px 20px', marginBottom: 12 } as const
const fieldInput = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const
const prioKind = (p: string): PillKind | undefined => (p === 'Urgente' ? 'rust' : p === 'Importante' ? 'gold' : undefined)
const ACOES: [IconName, string, string][] = [['siren', 'Aviso Urgente', 'urgente'], ['bank', 'Convocatória AG', 'assembleia'], ['coin', 'Aviso Financeiro', 'financeiro']]

const CAT_LABEL: Record<string, string> = { manutencao: 'Manutenção', assembleia: 'Assembleia', financeiro: 'Financeiro', seguranca: 'Segurança', social: 'Social', outro: 'Outro' }
const PRIO_LABEL: Record<string, string> = { urgente: 'Urgente', importante: 'Importante', normal: '' }
const fmtDate = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`
}

export default function ModQuadroAvisos() {
  // Phase 3 : vrais avisos du cabinet si syndic connecté, sinon mock (preview).
  const data = useSyndicData()
  const real = data.authenticated
  const avisos: Aviso[] = real
    ? (data.avisos ?? []).map((a) => ({
        id: a.id, fixado: a.fixado ? 'Fixado' : '', categoria: CAT_LABEL[a.categoria] ?? a.categoria,
        prioridade: PRIO_LABEL[a.prioridade] ?? '', expirado: '', titulo: a.titulo, desc: a.descricao,
        edificio: a.immeuble || '—', views: a.views,
        color: a.prioridade === 'urgente' ? 'rust' : a.prioridade === 'importante' ? 'gold' : '', data: fmtDate(a.createdAt),
      }))
    : AVISOS

  // Sidebar (réel calculé / mock statique).
  const catCount = (key: string) => (data.avisos ?? []).filter((a) => a.categoria === key).length
  const DISTRIB: [string, number][] = real
    ? [['Manutenção', catCount('manutencao')], ['Assembleia', catCount('assembleia')], ['Financeiro', catCount('financeiro')], ['Segurança', catCount('seguranca')], ['Social', catCount('social')], ['Outro', catCount('outro')]]
    : [['Manutenção', 4], ['Assembleia', 1], ['Financeiro', 1], ['Segurança', 1], ['Social', 1], ['Outro', 0]]
  const totalViews = (data.avisos ?? []).reduce((s, a) => s + (a.views || 0), 0)
  const RESUMO: [IconName, number, string][] = real
    ? [['clipboard', avisos.length, 'Avisos ativos'], ['eye', totalViews, 'Total visualizações'], ['pin', (data.avisos ?? []).filter((a) => a.fixado).length, 'Avisos fixados']]
    : [['clipboard', 8, 'Avisos ativos'], ['calendar', 0, 'Avisos este mês'], ['eye', 62, 'Elevador fora de serviço — Rep…']]

  // Phase 3 écritures : « Novo Aviso » / Ações Rápidas → POST /api/syndic/avisos.
  const { push } = useToast()
  const blank = { titulo: '', descricao: '', categoria: 'outro', prioridade: 'normal', immeuble: '', fixado: 'nao' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const upd = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }))
  const openNew = (categoria?: string, prioridade?: string) => { setForm({ ...blank, categoria: categoria || 'outro', prioridade: prioridade || 'normal' }); setErrors({}); setOpen(true) }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.titulo.trim()) errs.titulo = 'O título é obrigatório.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (real && data.token) {
      setBusy(true)
      fetch('/api/syndic/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ titulo: form.titulo, descricao: form.descricao, categoria: form.categoria, prioridade: form.prioridade, immeuble: form.immeuble, fixado: form.fixado === 'sim' }),
      })
        .then((res) => { if (!res.ok) throw new Error() })
        .then(() => { data.refresh?.(); setOpen(false); push({ kind: 'success', title: 'Aviso publicado', desc: form.titulo }) })
        .catch(() => push({ kind: 'error', title: 'Erro ao publicar', desc: 'Tente novamente mais tarde' }))
        .finally(() => setBusy(false))
      return
    }
    setOpen(false)
    push({ kind: 'info', title: 'Aviso publicado (demo)', desc: 'Conecte-se como síndico para gravar a sério' })
  }

  return (
    <>
      <PageHead title="Quadro de Avisos" lede="Comunique com os condóminos de forma clara e organizada"
        actions={<Button variant="gold" onClick={() => openNew()}><Icon name="plus" />Novo Aviso</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}><Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} /><input aria-label="Pesquisar avisos" style={fieldInput} placeholder="Pesquisar avisos…" /></div>
        <select className={btnCss.btn} aria-label="Estado"><option>Ativos</option></select>
        <select className={btnCss.btn} aria-label="Categoria"><option>Todas as categorias</option></select>
        <select className={btnCss.btn} aria-label="Prioridade"><option>Todas as prioridades</option></select>
        <select className={btnCss.btn} aria-label="Imóvel"><option>Todos os imóveis</option></select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {avisos.length === 0 ? (
            <div style={{ ...avisoCard, color: 'var(--v54-navy-300)', fontSize: 13 }}>Nenhum aviso publicado. Comunique com os seus condóminos com « Novo Aviso ».</div>
          ) : avisos.map((a, i) => (
            <div key={a.id ?? i} style={{ ...avisoCard, borderLeft: `3px solid ${COR[a.color] || 'var(--v54-navy-300)'}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {a.fixado && <Pill kind="gold" noDot>{a.fixado}</Pill>}
                <Pill noDot>{a.categoria}</Pill>
                {a.prioridade && <Pill kind={prioKind(a.prioridade)} noDot>{a.prioridade}</Pill>}
                {a.expirado && <Pill noDot>{a.expirado}</Pill>}
              </div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 6 }}>{a.titulo}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 8 }}>{a.desc}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--v54-navy-300)' }}>
                <span>{a.edificio === '—' ? 'Administração' : 'Gestor'}</span><span>{a.data}</span><span>{a.edificio}</span><span>{a.views}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <Panel title="Resumo">
            {RESUMO.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--v54-line)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)' }}><Icon name={s[0]} /></div>
                <div><div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20 }}>{s[1]}</div><div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{s[2]}</div></div>
              </div>
            ))}
          </Panel>
          <Panel title="Distribuição por Categoria">
            {DISTRIB.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: i < 5 ? '1px solid var(--v54-line)' : 'none' }}>
                <span>{c[0]}</span><b>{c[1]}</b>
              </div>
            ))}
          </Panel>
          <Panel title="Ações Rápidas">
            {ACOES.map((q, i) => (
              <Button key={i} onClick={() => openNew(q[2], q[2] === 'urgente' ? 'urgente' : 'importante')} style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, padding: '10px 14px', background: 'var(--v54-cream)' }}><Icon name={q[0]} /> <span>{q[1]}</span></Button>
            ))}
          </Panel>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="na-title" size="md">
        <ModalHead icon="clipboard" id="na-title" title="Novo aviso" onClose={() => setOpen(false)} />
        <form onSubmit={submit} noValidate>
          <ModalBody>
            <Field label="Título" required full name="na-tit" error={errors.titulo}>
              <input type="text" placeholder="Ex.: Corte de água programado" value={form.titulo} onChange={(e) => upd('titulo', e.target.value)} />
            </Field>
            <Field label="Descrição" full name="na-desc">
              <textarea rows={3} placeholder="Mensagem aos condóminos…" value={form.descricao} onChange={(e) => upd('descricao', e.target.value)} />
            </Field>
            <FormRow>
              <Field label="Categoria" name="na-cat">
                <select value={form.categoria} onChange={(e) => upd('categoria', e.target.value)}>
                  <option value="manutencao">Manutenção</option>
                  <option value="assembleia">Assembleia</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="seguranca">Segurança</option>
                  <option value="social">Social</option>
                  <option value="outro">Outro</option>
                </select>
              </Field>
              <Field label="Prioridade" name="na-prio">
                <select value={form.prioridade} onChange={(e) => upd('prioridade', e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="importante">Importante</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Edifício" name="na-imovel">
                <input type="text" placeholder="Opcional — todos se vazio" value={form.immeuble} onChange={(e) => upd('immeuble', e.target.value)} />
              </Field>
              <Field label="Fixar no topo" name="na-fix">
                <select value={form.fixado} onChange={(e) => upd('fixado', e.target.value)}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
            </FormRow>
          </ModalBody>
          <ModalFoot>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <button type="submit" className={clsx(btnCss.btn, btnCss.gold)} disabled={busy}>Publicar</button>
          </ModalFoot>
        </form>
      </Modal>
    </>
  )
}
