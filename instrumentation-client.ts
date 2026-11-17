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
import { effacerJetonsDesinscriptionSentryQr } from "@/lib/aj-signalement/sentry-desinscription";

try {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance Monitoring — 5% sampling (was 100% during launch)
    tracesSampleRate: 0.05,

    // Session Replay disabled — not needed, adds ~50KB to bundle
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0, // disabled — caused "blocs roses" on syndic dashboard

    debug: false,

    // AJ Signalement (PR 3, cahier § 8.2) : la page /<identifiant>/desinscription/ porte un jeton dans le fragment de son
    // adresse, qu'elle efface (history.replaceState) ; le fil d'Ariane « navigation » de cet effacement garde l'adresse
    // d'avant. Tout jeton de lien de diffusion est effacé de chaque fil d'Ariane dès son enregistrement, puis de chaque
    // erreur et de chaque transaction avant l'envoi (lib/aj-signalement/sentry-desinscription.ts). Aucun autre réglage
    // n'est changé.
    beforeBreadcrumb(breadcrumb) {
      return effacerJetonsDesinscriptionSentryQr(breadcrumb);
    },
    beforeSendTransaction(event) {
      return effacerJetonsDesinscriptionSentryQr(event);
    },

    // Contexte agents IA + redaction PII (RGPD compliance)
    beforeSend(event) {
      // Jetons de désinscription d'abord (request.url compris) : le caviardage des téléphones ci-dessous couperait un
      // jeton hexadécimal en morceaux que la forme fixe ne reconnaîtrait plus.
      effacerJetonsDesinscriptionSentryQr(event);
      const url = typeof window !== "undefined" ? window.location.pathname : "";
      if (url.includes("/pro/dashboard")) {
        event.tags = { ...event.tags, agent_context: "fixy-ai-artisan" };
      }

      // Redact PII from error messages and breadcrumbs.
      // Regex volontairement larges (sur-matcher est sans risque : on caviarde)
      // mais à quantifieurs BORNÉS — les messages d'erreur peuvent contenir de
      // l'entrée utilisateur, et les formes non bornées ([a-zA-Z0-9.-]+\.…)
      // donnaient un backtracking super-linéaire (hotspot Sonar S5852/ReDoS).
      // Bornes = limites RFC 5321 (local 64, domaine 255) et 20 chiffres max.
      const emailRegex = /[^\s@]{1,64}@[^\s@]{1,255}/g;
      const phoneRegex = /\+?\d(?:[\s().-]{0,3}\d){5,19}/g;

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

// Identifiant de l'utilisateur connecté sur les événements Sentry (id seul, RGPD) : lot 9 Sentry du 28/10/2026,
// toutes les issues affichaient « 0 utilisateur ». Posé et retiré au fil des événements d'auth du client partagé.
import("@/lib/sentry-utilisateur")
  .then(async ({ lierUtilisateurSentry }) => {
    const { supabase } = await import("@/lib/supabase");
    lierUtilisateurSentry(supabase.auth);
  })
  .catch((error) => {
    console.warn("[Sentry] identifiant utilisateur non lié (non bloquant) :", error);
  });

// Instrumente les navigations du router App Router (pattern officiel v10).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
