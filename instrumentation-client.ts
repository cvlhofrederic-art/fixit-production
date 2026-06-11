// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Next 16 builde en Turbopack : l'ancien sentry.client.config.ts n'était injecté
// que par le chemin webpack du SDK → jamais chargé. Le pattern officiel v10 est
// instrumentation-client.ts à la racine (chargé par Next.js lui-même).
// Contenu repris tel quel de sentry.client.config.ts — réglages volontairement
// prudents, NE PAS les changer sans relire l'historique ci-dessous.
//
// Note: The pink/salmon overlay bug was caused by setTimeout(() => focus(), 50)
// on Max Expert pill buttons, NOT by Sentry. Safe to keep Sentry client active.

import * as Sentry from "@sentry/nextjs";

try {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance Monitoring — 5% sampling (was 100% during launch)
    tracesSampleRate: 0.05,

    // Session Replay disabled — not needed, adds ~50KB to bundle
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0, // disabled — caused "blocs roses" on syndic dashboard

    debug: false,

    // Contexte agents IA + redaction PII (RGPD compliance)
    beforeSend(event) {
      const url = typeof window !== "undefined" ? window.location.pathname : "";
      if (url.includes("/pro/dashboard")) {
        event.tags = { ...event.tags, agent_context: "fixy-ai-artisan" };
      }

      // Redact PII from error messages and breadcrumbs
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g;

      function redactPII(str: string): string {
        return str.replace(emailRegex, "[EMAIL]").replace(phoneRegex, "[PHONE]");
      }

      if (event.message) {
        event.message = redactPII(event.message);
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = redactPII(ex.value);
        }
      }
      if (event.breadcrumbs) {
        for (const bc of event.breadcrumbs) {
          if (bc.message) bc.message = redactPII(bc.message);
        }
      }

      return event;
    },
  });
} catch (error) {
  // L'observabilité ne doit jamais casser l'app côté navigateur.
  console.warn("[Sentry] Init client impossible (non bloquant) :", error);
}

// Instrumente les navigations du router App Router (pattern officiel v10).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
