'use client'

// Sécurité incendie — port du ModSegEdificio du mockup v8 (L6439-6478).
// Classement des bâtiments d'habitation (arrêté du 31/01/1986) et équipements.

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import InfoCard from '../shared/InfoCard'

type InfoTint = 'gold' | 'sage' | 'rust' | 'amber'
type InfoRow = readonly [string, string, InfoTint]

const FAM: InfoRow[] = [
  ['1ʳᵉ famille — individuel', 'Habitations individuelles isolées ou jumelées', 'sage'],
  ['2ᵉ famille — collectif R+3', "Collectif jusqu'à 3 étages sur rez-de-chaussée", 'sage'],
  ["3ᵉ famille — jusqu'à 28 m", 'Plancher bas du logement le plus haut ≤ 28 m', 'amber'],
  ['4ᵉ famille — au-delà de 28 m', 'Plancher bas > 28 m et ≤ 50 m', 'rust'],
]
const EQUIP: InfoRow[] = [
  ['Désenfumage des circulations', "Cages d'escalier + couloirs", 'sage'],
  ['Extincteurs & colonnes sèches', 'Selon famille du bâtiment', 'sage'],
  ['Éclairage de sécurité', 'Blocs autonomes (BAES)', 'gold'],
  ['Détection & alarme', 'Parties communes', 'amber'],
]

export default function ModSecIncendie() {
  const { push } = useToast()
  return (
    <>
      <PageHead eyebrow="Conformité · Arrêté du 31/01/1986" title="Sécurité incendie"
        lede="Classement des bâtiments d'habitation et obligations de sécurité incendie."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Registre sécurité', desc: 'Vérifier le registre de sécurité incendie' })}><Icon name="siren" />Registre sécurité</Button>} />
      <Panel title="Familles d'habitation (arrêté du 31 janvier 1986)" icon="siren">
        <div className={m.cardGrid}>
          {FAM.map(([t, s, c]) => <InfoCard key={t} t={t} s={s} c={c} />)}
        </div>
      </Panel>
      <Panel title="Équipements de sécurité à contrôler" icon="shield">
        <div className={m.cardGrid}>
          {EQUIP.map(([t, s, c]) => <InfoCard key={t} t={t} s={s} c={c} />)}
        </div>
      </Panel>
    </>
  )
}
