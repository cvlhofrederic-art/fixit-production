'use client'

// Cockpit (ModCockpit) — port byte-exact du mockup v8 FR. LE module central :
// hero (rôle + stats), radar des mandats, file d'actions filtrée par rôle
// (TASKS), centre d'automatisation (BATCH + MandateWizard), génération express
// d'actes (DOC_TEMPLATES → DocModal) et raccourcis assistants IA.

import { useState } from 'react'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill, type PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Alert } from '@/components/syndic-dashboard/v54/primitives/alert'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import type { IconName } from '@/lib/syndic/icon-names'
import dash from '@/components/syndic-dashboard/v54/modules/ModDashboard.module.css'
import { COPROS, TOTAL_LOTS, byCode } from '../data/mock'
import { TASKS, BATCH, type Task } from '../data/tasks'
import { DOC_TEMPLATES, type DocTemplate, type DocTemplateKey } from '../data/doc-templates'
import { TODAY, daysUntil } from '../lib/format'
import { useRole, ROLE_LABEL, ROLE_ICON } from '../lib/role-context'
import DocModal from '../shared/DocModal'
import MandateWizard from '../shared/MandateWizard'

interface Urgency {
  lbl: string
  k?: PillKind
}

const urgency = (d: number | null): Urgency =>
  d == null ? { lbl: '—' }
    : d < 0 ? { lbl: `Retard ${Math.abs(d)} j`, k: 'rust' }
      : d === 0 ? { lbl: "Aujourd'hui", k: 'rust' }
        : d <= 3 ? { lbl: `J-${d}`, k: 'amber' }
          : d <= 10 ? { lbl: `J-${d}`, k: 'gold' }
            : { lbl: `J-${d}`, k: 'sage' }

const ASSISTANTS: ReadonlyArray<readonly [string, string, string, IconName]> = [
  ['max', 'Max — Juridique', 'Rédige requêtes, vérifie la procédure', 'grad'],
  ['lea', 'Léa — Comptable', 'Contrôle le compte séparé, les impayés', 'sparkle'],
  ['alfredo', 'Alfredo — Courriers', 'Génère et envoie les LRAR', 'mail'],
  ['tempo', 'Tempo — Échéances', 'Surveille tous les délais légaux', 'clock'],
]

const radarGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 8 } as const
const radarCard = { textAlign: 'left', cursor: 'pointer', background: 'var(--v54-paper)', border: '1px solid var(--v54-line)', borderRadius: 12, padding: 16 } as const
const radarCode = { width: 30, height: 30, borderRadius: 8, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', fontFamily: 'var(--v54-font-serif)', fontWeight: 600 } as const
const taskRow = { display: 'flex', alignItems: 'center', gap: 14, padding: '15px 22px', borderBottom: '1px solid var(--v54-line)' } as const
const autoBtn = { display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 10, padding: 14 } as const
const autoIco = { width: 36, height: 36, borderRadius: 9, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', flexShrink: 0 } as const
const wizBtn = { ...autoBtn, background: 'linear-gradient(135deg,var(--v54-gold-50),#fff)', border: '1px solid var(--v54-gold-100)' } as const
const wizIco = { ...autoIco, background: 'var(--v54-gold-100)', color: 'var(--v54-gold-700)' } as const
const tplBtn = { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', background: '#fff', border: '1px solid var(--v54-line)', borderRadius: 10, padding: '12px 14px' } as const
const tplIco = { width: 34, height: 34, borderRadius: 9, background: 'var(--v54-cream)', display: 'grid', placeItems: 'center', color: 'var(--v54-navy-700)', flexShrink: 0 } as const

export default function ModCockpit({ onNavigate }: Readonly<{ onNavigate?: (id: string) => void }>) {
  const role = useRole()
  const { push } = useToast()
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const [doc, setDoc] = useState<{ tpl: DocTemplateKey; code: string } | null>(null)
  const [wiz, setWiz] = useState(false)
  const openDoc = (tpl: DocTemplateKey, code: string) => setDoc({ tpl, code })
  const go = (r: string) => onNavigate?.(r)
  const toggleDone = (id: string) =>
    setDone((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const mine: (Task & { d: number | null })[] = (role === 'Direction' ? TASKS : TASKS.filter((t) => t.role === role))
    .map((t) => ({ ...t, d: daysUntil(t.due) }))
    .sort((a, b) => (a.d ?? 999) - (b.d ?? 999))
  const openCount = mine.filter((t) => !done.has(t.id)).length
  const lateCount = mine.filter((t) => !done.has(t.id) && t.d != null && t.d < 0).length
  const todayCount = mine.filter((t) => !done.has(t.id) && t.d === 0).length
  const hoursSaved = (12.5 + done.size * 0.6).toFixed(1)

  const greet = TODAY.getHours() < 13 ? 'Bonjour' : 'Bonsoir'
  const lateTitle = `${lateCount} échéance${lateCount > 1 ? 's' : ''} légale${lateCount > 1 ? 's' : ''} dépassée${lateCount > 1 ? 's' : ''}`

  return (
    <>
      <div className={dash.hero}>
        <div className={dash.heroGrid}>
          <div>
            <div className={dash.dateLine}>{new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(TODAY)}</div>
            <h1 className={dash.heroTitle}>{greet} — <i>{ROLE_LABEL[role]}</i></h1>
            <div className={dash.lede}>Votre poste de travail du jour. Les obligations légales de chaque mandat sont calculées et priorisées automatiquement — agissez en un clic.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Pill kind="dark" noDot><Icon name={ROLE_ICON[role]} style={{ width: 12, height: 12, verticalAlign: '-1px', marginRight: 4 }} />{role}</Pill>
              <Pill kind={lateCount ? 'rust' : 'sage'}>{openCount} action{openCount > 1 ? 's' : ''} à mener</Pill>
              {lateCount > 0 && <Pill kind="rust">{lateCount} en retard</Pill>}
              <Pill kind="gold">~{hoursSaved} h économisées ce mois</Pill>
            </div>
          </div>
          <div className={dash.heroDivider}></div>
          <div className={dash.heroStat}><div className={dash.statLabel}>À mener</div><div className={dash.statVal}>{openCount}</div><div className={dash.statSub}>{role === 'Direction' ? 'tout le cabinet' : role}</div></div>
          <div className={dash.heroDivider}></div>
          <div className={dash.heroStat}><div className={dash.statLabel}>Aujourd&apos;hui</div><div className={dash.statVal}>{todayCount}</div><div className={dash.statSub}>{lateCount} en retard</div></div>
          <div className={dash.heroDivider}></div>
          <div className={dash.heroStat}><div className={dash.statLabel}>Mandats</div><div className={dash.statVal}>{COPROS.length}</div><div className={dash.statSub}>{TOTAL_LOTS} lots · TJ Nanterre</div></div>
        </div>
      </div>

      {lateCount > 0 && (
        <Alert icon="siren" title={lateTitle}>
          Une échéance non tenue engage la responsabilité du cabinet auprès du tribunal. Traitez les actions en rouge en priorité — l&apos;acte correspondant se génère en un clic.
        </Alert>
      )}

      <div className={dash.sectionEyebrow}><span>Radar des mandats — prochaine échéance de mission</span><div className={dash.eyebrowLine}></div></div>
      <div style={radarGrid}>
        {COPROS.map((c) => {
          const d = daysUntil(c.echeance)
          const u = urgency(d)
          return (
            <button key={c.id} type="button" onClick={() => go('mandats')} style={radarCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={radarCode}>{c.code}</span>
                <Pill kind={u.k} noDot>{u.lbl}</Pill>
              </div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>{c.nom}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 3 }}>{c.fondement}</div>
              <div style={{ fontSize: 11.5, color: 'var(--v54-navy-500)', marginTop: 6 }}>Fin de mission · {c.echeance}</div>
            </button>
          )
        })}
      </div>

      <Panel
        title={role === 'Direction' ? "File d'actions du cabinet" : `Ma file d'actions — ${role}`}
        sub="Générée automatiquement depuis les échéances légales · triée par urgence"
        icon="clipboard"
        right={<><Pill kind="dark" noDot>Auto</Pill><Pill kind="sage" noDot>{openCount} ouverte{openCount > 1 ? 's' : ''}</Pill></>}
        flush
      >
        {mine.length === 0 && <div style={{ padding: '26px', textAlign: 'center', color: 'var(--v54-navy-300)', fontSize: 13 }}>Aucune action pour ce rôle. Tout est à jour.</div>}
        {mine.map((t) => {
          const isDone = done.has(t.id)
          const u = urgency(t.d)
          const c = byCode(t.code)
          return (
            <div key={t.id} style={{ ...taskRow, opacity: isDone ? 0.5 : 1 }}>
              <button
                type="button"
                onClick={() => toggleDone(t.id)}
                aria-label={isDone ? 'Rouvrir' : 'Marquer comme fait'}
                title={isDone ? 'Rouvrir' : 'Marquer comme fait'}
                style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${isDone ? 'var(--v54-sage-500)' : 'var(--v54-line)'}`, background: isDone ? 'var(--v54-sage-500)' : '#fff', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
              >
                {isDone && <Icon name="check" style={{ width: 13, height: 13 }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, textDecoration: isDone ? 'line-through' : 'none' }}>{t.title}</span>
                  {role === 'Direction' && <Pill kind="dark" noDot>{t.role}</Pill>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 3 }}>{c.nom} · {t.basis}</div>
              </div>
              <Pill kind={u.k} noDot>{u.lbl}</Pill>
              {!isDone && t.kind === 'doc' && (
                <Button variant="gold" size="sm" onClick={() => { if (t.tpl) openDoc(t.tpl, t.code) }}>
                  <Icon name="doc" />Générer
                </Button>
              )}
              {!isDone && t.kind === 'nav' && (
                <Button variant="ghost" size="sm" onClick={() => { if (t.nav) go(t.nav) }}>{t.act || 'Ouvrir'}</Button>
              )}
              {!isDone && t.kind === 'todo' && (
                <Button size="sm" style={{ background: 'var(--v54-sage-500)', color: '#fff', border: 'none' }}
                  onClick={() => { toggleDone(t.id); push({ kind: 'success', title: t.act || 'Fait', desc: t.title }) }}>
                  {t.act || 'Fait'}
                </Button>
              )}
              {isDone && <span style={{ fontSize: 11.5, color: 'var(--v54-sage-700)', fontWeight: 600 }}>Fait ✓</span>}
            </div>
          )
        })}
      </Panel>

      <Panel title="Centre d'automatisation" sub="Traitement par lot — un clic pour toute la charge récurrente de votre rôle" icon="bolt">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
          <button type="button" onClick={() => setWiz(true)} style={wizBtn}>
            <span style={wizIco}><Icon name="scale" style={{ width: 18, height: 18 }} /></span>
            <span style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>Configurer un nouveau mandat</b><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>Auto-planifie échéances, tâches &amp; actes</div></span>
          </button>
          {BATCH.filter((b) => role === 'Direction' || b.roles.includes(role)).map((b) => (
            <button key={b.id} type="button" onClick={() => push({ kind: 'success', title: b.label, desc: b.run() })} style={autoBtn}>
              <span style={autoIco}><Icon name={b.icon} style={{ width: 18, height: 18 }} /></span>
              <span style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{b.label}</b><div style={{ fontSize: 11, color: 'var(--v54-navy-300)' }}>{b.hint}</div></span>
            </button>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <Panel title="Génération express d'actes" sub="Un clic = l'acte prêt, données du mandat fusionnées" icon="sparkle">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.entries(DOC_TEMPLATES) as [DocTemplateKey, DocTemplate][]).map(([k, t]) => (
              <button key={k} type="button" onClick={() => openDoc(k, t.code)} style={tplBtn}>
                <span style={tplIco}><Icon name={t.icon} style={{ width: 17, height: 17 }} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Assistants IA" sub="Délègue les tâches chronophages" icon="bot">
          {ASSISTANTS.map(([id, nom, desc, ic]) => (
            <button key={id} type="button" onClick={() => go(id)} className={dash.listRow} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent' }}>
              <div className={dash.thumb}><Icon name={ic} style={{ width: 18, height: 18 }} /></div>
              <div className={dash.info}><b>{nom}</b><div className={dash.meta}><span>{desc}</span></div></div>
              <div></div>
              <Icon name="arrow" style={{ width: 14, height: 14, color: 'var(--v54-navy-200)' }} />
            </button>
          ))}
        </Panel>
      </div>

      <DocModal open={!!doc} tplKey={doc?.tpl ?? null} initialCode={doc?.code} onClose={() => setDoc(null)} />
      <MandateWizard open={wiz} onClose={() => setWiz(false)} />
    </>
  )
}
