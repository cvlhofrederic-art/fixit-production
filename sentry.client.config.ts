// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Note: The pink/salmon overlay bug was caused by setTimeout(() => focus(), 50)
// on Max Expert pill buttons, NOT by Sentry. Safe to keep Sentry client active.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — 100% during launch phase — reduce to 0.1 when traffic > 1000 users/day
  tracesSampleRate: 1.0,

  // Session Replay disabled — not needed, adds ~50KB to bundle
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // captures replay on error for debugging

  debug: false,

  // Contexte agents IA — enrichit les erreurs avec le type d'agent
  beforeSend(event) {
    // Ajouter le contexte IA si disponible dans l'URL ou les tags
    const url = typeof window !== "undefined" ? window.location.pathname : "";
    if (url.includes("/pro/dashboard")) {
      event.tags = { ...event.tags, agent_context: "fixy-ai-artisan" };
    }
    return event;
  },
});
