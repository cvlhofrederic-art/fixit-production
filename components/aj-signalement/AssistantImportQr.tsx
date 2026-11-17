'use client'

// ── Assistant d'import des copropriétés (espace AJ Signalement, vue Copropriétés, super admin) ───────────────────
//
// Demande de Hugo du 10/11/2026 : « créer les copropriétés à partir d'un tableau Excel fourni par le client » (SPEC
// § 1.9). PR brouillon pour Frédéric : composants et couleurs de l'espace (Bouton, Champ, Encadre, Badge), aucun
// nouveau système visuel. Une seule fenêtre, des sections qui s'ajoutent :
//   1. cabinet client (obligatoire : chaque copropriété importée lui est rattachée), modèle Excel ou CSV à télécharger,
//      fichier .xlsx ou .csv LU SUR L'APPAREIL (jamais envoyé ni conservé ; seule la correspondance des colonnes est
//      retenue dans le navigateur, par empreinte des en-têtes) ;
//   2. feuille, ligne d'en-têtes, colonne de chaque champ (5 premières valeurs en regard), option « adresse complète » ;
//   3. vérification à blanc au serveur (les lignes en erreur de format restent ici) ; aperçu : état et messages par
//      ligne, filtres ; doublon existant : ignorer, compléter la fiche, « ce n'est pas un doublon » ; doublon probable :
//      créer quand même ; gestionnaires sans fiche : création une par une (P1-R9, confirmation envoyée à chacun ; hors
//      domaines du cabinet, seulement si sa case est cochée), puis nouvelle vérification ; destinataires hors domaines :
//      confirmation avant l'import ;
//   4. import (tout ou rien) ; puis toutes les affiches en un PDF et l'export CSV (générés sur l'appareil).
// Le lecteur .xlsx et le modèle (fflate) sont chargés au clic : jamais dans le premier chargement de l'espace.
// Logo du cabinet (demande de Hugo du 13/11/2026) : les affiches du lot portent le logo du cabinet choisi s'il en a un
// (métadonnées de la liste des cabinets, image lue une fois au clic) ; logo illisible : affiches sans logo, avertissement.

import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Champ, CLASSES_SAISIE, Encadre, type TonBadge } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { creerGestionnaireQr, creerImportQr, verifierImportQr } from '@/lib/aj-signalement/api'
import { lireCsvQr } from '@/lib/aj-signalement/import/csv'
import { exportCoproprietesCsvQr } from '@/lib/aj-signalement/import/export-csv'
import {
  CHAMPS_IMPORT_QR, COLONNES_LUES_MAX_QR, LIGNES_ENTETES_CHERCHEES_QR, TAILLE_FICHIER_IMPORT_MAX_QR, actionImportQr, correspondanceAutomatiqueQr,
  empreinteEntetesQr, exemplesColonneQr, normaliserLignesImportQr, trouverLigneEntetesQr,
} from '@/lib/aj-signalement/import/ligne'
import { MESSAGES_IMPORT_QR as M, TEXTES_IMPORT_QR as I } from '@/lib/aj-signalement/import/textes'
import { affichesPdfQr, nomFichierQr, telechargerFichier } from '@/lib/aj-signalement/qr'
import { affichesAvecRepliQr, logoPourAfficheQr } from '@/components/aj-signalement/logoAfficheQr'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import {
  urlSignalementQr,
  type ActionImportQr, type CabinetQr, type ChampImportQr, type ChoixLigneImportQr, type CorrespondanceImportQr, type DiagnosticLigneImportQr,
  type EtatLigneImportQr, type LectureTableurQr, type LigneExportCoproprieteQr, type LigneImportQr, type MessageImportQr,
  type NormalisationImportQr, type ResultatImportQr, type VerificationImportQr,
} from '@/lib/aj-signalement/types'

export interface PropsAssistantImportQr {
  /** Cabinets clients de l'espace ; null : pas encore chargés. */
  cabinets: readonly CabinetQr[] | null
  /** Origine des liens encodés dans les QR codes et l'export (le site courant). */
  origine: string
  onFermer: () => void
  /** Import réussi : l'espace recharge la liste des copropriétés. */
  onImporte: () => void
}

type Occupation = 'lecture' | 'verification' | 'fiches' | 'creation' | 'affiches' | null
type Lu = Extract<LectureTableurQr, { ok: true }>
type Fichier = { octets: Uint8Array; type: 'xlsx' | 'csv' }
type Filtre = 'toutes' | 'erreurs' | 'doublons'
type ChoixDoublon = 'ignorer' | 'completer' | 'forcer'

const TON_ETAT: Record<EtatLigneImportQr, TonBadge> = {
  a_creer: 'vert', avertissement: 'ambre', erreur: 'rouge', doublon_fichier: 'rouge', existe_deja: 'gris',
}

const CHOIX_DEFAUT: ChoixLigneImportQr = { actionSiExiste: 'ignorer', forcerDoublon: false, creerSiDoublonProbable: true }

// ── Correspondance retenue dans le navigateur (noms de colonnes seulement, jamais une valeur) ────────────────────

const CLE_STOCKAGE = 'aj-signalement:import-colonnes:'

interface CorrespondanceRetenue { correspondance: CorrespondanceImportQr; adresseComplete: boolean }

function lireRetenue(empreinte: string): CorrespondanceRetenue | null {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE + empreinte)
    if (!brut) return null
    const valeur: unknown = JSON.parse(brut)
    if (typeof valeur !== 'object' || valeur === null) return null
    const { correspondance, adresseComplete } = valeur as { correspondance?: unknown; adresseComplete?: unknown }
    if (typeof correspondance !== 'object' || correspondance === null) return null
    const propre: CorrespondanceImportQr = {}
    for (const champ of CHAMPS_IMPORT_QR) {
      const colonne = (correspondance as Record<string, unknown>)[champ]
      if (typeof colonne === 'number' && Number.isInteger(colonne) && colonne >= 0 && colonne < COLONNES_LUES_MAX_QR) propre[champ] = colonne
    }
    return { correspondance: propre, adresseComplete: adresseComplete === true }
  } catch (e) {
    console.warn('[aj-signalement] correspondance retenue illisible', e instanceof Error ? e.name : 'inconnue')
    return null
  }
}

function retenir(empreinte: string, valeur: CorrespondanceRetenue): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE + empreinte, JSON.stringify(valeur))
  } catch (e) {
    // Stockage plein ou refusé (navigation privée) : la correspondance sera reproposée, rien d'autre.
    console.warn('[aj-signalement] correspondance non retenue', e instanceof Error ? e.name : 'inconnue')
  }
}

/** « A », « B »… : lettre d'une colonne. */
function lettreColonne(index: number): string {
  let n = index + 1
  let lettres = ''
  while (n > 0) {
    lettres = String.fromCharCode(65 + ((n - 1) % 26)) + lettres
    n = Math.floor((n - 1) / 26)
  }
  return lettres
}

/** Adresse imprimée sur l'affiche : voie, puis code postal et ville. */
const adresseAffiche = (l: Pick<LigneExportCoproprieteQr, 'adresse' | 'codePostal' | 'ville'>): string =>
  [l.adresse, `${l.codePostal} ${l.ville}`.trim()].filter(Boolean).join(', ')

/** Ligne de l'aperçu : diagnostic du serveur (ou erreur de format restée ici) et décision selon le choix courant. */
interface LigneApercu {
  numeroLigne: number
  nom: string
  etat: EtatLigneImportQr
  messages: MessageImportQr[]
  diagnostic: DiagnosticLigneImportQr | null
  action: ActionImportQr
}

export default function AssistantImportQr({ cabinets, origine, onFermer, onImporte }: Readonly<PropsAssistantImportQr>) {
  const idBase = useId()
  // Cabinet choisi ; un cabinet seul est choisi d'office (même s'il arrive après l'ouverture de la fenêtre).
  const [cabinetChoisi, setCabinetId] = useState('')
  const [operationId, setOperationId] = useState(() => globalThis.crypto.randomUUID())
  const [fichier, setFichier] = useState<Fichier | null>(null)
  const [lecture, setLecture] = useState<Lu | null>(null)
  const [erreurLecture, setErreurLecture] = useState<string | null>(null)
  const [occupe, setOccupe] = useState<Occupation>(null)
  const [indexEntetes, setIndexEntetes] = useState(0)
  const [correspondance, setCorrespondance] = useState<CorrespondanceImportQr>({})
  const [adresseComplete, setAdresseComplete] = useState(false)
  const [verifie, setVerifie] = useState<{ normalisation: NormalisationImportQr; verification: VerificationImportQr } | null>(null)
  const [choix, setChoix] = useState<Record<number, ChoixLigneImportQr>>({})
  const [confirmerHorsDomaine, setConfirmerHorsDomaine] = useState(false)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [nomsInconnus, setNomsInconnus] = useState<Record<string, string>>({})
  const [forcerInconnus, setForcerInconnus] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur' | 'avertissement'; texte: string } | null>(null)
  const [resultat, setResultat] = useState<{ resultat: ResultatImportQr; exports: LigneExportCoproprieteQr[] } | null>(null)
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null)

  const cabinetId = cabinetChoisi || (cabinets?.length === 1 ? cabinets[0].id : '')
  const cabinet = cabinets?.find((c) => c.id === cabinetId) ?? null
  const entetes = useMemo(() => lecture?.lignes[indexEntetes] ?? [], [lecture, indexEntetes])
  const nbColonnes = useMemo(() => Math.min(COLONNES_LUES_MAX_QR, Math.max(0, ...(lecture?.lignes ?? []).map((l) => l.length))), [lecture])

  // ── Lecture du fichier ──────────────────────────────────────────────────────

  /**
   * Nouveau lot (autre fichier, autre feuille, autre cabinet, import fait ou refusé) : nouvelle opération. Le serveur ne
   * rejoue un résultat que pour le même lot ; un identifiant réutilisé ferait sinon revérifier pour rien (relecture 1).
   */
  const nouvelleOperation = () => setOperationId(globalThis.crypto.randomUUID())

  /** Feuille lue : ligne d'en-têtes trouvée, correspondance retenue (mêmes en-têtes) ou proposée ; choix et résultat effacés. */
  const appliquerLecture = (lu: Lu) => {
    const index = trouverLigneEntetesQr(lu.lignes)
    proposerCorrespondance(lu.lignes[index] ?? [])
    nouvelleOperation()
    setLecture(lu)
    setIndexEntetes(index)
    setChoix({})
    setVerifie(null)
    setResultat(null)
    setMessage(null)
  }

  const choisirCabinet = (id: string) => {
    setCabinetId(id)
    nouvelleOperation()
    setVerifie(null)
    setResultat(null)
    setMessage(null)
  }

  const proposerCorrespondance = (lignesEntetes: readonly string[]) => {
    const retenue = lireRetenue(empreinteEntetesQr(lignesEntetes))
    setCorrespondance(retenue?.correspondance ?? correspondanceAutomatiqueQr(lignesEntetes))
    setAdresseComplete(retenue?.adresseComplete ?? false)
  }

  const lireFichier = async (f: File) => {
    setErreurLecture(null)
    setLecture(null)
    setVerifie(null)
    setResultat(null)
    setMessage(null)
    if (f.size > TAILLE_FICHIER_IMPORT_MAX_QR) {
      setErreurLecture(I.erreursLecture.trop_gros)
      return
    }
    setOccupe('lecture')
    try {
      const octets = new Uint8Array(await f.arrayBuffer())
      const type: Fichier['type'] = /\.(csv|txt)$/i.test(f.name) ? 'csv' : 'xlsx'
      let lu: LectureTableurQr
      if (type === 'csv') lu = lireCsvQr(octets)
      else {
        const { lireXlsxQr } = await import('@/lib/aj-signalement/import/lecteur-xlsx')
        lu = await lireXlsxQr(octets)
      }
      if (!lu.ok) {
        setErreurLecture(I.erreursLecture[lu.code])
        return
      }
      // Nouveau fichier : nouvelle opération et choix effacés (appliquerLecture).
      setFichier({ octets, type })
      appliquerLecture(lu)
    } catch (e) {
      console.warn('[aj-signalement] fichier non lu', e instanceof Error ? e.name : 'inconnue')
      setErreurLecture(I.erreursLecture.illisible)
    } finally {
      setOccupe(null)
    }
  }

  const choisirFeuille = async (nom: string) => {
    if (!fichier || fichier.type !== 'xlsx') return
    setOccupe('lecture')
    try {
      const { lireXlsxQr } = await import('@/lib/aj-signalement/import/lecteur-xlsx')
      const lu = await lireXlsxQr(fichier.octets, nom)
      if (lu.ok) appliquerLecture(lu)
      else setErreurLecture(I.erreursLecture[lu.code])
    } catch (e) {
      console.warn('[aj-signalement] feuille non lue', e instanceof Error ? e.name : 'inconnue')
      setErreurLecture(I.erreursLecture.illisible)
    } finally {
      setOccupe(null)
    }
  }

  const choisirLigneEntetes = (index: number) => {
    setIndexEntetes(index)
    proposerCorrespondance(lecture?.lignes[index] ?? [])
    setVerifie(null)
  }

  const relier = (champ: ChampImportQr, valeur: string) => {
    setCorrespondance((c) => {
      const suivante = { ...c }
      if (valeur === '') delete suivante[champ]
      else suivante[champ] = Number(valeur)
      return suivante
    })
    setVerifie(null)
  }

  // ── Modèle ──────────────────────────────────────────────────────────────────

  const telechargerModele = async (format: 'xlsx' | 'csv') => {
    try {
      const modele = await import('@/lib/aj-signalement/import/modele-xlsx')
      if (format === 'xlsx') {
        const octets = await modele.octetsModeleXlsxQr()
        telechargerFichier('modele-import-coproprietes.xlsx', new Blob([new Uint8Array(octets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      } else {
        telechargerFichier('modele-import-coproprietes.csv', new Blob([modele.modeleCsvQr()], { type: 'text/csv;charset=utf-8' }))
      }
    } catch (e) {
      console.warn('[aj-signalement] modèle non préparé', e instanceof Error ? e.name : 'inconnue')
      toast.error(I.erreurFichier)
    }
  }

  // ── Vérification ────────────────────────────────────────────────────────────

  const avecChoix = (s: LigneImportQr): LigneImportQr => ({ ...s, ...(choix[s.numeroLigne] ?? {}) })

  /** Lignes lues et normalisées, vérifiées au serveur ; true si la vérification a répondu. */
  const verifier = async (): Promise<boolean> => {
    if (!lecture || !cabinet) return false
    setMessage(null)
    if (correspondance.nom === undefined) {
      setMessage({ ton: 'erreur', texte: I.nomObligatoire })
      return false
    }
    retenir(empreinteEntetesQr(entetes), { correspondance, adresseComplete })
    const normalisation = normaliserLignesImportQr(lecture.lignes, indexEntetes, correspondance, { adresseComplete })
    if (normalisation.tropDeLignes) {
      setVerifie(null)
      setMessage({ ton: 'erreur', texte: I.tropDeLignes })
      return false
    }
    if (normalisation.lignes.length === 0) {
      setVerifie(null)
      setMessage({ ton: 'erreur', texte: I.aucuneLigne })
      return false
    }
    const saisies = normalisation.lignes.flatMap((l) => (l.saisie ? [avecChoix(l.saisie)] : []))
    if (saisies.length === 0) {
      setVerifie({ normalisation, verification: { diagnostics: [], gestionnairesInconnus: [], horsDomaine: false } })
      return true
    }
    setOccupe('verification')
    const r = await verifierImportQr({ cabinetId: cabinet.id, operationId, lignes: saisies, confirmerHorsDomaine: false })
    setOccupe(null)
    if (!r.ok) {
      setMessage({ ton: 'erreur', texte: messageEchecQr(r.code) })
      return false
    }
    setVerifie({ normalisation, verification: r.verification })
    setNomsInconnus(Object.fromEntries(r.verification.gestionnairesInconnus.map((g) => [g.email, g.nomPropose])))
    setForcerInconnus({})
    setConfirmerHorsDomaine(false)
    return true
  }

  // ── Aperçu ──────────────────────────────────────────────────────────────────

  const apercu: LigneApercu[] = useMemo(() => {
    if (!verifie) return []
    const diagnostics = new Map(verifie.verification.diagnostics.map((d) => [d.numeroLigne, d]))
    return verifie.normalisation.lignes.map((l): LigneApercu => {
      if (!l.saisie) return { numeroLigne: l.numeroLigne, nom: l.nom, etat: 'erreur', messages: l.messages, diagnostic: null, action: 'aucune' }
      const d = diagnostics.get(l.numeroLigne)
      if (!d) {
        return { numeroLigne: l.numeroLigne, nom: l.nom, etat: 'erreur', messages: [...l.messages, { niveau: 'erreur', champ: null, texte: M.nonVerifiee }], diagnostic: null, action: 'aucune' }
      }
      const action = d.action === 'aucune' ? 'aucune' : actionImportQr(d.doublon, { ...CHOIX_DEFAUT, ...(choix[l.numeroLigne] ?? {}) }).action
      return { numeroLigne: l.numeroLigne, nom: d.nom || l.nom, etat: d.etat, messages: [...l.messages, ...d.messages], diagnostic: d, action }
    })
  }, [verifie, choix])

  const compte = (action: ActionImportQr) => apercu.filter((l) => l.action === action).length
  const nbCreer = compte('creer')
  const nbCompleter = compte('completer')
  const nbErreurs = compte('aucune')
  const horsDomaine = apercu.some((l) => l.action === 'creer' && (l.diagnostic?.emailsHorsDomaine.length ?? 0) > 0)
  const visibles = apercu.filter((l) => filtre === 'toutes'
    || (filtre === 'erreurs' && (l.etat === 'erreur' || l.etat === 'doublon_fichier'))
    || (filtre === 'doublons' && (l.etat === 'doublon_fichier' || (l.diagnostic?.doublon ?? null) !== null)))

  const choisirDoublon = (ligne: LigneApercu, valeur: ChoixDoublon) => {
    const doublon = ligne.diagnostic?.doublon
    if (!doublon) return
    const suivant: ChoixLigneImportQr = valeur === 'completer'
      ? { ...CHOIX_DEFAUT, actionSiExiste: 'completer', coproprieteExistanteId: doublon.copropriete.id }
      : { ...CHOIX_DEFAUT, forcerDoublon: valeur === 'forcer' }
    setChoix((c) => ({ ...c, [ligne.numeroLigne]: suivant }))
  }

  const choisirProbable = (ligne: LigneApercu, creer: boolean) => {
    setChoix((c) => ({ ...c, [ligne.numeroLigne]: { ...CHOIX_DEFAUT, creerSiDoublonProbable: creer } }))
  }

  // ── Gestionnaires sans fiche ────────────────────────────────────────────────

  const creerFiches = async () => {
    if (!verifie || !cabinet) return
    const aCreer = verifie.verification.gestionnairesInconnus.filter((g) => g.dansDomaines || forcerInconnus[g.email])
    if (aCreer.length === 0) return
    setOccupe('fiches')
    setMessage(null)
    let creees = 0
    const echecs: string[] = []
    // Une par une, hors de la transaction d'import : chaque e-mail de confirmation nomme le cabinet et la personne.
    for (const g of aCreer) {
      const r = await creerGestionnaireQr({
        nom: (nomsInconnus[g.email] ?? g.nomPropose).trim() || g.nomPropose, email: g.email, cabinetId: cabinet.id, coproprieteIds: [],
        forcerDomaine: !g.dansDomaines,
      })
      if (r.ok) creees += 1
      else echecs.push(remplir(I.fichesEchec, { email: g.email, raison: messageEchecQr(r.code) }))
    }
    setOccupe(null)
    const ok = await verifier()
    const textes = [...(creees > 0 && ok ? [remplir(I.fichesCreees, { n: creees })] : []), ...echecs]
    if (textes.length > 0) setMessage({ ton: echecs.length > 0 ? 'erreur' : 'succes', texte: textes.join(' ') })
  }

  // ── Création ────────────────────────────────────────────────────────────────

  const importer = async () => {
    if (!verifie || !cabinet) return
    const envoyees = new Set(apercu.filter((l) => l.action !== 'aucune').map((l) => l.numeroLigne))
    const lignes = verifie.normalisation.lignes.flatMap((l) => (l.saisie && envoyees.has(l.numeroLigne) ? [avecChoix(l.saisie)] : []))
    if (lignes.length === 0) return
    setOccupe('creation')
    setMessage(null)
    const r = await creerImportQr({ cabinetId: cabinet.id, operationId, lignes, confirmerHorsDomaine: horsDomaine && confirmerHorsDomaine })
    setOccupe(null)
    if (!r.ok) {
      if (r.code === 'a_reverifier' && r.verification) {
        // Rien n'a été écrit sous cet identifiant (ou il est celui d'un autre lot) : le prochain envoi en tire un neuf.
        nouvelleOperation()
        setVerifie({ normalisation: verifie.normalisation, verification: r.verification })
        setMessage({ ton: 'avertissement', texte: I.aReverifier })
        return
      }
      // Réseau, serveur, limite : identifiant gardé, pour qu'un nouvel essai rejoue l'import s'il a eu lieu.
      setMessage({ ton: 'erreur', texte: messageEchecQr(r.code) })
      return
    }
    // Affiches et export : ce que la base a enregistré (nom, adresse, jeton), jamais les saisies de l'écran ; les noms des
    // gestionnaires viennent de la vérification de ce même lot.
    const diagnostics = new Map(verifie.verification.diagnostics.map((d) => [d.numeroLigne, d]))
    const exports = r.resultat.creees.map((c): LigneExportCoproprieteQr => ({
      nom: c.nom, adresse: c.adresse, codePostal: c.codePostal, ville: c.ville,
      gestionnaires: (diagnostics.get(c.numeroLigne)?.gestionnaires ?? []).map((g) => g.nom ?? '').filter(Boolean),
      jeton: c.jeton, identifiantCabinet: cabinet.identifiant || null,
    }))
    nouvelleOperation()
    setResultat({ resultat: r.resultat, exports })
    onImporte()
  }

  const telechargerAffiches = async () => {
    if (!resultat || occupe) return
    setOccupe('affiches')
    try {
      const liste = resultat.exports.map((e) => ({ nom: e.nom, adresse: adresseAffiche(e), url: urlSignalementQr(e.jeton, origine, e.identifiantCabinet) }))
      const avancer = (fait: number, total: number) => setAvancement({ fait, total })
      const sansLogo = G.cabinets.logo.affichesSansLogo
      const logo = await logoPourAfficheQr(cabinet?.identifiant, cabinet?.logo, sansLogo)
      const pdf = await affichesAvecRepliQr(logo, (l) => (l ? affichesPdfQr(liste, avancer, { logo: l }) : affichesPdfQr(liste, avancer)), sansLogo)
      telechargerFichier(`affiches-qr-${nomFichierQr(cabinet?.identifiant ?? 'coproprietes')}.pdf`, pdf)
    } catch (e) {
      console.warn('[aj-signalement] affiches non préparées', e instanceof Error ? e.name : 'inconnue')
      toast.error(I.erreurFichier)
    } finally {
      setOccupe(null)
      setAvancement(null)
    }
  }

  const exporter = () => {
    if (!resultat) return
    telechargerFichier('coproprietes-importees.csv', new Blob([exportCoproprietesCsvQr(resultat.exports, origine)], { type: 'text/csv;charset=utf-8' }))
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────

  if (cabinets === null) return <p role="status" className="text-base text-[#4A5E78]">{I.chargementCabinets}</p>
  if (cabinets.length === 0) {
    return (
      <div className="space-y-4">
        <Encadre ton="info">{I.aucunCabinet}</Encadre>
        <Bouton variante="secondaire" onClick={onFermer}>{I.fermer}</Bouton>
      </div>
    )
  }

  const inconnus = verifie?.verification.gestionnairesInconnus ?? []
  const inconnusDansDomaines = inconnus.filter((g) => g.dansDomaines)
  const inconnusHorsDomaines = inconnus.filter((g) => !g.dansDomaines)

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <Encadre ton="info">{I.intro}</Encadre>

      <section className="space-y-4">
        <Champ id={`${idBase}-cabinet`} etiquette={I.cabinet}>
          <select
            id={`${idBase}-cabinet`} value={cabinetId} className={CLASSES_SAISIE} disabled={occupe !== null}
            onChange={(e) => choisirCabinet(e.target.value)}
          >
            <option value="">{I.choisirCabinet}</option>
            {cabinets.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="discret" petit icone="documents" onClick={() => { void telechargerModele('xlsx') }}>{I.modeleXlsx}</Bouton>
          <Bouton variante="discret" petit icone="documents" onClick={() => { void telechargerModele('csv') }}>{I.modeleCsv}</Bouton>
        </div>
        <Champ id={`${idBase}-fichier`} etiquette={I.fichier} aide={I.fichierAide}>
          <input
            id={`${idBase}-fichier`} type="file" accept=".xlsx,.csv" disabled={!cabinet || occupe !== null}
            aria-describedby={`${idBase}-fichier-aide`}
            className="block w-full text-base text-[#0D1B2E] file:mr-3 file:min-h-[44px] file:rounded-xl file:border file:border-[#C9B99A] file:bg-white file:px-4 file:font-semibold"
            onChange={(e) => {
              const choisi = e.target.files?.[0]
              e.target.value = ''
              if (choisi) void lireFichier(choisi)
            }}
          />
        </Champ>
        {occupe === 'lecture' && <p role="status" className="text-base text-[#4A5E78]">{I.lecture}</p>}
        {erreurLecture && <Encadre ton="erreur">{erreurLecture}</Encadre>}
      </section>

      {lecture && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-[#0D1B2E]">{I.correspondance}</h3>
          <p className="text-sm text-[#4A5E78]">{I.correspondanceAide}</p>
          {lecture.avertissements.map((a) => <Encadre key={a} ton="avertissement">{a}</Encadre>)}
          {lecture.tronque && <Encadre ton="avertissement">{I.lignesTronquees}</Encadre>}
          {lecture.feuilles.length > 1 && (
            <Champ id={`${idBase}-feuille`} etiquette={I.feuille}>
              <select id={`${idBase}-feuille`} value={lecture.feuille ?? ''} className={CLASSES_SAISIE} disabled={occupe !== null} onChange={(e) => { void choisirFeuille(e.target.value) }}>
                {lecture.feuilles.map((f) => <option key={f.nom} value={f.nom}>{f.visible ? f.nom : remplir(I.feuilleMasquee, { nom: f.nom })}</option>)}
              </select>
            </Champ>
          )}
          <Champ id={`${idBase}-entetes`} etiquette={I.ligneEntetes}>
            <select id={`${idBase}-entetes`} value={indexEntetes} className={CLASSES_SAISIE} onChange={(e) => choisirLigneEntetes(Number(e.target.value))}>
              {lecture.lignes.slice(0, LIGNES_ENTETES_CHERCHEES_QR).map((l, i) => (
                <option key={i} value={i}>{remplir(I.ligneEntetesOption, { n: i + 1, apercu: l.filter((c) => c.trim()).slice(0, 4).join(' · ').slice(0, 80) })}</option>
              ))}
            </select>
          </Champ>
          <div className="grid gap-4 sm:grid-cols-2">
            {CHAMPS_IMPORT_QR.map((champ) => {
              const colonne = correspondance[champ]
              const exemples = colonne === undefined ? [] : exemplesColonneQr(lecture.lignes, indexEntetes, colonne)
              return (
                <Champ
                  key={champ} id={`${idBase}-${champ}`} etiquette={I.champs[champ]}
                  aide={colonne === undefined ? undefined : exemples.length > 0 ? remplir(I.exemples, { valeurs: exemples.join(' · ') }) : I.aucunExemple}
                >
                  <select
                    id={`${idBase}-${champ}`} value={colonne === undefined ? '' : String(colonne)} className={CLASSES_SAISIE}
                    onChange={(e) => relier(champ, e.target.value)}
                  >
                    <option value="">{I.ignorer}</option>
                    {Array.from({ length: nbColonnes }, (_, i) => (
                      <option key={i} value={String(i)}>{remplir(I.colonne, { lettre: lettreColonne(i), entete: (entetes[i] ?? '').trim() || '—' })}</option>
                    ))}
                  </select>
                </Champ>
              )
            })}
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-[#0D1B2E]">
            <input type="checkbox" checked={adresseComplete} onChange={(e) => { setAdresseComplete(e.target.checked); setVerifie(null) }} className="h-5 w-5 shrink-0 accent-[#C9A84C]" />
            <span>{I.adresseComplete}</span>
          </label>
          <Bouton variante="principal" icone="check" disabled={!cabinet || occupe !== null} onClick={() => { void verifier() }}>
            {occupe === 'verification' ? I.verification : I.verifier}
          </Bouton>
        </section>
      )}

      {message && <Encadre ton={message.ton}>{message.texte}</Encadre>}

      {verifie && !resultat && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-[#0D1B2E]">{I.apercu}</h3>
          <p className="text-base text-[#1F2D3D]">{remplir(I.resume, { creer: nbCreer, completer: nbCompleter, ignorer: compte('ignorer'), erreurs: nbErreurs })}</p>
          <Champ id={`${idBase}-filtre`} etiquette={I.filtre}>
            <select id={`${idBase}-filtre`} value={filtre} className={CLASSES_SAISIE} onChange={(e) => setFiltre(e.target.value as Filtre)}>
              {(Object.keys(I.filtres) as Filtre[]).map((f) => <option key={f} value={f}>{I.filtres[f]}</option>)}
            </select>
          </Champ>

          {inconnus.length > 0 && (
            <Carte ton="ambre" titre={remplir(I.inconnus, { n: inconnus.length })} sousTitre={I.inconnusAide} className="space-y-3">
              <div className="space-y-3">
              {inconnusDansDomaines.map((g) => (
                <Champ key={g.email} id={`${idBase}-inconnu-${g.email}`} etiquette={remplir(I.nomInconnu, { email: g.email })}>
                  <input
                    id={`${idBase}-inconnu-${g.email}`} value={nomsInconnus[g.email] ?? g.nomPropose} maxLength={120} className={CLASSES_SAISIE}
                    onChange={(e) => setNomsInconnus((n) => ({ ...n, [g.email]: e.target.value }))}
                  />
                </Champ>
              ))}
              {inconnusHorsDomaines.length > 0 && <p className="text-sm text-[#7A4D00]">{I.horsDomaineFiches}</p>}
              {inconnusHorsDomaines.map((g) => (
                <div key={g.email} className="space-y-2">
                  <Champ id={`${idBase}-inconnu-${g.email}`} etiquette={remplir(I.nomInconnu, { email: g.email })}>
                    <input
                      id={`${idBase}-inconnu-${g.email}`} value={nomsInconnus[g.email] ?? g.nomPropose} maxLength={120} className={CLASSES_SAISIE}
                      onChange={(e) => setNomsInconnus((n) => ({ ...n, [g.email]: e.target.value }))}
                    />
                  </Champ>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-[#0D1B2E]">
                    <input
                      type="checkbox" checked={forcerInconnus[g.email] === true} className="h-5 w-5 shrink-0 accent-[#C9A84C]"
                      onChange={(e) => setForcerInconnus((f) => ({ ...f, [g.email]: e.target.checked }))}
                    />
                    <span>{remplir(I.forcerFiche, { email: g.email })}</span>
                  </label>
                </div>
              ))}
              <Bouton
                variante="secondaire" icone="utilisateur" disabled={occupe !== null || !inconnus.some((g) => g.dansDomaines || forcerInconnus[g.email])}
                onClick={() => { void creerFiches() }}
              >
                {occupe === 'fiches' ? I.creationFiches : I.creerFiches}
              </Bouton>
              </div>
            </Carte>
          )}

          <div className="space-y-3">
            {visibles.map((l) => <LigneApercuQr key={l.numeroLigne} ligne={l} choix={choix[l.numeroLigne] ?? CHOIX_DEFAUT} onDoublon={choisirDoublon} onProbable={choisirProbable} />)}
          </div>

          {horsDomaine && (
            <div className="space-y-2">
              <Encadre ton="avertissement">{I.horsDomaine}</Encadre>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-[#0D1B2E]">
                <input type="checkbox" checked={confirmerHorsDomaine} onChange={(e) => setConfirmerHorsDomaine(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#C9A84C]" />
                <span>{I.confirmerHorsDomaine}</span>
              </label>
            </div>
          )}

          <Bouton
            variante="or" icone="check" pleineLargeur
            disabled={nbCreer + nbCompleter === 0 || occupe !== null || (horsDomaine && !confirmerHorsDomaine)}
            onClick={() => { void importer() }}
          >
            {occupe === 'creation' ? I.creation : remplir(I.importer, { n: nbCreer + nbCompleter, m: nbErreurs })}
          </Bouton>
        </section>
      )}

      {resultat && (
        <section className="space-y-3">
          <Encadre ton="succes">
            {remplir(I.resultat, { creees: resultat.resultat.creees.length, completees: resultat.resultat.completees.length, ignorees: resultat.resultat.ignorees })}
          </Encadre>
          {resultat.exports.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Bouton variante="or" icone="documents" disabled={occupe !== null} onClick={() => { void telechargerAffiches() }}>{I.affiches}</Bouton>
              <Bouton variante="secondaire" icone="documents" onClick={exporter}>{I.export}</Bouton>
            </div>
          )}
          {avancement && <p role="status" className="text-base text-[#4A5E78]">{remplir(I.affichesAvancement, avancement)}</p>}
          <Bouton variante="discret" onClick={onFermer}>{I.fermer}</Bouton>
        </section>
      )}
    </div>
  )
}

// ── Une ligne de l'aperçu ────────────────────────────────────────────────────

interface PropsLigneApercuQr {
  ligne: LigneApercu
  choix: ChoixLigneImportQr
  onDoublon: (ligne: LigneApercu, valeur: ChoixDoublon) => void
  onProbable: (ligne: LigneApercu, creer: boolean) => void
}

function LigneApercuQr({ ligne, choix, onDoublon, onProbable }: Readonly<PropsLigneApercuQr>) {
  const idBase = useId()
  const doublon = ligne.diagnostic?.doublon ?? null
  const choisi: ChoixDoublon = choix.forcerDoublon ? 'forcer' : choix.actionSiExiste === 'completer' ? 'completer' : 'ignorer'
  const titre = remplir(I.ligne, { n: ligne.numeroLigne })
  const options: Array<[ChoixDoublon, string]> = doublon?.certitude === 'certain'
    ? [['ignorer', I.choixIgnorer], ['completer', I.choixCompleter], ...(doublon.forcable ? [['forcer', I.choixPasDoublon] as [ChoixDoublon, string]] : [])]
    : []
  return (
    <div role="group" aria-label={titre} className="space-y-2 rounded-xl border border-[#E4DDD0] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[#0D1B2E]">{titre}{ligne.nom ? ` — ${ligne.nom}` : ''}</p>
        <Badge ton={TON_ETAT[ligne.etat]}>{I.etats[ligne.etat]}</Badge>
      </div>
      {ligne.messages.length > 0 && (
        <ul className="space-y-1 text-sm">
          {ligne.messages.map((m, i) => <li key={i} className={m.niveau === 'erreur' ? 'text-[#8F2419]' : 'text-[#7A4D00]'}>{m.texte}</li>)}
        </ul>
      )}
      {ligne.action !== 'aucune' && options.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-[#0D1B2E]">{I.choixLigne}</legend>
          {options.map(([valeur, libelle]) => (
            <label key={valeur} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-[#0D1B2E]">
              <input
                type="radio" name={`${idBase}-choix`} value={valeur} checked={choisi === valeur} className="h-5 w-5 shrink-0 accent-[#C9A84C]"
                onChange={() => onDoublon(ligne, valeur)}
              />
              <span>{libelle}</span>
            </label>
          ))}
        </fieldset>
      )}
      {ligne.action !== 'aucune' && doublon?.certitude === 'probable' && (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-[#0D1B2E]">
          <input type="checkbox" checked={choix.creerSiDoublonProbable} onChange={(e) => onProbable(ligne, e.target.checked)} className="h-5 w-5 shrink-0 accent-[#C9A84C]" />
          <span>{I.choixCreerProbable}</span>
        </label>
      )}
    </div>
  )
}
