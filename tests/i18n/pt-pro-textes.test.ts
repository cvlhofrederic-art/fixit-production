// tests/i18n/pt-pro-textes.test.ts
//
// Garde du portugais du tableau de bord pro (/pt/pro/dashboard), après le rapport i18n PT-PT de Frédéric du 17/11/2026.
// On relève, dans les fichiers du tableau de bord, les textes de la branche portugaise (`isPt ? '…' : …`,
// `locale === 'pt' ? '…'`, `pt: '…'`, `labelPt: '…'`) et les valeurs `proDash.*` de locales/pt.json, et on refuse :
// - une espace avant « : », « ; », « ? », « ! » (typographie française) ;
// - un tiret cadratin ou demi-cadratin dans une phrase (seul « — » isolé, valeur vide, est admis) ;
// - un brésilianisme courant ;
// - un sigle ou un mot français (BTP, DC4, DPGF, DCE, SIRET, URSSAF, Kbis, TVA, HT, TTC, RDV, « devis », « chantier »…).
// Un texte qui doit rester tel quel s'ajoute à EXCEPTIONS avec sa raison.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RACINE = resolve(__dirname, '../..')

const CIBLES = [
  'components/dashboard',
  'components/marches',
  'components/chat/AiChatBot.tsx',
  'hooks/useModulesConfig.ts',
  'hooks/useModuleCategories.ts',
  'hooks/useNotifications.ts',
  'hooks/useDashboardMessaging.ts',
  'lib/permissions.ts',
  'lib/wallet-conformite-pt.ts',
  'lib/fiscalite-pt.ts',
  'lib/tva-thresholds.ts',
  'lib/rapport-pdf.ts',
  'lib/chat-parsers.ts',
  'lib/btp/accueil.ts',
  'lib/btp/fiche-chantier.ts',
  'lib/btp/pointage-regles.ts',
  'app/(commun)/pro/dashboard/page.tsx',
]

// Hors sujet ou sujets exclus par Frédéric (devis, factures, PDF) : relus à part.
const IGNORES = [
  /components\/dashboard\/documents\//,
  /components\/dashboard\/DevisSection\.tsx$/,
  /components\/dashboard\/FacturesSection\.tsx$/,
  /components\/dashboard\/btp\/RentabiliteDevisModal\.tsx$/,
  /components\/dashboard\/(ConciergerieSections|GestionnaireSections)\.tsx$/,
  /components\/dashboard\/DeclarationSocialeSection\.tsx$/, // plus importé nulle part
]

// Textes portugais admis malgré une règle, avec la raison.
const EXCEPTIONS: ReadonlyArray<{ fichier: RegExp; texte: RegExp; raison: string }> = []

const DEFAUTS: ReadonlyArray<[string, RegExp]> = [
  ['espace avant ponctuation', /\S[ \u00a0\u202f]+[:;!?](?=\s|$)/],
  ['tiret long dans une phrase', /\S\s*[—–]\s*\S|[—–]\s*\S|\S\s*[—–]/],
  // Bornes de mot Unicode (\b ne connaît que l'ASCII : « você », « dossiê » lui échappaient) ; majuscules comprises.
  ['brésilianisme', /(?<![\p{L}\p{N}_])(você|vocês|arquivo|celular|tela|usuário|usuários|equipe|registro|contato|salvar|baixar|cadastr\p{L}*|planilha|gerenciar|gerenciamento|aplicativo|excluir|deletar|econômic\p{L}*|dossiê)(?![\p{L}\p{N}_])|(^|[^Oo] )Meu perfil/iu],
  ['français', /\b(BTP|DC4|DPGF|DCE|SIRET|SIREN|URSSAF|Kbis|TVA|TTC|RDV|devis|chantier|chantiers|facture|votre|vos|Nouveau|Nouvelle|Aucun|Aucune|Chargement|Ajouter|Supprimer|Enregistrer|Télécharger|Créer|Rechercher)\b|\bHT\b/],
]

function fichiersCibles(): string[] {
  const liste: string[] = []
  const parcourir = (chemin: string) => {
    const absolu = join(RACINE, chemin)
    if (statSync(absolu).isDirectory()) {
      for (const nom of readdirSync(absolu)) parcourir(join(chemin, nom))
      return
    }
    const rel = relative(RACINE, absolu).split('\\').join('/')
    if (!/\.(tsx?|ts)$/.test(rel) || /\.test\./.test(rel)) return
    if (IGNORES.some(motif => motif.test(rel))) return
    liste.push(rel)
  }
  CIBLES.forEach(parcourir)
  return liste
}

// Retire les expressions `${…}` d'un gabarit (ternaires imbriqués, appels) : seul le texte fixe est contrôlé.
function texteFixe(gabarit: string): string {
  let sortie = ''
  let profondeur = 0
  for (let i = 0; i < gabarit.length; i++) {
    if (profondeur === 0 && gabarit[i] === '$' && gabarit[i + 1] === '{') { profondeur = 1; i++; sortie += '\u0000'; continue }
    if (profondeur > 0) {
      if (gabarit[i] === '{') profondeur++
      else if (gabarit[i] === '}') profondeur--
      continue
    }
    sortie += gabarit[i]
  }
  return sortie
}

const LITTERAL = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`(?:[^`\\\\]|\\\\.)*`'
const LITTERAL_G = new RegExp(LITTERAL, 'g')
// Condition « portugais » d'un ternaire : isPt, l'alias `pt` (AiChatBot), locale === 'pt'…
const CONDITION_PT = String.raw`(?:isPt|_isPt|estPt|(?<![\w.$])pt|locale\s*===\s*'pt'|lang\s*===\s*'pt')\s*\?(?!\?)\s*`
const MOTIFS_PT = [
  // isPt ? 'texte'
  new RegExp(CONDITION_PT + '(' + LITTERAL + ')', 'g'),
  // pt: 'texte', labelPt: 'texte', titrePt: 'texte'…
  new RegExp(String.raw`(?<![\w.$])(?:pt|[a-z]\w*Pt)\s*:\s*(` + LITTERAL + ')', 'g'),
]
// isPt ? ( … ) : ternaire imbriqué (« isPt ? (isBtp ? '…' : '…') ») ; isPt ? <>…</> : fragment JSX.
const GROUPE_PT = new RegExp(CONDITION_PT + '(?=[(<])', 'g')
// Ligne précédente (fin d'espaces retirée) terminée par la condition : le ternaire continue sur cette ligne.
const FIN_CONDITION_PT = /(?:isPt|(?<![\w.$])pt|=== 'pt')\)?$/
// Tables portugaises sur plusieurs lignes : `const X_PT = { … }` ou `[ … ]`, `pt: { … }` ou `[ … ]`.
const DEBUT_TABLE_PT = /(?:\bconst\s+[A-Z0-9_]+_PT\b[^=]*=|(?<![\w.$])pt\s*:)\s*([{[])/

interface Releve { fichier: string; ligne: number; defaut: string; texte: string }

/** La ligne sans son commentaire de fin (« // … » hors d'une chaîne). */
function sansCommentaire(ligne: string): string {
  let i = ligne.indexOf('//')
  while (i >= 0) {
    const avant = ligne.slice(0, i)
    const pair = (c: string) => avant.split(c).length % 2 === 1
    if (pair("'") && pair('"') && pair('`') && !avant.endsWith(':')) return avant
    i = ligne.indexOf('//', i + 2)
  }
  return ligne
}

/** Ce qui suit `debut` : groupe entre parenthèses (équilibré sur la ligne) ou fragment JSX jusqu'à sa fermeture. */
function groupe(ligne: string, debut: number): { litteraux: string[]; texteJsx: string } {
  if (ligne[debut] === '(') {
    let profondeur = 0
    let fin = ligne.length
    for (let i = debut; i < ligne.length; i++) {
      if (ligne[i] === '(') profondeur++
      else if (ligne[i] === ')' && --profondeur === 0) { fin = i; break }
    }
    // Les opérandes d'une comparaison (« d.docType === 'devis' ») sont des valeurs, pas du texte affiché.
    const dedans = ligne.slice(debut + 1, fin)
    const litteraux = [...dedans.matchAll(LITTERAL_G)]
      .filter(m => !/[=!]==?$/.test(dedans.slice(0, m.index).trimEnd()) && !/^[=!]==?/.test(dedans.slice((m.index ?? 0) + m[0].length).trimStart()))
      .map(m => m[0])
    return { litteraux, texteJsx: '' }
  }
  const balise = /^<([\w.]*)/.exec(ligne.slice(debut))?.[1] ?? ''
  const fermeture = balise ? `</${balise}>` : '</>'
  const finFragment = ligne.indexOf(fermeture, debut)
  const fragment = ligne.slice(debut, finFragment < 0 ? ligne.length : finFragment + fermeture.length)
  // Texte du fragment : expressions {…} et balises retirées ; les littéraux des expressions ({'>'}) sont examinés aussi.
  const litteraux = [...fragment.matchAll(/\{([^{}]*)\}/g)].flatMap(m => m[1].match(LITTERAL_G) ?? [])
  const texteJsx = fragment.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]*>/g, ' ')
  return { litteraux, texteJsx }
}

function relever(fichier: string): Releve[] {
  const lignes = readFileSync(join(RACINE, fichier), 'utf8').split(/\r?\n/)
  const releves: Releve[] = []
  const examinerTexte = (texte: string, ligne: number) => {
    for (const [defaut, motif] of DEFAUTS) {
      if (!motif.test(texte)) continue
      if (EXCEPTIONS.some(e => e.fichier.test(fichier) && e.texte.test(texte))) continue
      releves.push({ fichier, ligne, defaut, texte: texte.trim().slice(0, 120) })
    }
  }
  const examiner = (litteral: string, ligne: number) => {
    const brut = litteral.slice(1, -1)
    examinerTexte(litteral.startsWith('`') ? texteFixe(brut) : brut, ligne)
  }
  const examinerLigne = (ligne: string, numero: number) => {
    for (const motif of MOTIFS_PT) {
      for (const trouve of ligne.matchAll(motif)) examiner(trouve[1], numero)
    }
    for (const trouve of ligne.matchAll(GROUPE_PT)) {
      const { litteraux, texteJsx } = groupe(ligne, (trouve.index ?? 0) + trouve[0].length)
      litteraux.forEach(l => examiner(l, numero))
      if (texteJsx.trim()) examinerTexte(texteJsx, numero)
    }
  }

  let profondeurTable = 0
  lignes.forEach((brute, i) => {
    const debut = brute.trim()
    if (debut.startsWith('//') || debut.startsWith('*') || debut.startsWith('/*')) return
    const ligne = sansCommentaire(brute)

    // Dans une table portugaise : chaque valeur (un littéral qui n'est pas une clé « '…': ») est du texte portugais.
    const table = profondeurTable === 0 ? DEBUT_TABLE_PT.exec(ligne) : null
    if (profondeurTable > 0 || table) {
      const contenu = table ? ligne.slice((table.index ?? 0) + table[0].length - 1) : ligne
      for (const m of contenu.matchAll(LITTERAL_G)) {
        const apres = contenu.slice((m.index ?? 0) + m[0].length)
        if (!/^\s*:/.test(apres)) examiner(m[0], i + 1)
      }
      const sansTextes = contenu.replace(LITTERAL_G, '""')
      for (const c of sansTextes) {
        if (c === '{' || c === '[' || c === '(') profondeurTable++
        else if (c === '}' || c === ']' || c === ')') profondeurTable = Math.max(0, profondeurTable - 1)
      }
      return
    }

    if (i > 0 && /^\s*\?(?!\?)/.test(ligne) && FIN_CONDITION_PT.test(sansCommentaire(lignes[i - 1]).trimEnd())) {
      examinerLigne(`isPt ${ligne.trim()}`, i + 1)
      return
    }
    examinerLigne(ligne, i + 1)
  })
  return releves
}

describe('portugais du tableau de bord pro : branches PT du code', () => {
  const fichiers = fichiersCibles()

  it('les fichiers du tableau de bord sont bien trouvés', () => {
    expect(fichiers.length).toBeGreaterThan(40)
    expect(fichiers).toContain('components/dashboard/V5Sidebar.tsx')
  })

  it('aucun texte portugais fautif', () => {
    const releves = fichiers.flatMap(relever)
    expect(releves.map(r => `${r.fichier}:${r.ligne} [${r.defaut}] ${r.texte}`)).toEqual([])
  })
})

describe('portugais du tableau de bord pro : locales/pt.json', () => {
  it('aucune valeur proDash.* fautive', () => {
    const pt = JSON.parse(readFileSync(join(RACINE, 'locales/pt.json'), 'utf8')) as Record<string, unknown>
    const fautes: string[] = []
    const parcourir = (noeud: unknown, chemin: string) => {
      if (typeof noeud === 'string') {
        for (const [defaut, motif] of DEFAUTS) if (motif.test(noeud)) fautes.push(`${chemin} [${defaut}] ${noeud.slice(0, 100)}`)
        return
      }
      if (noeud && typeof noeud === 'object') for (const [cle, valeur] of Object.entries(noeud)) parcourir(valeur, `${chemin}.${cle}`)
    }
    parcourir(pt.proDash, 'proDash')
    expect(fautes).toEqual([])
  })
})
