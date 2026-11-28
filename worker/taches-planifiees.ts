/**
 * Tâches planifiées du Worker (Cron Triggers de Cloudflare : wrangler.toml, [triggers] crons), depuis le 27/11/2026.
 *
 * Pourquoi ici et non dans GitHub Actions : les déclenchements planifiés de .github/workflows/crons.yml partent avec
 * 7 à 12 heures de retard (mesure du 26/11/2026 sur les 100 derniers passages : prévus à 02:00, 06:00, 07:00, 07:30 et
 * 08:00 UTC, partis à 10:41, 16:39, 17:22, 17:48 et 18:11). L'e-mail de la veille de l'alerte météo serait parti en
 * pleine nuit et aurait annoncé le surlendemain. Un Cron Trigger part à l'heure.
 *
 * Chaque tâche appelle sa route dans le Worker lui-même, par le même gestionnaire que les requêtes (mêmes variables
 * et secrets), avec l'en-tête « Authorization: Bearer CRON_SECRET » que la route vérifie. Une réponse 5xx (ou une
 * exception) est rejouée une fois, une minute plus tard : les routes appelées sont idempotentes (clé d'idempotence
 * des e-mails). Journal : la route, le statut et le bilan qu'elle rend (des nombres, aucune donnée personnelle).
 */

import type { ContexteExecution, Gestionnaire } from './cache-pages-publiques'

/**
 * Alerte météo des chantiers BTP : e-mail de la veille, à 18:15 UTC (18:15 à Lisbonne l'hiver, 19:15 l'été ; 19:15 et
 * 20:15 à Paris), après la notification de 18 h programmée par l'appli. La route n'envoie rien hors de la plage
 * d'envoi à l'heure du chantier (12 h - 23 h).
 */
export const CRON_ALERTE_METEO = '15 18 * * *'

/** Expression cron, telle qu'écrite dans wrangler.toml → route appelée. */
export const TACHES_PLANIFIEES: Readonly<Record<string, string>> = {
  [CRON_ALERTE_METEO]: '/api/cron/alerte-meteo',
}

/** Attente avant le second et dernier essai d'une tâche en échec. */
export const DELAI_REJEU_TACHE_MS = 60_000

const ORIGINE = 'https://vitfix.io'
const LONGUEUR_JOURNAL_MAX = 500

export interface EnvTaches {
  /** Secret des tâches planifiées (wrangler secret put CRON_SECRET), le même que celui de GitHub Actions. */
  CRON_SECRET?: unknown
}

/** Ce que le Worker reçoit d'un Cron Trigger (ScheduledController de Cloudflare, réduit à ce qui sert ici). */
export interface DeclenchementPlanifie {
  cron: string
}

export interface OptionsTaches {
  /** Attente entre deux essais (remplacée dans les tests). */
  attendre?: (ms: number) => Promise<void>
}

const attendreVraiment = (ms: number) => new Promise<void>(resoudre => { setTimeout(resoudre, ms) })

/** Corps de la réponse pour le journal, borné ; illisible : vide. */
async function corpsPourJournal(reponse: Response): Promise<string> {
  try {
    return (await reponse.text()).slice(0, LONGUEUR_JOURNAL_MAX)
  } catch (erreur) {
    console.warn('[taches] corps de la réponse illisible :', erreur instanceof Error ? erreur.message : erreur)
    return ''
  }
}

/** Handler `scheduled` du Worker : appelle la route de la tâche déclenchée, et la rejoue une fois si elle échoue. */
export function creerTachesPlanifiees<Env extends EnvTaches>(gestionnaire: Gestionnaire<Env>, options: OptionsTaches = {}) {
  const attendre = options.attendre ?? attendreVraiment

  async function appeler(chemin: string, secret: string, env: Env, ctx: ContexteExecution): Promise<Response | null> {
    try {
      const requete = new Request(`${ORIGINE}${chemin}`, { method: 'GET', headers: { authorization: `Bearer ${secret}` } })
      return await gestionnaire.fetch(requete, env, ctx)
    } catch (erreur) {
      console.error(`[taches] ${chemin} : exception`, erreur instanceof Error ? erreur.message : erreur)
      return null
    }
  }

  return async function scheduled(declenchement: DeclenchementPlanifie, env: Env, ctx: ContexteExecution): Promise<void> {
    const chemin = TACHES_PLANIFIEES[declenchement.cron]
    if (!chemin) {
      console.warn(`[taches] déclenchement sans tâche associée : ${declenchement.cron}`)
      return
    }
    const secret = typeof env.CRON_SECRET === 'string' ? env.CRON_SECRET : ''
    if (secret === '') {
      console.error(`[taches] ${chemin} non appelée : CRON_SECRET absent du Worker`)
      return
    }
    let reponse = await appeler(chemin, secret, env, ctx)
    if (!reponse || reponse.status >= 500) {
      if (reponse) console.warn(`[taches] ${chemin} : ${reponse.status}, ${await corpsPourJournal(reponse)} ; nouvel essai dans une minute`)
      await attendre(DELAI_REJEU_TACHE_MS)
      reponse = await appeler(chemin, secret, env, ctx)
    }
    if (!reponse) return
    const message = `[taches] ${chemin} : ${reponse.status} ${await corpsPourJournal(reponse)}`
    if (reponse.ok) console.log(message)
    else console.error(message)
  }
}
