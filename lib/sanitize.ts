// ── Sanitisation HTML sécurisée pour le rendu markdown ───────────────────────
// Utilisé dans tous les dangerouslySetInnerHTML du projet

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
 * Convertit le markdown en HTML sécurisé.
 * L'entrée est d'abord échappée, PUIS les marqueurs markdown sont convertis.
 * Aucun HTML arbitraire ne peut traverser.
 */
export function safeMarkdownToHTML(content: string): string {
  if (!content) return ''

  // 1. Échapper TOUT le HTML d'abord (XSS prevention)
  let html = escapeHTML(content)

  // 2. Tableaux markdown (après échappement, | et - sont safe)
  html = html.replace(
    /\|(.+)\|\n\|[-|: ]+\|\n((?:\|.+\|\n?)*)/g,
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

  return `<p class="text-sm leading-relaxed">${html}</p>`
}
