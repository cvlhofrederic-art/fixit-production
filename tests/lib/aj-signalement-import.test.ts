// tests/lib/aj-signalement-import.test.ts
//
// Import des copropriétés depuis un fichier Excel (.xlsx) ou CSV (SPEC § 1.9, demande de Hugo du 10/11/2026 : « créer
// les copropriétés à partir d'un tableau Excel fourni par le client »). Fichier lu dans le navigateur, jamais envoyé :
//   - lecteur .xlsx (fflate chargé à l'appel) sur des archives construites ici par zipSync, stockées et deflate :
//     chaînes partagées, texte riche, inlineStr, formules (valeur en cache), feuilles masquées, cellules fusionnées,
//     bombe ZIP refusée avant décompression, ancien format .xls refusé, bornes de 2 000 lignes et 30 colonnes ;
//   - modèle généré dans le navigateur : relu à l'identique par le lecteur (aller-retour) ;
//   - CSV : découpage RFC 4180 sur tout le texte (adresse sur deux lignes), BOM, UTF-8 strict puis windows-1252 ;
//   - normalisation d'une ligne (code postal « 6000 » → « 06000 »…), en-têtes, correspondance, 500 lignes au plus ;
//   - diagnostics communs au navigateur et au serveur : gestionnaires (adresse ou nom, homonymes, fiche désactivée,
//     fiche d'un autre cabinet), destinataires (adresse de fiche, hors domaines), doublons dans le fichier et avec
//     l'existant (ignorer, compléter, « ce n'est pas un doublon »), lignes envoyées à la fonction SQL.
// Données fictives seulement (« Résidence Exemple », @exemple.test, cabinet-exemple).

import { describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { cleNomCoproQr } from '@/lib/aj-signalement/doublons'
import {
  COLONNES_LUES_MAX_QR, COLONNES_MODELE_IMPORT_QR, LIGNES_IMPORT_MAX_QR, LIGNES_LUES_MAX_QR, TAILLE_FICHIER_IMPORT_MAX_QR,
  actionImportQr, analyserGestionnairesImportQr, champDepuisEnteteQr, correspondanceAutomatiqueQr, decouperBatimentsImportQr,
  diagnostiquerImportQr, empreinteEntetesQr, estEmailImportQr, exemplesColonneQr, nomDepuisEmailQr, normaliserCodePostalImportQr,
  normaliserImmatriculationImportQr, normaliserLignesImportQr, planCreationImportQr, separerAdresseCompleteQr, trouverLigneEntetesQr,
} from '@/lib/aj-signalement/import/ligne'
import { decoderTexteImportQr, decouperCsvQr, lireCsvQr } from '@/lib/aj-signalement/import/csv'
import { lireXlsxQr, natureFichierImportQr } from '@/lib/aj-signalement/import/lecteur-xlsx'
import { lignesModeleImportQr, lignesModeEmploiImportQr, modeleCsvQr, octetsModeleXlsxQr } from '@/lib/aj-signalement/import/modele-xlsx'
import { strictEmail } from '@/lib/validation'
import type { ContexteImportQr, CoproprieteDoublonQr, LigneImportQr } from '@/lib/aj-signalement/types'

// ── Archives .xlsx construites dans le test ──────────────────────────────────

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

interface FeuilleTest { nom: string; donnees: string; etat?: 'hidden' | 'veryHidden'; fusions?: boolean; cheminAbsolu?: boolean }

function classeur(feuilles: FeuilleTest[], partagees?: string, niveau: 0 | 6 = 6): Uint8Array {
  const fichiers: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${
      feuilles.map((f, i) => `<sheet name="${f.nom}" sheetId="${i + 1}"${f.etat ? ` state="${f.etat}"` : ''} r:id="rId${i + 1}"/>`).join('')
    }</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
      feuilles.map((f, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="${f.cheminAbsolu ? '/xl/' : ''}worksheets/sheet${i + 1}.xml"/>`).join('')
    }</Relationships>`,
  }
  feuilles.forEach((f, i) => {
    fichiers[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${f.donnees}</sheetData>${
      f.fusions ? '<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>' : ''
    }</worksheet>`
  })
  if (partagees !== undefined) fichiers['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${NS}">${partagees}</sst>`
  const zippable: Zippable = {}
  for (const [nom, texte] of Object.entries(fichiers)) zippable[nom] = strToU8(texte)
  return zipSync(zippable, { level: niveau })
}

const inline = (ref: string, texte: string) => `<c r="${ref}" t="inlineStr"><is><t>${texte}</t></is></c>`
const ligneXml = (n: number, cellules: string) => `<row r="${n}">${cellules}</row>`

describe('lecteur .xlsx (fflate chargé à l’appel, DOMParser)', () => {
  const partagees = '<si><t>Nom</t></si><si><r><t>Résidence </t></r><r><rPr><b/></rPr><t>Exemple</t></r><rPh><t>XX</t></rPh></si><si><t xml:space="preserve"> Code postal </t></si>'
  const donnees = [
    ligneXml(1, '<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="s"><v>0</v></c>'),
    ligneXml(2, '<c r="A2" t="s"><v>1</v></c><c r="B2"><v>6000</v></c><c r="C2" t="str"><f>A2&amp;"!"</f><v>Résidence Exemple!</v></c><c r="D2"><f>1+1</f><v>2</v></c><c r="E2" t="b"><v>1</v></c>'),
    ligneXml(4, `${inline('A4', 'Villa &lt;Exemple&gt; &amp; Cie')}<c r="C4"><v>13008</v></c>`),
  ].join('')

  it.each([{ niveau: 0 as const, nom: 'stockée' }, { niveau: 6 as const, nom: 'deflate' }])('archive $nom : chaînes partagées, texte riche, formules (valeur en cache), inlineStr, cellules et lignes creuses', async ({ niveau }) => {
    const lecture = await lireXlsxQr(classeur([{ nom: 'Copropriétés', donnees }], partagees, niveau))
    expect(lecture.ok).toBe(true)
    if (!lecture.ok) return
    expect(lecture.feuille).toBe('Copropriétés')
    expect(lecture.lignes).toEqual([
      ['Nom', ' Code postal ', 'Nom'],
      ['Résidence Exemple', '6000', 'Résidence Exemple!', '2', 'VRAI'],
      [],
      ['Villa <Exemple> & Cie', '', '13008'],
    ])
    expect(lecture.avertissements).toEqual([])
    expect(lecture.tronque).toBe(false)
  })

  it('feuille masquée : la première VISIBLE par défaut ; toutes listées ; choix par nom ; cible absolue des relations', async () => {
    const octets = classeur([
      { nom: 'Notes', donnees: ligneXml(1, inline('A1', 'masquée')), etat: 'hidden' },
      { nom: 'Copropriétés', donnees: ligneXml(1, inline('A1', 'visible')) },
      { nom: 'Autre', donnees: ligneXml(1, inline('A1', 'autre')), cheminAbsolu: true },
    ])
    const defaut = await lireXlsxQr(octets)
    expect(defaut.ok && defaut.feuilles).toEqual([{ nom: 'Notes', visible: false }, { nom: 'Copropriétés', visible: true }, { nom: 'Autre', visible: true }])
    expect(defaut.ok && defaut.lignes).toEqual([['visible']])
    const choisie = await lireXlsxQr(octets, 'Autre')
    expect(choisie.ok && choisie.lignes).toEqual([['autre']])
  })

  it('cellules fusionnées : avertissement (seule la première cellule porte la valeur)', async () => {
    const lecture = await lireXlsxQr(classeur([{ nom: 'F', donnees: ligneXml(1, inline('A1', 'x')), fusions: true }]))
    expect(lecture.ok && lecture.avertissements).toHaveLength(1)
  })

  it('ancien format .xls (OLE) ou classeur protégé : refusé ; octets quelconques : illisibles ; plus de 5 Mo : trop gros', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])
    expect(natureFichierImportQr(ole)).toBe('ole')
    expect(await lireXlsxQr(ole)).toEqual({ ok: false, code: 'format_ancien' })
    expect(await lireXlsxQr(strToU8('nom;adresse'))).toEqual({ ok: false, code: 'illisible' })
    expect(await lireXlsxQr(new Uint8Array(TAILLE_FICHIER_IMPORT_MAX_QR + 1))).toEqual({ ok: false, code: 'trop_gros' })
    // Archive valide sans classeur : illisible, sans lever.
    expect(await lireXlsxQr(zipSync({ 'a.txt': strToU8('x') }))).toEqual({ ok: false, code: 'illisible' })
  })

  it('bombe ZIP : une entrée annoncée à plus de 10 Mo est refusée AVANT décompression', async () => {
    const partageesEnormes = `<si><t>${' '.repeat(11 * 1024 * 1024)}</t></si>`
    const octets = classeur([{ nom: 'F', donnees: '' }], partageesEnormes, 6)
    expect(octets.length).toBeLessThan(TAILLE_FICHIER_IMPORT_MAX_QR)
    expect(await lireXlsxQr(octets)).toEqual({ ok: false, code: 'bombe' })
  })

  it('bombe ZIP : plus de 30 Mo au total pour les entrées lues est refusé', async () => {
    // Quatre entrées lues de 8 Mo chacune (chacune sous la borne de 10 Mo) : 32 Mo au total.
    const remplissage = `<!--${' '.repeat(8 * 1024 * 1024)}-->`
    const fichiers = unzipSync(classeur([{ nom: 'F', donnees: ligneXml(1, inline('A1', 'x')) }], '<si><t>a</t></si>'))
    const grossir = (nom: string, fin: string) => {
      fichiers[nom] = strToU8(new TextDecoder().decode(fichiers[nom]).replace(fin, `${remplissage}${fin}`))
    }
    grossir('xl/workbook.xml', '</workbook>')
    grossir('xl/_rels/workbook.xml.rels', '</Relationships>')
    grossir('xl/sharedStrings.xml', '</sst>')
    grossir('xl/worksheets/sheet1.xml', '</worksheet>')
    const octets = zipSync(fichiers, { level: 6 })
    expect(octets.length).toBeLessThan(TAILLE_FICHIER_IMPORT_MAX_QR)
    expect(await lireXlsxQr(octets)).toEqual({ ok: false, code: 'bombe' })
  })

  it(`au plus ${LIGNES_LUES_MAX_QR} lignes et ${COLONNES_LUES_MAX_QR} colonnes lues`, async () => {
    const lignes = Array.from({ length: LIGNES_LUES_MAX_QR + 5 }, (_, i) => ligneXml(i + 1, inline(`A${i + 1}`, `n${i + 1}`))).join('')
    const longues = await lireXlsxQr(classeur([{ nom: 'F', donnees: lignes }]))
    expect(longues.ok && longues.lignes).toHaveLength(LIGNES_LUES_MAX_QR)
    expect(longues.ok && longues.tronque).toBe(true)
    const colonnes = Array.from({ length: 35 }, (_, i) => `<c t="inlineStr"><is><t>c${i}</t></is></c>`).join('')
    const larges = await lireXlsxQr(classeur([{ nom: 'F', donnees: `<row r="1">${colonnes}</row>` }]))
    expect(larges.ok && larges.lignes[0]).toHaveLength(COLONNES_LUES_MAX_QR)
  })
})

describe('modèle à télécharger (généré dans le navigateur, zipSync stocké)', () => {
  it('aller-retour : le lecteur relit exactement le modèle ; feuilles « Copropriétés » et « Mode d’emploi »', async () => {
    const octets = await octetsModeleXlsxQr()
    expect(natureFichierImportQr(octets)).toBe('zip')
    const lecture = await lireXlsxQr(octets)
    expect(lecture.ok).toBe(true)
    if (!lecture.ok) return
    expect(lecture.feuilles).toEqual([{ nom: 'Copropriétés', visible: true }, { nom: 'Mode d’emploi', visible: true }])
    expect(lecture.lignes).toEqual(lignesModeleImportQr())
    const emploi = await lireXlsxQr(octets, 'Mode d’emploi')
    expect(emploi.ok && emploi.lignes).toEqual(lignesModeEmploiImportQr())
  })

  it('en-têtes du modèle reconnus sur les 9 champs ; exemples fictifs ; CSV UTF-8 avec BOM et « ; »', () => {
    const [entetes, ...exemples] = lignesModeleImportQr()
    expect(entetes).toEqual(COLONNES_MODELE_IMPORT_QR.map((c) => c.entete))
    const auto = correspondanceAutomatiqueQr(entetes)
    expect(Object.keys(auto).sort()).toEqual(COLONNES_MODELE_IMPORT_QR.map((c) => c.champ).sort())
    expect(exemples).toHaveLength(2)
    expect(JSON.stringify(exemples)).toMatch(/Résidence Exemple/)
    expect(JSON.stringify(exemples)).toMatch(/@exemple\.test/)
    expect(lignesModeEmploiImportQr().length).toBe(COLONNES_MODELE_IMPORT_QR.length + 1)
    const csv = modeleCsvQr()
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lireCsvQr(strToU8(csv))).toMatchObject({ ok: true, lignes: lignesModeleImportQr() })
  })
})

describe('CSV : RFC 4180 sur tout le texte, BOM, UTF-8 strict puis windows-1252', () => {
  it('une adresse sur deux lignes entre guillemets reste une cellule ; guillemets doublés ; CRLF ; pas de ligne vide finale', () => {
    const texte = 'Nom;Adresse\r\n"Résidence ""Exemple""";"1 rue Exemple\r\nBât. A"\r\nVilla Exemple;2 rue Exemple\r\n'
    expect(decouperCsvQr(texte).lignes).toEqual([
      ['Nom', 'Adresse'],
      ['Résidence "Exemple"', '1 rue Exemple\r\nBât. A'],
      ['Villa Exemple', '2 rue Exemple'],
    ])
  })

  it('séparateur détecté sur la première ligne (« ; », « , », tabulation)', () => {
    expect(decouperCsvQr('a,b,c\n1,2,3').lignes).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
    expect(decouperCsvQr('a\tb\n1\t2').lignes).toEqual([['a', 'b'], ['1', '2']])
    expect(decouperCsvQr('a;b,c\n1;2,3').lignes).toEqual([['a', 'b,c'], ['1', '2,3']])
  })

  it('BOM retiré ; UTF-8 strict ; repli windows-1252 (é = 0xE9) ; UTF-16 avec BOM', () => {
    expect(decoderTexteImportQr(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('Résidence')]))).toBe('Résidence')
    expect(decoderTexteImportQr(new Uint8Array([0x52, 0xe9, 0x73, 0x69, 0x64, 0x65, 0x6e, 0x63, 0x65, 0x20, 0x80]))).toBe('Résidence €')
    // Apostrophe typographique (0x92) et « œ » (0x9C), fréquents dans un export Excel français.
    expect(decoderTexteImportQr(new Uint8Array([0x6c, 0x92, 0x9c, 0x69, 0x6c, 0xe9]))).toBe('l’œilé')
    expect(decoderTexteImportQr(new Uint8Array([0xff, 0xfe, 0x52, 0x00, 0xe9, 0x00]))).toBe('Ré')
  })

  it(`bornes : ${LIGNES_LUES_MAX_QR} lignes, ${COLONNES_LUES_MAX_QR} colonnes ; fichier trop gros refusé`, () => {
    const lignes = Array.from({ length: LIGNES_LUES_MAX_QR + 3 }, (_, i) => `n${i}`).join('\n')
    const r = decouperCsvQr(lignes)
    expect(r.lignes).toHaveLength(LIGNES_LUES_MAX_QR)
    expect(r.tronque).toBe(true)
    expect(decouperCsvQr(Array.from({ length: 40 }, (_, i) => `c${i}`).join(';')).lignes[0]).toHaveLength(COLONNES_LUES_MAX_QR)
    expect(lireCsvQr(new Uint8Array(TAILLE_FICHIER_IMPORT_MAX_QR + 1))).toEqual({ ok: false, code: 'trop_gros' })
    expect(lireCsvQr(new Uint8Array([]))).toEqual({ ok: false, code: 'vide' })
  })
})

describe('en-têtes et correspondance des colonnes', () => {
  it('synonymes reconnus (accents, casse, ponctuation) ; colonne inconnue ignorée', () => {
    expect(champDepuisEnteteQr('Résidence')).toBe('nom')
    expect(champDepuisEnteteQr('  NOM DE LA COPROPRIÉTÉ ')).toBe('nom')
    expect(champDepuisEnteteQr('C.P.')).toBe('codePostal')
    expect(champDepuisEnteteQr('Commune')).toBe('ville')
    expect(champDepuisEnteteQr('RNIC')).toBe('immatriculation')
    expect(champDepuisEnteteQr('Code immeuble')).toBe('referenceCabinet')
    expect(champDepuisEnteteQr('Bât.')).toBe('batiments')
    expect(champDepuisEnteteQr('Chargé de copropriété')).toBe('gestionnaires')
    expect(champDepuisEnteteQr('Copie')).toBe('emailsDestinataires')
    expect(champDepuisEnteteQr('Téléphone du président')).toBeNull()
  })

  it('ligne d’en-têtes : la première des 10 premières qui a au moins 2 colonnes reconnues ; sinon la première', () => {
    const lignes = [['Liste des copropriétés'], ['Export du 10/11/2026'], ['Résidence', 'CP', 'Ville', 'Téléphone'], ['Résidence Exemple', '13008', 'Marseille', '0600000000']]
    expect(trouverLigneEntetesQr(lignes)).toBe(2)
    expect(trouverLigneEntetesQr([['a', 'b'], ['c', 'd']])).toBe(0)
    const auto = correspondanceAutomatiqueQr(lignes[2])
    expect(auto).toEqual({ nom: 0, codePostal: 1, ville: 2 })
    // Deux colonnes du même champ : la première l'emporte.
    expect(correspondanceAutomatiqueQr(['Nom', 'Résidence'])).toEqual({ nom: 0 })
    expect(exemplesColonneQr([['Nom'], ['a'], [''], ['b'], ['c'], ['d'], ['e'], ['f']], 0, 0)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('empreinte des en-têtes : mêmes noms (casse, espaces) → même empreinte ; noms seulement', () => {
    expect(empreinteEntetesQr(['Nom', ' CP '])).toBe(empreinteEntetesQr(['nom', 'cp']))
    expect(empreinteEntetesQr(['Nom', 'CP'])).not.toBe(empreinteEntetesQr(['Nom', 'Ville']))
  })
})

describe('normalisation d’une ligne (mêmes bornes que Zod)', () => {
  it('code postal : 4 chiffres complétés d’un 0, espaces et CEDEX retirés, format portugais gardé, sinon erreur', () => {
    expect(normaliserCodePostalImportQr('6000')).toEqual({ ok: true, valeur: '06000' })
    expect(normaliserCodePostalImportQr('13 008')).toEqual({ ok: true, valeur: '13008' })
    expect(normaliserCodePostalImportQr('13008 CEDEX 08')).toEqual({ ok: true, valeur: '13008' })
    expect(normaliserCodePostalImportQr('4000-123')).toEqual({ ok: true, valeur: '4000-123' })
    expect(normaliserCodePostalImportQr('')).toEqual({ ok: true, valeur: '' })
    expect(normaliserCodePostalImportQr('130')).toEqual({ ok: false })
    expect(normaliserCodePostalImportQr('13OO8')).toEqual({ ok: false })
  })

  it('immatriculation : majuscules sans séparateurs ; format inattendu = avertissement ; caractère interdit ou > 20 = erreur', () => {
    expect(normaliserImmatriculationImportQr('ab 123-45.67')).toEqual({ ok: true, valeur: 'AB1234567', inattendu: false })
    expect(normaliserImmatriculationImportQr('XYZ')).toEqual({ ok: true, valeur: 'XYZ', inattendu: true })
    expect(normaliserImmatriculationImportQr('')).toEqual({ ok: true, valeur: '', inattendu: false })
    expect(normaliserImmatriculationImportQr('AB_12')).toEqual({ ok: false })
    expect(normaliserImmatriculationImportQr('A'.repeat(21))).toEqual({ ok: false })
  })

  it('bâtiments séparés par « ; », « , » ou retour à la ligne ; au plus 50 de 50 caractères', () => {
    expect(decouperBatimentsImportQr('A; B, C\nD;;A')).toEqual({ ok: true, valeurs: ['A', 'B', 'C', 'D'] })
    expect(decouperBatimentsImportQr('')).toEqual({ ok: true, valeurs: [] })
    expect(decouperBatimentsImportQr('x'.repeat(51))).toEqual({ ok: false })
    expect(decouperBatimentsImportQr(Array.from({ length: 51 }, (_, i) => `B${i}`).join(';'))).toEqual({ ok: false })
  })

  it('adresse complète : « 12 rue Exemple 13008 Marseille » séparée en voie, code postal, ville', () => {
    expect(separerAdresseCompleteQr('12 rue Exemple 13008 Marseille')).toEqual({ adresse: '12 rue Exemple', codePostal: '13008', ville: 'Marseille' })
    expect(separerAdresseCompleteQr('12 rue Exemple, 13008 Marseille')).toEqual({ adresse: '12 rue Exemple', codePostal: '13008', ville: 'Marseille' })
    expect(separerAdresseCompleteQr('12 rue Exemple')).toEqual({ adresse: '12 rue Exemple', codePostal: '', ville: '' })
  })

  it('adresses e-mail : au moins aussi strictes que le schéma du serveur (strictEmail)', () => {
    const essais = ['marie.exemple@exemple.test', 'MARIE@EXEMPLE.TEST', 'a+b@exemple.test', 'marie@', 'marie@exemple', '.marie@exemple.test', 'ma..rie@exemple.test', 'marie@exemple.t', 'marie exemple@exemple.test']
    for (const e of essais) {
      if (estEmailImportQr(e)) expect(strictEmail.safeParse(e.toLowerCase()).success, e).toBe(true)
    }
    expect(estEmailImportQr('marie.exemple@exemple.test')).toBe(true)
    expect(estEmailImportQr('marie@')).toBe(false)
  })

  it('gestionnaires : adresses (minuscules) ou, à défaut, noms ; adresse mal formée en erreur ; nom proposé depuis l’adresse', () => {
    expect(analyserGestionnairesImportQr('Marie.Exemple@Exemple.test; paul.exemple@exemple.test')).toEqual({
      emails: ['marie.exemple@exemple.test', 'paul.exemple@exemple.test'], noms: [], invalides: [],
    })
    expect(analyserGestionnairesImportQr('Marie Exemple, Paul Exemple / Léa Exemple')).toEqual({ emails: [], noms: ['Marie Exemple', 'Paul Exemple', 'Léa Exemple'], invalides: [] })
    expect(analyserGestionnairesImportQr('marie@')).toEqual({ emails: [], noms: [], invalides: ['marie@'] })
    expect(nomDepuisEmailQr('marie-claire.exemple@exemple.test')).toBe('Marie-Claire Exemple')
    expect(nomDepuisEmailQr('mexemple@exemple.test')).toBe('Mexemple')
  })

  const entetes = COLONNES_MODELE_IMPORT_QR.map((c) => c.entete)
  const correspondance = correspondanceAutomatiqueQr(entetes)
  const ligneBrute = (sur: Partial<Record<string, string>> = {}) => COLONNES_MODELE_IMPORT_QR.map((c) => sur[c.champ] ?? '')

  it('ligne complète : champs normalisés, n° de ligne du tableur, valeurs par défaut des choix', () => {
    const r = normaliserLignesImportQr([entetes, ligneBrute({
      nom: ' Résidence Exemple ', adresse: '1 rue Exemple', codePostal: '6000', ville: 'Nice', immatriculation: 'ab1234567',
      referenceCabinet: 'REF-01', batiments: 'A;B', gestionnaires: 'Marie.Exemple@exemple.test', emailsDestinataires: 'CS@Externe.test',
    })], 0, correspondance)
    expect(r.tropDeLignes).toBe(false)
    expect(r.lignes).toEqual([{
      numeroLigne: 2, nom: 'Résidence Exemple', messages: [],
      saisie: {
        numeroLigne: 2, nom: 'Résidence Exemple', adresse: '1 rue Exemple', codePostal: '06000', ville: 'Nice', immatriculation: 'AB1234567',
        referenceCabinet: 'REF-01', batiments: ['A', 'B'], gestionnaires: ['marie.exemple@exemple.test'], nomsGestionnaires: [],
        emailsDestinataires: ['cs@externe.test'], actionSiExiste: 'ignorer', forcerDoublon: false, creerSiDoublonProbable: true,
      },
    }])
  })

  it('erreurs de format : la ligne n’est pas envoyée (saisie null), messages précis ; lignes vides ignorées', () => {
    const r = normaliserLignesImportQr([
      entetes,
      ligneBrute({ nom: 'Résidence Exemple', codePostal: '130' }),
      ligneBrute(),
      ligneBrute({ adresse: '3 rue Exemple' }),
      ligneBrute({ nom: 'Villa Exemple', emailsDestinataires: Array.from({ length: 11 }, (_, i) => `d${i}@exemple.test`).join(';') }),
      ligneBrute({ nom: 'Mas Exemple', immatriculation: 'xyz' }),
    ], 0, correspondance)
    expect(r.lignes.map((l) => l.numeroLigne)).toEqual([2, 4, 5, 6])
    expect(r.lignes[0]).toMatchObject({ saisie: null, messages: [{ niveau: 'erreur', champ: 'codePostal', texte: 'Code postal « 130 » : 5 chiffres attendus' }] })
    expect(r.lignes[1]).toMatchObject({ saisie: null, messages: [{ niveau: 'erreur', champ: 'nom' }] })
    expect(r.lignes[2]).toMatchObject({ saisie: null, messages: [{ niveau: 'erreur', champ: 'emailsDestinataires' }] })
    // Format d'immatriculation inattendu : avertissement, la ligne part.
    expect(r.lignes[3].saisie).not.toBeNull()
    expect(r.lignes[3].messages).toEqual([expect.objectContaining({ niveau: 'avertissement', champ: 'immatriculation' })])
  })

  it('option « une seule colonne contient l’adresse complète » ; colonnes code postal et ville prioritaires si remplies', () => {
    const r = normaliserLignesImportQr([
      ['Nom', 'Adresse', 'CP'],
      ['Résidence Exemple', '12 rue Exemple 13008 Marseille', ''],
      ['Villa Exemple', '2 rue Exemple 13008 Marseille', '13001'],
    ], 0, { nom: 0, adresse: 1, codePostal: 2 }, { adresseComplete: true })
    expect(r.lignes[0].saisie).toMatchObject({ adresse: '12 rue Exemple', codePostal: '13008', ville: 'Marseille' })
    expect(r.lignes[1].saisie).toMatchObject({ adresse: '2 rue Exemple', codePostal: '13001', ville: 'Marseille' })
  })

  it(`au plus ${LIGNES_IMPORT_MAX_QR} lignes de données : 501 refusées (« divisez le fichier »)`, () => {
    const lignes = (n: number) => [['Nom'], ...Array.from({ length: n }, (_, i) => [`Résidence Exemple ${i}`])]
    expect(normaliserLignesImportQr(lignes(LIGNES_IMPORT_MAX_QR), 0, { nom: 0 }).tropDeLignes).toBe(false)
    expect(normaliserLignesImportQr(lignes(LIGNES_IMPORT_MAX_QR + 1), 0, { nom: 0 }).tropDeLignes).toBe(true)
  })
})

// ── Diagnostics (navigateur et serveur) ──────────────────────────────────────

const G1 = '11111111-1111-4111-8111-111111111111'
const G2 = '22222222-2222-4222-8222-222222222222'
const G3 = '33333333-3333-4333-8333-333333333333'
const G4 = '44444444-4444-4444-8444-444444444444'
const G5 = '55555555-5555-4555-8555-555555555555'
const E1 = 'e0000000-0000-4000-8000-000000000001'
const E2 = 'e0000000-0000-4000-8000-000000000002'

const existantes: CoproprieteDoublonQr[] = [
  { id: E1, nom: 'Résidence Le Parc', adresse: '1 boulevard Exemple', codePostal: '13008', ville: 'Marseille', immatriculation: 'AB1234567', referenceCabinet: 'REF-01' },
  { id: E2, nom: 'Les Tilleuls', adresse: '', codePostal: '13001', ville: 'Marseille', immatriculation: null, referenceCabinet: null },
]
const contexte: ContexteImportQr = {
  domaines: ['exemple.test'],
  fiches: [
    { id: G1, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true, contestee: false },
    { id: G2, nom: 'Paul Exemple', email: 'paul.exemple@exemple.test', actif: false, contestee: false },
    { id: G3, nom: 'Léa Exemple', email: 'lea.exemple@exemple.test', actif: true, contestee: true },
    { id: G4, nom: 'Jean Exemple', email: 'jean.exemple@exemple.test', actif: true, contestee: false },
    { id: G5, nom: 'Jean Exemple', email: 'jean.autre@exemple.test', actif: true, contestee: false },
  ],
  emailsAutresCabinets: ['zoe.exemple@autre-exemple.test'],
  existantes,
}

const ligne = (numeroLigne: number, sur: Partial<LigneImportQr> = {}): LigneImportQr => ({
  numeroLigne, nom: `Copropriété Exemple ${numeroLigne}`, adresse: '', codePostal: '', ville: '', immatriculation: '', referenceCabinet: '',
  batiments: [], gestionnaires: [], nomsGestionnaires: [], emailsDestinataires: [], actionSiExiste: 'ignorer', forcerDoublon: false,
  creerSiDoublonProbable: true, ...sur,
})

describe('diagnostics : gestionnaires de la ligne', () => {
  it('par adresse : fiche active du cabinet → attribuée ; désactivée, contestée, d’un autre cabinet ou inconnue → erreur de ligne', () => {
    const v = diagnostiquerImportQr([
      ligne(2, { gestionnaires: ['marie.exemple@exemple.test'] }),
      ligne(3, { gestionnaires: ['paul.exemple@exemple.test'] }),
      ligne(4, { gestionnaires: ['lea.exemple@exemple.test'] }),
      ligne(5, { gestionnaires: ['zoe.exemple@autre-exemple.test'] }),
      ligne(6, { gestionnaires: ['nina.exemple@exemple.test', 'max.exemple@ailleurs.test'] }),
    ], contexte)
    const [d2, d3, d4, d5, d6] = v.diagnostics
    expect(d2).toMatchObject({ etat: 'a_creer', action: 'creer', gestionnaires: [{ id: G1, nom: 'Marie Exemple' }], messages: [] })
    expect(d3).toMatchObject({ etat: 'erreur', action: 'aucune', messages: [{ niveau: 'erreur', champ: 'gestionnaires', texte: 'Gestionnaire « paul.exemple@exemple.test » : fiche désactivée' }] })
    expect(d4.messages[0].texte).toMatch(/contestée/)
    expect(d5.messages[0].texte).toMatch(/autre cabinet/)
    expect(d6.etat).toBe('erreur')
    expect(d6.messages.map((m) => m.texte)).toEqual([
      'Gestionnaire « nina.exemple@exemple.test » : pas de fiche au cabinet',
      'Gestionnaire « max.exemple@ailleurs.test » : pas de fiche au cabinet',
    ])
    // Panneau « n gestionnaires n'ont pas de fiche » : nom proposé depuis l'adresse, domaine du cabinet ou non.
    expect(v.gestionnairesInconnus).toEqual([
      { email: 'nina.exemple@exemple.test', nomPropose: 'Nina Exemple', dansDomaines: true, lignes: [6] },
      { email: 'max.exemple@ailleurs.test', nomPropose: 'Max Exemple', dansDomaines: false, lignes: [6] },
    ])
  })

  it('par nom (sans adresse) : reconnu sans accent ni casse ; homonymes → erreur ; nom inconnu → erreur', () => {
    const v = diagnostiquerImportQr([
      ligne(2, { nomsGestionnaires: ['MARIE exemple'] }),
      ligne(3, { nomsGestionnaires: ['Jean Exemple'] }),
      ligne(4, { nomsGestionnaires: ['Zoé Exemple'] }),
      ligne(5, { nomsGestionnaires: ['Paul Exemple'] }),
    ], contexte)
    expect(v.diagnostics[0]).toMatchObject({ etat: 'a_creer', gestionnaires: [{ id: G1 }] })
    expect(v.diagnostics[1].messages[0].texte).toMatch(/plusieurs fiches portent ce nom/)
    expect(v.diagnostics[2].messages[0].texte).toBe('Gestionnaire « Zoé Exemple » : pas de fiche au cabinet')
    expect(v.diagnostics[3].messages[0].texte).toMatch(/fiche désactivée/)
    expect(v.gestionnairesInconnus).toEqual([])
  })
})

describe('diagnostics : destinataires supplémentaires (RG-06 bis, RG-02)', () => {
  it('adresse d’une fiche active → mise dans Gestionnaire(s) ; fiche désactivée ou d’un autre cabinet → retirée ; hors domaines → à confirmer', () => {
    const v = diagnostiquerImportQr([ligne(2, {
      emailsDestinataires: ['MARIE.exemple@exemple.test', 'paul.exemple@exemple.test', 'zoe.exemple@autre-exemple.test', 'cs@externe.test', 'gardien@exemple.test'],
    })], contexte)
    const d = v.diagnostics[0]
    expect(d.etat).toBe('avertissement')
    expect(d.action).toBe('creer')
    expect(d.gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    expect(d.emailsDestinataires).toEqual(['cs@externe.test', 'gardien@exemple.test'])
    expect(d.emailsHorsDomaine).toEqual(['cs@externe.test'])
    expect(d.messages.every((m) => m.niveau === 'avertissement')).toBe(true)
    expect(d.messages).toHaveLength(4)
    expect(v.horsDomaine).toBe(true)
  })

  it('aucun domaine renseigné : aucun contrôle de domaine', () => {
    const v = diagnostiquerImportQr([ligne(2, { emailsDestinataires: ['cs@externe.test'] })], { ...contexte, domaines: [] })
    expect(v.diagnostics[0]).toMatchObject({ etat: 'a_creer', emailsHorsDomaine: [] })
    expect(v.horsDomaine).toBe(false)
  })
})

describe('diagnostics : doublons (mêmes clés que la saisie, SPEC § 1.6)', () => {
  it('dans le fichier : la seconde occurrence d’un doublon certain est en erreur ; un doublon probable avertit', () => {
    const v = diagnostiquerImportQr([
      ligne(2, { nom: 'Villa Exemple', codePostal: '13002' }),
      ligne(3, { nom: 'Résidence Villa Exemple', codePostal: '13002' }),
      ligne(4, { nom: 'Mas Exemple', immatriculation: 'CD7654321' }),
      ligne(5, { nom: 'Autre Exemple', immatriculation: 'CD7654321' }),
      ligne(6, { nom: 'Villa Exemple', codePostal: '13003' }),
    ], contexte)
    const etats = v.diagnostics.map((d) => [d.numeroLigne, d.etat, d.action])
    expect(etats).toEqual([[2, 'a_creer', 'creer'], [3, 'doublon_fichier', 'aucune'], [4, 'a_creer', 'creer'], [5, 'doublon_fichier', 'aucune'], [6, 'avertissement', 'creer']])
    expect(v.diagnostics[1].messages[0].texte).toBe('Doublon de la ligne 2')
    expect(v.diagnostics[4].messages[0].texte).toBe('Ressemble à la ligne 2')
  })

  it('avec l’existant : certain → « Existe déjà », ignorée par défaut, « Compléter la fiche existante » sur demande', () => {
    const v = diagnostiquerImportQr([
      ligne(2, { nom: 'Autre nom', immatriculation: 'AB1234567' }),
      ligne(3, { nom: 'Autre nom 2', referenceCabinet: 'REF-01', actionSiExiste: 'completer', coproprieteExistanteId: E1 }),
    ], contexte)
    expect(v.diagnostics[0]).toMatchObject({
      etat: 'existe_deja', action: 'ignorer',
      doublon: { certitude: 'certain', critere: 'immatriculation', forcable: false, copropriete: { id: E1, nom: 'Résidence Le Parc', ville: 'Marseille' } },
    })
    expect(v.diagnostics[0].messages[0].texte).toBe('Existe déjà : « Résidence Le Parc » (Marseille), même n° d’immatriculation')
    expect(v.diagnostics[1]).toMatchObject({ etat: 'existe_deja', action: 'completer' })
    // La copropriété à compléter n'est plus celle du doublon : erreur (à revérifier).
    const autre = diagnostiquerImportQr([ligne(4, { nom: 'Autre nom 3', immatriculation: 'AB1234567', actionSiExiste: 'completer', coproprieteExistanteId: E2 })], contexte)
    expect(autre.diagnostics[0]).toMatchObject({ etat: 'erreur', action: 'aucune' })
  })

  it('nom + CP (« Résidence Le Parc » = « LE PARC ») : « Ce n’est pas un doublon » crée quand même ; probable : créée par défaut, décochable', () => {
    const v = diagnostiquerImportQr([
      ligne(2, { nom: 'LE PARC', codePostal: '13008' }),
      ligne(4, { nom: 'Les Tilleuls', codePostal: '13009' }),
      ligne(5, { nom: 'Tilleuls', codePostal: '13010', creerSiDoublonProbable: false }),
    ], contexte)
    expect(v.diagnostics[0]).toMatchObject({ etat: 'existe_deja', action: 'ignorer', doublon: { critere: 'nom_code_postal', forcable: true } })
    expect(v.diagnostics[1]).toMatchObject({ etat: 'avertissement', action: 'creer', doublon: { certitude: 'probable', critere: 'nom' } })
    expect(v.diagnostics[2]).toMatchObject({ etat: 'avertissement', action: 'ignorer' })
    const force = diagnostiquerImportQr([ligne(3, { nom: 'Le Parc', codePostal: '13008', forcerDoublon: true })], contexte)
    expect(force.diagnostics[0]).toMatchObject({ etat: 'existe_deja', action: 'creer' })
  })

  it('actionImportQr : décision d’une ligne selon son doublon et ses choix (recalculée à l’écran quand le choix change)', () => {
    const certain = { certitude: 'certain', critere: 'nom_code_postal', forcable: true, copropriete: { id: E1, nom: 'x', ville: '' } } as const
    const choix = { actionSiExiste: 'ignorer', forcerDoublon: false, creerSiDoublonProbable: true } as const
    expect(actionImportQr(null, choix)).toEqual({ action: 'creer', forcerDoublon: false })
    expect(actionImportQr(certain, choix)).toEqual({ action: 'ignorer', forcerDoublon: false })
    expect(actionImportQr(certain, { ...choix, forcerDoublon: true })).toEqual({ action: 'creer', forcerDoublon: true })
    expect(actionImportQr(certain, { ...choix, actionSiExiste: 'completer', coproprieteExistanteId: E1 })).toEqual({ action: 'completer', forcerDoublon: false })
    expect(actionImportQr({ ...certain, forcable: false, critere: 'immatriculation' }, { ...choix, forcerDoublon: true })).toEqual({ action: 'ignorer', forcerDoublon: false })
  })
})

describe('lignes envoyées à signalements_qr_creer_coproprietes (un seul appel, tout ou rien)', () => {
  it('créées et complétées seulement ; erreurs et ignorées exclues ; origine « import » ; cleNom calculée ; adresses nettoyées', () => {
    const lignes = [
      ligne(2, { nom: 'Villa Exemple', codePostal: '13002', gestionnaires: ['marie.exemple@exemple.test'], emailsDestinataires: ['cs@externe.test', 'marie.exemple@exemple.test'], batiments: ['A'] }),
      ligne(3, { nom: 'Autre nom', immatriculation: 'AB1234567' }),
      ligne(4, { nom: 'Autre nom 2', referenceCabinet: 'REF-01', actionSiExiste: 'completer', coproprieteExistanteId: E1, adresse: '9 rue Exemple', emailsDestinataires: ['cs@externe.test'] }),
      ligne(5, { gestionnaires: ['paul.exemple@exemple.test'] }),
      ligne(6, { nom: 'Le Parc', codePostal: '13008', forcerDoublon: true }),
    ]
    const verification = diagnostiquerImportQr(lignes, contexte)
    const plan = planCreationImportQr(lignes, verification)
    expect(plan.ignorees).toBe(1)
    expect(plan.erreurs).toBe(1)
    expect(plan.lignesSql).toEqual([
      {
        numeroLigne: 2, action: 'creer', origine: 'import', nom: 'Villa Exemple', cleNom: cleNomCoproQr('Villa Exemple'), adresse: '', codePostal: '13002',
        ville: '', immatriculation: '', referenceCabinet: '', batiments: ['A'], emails: ['cs@externe.test'], gestionnaireIds: [G1], forcerDoublon: false,
      },
      {
        numeroLigne: 4, action: 'completer', origine: 'import', coproprieteId: E1, nom: 'Autre nom 2', cleNom: cleNomCoproQr('Autre nom 2'), adresse: '9 rue Exemple',
        codePostal: '', ville: '', immatriculation: '', referenceCabinet: 'REF-01', batiments: [], emails: [], gestionnaireIds: [], forcerDoublon: false,
      },
      {
        numeroLigne: 6, action: 'creer', origine: 'import', nom: 'Le Parc', cleNom: cleNomCoproQr('Le Parc'), adresse: '', codePostal: '13008', ville: '',
        immatriculation: '', referenceCabinet: '', batiments: [], emails: [], gestionnaireIds: [], forcerDoublon: true,
      },
    ])
    // « Compléter » : les destinataires de la ligne ne sont pas repris (la fonction SQL ne remplit que les champs vides).
    expect(verification.diagnostics[2].messages.map((m) => m.texte)).toContain('Destinataires non repris : la fiche existante garde les siens')
  })
})
