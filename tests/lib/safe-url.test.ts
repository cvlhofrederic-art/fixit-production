import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toSafeUrl, safeOpen, safeNavigate, originesSupabase, estUrlStockageSupabase } from '@/lib/security/safe-url'

// Origine d'un projet Supabase fictif et URL signée telle que la renvoie createSignedUrl
// (le jeton est une valeur factice, pas un secret).
const ORIGINE_SUPABASE = 'https://abcdefghij.supabase.co'
const URL_SIGNEE = `${ORIGINE_SUPABASE}/storage/v1/object/sign/lea-documents/cabinet-1/doc.pdf?token=jeton-de-test-factice`
const ORIGINE_LOCALE = 'http://localhost:3000' // origine du document jsdom (vitest)

describe('toSafeUrl : schémas exécutables et formes trompeuses', () => {
  const options = { allowedOrigins: [ORIGINE_SUPABASE], allowRelative: true }

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,x',
    'vbscript:MsgBox(1)',
    'blob:https://vitfix.io/0b4d7f1e-0000-4000-8000-000000000000',
    'file:///etc/passwd',
  ])('refuse %s', (brut) => {
    expect(toSafeUrl(brut, options)).toBeNull()
    expect(toSafeUrl(brut, { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
    expect(toSafeUrl(brut)).toBeNull()
  })

  it('refuse //evil.example même avec allowRelative (URL absolue sans schéma)', () => {
    expect(toSafeUrl('//evil.example', { allowRelative: true })).toBeNull()
    expect(toSafeUrl('//evil.example/dashboard', { allowRelative: true })).toBeNull()
  })

  it('refuse /\\evil.example même avec allowRelative', () => {
    expect(toSafeUrl('/\\evil.example', { allowRelative: true })).toBeNull()
  })

  it('refuse une origine https hors liste', () => {
    expect(toSafeUrl('https://evil.example', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
    expect(toSafeUrl('https://evil.example/storage/v1/object/sign/x', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
  })

  it('refuse les hôtes qui imitent l’origine autorisée', () => {
    expect(toSafeUrl('https://abcdefghij.supabase.co.evil.example/x', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
    expect(toSafeUrl('https://abcdefghij.supabase.co@evil.example/x', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
    expect(toSafeUrl('https://evil.example/abcdefghij.supabase.co', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
  })

  it('refuse tout avec une liste d’origines vide (variable d’environnement absente)', () => {
    expect(toSafeUrl(URL_SIGNEE, { allowedOrigins: [] })).toBeNull()
  })

  it('refuse http: hors localhost même en développement', () => {
    expect(toSafeUrl('http://vitfix.io/x')).toBeNull()
    expect(toSafeUrl('http://abcdefghij.supabase.co/x', { allowedOrigins: ['http://abcdefghij.supabase.co'] })).toBeNull()
  })

  it('refuse les valeurs qui ne sont pas des chaînes non vides', () => {
    expect(toSafeUrl(null, { allowRelative: true })).toBeNull()
    expect(toSafeUrl(undefined, { allowRelative: true })).toBeNull()
    expect(toSafeUrl(42, { allowRelative: true })).toBeNull()
    expect(toSafeUrl({ href: '/dashboard' }, { allowRelative: true })).toBeNull()
    expect(toSafeUrl('', { allowRelative: true })).toBeNull()
    expect(toSafeUrl('   ', { allowRelative: true })).toBeNull()
  })

  it('refuse un chemin relatif sans allowRelative', () => {
    expect(toSafeUrl('/dashboard')).toBeNull()
    expect(toSafeUrl('/dashboard', { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
  })

  it('refuse un chemin sans barre oblique initiale ou un chemin Windows', () => {
    expect(toSafeUrl('dashboard', { allowRelative: true })).toBeNull()
    expect(toSafeUrl('C:\\Windows\\system32', { allowRelative: true })).toBeNull()
  })
})

describe('toSafeUrl : allowRelative seul = navigation interne', () => {
  // Sans liste d'origines, une URL absolue n'est acceptée que si c'est l'origine de la page :
  // sinon safeNavigate(searchParams.get('next'), { allowRelative: true }) serait une redirection ouverte.
  it.each([
    'https://evil.example',
    'https://evil.example/dashboard',
    'https:evil.example',
    'https:/evil.example/dashboard',
    'HTTPS://EVIL.EXAMPLE/',
    'http://evil.example/',
    'http://localhost.evil.example:3000/dashboard',
  ])('refuse %s avec { allowRelative: true } seul', (brut) => {
    expect(toSafeUrl(brut, { allowRelative: true })).toBeNull()
  })

  it('accepte une URL absolue de l’origine courante', () => {
    const url = toSafeUrl(`${ORIGINE_LOCALE}/admin/dashboard?x=1`, { allowRelative: true })
    expect(url?.href).toBe(`${ORIGINE_LOCALE}/admin/dashboard?x=1`)
  })

  it('reste sans filtre d’origine quand aucune option n’est donnée (schéma seul)', () => {
    expect(toSafeUrl('https://evil.example/')?.href).toBe('https://evil.example/')
  })

  it('une liste d’origines explicite prime sur l’origine courante', () => {
    expect(toSafeUrl(URL_SIGNEE, { allowRelative: true, allowedOrigins: [ORIGINE_SUPABASE] })?.href).toBe(URL_SIGNEE)
    expect(toSafeUrl(`${ORIGINE_LOCALE}/x`, { allowRelative: true, allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
    expect(toSafeUrl('/x', { allowRelative: true, allowedOrigins: [ORIGINE_SUPABASE] })?.href).toBe(`${ORIGINE_LOCALE}/x`)
  })
})

describe('toSafeUrl : URL acceptées', () => {
  it('accepte une URL signée Supabase de l’origine autorisée', () => {
    const url = toSafeUrl(URL_SIGNEE, { allowedOrigins: [ORIGINE_SUPABASE] })
    expect(url).toBeInstanceOf(URL)
    expect(url?.href).toBe(URL_SIGNEE)
    expect(url?.origin).toBe(ORIGINE_SUPABASE)
  })

  it('normalise la casse de l’hôte avant de comparer l’origine', () => {
    const url = toSafeUrl('HTTPS://ABCDEFGHIJ.SUPABASE.CO/storage/v1/x', { allowedOrigins: [ORIGINE_SUPABASE] })
    expect(url?.origin).toBe(ORIGINE_SUPABASE)
  })

  it('accepte /dashboard avec allowRelative, résolu sur l’origine courante', () => {
    const url = toSafeUrl('/dashboard', { allowRelative: true })
    expect(url?.origin).toBe(window.location.origin)
    expect(url?.pathname).toBe('/dashboard')
    expect(url?.href).toBe(`${ORIGINE_LOCALE}/dashboard`)
  })

  it('conserve la chaîne de requête d’un chemin interne', () => {
    const url = toSafeUrl('/api/email-agent/connect?token=a%20b', { allowRelative: true })
    expect(url?.href).toBe(`${ORIGINE_LOCALE}/api/email-agent/connect?token=a%20b`)
  })

  it('ignore les espaces autour de la valeur', () => {
    expect(toSafeUrl(`  ${URL_SIGNEE}  `, { allowedOrigins: [ORIGINE_SUPABASE] })?.href).toBe(URL_SIGNEE)
  })

  it('accepte une page d’autorisation OAuth de la liste', () => {
    const oauth = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y'
    expect(toSafeUrl(oauth, { allowedOrigins: ['https://accounts.google.com', 'https://login.microsoftonline.com'] })?.href).toBe(oauth)
  })
})

describe('toSafeUrl : http sur localhost', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepte http://localhost et http://127.0.0.1 hors production', () => {
    expect(toSafeUrl('http://localhost:3000/x')?.href).toBe('http://localhost:3000/x')
    expect(toSafeUrl('http://127.0.0.1:54321/storage/v1/x')?.href).toBe('http://127.0.0.1:54321/storage/v1/x')
  })

  it('refuse http://localhost en production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(toSafeUrl('http://localhost:3000/x')).toBeNull()
    expect(toSafeUrl('http://127.0.0.1:3000/x')).toBeNull()
  })
})

describe('toSafeUrl : sans window', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne null hors navigateur', () => {
    vi.stubGlobal('window', undefined)
    expect(toSafeUrl(URL_SIGNEE, { allowedOrigins: [ORIGINE_SUPABASE] })).toBeNull()
  })
})

describe('safeOpen', () => {
  let open: ReturnType<typeof vi.spyOn>
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    open = vi.spyOn(window, 'open').mockImplementation(() => null)
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ouvre une URL acceptée dans un nouvel onglet avec noopener,noreferrer et renvoie vrai', () => {
    expect(safeOpen(URL_SIGNEE, { allowedOrigins: [ORIGINE_SUPABASE] })).toBe(true)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(URL_SIGNEE, '_blank', 'noopener,noreferrer')
    expect(warn).not.toHaveBeenCalled()
  })

  it('n’ouvre rien, avertit et renvoie faux pour une URL refusée', () => {
    expect(safeOpen('javascript:alert(1)', { allowedOrigins: [ORIGINE_SUPABASE] })).toBe(false)
    expect(safeOpen('https://evil.example/doc.pdf', { allowedOrigins: [ORIGINE_SUPABASE] })).toBe(false)
    expect(safeOpen(undefined, { allowedOrigins: [ORIGINE_SUPABASE] })).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(3)
    expect(warn).toHaveBeenCalledWith('[safe-url] URL refusée')
  })
})

describe('safeNavigate', () => {
  const descripteurOriginal = Object.getOwnPropertyDescriptor(window, 'location')
  let assign: ReturnType<typeof vi.fn>
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom rend Location.assign non redéfinissable : on remplace window.location par un double.
    assign = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { assign, origin: ORIGINE_LOCALE, href: `${ORIGINE_LOCALE}/` },
    })
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    if (descripteurOriginal) Object.defineProperty(window, 'location', descripteurOriginal)
    vi.restoreAllMocks()
  })

  it('navigue vers un chemin interne avec allowRelative et renvoie vrai', () => {
    expect(safeNavigate('/admin/dashboard', { allowRelative: true })).toBe(true)
    expect(assign).toHaveBeenCalledWith(`${ORIGINE_LOCALE}/admin/dashboard`)
    expect(warn).not.toHaveBeenCalled()
  })

  it('navigue vers une origine autorisée', () => {
    const oauth = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=x'
    expect(safeNavigate(oauth, { allowedOrigins: ['https://accounts.google.com', 'https://login.microsoftonline.com'] })).toBe(true)
    expect(assign).toHaveBeenCalledWith(oauth)
  })

  it('ne navigue pas, avertit et renvoie faux pour une URL refusée', () => {
    expect(safeNavigate('javascript:alert(1)', { allowRelative: true })).toBe(false)
    expect(safeNavigate('//evil.example', { allowRelative: true })).toBe(false)
    expect(safeNavigate('https://evil.example', { allowRelative: true })).toBe(false)
    expect(safeNavigate('https://evil.example', { allowedOrigins: ['https://accounts.google.com'] })).toBe(false)
    expect(assign).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(4)
    expect(warn).toHaveBeenCalledWith('[safe-url] redirection refusée')
  })
})

describe('estUrlStockageSupabase (utilisable côté serveur)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('accepte une URL https de l’origine du projet, même sans window', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINE_SUPABASE)
    vi.stubGlobal('window', undefined)
    expect(estUrlStockageSupabase(URL_SIGNEE)).toBe(true)
    expect(estUrlStockageSupabase(`  ${ORIGINE_SUPABASE}/storage/v1/object/public/portfolio/photo.png  `)).toBe(true)
  })

  it.each([
    'https://stockage.vitfix.io/photo.png',
    'https://abcdefghij.supabase.co.evil.example/x',
    'http://abcdefghij.supabase.co/x',
    'javascript:alert(1)',
    'data:text/html,x',
    '/storage/v1/object/public/portfolio/photo.png',
    '',
  ])('refuse %s', (brut) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINE_SUPABASE)
    expect(estUrlStockageSupabase(brut)).toBe(false)
  })

  it('refuse les valeurs qui ne sont pas des chaînes et tout si la variable manque', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINE_SUPABASE)
    expect(estUrlStockageSupabase(null)).toBe(false)
    expect(estUrlStockageSupabase(42)).toBe(false)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(estUrlStockageSupabase(URL_SIGNEE)).toBe(false)
  })
})

describe('originesSupabase', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('renvoie l’origine du projet Supabase', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ORIGINE_SUPABASE)
    expect(originesSupabase()).toEqual([ORIGINE_SUPABASE])
    expect(warn).not.toHaveBeenCalled()
  })

  it('ne garde que l’origine si la variable porte un chemin', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `${ORIGINE_SUPABASE}/rest/v1/`)
    expect(originesSupabase()).toEqual([ORIGINE_SUPABASE])
  })

  it('renvoie une liste vide (tout refusé) si la variable manque ou est invalide', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(originesSupabase()).toEqual([])
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'pas-une-url')
    expect(originesSupabase()).toEqual([])
    expect(warn).toHaveBeenCalledTimes(2)
    expect(toSafeUrl(URL_SIGNEE, { allowedOrigins: originesSupabase() })).toBeNull()
  })
})
