#!/usr/bin/env node
/**
 * Extraction des ressources statiques de la maquette « VitFix Syndic Judiciaire »
 * (fichier HTML autonome généré par Vite) vers la succursale Administrateur Judiciaire.
 *
 * Usage : node scripts/administrateur-judiciaire/extraire-maquette.mjs "<chemin maquette.html>"
 *
 * Produit :
 *   - public/fonts/administrateur-judiciaire/*.woff2          (polices embarquées en base64)
 *   - public/images/administrateur-judiciaire/agents/*.webp   (avatars des agents IA)
 *   - components/administrateur-judiciaire/styles/aj.css      (feuille de style scopée sous #aj-root)
 *
 * Le scoping préfixe chaque sélecteur par #aj-root pour que la feuille de la maquette
 * (qui stylait html, body, button, h1…) n'affecte jamais le reste du site.
 * Relancer le script à chaque nouvelle version de la maquette.
 */
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const SCOPE = '#aj-root'
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
// Outil de développement lancé à la main : le chemin est choisi par la personne qui lance le script, sur son propre
// poste (aucune entrée distante). Seul un fichier .html existant est accepté.
const source = process.argv[2] ? path.resolve(process.argv[2]) : ''
if (path.extname(source).toLowerCase() !== '.html' || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
  console.error('Chemin de la maquette HTML manquant, introuvable ou sans extension .html.')
  process.exit(1)
}
const html = fs.readFileSync(source, 'utf8') // NOSONAR (S8707) : chemin validé ci-dessus, outil local de développement
const version = (html.match(/version (v[\d._]+)/) || [])[1] || 'inconnue'

// ── Polices ────────────────────────────────────────────────────────────────
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
const dossierPolices = path.join(racine, 'public/fonts/administrateur-judiciaire')
fs.mkdirSync(dossierPolices, { recursive: true })
const facesPubliques = []
const cssSansPolices = css.replace(/@font-face\{([^}]*)\}/g, (_, corps) => {
  const famille = corps.match(/font-family:([^;]+)/)[1].trim().replace(/["']/g, '')
  const style = (corps.match(/font-style:([^;]+)/) || [, 'normal'])[1].trim()
  const graisse = (corps.match(/font-weight:([^;]+)/) || [, '400'])[1].trim()
  const b64 = corps.match(/url\(data:font\/woff2;base64,([^)]+)\)/)[1]
  const fichier = `${famille.toLowerCase().replace(/\s+/g, '-')}-${graisse}${style === 'italic' ? '-italic' : ''}.woff2`
  fs.writeFileSync(path.join(dossierPolices, fichier), Buffer.from(b64, 'base64'))
  facesPubliques.push(
    `@font-face{font-family:${famille};font-style:${style};font-display:swap;font-weight:${graisse};` +
      `src:url("/fonts/administrateur-judiciaire/${fichier}") format("woff2")}`,
  )
  return ''
})

// ── Avatars des agents IA ──────────────────────────────────────────────────
const dossierAvatars = path.join(racine, 'public/images/administrateur-judiciaire/agents')
fs.mkdirSync(dossierAvatars, { recursive: true })
const avatars = []
for (const m of html.matchAll(/(\w+):"data:image\/webp;base64,([A-Za-z0-9+/=]+)"/g)) {
  fs.writeFileSync(path.join(dossierAvatars, `${m[1]}.webp`), Buffer.from(m[2], 'base64'))
  avatars.push(m[1])
}

// ── Scoping CSS ────────────────────────────────────────────────────────────
function scoper(selecteur) {
  const s = selecteur.trim()
  if (s === ':root') return SCOPE
  if (s === '*') return `${SCOPE},${SCOPE} *`
  if (s === 'body') return SCOPE
  if (/^html\b/.test(s)) return s.replace(/^html/, `html:has(${SCOPE})`)
  if (/^body\b/.test(s)) return s.replace(/^body/, SCOPE)
  return `${SCOPE} ${s}`
}
const arbre = postcss.parse(cssSansPolices)
arbre.walkRules((regle) => {
  if (regle.parent && regle.parent.type === 'atrule' && /keyframes$/.test(regle.parent.name)) return
  regle.selectors = regle.selectors.map(scoper)
})
const entete = `/*
 * Feuille de style de la succursale Administrateur Judiciaire.
 * GÉNÉRÉE par scripts/administrateur-judiciaire/extraire-maquette.mjs depuis la maquette ${version}.
 * Ne pas éditer à la main : modifier la maquette puis relancer le script.
 * Tous les sélecteurs sont scopés sous ${SCOPE}.
 */
`
const fond = `body:has(${SCOPE}){margin:0;background:#FBF8F1}\n`
// La maquette reposait sur les styles par défaut du navigateur. Le site applique des styles globaux
// (reset Tailwind « preflight », globals.css : line-height des span/p/li/td, tables, focus, images…) :
// sous #aj-root, on revient aux styles du navigateur avant d'appliquer la feuille de la maquette.
// Spécificité (1,0,0) : bat toute règle globale du site, perd face à chaque règle de la maquette (≥ (1,0,1) ou
// placée après à égalité). Les SVG sont exclus de `all: revert`, qui écraserait leurs attributs de présentation
// (fill, stroke) ; seuls leurs affichage et alignement (modifiés par le reset Tailwind) sont rétablis.
const neutralisation =
  `${SCOPE} :where(*:not(svg, svg *)){all:revert}\n` +
  `${SCOPE} :where(*:not(svg, svg *))::before,${SCOPE} :where(*:not(svg, svg *))::after{all:revert}\n` +
  `${SCOPE} :where(*)::placeholder{all:revert}\n` +
  `${SCOPE} :where(*)::file-selector-button{all:revert}\n` +
  `${SCOPE} :where(svg){display:revert;vertical-align:revert}\n`
const sortie = path.join(racine, 'components/administrateur-judiciaire/styles/aj.css')
fs.mkdirSync(path.dirname(sortie), { recursive: true })
fs.writeFileSync(sortie, entete + facesPubliques.join('\n') + '\n' + fond + neutralisation + arbre.toString() + '\n')

console.log(`Maquette ${version}`)
console.log(`  polices : ${facesPubliques.length} -> public/fonts/administrateur-judiciaire/`)
console.log(`  avatars : ${avatars.join(', ')} -> public/images/administrateur-judiciaire/agents/`)
console.log(`  CSS     : ${fs.statSync(sortie).size} octets -> components/administrateur-judiciaire/styles/aj.css`)
