// tests/lib/aj-signalement-adresse-de-fiche.test.ts
//
// AJ Signalement (PR 2, contrôle 2, constats C1 à C3) : la règle « adresse d'une fiche » (RG-06 bis) a UNE définition
// par langage, et les deux répondent pareil :
//   - SQL : signalements_qr_adresse_de_fiche(p_adresse, p_fiche_email, p_domaines) (migration 20261112), seule à
//     décider pour les exclusions de l'envoi et pour chaque retrait des saisies (départ, effacement, retrait
//     d'attribution) ;
//   - TypeScript : estAdresseDeFicheQr(adresse, ficheEmail, domainesDuCabinet) (lib/aj-signalement/gestionnaires.ts),
//     construite sur boitesDeFicheQr, sur laquelle reposent adresseDeFicheQr (refus, masquage, compteur) et l'import.
// Table de cas COMMUNE : tests/helpers/aj-signalement-adresse-de-fiche.cas.json. L'essai PGlite (aj-pr2/pglite-essai,
// essais-variantes.mjs) appelle la fonction SQL installée sur chacun de ces cas ; ici, la jumelle, ses usages, et le
// texte SQL figé puis traduit mot pour mot (aucune base PostgreSQL en CI).
// Contre-vérification du 12/11 : la garde « saisie de la fiche SEULE » (signalements_qr_saisie_de_la_fiche, jumelle des
// tests saisieDeLaFicheQr) a sa table dans le même fichier (gardes) ; l'essai PGlite essais-garde.mjs la rejoue en SQL.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ETIQUETTE_EMAIL_QR, boitesDeFicheQr, estAdresseDeFicheQr } from '@/lib/aj-signalement/gestionnaires'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import { saisieDeLaFicheQr, type MondeGardeQr } from '../helpers/aj-signalement-variantes'

/** Garde (contre-vérification du 12/11) : un petit monde, la fiche concernée, la réponse attendue pour chaque saisie. */
interface CasGarde {
  note: string
  domaines: Record<string, string[]>
  fiches: Record<string, { cabinet: string; email: string | null; actif?: boolean; contestee?: boolean }>
  copropriete: { cabinet: string | null; attributions: string[] }
  fiche: string
  retrait: boolean
  saisies: Array<{ adresse: string | null; attendu: boolean; note: string }>
}

interface CasAdresseDeFiche {
  adresse: string | null
  ficheEmail: string | null
  domaines: Array<string | null>
  attendu: boolean
  note: string
}

const TABLE = JSON.parse(readFileSync(join(process.cwd(), 'tests/helpers/aj-signalement-adresse-de-fiche.cas.json'), 'utf-8')) as {
  description: string
  cas: CasAdresseDeFiche[]
  descriptionGardes: string
  gardes: CasGarde[]
}
const CAS = TABLE.cas
const GARDES = TABLE.gardes

/** Le monde d'un cas de garde, lu comme la fonction SQL le lit en base. */
function mondeDuCas(g: CasGarde): MondeGardeQr {
  return {
    fiches: Object.entries(g.fiches).map(([id, f]) => ({ id, cabinetId: f.cabinet, email: f.email, actif: f.actif !== false, contestee: f.contestee === true })),
    domainesDuCabinet: (cabinet) => (cabinet === null ? [] : g.domaines[cabinet] ?? []),
    attribuee: (ficheId) => g.copropriete.attributions.includes(ficheId),
  }
}
const repondGarde = (g: CasGarde, adresse: string | null): boolean => {
  const f = g.fiches[g.fiche]
  return saisieDeLaFicheQr(adresse, { id: g.fiche, email: f.email, domaines: g.domaines[f.cabinet] ?? [] },
    { id: 'copropriete-du-cas', cabinetId: g.copropriete.cabinet }, g.retrait, mondeDuCas(g))
}
const libelle = (c: CasAdresseDeFiche) => `${c.note} : ${JSON.stringify(c.adresse)} / ${JSON.stringify(c.ficheEmail)} / ${JSON.stringify(c.domaines)}`
const domainesTexte = (c: CasAdresseDeFiche): string[] => c.domaines.filter((d): d is string => typeof d === 'string')

const sansCommentaires = (texte: string) => texte.replace(/--[^\n]*/g, '')
const compacter = (s: string) => s.replace(/\s+/g, ' ').trim()
const SQL_1112 = sansCommentaires(readFileSync(join(process.cwd(), 'supabase/migrations/20261112_signalements_qr_acces_gestionnaires.sql'), 'utf-8'))
function corpsSql(nom: string): string {
  const m = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${nom}\\s*\\([^)]*\\)[\\s\\S]*?\\bAS\\s+\\$fn\\$([\\s\\S]*?)\\$fn\\$`).exec(SQL_1112)
  if (!m) throw new Error(`fonction ${nom} absente de la 20261112`)
  return m[1]
}
function enteteSql(nom: string): string {
  const m = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${nom}\\s*\\(([^)]*)\\)([\\s\\S]*?)\\bAS\\s+\\$fn\\$`).exec(SQL_1112)
  if (!m) throw new Error(`fonction ${nom} absente de la 20261112`)
  return compacter(`(${compacter(m[1])})${m[2]}`)
}

describe('table de cas commune (SQL et TypeScript)', () => {
  it('assez de cas, des deux réponses ; seulement des domaines fictifs ou de messageries publiques', () => {
    expect(CAS.length).toBeGreaterThanOrEqual(30)
    expect(CAS.some((c) => c.attendu)).toBe(true)
    expect(CAS.some((c) => !c.attendu)).toBe(true)
    // Domaine réservé .test (RFC 2606), ou messagerie publique (jamais un domaine de cabinet).
    const permis = /(?:\.test|^gmail\.com|^outlook\.fr)$/
    for (const c of CAS) {
      const adresses = [c.adresse, c.ficheEmail].filter((v): v is string => typeof v === 'string' && v.includes('@'))
      const domaines = [...adresses.map((a) => a.slice(a.lastIndexOf('@') + 1)), ...domainesTexte(c)]
      for (const d of domaines.map((x) => x.trim().toLowerCase()).filter((x) => x.includes('.'))) expect(d, libelle(c)).toMatch(permis)
    }
  })

  it('couvre chaque branche : étiquette « + », autre domaine du cabinet, domaine d’un autre cabinet, NULL, deux « @ »', () => {
    const notes = CAS.map((c) => c.note).join(' | ')
    for (const mot of ['étiquette', 'autre domaine du cabinet', 'domaine d\'un autre cabinet', 'NULL', 'deux « @ »', 'messagerie publique']) {
      expect(notes).toContain(mot)
    }
  })
})

describe('estAdresseDeFicheQr : la jumelle TypeScript de signalements_qr_adresse_de_fiche', () => {
  it.each(CAS.map((c) => [libelle(c), c] as const))('%s', (_l, c) => {
    expect(estAdresseDeFicheQr(c.adresse, c.ficheEmail, domainesTexte(c))).toBe(c.attendu)
  })

  it('boitesDeFicheQr : sa boîte, puis sa partie locale sur chaque domaine du cabinet (sans doublon) ; rien sans adresse', () => {
    expect(boitesDeFicheQr('Paul+AJ@Exemple.test', ['exemple.test', 'exemple-bis.test'])).toEqual(['paul@exemple.test', 'paul@exemple-bis.test'])
    expect(boitesDeFicheQr('jeanne@gmail.com', ['exemple.test'])).toEqual(['jeanne@gmail.com', 'jeanne@exemple.test'])
    expect(boitesDeFicheQr('marie@exemple.test', [])).toEqual(['marie@exemple.test'])
    expect(boitesDeFicheQr(null, ['exemple.test'])).toEqual([])
    expect(boitesDeFicheQr('a@b@exemple.test', ['exemple.test'])).toEqual(['a@b@exemple.test'])
  })
})

describe('les usages TypeScript passent par la même règle', () => {
  // adressesDeFichesQr (refus à l'ajout, masquage, compteur du super admin) : une fiche, les domaines de son cabinet.
  it.each(CAS.map((c) => [libelle(c), c] as const))('adressesDeFichesQr — %s', (_l, c) => {
    const cabinets = new Map(domainesTexte(c).map((d) => [d, 'cabinet-du-cas']))
    const reconnues = adressesDeFichesQr(c.adresse === null ? [] : [c.adresse], [{ email: c.ficheEmail, cabinetId: 'cabinet-du-cas' }], cabinets)
    expect(reconnues.length > 0).toBe(c.attendu)
  })

  it('le domaine d’un AUTRE cabinet ne rapproche jamais une partie locale (adressesDeFichesQr)', () => {
    const cabinets = new Map([['exemple.test', 'cab-a'], ['exemple-bis.test', 'cab-b']])
    expect(adressesDeFichesQr(['marie@exemple-bis.test'], [{ email: 'marie@exemple.test', cabinetId: 'cab-a' }], cabinets)).toEqual([])
    expect(adressesDeFichesQr(['marie+x@exemple.test'], [{ email: 'marie@exemple.test', cabinetId: 'cab-a' }], cabinets)).toEqual(['marie+x@exemple.test'])
  })
})

describe('signalements_qr_adresse_de_fiche (20261112) : texte figé, traduit mot pour mot, mêmes réponses', () => {
  const BOITE = (x: string) => `regexp_replace(lower(btrim(${x})), '${ETIQUETTE_EMAIL_QR.source}', '\\1@')`
  const CORPS = `SELECT coalesce(
           strpos(a.boite, '@') > 0 AND strpos(f.boite, '@') > 0
           AND (a.boite = f.boite
                OR (a.boite ~ '^[^@]+@[^@]+$' AND f.boite ~ '^[^@]+@[^@]+$'
                    AND split_part(a.boite, '@', 1) = split_part(f.boite, '@', 1)
                    AND split_part(a.boite, '@', 2) = ANY (p_domaines))),
           false)
    FROM (SELECT ${BOITE('p_adresse')} AS boite) AS a,
         (SELECT ${BOITE('p_fiche_email')} AS boite) AS f`

  it('signature (texte, texte, texte[]) → boolean, IMMUTABLE ; corps figé', () => {
    expect(enteteSql('signalements_qr_adresse_de_fiche')).toBe(compacter(
      '(p_adresse text, p_fiche_email text, p_domaines text[]) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = public, pg_temp',
    ))
    expect(compacter(corpsSql('signalements_qr_adresse_de_fiche'))).toBe(compacter(CORPS))
  })

  // Traduction mot pour mot : btrim (espaces seules) ; lower ; regexp_replace sans « g » (premier motif) ; strpos ;
  // ~ (expression régulière) ; split_part (n-ième morceau, '' au-delà) ; = ANY (un élément égal ; NULL ignoré) ;
  // coalesce(…, false) (NULL → faux).
  const boiteSql = (x: string | null) => (x === null ? null : x.replace(/^ +| +$/g, '').toLowerCase().replace(ETIQUETTE_EMAIL_QR, '$1@'))
  const splitPart = (x: string, n: number) => x.split('@')[n - 1] ?? ''
  const UNE_AROBASE = /^[^@]+@[^@]+$/
  function adresseDeFicheSql(adresse: string | null, ficheEmail: string | null, domaines: ReadonlyArray<string | null>): boolean {
    const a = boiteSql(adresse)
    const f = boiteSql(ficheEmail)
    if (a === null || f === null || !a.includes('@') || !f.includes('@')) return false
    if (a === f) return true
    return UNE_AROBASE.test(a) && UNE_AROBASE.test(f) && splitPart(a, 1) === splitPart(f, 1) && domaines.some((d) => d !== null && d === splitPart(a, 2))
  }

  it.each(CAS.map((c) => [libelle(c), c] as const))('%s', (_l, c) => {
    expect(adresseDeFicheSql(c.adresse, c.ficheEmail, c.domaines)).toBe(c.attendu)
  })

  it('signalements_qr_saisies_sans_fiche : les saisies qui ne sont PAS de la fiche seule (garde), dans leur ordre (NULL gardés, comme array_remove)', () => {
    expect(enteteSql('signalements_qr_saisies_sans_fiche')).toBe(compacter(
      '(p_saisies text[], p_fiche uuid, p_fiche_email text, p_domaines text[], p_cabinet uuid, p_copropriete uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp',
    ))
    expect(compacter(corpsSql('signalements_qr_saisies_sans_fiche'))).toBe(compacter(`SELECT coalesce(array_agg(u.e ORDER BY u.n)
             FILTER (WHERE NOT signalements_qr_saisie_de_la_fiche(u.e, p_fiche, p_fiche_email, p_domaines, p_cabinet, p_copropriete)), '{}')
    FROM unnest(p_saisies) WITH ORDINALITY AS u(e, n)`))
  })
})

// ── Contre-vérification du 12/11 : la garde « saisie de la fiche SEULE » ──
// Le départ, l'effacement, le retrait d'attribution et l'exclusion à l'envoi appliquaient la règle à la seule fiche
// concernée : la saisie qui est AUSSI l'adresse d'une autre fiche active (même boîte dans deux cabinets, domaine d'une
// fiche forcée déclaré par un autre cabinet, deux domaines d'un cabinet) était retirée ou exclue avec elle.

describe('signalements_qr_saisie_de_la_fiche (20261112) : texte figé, la règle pour la fiche puis pour chaque autre fiche', () => {
  const CORPS = `SELECT signalements_qr_adresse_de_fiche(p_adresse, p_fiche_email, p_domaines)
     AND NOT EXISTS (
       SELECT 1 FROM signalements_qr_gestionnaires o
        WHERE o.cabinet_id = p_cabinet AND o.id IS DISTINCT FROM p_fiche
          AND o.actif AND o.adresse_contestee_le IS NULL AND o.email IS NOT NULL
          AND (p_copropriete IS NULL OR EXISTS (SELECT 1 FROM signalements_qr_attributions a
                                                 WHERE a.copropriete_id = p_copropriete AND a.gestionnaire_id = o.id))
          AND signalements_qr_adresse_de_fiche(p_adresse, o.email,
                ARRAY(SELECT d.domaine FROM signalements_qr_domaines_autorises d WHERE d.cabinet_id = p_cabinet)))`

  it('signature (adresse, fiche, son adresse, ses domaines, cabinet de la copropriété, copropriété au retrait) → boolean, STABLE ; corps figé', () => {
    expect(enteteSql('signalements_qr_saisie_de_la_fiche')).toBe(compacter(
      '(p_adresse text, p_fiche uuid, p_fiche_email text, p_domaines text[], p_cabinet uuid, p_copropriete uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp',
    ))
    expect(compacter(corpsSql('signalements_qr_saisie_de_la_fiche'))).toBe(compacter(CORPS))
  })

  it('définie après la règle et avant les saisies sans la fiche (fonctions SQL : corps contrôlés à la création)', () => {
    const position = (nom: string) => SQL_1112.search(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${nom}\\s*\\(`))
    expect(position('signalements_qr_saisie_de_la_fiche')).toBeGreaterThan(position('signalements_qr_adresse_de_fiche'))
    expect(position('signalements_qr_saisies_sans_fiche')).toBeGreaterThan(position('signalements_qr_saisie_de_la_fiche'))
  })
})

describe('garde : table commune (gardes) — jumelle saisieDeLaFicheQr', () => {
  it('assez de cas, des deux réponses ; chaque branche (autre cabinet, sans cabinet, contestée, partie, effacée, retrait) ; domaines fictifs', () => {
    const saisies = GARDES.flatMap((g) => g.saisies)
    expect(GARDES.length).toBeGreaterThanOrEqual(12)
    expect(saisies.some((s) => s.attendu)).toBe(true)
    expect(saisies.some((s) => !s.attendu)).toBe(true)
    expect(GARDES.some((g) => g.copropriete.cabinet === null)).toBe(true)
    expect(GARDES.some((g) => g.retrait && g.copropriete.attributions.length > 0)).toBe(true)
    expect(GARDES.some((g) => g.retrait && g.copropriete.attributions.length === 0)).toBe(true)
    expect(GARDES.some((g) => Object.values(g.fiches).some((f) => f.contestee))).toBe(true)
    expect(GARDES.some((g) => Object.values(g.fiches).some((f) => f.email === null))).toBe(true)
    const permis = /(?:\.test|^gmail\.com)$/
    for (const g of GARDES) {
      const adresses = [...Object.values(g.fiches).map((f) => f.email), ...g.saisies.map((s) => s.adresse)]
        .filter((v): v is string => typeof v === 'string')
      const domaines = [...adresses.map((a) => a.slice(a.lastIndexOf('@') + 1)), ...Object.values(g.domaines).flat()]
      for (const d of domaines.map((x) => x.trim().toLowerCase())) expect(d, g.note).toMatch(permis)
      for (const nom of g.copropriete.attributions) expect(Object.keys(g.fiches), g.note).toContain(nom)
      expect(Object.keys(g.fiches), g.note).toContain(g.fiche)
    }
  })

  it.each(GARDES.flatMap((g) => g.saisies.map((s) => [`${g.note} — ${s.note} : ${JSON.stringify(s.adresse)}`, g, s] as const)))('%s', (_l, g, s) => {
    expect(repondGarde(g, s.adresse)).toBe(s.attendu)
  })

  it('preuve de la contre-vérification : avec la règle SEULE (sans la garde), la fiche partie emportait l’adresse de la fiche active d’un autre cabinet', () => {
    const g = GARDES[0]
    const f = g.fiches[g.fiche]
    expect(estAdresseDeFicheQr('jeanne+beta@gmail.com', f.email, g.domaines[f.cabinet])).toBe(true)
    expect(repondGarde(g, 'jeanne+beta@gmail.com')).toBe(false)
  })
})
