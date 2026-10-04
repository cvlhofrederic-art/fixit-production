'use client'

import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useEcheancesMandat } from '@/lib/administrateur-judiciaire/db/use-echeances'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { badgeStatutEcheance } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/** Notification inscrite au registre : voie, envoi, accusé de réception, délai de recours et fondement. */
export interface LigneRegistreNotifications {
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

/** Les quatre premières lignes du registre (données de démonstration figées). */
export const NOTIFICATIONS_REGISTRE_DEMO: LigneRegistreNotifications[] = [
  {
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

/**
 * Registre des notifications (statut partiel). Seule donnée calculée : l'envoi de la notification de l'ordonnance
 * de Villa Montaigne (code « VM » en dur), tiré du moteur de délais légaux (« À envoyer » tant que les échéances ne
 * sont pas disponibles). « Nouvelle notification » est simulée.
 */
export function RegistreNotificationsModule() {
  const { push } = useToast()
  const notificationVillaMontaigne = useEcheancesMandat('VM').echeances.find(
    (echeance) => echeance.regleId === 'notification-ordonnance-46-47',
  )
  const envoiVillaMontaigne =
    notificationVillaMontaigne && notificationVillaMontaigne.dateRetenue
      ? badgeStatutEcheance(notificationVillaMontaigne, AUJOURDHUI_ISO).kind === 'rust'
        ? `Délai échu le ${dateIsoVersFr(notificationVillaMontaigne.dateRetenue)}`
        : `Avant le ${dateIsoVersFr(notificationVillaMontaigne.dateRetenue)}`
      : 'À envoyer'
  const notifications: LigneRegistreNotifications[] = [
    ...NOTIFICATIONS_REGISTRE_DEMO,
    {
      objet: 'Notification ordonnance — Villa Montaigne',
      dest: 'Tous les copropriétaires',
      type: 'Voie électronique',
      envoi: envoiVillaMontaigne,
      aEnvoyer: true,
      ar: '—',
      recours: '—',
      base: 'art. 59 décret · 1 mois',
      pill: 'rust',
    },
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
      <Alert kind="warn" icon="clock" title="Fenêtre de recours ouverte — PV de l'AG du 18/05">
        {
          'Le procès-verbal a été envoyé le 24/05/2026 : chaque copropriétaire opposant ou défaillant dispose de deux mois (art. 42 al. 2) à compter du lendemain de la première présentation de sa lettre, soit au plus tôt fin juillet 2026. La date de présentation de chaque lettre fixe sa propre échéance.'
        }
      </Alert>
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
      </Panel>
    </>
  )
}
