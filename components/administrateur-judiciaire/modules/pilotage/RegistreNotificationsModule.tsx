'use client'

import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useEcheancesMandat } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { badgeStatutEcheance } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { codeLigneDemo, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Notification inscrite au registre : voie, envoi, accusé de réception, délai de recours et fondement. */
export interface LigneRegistreNotifications {
  /** Code de la copropriété concernée (filtre selon la copropriété choisie). */
  code: string
  objet: string
  dest: string
  /** Voie de notification (LRAR, signification, voie électronique). */
  type: string
  envoi: string
  ar: string
  recours: string
  /** Fenêtre de recours en cours (KPI « Fenêtres de recours ouvertes »). */
  fenetreOuverte?: boolean
  /** Notification restant à envoyer (KPI « À envoyer »). */
  aEnvoyer?: boolean
  base: string
  pill: string
}

/**
 * Les quatre premières lignes du registre (données de démonstration figées), rattachées à leur copropriété : ordonnance
 * et PV d'AG du Méridien, mise en demeure des Tilleuls, convocation de l'AG élective du Clos des Vignes.
 */
export const NOTIFICATIONS_REGISTRE_DEMO: LigneRegistreNotifications[] = [
  {
    code: 'LM',
    objet: 'Ordonnance de désignation',
    dest: 'Tous les copropriétaires',
    type: 'LRAR',
    envoi: '15/03/2026',
    ar: 'Reçu',
    recours: 'Clos · 15 j',
    base: 'art. 59 décret · 1 mois',
    pill: 'sage',
  },
  {
    code: 'LM',
    objet: "Procès-verbal de l'AG du 18/05",
    dest: 'Tous les copropriétaires',
    type: 'LRAR',
    envoi: '24/05/2026',
    ar: 'Partiel (38/40)',
    recours: '2 mois après présentation',
    fenetreOuverte: true,
    base: 'art. 42 al. 2 · 2 mois',
    pill: 'amber',
  },
  {
    code: 'TL',
    objet: 'Mise en demeure de payer',
    dest: 'SCI Belvédère',
    type: 'Signification',
    envoi: '02/06/2026',
    ar: 'En cours',
    recours: '—',
    base: 'art. 19-2 L. 1965 · 30 j',
    pill: 'amber',
  },
  {
    code: 'CV',
    objet: 'Convocation AG élective',
    dest: 'Tous les copropriétaires',
    type: 'LRAR',
    envoi: 'À envoyer',
    aEnvoyer: true,
    ar: '—',
    recours: '—',
    base: 'art. 9 décret · 21 j avant',
    pill: 'rust',
  },
]

/** Envoi de la notification de l'ordonnance selon le moteur : « Délai échu le … », « Avant le … » ou « À envoyer ». */
function envoiNotificationOrdonnance(echeance: EcheanceCalculee | undefined): string {
  if (!echeance?.dateRetenue) return 'À envoyer'
  const date = dateIsoVersFr(echeance.dateRetenue)
  return badgeStatutEcheance(echeance, AUJOURDHUI_ISO).kind === 'rust' ? `Délai échu le ${date}` : `Avant le ${date}`
}

/**
 * Registre des notifications (statut partiel) de la copropriété choisie. Seule donnée calculée : l'envoi de la
 * notification de l'ordonnance, tiré du moteur de délais légaux (« À envoyer » tant que les échéances ne sont pas
 * disponibles), inscrit tant que le moteur ne la donne pas pour accomplie. Sans sélection (écran rendu seul) : tout le
 * registre de démonstration et la notification de Villa Montaigne, comme avant. « Nouvelle notification » est simulée.
 */
export function RegistreNotificationsModule() {
  const { push } = useToast()
  const code = useCodeCoproCourant()
  const copro = useCoproCourante('VM')
  const notificationOrdonnance = useEcheancesMandat(code || 'VM').echeances.find(
    (echeance) => echeance.regleId === 'notification-ordonnance-46-47',
  )
  const notificationAInscrire = !code || (!!notificationOrdonnance && !notificationOrdonnance.accomplie)
  const notifications: LigneRegistreNotifications[] = [
    ...filtrerParCopro(NOTIFICATIONS_REGISTRE_DEMO, code, (ligne) => codeLigneDemo(ligne.code)),
    ...(notificationAInscrire
      ? [
          {
            code: copro.code,
            objet: `Notification ordonnance — ${copro.nom}`,
            dest: 'Tous les copropriétaires',
            type: 'Voie électronique',
            envoi: envoiNotificationOrdonnance(notificationOrdonnance),
            aEnvoyer: true,
            ar: '—',
            recours: '—',
            base: 'art. 59 décret · 1 mois',
            pill: 'rust',
          },
        ]
      : []),
  ]
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Registre des notifications"
        lede="Chaîne de notification légale : LRAR ou voie électronique, accusé de réception, et calcul automatique des fenêtres de recours. Preuve archivée pour chaque acte."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'success',
                title: 'Simulation',
                desc: "Aucune notification n'a été programmée ni envoyée.",
              })
            }
          >
            <Icon name="mail" />
            Nouvelle notification
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'mail',
            num: notifications.length,
            lbl: 'Notifications au registre',
          },
          {
            icon: 'check',
            num: notifications.filter((notification) => notification.ar === 'Reçu').length,
            lbl: 'Accusés de réception',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: notifications.filter((notification) => notification.fenetreOuverte).length,
            lbl: 'Fenêtres de recours ouvertes',
            sub: 'délais à surveiller',
            accent: 'amber',
          },
          {
            icon: 'alert',
            num: notifications.filter((notification) => notification.aEnvoyer).length,
            lbl: 'À envoyer',
            accent: 'rust',
          },
        ]}
      />
      {notifications.some((notification) => notification.fenetreOuverte) && (
        <Alert kind="warn" icon="clock" title="Fenêtre de recours ouverte — PV de l'AG du 18/05">
          {
            'Le procès-verbal a été envoyé le 24/05/2026 : chaque copropriétaire opposant ou défaillant dispose de deux mois (art. 42 al. 2) à compter du lendemain de la première présentation de sa lettre, soit au plus tôt fin juillet 2026. La date de présentation de chaque lettre fixe sa propre échéance.'
          }
        </Alert>
      )}
      <Panel
        title="Registre"
        sub="Chaque notification, son accusé de réception et son délai de recours"
        icon="mail"
        flush
      >
        <DataTable
          rowKey="objet"
          columns={[
            {
              h: 'Objet',
              render: (notification) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {notification.objet}
                </b>
              ),
            },
            {
              h: 'Destinataire',
              render: (notification) => (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--navy-500)',
                  }}
                >
                  {notification.dest}
                </span>
              ),
            },
            {
              h: 'Voie',
              render: (notification) => notification.type,
            },
            {
              h: 'Envoi',
              render: (notification) => notification.envoi,
            },
            {
              h: 'AR',
              render: (notification) => notification.ar,
            },
            {
              h: 'Recours',
              render: (notification) => (
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                  }}
                >
                  {notification.recours}
                </span>
              ),
            },
            {
              h: 'Fondement',
              render: (notification) => (
                <Pill kind={notification.pill} noDot>
                  {notification.base}
                </Pill>
              ),
            },
          ]}
          rows={notifications}
        />
        {notifications.length === 0 && <EmptyState icon="mail" title={`Aucune notification pour ${copro.nom}`} />}
      </Panel>
    </>
  )
}
