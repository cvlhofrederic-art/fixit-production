// ── Sanitisation HTML sécurisée pour le rendu markdown ───────────────────────
// Utilisé dans tous les dangerouslySetInnerHTML du projet
// Double couche : escape manuel + liste blanche de tags comme filet de sécurité

// Tags autorisés générés par notre convertisseur markdown
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h2', 'h3', 'h4',
  'strong', 'em', 'code',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
])

/**
 * Sanitize HTML by stripping disallowed tags.
 * Used as a final safety net after our markdown conversion.
 * No jsdom/DOMPurify — works server + client without ESM issues.
 */
export function purifyHTML(html: string): string {
  // Strip any tag not in the allowlist, then remove dangerous attributes on allowed tags
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (match, tag, attrs) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return ''
    if (!attrs) return match
    // F04: strip event handlers (onclick, onerror, etc.) and javascript: hrefs
    const safeAttrs = attrs
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      .replace(/\s+href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
      .replace(/\s+src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
    return `<${match.startsWith('</') ? '/' : ''}${tag}${safeAttrs}>`
  })
}

// ── Sanitisation SVG (signatures manuscrites devis / missions) ───────────────
// Les signatures sont des SVG vectoriels simples (tracés <path>). Allowlist stricte
// tags + attributs. SÉCURITÉ : href / xlink:href ne sont JAMAIS autorisés (inutiles
// pour une signature) → ferme tout vecteur javascript:/data: même encodé en entités.
// script/foreignObject/style/animate/use/image et handlers on* sont retirés.
const ALLOWED_SVG_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'title', 'desc',
])
const ALLOWED_SVG_ATTRS = new Set([
  'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-opacity', 'fill-opacity', 'opacity',
  'viewbox', 'xmlns', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'class', 'id',
  'font-family', 'font-size', 'text-anchor', 'dominant-baseline',
])

/**
 * Sanitize un SVG de signature avant stockage (anti stored-XSS).
 * Pur-regex (compatible Cloudflare Workers, sans DOM). Retourne '' si vide ou > 50 ko.
 */
export function sanitizeSvg(raw: string): string {
  if (!raw) return ''
  if (raw.length > 50000) return ''

  let svg = raw
  // Chaque suppression est appliquée jusqu'à POINT FIXE via l'idiome `while (s !== (s = s.replace(re,'')))`
  // (forme reconnue par CodeQL js/incomplete-multi-character-sanitization) : retirer un motif
  // multi-caractères en une passe peut en reconstruire un (« <!--<!-- -->--> », « <scr<script></script>ipt> »).
  while (svg !== (svg = svg.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, ''))) { /* fixpoint CDATA */ }
  while (svg !== (svg = svg.replace(/<!--[\s\S]*?-->/g, ''))) { /* fixpoint commentaires */ }
  while (svg !== (svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, ''))) { /* fixpoint doctype */ }
  while (svg !== (svg = svg.replace(/<\?xml[\s\S]*?\?>/gi, ''))) { /* fixpoint xml */ }
  const forbiddenBlocks = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'style', 'animate', 'animateTransform', 'animateMotion', 'set', 'use', 'image']
  for (const tag of forbiddenBlocks) {
    const reBlock = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi')
    const reSelf = new RegExp(`<${tag}\\b[^>]*/?>`, 'gi')
    while (svg !== (svg = svg.replace(reBlock, ''))) { /* fixpoint bloc */ }
    while (svg !== (svg = svg.replace(reSelf, ''))) { /* fixpoint self-closing */ }
  }

  // Passe allowlist (tags + attributs), elle aussi jusqu'à point fixe.
  const filterTags = (input: string): string =>
    input.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (match, rawTag, rawAttrs) => {
      const tag = rawTag.toLowerCase()
      if (!ALLOWED_SVG_TAGS.has(tag)) return ''
      if (match.startsWith('</')) return `</${tag}>`

      const cleanAttrs: string[] = []
      const attrRe = /([a-zA-Z:][a-zA-Z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      let m: RegExpExecArray | null
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const origName = m[1]
        const name = origName.toLowerCase()
        const value = m[2] ?? m[3] ?? m[4] ?? ''
        if (name.startsWith('on')) continue                    // jamais de handlers d'événements
        if (name === 'href' || name === 'xlink:href') continue // jamais de href (vecteur XSS)
        if (name === 'style') continue                         // style retiré par sécurité
        if (!ALLOWED_SVG_ATTRS.has(name)) continue
        cleanAttrs.push(`${origName}="${value.replace(/"/g, '&quot;')}"`) // casse préservée (viewBox)
      }

      const selfClosing = rawAttrs.trim().endsWith('/')
      return `<${tag}${cleanAttrs.length ? ' ' + cleanAttrs.join(' ') : ''}${selfClosing ? ' /' : ''}>`
    })
  while (svg !== (svg = filterTags(svg))) { /* fixpoint allowlist */ }
  return svg
}

/**
 * Échappe les caractères HTML dangereux AVANT de traiter le markdown
 * Prévient les injections XSS via les balises dans le contenu IA ou utilisateur
 */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Sanitize user input for safe storage/display.
 * Strips all HTML tags and limits length.
 */
export function sanitizeInput(input: string, maxLength = 5000): string {
  if (!input) return ''
  // Strip all HTML tags
  const stripped = input.replace(/<[^>]*>/g, '')
  // Trim and limit length
  return stripped.trim().slice(0, maxLength)
}

/**
 * Convertit le markdown en HTML sécurisé.
 * L'entrée est d'abord échappée, PUIS les marqueurs markdown sont convertis.
 * Enfin, DOMPurify nettoie le résultat comme filet de sécurité.
 * Aucun HTML arbitraire ne peut traverser.
 */
export function safeMarkdownToHTML(content: string): string {
  if (!content) return ''

  // Guard anti-ReDoS : limiter la taille du contenu
  if (content.length > 50000) return '<p>Contenu trop long</p>'

  // 1. Échapper TOUT le HTML d'abord (XSS prevention)
  let html = escapeHTML(content)

  // 2. Tableaux markdown (après échappement, | et - sont safe)
  // Note : .+? (lazy) pour éviter les ReDoS sur des inputs crafted
  html = html.replace(
    /\|(.+?)\|\n\|[-|: ]+\|\n((?:\|.+?\|\n?)*)/g,
    (_match: string, header: string, rows: string) => {
      const ths = header.split('|').filter((c: string) => c.trim())
        .map((c: string) => `<th class="px-2 py-1.5 border border-gray-200 bg-gray-100 font-semibold text-xs text-left">${c.trim()}</th>`)
        .join('')
      const trs = rows.trim().split('\n').map((row: string) => {
        const tds = row.split('|').filter((c: string) => c.trim())
          .map((c: string) => `<td class="px-2 py-1.5 border border-gray-200 text-xs">${c.trim()}</td>`)
          .join('')
        return `<tr class="hover:bg-gray-50">${tds}</tr>`
      }).join('')
      return `<div class="overflow-x-auto my-3"><table class="border-collapse w-full text-xs"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
    }
  )

  // 3. Titres (# échappés deviennent &#35; — on travaille sur le texte échappé)
  // Note : après escapeHTML, les # restent tels quels (pas un caractère spécial HTML)
  html = html
    .replace(/^### (.+)$/gm, '<h4 class="font-bold text-gray-900 mt-3 mb-1 text-sm">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-gray-900 mt-4 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-gray-900 mt-4 mb-2 text-base">$1</h2>')

  // 4. Gras et italique
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')

  // 5. Code inline
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-100 border border-gray-200 px-1 py-0.5 rounded text-xs font-mono text-purple-700">$1</code>'
  )

  // 6. Listes
  html = html
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc text-sm py-0.5">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm py-0.5">$2</li>')
    // Wrapper les séquences de <li> dans <ul>/<ol>
    .replace(/((?:<li class="ml-4 list-disc[^"]*"[^>]*>.*?<\/li>\n?)+)/g, '<ul class="my-2 space-y-0.5">$1</ul>')
    .replace(/((?:<li class="ml-4 list-decimal[^"]*"[^>]*>.*?<\/li>\n?)+)/g, '<ol class="my-2 space-y-0.5">$1</ol>')

  // 7. Séparateurs horizontaux
  html = html.replace(/^---+$/gm, '<hr class="my-3 border-gray-200" />')

  // 8. Sauts de ligne → <br> (mais pas après les blocs)
  html = html
    .replace(/\n\n/g, '</p><p class="mt-2 text-sm leading-relaxed">')
    .replace(/\n/g, '<br />')

  const result = `<p class="text-sm leading-relaxed">${html}</p>`

  // 9. DOMPurify comme filet de sécurité final (client-side uniquement)
  return purifyHTML(result)
}
