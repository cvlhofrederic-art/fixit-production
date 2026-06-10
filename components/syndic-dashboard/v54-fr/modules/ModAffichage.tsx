'use client'

import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import btnCss from '@/components/syndic-dashboard/v54/primitives/button/Button.module.css'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

/** Panneau d'affichage — port FR du ModQuadroAvisos du mockup v8
 * (avis aux copropriétaires : cartes à liseré coloré + panneaux latéraux). */

/** [catégorie, sous-catégorie, priorité, copropriété, titre, texte, échéance, teinte] */
type Avis = [string, string, string, string, string, string, string, string]

const QA_AVIS: Avis[] = [
  ['Convocation', 'Assemblée', 'Importante', 'Le Méridien', 'Convocation à l\'assemblée générale élective', 'L\'AG se tiendra le 8 juin 2026 à 18h30. Ordre du jour et pouvoirs joints à la convocation LRAR.', '08/06/2026', 'gold'],
  ['Travaux', 'Technique', 'Urgente', 'Les Tilleuls', 'Travaux de toiture — accès limité', 'Intervention de l\'entreprise du 16 au 20 juin. Stationnement interdit côté rue durant les travaux.', '—', 'rust'],
  ['Juridique', 'Mandat', 'Importante', 'Villa Montaigne', 'Notification de l\'ordonnance de désignation', 'L\'ordonnance du tribunal judiciaire désignant le syndic judiciaire est notifiée à l\'ensemble des copropriétaires.', '—', 'amber'],
  ['Finances', 'Appel de fonds', '', 'Le Clos des Vignes', 'Appel de fonds — 2ᵉ trimestre', 'Les appels de fonds du T2 sont disponibles sur l\'extranet. Échéance de règlement au 30 juin.', '30/06/2026', 'sage'],
]

/** [catégorie, compteur, teinte du dot-status] */
const CATEGORIES: [string, number, string][] = [['Assemblée', 3, 'gold'], ['Technique', 5, 'sage'], ['Finances', 2, 'amber'], ['Juridique', 4, 'rust']]

const BORDER_COLOR: Record<string, string> = {
  rust: 'var(--v54-rust-500)',
  amber: 'var(--v54-amber-500)',
  gold: 'var(--v54-gold-500)',
  sage: 'var(--v54-sage-500)',
}

// Port de la classe globale `.panel` du mockup (le primitive Panel n'accepte pas
// de borderLeft/padding custom) — précédent PT : avisoCard de ModQuadroAvisos.
const avisCard = {
  background: '#fff',
  border: '1px solid var(--v54-line)',
  borderRadius: 14,
  boxShadow: 'var(--v54-shadow-card)',
  padding: '18px 20px',
  marginBottom: 12,
} as const

const searchInput = { width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--v54-line-strong)', borderRadius: 8, fontSize: 13 } as const

const dotCls = (kind: string): string =>
  clsx(m.dotStatus, kind === 'gold' && m.dotStatusGold, kind === 'amber' && m.dotStatusAmber, kind === 'rust' && m.dotStatusRust)

export default function ModAffichage() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Panneau d'affichage"
        lede="Communiquez avec les copropriétaires de façon claire et tracée."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouvel avis', desc: 'Publier un avis aux copropriétaires' })}><Icon name="plus" />Nouvel avis</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" style={{ position: 'absolute', left: 12, top: 11, width: 14, height: 14, color: 'var(--v54-navy-300)' }} />
          <input style={searchInput} aria-label="Rechercher un avis" placeholder="Rechercher un avis…" />
        </div>
        <select className={btnCss.btn} aria-label="Statut"><option>Actifs</option><option>Archivés</option></select>
        <select className={btnCss.btn} aria-label="Catégorie"><option>Toutes catégories</option></select>
        <select className={btnCss.btn} aria-label="Copropriété"><option>Toutes copropriétés</option></select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {QA_AVIS.map((a, i) => (
            <div key={i} style={{ ...avisCard, borderLeft: `3px solid ${BORDER_COLOR[a[7]] || BORDER_COLOR.sage}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <Pill kind="gold" noDot>{a[0]}</Pill><Pill noDot>{a[1]}</Pill>
                {a[2] && <Pill kind={a[2] === 'Urgente' ? 'rust' : 'gold'} noDot>{a[2]}</Pill>}
                <Pill noDot>{a[3]}</Pill>
              </div>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 6 }}>{a[4]}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginBottom: 10 }}>{a[5]}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: 'var(--v54-navy-300)' }}>{a[6] !== '—' ? `Échéance ${a[6]}` : 'Sans échéance'}</span>
                <Button variant="ghost" size="sm" onClick={() => push({ kind: 'info', title: a[4], desc: 'Ouvrir l\'avis' })}>Détails</Button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <Panel title="Catégories" icon="grid">
            {CATEGORIES.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < CATEGORIES.length - 1 ? '1px solid var(--v54-line)' : 'none' }}>
                <span style={{ fontSize: 13 }}><span className={dotCls(c[2])} /> {c[0]}</span><b style={{ fontSize: 13 }}>{c[1]}</b>
              </div>
            ))}
          </Panel>
          <div style={{ height: 12 }} />
          <Panel title="Diffusion" icon="mail">
            <div style={{ fontSize: 12.5, color: 'var(--v54-navy-500)', lineHeight: 1.6 }}>Les avis sont diffusés sur l'extranet copropriétaire et par e-mail. Les avis urgents déclenchent une notification.</div>
          </Panel>
        </div>
      </div>
    </>
  )
}
