// Module intégré du Worker Cloudflare absent hors Worker : Vitest le résout vers ce module
// vide (vitest.config.ts → resolve.alias). Sans `connect`, lib/email-agent/imap/client.ts
// signale « IMAP indisponible » comme en `next dev` ; les tests du client IMAP injectent un
// transport simulé.
export const connect = undefined
