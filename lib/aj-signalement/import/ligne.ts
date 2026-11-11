// ── AJ Signalement : import des copropriétés, règles pures (navigateur ET serveur) ──────────────────────────────
//
// Demande de Hugo du 10/11/2026 : « créer les copropriétés à partir d'un tableau Excel fourni par le client » (SPEC § 1.9).
// Ce module ne lit aucun fichier (lecteur-xlsx.ts et csv.ts le font dans le navigateur) et n'importe aucune bibliothèque
// lourde (fflate, jsPDF, qrcode : jamais dans le bundle du Worker) :
//   - modèle (colonnes, synonymes), en-têtes, correspondance des colonnes ;
//   - normalisation d'une ligne (mêmes bornes que importCoproprietesQrSchema) : une erreur de format garde la ligne dans
//     le navigateur, jamais envoyée ;
//   - diagnostics, refaits par la route (P1-R19) sur la base : gestionnaires du cabinet (adresse ou nom), destinataires
//     (RG-06 bis : une adresse de fiche, ou une variante par la règle du formulaire, estAdresseDeFicheQr, n'est jamais une
//     adresse saisie ; RG-02 : hors domaines à confirmer), doublons dans
//     le fichier et avec les copropriétés du cabinet (mêmes clés que la saisie, doublons.ts) ;
//   - lignes passées à signalements_qr_creer_coproprietes (un seul appel, tout ou rien).
// Isolation entre cabinets : seules les fiches et les copropriétés DU cabinet sont comparées ; une adresse d'une fiche
// d'un autre cabinet n'est jamais attribuée ni gardée en destinataire.

import { normaliserNomPersonne, sansAccentsMinuscules } from '@/lib/administrateur-judiciaire/domain/texte'
import { cleNomCoproQr, doublonsCoproprieteQr } from '@/lib/aj-signalement/doublons'
import { boiteEmailQr, boitesDeFicheQr, emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import { LIBELLE_CHAMP_IMPORT_QR as L, MESSAGES_IMPORT_QR as M } from '@/lib/aj-signalement/import/textes'
import type {
  ChampImportQr, ChoixLigneImportQr, ColonneModeleImportQr, ContexteImportQr, CoproprieteDoublonQr, CorrespondanceImportQr,
  DiagnosticLigneImportQr, DoublonQr, EtatLigneImportQr, FicheDoublonQr, FicheImportQr, GestionnaireInconnuImportQr,
  GestionnaireResumeQr, LigneImportQr, LigneNormaliseeImportQr, LigneSqlImportQr, MessageImportQr, NormalisationImportQr,
  OptionsImportQr, PlanImportQr, VerificationImportQr,
} from '@/lib/aj-signalement/types'

// ── Bornes (SPEC § 1.9.4, § 1.9.6) ───────────────────────────────────────────

/** Copropriétés par import (≈ 3 fois le parc annoncé ; corps ≈ 300 Ko ; transaction < 1 s). */
export const LIGNES_IMPORT_MAX_QR = 500
/** Lignes et colonnes lues dans un fichier (en-têtes compris). */
export const LIGNES_LUES_MAX_QR = 2000
export const COLONNES_LUES_MAX_QR = 30
/** Taille d'un fichier choisi. */
export const TAILLE_FICHIER_IMPORT_MAX_QR = 5 * 1024 * 1024
/** La ligne d'en-têtes est cherchée parmi les 10 premières. */
export const LIGNES_ENTETES_CHERCHEES_QR = 10

const MAX = { nom: 200, adresse: 300, ville: 100, referenceCabinet: 50, batiment: 50, batiments: 50, destinataires: 10, gestionnaires: 20, nomGestionnaire: 120 } as const

// ── Modèle et correspondance des colonnes ────────────────────────────────────

/** Colonnes du modèle (ordre du fichier à télécharger) et synonymes reconnus dans le fichier d'un client. */
export const COLONNES_MODELE_IMPORT_QR: readonly ColonneModeleImportQr[] = [
  {
    champ: 'nom', entete: 'Nom de la copropriété', obligatoire: 'oui', format: '1 à 200 caractères', exemple: 'Résidence Exemple',
    synonymes: ['nom', 'copropriété', 'résidence', 'désignation', 'immeuble', 'syndicat', 'libellé', 'nom de la résidence', 'nom copropriété', 'nom de l’immeuble'],
  },
  {
    champ: 'adresse', entete: 'Adresse (n° et voie)', obligatoire: 'conseille', format: '300 caractères au plus', exemple: '1 rue Exemple',
    synonymes: ['adresse', 'rue', 'voie', 'adresse 1', 'adresse postale', 'n° et voie', 'numéro et voie', 'adresse de l’immeuble'],
  },
  {
    champ: 'codePostal', entete: 'Code postal', obligatoire: 'conseille', format: '5 chiffres (« 6000 » devient « 06000 »)', exemple: '13008',
    synonymes: ['cp', 'c.p.', 'code post'],
  },
  { champ: 'ville', entete: 'Ville', obligatoire: 'conseille', format: '100 caractères au plus', exemple: 'Marseille', synonymes: ['commune', 'localité'] },
  {
    champ: 'immatriculation', entete: 'N° d’immatriculation', obligatoire: 'non', format: '2 lettres puis 7 chiffres (registre des copropriétés)',
    exemple: 'AB1234567', synonymes: ['immatriculation', 'rnic', 'registre', 'numéro d’immatriculation', 'n° immatriculation'],
  },
  {
    champ: 'referenceCabinet', entete: 'Référence du cabinet', obligatoire: 'non', format: '50 caractères au plus, une par copropriété', exemple: 'REF-001',
    synonymes: ['référence', 'code', 'code immeuble', 'réf', 'réf.'],
  },
  {
    champ: 'batiments', entete: 'Bâtiments', obligatoire: 'non', format: 'séparés par « ; », 50 au plus', exemple: 'A;B',
    synonymes: ['bâtiment', 'bât.', 'bât', 'escalier', 'escaliers'],
  },
  {
    champ: 'gestionnaires', entete: 'Gestionnaire(s)', obligatoire: 'non', format: 'adresses e-mail séparées par « ; » (à défaut, noms des fiches)',
    exemple: 'prenom.nom@exemple.test', synonymes: ['gestionnaire', 'gestionnaires', 'chargé de copropriété', 'chargée de copropriété', 'responsable'],
  },
  {
    champ: 'emailsDestinataires', entete: 'Destinataires supplémentaires', obligatoire: 'non', format: 'adresses e-mail séparées par « ; », 10 au plus',
    exemple: 'conseil.syndical@exemple.test', synonymes: ['destinataires', 'copie', 'notifier', 'e-mails', 'emails'],
  },
]

export const CHAMPS_IMPORT_QR: readonly ChampImportQr[] = COLONNES_MODELE_IMPORT_QR.map((c) => c.champ)

/** « N° d’immatriculation » → « n d immatriculation » : minuscules sans accents, ponctuation → espace. */
export function cleEnteteImportQr(texte: string): string {
  return sansAccentsMinuscules(texte).replace(/[^a-z0-9]+/g, ' ').trim()
}

const SYNONYMES = new Map<string, ChampImportQr>(
  COLONNES_MODELE_IMPORT_QR.flatMap((c) => [c.entete, ...c.synonymes].map((s): [string, ChampImportQr] => [cleEnteteImportQr(s), c.champ])),
)

/** Champ reconnu d'après l'en-tête d'une colonne (égalité après normalisation) ; null : colonne ignorée. */
export function champDepuisEnteteQr(entete: string): ChampImportQr | null {
  return SYNONYMES.get(cleEnteteImportQr(entete)) ?? null
}

/** La première des 10 premières lignes qui a au moins 2 colonnes reconnues ; sinon la première (modifiable à l'écran). */
export function trouverLigneEntetesQr(lignes: ReadonlyArray<readonly string[]>): number {
  for (let i = 0; i < Math.min(LIGNES_ENTETES_CHERCHEES_QR, lignes.length); i++) {
    const champs = new Set((lignes[i] ?? []).map(champDepuisEnteteQr).filter((c): c is ChampImportQr => c !== null))
    if (champs.size >= 2) return i
  }
  return 0
}

/** Correspondance proposée : chaque champ reconnu → sa PREMIÈRE colonne. */
export function correspondanceAutomatiqueQr(entetes: readonly string[]): CorrespondanceImportQr {
  const correspondance: CorrespondanceImportQr = {}
  entetes.forEach((entete, colonne) => {
    const champ = champDepuisEnteteQr(entete)
    if (champ && correspondance[champ] === undefined) correspondance[champ] = colonne
  })
  return correspondance
}

/** Les premières valeurs non vides d'une colonne sous la ligne d'en-têtes (écran de correspondance). */
export function exemplesColonneQr(lignes: ReadonlyArray<readonly string[]>, indexEntetes: number, colonne: number, nombre = 5): string[] {
  const valeurs: string[] = []
  for (let i = indexEntetes + 1; i < lignes.length && valeurs.length < nombre; i++) {
    const valeur = texteSimple(lignes[i]?.[colonne] ?? '')
    if (valeur) valeurs.push(valeur)
  }
  return valeurs
}

/** Empreinte des en-têtes (noms de colonnes seulement) : clé de la correspondance retenue dans le navigateur. */
export function empreinteEntetesQr(entetes: readonly string[]): string {
  const texte = entetes.map(cleEnteteImportQr).join('|')
  let h = 5381
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0
  return `${entetes.length}-${h.toString(36)}`
}

// ── Normalisation des valeurs ────────────────────────────────────────────────

/** Espaces (insécables et retours à la ligne compris) réduits à une espace, rogné. */
const texteSimple = (valeur: string): string => valeur.replace(/\s+/g, ' ').trim()

type Normalise<T> = { ok: true; valeur: T } | { ok: false }

/** « 6000 » → « 06000 » (nombre Excel), « 13 008 » → « 13008 », « CEDEX » retiré ; « 4000-123 » (Portugal) gardé. */
export function normaliserCodePostalImportQr(brut: string): Normalise<string> {
  const valeur = texteSimple(brut).replace(/\s*cedex(?:\s*\d{1,3})?$/i, '').trim()
  if (valeur === '' || /^\d{4}-\d{3}$/.test(valeur)) return { ok: true, valeur }
  const chiffres = valeur.replace(/\s+/g, '')
  if (/^\d{5}$/.test(chiffres)) return { ok: true, valeur: chiffres }
  if (/^\d{4}$/.test(chiffres)) return { ok: true, valeur: `0${chiffres}` }
  return { ok: false }
}

/**
 * N° d'immatriculation : majuscules, sans espaces, points ni tirets (même règle que Zod), 20 au plus. Format souple tant
 * qu'il n'est pas confirmé sur un extrait du registre : autre chose que « 2 lettres puis 7 chiffres » avertit seulement.
 */
export function normaliserImmatriculationImportQr(brut: string): { ok: true; valeur: string; inattendu: boolean } | { ok: false } {
  const valeur = brut.toUpperCase().replace(/[\s.-]/g, '')
  if (valeur === '') return { ok: true, valeur, inattendu: false }
  if (!/^[A-Z0-9]{1,20}$/.test(valeur)) return { ok: false }
  return { ok: true, valeur, inattendu: !/^[A-Z]{2}\d{7}$/.test(valeur) }
}

/** Bâtiments séparés par « ; », « , » ou un retour à la ligne, sans doublon ; 50 au plus, de 50 caractères chacun. */
export function decouperBatimentsImportQr(brut: string): { ok: true; valeurs: string[] } | { ok: false } {
  const valeurs = [...new Set(brut.split(/[;,\n\r]+/).map(texteSimple).filter(Boolean))]
  if (valeurs.length > MAX.batiments || valeurs.some((v) => v.length > MAX.batiment)) return { ok: false }
  return { ok: true, valeurs }
}

/** « 12 rue Exemple, 13008 Marseille » → voie, code postal, ville ; sans code postal reconnu : tout dans la voie. */
export function separerAdresseCompleteQr(brut: string): { adresse: string; codePostal: string; ville: string } {
  const valeur = texteSimple(brut)
  const m = /^(.*?)[,\s]+(\d{5}|\d{4}-\d{3})\s+(.+)$/.exec(valeur)
  if (!m || !m[1].trim()) return { adresse: valeur, codePostal: '', ville: '' }
  return { adresse: m[1].replace(/[,\s]+$/, '').trim(), codePostal: m[2], ville: m[3].trim() }
}

// Même langage que strictEmail (lib/validation.ts) : expression « pratique » de Zod 4 ET domaine avec un suffixe de
// 2 lettres au moins. Une adresse acceptée ici l'est par le schéma du serveur (testé).
const EMAIL_ZOD = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const EMAIL_STRICT = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

export const estEmailImportQr = (valeur: string): boolean => EMAIL_ZOD.test(valeur) && EMAIL_STRICT.test(valeur)

/** Morceau d'une cellule débarrassé de ses chevrons, guillemets ou parenthèses (« <marie@…> »). */
const morceau = (texte: string): string => texte.replace(/^[<("'[]+|[>)"'\]]+$/g, '')

/**
 * Adresses d'une cellule (séparées par « ; », « , » ou des espaces), en minuscules, sans doublon. Une cellule qui contient
 * des « @ » : les mots sans « @ » (un nom à côté de l'adresse) sont ignorés ; sans aucun « @ », la cellule est invalide.
 */
export function analyserEmailsImportQr(brut: string): { emails: string[]; invalides: string[] } {
  const texte = brut.trim()
  if (!texte) return { emails: [], invalides: [] }
  if (!texte.includes('@')) return { emails: [], invalides: [texteSimple(texte)] }
  const emails: string[] = []
  const invalides: string[] = []
  for (const brutMorceau of texte.split(/[,;\s]+/)) {
    const m = morceau(brutMorceau)
    if (!m.includes('@')) continue
    if (estEmailImportQr(m)) {
      const propre = m.toLowerCase()
      if (!emails.includes(propre)) emails.push(propre)
    } else {
      invalides.push(m)
    }
  }
  return { emails, invalides }
}

/** Colonne Gestionnaire(s) : des adresses ; à défaut d'adresse, des noms (séparés par « ; », « , », « / » ou « et »). */
export function analyserGestionnairesImportQr(brut: string): { emails: string[]; noms: string[]; invalides: string[] } {
  const texte = brut.trim()
  if (!texte) return { emails: [], noms: [], invalides: [] }
  if (texte.includes('@')) return { ...analyserEmailsImportQr(texte), noms: [] }
  const noms: string[] = []
  for (const nom of texte.split(/[;,\n\r/]+|\s+et\s+/i).map(texteSimple).filter(Boolean)) {
    if (!noms.some((n) => normaliserNomPersonne(n) === normaliserNomPersonne(nom))) noms.push(nom)
  }
  return { emails: [], noms, invalides: [] }
}

/** « marie-claire.exemple@… » → « Marie-Claire Exemple » : nom proposé pour une fiche à créer (modifiable). */
export function nomDepuisEmailQr(email: string): string {
  const locale = (email.split('@')[0] ?? '').replace(/\d+$/, '')
  return locale.split(/[._]+/).filter(Boolean)
    .map((mot) => mot.split('-').map((p) => (p ? p[0].toLocaleUpperCase('fr-FR') + p.slice(1) : p)).join('-'))
    .join(' ')
}

// ── Lignes du fichier → lignes normalisées ───────────────────────────────────

/**
 * Lignes sous la ligne d'en-têtes → lignes normalisées (n° de ligne du tableur). Une ligne vide sur toutes les colonnes
 * reliées est ignorée. Au-delà de LIGNES_IMPORT_MAX_QR lignes de données : tropDeLignes (« divisez le fichier »).
 */
export function normaliserLignesImportQr(
  lignes: ReadonlyArray<readonly string[]>, indexEntetes: number, correspondance: CorrespondanceImportQr, options: OptionsImportQr = {},
): NormalisationImportQr {
  const sortie: LigneNormaliseeImportQr[] = []
  for (let i = indexEntetes + 1; i < lignes.length; i++) {
    const cellules = lignes[i] ?? []
    const lire = (champ: ChampImportQr): string => {
      const colonne = correspondance[champ]
      return colonne === undefined ? '' : String(cellules[colonne] ?? '')
    }
    if (CHAMPS_IMPORT_QR.every((champ) => lire(champ).trim() === '')) continue
    if (sortie.length >= LIGNES_IMPORT_MAX_QR) return { lignes: sortie, tropDeLignes: true }
    sortie.push(normaliserLigne(i + 1, lire, options))
  }
  return { lignes: sortie, tropDeLignes: false }
}

function normaliserLigne(numeroLigne: number, lire: (champ: ChampImportQr) => string, options: OptionsImportQr): LigneNormaliseeImportQr {
  const messages: MessageImportQr[] = []
  const erreur = (champ: ChampImportQr, texte: string) => messages.push({ niveau: 'erreur', champ, texte })
  const longueur = (champ: ChampImportQr, valeur: string, max: number) => {
    if (valeur.length > max) erreur(champ, M.tropLong(L[champ], max))
  }

  const nom = texteSimple(lire('nom'))
  if (!nom) erreur('nom', M.nomManquant)
  longueur('nom', nom, MAX.nom)

  let adresse = texteSimple(lire('adresse'))
  let codePostalBrut = lire('codePostal')
  let ville = texteSimple(lire('ville'))
  if (options.adresseComplete && adresse) {
    const separee = separerAdresseCompleteQr(adresse)
    adresse = separee.adresse
    if (!codePostalBrut.trim()) codePostalBrut = separee.codePostal
    if (!ville) ville = separee.ville
  }
  longueur('adresse', adresse, MAX.adresse)
  longueur('ville', ville, MAX.ville)

  const codePostal = normaliserCodePostalImportQr(codePostalBrut)
  if (!codePostal.ok) erreur('codePostal', M.codePostal(texteSimple(codePostalBrut)))

  const immatriculationBrute = texteSimple(lire('immatriculation'))
  const immatriculation = normaliserImmatriculationImportQr(immatriculationBrute)
  if (!immatriculation.ok) erreur('immatriculation', M.immatriculation(immatriculationBrute))
  else if (immatriculation.inattendu) messages.push({ niveau: 'avertissement', champ: 'immatriculation', texte: M.immatriculationInattendue(immatriculation.valeur) })

  const referenceCabinet = texteSimple(lire('referenceCabinet'))
  longueur('referenceCabinet', referenceCabinet, MAX.referenceCabinet)

  const batiments = decouperBatimentsImportQr(lire('batiments'))
  if (!batiments.ok) erreur('batiments', M.batiments)

  const gestionnaires = analyserGestionnairesImportQr(lire('gestionnaires'))
  for (const invalide of gestionnaires.invalides) erreur('gestionnaires', M.emailInvalide(invalide))
  if (gestionnaires.emails.length + gestionnaires.noms.length > MAX.gestionnaires) erreur('gestionnaires', M.tropDeGestionnaires)
  for (const n of gestionnaires.noms) longueur('gestionnaires', n, MAX.nomGestionnaire)

  const destinataires = analyserEmailsImportQr(lire('emailsDestinataires'))
  for (const invalide of destinataires.invalides) erreur('emailsDestinataires', M.emailInvalide(invalide))
  if (destinataires.emails.length > MAX.destinataires) erreur('emailsDestinataires', M.tropDeDestinataires)

  const enErreur = messages.some((m) => m.niveau === 'erreur')
  const saisie: LigneImportQr | null = enErreur || !codePostal.ok || !immatriculation.ok || !batiments.ok ? null : {
    numeroLigne, nom, adresse, codePostal: codePostal.valeur, ville, immatriculation: immatriculation.valeur, referenceCabinet,
    batiments: batiments.valeurs, gestionnaires: gestionnaires.emails, nomsGestionnaires: gestionnaires.noms,
    emailsDestinataires: destinataires.emails, actionSiExiste: 'ignorer', forcerDoublon: false, creerSiDoublonProbable: true,
  }
  return { numeroLigne, nom, saisie, messages }
}

// ── Diagnostics (navigateur pour l'aperçu, serveur qui refait tout) ──────────

/**
 * Décision d'une ligne selon son doublon le plus grave et les choix du super admin : sans doublon, créée ; doublon
 * probable, créée sauf si décochée ; doublon certain, ignorée sauf « Compléter la fiche existante » (la même copropriété)
 * ou, pour nom + code postal seulement, « Ce n'est pas un doublon » (création forcée, journalisée).
 */
export function actionImportQr(doublon: DoublonQr | null, choix: ChoixLigneImportQr): { action: 'creer' | 'completer' | 'ignorer'; forcerDoublon: boolean } {
  if (!doublon) return { action: 'creer', forcerDoublon: false }
  if (doublon.certitude === 'probable') return { action: choix.creerSiDoublonProbable ? 'creer' : 'ignorer', forcerDoublon: false }
  if (choix.actionSiExiste === 'completer' && choix.coproprieteExistanteId === doublon.copropriete.id) return { action: 'completer', forcerDoublon: false }
  if (doublon.forcable && choix.forcerDoublon) return { action: 'creer', forcerDoublon: true }
  return { action: 'ignorer', forcerDoublon: false }
}

const PREFIXE_LIGNE = 'ligne:'

const ficheDoublon = (l: LigneImportQr): FicheDoublonQr => ({
  nom: l.nom, adresse: l.adresse, codePostal: l.codePostal, immatriculation: l.immatriculation || null, referenceCabinet: l.referenceCabinet || null,
})

/** Fiche existante telle que « Compléter » la laisse : signalements_qr_creer_coproprietes ne remplit que les champs vides. */
function completeeQr(e: CoproprieteDoublonQr, l: LigneImportQr): CoproprieteDoublonQr {
  return {
    ...e,
    adresse: e.adresse === '' ? l.adresse : e.adresse,
    codePostal: e.codePostal === '' ? l.codePostal : e.codePostal,
    ville: e.ville === '' ? l.ville : e.ville,
    immatriculation: e.immatriculation ?? (l.immatriculation || null),
    referenceCabinet: e.referenceCabinet ?? (l.referenceCabinet || null),
  }
}

const memeFicheQr = (a: CoproprieteDoublonQr, b: CoproprieteDoublonQr): boolean =>
  a.adresse === b.adresse && a.codePostal === b.codePostal && a.ville === b.ville
  && a.immatriculation === b.immatriculation && a.referenceCabinet === b.referenceCabinet

/**
 * Diagnostics d'un import pour UN cabinet : la même fonction sert l'aperçu (navigateur) et la vérification du serveur
 * (P1-R19), qui lit le contexte en base. Rien n'est écrit ; aucun message ne part dans un journal.
 *
 * La base fait les complétions AVANT les créations (signalements_qr_creer_coproprietes, essai PGlite du 11/11) : quand
 * une ligne « Compléter » remplit des champs vides, chaque ligne est revue contre les fiches telles qu'elles seront
 * complétées (une création homonyme devient « existe déjà », forçable pour nom + code postal seulement), et une complétion
 * qui donnerait à sa fiche le nom et le code postal d'une AUTRE fiche du cabinet est en erreur. La décision ne dépend
 * donc pas de l'ordre des lignes, et jamais deux fiches de même nom et même code postal sans forçage journalisé.
 */
export function diagnostiquerImportQr(lignes: readonly LigneImportQr[], contexte: ContexteImportQr): VerificationImportQr {
  const premiere = diagnostiquerSurExistantesQr(lignes, contexte)
  const parNumero = new Map(lignes.map((l) => [l.numeroLigne, l]))
  const parId = new Map(contexte.existantes.map((e) => [e.id, e]))
  const completees = new Map<string, CoproprieteDoublonQr>()
  for (const d of premiere.diagnostics) {
    const l = parNumero.get(d.numeroLigne)
    const e = d.action === 'completer' && d.doublon ? parId.get(d.doublon.copropriete.id) : undefined
    if (!l || !e) continue
    const apres = completeeQr(e, l)
    if (!memeFicheQr(apres, e)) completees.set(e.id, apres)
  }
  if (completees.size === 0) return premiere

  const existantes = contexte.existantes.map((e) => completees.get(e.id) ?? e)
  const seconde = diagnostiquerSurExistantesQr(lignes, { ...contexte, existantes })
  const diagnostics = seconde.diagnostics.map((d): DiagnosticLigneImportQr => {
    const id = d.action === 'completer' ? d.doublon?.copropriete.id : undefined
    const avant = id === undefined ? undefined : parId.get(id)
    const apres = id === undefined ? undefined : completees.get(id)
    if (!avant || !apres || apres.codePostal === avant.codePostal) return d
    const conflit = doublonsCoproprieteQr(apres, existantes, { ignorerId: avant.id })
      .find((x) => x.certitude === 'certain' && x.critere === 'nom_code_postal')
    if (!conflit) return d
    const { nom, ville } = conflit.copropriete
    return { ...d, etat: 'erreur', action: 'aucune', messages: [...d.messages, { niveau: 'erreur', champ: null, texte: M.existeDeja(nom, ville, conflit.critere) }] }
  })
  return { ...seconde, diagnostics }
}

/** Diagnostics des lignes contre un état donné des copropriétés du cabinet (voir diagnostiquerImportQr). */
function diagnostiquerSurExistantesQr(lignes: readonly LigneImportQr[], contexte: ContexteImportQr): VerificationImportQr {
  const fichesParEmail = new Map<string, FicheImportQr>()
  for (const f of contexte.fiches) {
    const email = emailCanoniqueQr(f.email)
    if (email) fichesParEmail.set(email, f)
  }
  // Contrôle 2 de la PR 2 (C2) : une adresse est celle d'une fiche DU cabinet par LA règle du formulaire
  // (boitesDeFicheQr, définition de estAdresseDeFicheQr : même boîte, étiquette « + » comprise, ou même partie locale sur
  // un domaine du cabinet). L'adresse exacte d'abord ; sinon toutes les fiches dont elle est une variante.
  const fichesParBoite = new Map<string, FicheImportQr[]>()
  for (const f of contexte.fiches) {
    for (const boite of boitesDeFicheQr(f.email, contexte.domaines)) fichesParBoite.set(boite, [...(fichesParBoite.get(boite) ?? []), f])
  }
  const fichesDeLAdresse = (email: string): FicheImportQr[] => {
    const exacte = fichesParEmail.get(email)
    return exacte ? [exacte] : fichesParBoite.get(boiteEmailQr(email) ?? '') ?? []
  }
  const autresCabinets = new Set(contexte.emailsAutresCabinets.map(emailCanoniqueQr).filter((e): e is string => e !== null))
  const utilisable = (f: FicheImportQr) => f.actif && !f.contestee
  const inconnus = new Map<string, GestionnaireInconnuImportQr>()
  const precedentes: CoproprieteDoublonQr[] = []

  const diagnostics = lignes.map((l): DiagnosticLigneImportQr => {
    const messages: MessageImportQr[] = []
    const erreur = (champ: ChampImportQr | null, texte: string) => messages.push({ niveau: 'erreur', champ, texte })
    const avertir = (champ: ChampImportQr | null, texte: string) => messages.push({ niveau: 'avertissement', champ, texte })
    const gestionnaires = new Map<string, GestionnaireResumeQr>()
    const attribuer = (f: FicheImportQr) => gestionnaires.set(f.id, { id: f.id, nom: f.nom })

    // 1. Gestionnaires cités par adresse (ou une variante) : fiche active (non contestée) DU cabinet seulement.
    for (const email of l.gestionnaires.map(emailCanoniqueQr).filter((e): e is string => e !== null)) {
      const fiches = fichesDeLAdresse(email)
      if (fiches.length > 0) {
        const utilisables = fiches.filter(utilisable)
        if (utilisables.length > 0) for (const f of utilisables) attribuer(f)
        else if (fiches.some((f) => !f.actif)) erreur('gestionnaires', M.gestionnaireDesactive(email))
        else erreur('gestionnaires', M.gestionnaireConteste(email))
      } else if (autresCabinets.has(email)) {
        erreur('gestionnaires', M.gestionnaireAutreCabinet(email))
      } else if (emailDansDomainesQr(email, contexte.domainesAutresCabinets)) {
        // Domaine d'un AUTRE cabinet client : jamais proposé à la création, même forcée (§ 6, relecture 2).
        erreur('gestionnaires', M.gestionnaireDomaineAutreCabinet(email))
      } else {
        erreur('gestionnaires', M.gestionnaireInconnu(email))
        const deja = inconnus.get(email)
        if (deja) { if (!deja.lignes.includes(l.numeroLigne)) deja.lignes.push(l.numeroLigne) }
        else inconnus.set(email, { email, nomPropose: nomDepuisEmailQr(email), dansDomaines: emailDansDomainesQr(email, contexte.domaines), lignes: [l.numeroLigne] })
      }
    }

    // 2. Gestionnaires cités par nom : une seule fiche utilisable du cabinet porte ce nom, sinon erreur.
    for (const nom of l.nomsGestionnaires) {
      const cle = normaliserNomPersonne(nom)
      const memes = contexte.fiches.filter((f) => f.nom !== null && normaliserNomPersonne(f.nom) === cle)
      const utilisables = memes.filter(utilisable)
      if (utilisables.length === 1) attribuer(utilisables[0])
      else if (utilisables.length > 1) erreur('gestionnaires', M.gestionnaireHomonymes(nom))
      else if (memes.some((f) => !f.actif)) erreur('gestionnaires', M.gestionnaireDesactive(nom))
      else if (memes.length > 0) erreur('gestionnaires', M.gestionnaireConteste(nom))
      else erreur('gestionnaires', M.gestionnaireInconnu(nom))
    }

    // 3. Destinataires : une adresse de fiche (ou une variante, même règle que le formulaire) n'y reste jamais (RG-06
    //    bis) ; fiche utilisable : mise dans Gestionnaire(s), sinon retirée ; hors domaines du cabinet, à confirmer (RG-02).
    const emailsDestinataires: string[] = []
    const emailsHorsDomaine: string[] = []
    const avisDomaines: string[] = []
    for (const email of [...new Set(l.emailsDestinataires.map(emailCanoniqueQr).filter((e): e is string => e !== null))]) {
      const fiches = fichesDeLAdresse(email)
      if (fiches.length > 0) {
        const utilisables = fiches.filter(utilisable)
        for (const f of utilisables) attribuer(f)
        avertir('emailsDestinataires', utilisables.length > 0 ? M.destinataireGestionnaire(email) : M.destinataireRetire(email))
        continue
      }
      if (autresCabinets.has(email)) { avertir('emailsDestinataires', M.destinataireAutreCabinet(email)); continue }
      emailsDestinataires.push(email)
      if (contexte.domaines.length > 0 && !emailDansDomainesQr(email, contexte.domaines)) {
        emailsHorsDomaine.push(email)
        avisDomaines.push(M.horsDomaine(email))
      }
    }

    // 4. Doublons dans le fichier : la seconde occurrence d'un doublon certain est en erreur ; un probable avertit.
    const fiche = ficheDoublon(l)
    const dansFichier = doublonsCoproprieteQr(fiche, precedentes)[0]
    const doublonFichier = dansFichier?.certitude === 'certain'
    if (dansFichier) {
      const autre = Number(dansFichier.copropriete.id.slice(PREFIXE_LIGNE.length))
      if (doublonFichier) erreur(null, M.doublonFichier(autre))
      else avertir(null, M.ressembleLigne(autre))
    }
    precedentes.push({ id: `${PREFIXE_LIGNE}${l.numeroLigne}`, ...fiche, ville: l.ville })

    // 5. Doublon avec une copropriété du cabinet (actives ou non), et la décision de la ligne.
    const doublon = doublonsCoproprieteQr(fiche, contexte.existantes)[0] ?? null
    if (doublon) {
      const { nom, ville } = doublon.copropriete
      avertir(null, doublon.certitude === 'certain' ? M.existeDeja(nom, ville, doublon.critere) : M.ressembleExistante(nom, ville, doublon.critere))
    }
    if (l.actionSiExiste === 'completer' && (doublon?.certitude !== 'certain' || doublon.copropriete.id !== l.coproprieteExistanteId)) {
      erreur(null, M.completerAutre)
    }
    const decision = actionImportQr(doublon, l)

    // « Compléter » ne touche jamais aux destinataires de la fiche existante (la fonction SQL ne remplit que les vides).
    if (decision.action === 'completer') {
      if (emailsDestinataires.length > 0) avertir('emailsDestinataires', M.destinatairesNonRepris)
      emailsDestinataires.length = 0
      emailsHorsDomaine.length = 0
    } else {
      for (const avis of avisDomaines) avertir('emailsDestinataires', avis)
    }

    const enErreur = messages.some((m) => m.niveau === 'erreur')
    const etat: EtatLigneImportQr = doublonFichier ? 'doublon_fichier'
      : enErreur ? 'erreur'
        : doublon?.certitude === 'certain' ? 'existe_deja'
          : messages.length > 0 ? 'avertissement' : 'a_creer'
    return {
      numeroLigne: l.numeroLigne, nom: l.nom, etat, action: doublonFichier || enErreur ? 'aucune' : decision.action, messages, doublon,
      gestionnaires: [...gestionnaires.values()], emailsDestinataires, emailsHorsDomaine,
    }
  })

  return {
    diagnostics,
    gestionnairesInconnus: [...inconnus.values()],
    horsDomaine: diagnostics.some((d) => d.action === 'creer' && d.emailsHorsDomaine.length > 0),
  }
}

/**
 * Lignes passées à signalements_qr_creer_coproprietes (un seul appel, tout ou rien) : créées et complétées seulement ;
 * les ignorées et les lignes en erreur sont comptées, jamais envoyées. Une ligne sans diagnostic compte en erreur.
 */
export function planCreationImportQr(lignes: readonly LigneImportQr[], verification: VerificationImportQr): PlanImportQr {
  const parNumero = new Map(verification.diagnostics.map((d) => [d.numeroLigne, d]))
  const lignesSql: LigneSqlImportQr[] = []
  let ignorees = 0
  let erreurs = 0
  for (const l of lignes) {
    const d = parNumero.get(l.numeroLigne)
    if (!d || d.action === 'aucune') { erreurs += 1; continue }
    if (d.action === 'ignorer') { ignorees += 1; continue }
    const commun = {
      numeroLigne: l.numeroLigne, origine: 'import' as const, nom: l.nom, adresse: l.adresse,
      codePostal: l.codePostal, ville: l.ville, immatriculation: l.immatriculation, referenceCabinet: l.referenceCabinet, batiments: l.batiments,
      gestionnaireIds: d.gestionnaires.map((g) => g.id),
    }
    const existante = d.doublon?.copropriete
    if (d.action === 'creer') {
      lignesSql.push({ ...commun, action: 'creer', cleNom: cleNomCoproQr(l.nom), emails: d.emailsDestinataires, forcerDoublon: actionImportQr(d.doublon, l).forcerDoublon })
    } else if (l.coproprieteExistanteId && existante?.id === l.coproprieteExistanteId) {
      // Le nom de la fiche existante ne change pas : sa clé (et non celle de la ligne) complète cle_nom (relecture 8).
      lignesSql.push({
        ...commun, action: 'completer', coproprieteId: l.coproprieteExistanteId, cleNomExistante: cleNomCoproQr(existante.nom), emails: [], forcerDoublon: false,
      })
    } else {
      erreurs += 1
    }
  }
  return { lignesSql, ignorees, erreurs }
}
