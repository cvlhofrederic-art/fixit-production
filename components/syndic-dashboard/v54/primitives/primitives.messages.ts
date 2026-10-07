import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes par défaut des primitives v54 (PT du bundle, repris tels quels).
 * Sans fournisseur de langue, c'est le PT ; un libellé passé en props l'emporte.
 */
export const PRIMITIVES_MESSAGES = defineMessages({
  'pt-PT': {
    fermer: 'Fechar',
    fermerNotification: 'Fechar notificação',
    notifications: 'Notificações',
    reessayer: 'Tentar novamente',
  },
  'fr-FR': {
    fermer: 'Fermer',
    fermerNotification: 'Fermer la notification',
    notifications: 'Notifications',
    reessayer: 'Réessayer',
  },
})
