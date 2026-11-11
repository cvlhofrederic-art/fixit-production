// tests/lib/aj-signalement-acces-espace.test.ts
//
// Espace indépendant « AJ Signalement » (demande de Hugo du 10/11/2026) : adresse, contrôle d'accès, menu, page de
// connexion professionnelle de l'espace (demande de Hugo du 11/11/2026) et arrivée après connexion, dans un module pur
// (lib/aj-signalement/acces-espace.ts) partagé par le middleware, la page de connexion de l'espace, l'espace lui-même et
// les liens du portail copropriétaire et de l'AJ. Aujourd'hui seul le super admin entre ; la décision ne lit que
// app_metadata, jamais user_metadata. Depuis le 11/11/2026 (alignement des routes sur isSuperAdmin, #650), la « vue en
// tant que » (_original_role) n'entre plus : même règle que les routes de l'API. La page de connexion générale de
// VitFix n'est plus concernée : aucun paramètre « retour ».

import { describe, expect, it } from 'vitest'
import * as accesEspace from '@/lib/aj-signalement/acces-espace'
import {
  CHEMIN_ESPACE_QR, ENTREES_MENU_QR, cheminConnexionEspaceQr, cheminEspaceQr, decisionAccesEspaceQr, destinationConnexionEspaceQr,
  entreesMenuQr, estConnexionEspaceQr, lienEspaceQr, redirectionEspaceQr, viseEspaceQr, vueApresRetourQr, vueDepuisAncreQr,
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

  it('« vue en tant que » ouverte par un super admin : refusé (les routes la refusent aussi, isSuperAdmin)', () => {
    expect(decisionAccesEspaceQr({ app_metadata: { role: 'coproprio', _original_role: 'super_admin' } })).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: { role: 'artisan', _original_role: 'super_admin', _admin_override: true } })).toEqual({ acces: 'refuse' })
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
  it('super admin : adresse de l’espace ; « vue en tant que » : aucun lien (l’espace la refuse)', () => {
    expect(lienEspaceQr(superAdmin)).toBe('/fr/aj-signalement/')
    expect(lienEspaceQr({ role: 'syndic', _original_role: 'super_admin' })).toBeNull()
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

describe('page de connexion professionnelle de l’espace', () => {
  it('cheminConnexionEspaceQr : /fr/aj-signalement/connexion/, /pt/… en portugais ; aucune page sous en, nl, es (→ /fr/)', () => {
    expect(cheminConnexionEspaceQr('fr')).toBe('/fr/aj-signalement/connexion/')
    expect(cheminConnexionEspaceQr('pt')).toBe('/pt/aj-signalement/connexion/')
    expect(cheminConnexionEspaceQr('es')).toBe('/fr/aj-signalement/connexion/')
  })

  it('estConnexionEspaceQr : segment exact, avec ou sans barre finale', () => {
    expect(estConnexionEspaceQr('/aj-signalement/connexion')).toBe(true)
    expect(estConnexionEspaceQr('/aj-signalement/connexion/')).toBe(true)
    for (const chemin of [
      '/aj-signalement', '/aj-signalement/', '/aj-signalement/connexionx/', '/aj-signalement/connexion/autre/',
      '/signalement/connexion/', '/api/aj-signalement/connexion', '/fr/aj-signalement/connexion/', '/auth/login/',
    ]) expect(estConnexionEspaceQr(chemin)).toBe(false)
    // La page de connexion fait partie de l'espace : getUser (cookies rafraîchis) et X-Robots-Tag sur les 3xx.
    expect(viseEspaceQr('/aj-signalement/connexion/')).toBe(true)
  })

  it('plus aucun paramètre « retour » ni page de refus (403) : la page de connexion générale n’est plus concernée', () => {
    const exports = Object.keys(accesEspace)
    expect(exports).not.toContain('PARAMETRE_RETOUR_QR')
    expect(exports).not.toContain('retourApresConnexionQr')
    expect(exports).not.toContain('pageRefusEspaceQr')
    expect(cheminConnexionEspaceQr('fr')).not.toContain('?')
  })
})

describe('redirectionEspaceQr (middleware) : chemin sans langue vers lequel rediriger, ou null', () => {
  const coproprio = { app_metadata: { role: 'coproprio' } }
  const syndic = { app_metadata: { role: 'syndic' } }
  const trafique = { app_metadata: { role: 'coproprio' }, user_metadata: { role: 'super_admin', _original_role: 'super_admin' } }
  const admin = { app_metadata: superAdmin }
  const vueEnTantQue = { app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }

  it.each(['fr', 'pt'])('espace (/%s/) : sans session ou sans accès → connexion de l’espace ; accès → la page', (langue) => {
    for (const chemin of ['/aj-signalement', '/aj-signalement/', '/aj-signalement/gestionnaires/']) {
      expect(redirectionEspaceQr(chemin, langue, null)).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, undefined)).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, coproprio)).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, syndic)).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, trafique)).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, { app_metadata: {} })).toBe('/aj-signalement/connexion/')
      expect(redirectionEspaceQr(chemin, langue, admin)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, vueEnTantQue)).toBeNull()
    }
  })

  it.each(['fr', 'pt'])('page de connexion (/%s/) : servie sans session et à un compte sans accès (aucune boucle) ; accès → l’espace', (langue) => {
    for (const chemin of ['/aj-signalement/connexion', '/aj-signalement/connexion/']) {
      expect(redirectionEspaceQr(chemin, langue, null)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, coproprio)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, syndic)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, trafique)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, admin)).toBe('/aj-signalement/')
      expect(redirectionEspaceQr(chemin, langue, vueEnTantQue)).toBe('/aj-signalement/')
    }
  })

  it.each(['en', 'nl', 'es'])('/%s/ (aucune page dans cette langue) : toujours un renvoi (le middleware le place sous /pt/)', (langue) => {
    expect(redirectionEspaceQr('/aj-signalement/', langue, null)).toBe('/aj-signalement/connexion/')
    expect(redirectionEspaceQr('/aj-signalement/', langue, syndic)).toBe('/aj-signalement/connexion/')
    expect(redirectionEspaceQr('/aj-signalement/', langue, admin)).toBe('/aj-signalement/')
    expect(redirectionEspaceQr('/aj-signalement/connexion/', langue, null)).toBe('/aj-signalement/connexion/')
    expect(redirectionEspaceQr('/aj-signalement/connexion/', langue, coproprio)).toBe('/aj-signalement/connexion/')
    expect(redirectionEspaceQr('/aj-signalement/connexion/', langue, admin)).toBe('/aj-signalement/')
  })

  it('hors de l’espace : null (page publique du QR code, segment voisin, API, connexion générale)', () => {
    for (const chemin of [`/signalement/${JETON}/`, '/aj-signalements/', '/api/aj-signalement/tableau', '/auth/login/', '/', '']) {
      expect(redirectionEspaceQr(chemin, 'fr', null)).toBeNull()
      expect(redirectionEspaceQr(chemin, 'fr', syndic)).toBeNull()
      expect(redirectionEspaceQr(chemin, 'en', admin)).toBeNull()
    }
  })
})

describe('destinationConnexionEspaceQr : arrivée après la connexion professionnelle', () => {
  const espace = '/fr/aj-signalement/'

  it('super admin : l’espace, plus l’ancre si elle désigne exactement une vue de son rôle', () => {
    expect(destinationConnexionEspaceQr(espace, '#signalements', superAdmin)).toBe('/fr/aj-signalement/#signalements')
    expect(destinationConnexionEspaceQr('/pt/aj-signalement/', '#coproprietes', superAdmin)).toBe('/pt/aj-signalement/#coproprietes')
    expect(destinationConnexionEspaceQr(espace, 'signalements', superAdmin)).toBe('/fr/aj-signalement/#signalements')
  })

  it('ancre vide, inconnue ou détournée : l’espace seul', () => {
    for (const ancre of ['', '#', '#admin', '#signalements/../../admin', '#gestionnaires', null, undefined]) {
      expect(destinationConnexionEspaceQr(espace, ancre, superAdmin)).toBe('/fr/aj-signalement/')
    }
  })

  it('« vue en tant que » ouverte par un super admin : l’espace', () => {
    expect(destinationConnexionEspaceQr(espace, '', { role: 'coproprio', _original_role: 'super_admin' })).toBe('/fr/aj-signalement/')
  })

  it('compte sans accès, métadonnées absentes ou illisibles : null (la page affiche le message neutre)', () => {
    for (const metadonnees of [{ role: 'coproprio' }, { role: 'syndic' }, {}, null, undefined]) {
      expect(destinationConnexionEspaceQr(espace, '#signalements', metadonnees)).toBeNull()
    }
  })

  it('l’adresse vient du contexte de la page, jamais de l’URL : espace d’un cabinet (PR 2) pris tel quel', () => {
    expect(destinationConnexionEspaceQr('/cabinet-exemple/', '#signalements', superAdmin)).toBe('/cabinet-exemple/#signalements')
    expect(destinationConnexionEspaceQr('/cabinet-exemple/', '', superAdmin)).toBe('/cabinet-exemple/')
  })
})
