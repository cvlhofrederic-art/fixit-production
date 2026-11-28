// ── CRM du secrétariat : application installable sur l'ordinateur (Web App Manifest) ──
// Module pur. Chrome et Edge proposent alors « Installer Vitfix CRM » : icône sur le bureau et dans le menu Démarrer,
// fenêtre à part, sans barre d'adresse. L'application reste l'écran /admin/crm de vitfix.io : même connexion, même base,
// mises à jour sans rien réinstaller.
//
// Servi par app/(commun)/admin/crm/manifest.webmanifest/route.ts et déclaré par le layout du CRM (metadata.manifest),
// qui remplace le /manifest.json général de Vitfix (METADONNEES_PARTAGEES, lib/seo/metadonnees-racine.ts) : un seul
// manifeste par page, celui du CRM.
// Le chemin finit par .webmanifest : le middleware ne le traite pas (EXTENSIONS_HORS_MIDDLEWARE, lib/securite/csp.ts).

import { CHEMIN_CRM } from './types'

export const CHEMIN_MANIFESTE_CRM = `${CHEMIN_CRM}manifest.webmanifest`

export const MANIFESTE_CRM = {
  // Identité de l'application installée : NE JAMAIS LA CHANGER, même si l'adresse du CRM change. Une autre valeur ferait
  // de l'application déjà installée une application orpheline (plus aucune mise à jour de son manifeste). Distincte de
  // l'application Vitfix générale (/manifest.json, sans id, donc id « / »).
  id: '/admin/crm/',
  name: 'Vitfix CRM',
  short_name: 'Vitfix CRM',
  description:
    'Secrétariat Vitfix : demandes, rappels et historique des clients. Secretariado Vitfix: pedidos, lembretes e histórico dos clientes.',
  start_url: CHEMIN_CRM,
  // Portée limitée au CRM : une portée « / » ferait ouvrir dans l'application tous les liens vitfix.io (devis, connexion,
  // pages publiques), notamment sur Android. Hors portée (page de connexion après une session expirée), le navigateur
  // garde la même fenêtre avec un bandeau d'adresse, puis la connexion ramène au CRM.
  scope: CHEMIN_CRM,
  display: 'standalone',
  background_color: '#F7F7F5',
  theme_color: '#FFD600',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
  categories: ['business', 'productivity'],
  lang: 'fr',
  dir: 'ltr',
} as const
