/**
 * Moteur de mise en page commun aux gabarits de société dessinés avec jsPDF en points
 * (lib/pdf/modele-method-solucoes.ts, lib/pdf/modele-vitfix-orcamento.ts) : mesure et coupure du texte
 * comme le navigateur des gabarits HTML d'origine, marges fusionnées comme en CSS, blocs insécables,
 * police Liberation Sans et photos chargées à la génération.
 *
 * Chaque gabarit garde ses couleurs, ses tailles et son ordre de blocs ; seul ce qui est identique d'un
 * gabarit à l'autre vit ici. Extrait du gabarit Method Soluções sans changer son rendu.
 */

import { fondBlancAvantJpeg } from '@/lib/pdf/images-pdf'

type Pdf = import('jspdf').jsPDF

export const URL_POLICE_GABARIT = '/fonts/LiberationSans-Regular.ttf'
export const URL_POLICE_GABARIT_GRAS = '/fonts/LiberationSans-Bold.ttf'
/** Nom de la police Liberation Sans une fois enregistrée dans jsPDF. */
export const POLICE_GABARIT = 'LiberationSans'

/** Espace insécable (U+00A0). */
export const ESP = String.fromCharCode(0xa0)

export const TOLERANCE = 0.01

export type Alignement = 'gauche' | 'centre' | 'droite'

export interface Fragment {
  texte: string
  gras?: boolean
  couleur?: string
}

export interface Bout {
  texte: string
  gras: boolean
  couleur: string
  largeur: number
  x: number
  espaceAvant: boolean
}

export interface LigneComposee {
  bouts: Bout[]
  largeur: number
}

interface Mot {
  bouts: Array<Omit<Bout, 'x' | 'espaceAvant'>>
  largeur: number
}

/** Élément vertical d'un bloc : sa hauteur et son dessin depuis son bord haut. */
export interface Element {
  hauteur: number
  dessiner: (haut: number) => void
}

/** Page A4 et marges du gabarit, en points. */
export interface Geometrie {
  pageL: number
  pageH: number
  margeHaut: number
  margeGauche: number
  /** Largeur utile entre les marges gauche et droite */
  largeur: number
  /** Ordonnée de la marge basse */
  basPage: number
}

/** Ligne de base d'un texte de taille `taille` centré dans une ligne de hauteur `hauteur` (Liberation Sans). */
export const ligneDeBase = (hauteur: number, taille: number) => hauteur / 2 + 0.3465 * taille

export const somme = (valeurs: number[]) => valeurs.reduce((s, v) => s + v, 0)

/** Ressource du gabarit manquante (police, logo, photo, signature) : le PDF sort quand même, dégradé. */
export type Avertir = (contexte: string, erreur: unknown) => void

/**
 * Avertissement d'un gabarit : console hors production et Sentry (niveau warning, étiquette du gabarit),
 * pour que l'absence d'une ressource ne passe pas inaperçue en production, comme l'échec de Factur-X du V3.
 */
export function creerAvertisseur(nomGabarit: string, etiquette: string): Avertir {
  return (contexte, erreur) => {
    if (process.env.NODE_ENV !== 'production') console.warn(`[PDF ${nomGabarit}] ${contexte}`, erreur)
    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(erreur instanceof Error ? erreur : new Error(String(erreur)), {
          level: 'warning',
          tags: { pdf_modele: etiquette },
          extra: { contexte },
        })
      })
      .catch((echec: unknown) => {
        // Sentry indisponible (bloqueur, hors ligne) : seul le PDF compte ici.
        if (process.env.NODE_ENV !== 'production') console.warn(`[PDF ${nomGabarit}] Sentry indisponible`, echec)
      })
  }
}

export abstract class MiseEnPageGabarit {
  protected y: number
  protected margeEnAttente = 0

  protected constructor(
    protected readonly pdf: Pdf,
    protected readonly police: string,
    protected readonly geo: Geometrie,
  ) {
    this.y = geo.margeHaut
  }

  // ── Texte ──

  protected fonte(taille: number, gras = false) {
    this.pdf.setFont(this.police, gras ? 'bold' : 'normal')
    this.pdf.setFontSize(taille)
  }

  protected largeur(texte: string, taille: number, gras = false, espacement = 0): number {
    this.fonte(taille, gras)
    const espaces = espacement * Math.max(0, Array.from(texte).length - 1)
    if (this.police === POLICE_GABARIT) return this.pdf.getTextWidth(texte) + espaces
    // Helvetica (repli) : les largeurs internes de jsPDF sont arrondies (550 au lieu de 556 pour la
    // plupart des lettres), soit environ 1 % de moins que l'affichage des lecteurs PDF ; l'espace
    // insécable y vaut 530 au lieu de 278, et le crénage est compté mais jamais écrit. Mesure sans
    // crénage, insécable = espace, majorée de 1,5 % pour qu'aucune ligne ne déborde.
    const sansCrenage = { doKerning: false } as unknown as Parameters<Pdf['getStringUnitWidth']>[1]
    return this.pdf.getStringUnitWidth(texte.split(ESP).join(' '), sansCrenage) * taille * 1.015 + espaces
  }

  /** Une ligne de texte, avec l'espacement des lettres du gabarit ; `x` et `largeurZone` bornent l'alignement. */
  protected ecrire(texte: string, x: number, base: number, o: { taille: number; gras?: boolean; couleur: string; espacement?: number; align?: Alignement; largeurZone?: number }) {
    const espacement = o.espacement ?? 0
    const l = this.largeur(texte, o.taille, o.gras, espacement)
    let xx = x
    if (o.align === 'centre') xx = x + ((o.largeurZone ?? 0) - l) / 2
    else if (o.align === 'droite') xx = x + (o.largeurZone ?? 0) - l
    this.pdf.setTextColor(o.couleur)
    this.pdf.text(texte, xx, base, espacement ? { charSpace: espacement } : undefined)
  }

  /** Coupe un texte à espacement de lettres (titres en capitales) en lignes de `largeurMax`. */
  protected couperEspace(texte: string, largeurMax: number, taille: number, gras: boolean, espacement: number): string[] {
    const lignes: string[] = []
    let courante = ''
    for (const mot of texte.split(' ').filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot
      if (courante && this.largeur(essai, taille, gras, espacement) > largeurMax) {
        lignes.push(courante)
        courante = mot
      } else {
        courante = essai
      }
    }
    if (courante) lignes.push(courante)
    return lignes.length > 0 ? lignes : ['']
  }

  /** Compose un texte mêlant gras et couleurs en lignes de `largeurMax` (coupure aux espaces, « \n » forcé). */
  protected composer(fragments: Fragment[], largeurMax: number, taille: number, couleur: string): LigneComposee[] {
    const espace = this.largeur(' ', taille)
    return this.paragraphesDeMots(fragments, taille, couleur).flatMap((mots) =>
      this.lignesDuParagraphe(mots.flatMap((m) => this.couperMotLong(m, largeurMax, taille)), largeurMax, espace))
  }

  /** Mots de chaque paragraphe ; un mot peut réunir des bouts de styles différents écrits sans espace. */
  private paragraphesDeMots(fragments: Fragment[], taille: number, couleur: string): Mot[][] {
    const paragraphes: Mot[][] = [[]]
    let mot: Mot | null = null
    for (const f of fragments) {
      const gras = !!f.gras
      for (const morceau of f.texte.split(/(\n| +)/)) {
        if (morceau === '') continue
        if (morceau === '\n' || /^ +$/.test(morceau)) {
          // Séparateur : le mot en cours est fini ; « \n » ouvre aussi un nouveau paragraphe.
          if (morceau === '\n') paragraphes.push([])
          mot = null
          continue
        }
        const largeurMorceau = this.largeur(morceau, taille, gras)
        if (!mot) {
          mot = { bouts: [], largeur: 0 }
          paragraphes[paragraphes.length - 1].push(mot)
        }
        mot.bouts.push({ texte: morceau, gras, couleur: f.couleur ?? couleur, largeur: largeurMorceau })
        mot.largeur += largeurMorceau
      }
    }
    return paragraphes
  }

  /** Coupure gloutonne d'un paragraphe en lignes, comme le navigateur du gabarit (texte aligné à gauche). */
  private lignesDuParagraphe(mots: Mot[], largeurMax: number, espace: number): LigneComposee[] {
    const lignes: LigneComposee[] = []
    let ligne: LigneComposee = { bouts: [], largeur: 0 }
    for (const m of mots) {
      if (ligne.bouts.length > 0 && ligne.largeur + espace + m.largeur > largeurMax + TOLERANCE) {
        lignes.push(ligne)
        ligne = { bouts: [], largeur: 0 }
      }
      const avecEspace = ligne.bouts.length > 0
      let x = avecEspace ? ligne.largeur + espace : 0
      for (const [i, b] of m.bouts.entries()) {
        ligne.bouts.push({ ...b, x, espaceAvant: i === 0 && avecEspace })
        x += b.largeur
      }
      ligne.largeur = x
    }
    lignes.push(ligne)
    return lignes
  }

  /** Mot plus large que la ligne (adresse web, référence) : coupé entre deux caractères. */
  private couperMotLong(mot: Mot, largeurMax: number, taille: number): Mot[] {
    if (mot.largeur <= largeurMax) return [mot]
    const morceaux: Mot[] = []
    const ajouter = (b: Mot['bouts'][number], texte: string) => {
      const l = this.largeur(texte, taille, b.gras)
      morceaux.push({ bouts: [{ ...b, texte, largeur: l }], largeur: l })
    }
    for (const b of mot.bouts) {
      let tampon = ''
      for (const c of Array.from(b.texte)) {
        if (tampon && this.largeur(tampon + c, taille, b.gras) > largeurMax) {
          ajouter(b, tampon)
          tampon = c
        } else {
          tampon += c
        }
      }
      if (tampon) ajouter(b, tampon)
    }
    return morceaux
  }

  protected dessinerLignes(lignes: LigneComposee[], x: number, haut: number, hauteurLigne: number, taille: number, align: Alignement = 'gauche', largeurZone = 0) {
    lignes.forEach((ligne, i) => {
      const base = haut + i * hauteurLigne + ligneDeBase(hauteurLigne, taille)
      let decalage = 0
      if (align === 'centre') decalage = (largeurZone - ligne.largeur) / 2
      else if (align === 'droite') decalage = largeurZone - ligne.largeur
      // Bouts consécutifs de même style écrits d'un seul tenant.
      let debut: Bout | null = null
      let texte = ''
      const ecrireSegment = () => {
        if (!debut || !texte) return
        this.fonte(taille, debut.gras)
        this.pdf.setTextColor(debut.couleur)
        this.pdf.text(texte, x + decalage + debut.x, base)
      }
      for (const b of ligne.bouts) {
        if (debut && b.gras === debut.gras && b.couleur === debut.couleur) {
          texte += (b.espaceAvant ? ' ' : '') + b.texte
        } else {
          ecrireSegment()
          debut = b
          texte = b.texte
        }
      }
      ecrireSegment()
    })
  }

  // ── Pages et marges ──

  protected nouvellePage() {
    this.pdf.addPage()
    this.y = this.geo.margeHaut
    this.margeEnAttente = 0
  }

  protected enHautDePage() {
    return this.y <= this.geo.margeHaut + TOLERANCE
  }

  /** Marge haute d'un bloc, fusionnée avec la marge basse du précédent comme en CSS ; nulle en haut de page. */
  protected espacer(margeHaut: number) {
    if (!this.enHautDePage()) this.y += Math.max(margeHaut, this.margeEnAttente)
    this.margeEnAttente = 0
  }

  /** Comme `espacer`, en passant d'abord à la page suivante si `hauteur` ne tient plus. */
  protected placer(margeHaut: number, hauteur: number) {
    const marge = this.enHautDePage() ? 0 : Math.max(margeHaut, this.margeEnAttente)
    if (!this.enHautDePage() && this.y + marge + hauteur > this.geo.basPage + TOLERANCE) this.nouvellePage()
    else this.y += marge
    this.margeEnAttente = 0
  }

  protected finBloc(margeBas: number) {
    this.margeEnAttente = margeBas
  }

  /**
   * Bloc de lignes avec un fond (encadrés) ou sans (clauses, petites lignes). `insecable` : le bloc passe
   * entier à la page suivante s'il ne tient pas ; plus haut qu'une page, il est coupé entre deux lignes.
   */
  protected placerBloc(elements: Element[], o: { margeHaut: number; margeBas: number; padHaut: number; padBas: number; insecable: boolean; fond?: (haut: number, hauteur: number) => void }) {
    const basPage = this.geo.basPage
    const total = o.padHaut + somme(elements.map((el) => el.hauteur)) + o.padBas
    if (o.insecable && total <= basPage - this.geo.margeHaut) this.placer(o.margeHaut, total)
    else this.espacer(o.margeHaut)
    let i = 0
    while (i < elements.length) {
      if (!this.enHautDePage() && this.y + o.padHaut + elements[i].hauteur + o.padBas > basPage + TOLERANCE) this.nouvellePage()
      const debut = this.y
      let hauteur = o.padHaut
      let j = i
      while (j < elements.length && debut + hauteur + elements[j].hauteur + o.padBas <= basPage + TOLERANCE) {
        hauteur += elements[j].hauteur
        j++
      }
      if (j === i) {
        hauteur += elements[i].hauteur
        j = i + 1
      }
      hauteur += o.padBas
      o.fond?.(debut, hauteur)
      let haut = debut + o.padHaut
      for (let k = i; k < j; k++) {
        elements[k].dessiner(haut)
        haut += elements[k].hauteur
      }
      this.y = debut + hauteur
      i = j
      if (i < elements.length) this.nouvellePage()
    }
    this.finBloc(o.margeBas)
  }

  protected filet(x1: number, y: number, x2: number, couleur: string, epaisseur: number) {
    this.pdf.setDrawColor(couleur)
    this.pdf.setLineWidth(epaisseur)
    this.pdf.line(x1, y, x2, y)
  }
}

// ─── Ressources ───────────────────────────────────────────────────────────────

export async function chargerOctets(url: string, avertir: Avertir): Promise<Uint8Array | null> {
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) {
      avertir(`ressource absente : ${url}`, new Error(`HTTP ${reponse.status}`))
      return null
    }
    return new Uint8Array(await reponse.arrayBuffer())
  } catch (erreur) {
    avertir(`ressource absente : ${url}`, erreur)
    return null
  }
}

function enBase64(octets: Uint8Array): string {
  let binaire = ''
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  }
  return btoa(binaire)
}

export interface OctetsPolice {
  normale: Uint8Array
  grasse: Uint8Array
}

/** Fichiers de Liberation Sans (normale et grasse) ; null si l'un manque. */
export async function chargerOctetsPolice(avertir: Avertir): Promise<OctetsPolice | null> {
  const [normale, grasse] = await Promise.all([chargerOctets(URL_POLICE_GABARIT, avertir), chargerOctets(URL_POLICE_GABARIT_GRAS, avertir)])
  return normale && grasse ? { normale, grasse } : null
}

/** Liberation Sans (Unicode, police des gabarits) ; Helvetica si elle ne se charge pas. */
export async function chargerPolice(pdf: Pdf, avertir: Avertir): Promise<string> {
  return enregistrerPolice(pdf, await chargerOctetsPolice(avertir), avertir)
}

/** Enregistre Liberation Sans dans un document ; Helvetica si les fichiers manquent ou sont illisibles. */
export function enregistrerPolice(pdf: Pdf, octets: OctetsPolice | null, avertir: Avertir): string {
  if (!octets) return 'helvetica'
  const { normale, grasse } = octets
  try {
    pdf.addFileToVFS('LiberationSans-Regular.ttf', enBase64(normale))
    pdf.addFont('LiberationSans-Regular.ttf', POLICE_GABARIT, 'normal')
    pdf.addFileToVFS('LiberationSans-Bold.ttf', enBase64(grasse))
    pdf.addFont('LiberationSans-Bold.ttf', POLICE_GABARIT, 'bold')
    return POLICE_GABARIT
  } catch (erreur) {
    avertir('police illisible, Helvetica', erreur)
    return 'helvetica'
  }
}

/**
 * Photo du chantier en JPEG (navigateur seulement) ; null si elle ne se charge pas en 20 s. `recadrage` (largeur sur
 * hauteur) : photo recadrée au centre à ce rapport, comme object-fit: cover ; sans lui, la photo entière.
 */
export async function chargerImageJpeg(url: string, avertir: Avertir, recadrage?: number): Promise<{ donnees: string; largeur: number; hauteur: number } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const minuterie = setTimeout(() => reject(new Error('délai dépassé')), 20000)
      img.onload = () => { clearTimeout(minuterie); resolve(img) }
      img.onerror = () => { clearTimeout(minuterie); reject(new Error('image illisible')) }
      img.src = url
    })
    // Zone source : l'image entière, ou sa partie centrale au rapport demandé.
    let sl = image.width
    let sh = image.height
    if (recadrage && recadrage > 0 && sl > 0 && sh > 0) {
      if (sl / sh > recadrage) sl = sh * recadrage
      else sh = sl / recadrage
    }
    const sx = (image.width - sl) / 2
    const sy = (image.height - sh) / 2
    const echelle = Math.min(1, 2000 / Math.max(sl, sh, 1))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sl * echelle))
    canvas.height = Math.max(1, Math.round(sh * echelle))
    const contexte = canvas.getContext('2d')
    if (!contexte) return null
    fondBlancAvantJpeg(contexte, canvas.width, canvas.height)
    contexte.drawImage(image, sx, sy, sl, sh, 0, 0, canvas.width, canvas.height)
    return { donnees: canvas.toDataURL('image/jpeg', 0.9), largeur: canvas.width, hauteur: canvas.height }
  } catch (erreur) {
    avertir('photo non chargée', erreur)
    return null
  }
}
