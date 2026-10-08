/**
 * Parcours des textes du dashboard syndic v54 — sert à deux choses :
 *  - prouver que la version PT reste strictement identique (instantané PT pris
 *    sur main, comparé après chaque modification) ;
 *  - vérifier qu'il ne reste aucun texte portugais dans la version FR.
 *
 * Pour un écran donné, on relève tous les textes visibles et les attributs lus
 * par l'utilisateur ou les lecteurs d'écran (aria-label, placeholder, title…),
 * puis on clique tour à tour sur chaque élément cliquable (re-rendu à neuf avant
 * chaque clic) et sur chaque élément cliquable de la boîte de dialogue ouverte,
 * en relevant ce qui apparaît et ce qui disparaît. Les appels réseau restent en
 * attente (jamais résolus) : on capture l'interface, pas les données de l'API.
 *
 * Le relevé d'un état est la liste de ses textes dans l'ordre du document, doublons
 * compris, avec l'état des contrôles : option choisie des listes déroulantes, cases
 * cochées, états ARIA (codés en chiffres, jamais en mots, pour ne pas fausser le
 * contrôle « aucun texte portugais » de la version FR). L'état initial d'un écran
 * voit donc un libellé qui se multiplie, se déplace ou disparaît.
 * Limite : chaque clic est relevé comme une différence de multiensembles par rapport
 * à l'état précédent (ce qui apparaît, ce qui disparaît, en nombre d'occurrences) ;
 * un simple réordonnancement provoqué par un clic (tri, déplacement sans ajout ni
 * retrait) n'y laisse aucune trace.
 */
import fs from 'node:fs'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'aria-description', 'aria-valuetext'] as const

const CLICKABLE = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'summary',
].join(', ')

const DIALOG = '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'

/**
 * Version du format des relevés (fichiers JSON de l'instantané PT). 1 : ensemble trié
 * sans `removed` ; 2 : ordre du document, doublons, états des contrôles, `removed`.
 */
export const FORMAT_RELEVE = 2

/** Date figée : les écrans affichent la date du jour (agenda, échéances, horloge du shell). */
export const FIXED_NOW = new Date('2026-10-07T10:00:00.000Z')

/** Générateur pseudo-aléatoire déterministe (mulberry32), réinitialisé à chaque rendu. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** États ARIA relevés : 1 = vrai (ou valeur d'aria-current autre que « false »), 2 = « mixed », 0 sinon. */
const ARIA_STATES = ['aria-checked', 'aria-selected', 'aria-pressed', 'aria-current', 'aria-expanded'] as const

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

function etatAria(attr: (typeof ARIA_STATES)[number], v: string): 0 | 1 | 2 {
  if (v === 'mixed' && (attr === 'aria-checked' || attr === 'aria-pressed')) return 2
  if (attr === 'aria-current') return v === 'false' ? 0 : 1
  return v === 'true' ? 1 : 0
}

/** Attributs lus, valeur saisie et état d'un élément, dans un ordre fixe. */
function releveElement(el: Element, out: string[]): void {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v && norm(v)) out.push(`@${a}=${norm(v)}`)
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') out.push(`@checked=${el.checked ? 1 : 0}`)
    else if (!['hidden', 'file'].includes(el.type) && norm(el.value)) out.push(`@value=${norm(el.value)}`)
  }
  if (el instanceof HTMLTextAreaElement && norm(el.value)) out.push(`@value=${norm(el.value)}`)
  if (el instanceof HTMLSelectElement) {
    for (const o of el.selectedOptions) if (norm(o.text)) out.push(`@selected=${norm(o.text)}`)
  }
  for (const a of ARIA_STATES) {
    const v = el.getAttribute(a)
    if (v !== null) out.push(`@${a}=${etatAria(a, v)}`)
  }
}

/**
 * Textes, attributs et états visibles sous `root` (racine exclue pour ses attributs),
 * dans l'ordre du document, doublons compris.
 */
export function collectTexts(root: ParentNode = document.body): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      releveElement(n as Element, out)
      continue
    }
    if (n.parentElement?.closest('script, style, noscript')) continue
    const t = norm(n.nodeValue ?? '')
    if (t) out.push(t)
  }
  return out
}

/** Zone de recherche formée de plusieurs sous-arbres du document (les éléments restent en place). */
export function unionScope(selectors: string[]): () => ParentNode {
  return () =>
    ({
      querySelectorAll: (sel: string) =>
        selectors.flatMap((s) => [...document.querySelectorAll(s)].flatMap((root) => [...root.querySelectorAll(sel)])),
    }) as unknown as ParentNode
}

function clickables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CLICKABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true',
  )
}

function labelOf(el: HTMLElement): string {
  const l = el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.tagName.toLowerCase()
  return norm(l).slice(0, 80)
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()
  })
}

/** Éléments de `xs` en excédent sur `ys`, occurrence par occurrence, dans l'ordre de `xs`. */
function reste(xs: readonly string[], ys: readonly string[]): string[] {
  const dispo = new Map<string, number>()
  for (const y of ys) dispo.set(y, (dispo.get(y) ?? 0) + 1)
  return xs.filter((x) => {
    const k = dispo.get(x) ?? 0
    if (k === 0) return true
    dispo.set(x, k - 1)
    return false
  })
}

/** Différence de multiensembles entre deux relevés. */
function diff(after: readonly string[], before: readonly string[]): Pick<ClickStep, 'added' | 'removed'> {
  return { added: reste(after, before), removed: reste(before, after) }
}

export interface ClickStep {
  /** Chemin du clic : index et libellé de chaque élément cliqué. */
  path: string
  /** Occurrences apparues par rapport à l'état précédent (un libellé déjà présent qui se multiplie compris). */
  added: string[]
  /** Occurrences disparues par rapport à l'état précédent (lignes masquées par un filtre, option désélectionnée…). */
  removed: string[]
  /** Erreur levée par le gestionnaire de clic, le cas échéant (jsdom n'a pas tout). */
  error?: string
}

export interface CrawlResult {
  initial: string[]
  clicks: ClickStep[]
}

/**
 * Chaînes distinctes d'un ou plusieurs parcours : état initial et apparitions. Les
 * disparitions n'ajoutent rien : elles proviennent d'un état déjà relevé.
 */
export function textesDistincts(parties: readonly CrawlResult[]): string[] {
  return [...new Set(parties.flatMap((p) => [...p.initial, ...p.clicks.flatMap((c) => c.added)]))]
}

export interface CrawlOptions {
  /** Rendu à neuf de l'écran (appelé avant chaque clic). */
  mount: () => ReactElement
  /** Navigation préalable après chaque rendu (ex. clic sur l'entrée de sidebar). */
  prepare?: () => Promise<void> | void
  /** Zone où chercher les éléments à cliquer (par défaut tout le document). */
  scope?: () => ParentNode
  /** Profondeur 2 : cliquer aussi dans la boîte de dialogue ouverte. */
  dialogs?: boolean
}

async function fresh(opts: CrawlOptions): Promise<void> {
  cleanup()
  const rnd = seededRandom(42)
  vi.spyOn(Math, 'random').mockImplementation(rnd)
  render(opts.mount())
  await flush()
  if (opts.prepare) {
    await opts.prepare()
    await flush()
  }
}

async function safeClick(el: HTMLElement): Promise<string | undefined> {
  try {
    fireEvent.click(el)
    await flush()
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message.split('\n')[0] : String(e)
  }
}

/** Parcourt un écran : état initial, puis chaque clic (et chaque clic dans la boîte de dialogue ouverte). */
export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const scope = opts.scope ?? (() => document.body)
  await fresh(opts)
  const initial = collectTexts()
  const n = clickables(scope()).length
  const clicks: ClickStep[] = []

  for (let i = 0; i < n; i++) {
    await fresh(opts)
    const el = clickables(scope())[i]
    if (!el) {
      clicks.push({ path: `${i}:<absent>`, added: [], removed: [] })
      continue
    }
    const label = labelOf(el)
    const error = await safeClick(el)
    const after = collectTexts()
    clicks.push({ path: `${i}:${label}`, ...diff(after, initial), ...(error ? { error } : {}) })

    if (!opts.dialogs) continue
    const dialog = document.querySelector(DIALOG)
    if (!dialog) continue
    const m = clickables(dialog).length
    for (let j = 0; j < m; j++) {
      await fresh(opts)
      const el1 = clickables(scope())[i]
      if (!el1) break
      await safeClick(el1)
      const before2 = collectTexts()
      const d = document.querySelector(DIALOG)
      const el2 = d ? clickables(d)[j] : undefined
      if (!el2) {
        clicks.push({ path: `${i}:${label} > ${j}:<absent>`, added: [], removed: [] })
        continue
      }
      const label2 = labelOf(el2)
      const error2 = await safeClick(el2)
      clicks.push({
        path: `${i}:${label} > ${j}:${label2}`,
        ...diff(collectTexts(), before2),
        ...(error2 ? { error: error2 } : {}),
      })
    }
  }
  cleanup()
  return { initial, clicks }
}

/** Environnement commun : date figée, réseau en attente, API navigateur absentes de jsdom neutralisées. */
export function installCrawlEnvironment(): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXED_NOW)
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(window, 'open').mockReturnValue(null)
  // Sous Node, doc.save() de jsPDF écrit le PDF dans le dossier courant (fs.writeFileSync) :
  // on laisse passer toutes les écritures sauf celles des .pdf.
  const ecrire = fs.writeFileSync
  vi.spyOn(fs, 'writeFileSync').mockImplementation(((fichier: fs.PathOrFileDescriptor, ...reste: unknown[]) => {
    if (typeof fichier === 'string' && /\.pdf$/i.test(fichier)) return
    return (ecrire as (...a: unknown[]) => void)(fichier, ...reste)
  }) as typeof fs.writeFileSync)
  if (!('createObjectURL' in URL)) Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:crawl', configurable: true })
  if (!('revokeObjectURL' in URL)) Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {}
  // Presse-papiers absent de jsdom : sans lui, « Copiar » (Extranet) afficherait l'erreur de copie
  // au lieu du toast de succès. Faux presse-papiers qui accepte la copie (cas nominal d'un navigateur).
  if (!('clipboard' in navigator)) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true })
  }
}
