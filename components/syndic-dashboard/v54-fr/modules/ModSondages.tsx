'use client'

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { KPIGrid } from '@/components/syndic-dashboard/v54/primitives/kpi'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Progress } from '@/components/syndic-dashboard/v54/primitives/progress'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'

/** Sondages & consultations — port FR du ModEnquetes du mockup v8
 * (cartes de sondage avec barres de résultats, valeur consultative). */

/** [option, votes] */
type EnqOption = [string, number]
/** [titre, description, statut, copropriété, échéance, anonyme, répondants, lots, participation %, options] */
type Enquete = [string, string, string, string, string, boolean, number, number, number, EnqOption[]]

const ENQ: Enquete[] = [
  ['Choix de l\'entreprise de ravalement', 'Consultation des copropriétaires sur les trois devis reçus', 'Active', 'Le Méridien', 'Échéance 15/06', false, 28, 36, 78, [['Entreprise Façade Pro', 16], ['Ravalement Atlantique', 9], ['Sans avis', 3]]],
  ['Horaires d\'accès au chantier', 'Préférence pour les plages horaires des travaux de toiture', 'Active', 'Les Tilleuls', 'Échéance 10/06', true, 18, 24, 75, [['8h–17h', 11], ['9h–18h', 5], ['Indifférent', 2]]],
  ['Validation du budget travaux 2026', 'Avis consultatif avant inscription à l\'ordre du jour de l\'AG', 'Clôturée', 'Le Clos des Vignes', 'Terminée', false, 41, 48, 85, [['Favorable', 33], ['Défavorable', 6], ['Abstention', 2]]],
]

const pcr = (n: number, t: number): number => (t ? Math.round((n / t) * 100) : 0)

// Port de la classe globale `.panel` du mockup (carte de sondage).
const enqCard = {
  background: '#fff',
  border: '1px solid var(--v54-line)',
  borderRadius: 14,
  boxShadow: 'var(--v54-shadow-card)',
  padding: 22,
  marginBottom: 16,
} as const

export default function ModSondages() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Sondages & consultations"
        lede="Recueillez l'avis des copropriétaires de façon rapide et organisée (valeur consultative)."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau sondage', desc: 'Créer une consultation' })}><Icon name="plus" />Nouveau sondage</Button>} />
      <KPIGrid items={[
        { icon: 'poll', num: 2, lbl: 'Sondages actifs', accent: 'gold' },
        { icon: 'folder', num: 1, lbl: 'Historique' },
        { icon: 'chart', num: '79%', lbl: 'Participation moyenne', accent: 'sage' },
        { icon: 'users', num: 87, lbl: 'Réponses totales', accent: 'sage' },
      ]} />
      <Tabs defaultActive="actifs" tabs={[
        { id: 'actifs', icon: 'chart', label: 'Sondages actifs', badge: 2 },
        { id: 'hist', icon: 'folder', label: 'Historique', badge: 1 },
        { id: 'creer', icon: 'pencil', label: 'Créer' },
      ]} />
      {ENQ.map((s, i) => (
        <div key={i} style={enqCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{s[0]}</div>
              <div style={{ fontSize: 13, color: 'var(--v54-navy-500)' }}>{s[1]}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill kind={s[2] === 'Active' ? 'sage' : 'amber'} noDot>{s[2]}</Pill>
                <Pill noDot>{s[3]}</Pill>{s[5] && <Pill kind="gold" noDot>Anonyme</Pill>}
                <Pill kind={s[4] === 'Terminée' ? 'rust' : 'gold'} noDot>{s[4]}</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button onClick={() => push({ kind: 'info', title: s[0], desc: 'Voir le détail des réponses' })}>Détails</Button>
              {s[2] === 'Active' && <Button variant="danger" size="sm" onClick={() => push({ kind: 'info', title: 'Clôturer', desc: s[0] })}>Clôturer</Button>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--v54-navy-300)', margin: '14px 0 6px' }}>
            <span>{s[6]}/{s[7]} lots ont répondu</span><span><b style={{ color: 'var(--v54-ink)' }}>{s[8]}%</b></span>
          </div>
          <Progress pct={s[8]} kind="sage" />
          <div style={{ marginTop: 16 }}>
            {s[9].map((o, j) => {
              const tot = s[9].reduce((a, b) => a + b[1], 0)
              const p = pcr(o[1], tot)
              return (
                <div key={j} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span>{o[0]}</span><span style={{ color: 'var(--v54-navy-500)' }}>{o[1]} · {p}%</span>
                  </div>
                  <Progress pct={p} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
