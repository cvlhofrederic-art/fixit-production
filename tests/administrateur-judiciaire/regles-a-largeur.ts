/**
 * jsdom n'évalue pas les requêtes de largeur : les tests de feuilles de style chargent une feuille « à une largeur
 * donnée », ses blocs @media dépliés quand ils valent et retirés sinon. Une requête autre qu'une largeur (forced-colors,
 * prefers-reduced-motion…) est retirée.
 */

/**
 * Vrai si la requête (« (min-width: 1025px) and (max-width: 1919px) ») vaut pour cette largeur de fenêtre. Le texte vient
 * de CSSMediaRule.media.mediaText, que le navigateur écrit avec une seule espace autour de « and » ; chaque condition est
 * rognée avant d'être lue.
 */
export function requeteVraie(requete: string, largeur: number): boolean {
  return requete.split(/\sand\s/).every((condition) => {
    const borne = /^\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)$/.exec(condition.trim())
    if (!borne) return false
    return borne[1] === 'min' ? largeur >= Number(borne[2]) : largeur <= Number(borne[2])
  })
}

/** Texte des règles appliquées à cette largeur : blocs @media dépliés quand ils valent, retirés sinon. */
export function reglesALargeur(regles: CSSRuleList, largeur: number): string {
  return Array.from(regles, (regle) => {
    if (!(regle instanceof CSSMediaRule)) return regle.cssText
    return requeteVraie(regle.media.mediaText, largeur) ? reglesALargeur(regle.cssRules, largeur) : ''
  }).join('\n')
}
