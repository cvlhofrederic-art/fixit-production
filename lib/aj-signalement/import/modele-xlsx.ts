// ── AJ Signalement : modèle d'import à télécharger (.xlsx et CSV), généré dans le NAVIGATEUR ─────────────────────
//
// SPEC § 1.9.3 : ni fichier binaire dans le dépôt, ni script tiers. Le classeur est écrit ici (XML SpreadsheetML minimal,
// cellules en texte « inlineStr » pour que « 06000 » reste « 06000 ») et zippé par fflate (zipSync, entrées stockées),
// chargé par await import() au clic (« Télécharger le modèle ») : jamais dans le bundle du Worker. Le lecteur
// (lecteur-xlsx.ts) relit exactement ce que ce module écrit (test aller-retour).
//   - feuille « Copropriétés » : les en-têtes du modèle et deux lignes d'exemple FICTIVES ;
//   - feuille « Mode d'emploi » : une ligne par colonne (rôle, obligatoire, format, exemple) ;
//   - variante CSV : UTF-8 avec BOM, séparateur « ; » (Excel l'ouvre tel quel).

import { COLONNES_MODELE_IMPORT_QR } from '@/lib/aj-signalement/import/ligne'
import { celluleCsvQr } from '@/lib/aj-signalement/import/export-csv'

const OBLIGATOIRE: Record<'oui' | 'conseille' | 'non', string> = { oui: 'Oui', conseille: 'Conseillé', non: 'Non' }

/** Feuille « Copropriétés » : en-têtes et deux exemples fictifs (aucune donnée réelle). */
export function lignesModeleImportQr(): string[][] {
  const entetes = COLONNES_MODELE_IMPORT_QR.map((c) => c.entete)
  const exemple1: Record<string, string> = {
    nom: 'Résidence Exemple', adresse: '1 rue Exemple', codePostal: '13008', ville: 'Marseille', immatriculation: 'AB1234567',
    referenceCabinet: 'REF-001', batiments: 'A;B', gestionnaires: 'prenom.nom@exemple.test', emailsDestinataires: 'conseil.syndical@exemple.test',
  }
  const exemple2: Record<string, string> = {
    nom: 'Villa Exemple', adresse: '2 avenue Exemple', codePostal: '06000', ville: 'Nice', immatriculation: '', referenceCabinet: 'REF-002',
    batiments: '', gestionnaires: 'prenom.nom@exemple.test', emailsDestinataires: '',
  }
  return [entetes, COLONNES_MODELE_IMPORT_QR.map((c) => exemple1[c.champ]), COLONNES_MODELE_IMPORT_QR.map((c) => exemple2[c.champ])]
}

/** Feuille « Mode d'emploi » : une ligne par colonne. */
export function lignesModeEmploiImportQr(): string[][] {
  return [
    ['Colonne', 'Obligatoire', 'Format', 'Exemple'],
    ...COLONNES_MODELE_IMPORT_QR.map((c) => [c.entete, OBLIGATOIRE[c.obligatoire], c.format, c.exemple]),
  ]
}

const echapperXml = (texte: string): string =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** « A », « B »… « AA » : lettre de la colonne (index à partir de 0). */
function lettreColonne(index: number): string {
  let n = index + 1
  let lettres = ''
  while (n > 0) {
    const reste = (n - 1) % 26
    lettres = String.fromCharCode(65 + reste) + lettres
    n = Math.floor((n - 1) / 26)
  }
  return lettres
}

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

function feuilleXml(lignes: readonly (readonly string[])[]): string {
  const rangs = lignes.map((cellules, i) => {
    const c = cellules.map((valeur, j) => {
      const ref = `${lettreColonne(j)}${i + 1}`
      const style = i === 0 ? ' s="1"' : ''
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${echapperXml(valeur)}</t></is></c>`
    }).join('')
    return `<row r="${i + 1}">${c}</row>`
  }).join('')
  const largeur = Math.max(1, ...lignes.map((l) => l.length))
  return `${ENTETE_XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols><col min="1" max="${largeur}" width="30" customWidth="1"/></cols><sheetData>${rangs}</sheetData></worksheet>`
}

/** Fichiers du classeur (texte), pour zipSync. */
function fichiersClasseur(feuilles: ReadonlyArray<{ nom: string; lignes: string[][] }>): Record<string, string> {
  const fichiers: Record<string, string> = {
    '[Content_Types].xml': `${ENTETE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '</Types>',
    '_rels/.rels': `${ENTETE_XML}<Relationships xmlns="${NS_RELS}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${ENTETE_XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
      + feuilles.map((f, i) => `<sheet name="${echapperXml(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
      + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `${ENTETE_XML}<Relationships xmlns="${NS_RELS}">`
      + feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${feuilles.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`,
    // Styles minimaux : police normale (0) et grasse (1) pour la ligne d'en-têtes.
    'xl/styles.xml': `${ENTETE_XML}<styleSheet xmlns="${NS}">`
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>',
  }
  feuilles.forEach((f, i) => { fichiers[`xl/worksheets/sheet${i + 1}.xml`] = feuilleXml(f.lignes) })
  return fichiers
}

/** Octets du modèle .xlsx (feuilles « Copropriétés » et « Mode d'emploi »), fflate chargé à l'appel. */
export async function octetsModeleXlsxQr(): Promise<Uint8Array> {
  const { strToU8, zipSync } = await import('fflate')
  const fichiers = fichiersClasseur([
    { nom: 'Copropriétés', lignes: lignesModeleImportQr() },
    { nom: 'Mode d’emploi', lignes: lignesModeEmploiImportQr() },
  ])
  const entrees: Record<string, Uint8Array> = {}
  for (const [nom, texte] of Object.entries(fichiers)) entrees[nom] = strToU8(texte)
  return zipSync(entrees, { level: 0 })
}

/** Modèle CSV : UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF. */
export function modeleCsvQr(): string {
  return `﻿${lignesModeleImportQr().map((l) => l.map(celluleCsvQr).join(';')).join('\r\n')}\r\n`
}
