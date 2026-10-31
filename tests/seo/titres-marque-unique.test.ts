/**
 * La marque une seule fois dans le <title> des pages FR et EN (règle SEO du dépôt, comme le PT depuis la phase 1) :
 * les pages donnent un titre sans marque, le template « %s | VITFIX » de app/fr/layout.tsx et de app/en/layout.tsx
 * l'ajoute, et une page dont la phrase contient déjà la marque prend un titre absolu (title.absolute). Jusqu'au
 * 31/10/2026, 854 titres la répétaient (« Carreleur près de chez moi, Artisan disponible rapidement | VITFIX | VITFIX
 * Marseille »).
 *
 * Chaque page.tsx et layout.tsx de app/fr et de app/en est importé, avec chaque jeu de paramètres de
 * generateStaticParams, et le titre est résolu comme Next le fait (next/dist/lib/metadata/resolve-metadata.js) : une
 * métadonnée par segment puis celle de la page ; le template d'un layout ne vaut que pour les segments plus profonds,
 * jamais pour la page de son propre segment (accueils /fr/ et /en/), et title.absolute l'ignore. « Fixit », l'ancien
 * nom, compte comme la marque. Supabase (fiches artisan et société) est simulé par un fetch factice.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'

declare global {
  interface ImportMeta {
    glob<T>(motifs: string | string[]): Record<string, () => Promise<T>>
  }
}

const MARQUE = /vitfix|fixit/gi
const nombreDeMarques = (texte: string) => (texte.match(MARQUE) ?? []).length

// Cookie de langue lu par generateMetadata (/fr/marches/publier/) et par getServerTranslation (/fr/avis/). En
// production, le middleware le pose à la langue de la section et cookies() le voit dans la même requête.
const requete = vi.hoisted(() => ({ locale: undefined as string | undefined }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nom: string) => (nom === 'locale' && requete.locale ? { name: 'locale', value: requete.locale } : undefined) }),
  headers: async () => ({ get: () => null }),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

// Réponses de Supabase REST pour les fiches sans generateStaticParams, une par identifiant (lecture mise en cache par
// requête côté serveur) : profil FR, profil PT, profils sans nom de société, profil absent, erreur, réseau coupé.
const PROFIL = { bio: null, categories: ['Plombier'], rating_avg: null, rating_count: 0, profile_photo_url: null, latitude: null, longitude: null, phone: null }
const FICHES: Record<string, { ok: boolean; lignes: unknown[] } | 'erreur-reseau'> = {
  'fiche-fr': { ok: true, lignes: [{ ...PROFIL, company_name: 'Plomberie Durand', company_city: 'Marseille', language: 'fr', slug: 'fiche-fr' }] },
  'fiche-pt': { ok: true, lignes: [{ ...PROFIL, company_name: 'Canalizações Silva', company_city: 'Porto', language: 'pt', slug: 'fiche-pt' }] },
  'fiche-fr-sans-nom': { ok: true, lignes: [{ ...PROFIL, company_name: null, company_city: 'Marseille', language: 'fr', slug: 'fiche-fr-sans-nom' }] },
  'fiche-pt-sans-nom': { ok: true, lignes: [{ ...PROFIL, company_name: null, company_city: 'Porto', language: 'pt', slug: 'fiche-pt-sans-nom' }] },
  'fiche-absente': { ok: true, lignes: [] },
  'fiche-en-erreur': { ok: false, lignes: [] },
  'fiche-hors-ligne': 'erreur-reseau',
}

type Props = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }
type ModuleDeRoute = {
  metadata?: Metadata
  generateMetadata?: (props: Props) => Promise<Metadata>
  generateStaticParams?: () => Array<Record<string, string>> | Promise<Array<Record<string, string>>>
}
const MODULES = import.meta.glob<ModuleDeRoute>(['/app/fr/**/{page,layout}.tsx', '/app/en/**/{page,layout}.tsx'])

type Titre = Metadata['title']
type TitreResolu = { chemin: string; titre: string; titresAvecTemplate: string[] }

// Résolution de Next : `couches` = une entrée par segment (racine de app/, puis chaque dossier), puis la page. Après
// chaque couche, sauf les deux dernières (layout du segment de la page et page), le template retenu devient celui du
// titre résolu.
function resoudreTitre(couches: Titre[]): Omit<TitreResolu, 'chemin'> {
  let template: string | null = null
  let resolu: { absolute: string; template: string | null } | null = null
  const titresAvecTemplate: string[] = []
  const appliquer = (titre: string) => {
    if (!template) return titre
    titresAvecTemplate.push(titre)
    return template.replace(/%s/g, titre)
  }
  for (const [i, titre] of couches.entries()) {
    if (typeof titre === 'string') {
      resolu = { absolute: appliquer(titre), template: null }
    } else if (titre) {
      let absolute = ''
      if ('default' in titre) absolute = appliquer(titre.default)
      if ('absolute' in titre && titre.absolute) absolute = titre.absolute
      resolu = { absolute, template: 'template' in titre ? titre.template ?? null : null }
    }
    if (i < couches.length - 2) template = resolu?.template ?? null
  }
  return { titre: resolu?.absolute ?? '', titresAvecTemplate }
}

async function metadonnees(mod: ModuleDeRoute | undefined, params: Record<string, string>): Promise<Metadata | undefined> {
  if (!mod) return undefined
  if (mod.generateMetadata) return mod.generateMetadata({ params: Promise.resolve(params), searchParams: Promise.resolve({}) })
  return mod.metadata
}

// Titre de chaque page FR et EN, pour chaque jeu de paramètres (generateStaticParams, sinon les fiches simulées), avec
// le cookie de langue que `langue` donne pour la section (« fr » ou « en »).
async function titresDesPages(langue: (section: string) => string): Promise<TitreResolu[]> {
  const resultats: TitreResolu[] = []
  for (const fichierPage of Object.keys(MODULES).filter((f) => f.endsWith('/page.tsx')).sort()) {
    const dossiers = fichierPage.split('/').slice(2, -1)
    requete.locale = langue(dossiers[0])
    const page = await MODULES[fichierPage]()
    const dynamiques = dossiers.filter((d) => d.startsWith('['))
    const jeux: Array<Record<string, string>> = page.generateStaticParams
      ? await page.generateStaticParams()
      : dynamiques.length
        ? Object.keys(FICHES).map((id) => Object.fromEntries(dynamiques.map((d) => [d.slice(1, -1), id])))
        : [{}]
    expect(jeux.length, `${fichierPage} : generateStaticParams vide`).toBeGreaterThan(0)
    for (const params of jeux) {
      const couches: Titre[] = [undefined]
      for (let k = 1; k <= dossiers.length; k++) {
        const layout = MODULES[`/app/${dossiers.slice(0, k).join('/')}/layout.tsx`]
        couches.push((await metadonnees(layout && (await layout()), params))?.title)
      }
      couches.push((await metadonnees(page, params))?.title)
      const chemin = `/${dossiers.map((d) => (d.startsWith('[') ? params[d.slice(1, -1)] : d)).join('/')}/`
      resultats.push({ chemin, ...resoudreTitre(couches) })
    }
  }
  return resultats
}

const fautifs = (titres: TitreResolu[]) =>
  titres
    .filter((t) => nombreDeMarques(t.titre) !== 1 || t.titresAvecTemplate.some((s) => nombreDeMarques(s) > 0))
    .map((t) => `${t.chemin} → « ${t.titre} »`)

describe('titres FR et EN : la marque une seule fois', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-anon-de-test')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const id = decodeURIComponent(String(url)).match(/=eq\.([^&]+)/)?.[1] ?? ''
      const reponse = FICHES[id]
      if (!reponse) throw new Error(`fetch inattendu : ${url}`)
      if (reponse === 'erreur-reseau') throw new TypeError('fetch failed')
      return { ok: reponse.ok, status: reponse.ok ? 200 : 503, json: async () => reponse.lignes }
    }))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('le résolveur reproduit Next : template des segments plus profonds, pas de la page du layout, title.absolute', () => {
    const racine = { default: 'Accueil VITFIX', template: '%s | VITFIX' }
    expect(resoudreTitre([undefined, racine, 'Artisans à Marseille | Vitfix']).titre).toBe('Artisans à Marseille | Vitfix')
    expect(resoudreTitre([undefined, racine, undefined, undefined, 'Plombier Marseille']).titre).toBe('Plombier Marseille | VITFIX')
    expect(resoudreTitre([undefined, racine, 'Titre du layout', 'Titre de la page']).titre).toBe('Titre de la page | VITFIX')
    expect(resoudreTitre([undefined, racine, undefined, { absolute: 'Blog Vitfix' }]).titre).toBe('Blog Vitfix')
    expect(resoudreTitre([undefined, racine, undefined, undefined]).titre).toBe('Accueil VITFIX')
  })

  it.each([
    ['langue de la section', (section: string) => section],
    ['cookie « pt », l’autre branche des pages bilingues', () => 'pt'],
  ])('chaque page FR et EN (%s) : « Vitfix » une seule fois, jamais dans un titre auquel le template s’applique', async (_cas, langue) => {
    const titres = await titresDesPages(langue)
    expect(fautifs(titres)).toEqual([])
    // Couverture : la grille FR (services, urgence, près de chez moi, simulateur, villes) et les pages EN.
    expect(titres.filter((t) => t.chemin.startsWith('/fr/')).length).toBeGreaterThanOrEqual(1500)
    expect(titres.filter((t) => t.chemin.startsWith('/en/')).length).toBeGreaterThanOrEqual(15)
  }, 180_000)

  it('fiches artisan et société : profil FR ou PT, sans nom de société, absent ou Supabase en erreur', async () => {
    const fiches = (await titresDesPages((section) => section)).filter((t) => /^\/fr\/(artisan|societe)\//.test(t.chemin))
    expect(fiches.length).toBe(2 * Object.keys(FICHES).length)
    expect(fautifs(fiches)).toEqual([])
    expect(fiches.find((t) => t.chemin === '/fr/artisan/fiche-fr/')?.titre).toBe('Plomberie Durand - Plombier à Marseille | VITFIX')
    expect(fiches.find((t) => t.chemin === '/fr/artisan/fiche-fr-sans-nom/')?.titre).toBe('Artisan - Plombier à Marseille | VITFIX')
  }, 180_000)
})
