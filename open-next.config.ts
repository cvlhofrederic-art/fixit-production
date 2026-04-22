import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * Configuration minimale OpenNext pour Cloudflare Workers.
 * Extensions (cache/queues/incremental) à configurer en Phase 3 de la migration
 * une fois les ressources Cloudflare provisionnées (KV/R2/Queues).
 */
export default defineCloudflareConfig({});
