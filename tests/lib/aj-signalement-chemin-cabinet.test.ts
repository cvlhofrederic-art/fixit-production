// tests/lib/aj-signalement-chemin-cabinet.test.ts
//
// Chemin public par cabinet client (choix de Hugo du 10/11/2026) : vitfix.io/<identifiant>/signalement/<jeton>/ pour la
// page ouverte par le QR code, vitfix.io/<identifiant>/confirmation-adresse/#<jeton> pour la confirmation d'adresse d'un
// gestionnaire, vitfix.io/<identifiant>/invitation/#<jeton> pour l'ouverture de son accès (PR 2, lot 3). Module pur
// lib/aj-signalement/chemin-cabinet.ts, lu par le middleware (edge) avant la détection de langue : son motif est FIGÉ
// (aucune liste lue au routage), la liste des identifiants réservés ne sert qu'à la saisie.
// Exemples fictifs seulement (« cabinet-exemple »).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  FORMAT_IDENTIFIANT_CABINET_QR, IDENTIFIANTS_RESERVES_QR, LONGUEUR_MAX_IDENTIFIANT_CABINET_QR,
  LONGUEUR_MIN_IDENTIFIANT_CABINET_QR, MOTIF_CHEMIN_CABINET_QR, PREFIXES_RESERVES_QR, SEGMENTS_CABINET_QR,
  SOURCE_IDENTIFIANT_CABINET_QR, cheminConnexionCabinetQr, cheminEspaceCabinetQr, cheminPublicCabinetQr, cheminSuiviCabinetQr,
  estEspaceCabinetQr, proposerIdentifiantCabinetQr, urlConfirmationAdresseQr, urlInvitationAccesQr, urlSignalementCabinetQr,
  validerIdentifiantCabinetQr,
} from '@/lib/aj-signalement/chemin-cabinet'

const JETON = '0123456789abcdef0123456789abcdef'
const JETON_LIEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`

describe('format d’un identifiant (saisie du super admin)', () => {
  it('« cabinet-exemple », chiffres et tirets simples admis, 3 à 40 caractères', () => {
    for (const id of ['cabinet-exemple', 'abc', 'cabinet2', 'c2-exemple-3', 'a'.repeat(40)]) {
      expect(validerIdentifiantCabinetQr(id)).toEqual({ ok: true })
    }
  })

  it('refuse le hors format : trop court ou trop long, tiret en tête, en fin ou doublé, majuscules, accents, chiffre en tête', () => {
    const refuses = ['ab', 'a', '', 'a'.repeat(41), '-ab', 'abc-', 'a--b', 'Cabinet', 'CABINET', 'cabinét', '1cabinet',
      'cabinet_exemple', 'cabinet exemple', 'cabinet.exemple', 'cabinet/exemple', ' cabinet', 'cabinet ']
    for (const id of refuses) expect(validerIdentifiantCabinetQr(id), id).toEqual({ ok: false, raison: 'format' })
  })

  it('même format et mêmes bornes que le CHECK de la migration (signalements_qr_cabinets_identifiant_format)', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261111_signalements_qr_gestionnaires.sql'), 'utf-8')
    const check = /CONSTRAINT signalements_qr_cabinets_identifiant_format\s+CHECK \(char_length\(identifiant\) BETWEEN (\d+) AND (\d+) AND identifiant ~ '([^']+)'\)/.exec(sql)
    expect(check).not.toBeNull()
    expect(Number(check?.[1])).toBe(LONGUEUR_MIN_IDENTIFIANT_CABINET_QR)
    expect(Number(check?.[2])).toBe(LONGUEUR_MAX_IDENTIFIANT_CABINET_QR)
    // Groupe non capturant côté TS, capturant côté SQL : même langage.
    expect(FORMAT_IDENTIFIANT_CABINET_QR.source.replaceAll('(?:', '(')).toBe(check?.[3])
  })

  it('refuse les identifiants réservés (routes du site, mots gardés) et ceux qui commencent par un préfixe réservé', () => {
    for (const id of ['api', 'admin', 'signalement', 'aj-signalement', 'syndic', 'blog', 'servicos', 'cabinet', 'suivi', 'invitation']) {
      expect(validerIdentifiantCabinetQr(id), id).toEqual({ ok: false, raison: 'reserve' })
    }
    for (const id of ['aj-signalement-exemple', 'administrateur-judiciaire2', 'confirmation-adresse', 'reserver-exemple']) {
      expect(validerIdentifiantCabinetQr(id), id).toEqual({ ok: false, raison: 'reserve' })
    }
  })

  it('les listes réservées sont en minuscules, sans doublon, et chaque entrée a le format d’un identifiant (sinon inutile)', () => {
    expect(new Set(IDENTIFIANTS_RESERVES_QR).size).toBe(IDENTIFIANTS_RESERVES_QR.length)
    expect(new Set(PREFIXES_RESERVES_QR).size).toBe(PREFIXES_RESERVES_QR.length)
    for (const mot of [...IDENTIFIANTS_RESERVES_QR, ...PREFIXES_RESERVES_QR]) {
      expect(FORMAT_IDENTIFIANT_CABINET_QR.test(mot) && mot.length >= LONGUEUR_MIN_IDENTIFIANT_CABINET_QR, mot).toBe(true)
    }
  })

  it('un identifiant voisin d’un mot réservé reste admis (« apis », « blogueur » ; préfixe exigé seulement pour la liste des préfixes)', () => {
    expect(validerIdentifiantCabinetQr('apis')).toEqual({ ok: true })
    expect(validerIdentifiantCabinetQr('blogueur')).toEqual({ ok: true })
    expect(validerIdentifiantCabinetQr('cabinet-signalement')).toEqual({ ok: true })
  })
})

describe('proposition d’identifiant depuis le nom du cabinet (modifiable par le super admin)', () => {
  it('accents retirés, minuscules, espaces et ponctuation → un tiret', () => {
    expect(proposerIdentifiantCabinetQr('Cabinet Exemple')).toBe('cabinet-exemple')
    expect(proposerIdentifiantCabinetQr('  Étude Exemple & Fils  ')).toBe('etude-exemple-fils')
    expect(proposerIdentifiantCabinetQr('Cœur d’Exemple')).toBe('coeur-d-exemple')
    expect(proposerIdentifiantCabinetQr('Gestion — Exemple (Sud)')).toBe('gestion-exemple-sud')
  })

  it('commence par une lettre, 40 caractères au plus, jamais de tiret final', () => {
    expect(proposerIdentifiantCabinetQr('2026 Cabinet Exemple')).toBe('cabinet-exemple')
    const long = proposerIdentifiantCabinetQr(`${'exemple '.repeat(10)}fin`)
    expect(long.length).toBeLessThanOrEqual(LONGUEUR_MAX_IDENTIFIANT_CABINET_QR)
    expect(long.endsWith('-')).toBe(false)
    expect(validerIdentifiantCabinetQr(long)).toEqual({ ok: true })
  })

  it('rend la proposition telle quelle, même refusée : l’écran la valide (réservé, trop court, vide)', () => {
    expect(proposerIdentifiantCabinetQr('Contact')).toBe('contact')
    expect(validerIdentifiantCabinetQr(proposerIdentifiantCabinetQr('Contact'))).toEqual({ ok: false, raison: 'reserve' })
    expect(proposerIdentifiantCabinetQr('Ab')).toBe('ab')
    expect(proposerIdentifiantCabinetQr('—')).toBe('')
  })
})

describe('reconnaissance d’un chemin public par le middleware (motif figé, sans base)', () => {
  it('/cabinet-exemple/signalement/<jeton>/, avec ou sans barre finale → page de signalement', () => {
    expect(cheminPublicCabinetQr(`/cabinet-exemple/signalement/${JETON}/`)).toEqual({ page: 'signalement', identifiant: 'cabinet-exemple', jeton: JETON })
    expect(cheminPublicCabinetQr(`/cabinet-exemple/signalement/${JETON}`)).toEqual({ page: 'signalement', identifiant: 'cabinet-exemple', jeton: JETON })
  })

  it('/cabinet-exemple/confirmation-adresse/, avec ou sans barre finale → page de confirmation', () => {
    expect(cheminPublicCabinetQr('/cabinet-exemple/confirmation-adresse/')).toEqual({ page: 'confirmation-adresse', identifiant: 'cabinet-exemple' })
    expect(cheminPublicCabinetQr('/cabinet-exemple/confirmation-adresse')).toEqual({ page: 'confirmation-adresse', identifiant: 'cabinet-exemple' })
  })

  it('/cabinet-exemple/invitation/, avec ou sans barre finale → ouverture de l’accès (lien de l’e-mail, publique comme la confirmation)', () => {
    expect(cheminPublicCabinetQr('/cabinet-exemple/invitation/')).toEqual({ page: 'invitation', identifiant: 'cabinet-exemple' })
    expect(cheminPublicCabinetQr('/cabinet-exemple/invitation')).toEqual({ page: 'invitation', identifiant: 'cabinet-exemple' })
  })

  it('jamais une langue, l’API, l’admin, _next, un jeton mal formé, une majuscule ni un autre chemin du cabinet', () => {
    const ignores = [
      `/fr/signalement/${JETON}/`, `/pt/signalement/${JETON}/`, `/en/signalement/${JETON}/`,
      `/api/signalement/${JETON}/`, '/api/confirmation-adresse/', `/admin/signalement/${JETON}/`, '/admin/confirmation-adresse/',
      `/_next/signalement/${JETON}/`,
      `/cabinet-exemple/signalement/${JETON.slice(1)}/`, `/cabinet-exemple/signalement/${JETON}0/`,
      `/cabinet-exemple/signalement/${JETON.toUpperCase()}/`, `/Cabinet-Exemple/signalement/${JETON}/`,
      '/cabinet-exemple/', '/cabinet-exemple', `/cabinet-exemple/signalement/${JETON}/autre/`,
      '/cabinet-exemple/suivi/', '/cabinet-exemple/connexion/', '/cabinet-exemple/confirmation-adresse/autre/',
      '/cabinet-exemple/invitation/autre/', '/Cabinet-Exemple/invitation/', '/api/invitation/', '/admin/invitation/',
      `/ab/signalement/${JETON}/`, `/${'a'.repeat(41)}/signalement/${JETON}/`, `/-ab/signalement/${JETON}/`,
      `//signalement/${JETON}/`, `/cabinet-exemple//signalement/${JETON}/`, '/', '',
    ]
    for (const chemin of ignores) expect(cheminPublicCabinetQr(chemin), chemin).toBeNull()
  })

  it('« apis » ou « administration » ne sont pas « api » ni « admin » : reconnus (la page répondra 404 si le cabinet n’existe pas)', () => {
    expect(cheminPublicCabinetQr(`/apis/signalement/${JETON}/`)).toEqual({ page: 'signalement', identifiant: 'apis', jeton: JETON })
    expect(cheminPublicCabinetQr('/administration/confirmation-adresse/')).toEqual({ page: 'confirmation-adresse', identifiant: 'administration' })
  })

  it('tout identifiant valide est reconnu par le motif (sinon ses QR codes ne s’ouvriraient pas)', () => {
    const valides = ['abc', 'cabinet-exemple', 'c2-exemple-3', 'a'.repeat(40), `a${'-b'.repeat(19)}c`.slice(0, 40).replace(/-$/, '')]
    for (let n = LONGUEUR_MIN_IDENTIFIANT_CABINET_QR; n <= LONGUEUR_MAX_IDENTIFIANT_CABINET_QR; n += 1) valides.push(`a${'b'.repeat(n - 2)}c`)
    for (const id of valides) {
      expect(validerIdentifiantCabinetQr(id), id).toEqual({ ok: true })
      expect(cheminPublicCabinetQr(`/${id}/signalement/${JETON}/`), id).toEqual({ page: 'signalement', identifiant: id, jeton: JETON })
    }
  })

  it('le motif est construit sur SOURCE_IDENTIFIANT_CABINET_QR (le même texte servira aux réécritures de next.config.ts)', () => {
    // RegExp.source réécrit « / » en « \/ » : on compare à la même regex reconstruite depuis la source.
    expect(MOTIF_CHEMIN_CABINET_QR.source).toBe(
      new RegExp(`^\\/(${SOURCE_IDENTIFIANT_CABINET_QR})\\/(?:signalement\\/([0-9a-f]{32})|(confirmation-adresse|invitation))\\/?$`).source,
    )
    expect(SOURCE_IDENTIFIANT_CABINET_QR).toBe('(?!(?:api|admin)/)[a-z][a-z0-9-]{1,38}[a-z0-9]')
    expect(MOTIF_CHEMIN_CABINET_QR.flags).toBe('')
    // Entre deux barres, la source refuse « api » et « admin » et admet un identifiant du format.
    const segment = new RegExp(`^/(${SOURCE_IDENTIFIANT_CABINET_QR})/`)
    expect(segment.test('/api/')).toBe(false)
    expect(segment.test('/admin/')).toBe(false)
    expect(segment.test('/cabinet-exemple/')).toBe(true)
  })

  it('segments du chemin d’un cabinet : signalement, confirmation-adresse, invitation (pages publiques), suivi et connexion (espace du cabinet, lot 4)', () => {
    expect([...SEGMENTS_CABINET_QR]).toEqual(['signalement', 'confirmation-adresse', 'suivi', 'invitation', 'connexion'])
  })
})

// ── PR 2, lot 4 : espace du cabinet (vitfix.io/<identifiant>/, /connexion/, /suivi/), avec session ──────────────────
// Deuxième famille de chemins, reconnue elle aussi AVANT la langue, mais SEULEMENT pour un identifiant qui passe
// validerIdentifiantCabinetQr (format ET noms réservés) : sinon /aj-signalement/connexion/ (page de la #669, atteinte sans
// langue par 302) serait prise pour le cabinet « aj-signalement », et le segment seul /<x>/ capterait toute page du site.
describe('espace d’un cabinet : reconnaissance par le middleware (avec la liste des réservés)', () => {
  it('/<id>/ (accueil), /<id>/connexion/ et /<id>/suivi/, avec ou sans barre finale', () => {
    expect(cheminEspaceCabinetQr('/cabinet-exemple/')).toEqual({ page: 'accueil', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/cabinet-exemple')).toEqual({ page: 'accueil', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/cabinet-exemple/connexion/')).toEqual({ page: 'connexion', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/cabinet-exemple/connexion')).toEqual({ page: 'connexion', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/cabinet-exemple/suivi/')).toEqual({ page: 'suivi', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/cabinet-exemple/suivi')).toEqual({ page: 'suivi', identifiant: 'cabinet-exemple' })
    expect(cheminEspaceCabinetQr('/apis/suivi/')).toEqual({ page: 'suivi', identifiant: 'apis' })
  })

  it('jamais un nom réservé (page de connexion de la #669, routes du site, API, admin), une langue ni un préfixe réservé', () => {
    for (const chemin of [
      '/aj-signalement/connexion/', '/aj-signalement/connexion', '/aj-signalement/', '/aj-signalement-exemple/suivi/',
      '/api/', '/api/connexion/', '/admin/', '/admin/connexion/', '/blog/', '/syndic/connexion/', '/auth/', '/cabinet/',
      '/cabinet/cabinet-exemple/suivi/', '/signalement/', '/servicos/', '/confirmation-x/', '/suivi/', '/connexion/',
      '/fr/', '/pt/', '/en/', '/fr/cabinet-exemple/suivi/', '/plumber-porto/', '/loodgieter-porto/', '/fontanero-oporto/',
    ]) {
      expect(cheminEspaceCabinetQr(chemin), chemin).toBeNull()
    }
  })

  it('jamais une casse différente, un hors format, un autre segment ni un sous-chemin', () => {
    for (const chemin of [
      '/Cabinet-Exemple/', '/Cabinet-Exemple/suivi/', '/cabinet-exemple/Suivi/', '/ab/', '/a--b/suivi/', '/-ab/', '/cabinet_exemple/',
      `/${'a'.repeat(41)}/`, '/cabinet-exemple/suivi/autre/', '/cabinet-exemple/connexion/autre/', '/cabinet-exemple/suivix/',
      '/cabinet-exemple/invitation/', '/cabinet-exemple/confirmation-adresse/', `/cabinet-exemple/signalement/${JETON}/`,
      '/cabinet-exemple//', '//cabinet-exemple/', '/_next/', '/', '',
    ]) {
      expect(cheminEspaceCabinetQr(chemin), chemin).toBeNull()
    }
  })

  it('les deux familles ne se recouvrent pas (pages publiques sans session d’un côté, espace avec session de l’autre)', () => {
    for (const chemin of ['/cabinet-exemple/', '/cabinet-exemple/connexion/', '/cabinet-exemple/suivi/']) {
      expect(cheminPublicCabinetQr(chemin), chemin).toBeNull()
    }
    for (const chemin of ['/cabinet-exemple/invitation/', '/cabinet-exemple/confirmation-adresse/', `/cabinet-exemple/signalement/${JETON}/`]) {
      expect(cheminEspaceCabinetQr(chemin), chemin).toBeNull()
    }
  })

  it('adresses de l’espace : /<id>/suivi/ et /<id>/connexion/ (barre finale), reconnues par le motif', () => {
    expect(cheminSuiviCabinetQr('cabinet-exemple')).toBe('/cabinet-exemple/suivi/')
    expect(cheminConnexionCabinetQr('cabinet-exemple')).toBe('/cabinet-exemple/connexion/')
    expect(cheminEspaceCabinetQr(cheminSuiviCabinetQr('cabinet-exemple'))?.page).toBe('suivi')
    expect(cheminEspaceCabinetQr(cheminConnexionCabinetQr('cabinet-exemple'))?.page).toBe('connexion')
  })

  it('estEspaceCabinetQr (ConditionalLayout) : connexion et suivi, sous l’adresse affichée comme sous la page interne', () => {
    for (const chemin of [
      '/cabinet-exemple/connexion/', '/cabinet-exemple/suivi/', '/cabinet-exemple/suivi',
      '/cabinet/cabinet-exemple/connexion/', '/cabinet/cabinet-exemple/suivi/', '/cabinet/cabinet-exemple/suivi',
    ]) {
      expect(estEspaceCabinetQr(chemin), chemin).toBe(true)
    }
    for (const chemin of [
      '/cabinet-exemple/', '/cabinet-exemple/invitation/', '/cabinet-exemple/confirmation-adresse/', '/cabinet/cabinet-exemple/invitation/',
      '/aj-signalement/connexion/', '/blog/suivi/', '/cabinet/', '/cabinet/suivi/', '/', '', null, undefined,
    ]) {
      expect(estEspaceCabinetQr(chemin), String(chemin)).toBe(false)
    }
  })
})

describe('adresses produites', () => {
  it('QR code : <origine>/<identifiant>/signalement/<jeton>/, barre finale, origine sans barre finale', () => {
    expect(urlSignalementCabinetQr('cabinet-exemple', JETON)).toBe(`https://vitfix.io/cabinet-exemple/signalement/${JETON}/`)
    expect(urlSignalementCabinetQr('cabinet-exemple', JETON, 'http://localhost:3000/')).toBe(`http://localhost:3000/cabinet-exemple/signalement/${JETON}/`)
    expect(cheminPublicCabinetQr(new URL(urlSignalementCabinetQr('cabinet-exemple', JETON)).pathname)).toEqual({ page: 'signalement', identifiant: 'cabinet-exemple', jeton: JETON })
  })

  it('confirmation d’adresse : le jeton du lien est APRÈS le « # » (jamais envoyé au serveur ni dans le Referer)', () => {
    const url = urlConfirmationAdresseQr('cabinet-exemple', JETON_LIEN, 'https://vitfix.io/')
    expect(url).toBe(`https://vitfix.io/cabinet-exemple/confirmation-adresse/#${JETON_LIEN}`)
    const lu = new URL(url)
    expect(lu.pathname).toBe('/cabinet-exemple/confirmation-adresse/')
    expect(lu.search).toBe('')
    expect(lu.hash).toBe(`#${JETON_LIEN}`)
    expect(cheminPublicCabinetQr(lu.pathname)).toEqual({ page: 'confirmation-adresse', identifiant: 'cabinet-exemple' })
  })

  it('ouverture de l’accès d’un gestionnaire : <origine>/<identifiant>/invitation/#<jeton> (jeton APRÈS le « # »)', () => {
    const url = urlInvitationAccesQr('cabinet-exemple', JETON_LIEN, 'https://vitfix.io/')
    expect(url).toBe(`https://vitfix.io/cabinet-exemple/invitation/#${JETON_LIEN}`)
    const lu = new URL(url)
    expect(lu.pathname).toBe('/cabinet-exemple/invitation/')
    expect(lu.search).toBe('')
    expect(lu.hash).toBe(`#${JETON_LIEN}`)
    expect(cheminPublicCabinetQr(lu.pathname)).toEqual({ page: 'invitation', identifiant: 'cabinet-exemple' })
  })
})
