/**
 * Recherche dans les listes Devis et Factures du tableau de bord pro (artisan et BTP).
 *
 * Tout ce qui est relié au document se cherche : numéro, client (nom, adresse, téléphone, e-mail, SIRET),
 * objet de l'intervention, adresse et lieu du chantier, maître d'ouvrage, lignes et sections, notes, documents
 * liés (devis d'origine, facture parente, ordre de service), date d'émission (jour ou mois : « octobre 2026 »).
 *
 * La saisie est découpée en mots : chaque mot doit se trouver dans le document, pas forcément dans le même
 * champ (« dupont marseille » trouve le devis du client Dupont dont le chantier est à Marseille). Les
 * majuscules, les accents et la ponctuation ne comptent pas (« saint etienne » trouve « Saint-Étienne »).
 * Un mot sans chiffre se trouve n'importe où (« upon » trouve « Dupont ») ; un mot avec chiffre doit commencer
 * un mot du document (« 001 » ne se trouve pas dans le SIRET « … 00019 ») ; une suite d'au moins 6 chiffres se
 * trouve n'importe où (morceau d'un téléphone ou d'un SIRET). Un numéro ou une date tapés avec leurs séparateurs
 * (« DEV-2026-001 », « 12/10/2026 », « 06.12.34.56.78 ») se cherchent d'un bloc : ses parties doivent se suivre.
 *
 * Lecture seule : rien n'est écrit dans les documents.
 */

import { normalizeForSearch } from '@/lib/fuzzy-match'

export type ChampRecherche =
  | 'numero'
  | 'client'
  | 'intitule'
  | 'chantier'
  | 'adresseClient'
  | 'contact'
  | 'maitreOuvrage'
  | 'documentLie'
  | 'lignes'
  | 'notes'
  | 'date'

export type LocaleRecherche = 'fr' | 'pt'

interface EntreeIndex {
  champ: ChampRecherche
  /** Texte tel qu'il est affiché dans l'indice « trouvé dans… ». */
  texte: string
  /** Texte normalisé dans lequel on cherche, précédé d'une espace (début de mot = « espace + mot »). */
  normalise: string
}

export interface DocumentIndexe<T> {
  doc: T
  entrees: EntreeIndex[]
}

/** Champ (non affiché dans la ligne de la liste) qui explique pourquoi le document a été trouvé. */
export interface IndiceRecherche {
  champ: ChampRecherche
  texte: string
}

export interface ResultatRecherche<T> {
  doc: T
  indice: IndiceRecherche | null
}

const SEPARATEURS = /[^a-z0-9]+/g
const NON_CHIFFRES = /\D/g
const CHIFFRE = /\d/
const LONGUE_SUITE_DE_CHIFFRES = /^\d{6,}$/
// Date tapée « 12/10/2026 », « 5/10 » ou « 10/2026 » (« / » seulement : « 12.5 » reste un nombre).
const DATE_SAISIE = /^\d{1,4}(?:\/\d{1,4}){1,2}$/
const ESPACES = /\s+/
const LONGUEUR_MAX_INDICE = 90

const MOIS: Record<LocaleRecherche, readonly string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
}

/** Minuscules, sans accents ; toute ponctuation (tiret, apostrophe, virgule, °…) devient une espace. */
export function normaliserRecherche(texte: string): string {
  return normalizeForSearch(texte)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(SEPARATEURS, ' ')
    .trim()
}

/**
 * Mots de la saisie, normalisés. Une saisie vide ou faite de ponctuation ne filtre rien. Un morceau avec chiffres
 * et séparateurs (« DEV-2026-001 », « 12/10/2026 ») reste un seul « mot » à parties séparées par des espaces.
 */
export function motsRecherche(requete: string): string[] {
  const mots: string[] = []
  for (const morceau of requete.trim().split(ESPACES)) {
    if (DATE_SAISIE.test(morceau)) {
      // Comme dans l'index : jour et mois sur deux chiffres, année sur quatre (« 5/10/26 » cherche « 05 10 2026 »).
      const parties = morceau.split('/').map(partie => partie.padStart(2, '0'))
      if (parties.length === 3 && parties[2].length === 2) parties[2] = `20${parties[2]}`
      mots.push(parties.join(' '))
      continue
    }
    const normalise = normaliserRecherche(morceau)
    if (!normalise) continue
    if (CHIFFRE.test(normalise) && normalise.includes(' ')) mots.push(normalise)
    else mots.push(...normalise.split(' '))
  }
  return mots
}

function texteDe(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur.trim()
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur)
  return ''
}

function enregistrement(valeur: unknown): Record<string, unknown> | null {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : null
}

function tableau(valeur: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valeur)) return []
  return valeur.map(enregistrement).filter((e): e is Record<string, unknown> => e !== null)
}

/** Date « AAAA-MM-JJ » (ou ISO complète) → « JJ/MM/AAAA » et « mois AAAA », sans passer par le fuseau horaire. */
function textesDate(valeur: unknown, locale: LocaleRecherche): { affiche: string; cherche: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texteDe(valeur))
  if (!m) return null
  const mois = Number(m[2])
  if (mois < 1 || mois > 12) return null
  const affiche = `${m[3]}/${m[2]}/${m[1]}`
  return { affiche, cherche: `${affiche} ${MOIS[locale][mois - 1]} ${m[1]}` }
}

/** Une ligne de devis : description, détail libre et étapes rattachées. */
function textesLigne(ligne: Record<string, unknown>): string[] {
  const textes = [texteDe(ligne.description), texteDe(ligne.lineDetail), texteDe(ligne.designation)]
  for (const etape of tableau(ligne.etapes)) textes.push(texteDe(etape.designation))
  return textes.filter(Boolean)
}

/**
 * Index d'un document : la liste des textes cherchables, dans l'ordre de priorité de l'indice (le premier champ
 * qui contient un mot est celui qu'on montre). À calculer une fois par liste (useMemo), pas à chaque frappe.
 */
export function indexerDocument<T extends object>(doc: T, locale: LocaleRecherche): DocumentIndexe<T> {
  const d = doc as Record<string, unknown>
  const entrees: EntreeIndex[] = []
  const ajouter = (champ: ChampRecherche, texte: string, complement = ''): void => {
    if (!texte) return
    const normalise = normaliserRecherche(complement ? `${texte} ${complement}` : texte)
    if (normalise) entrees.push({ champ, texte, normalise: ` ${normalise}` })
  }
  const joindre = (...valeurs: unknown[]): string => valeurs.map(texteDe).filter(Boolean).join(', ')
  // Téléphone et SIRET : aussi sans espaces, pour trouver « 0612345678 » quand la fiche porte « 06 12 34 56 78 ».
  const chiffresSeuls = (valeur: unknown): string => texteDe(valeur).replace(NON_CHIFFRES, '')

  ajouter('numero', texteDe(d.docNumber))
  ajouter('client', joindre(d.clientName, d.clientFirstName, d.clientLastName))
  ajouter('intitule', texteDe(d.docTitle))
  ajouter('chantier', joindre(
    d.interventionAddress, d.interventionBatiment, d.interventionEtage,
    d.interventionEspacesCommuns, d.interventionExterieur,
  ))
  ajouter('adresseClient', joindre(
    d.clientAddress, d.clientStreet, d.clientApartmentNumber, d.clientFloor,
    d.clientPostalCode, d.clientCity, d.clientCountry,
  ))
  ajouter('contact', texteDe(d.clientPhone), chiffresSeuls(d.clientPhone))
  ajouter('contact', texteDe(d.clientEmail))
  ajouter('contact', joindre(d.clientSiret, d.clientSiren), `${chiffresSeuls(d.clientSiret)} ${chiffresSeuls(d.clientSiren)}`.trim())
  ajouter('maitreOuvrage', texteDe(d.maitreOuvrageFinal))
  ajouter('documentLie', joindre(d.sourceDevisNumber, d.parentInvoiceNumber, d.ordreDeService, d.marchePrincipalRef))

  // Lignes : collections plates, sections nommées (corps d'état BTP), frais annexes, étapes du document.
  const lignes = [d.lines, d.laborLines, d.materialLines, d.fraisLines].flatMap(tableau)
  for (const table of tableau(d.customTables)) {
    ajouter('lignes', texteDe(table.name))
    lignes.push(...tableau(table.lines))
  }
  for (const frais of tableau(d.fraisAnnexes)) ajouter('lignes', texteDe(frais.designation))
  for (const ligne of lignes) for (const texte of textesLigne(ligne)) ajouter('lignes', texte)
  for (const etape of tableau(d.etapes)) ajouter('lignes', texteDe(etape.designation))
  ajouter('lignes', joindre(d.linesName, d.materialLinesName, d.fraisLinesName))

  ajouter('notes', texteDe(d.notes))
  ajouter('notes', texteDe(d.avoirMotif))

  const date = textesDate(d.docDate, locale) ?? textesDate(d.savedAt, locale)
  if (date) ajouter('date', date.affiche, date.cherche)

  return { doc, entrees }
}

function abreger(texte: string): string {
  const uneLigne = texte.replace(/\s+/g, ' ').trim()
  return uneLigne.length > LONGUEUR_MAX_INDICE ? `${uneLigne.slice(0, LONGUEUR_MAX_INDICE - 1)}…` : uneLigne
}

/**
 * Ce qu'il faut chercher pour un mot : le mot n'importe où (mot sans chiffre, ou suite d'au moins 6 chiffres), ou
 * « espace + mot » (début de mot), pour qu'un numéro court ne se trouve pas au milieu d'un SIRET ou d'une date.
 */
function motifDeRecherche(mot: string): string {
  return !CHIFFRE.test(mot) || LONGUE_SUITE_DE_CHIFFRES.test(mot) ? mot : ` ${mot}`
}

/**
 * Le document contient-il tous les mots ? `indice` : le champ non affiché dans la ligne (hors `champsVisibles`)
 * qui explique la correspondance, pour que l'utilisateur voie pourquoi le document est là (« Chantier : 12 rue… »).
 */
export function correspondDocument<T>(
  index: DocumentIndexe<T>,
  mots: readonly string[],
  champsVisibles: ReadonlySet<ChampRecherche>,
): { trouve: boolean; indice: IndiceRecherche | null } {
  let meilleure = -1
  for (const mot of mots) {
    const motif = motifDeRecherche(mot)
    const position = index.entrees.findIndex(e => e.normalise.includes(motif))
    if (position < 0) return { trouve: false, indice: null }
    const entree = index.entrees[position]
    // Un mot trouvé d'abord dans un champ visible (numéro, client…) n'a pas besoin d'indice.
    if (!champsVisibles.has(entree.champ) && (meilleure < 0 || position < meilleure)) meilleure = position
  }
  if (meilleure < 0) return { trouve: true, indice: null }
  const { champ, texte } = index.entrees[meilleure]
  return { trouve: true, indice: { champ, texte: abreger(texte) } }
}

/** Filtre une liste indexée ; l'ordre de la liste est conservé. Saisie vide : tout, sans indice. */
export function filtrerDocuments<T>(
  index: readonly DocumentIndexe<T>[],
  requete: string,
  champsVisibles: ReadonlySet<ChampRecherche>,
): ResultatRecherche<T>[] {
  const mots = motsRecherche(requete)
  if (mots.length === 0) return index.map(i => ({ doc: i.doc, indice: null }))
  const resultats: ResultatRecherche<T>[] = []
  for (const i of index) {
    const { trouve, indice } = correspondDocument(i, mots, champsVisibles)
    if (trouve) resultats.push({ doc: i.doc, indice })
  }
  return resultats
}
