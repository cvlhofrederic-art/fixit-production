import type { OpenNextConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Pages pré-rendues au build (pages SEO par langue, accueils, pages légales…) servies depuis les assets du Worker, en
// lecture seule : aucune ressource Cloudflare à créer, entrées rangées par buildId, copiées dans
// .open-next/assets/cdn-cgi/_next_cache par .github/workflows/deploy-cloudflare.yml (cdn-cgi/ n'est lisible que par le
// Worker). Avec l'ancien cache « dummy », chaque requête, préchargements RSC compris, refaisait un pré-rendu complet.
// Lecture seule : pas d'ISR (pas de `revalidate` sur ces routes, une mise à jour = un déploiement).
// Les écritures sont ignorées sans bruit. Elles sont attendues : un slug inconnu d'une route rendue à la demande (sondes de
// robots sur /pt/servicos/…) et le cache fetch (`next: { revalidate }`) en demandent une à chaque requête, et la classe
// d'OpenNext journaliserait alors une ligne ERROR à chaque fois. L'ancien cache « dummy » restait muet (IgnorableError sous
// le niveau de journalisation par défaut). Le nom est gardé : populateCache s'en sert pour reconnaître ce cache.
// Sur un HIT, OpenNext recalcule le Cache-Control qui porte un s-maxage (préfixes SEO du middleware) : s-maxage décompté
// depuis le build, puis stale-while-revalidate=2592000 (fixISRHeaders). Sans effet sur les navigateurs ni sur la bordure
// Cloudflare, qui ne garde pas les réponses du Worker.
const cachePagesPrerendues: Pick<typeof staticAssetsIncrementalCache, "name" | "get" | "set" | "delete"> = {
  name: staticAssetsIncrementalCache.name,
  get: staticAssetsIncrementalCache.get.bind(staticAssetsIncrementalCache),
  set: async () => {
    // Lecture seule : écriture ignorée (voir plus haut).
  },
  delete: async () => {
    // Lecture seule : suppression ignorée (voir plus haut).
  },
};

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      // Une fonction est exigée par OpenNext pour un cache personnalisé (cli/build/utils/ensure-cf-config.js).
      incrementalCache: async () => cachePagesPrerendues,
      tagCache: "dummy",
      queue: "direct",
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "direct",
    },
  },
};

export default config;
