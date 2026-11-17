// Garde du formulaire de devis et facture BTP en portugais (components/DevisFactureFormBTP.tsx,
// lib/devis-btp-traduction.ts). Constat de Frédéric du 17/11/2026 : sur /pt, toute la création de devis restait en
// français. Chaque texte affiché passe par tx('texte français') : ce test lit le composant et exige une traduction
// portugaise pour chacun, y compris les libellés de listes affichés par tx(variable).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { TEXTES_DEVIS_BTP_PT, traducteurDevisBtp } from '@/lib/devis-btp-traduction'
import { REGIME_ERROR_MESSAGES } from '@/lib/tva-calculator'
import { ligneTvaHorsClassique } from '@/lib/devis-btp-affichage'

/** Écrans traduits par lib/devis-btp-traduction.ts : le formulaire et sa fenêtre « Rentabilité du devis ». */
const SOURCES = [
  join('components', 'DevisFactureFormBTP.tsx'),
  join('components', 'dashboard', 'btp', 'RentabiliteDevisModal.tsx'),
].map((fichier) => readFileSync(join(process.cwd(), fichier), 'utf8'))

/** Textes français que le formulaire fait passer par tx() : littéraux, et valeurs des listes affichées par tx(variable). */
function textesDuFormulaire(source: string): string[] {
  const sf = ts.createSourceFile('formulaire.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const cles = new Set<string>()
  const chaine = (n: ts.Node | undefined): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
  const constante = (n: ts.Node): string => {
    for (let p = n.parent; p; p = p.parent) if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
    return ''
  }
  const resultats = (e: ts.Expression): void => {
    if (chaine(e)) cles.add(e.text)
    else if (ts.isConditionalExpression(e)) { resultats(e.whenTrue); resultats(e.whenFalse) }
    else if (ts.isParenthesizedExpression(e)) resultats(e.expression)
  }
  const visiter = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tx' && chaine(n.arguments[0])) cles.add(n.arguments[0].text)
    // Listes déroulantes : DECLENCHEURS_ACOMPTE, MODES_PAIEMENT, DELAIS_PAIEMENT, ESCOMPTES (valeur enregistrée en français)
    if (chaine(n) && ts.isArrayLiteralExpression(n.parent) && ['DECLENCHEURS_ACOMPTE', 'MODES_PAIEMENT', 'DELAIS_PAIEMENT', 'ESCOMPTES'].includes(constante(n))) cles.add(n.text)
    if (ts.isPropertyAssignment(n) && chaine(n.initializer) && ts.isObjectLiteralExpression(n.parent)) {
      const nom = n.name.getText(sf)
      const freres = new Set(n.parent.properties.map((p) => (p.name ? p.name.getText(sf) : '')))
      if (nom === 'label' && ['UNITES_TABLEAU', 'TYPES_ASSURANCE'].includes(constante(n))) cles.add(n.initializer.text)
      else if ((nom === 'label' || nom === 'sub') && freres.has('label') && freres.has('sub')) cles.add(n.initializer.text) // régime de TVA
      else if ((nom === 'title' || nom === 'hint') && freres.has('title') && freres.has('hint')) cles.add(n.initializer.text) // type de facture
      else if (nom === 'label' && freres.has('color')) cles.add(n.initializer.text) // statut du rapport joint
    }
    // Liste de conformité : ['RCS / RM', conformite.rcs]…
    if (ts.isArrayLiteralExpression(n) && n.elements.length === 2 && chaine(n.elements[0]) && ts.isPropertyAccessExpression(n.elements[1])
      && n.elements[1].expression.getText(sf) === 'conformite') cles.add(n.elements[0].text)
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'catLabel' && n.initializer) resultats(n.initializer)
    ts.forEachChild(n, visiter)
  }
  visiter(sf)
  return [...cles]
}

/** Libellés calculés par d'autres modules, affichés par tx(variable). */
const TEXTES_EXTERNES = [
  ...Object.values(REGIME_ERROR_MESSAGES),
  'TOTAL TTC', 'TOTAL NET',
  ...(['autoliquidation_btp', 'franchise_293b'] as const).flatMap((r) => Object.values(ligneTvaHorsClassique(r) ?? {})),
]

/** Identiques dans les deux langues. */
const IDENTIQUES = new Set(['Email', 'Capital social', 'Portugal', 'm³', 'kg', 'L', 'big bag', 'OK', '×', '€/h', 'h ×', '€/h +'])
/** Référence au droit français retirée en portugais (valeur vide voulue). */
const RETIRES = new Set(['(art. L. 441-9 — obligatoire même si nul)'])

describe('formulaire de devis BTP en portugais : dictionnaire complet', () => {
  const textes = [...new Set(SOURCES.flatMap(textesDuFormulaire))]

  it('le formulaire passe bien ses textes par tx (garde contre une lecture vide)', () => {
    expect(textes.length).toBeGreaterThan(300)
    expect(textes).toContain('Statut juridique')
    expect(textes).toContain('Virement bancaire')
    expect(textes).toContain('TVA classique')
    expect(textes).toContain('Bénéfice net')
  })

  it('chaque texte affiché a sa traduction portugaise', () => {
    const manquants = [...textes, ...TEXTES_EXTERNES].filter((t) => !Object.prototype.hasOwnProperty.call(TEXTES_DEVIS_BTP_PT, t))
    expect(manquants).toEqual([])
  })

  it('aucune traduction oubliée : texte portugais différent du français, sauf mots identiques et retraits voulus', () => {
    const recopies = Object.entries(TEXTES_DEVIS_BTP_PT).filter(([fr, pt]) => pt === fr && !IDENTIQUES.has(fr)).map(([fr]) => fr)
    expect(recopies).toEqual([])
    const vides = Object.entries(TEXTES_DEVIS_BTP_PT).filter(([, pt]) => pt === '').map(([fr]) => fr)
    expect(vides.sort()).toEqual([...RETIRES].sort())
  })

  it('les variables {x} sont reprises dans la traduction', () => {
    const variables = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    for (const [fr, pt] of Object.entries(TEXTES_DEVIS_BTP_PT)) expect(variables(pt), fr).toBe(variables(fr))
  })

  it('pas d\'entrée morte : chaque entrée correspond à un texte du formulaire', () => {
    const connus = new Set([...textes, ...TEXTES_EXTERNES])
    expect(Object.keys(TEXTES_DEVIS_BTP_PT).filter((fr) => !connus.has(fr))).toEqual([])
  })

  it('aucun message (toast) écrit en dur : chacun passe par tx', () => {
    const enDur: string[] = []
    for (const source of SOURCES) {
      const sf = ts.createSourceFile('ecran.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visiter = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && /^toast\.(error|success|warning|info|message)$/.test(n.expression.getText(sf))) {
          const premier = n.arguments[0]
          if (premier && (ts.isStringLiteral(premier) || ts.isNoSubstitutionTemplateLiteral(premier) || ts.isTemplateExpression(premier))) {
            enDur.push(premier.getText(sf))
          }
        }
        ts.forEachChild(n, visiter)
      }
      visiter(sf)
    }
    // Seule exception : le message des imports de fournisseur, dont l'emoji et le nom restent hors traduction
    expect(enDur.filter((t) => !t.includes("tx('{nombre} matériaux importés'"))).toEqual([])
  })

  it('aucune référence au droit français dans les traductions', () => {
    const droitFrancais = /\bCGI\b|C\. ?com\.|C\. ?conso\.|Code de|Loi Pinel|AGEC|SIRET|Kbis|\bRCS\b|L\. ?\d{3}-\d+/
    expect(Object.values(TEXTES_DEVIS_BTP_PT).filter((pt) => droitFrancais.test(pt))).toEqual([])
  })
})

describe('traducteurDevisBtp', () => {
  it('en français, rend chaque texte tel quel (écran français inchangé)', () => {
    const tx = traducteurDevisBtp('fr')
    for (const fr of Object.keys(TEXTES_DEVIS_BTP_PT)) expect(tx(fr)).toBe(fr)
    expect(tx('Section "{nom}" supprimée', { nom: 'ISOLATION' })).toBe('Section "ISOLATION" supprimée')
    expect(tx('Les {reste}% restants seront réglés séparément.', { reste: '40' })).toBe('Les 40% restants seront réglés séparément.')
  })

  it('en portugais, traduit et remplit les variables', () => {
    const tx = traducteurDevisBtp('pt')
    expect(tx('Statut juridique')).toBe('Forma jurídica')
    expect(tx('Enregistrer brouillon')).toBe('Guardar rascunho')
    expect(tx('{nombre} matériaux importés', { nombre: 3 })).toBe('3 materiais importados')
    expect(tx('(art. L. 441-9 — obligatoire même si nul)')).toBe('')
    expect(tx(REGIME_ERROR_MESSAGES.autoliquidation_requires_client_siren)).toBe('NIF do adquirente obrigatório para a autoliquidação.')
  })

  it('texte inconnu : rendu tel quel, dans les deux langues', () => {
    expect(traducteurDevisBtp('pt')('Texte saisi par l\'utilisateur')).toBe('Texte saisi par l\'utilisateur')
    expect(traducteurDevisBtp('en')('Statut juridique')).toBe('Statut juridique')
  })
})
