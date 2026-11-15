// tests/helpers/faux-fournisseurs-ia.ts — faux Groq, Cerebras et Claude au niveau de `fetch`, et faux binding Workers AI
// (par `getCfEnv`), pour les tests des agents IA.
//
// Les routes passent par lib/groq, lib/cerebras, lib/claude, lib/workers-ai et lib/ai/relais sans aucune simulation :
// seuls `fetch` et le binding du Worker sont remplacés. Un test voit donc le modèle réellement envoyé à chaque
// fournisseur, le relais quand Groq échoue, et ce que la route rend au client. Clés factices seulement.
//
// Binding Workers AI : le fichier de test déclare
//   vi.mock('@/lib/env', async () => (await import('../helpers/faux-fournisseurs-ia')).envAvecWorkersAI())
// puis appelle `installerWorkersAI(…)` (binding présent) ou `retirerWorkersAI()` (binding absent, comme hors Worker).

import { vi } from 'vitest'
import { ANTHROPIC_API_URL, CEREBRAS_API_URL, CLAUDE_MODEL_AGENTS, GROQ_API_URL } from '@/lib/constants'

/** Environnement Cloudflare simulé, lu par `getCfEnv` (binding `AI` présent ou non). */
const etatCloudflare: { env: Record<string, unknown> } = { env: {} }

/** Fabrique de `vi.mock('@/lib/env')` : le vrai module, sauf `getCfEnv`, qui rend l'environnement simulé. */
export async function envAvecWorkersAI() {
  const reel = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return { ...reel, getCfEnv: vi.fn(async () => etatCloudflare.env) }
}

export type AppelWorkersAIFaux = { modele: string; entrees: Record<string, unknown> }

/**
 * Pose un faux binding Workers AI : chaque appel est noté (modèle, entrées) puis servi par `repondre`, qui rend la
 * sortie du modèle (`sortieWorkersAI`) ou lève l'erreur du binding (« 3040: … »).
 */
export function installerWorkersAI(repondre: (modele: string, entrees: Record<string, unknown>) => unknown): AppelWorkersAIFaux[] {
  const appels: AppelWorkersAIFaux[] = []
  etatCloudflare.env = {
    AI: {
      run: vi.fn(async (modele: string, entrees: Record<string, unknown>) => {
        appels.push({ modele, entrees })
        return repondre(modele, entrees)
      }),
    },
  }
  return appels
}

/** Binding Workers AI absent (comme hors Worker). */
export function retirerWorkersAI(): void {
  etatCloudflare.env = {}
}

/** Sortie d'un modèle de chat de Workers AI. */
export function sortieWorkersAI(content: string, finish_reason = 'stop') {
  return { choices: [{ message: { role: 'assistant', content }, finish_reason }], usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 } }
}

export type AppelIA = { url: string; corps: Record<string, unknown> }
export type Repondre = (url: string, corps: Record<string, unknown>) => Response | Promise<Response>

/** Réponse non streamée au format OpenAI (Groq, Cerebras) : raisonnement à part, texte dans `content`. */
export function reponseOpenAI(content: string, model = 'openai/gpt-oss-120b', finish_reason = 'stop'): Response {
  return Response.json({
    choices: [{ message: { role: 'assistant', content, reasoning: 'Raisonnement du modèle.' }, finish_reason }],
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    model,
  })
}

/** Flux SSE au format OpenAI : un morceau de raisonnement (à ignorer), puis le texte. */
export function fluxOpenAI(texte: string): Response {
  const morceau = (delta: Record<string, string>) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`
  return new Response(`${morceau({ reasoning: 'Je réfléchis.' })}${morceau({ content: texte })}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** Réponse de l'API Messages d'Anthropic, en flux (lib/claude lit le flux même pour un appel non streamé). */
export function reponseClaude(texte: string): Response {
  const evenements = [
    {
      type: 'message_start',
      message: {
        id: 'msg_test', type: 'message', role: 'assistant', model: CLAUDE_MODEL_AGENTS, content: [], stop_reason: null,
        usage: { input_tokens: 10, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texte } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]
  return new Response(evenements.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** Erreur d'un fournisseur, comme celle d'un modèle retiré (404 « Model does not exist »). */
export function erreurFournisseur(status: number, message = 'The model does not exist or you do not have access to it.'): Response {
  return Response.json({ error: { message, type: 'invalid_request_error', code: 'model_not_found' } }, { status })
}

/** Remplace `fetch` : chaque appel est noté (URL et corps JSON) puis servi par `repondre`. */
export function installerFetchIA(repondre: Repondre): AppelIA[] {
  const appels: AppelIA[] = []
  const faux = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === 'string' ? entree : entree instanceof URL ? entree.toString() : entree.url
    let corps: Record<string, unknown> = {}
    try {
      corps = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    } catch {
      corps = {}
    }
    appels.push({ url, corps })
    return repondre(url, corps)
  })
  vi.stubGlobal('fetch', faux)
  return appels
}

export const versGroq = (appels: AppelIA[]) => appels.filter(a => a.url === GROQ_API_URL)
export const versCerebras = (appels: AppelIA[]) => appels.filter(a => a.url === CEREBRAS_API_URL)
export const versClaude = (appels: AppelIA[]) => appels.filter(a => a.url === ANTHROPIC_API_URL)

/**
 * PDF SYNTHÉTIQUE valide (catalogue, arbre des pages, police standard, table xref exacte), lisible par pdf.js.
 * `pagesDeclarees` fabrique un PDF qui ment sur son nombre de pages (/Count) ; `lignes` : texte (ASCII) de la
 * première page, sa couche de texte. Sans lignes, le PDF n'a aucun texte, comme un scan.
 */
export function pdfSynthetique(pages = 1, pagesDeclarees = pages, lignes: string[] = []): Uint8Array<ArrayBuffer> {
  const contenu = lignes
    .map((ligne, i) => `BT /F1 11 Tf 50 ${800 - i * 16} Td (${ligne.replace(/[\\()]/g, c => `\\${c}`)}) Tj ET`)
    .join('\n')
  const premierePage = 5
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${premierePage + i} 0 R`).join(' ')}] /Count ${pagesDeclarees} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    ...Array.from({ length: pages }, (_, i) =>
      i === 0
        ? '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> >> >>'
        : '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>'),
  ]
  let pdf = '%PDF-1.4\n'
  const decalages: number[] = []
  objets.forEach((objet, i) => {
    decalages.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${objet}\nendobj\n`
  })
  const debutXref = pdf.length
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  pdf += decalages.map(d => `${String(d).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`
  return new Uint8Array(new TextEncoder().encode(pdf))
}

/** Data URL d'un contenu binaire. */
export const dataUrl = (type: string, octets: Uint8Array) => `data:${type};base64,${Buffer.from(octets).toString('base64')}`

const CLES = { groq: 'GROQ_API_KEY', claude: 'ANTHROPIC_API_KEY', cerebras: 'CEREBRAS_API_KEY' } as const

/**
 * Pose (ou retire) les clés d'API factices et rend la fonction qui remet l'environnement d'origine.
 * Par défaut : Groq et Claude configurés, Cerebras absent.
 */
export function poserCles(cles: { groq?: boolean; claude?: boolean; cerebras?: boolean } = {}): () => void {
  const voulu = { groq: cles.groq ?? true, claude: cles.claude ?? true, cerebras: cles.cerebras ?? false }
  const origine = Object.fromEntries(Object.values(CLES).map(k => [k, process.env[k]]))
  for (const [nom, variable] of Object.entries(CLES) as Array<[keyof typeof CLES, string]>) {
    if (voulu[nom]) process.env[variable] = `cle-factice-${nom}`
    else delete process.env[variable]
  }
  return () => {
    for (const [variable, valeur] of Object.entries(origine)) {
      if (valeur === undefined) delete process.env[variable]
      else process.env[variable] = valeur
    }
  }
}
