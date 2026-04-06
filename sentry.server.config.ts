// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — 10% of transactions in production
  tracesSampleRate: 0.1,

  debug: false,

  // Contexte agents IA côté serveur
  beforeSend(event) {
    // Enrichir les erreurs des routes agents IA
    const transaction = event.transaction || "";
    const agentRoutes: Record<string, string> = {
      "fixy-ai": "fixy-ai-artisan",
      "fixy-chat": "fixy-chat",
      "simulateur-travaux": "simulateur-travaux",
      "materiaux-ai": "materiaux-ai",
      "email-agent": "email-agent",
      "max-ai": "max-syndic",
      "analyse-devis": "analyse-devis",
      "comptable-ai": "comptable-ai",
      "copro-ai": "copro-ai",
      "receipt-scan": "receipt-scan",
      "rapport-ia": "rapport-ia",
    };

    for (const [route, agentType] of Object.entries(agentRoutes)) {
      if (transaction.includes(route)) {
        event.tags = {
          ...event.tags,
          agent_type: agentType,
          is_ai_route: "true",
        };
        break;
      }
    }

    // Redact PII from error messages (RGPD compliance)
    const emailRx = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRx = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g;
    const ipRx = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

    function redact(str: string): string {
      return str.replace(emailRx, "[EMAIL]").replace(phoneRx, "[PHONE]").replace(ipRx, "[IP]");
    }

    if (event.message) event.message = redact(event.message);
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = redact(ex.value);
      }
    }

    return event;
  },
});
