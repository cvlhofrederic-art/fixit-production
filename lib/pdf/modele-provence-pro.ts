/**
 * Modèle de devis et de facture propre à PROVENCE PRO (SAS, SIREN 131 197 253).
 *
 * Reproduit le modèle fourni par la société (Devis_ProvencePro_modele_vierge.html) :
 * logo et nom centrés, filet orange, prestations groupées en lots (A, B…) avec
 * sous-total, codes A1, A2…, réserves et précisions, mentions légales de la SAS.
 *
 * Seule la fiche PROVENCE_PRO_PROFIL_ID reçoit ce modèle : toutes les autres
 * sociétés gardent le modèle BTP par défaut (lib/pdf/devis-pdf-v3.ts), qui
 * appelle les fonctions de ce fichier uniquement quand `modele === 'provence-pro'`.
 */

import type { jsPDF } from 'jspdf'
import type { ProductLine } from '@/lib/devis-types'
import { formatUnitForPdf } from '@/lib/devis-utils'
import { POLICE_NOM_PROVENCE_PRO_TTF_BASE64 } from '@/lib/pdf/provence-pro-police'

/** Fiche profiles_artisan de PROVENCE PRO. */
export const PROVENCE_PRO_PROFIL_ID = '4397dc9e-d115-47cc-ae6b-cfeedc971eb5'

export type ModeleDocument = 'provence-pro'

/** Modèle de document propre à une société, ou undefined pour le modèle par défaut. */
export function modeleDocumentSociete(profilId: string | null | undefined): ModeleDocument | undefined {
  return profilId === PROVENCE_PRO_PROFIL_ID ? 'provence-pro' : undefined
}

export const COULEURS_PROVENCE_PRO = {
  accent: '#c2410c',
  texte: '#1a1c1e',
  texteClair: '#888888',
  fond: '#f5f5f2',
  bordure: '#e0e0db',
  bandeau: '#e6e6e1',
  taupe: '#7a7166',
  description: '#555555',
  secondaire: '#3a3a3a',
  echeancier: '#666666',
  blanc: '#ffffff',
} as const

const C = COULEURS_PROVENCE_PRO
const pt = (v: number) => v / 2.835 // points → millimètres

// ─── Réserves et précisions ──────────────────────────────────────────────────

export const CLES_RESERVES = [
  'Base du devis',
  'Périmètre',
  'Quantités',
  'Prérequis',
  'Non compris',
  'Démarrage et délai',
  'Révision des prix',
  'TVA',
] as const
export type CleReserve = (typeof CLES_RESERVES)[number]

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Le formulaire n'a pas de champ « réserves » : les lignes de la case Notes qui
 * commencent par un titre du tableau (« Non compris : … ») y sont rangées, de
 * même que « Références : … », affichée sous le numéro du devis. Les autres
 * lignes restent des notes. Titres reconnus sans tenir compte des accents ni
 * des majuscules.
 */
export function extraireReserves(notes: string): {
  reserves: Partial<Record<CleReserve, string>>
  references: string
  notesRestantes: string
} {
  const reserves: Partial<Record<CleReserve, string>> = {}
  const references: string[] = []
  const restantes: string[] = []
  for (const ligne of (notes || '').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([^:]{2,40}?)\s*:\s*(.+?)\s*$/)
    const cle = m ? sansAccents(m[1]) : ''
    const reserve = m ? CLES_RESERVES.find(c => sansAccents(c) === cle) : undefined
    if (m && reserve) {
      reserves[reserve] = reserves[reserve] ? `${reserves[reserve]} ${m[2]}` : m[2]
    } else if (m && (cle === 'references' || cle === 'reference')) {
      references.push(m[2])
    } else {
      restantes.push(ligne)
    }
  }
  return { reserves, references: references.join(' ; '), notesRestantes: restantes.join('\n').trim() }
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « octobre 2026 » pour une date ISO, chaîne vide si la date est illisible. */
export function moisAnnee(dateIso: string): string {
  const m = (dateIso || '').match(/^(\d{4})-(\d{2})/)
  if (!m) return ''
  const mois = MOIS[Number(m[2]) - 1]
  return mois ? `${mois} ${m[1]}` : ''
}

const tauxFr = (taux: number) => `${String(taux).replace('.', ',')} %`

/** Ligne « TVA » des réserves : taux appliqués et leur fondement. */
export function texteTvaReserve(regime: 'classique' | 'franchise_293b' | 'autoliquidation_btp', taux: number[]): string {
  if (regime === 'autoliquidation_btp') return 'Autoliquidation : TVA due par le preneur (art. 283-2 nonies CGI).'
  if (regime === 'franchise_293b') return 'TVA non applicable (art. 293 B CGI).'
  const distincts = Array.from(new Set(taux.filter(t => t > 0))).sort((a, b) => b - a)
  if (distincts.length === 0) return ''
  const parTaux = distincts.map(t => {
    if (t === 20) return '20 % (taux normal)'
    if (t === 10) return "10 % (art. 279-0 bis CGI : locaux d'habitation achevés depuis plus de 2 ans)"
    if (t === 5.5) return '5,5 % (art. 278-0 bis A CGI : rénovation énergétique)'
    return tauxFr(t)
  })
  return `${parTaux.join(' ; ')}.`
}

/** Lignes du tableau « Réserves et précisions », dans l'ordre du modèle, sans ligne vide. */
export function lignesReserves(opts: {
  reserves: Partial<Record<CleReserve, string>>
  executionDelay: string
  docDate: string
  regime: 'classique' | 'franchise_293b' | 'autoliquidation_btp'
  taux: number[]
}): Array<{ cle: CleReserve; valeur: string }> {
  const lignes: Array<{ cle: CleReserve; valeur: string }> = []
  const mois = moisAnnee(opts.docDate)
  for (const cle of CLES_RESERVES) {
    let valeur = opts.reserves[cle] || ''
    if (!valeur && cle === 'Démarrage et délai' && opts.executionDelay) {
      valeur = `Durée d'exécution : ${opts.executionDelay}.`
    }
    if (!valeur && cle === 'Révision des prix' && mois) {
      valeur = `Prix établis aux conditions économiques de ${mois}, fermes pour un démarrage dans les 3 mois ; au-delà, révisés au démarrage selon P = P0 × BT01 du mois de démarrage ÷ BT01 de ${mois}.`
    }
    if (!valeur && cle === 'TVA') valeur = texteTvaReserve(opts.regime, opts.taux)
    if (valeur) lignes.push({ cle, valeur })
  }
  return lignes
}

// ─── Mentions légales ────────────────────────────────────────────────────────

/** Début des mentions légales : identité de la SAS, comme dans le modèle. */
export function identiteLegale(opts: {
  companyName: string
  companyCapital: string
  companyAddress: string
  companyRCS: string
  companySiret: string
  companyAPE: string
}): string {
  const nom = (opts.companyName || 'PROVENCE PRO').toUpperCase()
  let texte = `${nom} · SAS (société par actions simplifiée)`
  if (opts.companyCapital) texte += ` au capital de ${opts.companyCapital.replace(/\s*(€|EUR)\s*$/i, '')} €`
  texte += '.'
  if (opts.companyAddress) texte += ` Siège : ${adresseSurUneLigne(opts.companyAddress)}.`
  if (opts.companyRCS) {
    const rcs = opts.companyRCS.trim()
    texte += ` ${/^R\.?C\.?S\.?\b/i.test(rcs) ? rcs : `RCS ${rcs}`}.`
  }
  if (opts.companySiret) texte += ` SIRET : ${opts.companySiret}.`
  if (opts.companyAPE) texte += ` APE : ${opts.companyAPE}.`
  return texte
}

/** « 205 Chemin du Haut des Plaines 13650 Meyrargues » → « 205 Chemin du Haut des Plaines, 13650 Meyrargues ». */
export function adresseSurUneLigne(adresse: string): string {
  const m = adresse.trim().match(/^(.+?)[\s,]+(\d{5}\s+.+)$/)
  return m ? `${m[1].replace(/[\s,]+$/, '')}, ${m[2].trim()}` : adresse.trim()
}

// ─── Texte enrichi (gras, italique, couleur) avec retour à la ligne ──────────

export interface Segment {
  texte: string
  style?: 'normal' | 'bold' | 'italic'
  couleur?: string
}
type Mot = { texte: string; style: 'normal' | 'bold' | 'italic'; couleur: string; largeur: number; espace: boolean }

/** Découpe des segments en lignes de largeur maximale `largeur` (mm), à la taille de police courante. */
export function composer(pdf: jsPDF, segments: Segment[], largeur: number, taille: number): Mot[][] {
  pdf.setFontSize(taille)
  const mots: Mot[] = []
  for (const seg of segments) {
    const style = seg.style || 'normal'
    pdf.setFont('helvetica', style)
    const couleur = seg.couleur || C.texte
    for (const morceau of seg.texte.split(/(\s+)/)) {
      if (!morceau) continue
      const espace = /^\s+$/.test(morceau)
      const texte = espace ? ' ' : morceau
      mots.push({ texte, style, couleur, largeur: pdf.getTextWidth(texte), espace })
    }
  }
  const lignes: Mot[][] = []
  let ligne: Mot[] = []
  let x = 0
  const pousser = () => {
    while (ligne.length && ligne[ligne.length - 1].espace) ligne.pop()
    if (ligne.length) lignes.push(ligne)
    ligne = []
    x = 0
  }
  for (const mot of mots) {
    if (mot.espace && ligne.length === 0) continue
    if (!mot.espace && x + mot.largeur > largeur && ligne.length > 0) pousser()
    if (!mot.espace && mot.largeur > largeur) {
      // Mot plus long que la ligne : coupé caractère par caractère
      pdf.setFont('helvetica', mot.style)
      let reste = mot.texte
      while (reste) {
        let n = reste.length
        while (n > 1 && pdf.getTextWidth(reste.slice(0, n)) > largeur - x) n--
        const part = reste.slice(0, n)
        ligne.push({ ...mot, texte: part, largeur: pdf.getTextWidth(part) })
        reste = reste.slice(n)
        if (reste) pousser()
        else x += pdf.getTextWidth(part)
      }
      continue
    }
    ligne.push(mot)
    x += mot.largeur
  }
  pousser()
  return lignes
}

function ecrireLigne(pdf: jsPDF, ligne: Mot[], x: number, y: number, taille: number) {
  pdf.setFontSize(taille)
  let cx = x
  for (const mot of ligne) {
    if (!mot.espace) {
      pdf.setFont('helvetica', mot.style)
      pdf.setTextColor(mot.couleur)
      pdf.text(mot.texte, cx, y)
    }
    cx += mot.largeur
  }
}

// ─── En-tête : logo, nom, objet, numéro, filet orange ────────────────────────

const POLICE_NOM = 'ProvenceProNom'

function chargerPoliceNom(pdf: jsPDF): boolean {
  try {
    const polices = pdf.getFontList() as Record<string, string[]>
    if (!polices[POLICE_NOM]) {
      pdf.addFileToVFS('provence-pro-nom.ttf', POLICE_NOM_PROVENCE_PRO_TTF_BASE64)
      pdf.addFont('provence-pro-nom.ttf', POLICE_NOM, 'normal')
    }
    return true
  } catch {
    return false // police illisible : le nom passe en Helvetica gras, sans bloquer le PDF
  }
}

/** Logo rond (deux P blancs sur disque orange), tracé en vectoriel. `d` = diamètre en mm. */
export function dessinerLogo(pdf: jsPDF, x: number, y: number, d: number) {
  const s = d / 100 // le dessin d'origine est sur une grille de 100 × 100
  const k = 0.5523 // quart de cercle en courbe de Bézier
  pdf.setFillColor(C.accent)
  pdf.circle(x + 50 * s, y + 50 * s, 48 * s, 'F')
  pdf.setLineCap('round')
  pdf.setLineJoin('round')
  const tracerP = (ox: number, couleur: string, epaisseur: number) => {
    const X = (u: number) => x + u * s
    const Y = (v: number) => y + v * s
    // Boucle du P : demi-cercle de rayon 12,5 centré sur (ox + 16 ; 36,5)
    const cx = ox + 16, cy = 36.5, r = 12.5
    pdf.setDrawColor(couleur)
    pdf.setLineWidth(epaisseur * s)
    pdf.moveTo(X(ox), Y(24)); pdf.lineTo(X(ox), Y(78))
    pdf.moveTo(X(ox), Y(24)); pdf.lineTo(X(cx), Y(24))
    pdf.curveTo(X(cx + k * r), Y(cy - r), X(cx + r), Y(cy - k * r), X(cx + r), Y(cy))
    pdf.curveTo(X(cx + r), Y(cy + k * r), X(cx + k * r), Y(cy + r), X(cx), Y(cy + r))
    pdf.lineTo(X(ox), Y(49))
    pdf.stroke()
  }
  tracerP(53, C.blanc, 8.5)
  tracerP(35, C.accent, 13)
  tracerP(35, C.blanc, 8.5)
  pdf.setLineCap('butt')
  pdf.setLineJoin('miter')
}

/**
 * En-tête du modèle, en haut de la première page. Retourne l'ordonnée sous le
 * filet orange.
 *  - titre : objet des travaux ; adresse : adresse du chantier
 *  - mentions : lignes sous le numéro (références, type de facture…)
 */
export function dessinerEnTete(pdf: jsPDF, opts: {
  pageW: number
  largeur: number
  x: number
  titre: string
  adresse: string
  numero: string
  mentions: Array<{ texte: string; gras?: boolean }>
}): number {
  const { pageW } = opts
  const haut = pt(34)
  const diametre = pt(50)
  const ecart = pt(11)
  const slogan = 'CONSTRUCTION · RÉNOVATION'
  const espacement = pt(2.75)

  // Largeurs du bloc logo + nom, centré sur la page
  const policeOk = chargerPoliceNom(pdf)
  pdf.setFont(policeOk ? POLICE_NOM : 'helvetica', policeOk ? 'normal' : 'bold')
  pdf.setFontSize(26)
  const largeurProvence = pdf.getTextWidth('Provence')
  const largeurNom = largeurProvence + pdf.getTextWidth('Pro')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.6)
  const largeurSlogan = pdf.getTextWidth(slogan) + espacement * (slogan.length - 1)
  const largeurBloc = diametre + ecart + Math.max(largeurNom, largeurSlogan)
  const x0 = pageW / 2 - largeurBloc / 2

  dessinerLogo(pdf, x0, haut, diametre)
  const xNom = x0 + diametre + ecart
  pdf.setFont(policeOk ? POLICE_NOM : 'helvetica', policeOk ? 'normal' : 'bold')
  pdf.setFontSize(26)
  pdf.setTextColor(C.texte)
  pdf.text('Provence', xNom, haut + 9.4)
  pdf.setTextColor(C.accent)
  pdf.text('Pro', xNom + largeurProvence, haut + 9.4)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.6)
  pdf.setTextColor(C.taupe)
  pdf.text(slogan, xNom, haut + 14.6, { charSpace: espacement })

  // Objet des travaux et adresse du chantier
  let y = haut + diametre + pt(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(C.texte)
  const lignesTitre = [
    ...(pdf.splitTextToSize(opts.titre, opts.largeur) as string[]),
    ...(opts.adresse ? (pdf.splitTextToSize(opts.adresse, opts.largeur) as string[]) : []),
  ]
  for (const l of lignesTitre) {
    pdf.text(l, pageW / 2, y + pt(9.3), { align: 'center' })
    y += pt(12.5)
  }

  // Numéro du document
  y += pt(6.2)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(C.texteClair)
  pdf.text(opts.numero, pageW / 2, y + pt(8.2), { align: 'center' })
  y += pt(10.4)

  // Mentions sous le numéro
  for (const m of opts.mentions) {
    if (!m.texte) continue
    y += pt(2.2)
    pdf.setFont('helvetica', m.gras ? 'bold' : 'normal')
    pdf.setFontSize(m.gras ? 8 : 7.6)
    pdf.setTextColor(m.gras ? C.texte : C.texteClair)
    const lignes = pdf.splitTextToSize(m.texte, opts.largeur) as string[]
    for (const l of lignes) {
      pdf.text(l, pageW / 2, y + pt(7), { align: 'center' })
      y += pt(9.4)
    }
  }

  // Filet orange
  y += pt(8.2)
  pdf.setFillColor(C.accent)
  pdf.rect(opts.x, y, opts.largeur, pt(3), 'F')
  return y + pt(3)
}

// ─── Tableau des prestations, groupées en lots ──────────────────────────────

export interface LotPrestations {
  /** Intitulé du lot ; vide = pas de bandeau (document sans section). */
  nom: string
  lignes: ProductLine[]
}

const lettreLot = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : lettreLot(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26))

const quantiteFr = (q: number) =>
  Number.isFinite(q) ? q.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/[\u202F\u00A0]/g, ' ') : String(q)

const arrondi = (n: number) => Math.round(n * 100) / 100

/** Sépare « Mesurage : … » du reste d'un descriptif (affiché en romain dans le modèle). */
export function separerMesurage(texte: string): { descriptif: string; mesurage: string } {
  const m = texte.match(/^([\s\S]*?)\s*(Mesurage\s*:[\s\S]*)$/i)
  return m ? { descriptif: m[1].trim(), mesurage: m[2].trim() } : { descriptif: texte.trim(), mesurage: '' }
}

const avecPoint = (s: string) => (/[.!?:;…]$/.test(s) ? s : `${s}.`)

/**
 * Dessine l'en-tête noir du tableau puis les lots. Chaque prestation forme un
 * bloc gris qui ne se coupe pas entre deux pages (sauf s'il dépasse une page
 * entière) ; le bandeau d'un lot reste toujours avec sa première prestation.
 * Retourne l'ordonnée sous le tableau.
 */
export function dessinerPrestations(pdf: jsPDF, opts: {
  x: number
  y: number
  largeur: number
  hautPage: number
  basPage: number
  lots: LotPrestations[]
  afficherTva: boolean
  autoliquidation: boolean
  libellePrix: string
  format: (n: number) => string
  nettoyer: (s: string) => string
}): number {
  const { x, largeur, hautPage, basPage, format, nettoyer } = opts
  const pdfAny = pdf as unknown as { addPage: () => void }
  // Largeurs du modèle (pt), ramenées à la largeur utile
  const largeursPt = opts.afficherTva ? [223, 44, 34, 66, 38, 88.24] : [261, 44, 34, 66, 88.24]
  const totalPt = largeursPt.reduce((a, b) => a + b, 0)
  const cols = largeursPt.map(w => (w / totalPt) * largeur)
  const debuts = cols.map((_, i) => x + cols.slice(0, i).reduce((a, b) => a + b, 0))
  const centre = (i: number) => debuts[i] + cols[i] / 2
  const finTableau = x + largeur
  const derniere = cols.length - 1

  let y = opts.y

  // En-tête noir
  const hEntete = pt(26.21)
  const dessinerEntete = (y0: number) => {
    pdf.setFillColor(C.texte)
    pdf.rect(x, y0, largeur, hEntete, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(C.blanc)
    const yEntete = y0 + hEntete / 2 + 1
    const titres = opts.afficherTva
      ? ['Désignation', 'Qté', 'Unité', `Prix U. ${opts.libellePrix}`, 'TVA %', `Total ${opts.libellePrix}`]
      : ['Désignation', 'Qté', 'Unité', `Prix U. ${opts.libellePrix}`, `Total ${opts.libellePrix}`]
    pdf.text(titres[0], x + pt(8.5), yEntete)
    for (let i = 1; i < derniere; i++) pdf.text(titres[i], centre(i), yEntete, { align: 'center' })
    pdf.text(titres[derniere], finTableau - pt(7.8), yEntete, { align: 'right' })
  }

  const largeurDesignation = cols[0] - pt(8.5) - pt(8)
  const largeurDescriptif = largeur - pt(8.5) * 2
  const hLigne = pt(11.5)
  const hLigneDesc = pt(10.3)
  const hBandeau = pt(20.5)

  type Bloc = { h: number; dessiner: (y0: number) => void }

  const lots = opts.lots.map((lot, iLot) => {
    const lettre = lettreLot(iLot)
    const lignesLot = lot.lignes.filter(l => l && typeof l.description === 'string' && l.description.trim())
    const sousTotal = arrondi(lignesLot.reduce((s, l) => s + (l.totalHT || 0), 0))

    // Bandeau du lot
    const bandeau: Bloc | null = lot.nom ? {
      h: hBandeau + pt(2.5),
      dessiner: (y0) => {
        pdf.setFillColor(C.bandeau)
        pdf.rect(x, y0, largeur, hBandeau, 'F')
        pdf.setFillColor(C.accent)
        pdf.rect(x, y0, pt(3), hBandeau, 'F')
        const yTexte = y0 + hBandeau / 2 + 1
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9.5)
        pdf.setTextColor(C.texte)
        pdf.text(format(sousTotal), finTableau - pt(7.8), yTexte, { align: 'right' })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.4)
        pdf.setTextColor(C.texteClair)
        const xSousTotal = finTableau - cols[derniere] - pt(6)
        const libelle = `Sous-total lot ${lettre}`
        pdf.text(libelle, xSousTotal, yTexte, { align: 'right' })
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8.4)
        pdf.setTextColor(C.texte)
        const espacement = pt(0.6)
        const place = xSousTotal - pdf.getTextWidth(libelle) - pt(10) - (x + pt(10))
        let intitule = `LOT ${lettre} · ${nettoyer(lot.nom).toUpperCase()}`
        const largeurTexte = (s: string) => pdf.getTextWidth(s) + espacement * (s.length - 1)
        while (intitule.length > 8 && largeurTexte(intitule) > place) intitule = `${intitule.slice(0, -2)}…`
        pdf.text(intitule, x + pt(10), yTexte, { charSpace: espacement })
      },
    } : null

    // Une prestation = ligne principale (+ descriptif) dans un bloc gris
    const blocs: Bloc[] = lignesLot.map((l, iLigne) => {
      const code = lot.nom ? `${lettre}${iLigne + 1}` : `${iLigne + 1}`
      const propre = nettoyer(l.description.replace(/\s*\[[^\]]*\]/g, '').trim())
      const [titre, ...suite] = propre.split('\n')
      let detail = suite.join(' ').trim()
      const etapes = (l.etapes || [])
        .slice()
        .sort((a, b) => a.ordre - b.ordre)
        .map(e => nettoyer((e.designation || '').trim()))
        .filter(Boolean)
      if (etapes.length > 0) {
        const fleches = etapes.join(' → ')
        if (detail === fleches) detail = ''
        else if (detail.includes(fleches)) detail = detail.replace(fleches, '').trim()
      }
      const { descriptif: descLigne, mesurage } = separerMesurage(nettoyer((l.lineDetail || '').trim()))
      const morceaux = [
        detail ? avecPoint(detail) : '',
        descLigne ? avecPoint(descLigne) : '',
        ...etapes.map((e, i) => `${i + 1}. ${avecPoint(e)}`),
      ].filter(Boolean)
      const segmentsDesc: Segment[] = []
      if (morceaux.length) segmentsDesc.push({ texte: morceaux.join(' '), style: 'italic', couleur: C.description })
      if (mesurage) segmentsDesc.push({ texte: `${morceaux.length ? ' ' : ''}${avecPoint(mesurage)}`, couleur: C.secondaire })

      const lignesTitre = composer(pdf, [
        { texte: code, style: 'bold', couleur: C.accent },
        { texte: ' · ', couleur: C.texte },
        { texte: titre, couleur: C.texte },
      ], largeurDesignation, 10)
      const lignesDesc = segmentsDesc.length ? composer(pdf, segmentsDesc, largeurDescriptif, 8.6) : []
      const hPrincipal = pt(6.6) + lignesTitre.length * hLigne + (lignesDesc.length ? pt(1.8) : pt(6.4))
      const hDesc = lignesDesc.length ? pt(1.6) + lignesDesc.length * hLigneDesc + pt(6.4) : 0
      const ecartAvant = iLigne === 0 ? 0 : pt(2.5)

      const dessinerPrincipal = (y0: number) => {
        pdf.setFillColor(C.fond)
        pdf.rect(x, y0, largeur, hPrincipal, 'F')
        let yl = y0 + pt(6.6) + pt(8.7)
        const yValeurs = yl
        lignesTitre.forEach(lt => { ecrireLigne(pdf, lt, x + pt(8.5), yl, 10); yl += hLigne })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.setTextColor(C.texte)
        pdf.text(quantiteFr(l.qty), centre(1), yValeurs, { align: 'center' })
        pdf.text(formatUnitForPdf(l.unit, l.customUnit), centre(2), yValeurs, { align: 'center' })
        pdf.text(format(l.priceHT), centre(3), yValeurs, { align: 'center' })
        if (opts.afficherTva) {
          pdf.text(opts.autoliquidation ? '0 %' : tauxFr(l.tvaRate), centre(4), yValeurs, { align: 'center' })
        }
        pdf.setFont('helvetica', 'bold')
        pdf.text(format(l.totalHT), finTableau - pt(7.8), yValeurs, { align: 'right' })
      }
      const dessinerDesc = (y0: number, debut: number, fin: number, avecHaut: boolean, avecBas: boolean) => {
        const h = (avecHaut ? pt(1.6) : pt(3)) + (fin - debut) * hLigneDesc + (avecBas ? pt(6.4) : 0)
        pdf.setFillColor(C.fond)
        pdf.rect(x, y0, largeur, h, 'F')
        let yl = y0 + (avecHaut ? pt(1.6) : pt(3)) + pt(7.6)
        for (let i = debut; i < fin; i++) { ecrireLigne(pdf, lignesDesc[i], x + pt(8.5), yl, 8.6); yl += hLigneDesc }
        return h
      }
      return {
        h: ecartAvant + hPrincipal + hDesc,
        dessiner: (y0: number) => {
          // Bloc plus haut qu'une page : le descriptif continue sur la page suivante
          let yc = y0 + ecartAvant
          dessinerPrincipal(yc)
          yc += hPrincipal
          const n = lignesDesc.length
          let i = 0
          while (i < n) {
            const haut = i === 0 ? pt(1.6) : pt(3)
            let fin = n
            while (fin > i && yc + haut + (fin - i) * hLigneDesc + (fin === n ? pt(6.4) : 0) > basPage) fin--
            if (fin === i) {
              if (yc > hautPage) { pdfAny.addPage(); yc = hautPage; continue }
              fin = i + 1
            }
            yc += dessinerDesc(yc, i, fin, i === 0, fin === n)
            i = fin
          }
          y = yc
        },
      }
    })

    return { bandeau, blocs }
  })

  // Hauteur du bandeau et de la première prestation d'un lot (à garder ensemble)
  const hTete = (i: number) => (lots[i]?.bandeau?.h ?? 0) + (lots[i]?.blocs[0]?.h ?? 0)

  // L'en-tête noir ne reste jamais seul en bas de page : il suit le premier lot
  if (y + hEntete + Math.min(hTete(0), basPage - hautPage - hEntete) > basPage) { pdfAny.addPage(); y = hautPage }
  dessinerEntete(y)
  y += hEntete

  lots.forEach(({ bandeau, blocs }, iLot) => {
    if (iLot > 0) {
      y += pt(10)
      if (y + Math.min(hTete(iLot), basPage - hautPage) > basPage) { pdfAny.addPage(); y = hautPage }
    }
    if (bandeau) { bandeau.dessiner(y); y += bandeau.h }
    blocs.forEach((bloc, i) => {
      if (i > 0 && y + Math.min(bloc.h, basPage - hautPage) > basPage) { pdfAny.addPage(); y = hautPage }
      bloc.dessiner(y) // met y sous le bloc
    })
  })
  return y
}

// ─── Réserves et précisions ──────────────────────────────────────────────────

/** Tableau « Réserves et précisions » (devis). Retourne l'ordonnée sous le tableau. */
export function dessinerReserves(pdf: jsPDF, opts: {
  x: number
  y: number
  largeur: number
  hautPage: number
  basPage: number
  lignes: Array<{ cle: string; valeur: string }>
}): number {
  const { x, largeur, hautPage, basPage } = opts
  if (opts.lignes.length === 0) return opts.y
  const pdfAny = pdf as unknown as { addPage: () => void }
  const largeurCle = pt(100)
  const largeurValeur = largeur - largeurCle
  const hLigne = pt(10.1)
  pdf.setFontSize(8.2)
  pdf.setFont('helvetica', 'normal')
  const rangs = opts.lignes.map(r => {
    pdf.setFont('helvetica', 'bold')
    const cle = pdf.splitTextToSize(r.cle, largeurCle - pt(8)) as string[]
    pdf.setFont('helvetica', 'normal')
    const valeur = pdf.splitTextToSize(r.valeur, largeurValeur) as string[]
    return { cle, valeur, h: pt(6.8) + Math.max(cle.length, valeur.length) * hLigne }
  })

  let y = opts.y + pt(16)
  const hTitre = pt(13) + pt(5)
  if (y + hTitre + rangs[0].h > basPage) { pdfAny.addPage(); y = hautPage }
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9.5)
  pdf.setTextColor(C.texte)
  pdf.text('RÉSERVES ET PRÉCISIONS', x, y + pt(9.8))
  y += hTitre
  for (const r of rangs) {
    if (y + r.h > basPage) { pdfAny.addPage(); y = hautPage }
    pdf.setDrawColor(C.bordure)
    pdf.setLineWidth(pt(0.51))
    pdf.line(x, y, x + largeur, y)
    const yTexte = y + pt(3.4) + pt(7.6)
    pdf.setFontSize(8.2)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(C.texte)
    pdf.text(r.cle, x, yTexte)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(C.secondaire)
    pdf.text(r.valeur, x + largeurCle, yTexte, { lineHeightFactor: 10.1 / 8.2 })
    y += r.h
  }
  return y
}
