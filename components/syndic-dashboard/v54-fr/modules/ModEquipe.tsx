'use client'

// Équipe du cabinet — port byte-exact du ModEquipa du mockup v8 (route
// « equipe »). Collaborateurs, rôles et périmètres d'accès. Les avatars
// réutilisent les classes globales team-dd-avatar/accent-* (planeamento.css).

import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Panel } from '@/components/syndic-dashboard/v54/primitives/panel'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'
import DataTable from '../shared/DataTable'

/** [initiales, nom, rôle, courriel, accent]. */
type EqMember = readonly [string, string, string, string, string]
/** [rôle, périmètre, droits]. */
type EqAccess = readonly [string, string, string]

const EQ_TEAM: EqMember[] = [
  ['CD', 'Cabinet Delaunay', 'Direction / syndic judiciaire', 'direction@cabinet-delaunay.fr', 'gold'],
  ['AD', 'Awa Diallo', 'Gestionnaire de mandats', 'a.diallo@cabinet-delaunay.fr', 'sage'],
  ['ML', 'Marc Léautaud', 'Gestionnaire technique', 'm.leautaud@cabinet-delaunay.fr', 'sage'],
  ['CN', 'Camille Noël', 'Juriste', 'c.noel@cabinet-delaunay.fr', 'amber'],
  ['JM', 'Julien Marchand', 'Comptable', 'j.marchand@cabinet-delaunay.fr', 'sage'],
  ['SV', 'Sophie Vidal', 'Assistante', 's.vidal@cabinet-delaunay.fr', 'sage'],
]
const EQ_ACCESS: EqAccess[] = [
  ['Direction', 'Tous les mandats', 'Validation & signature'],
  ['Gestionnaire', 'Mandats affectés', 'Création, édition, exécution'],
  ['Juriste', 'Tous les dossiers', "Vérification, rédaction d'actes"],
  ['Comptable', 'Comptabilité, compte séparé', 'Saisie, rapprochement, reddition'],
  ['Assistante', 'Notifications, courriers', 'Diffusion, suivi'],
]

export default function ModEquipe() {
  const { push } = useToast()
  return (
    <>
      <PageHead
        eyebrow="Cabinet"
        title="Équipe du cabinet"
        lede="Collaborateurs, rôles et périmètres d'accès du cabinet de syndic judiciaire."
        actions={
          <Button variant="gold" onClick={() => push({ kind: 'info', title: 'Inviter un collaborateur', desc: 'Ajouter un membre au cabinet' })}>
            <Icon name="plus" />Inviter
          </Button>
        }
      />
      <Panel title="Collaborateurs" icon="team">
        <div className={m.cardGrid3}>
          {EQ_TEAM.map((member, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--v54-line)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className={`team-dd-avatar accent-${member[4]}`} style={{ flexShrink: 0 }}>{member[0]}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{member[1]}</div>
                <div style={{ fontSize: 12, color: 'var(--v54-navy-500)', marginBottom: 4 }}>{member[2]}</div>
                <div style={{ fontSize: 11, color: 'var(--v54-navy-300)', wordBreak: 'break-all' }}>{member[3]}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Périmètres d'accès par rôle" icon="shield" flush>
        <DataTable
          columns={[
            { h: 'Rôle', render: (r: EqAccess) => <b>{r[0]}</b> },
            { h: 'Périmètre', render: (r: EqAccess) => r[1] },
            { h: 'Droits', render: (r: EqAccess) => r[2] },
          ]}
          rows={EQ_ACCESS}
        />
      </Panel>
    </>
  )
}
