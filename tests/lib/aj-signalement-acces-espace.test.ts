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
  CHEMIN_ESPACE_QR, ENTREES_MENU_QR, VUES_TABLEAU_QR, ancreEspaceQr, cheminConnexionEspaceQr, cheminEspaceQr,
  decisionAccesEspaceQr, destinationConnexionEspaceQr, entreesBarreDuBasQr, entreesMenuQr, estConnexionEspaceQr, lienEspaceQr,
  redirectionEspaceQr, texteAncreQr, viseEspaceQr, vueApresRetourQr, vueDepuisAncreQr,
} from '@/lib/aj-signalement/acces-espace'

const JETON = '0123456789abcdef0123456789abcdef'
const UUID = '9b1d2c3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'
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
  it('super admin : six entrées, dans cet ordre (Gestionnaires, Cabinets et Journal depuis le 11/11/2026)', () => {
    expect(entreesMenuQr('super_admin').map((e) => [e.vue, e.libelle])).toEqual([
      ['tableau-de-bord', 'Tableau de bord'],
      ['coproprietes', 'Copropriétés'],
      ['signalements', 'Signalements'],
      ['gestionnaires', 'Gestionnaires'],
      ['cabinets', 'Cabinets'],
      ['journal', 'Journal'],
    ])
  })

  it('barre du bas du téléphone : cinq entrées, sans le Journal (joignable depuis la vue Cabinets)', () => {
    expect(entreesBarreDuBasQr('super_admin').map((e) => e.vue)).toEqual(['tableau-de-bord', 'coproprietes', 'signalements', 'gestionnaires', 'cabinets'])
  })

  it('chaque entrée dit qui la voit et a un sous-titre ; les vues du tableau sont les trois premières', () => {
    expect(ENTREES_MENU_QR.every((e) => e.roles.length > 0 && e.sousTitre.length > 0)).toBe(true)
    expect(VUES_TABLEAU_QR).toEqual(['tableau-de-bord', 'coproprietes', 'signalements'])
  })

  it('vueDepuisAncreQr : ancre connue → sa vue ; vide, inconnue ou avec une suite → tableau de bord', () => {
    expect(vueDepuisAncreQr('#signalements', 'super_admin')).toBe('signalements')
    expect(vueDepuisAncreQr('coproprietes', 'super_admin')).toBe('coproprietes')
    expect(vueDepuisAncreQr('#tableau-de-bord', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#gestionnaires', 'super_admin')).toBe('gestionnaires')
    expect(vueDepuisAncreQr('#cabinets', 'super_admin')).toBe('cabinets')
    expect(vueDepuisAncreQr('#journal', 'super_admin')).toBe('journal')
    expect(vueDepuisAncreQr(`#gestionnaire/${UUID}`, 'super_admin')).toBe('gestionnaires')
    expect(vueDepuisAncreQr('', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#signalementsQr', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#signalements/autre', 'super_admin')).toBe('tableau-de-bord')
    expect(vueDepuisAncreQr('#gestionnaire/pas-un-uuid', 'super_admin')).toBe('tableau-de-bord')
  })

  it('vueApresRetourQr (retour du navigateur) : vide → tableau de bord ; vue connue → sa vue ; ancre qui ne désigne aucune vue → null (la vue en cours reste)', () => {
    expect(vueApresRetourQr('', 'super_admin')).toBe('tableau-de-bord')
    expect(vueApresRetourQr('#', 'super_admin')).toBe('tableau-de-bord')
    expect(vueApresRetourQr('#signalements', 'super_admin')).toBe('signalements')
    expect(vueApresRetourQr('#coproprietes', 'super_admin')).toBe('coproprietes')
    expect(vueApresRetourQr('#gestionnaires', 'super_admin')).toBe('gestionnaires')
    expect(vueApresRetourQr(`#gestionnaire/${UUID}`, 'super_admin')).toBe('gestionnaires')
    expect(vueApresRetourQr('#main-content', 'super_admin')).toBeNull()
    expect(vueApresRetourQr('#signalementsQr', 'super_admin')).toBeNull()
    expect(vueApresRetourQr('#gestionnaire/', 'super_admin')).toBeNull()
  })

  it('ancreEspaceQr : vue, ou page profil d’un gestionnaire (#gestionnaire/<uuid> en minuscules) ; sinon null', () => {
    expect(ancreEspaceQr('#cabinets', 'super_admin')).toEqual({ vue: 'cabinets', gestionnaireId: null })
    expect(ancreEspaceQr(`gestionnaire/${UUID}`, 'super_admin')).toEqual({ vue: 'gestionnaires', gestionnaireId: UUID })
    expect(ancreEspaceQr(`#gestionnaire/${UUID.toUpperCase()}`, 'super_admin')).toBeNull()
    expect(ancreEspaceQr(`#gestionnaire/${UUID}/autre`, 'super_admin')).toBeNull()
    expect(ancreEspaceQr('#gestionnaire/../admin', 'super_admin')).toBeNull()
    expect(ancreEspaceQr('', 'super_admin')).toBeNull()
    expect(ancreEspaceQr(null, 'super_admin')).toBeNull()
    expect(ancreEspaceQr('#main-content', 'super_admin')).toBeNull()
  })

  it('texteAncreQr : l’ancre à poser dans l’adresse (sans « # »)', () => {
    expect(texteAncreQr({ vue: 'journal', gestionnaireId: null })).toBe('journal')
    expect(texteAncreQr({ vue: 'gestionnaires', gestionnaireId: UUID })).toBe(`gestionnaire/${UUID}`)
    expect(ancreEspaceQr(texteAncreQr({ vue: 'gestionnaires', gestionnaireId: UUID }), 'super_admin')).toEqual({ vue: 'gestionnaires', gestionnaireId: UUID })
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
      // La « vue en tant que » est refusée depuis le 11/11/2026, comme par les routes (isSuperAdmin, #650).
      expect(redirectionEspaceQr(chemin, langue, vueEnTantQue)).toBe('/aj-signalement/connexion/')
    }
  })

  it.each(['fr', 'pt'])('page de connexion (/%s/) : servie sans session et à un compte sans accès (aucune boucle) ; accès → l’espace', (langue) => {
    for (const chemin of ['/aj-signalement/connexion', '/aj-signalement/connexion/']) {
      expect(redirectionEspaceQr(chemin, langue, null)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, coproprio)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, syndic)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, trafique)).toBeNull()
      expect(redirectionEspaceQr(chemin, langue, admin)).toBe('/aj-signalement/')
      // La « vue en tant que » n'entre pas : la page de connexion lui est servie, avec son message neutre.
      expect(redirectionEspaceQr(chemin, langue, vueEnTantQue)).toBeNull()
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
    // « #gestionnaires » n'est plus ici : c'est une vue du super admin depuis le 11/11/2026.
    for (const ancre of ['', '#', '#admin', '#signalements/../../admin', null, undefined]) {
      expect(destinationConnexionEspaceQr(espace, ancre, superAdmin)).toBe('/fr/aj-signalement/')
    }
  })

  it('compte sans accès, « vue en tant que », métadonnées absentes ou illisibles : null (la page affiche le message neutre)', () => {
    for (const metadonnees of [
      { role: 'coproprio' }, { role: 'syndic' }, { role: 'coproprio', _original_role: 'super_admin' }, {}, null, undefined,
    ]) {
      expect(destinationConnexionEspaceQr(espace, '#signalements', metadonnees)).toBeNull()
    }
  })

  it('l’adresse vient du contexte de la page, jamais de l’URL : prise telle quelle (page sans cabinet)', () => {
    expect(destinationConnexionEspaceQr('/autre-espace/', '#signalements', superAdmin)).toBe('/autre-espace/#signalements')
    expect(destinationConnexionEspaceQr('/autre-espace/', '', superAdmin)).toBe('/autre-espace/')
  })
})

// ── PR 2, lot 4 : espace de chaque cabinet (vitfix.io/<identifiant>/connexion/ et /suivi/) ───────────────────────────
//
// Décisions de Hugo du 11/11/2026 (SPEC § 6) et plan § 1.5 : chaque cabinet a SA page de connexion professionnelle et SON
// espace de suivi ; le gestionnaire y est reconnu par son rôle serveur (gestionnaire_signalement) ET par le repère de
// routage app_metadata.aj_signalement_cabinet (identifiant de SON cabinet), posé par le serveur à l'acceptation. Le
// repère ne donne aucun droit (les routes relisent la fiche) : il aiguille seulement. Seul app_metadata compte.

describe('espace d’un cabinet : rôle gestionnaire et repère de routage', () => {
  const g = (repere: unknown = 'cabinet-exemple', extra: Record<string, unknown> = {}) =>
    ({ role: 'gestionnaire_signalement', aj_signalement_cabinet: repere, ...extra })

  it('rôle et clé du repère : mêmes valeurs qu’en base et à l’acceptation (types.ts les reprend d’ici)', async () => {
    const types = await import('@/lib/aj-signalement/types')
    expect(accesEspace.ROLE_GESTIONNAIRE_QR).toBe('gestionnaire_signalement')
    expect(accesEspace.CLE_REPERE_CABINET_QR).toBe('aj_signalement_cabinet')
    expect(types.ROLE_GESTIONNAIRE_QR).toBe(accesEspace.ROLE_GESTIONNAIRE_QR)
    expect(types.CLE_REPERE_CABINET_QR).toBe(accesEspace.CLE_REPERE_CABINET_QR)
  })

  it('repereCabinetQr : l’identifiant du cabinet pour un compte gestionnaire, s’il est un identifiant valable (sinon null)', () => {
    expect(accesEspace.repereCabinetQr(g())).toBe('cabinet-exemple')
    for (const meta of [
      g(''), g('Cabinet-Exemple'), g('ab'), g('aj-signalement'), g('api'), g('cabinet-exemple/suivi'), g('../admin'), g(42), g(['cabinet-exemple']),
      g(null), { role: 'gestionnaire_signalement' }, { role: 'syndic', aj_signalement_cabinet: 'cabinet-exemple' },
      { role: 'super_admin', aj_signalement_cabinet: 'cabinet-exemple' }, {}, null, undefined,
    ]) {
      expect(accesEspace.repereCabinetQr(meta as Record<string, unknown> | null | undefined), JSON.stringify(meta)).toBeNull()
    }
  })

  it('decisionAccesEspaceQr dans l’espace d’un cabinet : seul un gestionnaire de CE cabinet entre', () => {
    expect(decisionAccesEspaceQr({ app_metadata: g() }, 'cabinet-exemple')).toEqual({ acces: 'autorise', role: 'gestionnaire' })
    expect(decisionAccesEspaceQr({ app_metadata: g('autre-cabinet') }, 'cabinet-exemple')).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: { role: 'gestionnaire_signalement' } }, 'cabinet-exemple')).toEqual({ acces: 'refuse' })
    // Le super admin a son espace global : il n'entre pas dans celui d'un cabinet (la connexion du cabinet l'y renvoie).
    expect(decisionAccesEspaceQr({ app_metadata: superAdmin }, 'cabinet-exemple')).toEqual({ acces: 'refuse' })
    for (const role of ['syndic', 'coproprio', 'client', 'artisan', 'pro_societe', undefined]) {
      expect(decisionAccesEspaceQr({ app_metadata: { role, aj_signalement_cabinet: 'cabinet-exemple' } }, 'cabinet-exemple')).toEqual({ acces: 'refuse' })
    }
    // user_metadata ne donne rien, repère compris.
    const trafique = { app_metadata: { role: 'client' }, user_metadata: g() }
    expect(decisionAccesEspaceQr(trafique, 'cabinet-exemple')).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr(null, 'cabinet-exemple')).toEqual({ acces: 'connexion' })
  })

  it('l’espace global reste au super admin : un gestionnaire, même avec un repère, y est refusé', () => {
    expect(decisionAccesEspaceQr({ app_metadata: g() })).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: g() }, null)).toEqual({ acces: 'refuse' })
    expect(decisionAccesEspaceQr({ app_metadata: superAdmin }, null)).toEqual({ acces: 'autorise', role: 'super_admin' })
    expect(lienEspaceQr(g())).toBeNull()
  })

  it('menu du gestionnaire : Tableau de bord, Copropriétés, Signalements (mêmes libellés que l’espace global), barre du bas comprise', () => {
    expect(entreesMenuQr('gestionnaire').map((e) => [e.vue, e.libelle])).toEqual([
      ['tableau-de-bord', 'Tableau de bord'],
      ['coproprietes', 'Copropriétés'],
      ['signalements', 'Signalements'],
    ])
    expect(entreesBarreDuBasQr('gestionnaire').map((e) => e.vue)).toEqual(['tableau-de-bord', 'coproprietes', 'signalements'])
    // Le super admin garde ses six entrées.
    expect(entreesMenuQr('super_admin')).toHaveLength(6)
  })

  it('ancres du gestionnaire : ses trois vues seulement (jamais une page profil, les cabinets ni le journal)', () => {
    expect(ancreEspaceQr('#signalements', 'gestionnaire')).toEqual({ vue: 'signalements', gestionnaireId: null })
    expect(ancreEspaceQr('coproprietes', 'gestionnaire')).toEqual({ vue: 'coproprietes', gestionnaireId: null })
    for (const ancre of ['#gestionnaires', `#gestionnaire/${UUID}`, '#cabinets', '#journal', '#main-content']) {
      expect(ancreEspaceQr(ancre, 'gestionnaire'), ancre).toBeNull()
    }
    expect(vueDepuisAncreQr('#journal', 'gestionnaire')).toBe('tableau-de-bord')
    expect(vueApresRetourQr('#cabinets', 'gestionnaire')).toBeNull()
  })
})

describe('redirectionEspaceCabinetQr (middleware) : matrice du plan § 1.5', () => {
  const id = 'cabinet-exemple'
  type Compte = { app_metadata: Record<string, unknown> } | null
  const PROFILS: Array<[string, Compte]> = [
    ['sans session', null],
    ['compte sans accès (client)', { app_metadata: { role: 'client' } }],
    ['compte sans accès (syndic)', { app_metadata: { role: 'syndic' } }],
    ['« vue en tant que » d’un super admin', { app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }],
    ['gestionnaire sans repère', { app_metadata: { role: 'gestionnaire_signalement' } }],
    ['gestionnaire au repère mal formé', { app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'Cabinet-Exemple' } }],
    ['gestionnaire d’un AUTRE cabinet', { app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet' } }],
  ]
  const DU_CABINET: Compte = { app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: id } }
  const SUPER_ADMIN: Compte = { app_metadata: superAdmin }

  it('/<id>/ : toujours vers /<id>/suivi/ (aucune session lue)', () => {
    for (const u of [...PROFILS.map(([, c]) => c), DU_CABINET, SUPER_ADMIN]) {
      expect(accesEspace.redirectionEspaceCabinetQr({ page: 'accueil', identifiant: id }, u)).toBe('/cabinet-exemple/suivi/')
    }
  })

  it.each(PROFILS)('%s : connexion servie (message neutre au besoin), suivi → connexion du cabinet', (_cas, u) => {
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'connexion', identifiant: id }, u)).toBeNull()
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'suivi', identifiant: id }, u)).toBe('/cabinet-exemple/connexion/')
  })

  it('gestionnaire de CE cabinet : connexion → suivi ; suivi servi', () => {
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'connexion', identifiant: id }, DU_CABINET)).toBe('/cabinet-exemple/suivi/')
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'suivi', identifiant: id }, DU_CABINET)).toBeNull()
  })

  it('super admin : renvoyé vers son espace global (connexion et suivi)', () => {
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'connexion', identifiant: id }, SUPER_ADMIN)).toBe('/fr/aj-signalement/')
    expect(accesEspace.redirectionEspaceCabinetQr({ page: 'suivi', identifiant: id }, SUPER_ADMIN)).toBe('/fr/aj-signalement/')
  })
})

describe('aiguillageGestionnaireQr (middleware) : un gestionnaire est envoyé vers l’espace de SON cabinet', () => {
  const g = { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }
  const AIGUILLES = [
    '', '/', '/auth/login', '/auth/login/', '/client/dashboard', '/client/dashboard/', '/pro/dashboard/', '/pro/mobile/',
    '/artisan/dashboard', '/artisan/dashboard/devis/', '/syndic/dashboard/', '/syndic/login/', '/coproprietaire/dashboard/',
    '/coproprietaire/portail/', '/administrateur-judiciaire', '/administrateur-judiciaire/', '/aj-signalement/',
    '/aj-signalement', '/aj-signalement/connexion/',
  ]

  it.each(AIGUILLES)('repère valable, « %s » → /cabinet-exemple/suivi/ (sans langue)', (chemin) => {
    expect(accesEspace.aiguillageGestionnaireQr(chemin, g)).toBe('/cabinet-exemple/suivi/')
  })

  it('ailleurs : rien (pages publiques, fiches artisans, confidentialité, API, admin)', () => {
    for (const chemin of ['/blog/', '/artisan/abc123/', '/artisan/dashboard-plomberie/', '/confidentialite/', '/a-propos/', '/api/aj-signalement/moi', '/admin/dashboard/']) {
      expect(accesEspace.aiguillageGestionnaireQr(chemin, g), chemin).toBeNull()
    }
  })

  it('repère absent ou mal formé : accueil et connexion générale → connexion de l’espace global (message neutre, aucune boucle) ; le reste comme avant', () => {
    const sansRepere = [
      { role: 'gestionnaire_signalement' },
      { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'API' },
      { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'aj-signalement' },
    ]
    for (const meta of sansRepere) {
      for (const chemin of ['', '/', '/auth/login', '/auth/login/']) {
        expect(accesEspace.aiguillageGestionnaireQr(chemin, meta), chemin).toBe('/fr/aj-signalement/connexion/')
      }
      // Pas de boucle : la connexion de l'espace global sert un compte non admis (message neutre).
      for (const chemin of ['/aj-signalement/connexion/', '/aj-signalement/', '/client/dashboard/', '/syndic/dashboard/']) {
        expect(accesEspace.aiguillageGestionnaireQr(chemin, meta), chemin).toBeNull()
      }
    }
  })

  it('tout autre compte : rien (repère sans le rôle, super admin, syndic, sans métadonnées)', () => {
    for (const meta of [{ role: 'client', aj_signalement_cabinet: 'cabinet-exemple' }, { role: 'super_admin' }, { role: 'syndic' }, {}, null, undefined]) {
      expect(accesEspace.aiguillageGestionnaireQr('/', meta)).toBeNull()
    }
  })
})

describe('destinationConnexionEspaceQr avec le cabinet de la page (PR 2)', () => {
  const espace = '/cabinet-exemple/suivi/'
  const g = (repere: string) => ({ role: 'gestionnaire_signalement', aj_signalement_cabinet: repere })

  it('page d’un cabinet : son gestionnaire → l’espace du cabinet (ancre d’une de ses vues comprise)', () => {
    expect(destinationConnexionEspaceQr(espace, '', g('cabinet-exemple'), 'cabinet-exemple')).toBe('/cabinet-exemple/suivi/')
    expect(destinationConnexionEspaceQr(espace, '#signalements', g('cabinet-exemple'), 'cabinet-exemple')).toBe('/cabinet-exemple/suivi/#signalements')
    expect(destinationConnexionEspaceQr(espace, '#journal', g('cabinet-exemple'), 'cabinet-exemple')).toBe('/cabinet-exemple/suivi/')
    expect(destinationConnexionEspaceQr(espace, `#gestionnaire/${UUID}`, g('cabinet-exemple'), 'cabinet-exemple')).toBe('/cabinet-exemple/suivi/')
  })

  it('page d’un cabinet : gestionnaire d’un autre cabinet, sans repère, autre compte → null (message neutre, rien ne dit que l’autre cabinet existe)', () => {
    for (const meta of [g('autre-cabinet'), { role: 'gestionnaire_signalement' }, { role: 'client' }, { role: 'coproprio', _original_role: 'super_admin' }, {}, null]) {
      expect(destinationConnexionEspaceQr(espace, '#signalements', meta, 'cabinet-exemple'), JSON.stringify(meta)).toBeNull()
    }
  })

  it('page d’un cabinet : super admin → son espace global (jamais l’espace du cabinet)', () => {
    expect(destinationConnexionEspaceQr(espace, '', superAdmin, 'cabinet-exemple')).toBe('/fr/aj-signalement/')
    expect(destinationConnexionEspaceQr(espace, '#signalements', superAdmin, 'cabinet-exemple')).toBe('/fr/aj-signalement/#signalements')
  })

  it('page globale : un gestionnaire avec repère est envoyé vers l’espace de SON cabinet ; sans repère, null', () => {
    expect(destinationConnexionEspaceQr('/fr/aj-signalement/', '#signalements', g('cabinet-exemple'))).toBe('/cabinet-exemple/suivi/#signalements')
    expect(destinationConnexionEspaceQr('/fr/aj-signalement/', '#cabinets', g('cabinet-exemple'))).toBe('/cabinet-exemple/suivi/')
    expect(destinationConnexionEspaceQr('/fr/aj-signalement/', '', { role: 'gestionnaire_signalement' })).toBeNull()
    expect(destinationConnexionEspaceQr('/fr/aj-signalement/', '', g('Mauvais'))).toBeNull()
  })
})
