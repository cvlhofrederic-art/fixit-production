// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { effacerJetonsUnClicSentryQr } from './lib/aj-signalement/sentry-desinscription'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — 10% of transactions in production
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // AJ Signalement : le middleware voit l'adresse un clic de désinscription (List-Unsubscribe) ; son jeton est effacé
  // de tout l'événement, erreur ou transaction (lib/aj-signalement/sentry-desinscription.ts).
  beforeSend(event) {
    return effacerJetonsUnClicSentryQr(event);
  },
  beforeSendTransaction(event) {
    return effacerJetonsUnClicSentryQr(event);
  },
});
