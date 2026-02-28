// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring — 10% of transactions in production
  tracesSampleRate: 0.1,

  // Session Replay
  replaysSessionSampleRate: 0, // Disabled for normal sessions
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media in replays for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
