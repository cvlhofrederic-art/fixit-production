// tests/lib/aj-signalement-identifiants-reserves.test.ts
//
// Gardes du chemin par cabinet client (vitfix.io/<identifiant>/…, choix de Hugo du 10/11/2026).
//
// 1. Collision : un cabinet ne peut pas prendre le nom d'une route du site. Les premiers segments sont calculés ici
//    depuis le DISQUE (app/, groupes de routes traversés, app/{fr,pt,en,es,nl}/, public/) et depuis le TEXTE de
//    next.config.ts (sources des redirections, réécritures et en-têtes ; le segment qui suit une langue compte aussi) :
//    chacun doit être refusé par validerIdentifiantCabinetQr. Une route ajoutée plus tard sans réserver son nom fait
//    échouer ce test. Les préfixes testés par startsWith sans barre (ConditionalLayout, middleware) doivent figurer
//    dans PREFIXES_RESERVES_QR. Le test n'importe pas next.config.ts (il tourne sans le Sentry local).
//    Limite : il ne voit pas la base. Avant d'ajouter une redirection racine « /<x>/:path* », vérifier en base
//    qu'aucun cabinet ne porte déjà l'identifiant <x> (sinon ses QR codes imprimés seraient captés).
// 2. Masquage : le middleware reconnaît « /<x>/signalement/<32 hex>/ » et « /<x>/confirmation-adresse/ » pour tout
//    <x> du motif, avant la langue. Aucune page de app/ ne doit donc avoir l'une de ces formes (ni « suivi » ou
//    « invitation », réservés à la PR 2), sinon elle deviendrait injoignable.
// 3. Aucun identifiant ni domaine réel d'un client en dur : il se saisit dans l'espace par le super admin. Le mot
//    cherché est construit par concaténation (il n'apparaît pas dans ce fichier).

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import {
  PREFIXES_RESERVES_QR, SEGMENTS_CABINET_QR, cheminPublicCabinetQr, validerIdentifiantCabinetQr,
} from '@/lib/aj-signalement/chemin-cabinet'

const RACINE = process.cwd()
const APP = join(RACINE, 'app')
const LANGUES = ['fr', 'pt', 'en', 'es', 'nl']
const JETON = '0123456789abcdef0123456789abcdef'

const estDossier = (chemin: string): boolean => existsSync(chemin) && statSync(chemin).isDirectory()
const estGroupe = (nom: string): boolean => nom.startsWith('(') && nom.endsWith(')')
const estDynamique = (nom: string): boolean => nom.startsWith('[')
/** Dossiers privés (_x) et emplacements parallèles (@x) : jamais un segment d'URL. */
const estHorsUrl = (nom: string): boolean => nom.startsWith('_') || nom.startsWith('@')

/** Le dossier et ses groupes de routes, à toute profondeur (un groupe n'ajoute aucun segment). */
function avecGroupes(dossier: string): string[] {
  if (!estDossier(dossier)) return []
  return [
    dossier,
    ...readdirSync(dossier, { withFileTypes: true })
      .filter((e) => e.isDirectory() && estGroupe(e.name))
      .flatMap((e) => avecGroupes(join(dossier, e.name))),
  ]
}

/** Images générées (icon.tsx…) servies sans extension à la racine de leur dossier. */
const IMAGE_GENEREE = /^(icon|apple-icon|opengraph-image|twitter-image)\d*\.(tsx|ts|jsx|js)$/

/** Segments littéraux servis juste sous ce dossier : dossiers enfants (groupes traversés) et images générées. */
function segmentsLitteraux(dossier: string): string[] {
  return avecGroupes(dossier).flatMap((d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return estGroupe(e.name) || estDynamique(e.name) || estHorsUrl(e.name) ? [] : [e.name]
    const image = IMAGE_GENEREE.exec(e.name)
    return image ? [image[1]] : []
  }))
}

/** Segments littéraux des sources de next.config.ts : le premier, et celui qui suit une langue. */
function segmentsDeNextConfig(): string[] {
  const texte = readFileSync(join(RACINE, 'next.config.ts'), 'utf-8')
  const sources = [...texte.matchAll(/source:\s*(['"`])(\/[^'"`]*)\1/g)].map((m) => m[2])
  expect(sources.length).toBeGreaterThan(100)
  const litteral = (segment: string | undefined): segment is string => !!segment && !/[:()*\\${}]/.test(segment)
  const estLangue = (segment: string): boolean => LANGUES.includes(segment) || /^:locale\((?:fr|pt|en|es|nl)(?:\|(?:fr|pt|en|es|nl))*\)$/.test(segment)
  return sources.flatMap((source) => {
    const [premier, second] = source.split('/').filter(Boolean)
    if (premier && estLangue(premier)) return litteral(second) ? [second] : []
    return litteral(premier) ? [premier] : []
  })
}

/** Préfixes d'un seul segment, sans barre finale, testés par startsWith (un identifiant qui les prolonge en hériterait). */
function prefixesSansBarre(): string[] {
  const layout = readFileSync(join(RACINE, 'components/common/ConditionalLayout.tsx'), 'utf-8')
  const listes = ['DASHBOARD_PATH_PREFIXES', 'AUTH_BOOKING_PATH_PREFIXES'].map((nom) => {
    const bloc = new RegExp(`const ${nom} = \\[([\\s\\S]*?)\\] as const`).exec(layout)
    expect(bloc, nom).not.toBeNull()
    return [...(bloc?.[1] ?? '').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').matchAll(/'([^']*)'/g)].map((m) => m[1])
  })
  const middleware = readFileSync(join(RACINE, 'middleware.ts'), 'utf-8')
  const appels = [...middleware.matchAll(/startsWith\('([^']*)'\)/g)].map((m) => m[1])
  return [...listes.flat(), ...appels]
    .filter((p) => /^\/[a-z][a-z0-9-]*$/.test(p))
    .map((p) => p.slice(1))
}

describe('aucun identifiant de cabinet ne peut prendre le nom d’une route du site', () => {
  const sources: Array<{ origine: string; segments: string[] }> = [
    { origine: 'app/ (groupes de routes compris)', segments: segmentsLitteraux(APP) },
    ...LANGUES.map((l) => ({ origine: `app/${l}/`, segments: segmentsLitteraux(join(APP, l)) })),
    { origine: 'public/', segments: readdirSync(join(RACINE, 'public')) },
    { origine: 'next.config.ts', segments: segmentsDeNextConfig() },
  ]

  it('les segments sont bien lus (sinon la garde ne garderait rien)', () => {
    const tous = new Set(sources.flatMap((s) => s.segments))
    for (const attendu of ['api', 'aj-signalement', 'signalement', 'syndic', 'blog', 'servicos', 'fonts', 'mois', 'contacto']) {
      expect(tous.has(attendu), attendu).toBe(true)
    }
  })

  for (const { origine, segments } of sources) {
    it(`chaque premier segment de ${origine} est refusé à la saisie`, () => {
      const admis = [...new Set(segments)].filter((segment) => validerIdentifiantCabinetQr(segment).ok)
      expect(admis, `à ajouter à IDENTIFIANTS_RESERVES_QR (lib/aj-signalement/chemin-cabinet.ts) : ${admis.join(', ')}`).toEqual([])
    })
  }

  it('chaque préfixe testé par startsWith sans barre (ConditionalLayout, middleware) est un préfixe réservé', () => {
    const prefixes = prefixesSansBarre()
    expect(prefixes).toContain('aj-signalement')
    expect(prefixes).toContain('administrateur-judiciaire')
    const manquants = [...new Set(prefixes)].filter((p) => !PREFIXES_RESERVES_QR.includes(p))
    expect(manquants, `à ajouter à PREFIXES_RESERVES_QR : ${manquants.join(', ')}`).toEqual([])
  })
})

// ── Masquage d'une page par le motif du middleware ──

/** Routes de app/ (dossiers qui ont une page ou un gestionnaire de route), en segments d'URL (groupes omis). */
function routesDeApp(dossier = APP, segments: string[] = []): string[][] {
  const entrees = readdirSync(dossier, { withFileTypes: true })
  const routes = entrees.some((e) => e.isFile() && /^(page|route)\.(tsx|ts|jsx|js)$/.test(e.name)) ? [segments] : []
  for (const e of entrees) {
    if (!e.isDirectory() || estHorsUrl(e.name)) continue
    routes.push(...routesDeApp(join(dossier, e.name), estGroupe(e.name) ? segments : [...segments, e.name]))
  }
  return routes
}

/**
 * Segment d'un chemin capté : `mot` (signalement, confirmation-adresse, suivi, invitation) ne compte comme servi que par
 * un segment littéral égal ou par un attrape-tout ([...x]) ; un paramètre simple ([x]) qui vaudrait ce mot n'est pas une
 * page du site (/signalement/[jeton]/ ne sert que des jetons). Les autres segments (identifiant, jeton) sont des valeurs.
 */
interface SegmentCapte { texte: string; mot: boolean }

/** Le motif de route (segments, [x], [...x], [[...x]]) sert-il ce chemin ? */
function sert(motif: readonly string[], chemin: readonly SegmentCapte[]): boolean {
  if (motif.length === 0) return chemin.length === 0
  const [tete, ...suite] = motif
  if (/^\[\[\.\.\..+\]\]$/.test(tete)) return true
  if (/^\[\.\.\..+\]$/.test(tete)) return chemin.length >= 1
  if (chemin.length === 0) return false
  if (estDynamique(tete)) return !chemin[0].mot && sert(suite, chemin.slice(1))
  return tete === chemin[0].texte && sert(suite, chemin.slice(1))
}

/** Chemins d'un cabinet que le motif capte (ou captera en PR 2) pour le premier segment d'une route. */
function cheminsCaptes(premier: string): SegmentCapte[][] {
  const id = estDynamique(premier) ? 'cabinet-exemple' : premier
  // Le premier segment est-il un identifiant pour le motif ? (« fr », « api », « admin » ne le sont pas.)
  if (!cheminPublicCabinetQr(`/${id}/confirmation-adresse/`)) return []
  const valeur = (texte: string): SegmentCapte => ({ texte, mot: false })
  const mot = (texte: string): SegmentCapte => ({ texte, mot: true })
  return [
    [valeur(id), mot('signalement'), valeur(JETON)],
    ...SEGMENTS_CABINET_QR.filter((s) => s !== 'signalement').map((s) => [valeur(id), mot(s)]),
  ]
}

const masquees = (routes: readonly string[][]): string[] => routes
  .filter((route) => route.length > 0 && cheminsCaptes(route[0]).some((chemin) => sert(route, chemin)))
  .map((route) => `/${route.join('/')}`)

describe('aucune page de app/ n’est masquée par le motif du chemin d’un cabinet', () => {
  it('la garde détecte une page qui serait masquée (contrôle de la garde elle-même)', () => {
    const fautives = [['blog', 'signalement', '[id]'], ['blog', 'confirmation-adresse'], ['blog', 'suivi'],
      ['blog', 'invitation', '[[...reste]]'], ['blog', '[...reste]'], ['[x]', '[...reste]'], ['[[...tout]]']]
    expect(masquees(fautives)).toEqual(fautives.map((r) => `/${r.join('/')}`))
    const saines = [['fr', 'signalement', '[jeton]'], ['signalement', '[jeton]'], ['api', 'signalement', '[id]'],
      ['tracking', '[token]'], ['blog', '[slug]', '[page]'], ['blog', 'signalement'], ['blog', 'signalement', '[id]', 'detail']]
    expect(masquees(saines)).toEqual([])
  })

  it('aucune route réelle n’a « signalement/<segment> », « confirmation-adresse », « suivi » ni « invitation » en 2e segment', () => {
    const routes = routesDeApp()
    expect(routes.length).toBeGreaterThan(50)
    expect(masquees(routes)).toEqual([])
  })
})

// ── Aucun identifiant ni domaine réel d'un client ──

const MOT_INTERDIT = new RegExp(`${['a', 'j'].join('')}[\\s._-]?${['asso', 'ci'].join('')}`, 'i')

/** Fichiers texte sous un chemin (dossier parcouru, ou fichier seul). */
function fichiers(chemin: string): string[] {
  if (!existsSync(chemin)) return []
  if (!statSync(chemin).isDirectory()) return [chemin]
  return readdirSync(chemin, { withFileTypes: true }).flatMap((e) => fichiers(join(chemin, e.name)))
}

function perimetreAjSignalement(): string[] {
  const dossiersTests = ['tests', ...readdirSync(join(RACINE, 'tests'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => join('tests', e.name))]
  const testsAj = dossiersTests.flatMap((d) => readdirSync(join(RACINE, d))
    .filter((nom) => nom.includes('aj-signalement') || nom.includes('signalements_qr'))
    .map((nom) => join(d, nom)))
  const migrations = readdirSync(join(RACINE, 'supabase/migrations'))
    .filter((nom) => nom.includes('signalements_qr'))
    .map((nom) => join('supabase/migrations', nom))
  return [
    'lib/aj-signalement', 'app/api/aj-signalement', 'app/(commun)/aj-signalement', 'app/(commun)/signalement',
    'app/(commun)/cabinet', 'components/aj-signalement', 'middleware.ts', 'next.config.ts', 'lib/validation.ts',
    ...migrations, ...testsAj,
  ].flatMap((chemin) => fichiers(join(RACINE, chemin)))
}

describe('aucun identifiant ni domaine réel d’un client dans le code, les migrations et les tests d’AJ Signalement', () => {
  it('le mot cherché est bien reconnu (contrôle de la garde elle-même)', () => {
    expect(MOT_INTERDIT.test(['a', 'j', 'asso', 'cies'].join(''))).toBe(true)
    expect(MOT_INTERDIT.test(['A', 'J', ' ', 'Asso', 'ciés'].join(''))).toBe(true)
    expect(MOT_INTERDIT.test(['a', 'j', '-', 'asso', 'cies.fr'].join(''))).toBe(true)
    expect(MOT_INTERDIT.test('cabinet-exemple')).toBe(false)
  })

  it('aucun fichier du périmètre ne le contient (exemples : « cabinet-exemple », « exemple.test »)', () => {
    const liste = perimetreAjSignalement()
    expect(liste.length).toBeGreaterThan(30)
    expect(liste.some((f) => f.endsWith(`${sep}migrations${sep}20261111_signalements_qr_gestionnaires.sql`))).toBe(true)
    const fautifs = liste
      .filter((f) => MOT_INTERDIT.test(readFileSync(f, 'utf-8')))
      .map((f) => relative(RACINE, f))
    expect(fautifs).toEqual([])
  })
})
