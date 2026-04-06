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
