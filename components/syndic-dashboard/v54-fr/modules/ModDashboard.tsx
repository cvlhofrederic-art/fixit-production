'use client'

// Tableau de bord (lot A) — port du ModDashboard du mockup v8 : hero strip
// (date épinglée + stats portefeuille), actions rapides, KPIGrid, suivi
// budgétaire cumulé (chiffres + barre empilée), échéances prioritaires et état
// des mandats. Réutilise le CSS Module du ModDashboard PT (classes identiques).

import { useToast, type ToastInput } from '@/components/syndic-dashboard/v54/primitives/toast'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from '@/components/syndic-dashboard/v54/modules/ModDashboard.module.css'
import { COPROS, OBLIGATIONS, TOTAL_BUDGET, TOTAL_DEPENSE, TOTAL_IMPAYES, TOTAL_LOTS } from '../data/mock'
import { fmtEUR, pctv, TODAY } from '../lib/format'

interface QuickAction {
  id: string
  t: string
  d: string
  icon: IconName
  toast: ToastInput
}

const QUICK: QuickAction[] = [
  { id: 'ag', t: 'Convoquer une AG élective', d: "Désignation d'un syndic", icon: 'bank',
    toast: { kind: 'info', title: "Convocation d'AG", desc: "Ouverture de l'assistant de convocation" } },
  { id: 'fees', t: 'Établir un état de frais', d: 'Taxation — CPC 704-718', icon: 'coin',
    toast: { kind: 'info', title: 'État de frais', desc: "Nouveau bordereau d'honoraires" } },
  { id: 'os', t: 'Enregistrer une intervention', d: 'Ordre de service', icon: 'clipboard',
    toast: { kind: 'info', title: 'Ordre de service', desc: "Création d'un ordre de service" } },
  { id: 'notif', t: 'Notifier une ordonnance', d: 'Art. 64 du décret 1967', icon: 'doc',
    toast: { kind: 'info', title: 'Notification', desc: 'Assistant de notification aux copropriétaires' } },
]

/** Rampe de dégradés par copropriété (ordre COPROS) — tokens --v54-*. */
const RAMP = [
  ['sage-700', 'sage-500'],
  ['gold-600', 'gold-500'],
  ['rust-700', 'rust-500'],
  ['amber-700', 'amber-500'],
] as const
const rampBg = (i: number) => `linear-gradient(90deg, var(--v54-${RAMP[i][0]}), var(--v54-${RAMP[i][1]}))`

const eyebrowStyle = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', fontWeight: 600 } as const
const figVal = { fontFamily: 'var(--v54-font-serif)', fontSize: 34, marginTop: 6 } as const
const figSub = { fontSize: 11.5, color: 'var(--v54-navy-300)', marginTop: 4 } as const

/** Lien d'en-tête de panel (« Voir tout → ») — bouton stylé, pas de <a href="#">. */
const linkBtn = {
  fontSize: 12, color: 'var(--v54-gold-700)', fontWeight: 600, cursor: 'pointer',
  background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
} as const

/** Resets bouton pour les lignes de liste cliquables (classe .listRow du CSS Module). */
const listRowBtn = {
  width: '100%', background: 'transparent', font: 'inherit', textAlign: 'left',
  cursor: 'pointer', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
} as const

export default function ModDashboard({ onNavigate }: Readonly<{ onNavigate?: (id: string) => void }>) {
  const { push } = useToast()
  const dateStr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(TODAY)
  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroGrid}>
          <div>
            <div className={styles.dateLine}>{dateStr}</div>
            <h1 className={styles.heroTitle}>Bonjour, <i>Cabinet Delaunay</i></h1>
            <div className={styles.lede}>Portefeuille des mandats judiciaires — copropriétés administrées par désignation du Tribunal judiciaire de Nanterre. Suivi des missions, échéances et état opérationnel.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Pill kind="sage">4 mandats actifs</Pill>
              <Pill kind="amber">1 AG élective à convoquer</Pill>
              <Pill kind="rust">1 reddition due</Pill>
            </div>
          </div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Lots sous mandat</div><div className={styles.statVal}>{TOTAL_LOTS}</div><div className={styles.statSub}>en 4 copropriétés</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Échéance la + proche</div><div className={styles.statVal}>48<span className={styles.statCur}> j</span></div><div className={styles.statSub}>Clos des Vignes · AG</div></div>
          <div className={styles.heroDivider} />
          <div className={styles.heroStat}><div className={styles.statLabel}>Impayés à recouvrer</div><div className={styles.statVal}>65<span className={styles.statCur}>k €</span></div><div className={styles.statSub}>5 copropriétaires</div></div>
        </div>
      </div>

      <div className={styles.sectionEyebrow}><span>Actions rapides</span><div className={styles.eyebrowLine} /></div>
      <div className={styles.quick}>
        {QUICK.map((qa) => (
          <button key={qa.id} type="button" className={styles.qa} onClick={() => push(qa.toast)}>
            <div className={styles.qaIco}><Icon name={qa.icon} /></div>
            <div className={styles.qaText}><b>{qa.t}</b><span>{qa.d}</span></div>
            <svg className={styles.qaArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        ))}
      </div>

      <KPIGrid
        items={[
          { icon: 'building', num: 4, lbl: 'Copropriétés sous mandat', sub: `${TOTAL_LOTS} lots · TJ Nanterre`, trend: { kind: 'flat', label: 'stable' } },
          { icon: 'scale', num: 10, lbl: 'Échéances de conformité', sub: '3 urgentes · 1 critique', accent: 'amber', trend: { kind: 'warn', label: '3 à traiter' } },
          { icon: 'coin', num: fmtEUR(TOTAL_IMPAYES), lbl: 'Impayés à recouvrer', sub: '5 copropriétaires · 1 contentieux', accent: 'rust', trend: { kind: 'bad', label: 'recouvrement' } },
          { icon: 'clock', num: '48', suffix: 'jours', lbl: 'Mission la plus proche', sub: 'Clos des Vignes · 22/07/2026', accent: 'amber', trend: { kind: 'warn', label: 'AG à convoquer' } },
        ]}
      />

      <Panel
        title="Suivi budgétaire cumulé — Exercice 2026"
        sub="Répartition par copropriété · charges engagées vs budget prévisionnel"
        right={<><Pill kind="sage">À jour</Pill><Button onClick={() => push({ kind: 'success', title: 'Export généré', desc: 'Synthèse budgétaire prête' })}><Icon name="download" />Exporter</Button></>}
      >
        <div className={styles.budgetFigures}>
          <div><div style={eyebrowStyle}>Budgets cumulés</div><div style={figVal}>{fmtEUR(TOTAL_BUDGET)}</div><div style={figSub}>4 copropriétés</div></div>
          <div><div style={eyebrowStyle}>Charges engagées</div><div style={{ ...figVal, color: 'var(--v54-rust-700)' }}>{fmtEUR(TOTAL_DEPENSE)}</div><div style={figSub}>{Math.round(pctv(TOTAL_DEPENSE, TOTAL_BUDGET))}% consommé</div></div>
          <div><div style={eyebrowStyle}>Disponible</div><div style={{ ...figVal, color: 'var(--v54-sage-700)' }}>{fmtEUR(TOTAL_BUDGET - TOTAL_DEPENSE)}</div><div style={figSub}>Solde prévisionnel</div></div>
          <div><div style={eyebrowStyle}>Fonds de travaux</div><div style={{ ...figVal, fontSize: 22, color: 'var(--v54-navy-700)' }}>{fmtEUR(COPROS.reduce((s, c) => s + c.fondsTravaux, 0))}</div><div style={{ fontSize: 11.5, color: 'var(--v54-amber-700)', marginTop: 4 }}>loi ALUR · 1 sous-doté</div></div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, marginBottom: 10, flexWrap: 'wrap' }}>
          {COPROS.map((c, i) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: rampBg(i) }} />
              {c.nom} · {fmtEUR(c.depense)}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--v54-cream)', border: '1px solid var(--v54-line)' }}>
          {COPROS.map((c, i) => (
            <div key={c.id} style={{ flex: c.depense, background: rampBg(i) }} />
          ))}
          <div style={{ flex: Math.max(1, TOTAL_BUDGET - TOTAL_DEPENSE) }} />
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 16 }}>
        <Panel
          title="Échéances prioritaires"
          icon="scale"
          right={<button type="button" style={linkBtn} onClick={() => onNavigate?.('obligations')}>Voir tout →</button>}
          flush
        >
          {OBLIGATIONS.filter((o) => o.pill === 'rust' || o.pill === 'amber').slice(0, 4).map((o, i) => (
            <button key={i} type="button" className={styles.listRow} style={listRowBtn} onClick={() => push({ kind: 'info', title: o.objet, desc: `${o.copro} · ${o.base}` })}>
              <div className={styles.thumb}>{o.copro.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
              <div className={styles.info}>
                <b>{o.objet}</b>
                <div className={styles.meta}><span>{o.copro}</span><span className={styles.metaDot} /><span>{o.date}</span></div>
              </div>
              <div />
              <Pill kind={o.pill}>{o.statut}</Pill>
            </button>
          ))}
        </Panel>
        <Panel
          title="État des mandats"
          icon="clipboard"
          right={<button type="button" style={linkBtn} onClick={() => onNavigate?.('mandats')}>Voir les ordonnances →</button>}
          flush
        >
          {COPROS.map((c) => (
            <button key={c.id} type="button" className={styles.listRow} style={listRowBtn} onClick={() => onNavigate?.('mandats')}>
              <div className={styles.thumb}>{c.code}</div>
              <div className={styles.info}>
                <b>{c.nom}</b>
                <div className={styles.meta}>
                  <span>{c.fondement}</span><span className={styles.metaDot} />
                  <span style={{ color: 'var(--v54-navy-500)', fontWeight: 500 }}>{c.lots} lots</span><span className={styles.metaDot} />
                  <span>fin {c.echeance}</span>
                </div>
              </div>
              <div />
              <Pill kind={c.pill}>{c.statut}</Pill>
            </button>
          ))}
        </Panel>
      </div>
    </>
  )
}
