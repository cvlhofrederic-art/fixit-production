// tests/lib/aj-signalement-acces-espace.test.ts
//
// Espace indépendant « AJ Signalement » (demande de Hugo du 10/11/2026) : adresse, contrôle d'accès, menu et retour
// après connexion, dans un module pur (lib/aj-signalement/acces-espace.ts) partagé par le middleware, la page de
// connexion, l'espace lui-même et les liens du portail copropriétaire et de l'AJ. Aujourd'hui seul le super admin entre
// (y compris en « vue en tant que ») ; la décision ne lit que app_metadata, jamais user_metadata.

import { describe, expect, it } from 'vitest'
import {
  CHEMIN_ESPACE_QR, ENTREES_MENU_QR, cheminConnexionEspaceQr, cheminEspaceQr, decisionAccesEspaceQr, entreesMenuQr,
  lienEspaceQr, pageRefusEspaceQr, retourApresConnexionQr, viseEspaceQr, vueApresRetourQr, vueDepuisAncreQr,
} from '@/lib/aj-signalement/acces-espace'

const JETON = '0123456789abcdef0123456789abcdef'
const superAdmin = { role: 'super_admin' }

describe('adresse de l’espace', () => {
  it('/fr/aj-signalement/ par défaut, /pt/aj-signalement/ en portugais, barre finale comprise', () => {
    expect(CHEMIN_ESPACE_QR).toBe('/fr/aj-signalement/')
    expect(cheminEspaceQr('fr')).toBe('/fr/aj-signalement/')
    expect(cheminEspaceQr('pt')).toBe('/pt/aj-signalement/')
    // Aucune page commune sous /en/, /nl/ ni /es/ : l'espace reste sous /fr/.
    expect(cheminEspaceQr('en')).toBe('/fr/aj-signalement/')
  })

  it('viseEspaceQr : segment exact, jamais la page publique du QR code ni un préfixe voisin', () => {
    expect(viseEspaceQr('/aj-signalement')).toBe(true)
    expect(viseEspaceQr('/aj-signalement/')).toBe(true)
    expect(viseEspaceQr('/aj-signalement/gestionnaires/')).toBe(true)
    expect(viseEspaceQr('/aj-signalements/')).toBe(false)
    expect(viseEspaceQr('/aj-signalement-test/')).toBe(false)
    expect(viseEspaceQr(`/signalement/${JETON}/`)).toBe(false)
    expect(viseEspaceQr('/api/aj-signalement/tableau')).toBe(false)
    expect(viseEspaceQr('')).toBe(false)
    // Chemin attendu sans préfixe de langue (le middleware le retire avant).
    expect(viseEspaceQr('/fr/aj-signalement/')).toBe(false)
  })
})

describe('decisionAccesEspaceQr', () => {
  it('sans compte : connexion', () => {
    expect(decisionAccesEspaceQr(null)).toEqual({ acces: 'connexion' })
    expect(decisionAccesEspaceQr(undefined)).toEqual({ acces: 'connexion' })
  })

  it('super admin : autorisé', () => {
    expect(decisionAccesEspaceQr({ app_metadata: superAdmin })).toEqual({ acces: 'autorise', role: 'super_admin' })
  })

  it('« vue en tant que » ouverte par un super admin : autorisé', () => {
    expect(decisionAccesEspaceQr({ app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }))
      .toEqual({ acces: 'autorise', role: 'super_admin' })
  })

  it.each(['syndic', 'syndic_admin', 'syndic_gestionnaire', 'coproprio', 'locataire', 'artisan', 'pro_societe', 'client', 'gestionnaire', undefined])(
    'compte %s : refusé',
    (role) => {
      expect(decisionAccesEspaceQr({ app_metadata: { role } })).toEqual({ acces: 'refuse' })
    },
  )

  it('user_metadata trafiqué : refusé (seul app_metadata compte)', () => {
    const trafique = { app_metadata: { role: 'coproprio' }, user_metadata: { role: 'super_admin', _original_role: 'super_admin' } }
    expect(decisionAccesEspaceQr(trafique)).toEqual({ acces: 'refuse' })
  })

  it('app_metadata absent, illisible ou rôle non textuel : refusé', () => {
    expect(decisionAccesEspaceQr({})).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: null })).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: 'super_admin' })).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: { role: ['super_admin'] } })).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: { _original_role: 'syndic' } })).toEqual({ acces: 'refuse' })
  })
})

describe('lienEspaceQr (portail copropriétaire et tableau de bord AJ)', () => {
  it('super admin ou « vue en tant que » : adresse de l’espace', () => {
    expect(lienEspaceQr(superAdmin)).toBe('/fr/aj-signalement/')
    expect(lienEspaceQr({ role: 'syndic', _original_role: 'super_admin' })).toBe('/fr/aj-signalement/')
  })

  it('tout autre compte, ou pas de session : aucun lien', () => {
    expect(lienEspaceQr({ role: 'syndic' })).toBeNull()
    expect(lienEspaceQr({ role: 'coproprio' })).toBeNull()
    expect(lienEspaceQr({})).toBeNull()
    expect(lienEspaceQr(null)).toBeNull()
    expect(lienEspaceQr(undefined)).toBeNull()
  })
})

describe('menu de l’espace', () => {
  it('super admin : Tableau de bord, Copropriétés, Signalements, dans cet ordre', () => {
    expect(entreesMenuQr('super_admin').map((e) => [e.vue, e.libelle])).toEqual([
      ['tableau-de-bord', 'Tableau de bord'],
      ['coproprietes', 'Copropriétés'],
      ['signalements', 'Signalements'],
    ])
  })

  it('aucune entrée « Gestionnaires » tant que le rôle n’existe pas ; chaque entrée dit qui la voit', () => {
    expect(ENTREES_MENU_QR.map((e) => e.vue)).not.toContain('gestionnaires')
    expect(ENTREES_MENU_QR.every((e) => e.roles.length > 0 && e.sousTitre.length > 0)).toBe(true)
  })

  it('vueDepuisAncreQr : ancre connue → sa vue ; vide, inconnue ou avec une suite → tableau de bord', () => {
    expect(vueDepuisAncreQr('#signalements', 'super_admin')).toBe('signalements')
    expect(vueDepuisAncreQr('coproprietes', 'super_admin')).toBe('coproprietes')
    expect(vueDepuisAncreQr('#tableau-de-bord', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#signalementsQr', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#gestionnaires', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#signalements/autre', 'super_admin')).toBe('tableau-de-bord')
  })

  it('vueApresRetourQr (retour du navigateur) : vide → tableau de bord ; vue connue → sa vue ; ancre qui ne désigne aucune vue → null (la vue en cours reste)', () => {
    expect(vueApresRetourQr('', 'super_admin')).toBe('tableau-de-bord')
    expect(vueApresRetourQr('#', 'super_admin')).toBe('tableau-de-bord')
    expect(vueApresRetourQr('#signalements', 'super_admin')).toBe('signalements')
    expect(vueApresRetourQr('#coproprietes', 'super_admin')).toBe('coproprietes')
    expect(vueApresRetourQr('#main-content', 'super_admin')).toBeNull()
    expect(vueApresRetourQr('#signalementsQr', 'super_admin')).toBeNull()
    expect(vueApresRetourQr('#gestionnaires', 'super_admin')).toBeNull()
  })
})

describe('retour après connexion (liste blanche)', () => {
  it('super admin : l’espace, avec l’ancre connue', () => {
    expect(retourApresConnexionQr('/fr/aj-signalement/', '#signalements', superAdmin)).toBe('/fr/aj-signalement/#signalements')
    expect(retourApresConnexionQr('/fr/aj-signalement/', '', superAdmin)).toBe('/fr/aj-signalement/')
  })

  it('sans barre finale ou en portugais : adresse normalisée', () => {
    expect(retourApresConnexionQr('/fr/aj-signalement', '', superAdmin)).toBe('/fr/aj-signalement/')
    expect(retourApresConnexionQr('/pt/aj-signalement/', '#coproprietes', superAdmin)).toBe('/pt/aj-signalement/#coproprietes')
    expect(retourApresConnexionQr('/pt/aj-signalement', undefined, superAdmin)).toBe('/pt/aj-signalement/')
  })

  it('ancre inconnue : ignorée', () => {
    expect(retourApresConnexionQr('/fr/aj-signalement/', '#admin', superAdmin)).toBe('/fr/aj-signalement/')
    expect(retourApresConnexionQr('/fr/aj-signalement/', '#signalements/../../admin', superAdmin)).toBe('/fr/aj-signalement/')
  })

  it.each([
    '//evil.example',
    '//evil.example/fr/aj-signalement/',
    'https://evil.example/fr/aj-signalement/',
    'https:evil.example',
    'javascript:alert(1)',
    '/\\evil.example',
    '/fr/aj-signalement/../admin/dashboard/',
    '/fr/aj-signalement/%2e%2e/admin/',
    '/fr/aj-signalement/?x=1',
    '/fr/aj-signalement/#signalements',
    '/en/aj-signalement/',
    '/fr/admin/dashboard/',
    '/fr/coproprietaire/dashboard/',
    ' /fr/aj-signalement/',
    '',
  ])('retour refusé : « %s »', (brut) => {
    expect(retourApresConnexionQr(brut, '#signalements', superAdmin)).toBeNull()
  })

  it('retour absent : rien', () => {
    expect(retourApresConnexionQr(null, '', superAdmin)).toBeNull()
    expect(retourApresConnexionQr(undefined, '', superAdmin)).toBeNull()
  })

  it('compte sans accès à l’espace : rien (destination habituelle de son rôle)', () => {
    expect(retourApresConnexionQr('/fr/aj-signalement/', '#signalements', { role: 'coproprio' })).toBeNull()
    expect(retourApresConnexionQr('/fr/aj-signalement/', '', { role: 'syndic' })).toBeNull()
    expect(retourApresConnexionQr('/fr/aj-signalement/', '', null)).toBeNull()
    expect(retourApresConnexionQr('/fr/aj-signalement/', '', undefined)).toBeNull()
  })
})

describe('page de connexion avec retour', () => {
  it('page de connexion de la langue, retour vers l’espace de la même langue', () => {
    expect(cheminConnexionEspaceQr('fr')).toBe('/fr/auth/login/?retour=%2Ffr%2Faj-signalement%2F')
    expect(cheminConnexionEspaceQr('pt')).toBe('/pt/auth/login/?retour=%2Fpt%2Faj-signalement%2F')
    expect(cheminConnexionEspaceQr('es')).toBe('/fr/auth/login/?retour=%2Ffr%2Faj-signalement%2F')
  })

  it('le retour posé est accepté par la liste blanche', () => {
    const retour = new URL(cheminConnexionEspaceQr('pt'), 'https://vitfix.io').searchParams.get('retour')
    expect(retourApresConnexionQr(retour, '', superAdmin)).toBe('/pt/aj-signalement/')
  })
})

describe('page de refus (403 du middleware)', () => {
  it('HTML minimal en français, titré, non indexable, sans aucune donnée ni mention du rôle requis', () => {
    const html = pageRefusEspaceQr()
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<title>Accès réservé</title>')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive">')
    expect(html).toContain('<h1>Accès réservé</h1>')
    expect(html).toContain('href="/"')
    expect(html.toLowerCase()).not.toContain('super')
    expect(html).not.toContain('<script')
  })
})
