// @vitest-environment node
// Données réelles du Dictionnaire matériaux (lib/dictionnaire-materiaux/donnees/<pays>/) : cohérence de la
// structure, preuves de disponibilité en magasin, règles de contenu fixées par le propriétaire (matériaux
// faciles à trouver chez les enseignes du pays, rangés par catégories, sans marque), et accord entre les
// données et la recherche. Un ajout au dictionnaire qui casse une de ces règles échoue ici.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dictionnairePour, paysInscrits, type Dictionnaire, type Pays } from '@/lib/dictionnaire-materiaux'
import { DOMAINES_ENSEIGNES, enseignesDuPays, lienVersEnseigne, termeDeRecherche } from '@/lib/dictionnaire-materiaux/enseignes'
import { motsUtiles, normaliser, rechercher } from '@/lib/dictionnaire-materiaux/recherche'
import { construirePromptSysteme } from '@/lib/dictionnaire-materiaux/ia/analyse'
import { MARQUES, contientMarque } from '../../scripts/dictionnaire-materiaux/generer-donnees.mjs'

const RACINE = join(process.cwd(), 'lib/dictionnaire-materiaux/donnees')
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Familles et domaines deviennent des noms de variables dans index.ts : une lettre en tête.
const KEBAB_IDENTIFIANT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

interface Preuve { enseigne: string; url: string; titre: string }
interface FichierPreuves { verifieLe: string; sansLien?: Record<string, string[]>; materiaux: Record<string, Preuve[]> }

const lirePreuves = (pays: Pays): FichierPreuves =>
  JSON.parse(readFileSync(join(RACINE, pays.toLowerCase(), 'preuves.json'), 'utf8')) as FichierPreuves

const doublons = (valeurs: string[]) => valeurs.filter((v, i) => valeurs.indexOf(v) !== i)

/**
 * Tous les textes montrés à l'artisan (dont les autres noms d'un matériau), plus le terme général passé à la
 * recherche des magasins, avec leur provenance pour le message d'échec. Les textes qui servent seulement à chercher
 * sont à part (`textesCherches`).
 */
function textesAffiches(dico: Dictionnaire): Array<[string, string]> {
  const textes: Array<[string, string]> = []
  for (const f of dico.familles) {
    textes.push([`famille ${f.id}`, `${f.nom} ${f.description}`])
    for (const sf of f.sousFamilles) textes.push([`sous-famille ${sf.id}`, `${sf.nom} ${sf.description}`])
  }
  for (const m of dico.materiaux) {
    textes.push([`matériau ${m.id}`, [m.nom, ...m.aussiAppele, m.usage, m.aSavoir ?? '', m.conditionnement ?? '', m.recherche].join(' ')])
  }
  for (const d of dico.domaines) textes.push([`domaine ${d.id}`, d.nom])
  for (const s of dico.situations) {
    const notes = s.etapes.flatMap((e) => [e.titre, ...e.materiaux.map((l) => l.note ?? '')])
    textes.push([`situation ${s.id}`, [s.titre, s.description, ...s.aVerifier, ...s.attention, ...notes].join(' ')])
  }
  return textes
}

/**
 * Textes qui servent seulement à chercher, jamais affichés : mots-clés des fiches de situation (« pôr teflon na
 * rosca », comme on le dit sur le chantier), noms de marque cherchés d'un matériau (`aussiCherche`) et terme propre à
 * une enseigne, qui reprend sa façon de nommer le produit (« teflon » chez Maxmat pour la fita PTFE).
 */
function textesCherches(dico: Dictionnaire): Array<[string, string]> {
  return [
    ...dico.situations.map((s): [string, string] => [`mots-clés ${s.id}`, s.motsCles.join(' ')]),
    ...dico.materiaux.map((m): [string, string] => [
      `recherche ${m.id}`,
      [...(m.aussiCherche ?? []), ...Object.values(m.rechercheEnseigne ?? {})].join(' '),
    ]),
  ]
}

// Marques courantes des rayons bricolage (MARQUES, liste du générateur des données) : aucune dans un texte du
// dictionnaire. Un autre nom qui en cite une (« sikaflex », « cola UHU ») sert seulement à la recherche.

// Mots du portugais du Brésil : le dictionnaire est écrit pour des artisans du Portugal.
const BRESILIANISMES = ['banheiro', 'rejunte', 'drywall', 'encanador', 'concreto', 'acartonado', 'registro', 'massa corrida', 'vaso sanitario', 'azulejista']

describe.each(paysInscrits())('données du dictionnaire — %s', (pays) => {
  const dico = dictionnairePour(pays) as Dictionnaire
  const preuves = lirePreuves(pays)
  const idsEnseignes = enseignesDuPays(pays).map((e) => e.id)
  const famillesParId = new Map(dico.familles.map((f) => [f.id, f]))
  const idsMateriaux = new Set(dico.materiaux.map((m) => m.id))

  it('a son pays, sa langue, ses enseignes et une date de vérification', () => {
    expect(dico.pays).toBe(pays)
    expect(dico.langue).toBe(pays === 'PT' ? 'pt' : 'fr')
    expect(dico.verifieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dico.enseignes.map((e) => e.id)).toEqual(idsEnseignes)
    expect(idsEnseignes.length).toBeGreaterThan(0)
  })

  it('a des identifiants en kebab-case, sans doublon', () => {
    const groupes: Record<string, string[]> = {
      familles: dico.familles.map((f) => f.id),
      materiaux: dico.materiaux.map((m) => m.id),
      domaines: dico.domaines.map((d) => d.id),
      situations: dico.situations.map((s) => s.id),
    }
    for (const [nom, ids] of Object.entries(groupes)) {
      expect(doublons(ids), `${nom} en double`).toEqual([])
      const regle = nom === 'familles' || nom === 'domaines' ? KEBAB_IDENTIFIANT : KEBAB
      expect(ids.filter((id) => !regle.test(id)), `${nom} mal formés`).toEqual([])
    }
    for (const f of dico.familles) {
      const ids = f.sousFamilles.map((sf) => sf.id)
      expect(doublons(ids), `sous-familles en double dans ${f.id}`).toEqual([])
      expect(ids.filter((id) => !KEBAB.test(id)), `sous-familles mal formées dans ${f.id}`).toEqual([])
    }
    expect(doublons(dico.situations.map((s) => normaliser(s.titre))), 'titres de situation en double').toEqual([])
    expect(doublons(dico.materiaux.map((m) => normaliser(m.nom))), 'noms de matériau en double').toEqual([])
  })

  it('range chaque matériau dans une sous-famille de sa famille, avec nom, usage et terme de recherche', () => {
    for (const m of dico.materiaux) {
      const famille = famillesParId.get(m.famille)
      expect(famille, `${m.id} : famille ${m.famille}`).toBeDefined()
      expect(famille?.sousFamilles.some((sf) => sf.id === m.sousFamille), `${m.id} : sous-famille ${m.sousFamille}`).toBe(true)
      for (const champ of [m.nom, m.usage, m.recherche]) expect(champ.trim(), m.id).not.toBe('')
      expect(m.aSavoir === undefined || m.aSavoir.trim() !== '', `${m.id} : aSavoir vide`).toBe(true)
      expect(m.conditionnement === undefined || m.conditionnement.trim() !== '', `${m.id} : conditionnement vide`).toBe(true)
      expect(doublons(m.aussiAppele.map(normaliser)), `${m.id} : autres noms en double`).toEqual([])
    }
  })

  it('n’a ni famille, ni sous-famille, ni domaine vide', () => {
    for (const f of dico.familles) {
      expect(f.sousFamilles.length, `famille ${f.id}`).toBeGreaterThan(0)
      for (const sf of f.sousFamilles) {
        expect(dico.materiaux.some((m) => m.famille === f.id && m.sousFamille === sf.id), `sous-famille vide ${f.id}/${sf.id}`).toBe(true)
        expect(sf.nom.trim(), `${f.id}/${sf.id}`).not.toBe('')
      }
      expect(f.icone.trim(), f.id).not.toBe('')
    }
    for (const d of dico.domaines) {
      expect(dico.situations.some((s) => s.domaine === d.id), `domaine vide ${d.id}`).toBe(true)
    }
  })

  it('donne à chaque situation des étapes faites de matériaux du catalogue', () => {
    const idsDomaines = new Set(dico.domaines.map((d) => d.id))
    for (const s of dico.situations) {
      expect(idsDomaines.has(s.domaine), `${s.id} : domaine ${s.domaine}`).toBe(true)
      expect(s.titre.trim() !== '' && s.description.trim() !== '', `${s.id} : titre ou description`).toBe(true)
      expect(s.motsCles.length, `${s.id} : mots-clés`).toBeGreaterThan(0)
      expect(s.etapes.length, `${s.id} : étapes`).toBeGreaterThan(0)
      const cites = s.etapes.flatMap((e) => e.materiaux.map((l) => l.id))
      expect(cites.filter((id) => !idsMateriaux.has(id)), `${s.id} : matériaux hors catalogue`).toEqual([])
      expect(doublons(cites), `${s.id} : matériau cité deux fois`).toEqual([])
      for (const e of s.etapes) {
        expect(e.titre.trim(), `${s.id} : étape sans titre`).not.toBe('')
        expect(e.materiaux.length, `${s.id} / ${e.titre}`).toBeGreaterThan(0)
      }
    }
  })

  it('n’a que des matériaux trouvés chez une enseigne du pays, preuve à l’appui', () => {
    expect(preuves.verifieLe).toBe(dico.verifieLe)
    expect(Object.keys(preuves.materiaux).filter((id) => !idsMateriaux.has(id)), 'preuves sans matériau').toEqual([])
    expect(Object.keys(preuves.sansLien ?? {}).filter((id) => !idsMateriaux.has(id)), 'enseignes sans lien d’un matériau absent').toEqual([])
    const domaines = DOMAINES_ENSEIGNES[pays]
    for (const m of dico.materiaux) {
      const liste = preuves.materiaux[m.id] ?? []
      expect(liste.length, `${m.id} : aucune preuve`).toBeGreaterThan(0)
      expect(m.enseignes.length, `${m.id} : aucune enseigne`).toBeGreaterThan(0)
      expect(m.enseignes.filter((e) => !idsEnseignes.includes(e)), `${m.id} : enseigne hors pays`).toEqual([])
      expect(doublons([...m.enseignes]), `${m.id} : enseigne en double`).toEqual([])
      // Les enseignes affichées sont celles des preuves, moins celles où aucun terme générique ne retrouve le
      // produit (vendu sous un nom de gamme) : la preuve reste, le lien n'est pas affiché.
      const sansLien = preuves.sansLien?.[m.id] ?? []
      const prouvees = [...new Set(liste.map((p) => p.enseigne))]
      expect(sansLien.filter((e) => !prouvees.includes(e)), `${m.id} : enseigne sans lien et sans preuve`).toEqual([])
      expect([...m.enseignes].sort((a, b) => a.localeCompare(b)), m.id).toEqual(
        prouvees.filter((e) => !sansLien.includes(e)).sort((a, b) => a.localeCompare(b)),
      )
      for (const p of liste) {
        const hote = new URL(p.url).hostname.toLowerCase()
        const domaine = domaines[p.enseigne as keyof typeof domaines] as string
        expect(hote === domaine || hote.endsWith(`.${domaine}`), `${m.id} : ${p.url} n'est pas sur ${domaine}`).toBe(true)
        expect(p.url.startsWith('https://'), `${m.id} : ${p.url}`).toBe(true)
        expect(p.titre.trim(), `${m.id} : preuve sans titre`).not.toBe('')
      }
    }
  })

  it('ne donne un terme de recherche propre à une enseigne que là où le matériau est vendu', () => {
    for (const m of dico.materiaux) {
      for (const [enseigne, terme] of Object.entries(m.rechercheEnseigne ?? {})) {
        expect(m.enseignes as string[], `${m.id} : terme pour ${enseigne}`).toContain(enseigne)
        expect((terme ?? '').trim(), `${m.id} : terme vide pour ${enseigne}`).not.toBe('')
        expect(normaliser(terme ?? ''), `${m.id} : terme propre identique au terme général`).not.toBe(normaliser(m.recherche))
      }
    }
  })

  it('ne cite aucune marque dans les textes montrés à l’artisan', () => {
    expect(MARQUES.length).toBeGreaterThan(30)
    for (const [origine, texte] of textesAffiches(dico)) {
      // « ç » se lit « ss » : « a porta roça no chão » n'est pas la marque Roca.
      const cle = ` ${normaliser(texte.replace(/ç/gi, 'ss'))} `
      expect(MARQUES.filter((marque) => cle.includes(` ${marque} `)), origine).toEqual([])
    }
  })

  it('garde les noms de marque pour la recherche, sans jamais les afficher', () => {
    expect(contientMarque('Sikaflex 11 FC')).toBe(true)
    expect(contientMarque('a porta roça no chão')).toBe(false)
    for (const m of dico.materiaux) {
      expect(m.aussiAppele.filter((alias) => contientMarque(alias)), `${m.id} : marque affichée`).toEqual([])
      expect((m.aussiCherche ?? []).filter((alias) => !contientMarque(alias)), `${m.id} : nom sans marque caché`).toEqual([])
    }
    // Un artisan qui tape la marque retrouve le type de produit.
    const avecMarques = dico.materiaux.filter((m) => (m.aussiCherche ?? []).length > 0)
    for (const m of avecMarques) {
      for (const alias of m.aussiCherche ?? []) {
        expect(rechercher(dico, alias).materiaux.map((r) => r.element.id), `« ${alias} » → ${m.id}`).toContain(m.id)
      }
    }
  })

  it('ne donne ni prix ni adresse de site dans les textes', () => {
    for (const [origine, texte] of [...textesAffiches(dico), ...textesCherches(dico)]) {
      expect(texte, origine).not.toMatch(/€|\beuros?\b|https?:\/\/|www\./i)
    }
  })

  it('retrouve chaque situation par son titre et chaque matériau par son nom', () => {
    for (const s of dico.situations) {
      expect(rechercher(dico, s.titre).situations[0]?.element.id, `titre « ${s.titre} »`).toBe(s.id)
    }
    for (const m of dico.materiaux) {
      expect(rechercher(dico, m.nom).materiaux[0]?.element.id, `nom « ${m.nom} »`).toBe(m.id)
    }
  })

  it('retrouve chaque situation par chacun de ses mots-clés', () => {
    for (const s of dico.situations) {
      for (const motCle of s.motsCles) {
        if (motsUtiles(motCle, dico.langue).length === 0) continue
        const trouvees = rechercher(dico, motCle).situations.map((r) => r.element.id)
        expect(trouvees, `« ${motCle} » → ${s.id}`).toContain(s.id)
      }
    }
  })

  it('garde des consignes d’IA d’une taille raisonnable', () => {
    // Le catalogue entier part dans les consignes du modèle : au-delà, chaque analyse coûte trop cher.
    expect(construirePromptSysteme(dico).length).toBeLessThan(70_000)
  })

  it('assemble tous ses fichiers de données, et seulement les siens', () => {
    const dossier = join(RACINE, pays.toLowerCase())
    const imports = [...readFileSync(join(dossier, 'index.ts'), 'utf8').matchAll(/from '([^']+)'/g)].map((r) => r[1])
    // Rien d'un autre pays : les données du pays (./…) et le socle commun du module.
    expect(imports.filter((chemin) => !chemin.startsWith('./') && !['../../enseignes', '../../types'].includes(chemin))).toEqual([])
    const fichiers = ['familles', 'situations'].flatMap((d) =>
      existsSync(join(dossier, d)) ? readdirSync(join(dossier, d)).map((f) => `./${d}/${f}`) : [],
    )
    expect(fichiers.filter((f) => !f.endsWith('.json')), 'fichiers de données hors JSON').toEqual([])
    const parOrdre = (a: string, b: string) => a.localeCompare(b)
    expect([...fichiers].sort(parOrdre), 'fichiers de données non assemblés').toEqual(imports.filter((c) => c.startsWith('./')).sort(parOrdre))
  })
})

describe('données du dictionnaire — Portugal', () => {
  const dico = dictionnairePour('PT') as Dictionnaire

  it('est écrit en portugais du Portugal', () => {
    for (const [origine, texte] of textesAffiches(dico)) {
      const cle = ` ${normaliser(texte)} `
      expect(BRESILIANISMES.filter((mot) => cle.includes(` ${mot} `)), origine).toEqual([])
    }
  })

  // Demande du propriétaire (14/11/2026) : « Infiltração fachada, il met ça comme mot-clé et ça lui sort la liste des
  // matériaux à utiliser » ; « les silicones doivent être rangés par catégories, les spatules » aussi.
  it('répond à l’exemple du propriétaire : « infiltracao fachada » sort la fiche et sa liste de matériaux', () => {
    for (const saisie of ['Infiltração fachada', 'infiltracao fachada', 'infiltraçao na fachada']) {
      expect(rechercher(dico, saisie).situations[0]?.element.id, saisie).toBe('infiltracao-fachada')
    }
    const fiche = dico.situations.find((s) => s.id === 'infiltracao-fachada')
    expect(fiche?.titre).toBe('Infiltração em fachada')
    const lignes = (fiche?.etapes ?? []).flatMap((e) => e.materiaux)
    expect(lignes.length).toBeGreaterThanOrEqual(8)
    expect(fiche?.aVerifier.length).toBeGreaterThan(0)
  })

  it('range les silicones et les espátulas par catégories', () => {
    const sousFamilles = (id: string) => dico.familles.find((f) => f.id === id)?.sousFamilles.map((sf) => sf.id) ?? []
    const silicones = sousFamilles('silicones-mastiques')
    const espatulas = sousFamilles('espatulas-talochas')
    expect(silicones.length).toBeGreaterThanOrEqual(8)
    expect(espatulas.length).toBeGreaterThanOrEqual(8)
    for (const id of ['silicone-sanitario', 'silicone-neutro', 'silicone-acetico', 'mastique-acrilico', 'espumas-poliuretano']) expect(silicones, id).toContain(id)
    for (const id of ['espatulas-de-pintor', 'espatulas-talochas-dentadas', 'espatulas-silicone', 'colheres-pedreiro-estucador']) expect(espatulas, id).toContain(id)
    // Chaque catégorie de silicone a ses produits, et la recherche les ramène.
    expect(dico.materiaux.filter((m) => m.famille === 'silicones-mastiques').length).toBeGreaterThanOrEqual(30)
    expect(dico.materiaux.filter((m) => m.famille === 'espatulas-talochas').length).toBeGreaterThanOrEqual(30)
    expect(rechercher(dico, 'silicone').materiaux.length).toBeGreaterThanOrEqual(8)
    expect(rechercher(dico, 'espatula').materiaux.length).toBeGreaterThanOrEqual(8)
  })

  it('trouve un matériau avec la taille tapée, sans écarter ceux d’une autre taille', () => {
    const ids = (saisie: string) => rechercher(dico, saisie).materiaux.map((r) => r.element.id)
    const brocas = dico.materiaux.filter((m) => normaliser(m.nom).startsWith('broca ')).map((m) => m.id)
    expect(brocas.length).toBeGreaterThanOrEqual(5)
    // « brocas 6 mm » : toutes les brocas d'abord, quelle que soit leur taille ; pas les talochas « de 6 mm ».
    const resultats = ids('brocas 6 mm')
    expect([...resultats.slice(0, brocas.length)].sort((a, b) => a.localeCompare(b))).toEqual([...brocas].sort((a, b) => a.localeCompare(b)))
    expect(resultats).not.toContain('talocha-dentada-6mm')
    // « silicone 280 ml » : des silicones en cartouche, pas les chevilles chimiques vendues dans la même contenance.
    const silicones = rechercher(dico, 'silicone 280 ml').materiaux.map((r) => r.element)
    expect(normaliser(silicones[0]?.nom ?? '')).toMatch(/^silicone /)
    expect(silicones[0]?.conditionnement).toContain('280')
    expect(silicones.map((m) => m.id).filter((id) => id.startsWith('bucha-quimica'))).toEqual([])
    // Collée ou non, une contenance se lit pareil : « tinta 15l » comme « tinta 15 l », « fita 50m » comme « fita 50 m ».
    expect(ids('tinta 15l')).toEqual(ids('tinta 15 l'))
    expect(ids('tinta 15l')[0]).toMatch(/^tinta-/)
    expect(ids('fita 50m')).toEqual(ids('fita 50 m'))
  })

  it('trouve la lã sans la prendre pour un mot vide', () => {
    const ids = (saisie: string) => rechercher(dico, saisie).materiaux.map((r) => r.element.id)
    expect(ids('lã de aço')[0]).toBe('la-de-aco')
    // La lã de rocha est une lã mineral : le panneau la porte parmi ses autres noms (constat de la contre-relecture).
    expect(ids('lã de rocha')[0]).toBe('la-mineral-painel')
    expect(ids('la mineral').slice(0, 2).sort((a, b) => a.localeCompare(b))).toEqual(['la-mineral-painel', 'la-mineral-rolo'])
    expect(ids('lã').slice(0, 3).sort((a, b) => a.localeCompare(b))).toEqual(['la-de-aco', 'la-mineral-painel', 'la-mineral-rolo'])
  })

  it('est à l’échelle d’un vrai dictionnaire, avec des matériaux faciles à trouver', () => {
    expect(dico.materiaux.length).toBeGreaterThanOrEqual(500)
    expect(dico.familles.length).toBeGreaterThanOrEqual(15)
    expect(dico.situations.length).toBeGreaterThanOrEqual(80)
    expect(dico.domaines.length).toBeGreaterThanOrEqual(10)
    // La grande majorité des matériaux est prouvée dans les deux enseignes.
    const dansLesDeux = dico.materiaux.filter((m) => m.enseignes.length === 2).length
    expect(dansLesDeux / dico.materiaux.length).toBeGreaterThan(0.8)
    // Aucun matériau orphelin : chacun sert dans une fiche ou se trouve en feuilletant sa catégorie.
    expect(dico.materiaux.every((m) => dico.familles.some((f) => f.id === m.famille))).toBe(true)
  })

  it('ne propose que Leroy Merlin et Maxmat, par leur page de recherche', () => {
    expect(dico.enseignes.map((e) => e.nom)).toEqual(['Leroy Merlin', 'Maxmat'])
    const [leroyMerlin, maxmat] = dico.enseignes
    expect(leroyMerlin.lienRecherche(' silicone sanitário ')).toBe('https://www.leroymerlin.pt/search?q=silicone%20sanit%C3%A1rio')
    // Maxmat : le panneau de recherche s'ouvre sur la page d'accueil quand l'adresse porte « term » (vérifié dans un
    // navigateur le 15/11/2026 ; la page /pt/pesquisa_36.html du formulaire, elle, est vide).
    expect(maxmat.lienRecherche('espátula dentada')).toBe('https://www.maxmat.pt/pt/?term=esp%C3%A1tula%20dentada')
    expect(maxmat.lienRecherche('x')).not.toContain('pesquisa_36')
    // Un terme ne peut pas sortir de l'adresse de recherche.
    expect(leroyMerlin.lienRecherche('a&b=c#d')).toBe('https://www.leroymerlin.pt/search?q=a%26b%3Dc%23d')
  })

  it('ouvre la recherche de chaque enseigne avec le terme qui y ramène des produits', () => {
    const [leroyMerlin, maxmat] = dico.enseignes
    const materiau = { recherche: 'hidrófugo argamassa', rechercheEnseigne: { 'leroy-merlin': 'aditivos hidrófugos' } }
    expect(termeDeRecherche(materiau, 'leroy-merlin')).toBe('aditivos hidrófugos')
    expect(termeDeRecherche(materiau, 'maxmat')).toBe('hidrófugo argamassa')
    expect(lienVersEnseigne(leroyMerlin, materiau)).toBe('https://www.leroymerlin.pt/search?q=aditivos%20hidr%C3%B3fugos')
    expect(lienVersEnseigne(maxmat, materiau)).toBe('https://www.maxmat.pt/pt/?term=hidr%C3%B3fugo%20argamassa')
    // Un terme propre vide ne remplace rien.
    expect(termeDeRecherche({ recherche: 'cimento cola', rechercheEnseigne: { maxmat: '  ' } }, 'maxmat')).toBe('cimento cola')
  })
})
