import { Fragment, type CSSProperties, type ReactNode } from 'react'

// Rendu des réponses des agents IA (Claude écrit en Markdown).
//
// Sous-ensemble volontairement réduit : titres, gras, italique, code en ligne,
// listes à puces ou numérotées, tableaux simples, séparateurs, liens http(s).
// Tout est rendu en éléments React : aucun HTML venant du modèle n'est injecté
// (pas de dangerouslySetInnerHTML). Les styles sont minimaux et héritent de la
// couleur et de la police de la bulle, pour s'intégrer dans le Syndic v54,
// l'espace Copropriétaire et l'Administrateur judiciaire.

const BORDURE = '1px solid rgba(127, 127, 127, 0.35)'
const S: Record<string, CSSProperties> = {
  p: { margin: '0 0 8px' },
  titre: { margin: '10px 0 4px', fontSize: '1em', fontWeight: 700, lineHeight: 1.35 },
  liste: { margin: '0 0 8px', paddingLeft: 20 },
  item: { margin: '2px 0' },
  code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em', padding: '0 3px', borderRadius: 3, background: 'rgba(127, 127, 127, 0.15)' },
  tableau: { overflowX: 'auto', margin: '0 0 8px' },
  table: { borderCollapse: 'collapse', fontSize: '0.95em' },
  cellule: { border: BORDURE, padding: '4px 8px', textAlign: 'left', verticalAlign: 'top' },
  hr: { border: 0, borderTop: BORDURE, margin: '10px 0' },
}

type Bloc =
  | { type: 'p'; lignes: string[] }
  | { type: 'titre'; niveau: number; texte: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; entete: string[]; lignes: string[][] }
  | { type: 'hr' }

const RE_TITRE = /^(#{1,6})\s+(.*)$/
const RE_PUCE = /^\s*[-*•]\s+(.*)$/
const RE_NUMERO = /^\s*\d+[.)]\s+(.*)$/
const RE_SEPARATEUR_TABLE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/

function cellules(ligne: string): string[] {
  return ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

/** Découpe le texte en blocs. Exporté pour les tests. */
export function decouperBlocs(texte: string): Bloc[] {
  const lignes = texte.replace(/\r\n?/g, '\n').split('\n')
  const blocs: Bloc[] = []
  let i = 0
  while (i < lignes.length) {
    const ligne = lignes[i]
    if (!ligne.trim()) { i++; continue }

    const titre = RE_TITRE.exec(ligne)
    if (titre) {
      blocs.push({ type: 'titre', niveau: titre[1].length, texte: titre[2].replace(/#+\s*$/, '').trim() })
      i++
      continue
    }
    if (RE_HR.test(ligne)) { blocs.push({ type: 'hr' }); i++; continue }

    if (ligne.trim().startsWith('|') && i + 1 < lignes.length && RE_SEPARATEUR_TABLE.test(lignes[i + 1])) {
      const entete = cellules(ligne)
      const corps: string[][] = []
      i += 2
      while (i < lignes.length && lignes[i].trim().startsWith('|')) corps.push(cellules(lignes[i++]))
      blocs.push({ type: 'table', entete, lignes: corps })
      continue
    }

    const puce = RE_PUCE.exec(ligne)
    const numero = RE_NUMERO.exec(ligne)
    if (puce || numero) {
      const type = puce ? 'ul' : 'ol'
      const re = puce ? RE_PUCE : RE_NUMERO
      const items: string[] = []
      while (i < lignes.length) {
        const m = re.exec(lignes[i])
        if (m) { items.push(m[1]); i++; continue }
        // Ligne de continuation indentée : rattachée à l'élément précédent.
        if (lignes[i].trim() && /^\s{2,}/.test(lignes[i]) && items.length) { items[items.length - 1] += ' ' + lignes[i].trim(); i++; continue }
        break
      }
      blocs.push({ type, items })
      continue
    }

    const para: string[] = []
    while (
      i < lignes.length && lignes[i].trim() &&
      !RE_TITRE.test(lignes[i]) && !RE_HR.test(lignes[i]) && !RE_PUCE.test(lignes[i]) && !RE_NUMERO.test(lignes[i]) &&
      !(lignes[i].trim().startsWith('|') && i + 1 < lignes.length && RE_SEPARATEUR_TABLE.test(lignes[i + 1]))
    ) para.push(lignes[i++])
    blocs.push({ type: 'p', lignes: para })
  }
  return blocs
}

// Gras, italique, code, liens — dans cet ordre de priorité.
const RE_EN_LIGNE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

/** Rendu des marqueurs en ligne. Exporté pour les tests. */
export function enLigne(texte: string): ReactNode[] {
  const sortie: ReactNode[] = []
  let dernier = 0
  let n = 0
  for (const m of texte.matchAll(RE_EN_LIGNE)) {
    const debut = m.index ?? 0
    if (debut > dernier) sortie.push(texte.slice(dernier, debut))
    const brut = m[0]
    if (m[1]) sortie.push(<code key={n++} style={S.code}>{brut.slice(1, -1)}</code>)
    else if (m[2]) sortie.push(<strong key={n++}>{enLigne(brut.slice(2, -2))}</strong>)
    else if (m[3]) sortie.push(<em key={n++}>{enLigne(brut.slice(1, -1))}</em>)
    else {
      const lien = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(brut)
      sortie.push(lien
        ? <a key={n++} href={lien[2]} target="_blank" rel="noopener noreferrer">{lien[1]}</a>
        : brut)
    }
    dernier = debut + brut.length
  }
  if (dernier < texte.length) sortie.push(texte.slice(dernier))
  return sortie
}

export default function MarkdownIA({ texte }: Readonly<{ texte: string }>) {
  const blocs = decouperBlocs(texte)
  return (
    <>
      {blocs.map((b, k) => {
        // Le dernier bloc ne garde pas de marge basse (bulle compacte).
        const fin = k === blocs.length - 1 ? { marginBottom: 0 } : undefined
        switch (b.type) {
          case 'titre':
            return <p key={k} role="heading" aria-level={Math.min(b.niveau + 2, 6)} style={{ ...S.titre, ...fin }}>{enLigne(b.texte)}</p>
          case 'hr':
            return <hr key={k} style={S.hr} />
          case 'ul':
          case 'ol': {
            const Liste = b.type
            return (
              <Liste key={k} style={{ ...S.liste, listStyleType: b.type === 'ol' ? 'decimal' : 'disc', ...fin }}>
                {b.items.map((item, j) => <li key={j} style={S.item}>{enLigne(item)}</li>)}
              </Liste>
            )
          }
          case 'table':
            return (
              <div key={k} style={{ ...S.tableau, ...fin }}>
                <table style={S.table}>
                  <thead><tr>{b.entete.map((c, j) => <th key={j} style={S.cellule}>{enLigne(c)}</th>)}</tr></thead>
                  <tbody>
                    {b.lignes.map((l, j) => (
                      <tr key={j}>{l.map((c, x) => <td key={x} style={S.cellule}>{enLigne(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return (
              <p key={k} style={{ ...S.p, ...fin }}>
                {b.lignes.map((l, j) => (
                  <Fragment key={j}>{j > 0 && <br />}{enLigne(l)}</Fragment>
                ))}
              </p>
            )
        }
      })}
    </>
  )
}
