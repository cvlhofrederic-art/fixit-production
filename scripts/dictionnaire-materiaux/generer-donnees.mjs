// Écrit les données d'un pays du Dictionnaire matériaux (lib/dictionnaire-materiaux/donnees/<pays>/) à partir
// de deux fichiers JSON relus : le catalogue (familles, sous-familles, matériaux avec leurs preuves en
// magasin) et les situations (par domaine). Les données sortent en JSON, une famille ou un domaine par
// fichier, plus un index.ts qui les assemble ; ce script sert à (re)partir d'un catalogue complet. Sans ligne « #! » :
// les tests importent ce fichier, et Vitest ne la lit pas dans une copie de travail en CRLF (Windows).
//
//   node scripts/dictionnaire-materiaux/generer-donnees.mjs \
//     --pays pt --catalogue catalogue.json --situations situations.json --date 2026-11-14
//
// catalogue.json  : { "familles": [{ id, nom, description, sousFamilles: [{ id, nom, description }],
//                     materiaux: [{ id, sousFamille, nom, aussiAppele, usage, aSavoir, conditionnement,
//                                   recherche, rechercheEnseigne?: { <enseigne>: terme },
//                                   enseignesSansLien?: [<enseigne>],
//                                   preuves: [{ enseigne, url, titre }] }] }] }
// situations.json : { "domaines": [{ id, nom, situations: [{ id, titre, motsCles, description, aVerifier,
//                     etapes: [{ titre, materiaux: [{ id, note, optionnel }] }], attention }] }] }
//
// Le script refuse d'écrire si un identifiant est en double ou mal formé, si une situation cite un matériau
// absent du catalogue, ou si une preuve ne pointe pas vers le site de son enseigne.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const PAYS = {
  pt: {
    code: 'PT',
    langue: 'pt',
    constante: 'DICTIONNAIRE_PT',
    domaines: { 'leroy-merlin': 'leroymerlin.pt', maxmat: 'maxmat.pt' },
  },
}

const ICONES_FAMILLES = {
  'silicones-mastiques': '🧴',
  'espatulas-talochas': '🪛',
  'ferramentas-pintura': '🖌️',
  'cimentos-argamassas': '🧱',
  'massas-reparacao': '🪣',
  impermeabilizacao: '💧',
  'primarios-tratamentos': '🧪',
  'tintas-vernizes': '🎨',
  'abrasivos-limpeza': '🧽',
  'ceramica-colas-juntas': '🟦',
  'pavimentos-acessorios': '🟫',
  canalizacao: '🚰',
  eletricidade: '⚡',
  fixacoes: '🔩',
  'pladur-isolamento': '🧶',
  'coberturas-caleiras': '🏠',
  'colas-adesivos': '🩹',
  'protecao-epi': '🦺',
  'ferramentas-gerais': '🧰',
}

const ICONES_DOMAINES = {
  fachadas: '🧱',
  coberturas: '🏠',
  'humidade-interior': '💧',
  'casas-de-banho-cozinhas': '🚿',
  canalizacao: '🚰',
  'paredes-tetos': '🪜',
  pavimentos: '🟫',
  'janelas-portas': '🪟',
  alvenaria: '🏗️',
  'madeira-metal': '🪵',
  eletricidade: '⚡',
  'pladur-isolamento': '🧶',
}

// Marques : un « autre nom » qui en contient une sert à la recherche (« sikaflex », « cola UHU ») mais n'est jamais
// affiché. Les noms devenus communs en portugais (pladur, esferovite, capoto, x-ato, velcro) restent affichés.
// Même liste que le contrôle de tests/dictionnaire-materiaux/donnees.test.ts.
export const MARQUES = [
  'sika', 'sikaflex', 'sikalatex', 'weber', 'weberpox', 'pattex', 'uhu', 'ceys', 'quilosa', 'soudal', 'rubson', 'bostik',
  'mapei', 'kerakoll', 'robbialac', 'dyrup', 'barbot', 'tintas cin', 'axton', 'luxens', 'dexter', 'fischer', 'bosch',
  'makita', 'knauf', 'secil', 'cimpor', 'isover', 'ursa', 'tesa', 'wd 40', 'wd40', 'loctite', 'xylazel', 'bondex',
  'hammerite', 'titanlux', 'geberit', 'grohe', 'roca', 'aguaplast', 'tangit', 'unecol', 'roofmate', 'wallmate',
  'styrofoam', 'onduline', 'teflon', 'x acto', 'nao mais pregos', 'super cola 3', 'toupret', 'dremel', 'karcher',
  'wolfcraft', 'stanley', 'v33',
]

function lireArguments() {
  const args = process.argv.slice(2)
  const valeur = (nom) => {
    const i = args.indexOf(`--${nom}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const pays = valeur('pays')
  const catalogue = valeur('catalogue')
  const situations = valeur('situations')
  const date = valeur('date')
  if (!pays || !PAYS[pays] || !catalogue || !situations || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error('Usage : generer-donnees.mjs --pays pt --catalogue <json> --situations <json> --date AAAA-MM-JJ')
    process.exit(2)
  }
  return { pays, catalogue, situations, date }
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Familles et domaines deviennent des noms de variables dans index.ts : une lettre en tête.
const KEBAB_IDENTIFIANT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const erreurs = []
const signaler = (message) => erreurs.push(message)

const texte = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const liste = (v) => (Array.isArray(v) ? v.map(texte).filter(Boolean) : [])

/** Forme de comparaison : sans accents, sans ponctuation, en minuscules (comme la recherche du dictionnaire). */
const formeComparee = (v) => texte(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Vrai si le texte contient une marque, mot entier (« ç » lu « ss » : « roça » n'est pas Roca). */
export function contientMarque(valeur) {
  const cle = ` ${formeComparee(String(valeur).replace(/ç/gi, 'ss'))} `
  return MARQUES.some((marque) => cle.includes(` ${marque} `))
}

/**
 * Autres noms d'un matériau, sans doublon (« tira-silicone » et « tira silicone ») ni répétition du nom, partagés
 * entre ceux qu'on affiche et ceux qui ne servent qu'à la recherche (une marque).
 */
function autresNoms(v, nom) {
  const vus = new Set([formeComparee(nom)])
  const affiches = []
  const cherches = []
  for (const alias of liste(v)) {
    const forme = formeComparee(alias)
    if (!forme || vus.has(forme)) continue
    vus.add(forme)
    if (contientMarque(alias)) cherches.push(alias)
    else affiches.push(alias)
  }
  return { affiches, cherches }
}

function hoteDe(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function preparerCatalogue(brut, config) {
  const familles = []
  const materiaux = []
  const preuves = {}
  const sansLien = {}
  const idsMateriaux = new Set()
  const idsFamilles = new Set()
  for (const f of brut.familles ?? []) {
    if (!KEBAB_IDENTIFIANT.test(f.id ?? '')) signaler(`famille : identifiant invalide « ${f.id} » (kebab-case, une lettre en tête)`)
    if (idsFamilles.has(f.id)) signaler(`famille en double : ${f.id}`)
    idsFamilles.add(f.id)
    const sousFamilles = (f.sousFamilles ?? []).map((sf) => ({ id: sf.id, nom: texte(sf.nom), description: texte(sf.description) }))
    const idsSousFamilles = new Set()
    for (const sf of sousFamilles) {
      if (!KEBAB.test(sf.id ?? '')) signaler(`${f.id} : sous-famille à l'identifiant invalide « ${sf.id} »`)
      if (idsSousFamilles.has(sf.id)) signaler(`${f.id} : sous-famille en double « ${sf.id} »`)
      idsSousFamilles.add(sf.id)
      if (!sf.nom) signaler(`${f.id}/${sf.id} : nom vide`)
    }
    const duGroupe = []
    for (const m of f.materiaux ?? []) {
      if (!KEBAB.test(m.id ?? '')) signaler(`${f.id} : matériau à l'identifiant invalide « ${m.id} »`)
      if (idsMateriaux.has(m.id)) signaler(`matériau en double : ${m.id}`)
      idsMateriaux.add(m.id)
      if (!idsSousFamilles.has(m.sousFamille)) signaler(`${m.id} : sous-famille inconnue « ${m.sousFamille} »`)
      const enseignes = []
      const preuvesRetenues = []
      for (const p of m.preuves ?? []) {
        const domaine = config.domaines[p.enseigne]
        const hote = hoteDe(p.url)
        if (!domaine) signaler(`${m.id} : enseigne inconnue « ${p.enseigne} »`)
        else if (hote !== domaine && !hote.endsWith(`.${domaine}`)) signaler(`${m.id} : preuve hors du site de ${p.enseigne} (${p.url})`)
        else {
          if (!enseignes.includes(p.enseigne)) enseignes.push(p.enseigne)
          preuvesRetenues.push({ enseigne: p.enseigne, url: p.url, titre: texte(p.titre) })
        }
      }
      if (enseignes.length === 0) signaler(`${m.id} : aucune preuve en magasin`)
      // Enseigne où le produit existe mais où aucun terme générique ne le retrouve (nom de gamme) : preuve gardée,
      // pas de lien affiché.
      const sansLienIci = (m.enseignesSansLien ?? []).filter((e) => enseignes.includes(e))
      const affichees = enseignes.filter((e) => !sansLienIci.includes(e))
      if (enseignes.length > 0 && affichees.length === 0) signaler(`${m.id} : aucune enseigne avec un lien de recherche qui marche`)
      if (sansLienIci.length > 0) sansLien[m.id] = sansLienIci
      if (!texte(m.nom) || !texte(m.usage) || !texte(m.recherche)) signaler(`${m.id} : nom, usage ou terme de recherche vide`)
      for (const [champ, valeur] of [['nom', m.nom], ['usage', m.usage], ['aSavoir', m.aSavoir], ['conditionnement', m.conditionnement]]) {
        if (valeur && contientMarque(valeur)) signaler(`${m.id} : marque dans « ${champ} »`)
      }
      // Terme propre à une enseigne : seulement là où le matériau est prouvé, et s'il diffère du terme général.
      const termesPropres = {}
      for (const [enseigne, terme] of Object.entries(m.rechercheEnseigne ?? {})) {
        if (!config.domaines[enseigne]) signaler(`${m.id} : terme de recherche pour une enseigne inconnue « ${enseigne} »`)
        else if (affichees.includes(enseigne) && texte(terme) && texte(terme) !== texte(m.recherche)) termesPropres[enseigne] = texte(terme)
      }
      const { affiches, cherches } = autresNoms(m.aussiAppele, m.nom)
      preuves[m.id] = preuvesRetenues
      duGroupe.push({
        id: m.id,
        famille: f.id,
        sousFamille: m.sousFamille,
        nom: texte(m.nom),
        aussiAppele: affiches,
        aussiCherche: cherches.length > 0 ? cherches : undefined,
        usage: texte(m.usage),
        aSavoir: texte(m.aSavoir) || undefined,
        conditionnement: texte(m.conditionnement) || undefined,
        recherche: texte(m.recherche),
        rechercheEnseigne: Object.keys(termesPropres).length > 0 ? termesPropres : undefined,
        enseignes: Object.keys(config.domaines).filter((e) => affichees.includes(e)),
      })
    }
    // Une sous-famille sans matériau n'a rien à montrer.
    const utilisees = new Set(duGroupe.map((m) => m.sousFamille))
    familles.push({
      id: f.id,
      nom: texte(f.nom),
      description: texte(f.description),
      icone: ICONES_FAMILLES[f.id] ?? '📦',
      sousFamilles: sousFamilles.filter((sf) => utilisees.has(sf.id)),
    })
    materiaux.push({ famille: f.id, materiaux: duGroupe })
  }
  return { familles, materiaux, preuves, sansLien, idsMateriaux }
}

function preparerSituations(brut, idsMateriaux) {
  const domaines = []
  const idsSituations = new Set()
  const idsDomaines = new Set()
  for (const d of brut.domaines ?? []) {
    if (!KEBAB_IDENTIFIANT.test(d.id ?? '')) signaler(`domaine : identifiant invalide « ${d.id} » (kebab-case, une lettre en tête)`)
    if (idsDomaines.has(d.id)) signaler(`domaine en double : ${d.id}`)
    idsDomaines.add(d.id)
    const situations = []
    for (const s of d.situations ?? []) {
      if (!KEBAB.test(s.id ?? '')) signaler(`${d.id} : situation à l'identifiant invalide « ${s.id} »`)
      if (idsSituations.has(s.id)) signaler(`situation en double : ${s.id}`)
      idsSituations.add(s.id)
      const etapes = (s.etapes ?? [])
        .map((e) => ({
          titre: texte(e.titre),
          materiaux: (e.materiaux ?? []).map((l) => {
            if (!idsMateriaux.has(l.id)) signaler(`${s.id} : matériau absent du catalogue « ${l.id} »`)
            return { id: l.id, note: texte(l.note) || undefined, optionnel: l.optionnel === true ? true : undefined }
          }),
        }))
        .filter((e) => e.materiaux.length > 0)
      if (etapes.length === 0) signaler(`${s.id} : aucune étape avec matériaux`)
      if (!texte(s.titre) || !texte(s.description)) signaler(`${s.id} : titre ou description vide`)
      situations.push({
        id: s.id,
        domaine: d.id,
        titre: texte(s.titre),
        motsCles: liste(s.motsCles),
        description: texte(s.description),
        aVerifier: liste(s.aVerifier),
        etapes,
        attention: liste(s.attention),
      })
    }
    domaines.push({ domaine: { id: d.id, nom: texte(d.nom), icone: ICONES_DOMAINES[d.id] ?? '🔧' }, situations })
  }
  return domaines
}

const nomVariable = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

function ecrire(chemin, contenu) {
  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, contenu, 'utf8')
}

const json = (valeur) => `${JSON.stringify(valeur, null, 2)}\n`

/** Vide un dossier de données (anciens .ts compris) avant de le réécrire. */
function viderDossier(dossier) {
  mkdirSync(dossier, { recursive: true })
  for (const fichier of readdirSync(dossier)) {
    if (fichier.endsWith('.ts') || fichier.endsWith('.json')) rmSync(join(dossier, fichier))
  }
}

function main() {
  const args = lireArguments()
  const config = PAYS[args.pays]
  const catalogue = preparerCatalogue(JSON.parse(readFileSync(args.catalogue, 'utf8')), config)
  const domaines = preparerSituations(JSON.parse(readFileSync(args.situations, 'utf8')), catalogue.idsMateriaux)

  if (erreurs.length > 0) {
    console.error(`${erreurs.length} erreur(s), rien n'est écrit :`)
    for (const e of erreurs) console.error(`- ${e}`)
    process.exit(1)
  }

  const dossier = join(RACINE, 'lib', 'dictionnaire-materiaux', 'donnees', args.pays)

  viderDossier(join(dossier, 'familles'))
  for (const famille of catalogue.familles) {
    const materiaux = catalogue.materiaux.find((g) => g.famille === famille.id).materiaux
    ecrire(join(dossier, 'familles', `${famille.id}.json`), json({ famille, materiaux }))
  }

  viderDossier(join(dossier, 'situations'))
  for (const { domaine, situations } of domaines) {
    ecrire(join(dossier, 'situations', `${domaine.id}.json`), json({ domaine, situations }))
  }

  const importsFamilles = catalogue.familles.map((f) => `import ${nomVariable(f.id)} from './familles/${f.id}.json'`)
  const importsDomaines = domaines.map(({ domaine }) => `import ${nomVariable(`situations-${domaine.id}`)} from './situations/${domaine.id}.json'`)
  ecrire(
    join(dossier, 'index.ts'),
    `// Dictionnaire matériaux — ${config.code} — assemblage.\n` +
      `// Écrit par scripts/dictionnaire-materiaux/generer-donnees.mjs à partir du catalogue relu. Données en JSON, une\n` +
      `// famille ou un domaine par fichier : types de produits génériques, ni marque, ni prix, ni quantité. Preuves en\n` +
      `// magasin : preuves.json. Forme et contenu contrôlés par tests/dictionnaire-materiaux/donnees.test.ts.\n\n` +
      `import { enseignesDuPays } from '../../enseignes'\n` +
      `import type { Dictionnaire, DomaineSituations, FamilleMateriaux, Materiau, Situation } from '../../types'\n` +
      `${[...importsFamilles, ...importsDomaines].join('\n')}\n\n` +
      `interface FichierFamille { famille: FamilleMateriaux; materiaux: Materiau[] }\n` +
      `interface FichierDomaine { domaine: DomaineSituations; situations: Situation[] }\n\n` +
      `// TypeScript type le JSON au plus large (une enseigne y est une chaîne quelconque) : la forme exacte est vérifiée\n` +
      `// par les tests des données.\n` +
      `const FAMILLES = [${catalogue.familles.map((f) => nomVariable(f.id)).join(', ')}] as unknown as FichierFamille[]\n` +
      `const DOMAINES = [${domaines.map(({ domaine }) => nomVariable(`situations-${domaine.id}`)).join(', ')}] as unknown as FichierDomaine[]\n\n` +
      `export const ${config.constante}: Dictionnaire = {\n` +
      `  pays: '${config.code}',\n` +
      `  langue: '${config.langue}',\n` +
      `  verifieLe: '${args.date}',\n` +
      `  enseignes: enseignesDuPays('${config.code}'),\n` +
      `  familles: FAMILLES.map((f) => f.famille),\n` +
      `  materiaux: FAMILLES.flatMap((f) => f.materiaux),\n` +
      `  domaines: DOMAINES.map((d) => d.domaine),\n` +
      `  situations: DOMAINES.flatMap((d) => d.situations),\n` +
      `}\n`,
  )

  ecrire(join(dossier, 'preuves.json'), json({ verifieLe: args.date, sansLien: catalogue.sansLien, materiaux: catalogue.preuves }))

  const nbMateriaux = catalogue.materiaux.reduce((s, g) => s + g.materiaux.length, 0)
  const nbSituations = domaines.reduce((s, d) => s + d.situations.length, 0)
  const nbCherches = catalogue.materiaux.reduce((s, g) => s + g.materiaux.filter((m) => m.aussiCherche).length, 0)
  console.log(`${config.code} : ${catalogue.familles.length} familles, ${nbMateriaux} matériaux (${nbCherches} avec des noms de marque cherchés mais non affichés), ${domaines.length} domaines, ${nbSituations} situations écrits dans ${dossier}`)
}

// Exécuté seulement en ligne de commande : les tests importent MARQUES et contientMarque.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
