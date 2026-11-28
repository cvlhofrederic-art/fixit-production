'use client'

// ── Contenu de l'espace « AJ Signalement » (super admin, /fr/aj-signalement/) ───────────────────────
//
// Une seule instance, gardée montée par l'espace (components/aj-signalement/espace/EspaceAjSignalement.tsx) : un seul
// chargement (GET /api/aj-signalement/tableau) pour les trois vues de son menu :
//   - tableau de bord : présentation, indicateurs (tous les signalements), puis sous les quatre carrés la liste de tous
//     les signalements reçus avec le filtre par copropriété (demande de Hugo du 11/11/2026) ;
//   - copropriétés : cartes avec leur QR code (affiche PDF, QR PNG, lien, destinataires, modification, nouvelle
//     copropriété, adresse proposée d'après la position d'un déclarant quand elle manque) ;
//   - signalements : filtre par copropriété toujours visible, « même problème que le signalement n° X », détail avec
//     coordonnées et changement de statut.
// Tableau de bord et Signalements partagent la même liste (ListeSignalementsQr), le même filtre (choisi dans l'une, il
// reste choisi dans l'autre) et la même fenêtre de détail.
// Aucun lien avec le sélecteur de copropriété de l'AJ ni avec celui du portail. Rien n'est écrit dans le navigateur :
// les données servies restent en mémoire. Textes en français (outil de l'administrateur).
// Depuis le 11/11/2026 : filtre de la liste des copropriétés (sans cabinet, sans gestionnaire, « à tous », adresses de
// gestionnaires, par gestionnaire), fenêtre enrichie (cabinet, gestionnaires, doublons, suppression), et le tableau
// partagé avec les vues Gestionnaires, Cabinets et Journal de l'espace (onTableau ; rechargé sur « actualisation »).
// Lot 5 : « Importer un fichier » (Excel ou CSV, espace seulement) ouvre l'assistant d'import ; la liste est rechargée
// après l'import.
// PR 2, lot 5 (vueGestionnaire : espace d'un cabinet, gestionnaire connecté, SPEC § 2.8) : mêmes trois vues, sur ce que
// le serveur lui rend (sa portée, minimisée) ; tableau de bord inchangé (4 carrés qui suivent le filtre, puis la liste) ;
// copropriétés : cartes du gestionnaire, désactivées en bas, ni filtre du super admin ni import, « Ajouter une
// copropriété » par la fenêtre du gestionnaire (domaines de SON cabinet) ; statut changé entre-temps (409) : liste
// rechargée ; messages d'échec du gestionnaire (accès retiré, fonction pas encore activée, toast si le réseau est coupé).
// PR 3, lot 8 (cahier § 7.1, BROUILLON pour Frédéric) : « Diffuser un message » et « Messages envoyés » sur la carte,
// « Informer les déclarants de ce signalement » et l'opposition à la demande écrite dans le détail — pour le super admin,
// et pour un gestionnaire sur une copropriété qui lui est attribuée nommément, jamais « à tous » (H11) ; la fenêtre de
// diffusion (FenetreDiffusionQr) protège sa saisie et son envoi : un changement de vue ne la ferme pas d'office, il lui
// demande de fermer (confirmation pendant la saisie, aucune fermeture pendant l'envoi).
// Correctif du 13/11/2026 (« les listes ne se rafraîchissent pas ») : la fin d'un rechargement demandé par l'espace
// lui est signalée (onActualise), pour qu'une action attende la liste à jour avant d'annoncer son succès ; relecture du
// correctif : avec son échec, que l'espace montre dans les vues où ce bloc est caché.
// Logo du cabinet (demande de Hugo du 13/11/2026) : chaque carte reçoit les métadonnées du logo du cabinet de sa
// copropriété, prises dans les données déjà chargées (liste des cabinets du super admin ; profil du gestionnaire), sans
// requête par copropriété ; l'image n'est lue qu'au clic sur « Affiche PDF ».
// Bureaux des cabinets (E7, migration 20261119 ; BROUILLON soumis avant fusion) : super admin seulement, filtre « Bureau »
// dans les vues Copropriétés et Signalements (un seul choix pour les deux), à côté des filtres existants : « Tous les
// bureaux », puis les bureaux que portent les copropriétés. Un bureau choisi relit le tableau par ?bureau=<id>
// (useTableauDuBureauQr) ; il est relu à chaque changement du tableau complet. Tableau de bord, autres vues de l'espace et
// vue d'un gestionnaire : inchangés. Tant qu'aucune copropriété n'a de bureau : aucun filtre, aucune requête nouvelle.
// Copropriété créée sans son bureau (207) : message d'avertissement dans la vue.
// Téléphone (captures du 19/11/2026, point h-02 validé le 20/11) : la liste « Afficher » élargissait la page
// à 483 px (étiquette bornée à la barre, liste qui rétrécit dans son étiquette, comme « Filtrer par copropriété ») ; le
// texte d'un signalement était écrasé en colonne étroite à côté de « Voir le détail » (bouton sous le texte sur
// téléphone, côte à côte à partir de sm). Ordinateur inchangé.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { heureCourte, remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Encadre, EtatVide, Modale, Montant } from '@/components/coproprietaire-dashboard/ui'
import CarteCoproprieteQr from '@/components/aj-signalement/CarteCoproprieteQr'
import ModaleCoproprieteQr from '@/components/aj-signalement/ModaleCoproprieteQr'
import ModaleCoproprieteGestionnaireQr from '@/components/aj-signalement/ModaleCoproprieteGestionnaireQr'
import DetailSignalementQr from '@/components/aj-signalement/DetailSignalementQr'
import AssistantImportQr from '@/components/aj-signalement/AssistantImportQr'
import FenetreDiffusionQr from '@/components/aj-signalement/FenetreDiffusionQr'
import { peutDiffuserCoproprieteQr, type GardeDiffusionQr } from '@/lib/aj-signalement/affichage-ecran-diffusion'
import type { VueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import type { CabinetQr, CoproprieteQr, GestionnaireQr, LogoCabinetQr, SignalementQr, StatutSignalementQr, TableauQr } from '@/lib/aj-signalement/types'
import { chargerTableauQr, modifierCoproprieteQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, compteursTableauQr, dateHeureParis, filtrerSignalementsQr,
  lieuSignalementQr, messageErreurTableauQr, nomDeclarantQr, situationLotQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G, bureauxDesCoproprietesQr, filtrerCoproprietesQr, type OptionBureauQr } from '@/lib/aj-signalement/affichage-gestion'
import { lectureBureauEnAttenteQr, useTableauDuBureauQr, type LectureTableauBureauQr } from '@/components/aj-signalement/useTableauDuBureauQr'
import { TEXTES_IMPORT_QR as I } from '@/lib/aj-signalement/import/textes'
import { coproprietesGestionnaireOrdonneesQr, idCarteCoproprieteQr, messageErreurGestionnaireQr } from '@/lib/aj-signalement/affichage-gestionnaire'

/** Cabinets et fiches de l'espace (fenêtre de copropriété) ; null : pas encore chargés. */
export interface GestionTableauQr {
  cabinets: readonly CabinetQr[] | null
  gestionnaires: readonly GestionnaireQr[] | null
}

export interface PropsTableauSignalementsQr {
  /** Jeton de session du compte (Bearer) ; null : les cookies de session suffisent. */
  jeton: string | null
  /** Vue choisie dans le menu de l'espace ; changer de vue ne recharge rien. */
  vue: VueEspaceQr
  /** Cabinets et gestionnaires (depuis le 11/11/2026) ; absent : fenêtre de copropriété d'avant. */
  gestion?: GestionTableauQr
  /** Tableau chargé ou modifié ici : partagé avec les autres vues de l'espace (un seul chargement). */
  onTableau?: (tableau: TableauQr) => void
  /** Change quand l'espace demande un rechargement (cabinet, rattachement, attributions modifiés ailleurs). */
  actualisation?: number
  /**
   * Correctif du 13/11/2026 : appelé, avec sa valeur, quand le rechargement demandé par `actualisation` est fini (tableau
   * rendu et partagé par onTableau, ou son échec affiché) : l'espace attend la liste à jour avant d'annoncer le succès
   * d'une action. Relecture : avec son échec (null : tableau relu), que l'espace montre hors des vues du tableau (où
   * l'encadré d'erreur ci-dessous est caché).
   */
  onActualise?: (actualisation: number, echec: CodeErreurQr | null) => void
  /**
   * PR 2 : vue d'un gestionnaire connecté (espace de son cabinet) ; domaines e-mail de SON cabinet (GET /moi), seules
   * adresses qu'il peut ajouter aux destinataires. Absent : vue du super admin, inchangée.
   */
  gestionnaire?: VueGestionnaireTableauQr
}

export interface VueGestionnaireTableauQr {
  domaines: readonly string[]
  /** Logo de SON cabinet (GET /moi) ; absent : aucun logo (affiches comme avant). */
  logo?: LogoCabinetQr
}

type Etat =
  | { statut: 'chargement' }
  | { statut: 'pret'; tableau: TableauQr; miseAJourLe: Date }
  | { statut: 'erreur'; code: CodeErreurQr }

/** Message de la vue Copropriétés : succès, ou avertissement (copropriété créée sans son bureau). */
type MessageVueQr = { texte: string; ton: 'succes' | 'avertissement' }

/** Filtre « Bureau » (E7) d'une vue : options, choix, et la lecture du tableau du bureau choisi (null : aucun). */
interface FiltreBureauVueQr {
  options: readonly OptionBureauQr[]
  valeur: string
  onChange: (bureauId: string) => void
  lecture: LectureTableauBureauQr | null
  onReessayer: () => void
}

const AUCUNE_OPTION: OptionBureauQr[] = []

/**
 * Boutons de la barre de la vue Copropriétés : avec le filtre « Bureau », en haut de la barre (sur la ligne de
 * « Afficher », le groupe des filtres pouvant passer sur deux lignes) ; sans lui, les classes d'avant.
 */
const classesBoutonsBarreQr = (avecBureau: boolean) => (avecBureau ? 'flex flex-wrap gap-2 self-start' : 'flex flex-wrap gap-2')

type Fenetre =
  | { type: 'creation' } | { type: 'import' } | { type: 'modification'; copropriete: CoproprieteQr } | { type: 'detail'; id: string }
  // PR 3 : diffusion (message, ou historique de la copropriété ; portée « signalement » depuis le détail).
  | { type: 'diffusion'; coproprieteId: string; contenu: 'message' | 'historique'; signalementId?: string }
  | null

/**
 * Copropriété enregistrée par le serveur, fusionnée dans la liste : compteurs connus conservés ; la dernière adresse
 * proposée aussi, tant que l'adresse reste vide. Les autres copropriétés ne changent pas.
 */
function fusionnerCoproprieteQr(connue: CoproprieteQr, enregistree: CoproprieteQr): CoproprieteQr {
  if (connue.id !== enregistree.id) return connue
  return {
    ...enregistree,
    nbSignalements: connue.nbSignalements,
    nbEnAttente: connue.nbEnAttente,
    derniereAdresseProposee: enregistree.adresse.trim() ? null : connue.derniereAdresseProposee,
  }
}

/**
 * Signalement du détail : dans le tableau, sinon dans celui du bureau choisi (E7 : il peut rendre des signalements plus
 * anciens que ceux du tableau complet).
 */
function signalementDuDetailQr(id: string, signalements: readonly SignalementQr[], duBureau: TableauQr | null): SignalementQr | null {
  return signalements.find((s) => s.id === id) ?? duBureau?.signalements.find((s) => s.id === id) ?? null
}

/** Vue Signalements sous un bureau lu : ses copropriétés et ses signalements ; un filtre par copropriété hors du bureau est ignoré. */
function listeDuBureauQr(liste: PropsListeSignalementsQr, duBureau: TableauQr | null): PropsListeSignalementsQr {
  if (!duBureau) return liste
  const filtre = duBureau.coproprietes.some((c) => c.id === liste.filtre) ? liste.filtre : ''
  return { ...liste, coproprietes: duBureau.coproprietes, signalements: duBureau.signalements, filtre }
}

/** Origine des liens encodés dans les QR codes : le site courant (ce que l'on voit est ce que l'on imprime). */
function origineCourante(): string {
  return typeof window === 'undefined' ? 'https://vitfix.io' : window.location.origin
}

export default function TableauSignalementsQr({
  jeton, vue, gestion, onTableau, actualisation = 0, onActualise, gestionnaire,
}: Readonly<PropsTableauSignalementsQr>) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [filtreCopro, setFiltreCopro] = useState('')
  const [filtreListe, setFiltreListe] = useState('')
  const [message, setMessage] = useState<MessageVueQr | null>(null)
  // E7 : bureau choisi dans les vues Copropriétés et Signalements ('' : tous).
  const [filtreBureau, setFiltreBureau] = useState('')
  // PR 3 : protection de la fenêtre de diffusion (saisie, envoi), remontée par elle ; demande de fermeture à lui passer.
  const [gardeDiffusion, setGardeDiffusion] = useState<GardeDiffusionQr>('libre')
  const [demandeFermetureDiffusion, setDemandeFermetureDiffusion] = useState(0)

  // Changement de vue (menu, ou bouton Retour du navigateur) : la fenêtre ouverte et le message de succès appartiennent
  // à la vue quittée, ils disparaissent avec elle (état ajusté au rendu, sans effet). Sauf une fenêtre de diffusion en
  // cours de saisie ou d'envoi (cahier § 7.1) : elle reçoit une demande de fermeture et applique sa protection.
  const [vueAffichee, setVueAffichee] = useState(vue)
  if (vue !== vueAffichee) {
    setVueAffichee(vue)
    if (fenetre?.type === 'diffusion' && gardeDiffusion !== 'libre') setDemandeFermetureDiffusion((n) => n + 1)
    else setFenetre(null)
    setMessage(null)
  }

  const vueGestionnaire = gestionnaire !== undefined
  // Logo du cabinet d'une copropriété : celui du profil (gestionnaire, toujours son cabinet), sinon celui de la liste
  // des cabinets déjà chargée (super admin) ; copropriété sans cabinet : aucun.
  const logoCabinet = useCallback((c: CoproprieteQr): LogoCabinetQr | null => {
    if (!c.cabinet) return null
    if (gestionnaire) return gestionnaire.logo ?? null
    return gestion?.cabinets?.find((k) => k.id === c.cabinet?.id)?.logo ?? null
  }, [gestion, gestionnaire])
  /** Chargement du tableau : son échec (affiché ici), ou null. */
  const charger = useCallback(async (): Promise<CodeErreurQr | null> => {
    const resultat = await chargerTableauQr(jeton)
    if (!resultat.ok) {
      // Gestionnaire : réseau coupé signalé aussi par un toast (SPEC § 2.8) ; le message reste à l'écran.
      if (vueGestionnaire && resultat.code === 'reseau') toast.error(messageErreurGestionnaireQr('reseau'))
      setEtat({ statut: 'erreur', code: resultat.code })
      return resultat.code
    }
    setEtat({ statut: 'pret', tableau: resultat.tableau, miseAJourLe: new Date() })
    return null
  }, [jeton, vueGestionnaire])

  // Chargement initial depuis le serveur, puis à chaque demande de l'espace (actualisation) : l'état n'est posé qu'à la
  // réponse (asynchrone), pas dans le corps de l'effet. Sa fin (réussie ou non) est notée avec le numéro demandé.
  const [actualisationFinie, setActualisationFinie] = useState<{ numero: number; echec: CodeErreurQr | null } | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger().then((echec) => setActualisationFinie({ numero: actualisation, echec }))
  }, [charger, actualisation])

  // Le tableau chargé ou modifié ici sert aussi les vues Gestionnaires, Cabinets et Journal (un seul chargement).
  const tableauPret = etat.statut === 'pret' ? etat.tableau : null
  useEffect(() => {
    if (tableauPret && onTableau) onTableau(tableauPret)
  }, [tableauPret, onTableau])

  // E7 (super admin) : options du filtre « Bureau » ; un bureau qui ne porte plus de copropriété n'est plus retenu. Son
  // tableau est relu à chaque changement du tableau complet (rechargement, copropriété enregistrée, statut changé).
  const optionsBureau = useMemo(
    () => (vueGestionnaire || !tableauPret ? AUCUNE_OPTION : bureauxDesCoproprietesQr(tableauPret.coproprietes)),
    [tableauPret, vueGestionnaire],
  )
  const bureauRetenu = optionsBureau.some((o) => o.id === filtreBureau) ? filtreBureau : ''
  const duBureau = useTableauDuBureauQr(jeton, bureauRetenu, tableauPret)

  // Fin d'un rechargement demandé : l'espace est prévenu APRÈS le rendu du tableau et son partage (effet précédent),
  // pour que la liste à jour et le message de l'action arrivent ensemble.
  useEffect(() => {
    if (actualisationFinie !== null) onActualise?.(actualisationFinie.numero, actualisationFinie.echec)
  }, [actualisationFinie, onActualise])

  const fermer = useCallback(() => setFenetre(null), [])
  const ouvrir = (nouvelle: Exclude<Fenetre, null>) => {
    setMessage(null)
    setFenetre(nouvelle)
  }

  const mettreAJourCopro = (copropriete: CoproprieteQr, texte?: string, avertissement = false) => {
    setEtat((e) => {
      if (e.statut !== 'pret') return e
      const existante = e.tableau.coproprietes.some((c) => c.id === copropriete.id)
      const coproprietes = existante
        ? e.tableau.coproprietes.map((c) => fusionnerCoproprieteQr(c, copropriete))
        : [...e.tableau.coproprietes, copropriete]
      const signalements = e.tableau.signalements.map((s) => (s.coproprieteId === copropriete.id ? { ...s, coproprieteNom: copropriete.nom } : s))
      return { ...e, tableau: { ...e.tableau, coproprietes, signalements } }
    })
    const ton: MessageVueQr['ton'] = avertissement ? 'avertissement' : 'succes'
    setMessage(texte ? { texte, ton } : null)
    setFenetre(null)
  }

  /** Copropriété supprimée (sans signalement) : retirée de la liste. */
  const retirerCopro = (id: string) => {
    setEtat((e) => (e.statut === 'pret' ? { ...e, tableau: { ...e.tableau, coproprietes: e.tableau.coproprietes.filter((c) => c.id !== id) } } : e))
    setMessage({ texte: G.copropriete.supprimee, ton: 'succes' })
    setFenetre(null)
  }

  /** « Ouvrir » la copropriété signalée comme doublon : sa fenêtre de modification remplace la fenêtre en cours. */
  const ouvrirCopro = (id: string) => {
    const autre = etat.statut === 'pret' ? etat.tableau.coproprietes.find((c) => c.id === id) : undefined
    if (autre) ouvrir({ type: 'modification', copropriete: autre })
  }

  /**
   * Gestionnaire : « Voir cette copropriété » (doublon déjà dans ses copropriétés) ferme la fenêtre et mène à sa carte :
   * défilement ET focus, posés APRÈS la fermeture (la fenêtre rend d'abord le focus au bouton qui l'a ouverte), pour que
   * le clavier et le lecteur d'écran arrivent sur la carte (relecture du lot 6).
   */
  const carteAMontrer = useRef<string | null>(null)
  const montrerCopro = (id: string) => {
    carteAMontrer.current = id
    setFenetre(null)
  }
  useEffect(() => {
    const id = carteAMontrer.current
    if (fenetre !== null || !id) return
    carteAMontrer.current = null
    const carte = document.getElementById(idCarteCoproprieteQr(id))
    if (!carte) return
    if (!carte.hasAttribute('tabindex')) carte.setAttribute('tabindex', '-1')
    carte.focus({ preventScroll: true })
    carte.scrollIntoView?.({ block: 'start' })
  }, [fenetre])

  /** « Utiliser cette adresse » : PATCH { adresse } (route existante, super admin) ; false si refusé. */
  const utiliserAdresse = async (copropriete: CoproprieteQr, adresse: string): Promise<boolean> => {
    setMessage(null)
    const resultat = await modifierCoproprieteQr(copropriete.id, { adresse }, jeton)
    if (!resultat.ok) return false
    mettreAJourCopro(resultat.copropriete, T.adresseEnregistree)
    return true
  }

  const changerStatut = (id: string, statut: StatutSignalementQr, misAJourLe: string) => {
    setEtat((e) => {
      if (e.statut !== 'pret') return e
      // Gestionnaire : il vient de changer ce statut lui-même (« Statut modifié par vous »).
      const signalements = e.tableau.signalements.map((s) => (s.id === id
        ? { ...s, statut, misAJourLe, ...(vueGestionnaire ? { statutModifiePar: 'vous' as const } : {}) }
        : s))
      const coproprietes = e.tableau.coproprietes.map((c) => ({
        ...c,
        nbEnAttente: signalements.filter((s) => s.coproprieteId === c.id && s.statut === 'en_attente').length,
      }))
      return { ...e, tableau: { ...e.tableau, coproprietes, signalements } }
    })
  }

  if (etat.statut === 'chargement') {
    return (
      <div className="py-16 text-center" role="status">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#C9A84C] border-t-transparent" />
        <p className="text-base font-medium text-[#4A5E78]">{T.chargement}</p>
      </div>
    )
  }

  if (etat.statut === 'erreur') {
    return (
      <div className="space-y-4">
        <Encadre ton={etat.code === 'base_absente' ? 'avertissement' : 'erreur'}>
          {vueGestionnaire ? messageErreurGestionnaireQr(etat.code) : messageErreurTableauQr(etat.code)}
        </Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={() => { setEtat({ statut: 'chargement' }); void charger() }}>{T.reessayer}</Bouton>
      </div>
    )
  }

  const { coproprietes, signalements } = etat.tableau
  const tableauBureau = duBureau.lecture?.etat === 'pret' ? duBureau.lecture.tableau : null
  const detail = fenetre?.type === 'detail' ? signalementDuDetailQr(fenetre.id, signalements, tableauBureau) : null
  // PR 3 : droit « diffuser » sur la copropriété du détail (H11) ; copropriété de la fenêtre de diffusion.
  const coproDetail = detail ? coproprietes.find((c) => c.id === detail.coproprieteId) : undefined
  const diffusionDetail = coproDetail !== undefined && peutDiffuserCoproprieteQr(coproDetail, vueGestionnaire)
  const coproDiffusion = fenetre?.type === 'diffusion' ? coproprietes.find((c) => c.id === fenetre.coproprieteId) ?? null : null

  const liste: PropsListeSignalementsQr = {
    coproprietes,
    signalements,
    filtre: filtreCopro,
    onFiltre: setFiltreCopro,
    onOuvrir: (id) => ouvrir({ type: 'detail', id }),
  }
  // E7 : filtre « Bureau » des vues Copropriétés et Signalements ; absent tant qu'aucune copropriété n'a de bureau.
  const filtreBureauVue: FiltreBureauVueQr | undefined = optionsBureau.length > 0
    ? { options: optionsBureau, valeur: bureauRetenu, onChange: setFiltreBureau, lecture: duBureau.lecture, onReessayer: duBureau.reessayer }
    : undefined

  return (
    <div className="space-y-6">
      {vue === 'tableau-de-bord' && <VueTableauDeBordQr liste={liste} />}
      {vue === 'coproprietes' && (
        <VueCoproprietesQr
          coproprietes={coproprietes}
          message={message}
          filtre={filtreListe}
          onFiltre={setFiltreListe}
          onAjouter={() => ouvrir({ type: 'creation' })}
          onImporter={gestion && !vueGestionnaire ? () => ouvrir({ type: 'import' }) : undefined}
          onModifier={(c) => ouvrir({ type: 'modification', copropriete: c })}
          onUtiliserAdresse={utiliserAdresse}
          vueGestionnaire={vueGestionnaire}
          onDiffusion={(c, contenu) => ouvrir({ type: 'diffusion', coproprieteId: c.id, contenu })}
          logoCabinet={logoCabinet}
          bureau={filtreBureauVue}
        />
      )}
      {vue === 'signalements' && <ListeSignalementsQr {...listeDuBureauQr(liste, tableauBureau)} bureau={filtreBureauVue} />}

      <p className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#4A5E78]">
        <span>{remplir(T.derniereMiseAJour, { heure: heureCourte(etat.miseAJourLe, 'fr') })}</span>
        <Bouton variante="discret" petit icone="actualiser" onClick={() => { void charger() }}>{T.mettreAJour}</Bouton>
      </p>

      {gestionnaire && (fenetre?.type === 'creation' || fenetre?.type === 'modification') && (
        <Modale titre={fenetre.type === 'creation' ? T.formulaire.creer : T.formulaire.modifier} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <ModaleCoproprieteGestionnaireQr
            key={fenetre.type === 'modification' ? fenetre.copropriete.id : 'creation'}
            copropriete={fenetre.type === 'modification' ? fenetre.copropriete : null} domaines={gestionnaire.domaines}
            onFermer={fermer} onEnregistre={mettreAJourCopro} onOuvrir={montrerCopro}
          />
        </Modale>
      )}
      {!gestionnaire && fenetre?.type === 'creation' && (
        <Modale titre={T.formulaire.creer} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <ModaleCoproprieteQr
            copropriete={null} jeton={jeton} onFermer={fermer} onEnregistre={mettreAJourCopro}
            cabinets={gestion?.cabinets} gestionnaires={gestion?.gestionnaires} onOuvrir={ouvrirCopro}
          />
        </Modale>
      )}
      {!gestionnaire && fenetre?.type === 'import' && (
        <Modale titre={I.titre} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <AssistantImportQr cabinets={gestion?.cabinets ?? null} origine={origineCourante()} onFermer={fermer} onImporte={() => { void charger() }} />
        </Modale>
      )}
      {!gestionnaire && fenetre?.type === 'modification' && (
        <Modale titre={T.formulaire.modifier} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <ModaleCoproprieteQr
            key={fenetre.copropriete.id}
            copropriete={fenetre.copropriete} jeton={jeton} onFermer={fermer} onEnregistre={mettreAJourCopro}
            cabinets={gestion?.cabinets} gestionnaires={gestion?.gestionnaires} onSupprimee={gestion ? retirerCopro : undefined} onOuvrir={ouvrirCopro}
          />
        </Modale>
      )}
      {detail && (
        <Modale titre={`${detail.typeIntervention} — ${detail.coproprieteNom}`} onFermer={fermer} labelFermer={T.fermerFenetre}>
          <DetailSignalementQr
            signalement={detail} jeton={jeton} onFermer={fermer} onStatut={changerStatut} onConflit={() => { void charger() }}
            vueGestionnaire={vueGestionnaire}
            onInformer={diffusionDetail
              ? () => ouvrir({ type: 'diffusion', coproprieteId: detail.coproprieteId, contenu: 'message', signalementId: detail.id })
              : undefined}
            oppositionDiffusion={diffusionDetail}
          />
        </Modale>
      )}
      {fenetre?.type === 'diffusion' && coproDiffusion && (
        <FenetreDiffusionQr
          key={`${fenetre.coproprieteId}-${fenetre.contenu}-${fenetre.signalementId ?? ''}`}
          copropriete={{ id: coproDiffusion.id, nom: coproDiffusion.nom, cabinetNom: coproDiffusion.cabinet?.nom ?? null }}
          profil={vueGestionnaire ? 'gestionnaire' : 'super_admin'} contenu={fenetre.contenu} signalementId={fenetre.signalementId}
          onFermer={fermer} demandeFermeture={demandeFermetureDiffusion} onGarde={setGardeDiffusion}
        />
      )}
    </div>
  )
}

// ── Vues ─────────────────────────────────────────────────────────────────────

const ID_TITRE_LISTE_TDB = 'qr-tdb-liste'

/**
 * Tableau de bord : présentation, quatre carrés, puis (demande de Hugo du 11/11/2026) la liste des signalements reçus
 * avec le filtre par copropriété. Les carrés suivent le filtre (choix de Hugo du 11/11/2026) : une copropriété choisie,
 * et les quatre carrés ne comptent qu'elle. La liste a donc toujours autant de lignes que « Reçus ».
 */
function VueTableauDeBordQr({ liste }: Readonly<{ liste: PropsListeSignalementsQr }>) {
  const { signalements, filtre } = liste
  const compteurs = useMemo(() => compteursTableauQr(filtrerSignalementsQr(signalements, filtre)), [signalements, filtre])
  return (
    <>
      <Carte ton="or">
        <p className="text-base text-[#1F2D3D]">{T.intro}</p>
      </Carte>
      <section aria-label={T.indicateurs} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          [T.kpis.recus, compteurs.total],
          [T.kpis.aTraiter, compteurs.aTraiter],
          [T.kpis.enCours, compteurs.enCours],
          [T.kpis.resolus, compteurs.resolus],
        ] as const).map(([libelle, valeur]) => (
          <Carte key={libelle} className="text-center">
            <Montant valeur={String(valeur)} grand />
            <p className="mt-1 text-sm text-[#4A5E78]">{libelle}</p>
          </Carte>
        ))}
      </section>
      <section aria-labelledby={ID_TITRE_LISTE_TDB} className="space-y-4">
        <ListeSignalementsQr {...liste} titre={{ id: ID_TITRE_LISTE_TDB, texte: T.signalements }} />
      </section>
    </>
  )
}

interface PropsVueCoproprietesQr {
  coproprietes: readonly CoproprieteQr[]
  message: MessageVueQr | null
  /** Filtre de la liste (filtrerCoproprietesQr) : '' = toutes. */
  filtre: string
  onFiltre: (filtre: string) => void
  onAjouter: () => void
  /** Espace seulement (cabinets connus) : « Importer un fichier ». */
  onImporter?: () => void
  onModifier: (copropriete: CoproprieteQr) => void
  onUtiliserAdresse: (copropriete: CoproprieteQr, adresse: string) => Promise<boolean>
  /** PR 2 : gestionnaire connecté : ni filtre du super admin, désactivées en bas, cartes du gestionnaire. */
  vueGestionnaire?: boolean
  /** PR 3 : « Diffuser un message » / « Messages envoyés » d'une carte (proposés selon le droit « diffuser », H11). */
  onDiffusion?: (copropriete: CoproprieteQr, contenu: 'message' | 'historique') => void
  /** Logo du cabinet d'une copropriété (métadonnées déjà chargées) ; null : aucun. */
  logoCabinet: (copropriete: CoproprieteQr) => LogoCabinetQr | null
  /** E7 : filtre « Bureau » (super admin) ; absent : aucun bureau, la barre et la liste sont celles d'avant. */
  bureau?: FiltreBureauVueQr
}

function VueCoproprietesQr({
  coproprietes, message, filtre, onFiltre, onAjouter, onImporter, onModifier, onUtiliserAdresse, vueGestionnaire = false, onDiffusion, logoCabinet,
  bureau,
}: Readonly<PropsVueCoproprietesQr>) {
  const origine = origineCourante()
  // E7 : sous un bureau lu, ses copropriétés (le filtre de la liste s'y applique ensuite).
  const source = bureau?.lecture?.etat === 'pret' ? bureau.lecture.tableau.coproprietes : coproprietes
  const visibles = useMemo(
    () => (vueGestionnaire ? coproprietesGestionnaireOrdonneesQr(coproprietes) : filtrerCoproprietesQr(source, filtre)),
    [coproprietes, source, filtre, vueGestionnaire],
  )
  // Gestionnaires cités par les copropriétés : un filtre chacun (SPEC § 1.8).
  const gestionnaires = useMemo(() => {
    const noms = new Map<string, string>()
    for (const c of coproprietes) for (const g of c.gestionnaires) noms.set(g.id, g.nom ?? G.fiche.ancien)
    return [...noms].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [coproprietes])
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltresCoproprietesQr
          visible={coproprietes.length > 0 && !vueGestionnaire} filtre={filtre} onFiltre={onFiltre} gestionnaires={gestionnaires} bureau={bureau}
        />
        <div className={classesBoutonsBarreQr(bureau !== undefined)}>
          {onImporter && <Bouton variante="secondaire" icone="documents" onClick={onImporter}>{I.bouton}</Bouton>}
          <Bouton variante="or" icone="plus" onClick={onAjouter}>{T.ajouterCopro}</Bouton>
        </div>
      </div>
      {message && <Encadre ton={message.ton}>{message.texte}</Encadre>}
      <CartesCoproprietesQr total={coproprietes.length} visibles={visibles} bureau={bureau}>
        {visibles.map((c) => {
          const diffuser = onDiffusion !== undefined && peutDiffuserCoproprieteQr(c, vueGestionnaire)
          return (
            <CarteCoproprieteQr
              key={c.id}
              copropriete={c}
              origine={origine}
              onModifier={() => onModifier(c)}
              onUtiliserAdresse={vueGestionnaire ? undefined : (adresse) => onUtiliserAdresse(c, adresse)}
              vueGestionnaire={vueGestionnaire}
              onDiffuser={diffuser ? () => onDiffusion?.(c, 'message') : undefined}
              onHistoriqueDiffusion={diffuser ? () => onDiffusion?.(c, 'historique') : undefined}
              logoCabinet={logoCabinet(c)}
            />
          )
        })}
      </CartesCoproprietesQr>
    </>
  )
}

/** Filtres de la liste des copropriétés (super admin) : « Afficher », puis « Bureau » (E7) s'il existe ; sinon la barre d'avant. */
function FiltresCoproprietesQr({ visible, filtre, onFiltre, gestionnaires, bureau }: Readonly<{
  visible: boolean
  filtre: string
  onFiltre: (filtre: string) => void
  /** Gestionnaires cités par les copropriétés : [id, nom]. */
  gestionnaires: ReadonlyArray<readonly [string, string]>
  bureau?: FiltreBureauVueQr
}>) {
  if (!visible) return <span />
  const filtres = G.copropriete.filtres
  // Étiquette bornée à la barre (min-w-0 max-w-full) et liste qui y rétrécit (min-w-0) : sur téléphone, l'option la
  // plus longue (« Adresses de gestionnaires dans les destinataires ») n'élargit plus la page (483 px avant). Pas de
  // max-w-full sur la liste : elle deviendrait « compressible » (largeur minimale nulle) et, avec le filtre « Bureau »,
  // le groupe des filtres serait écrasé à côté des boutons sur un ordinateur étroit au lieu de passer à la ligne.
  const liste = (
    <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-[#4A5E78]">
      <span>{G.copropriete.filtre}</span>
      <select value={filtre} onChange={(e) => onFiltre(e.target.value)} className="min-h-[44px] min-w-0 rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
        {(Object.keys(filtres) as Array<keyof typeof filtres>).map((cle) => <option key={cle} value={cle}>{filtres[cle]}</option>)}
        {gestionnaires.map(([id, nom]) => <option key={id} value={`gestionnaire:${id}`}>{remplir(G.copropriete.filtreGestionnaire, { nom })}</option>)}
      </select>
    </label>
  )
  if (!bureau) return liste
  // Groupe des filtres (élément de la barre) : flex-1, il prend la place que laissent les boutons et y passe à la ligne
  // (« Bureau » sous « Afficher ») ; les boutons restent sur la première ligne, à droite, comme avant le filtre « Bureau ».
  // Sa largeur minimale est celle de « Afficher » (jamais écrasé), bornée à la barre (max-w-full) : un nom de bureau long
  // n'élargit pas la page.
  return (
    <div className="flex max-w-full flex-1 flex-wrap items-center gap-3">
      {liste}
      <FiltreBureauQr options={bureau.options} valeur={bureau.valeur} onChange={bureau.onChange} />
    </div>
  )
}

/**
 * Liste des cartes : aucune copropriété, aucune pour ce filtre, ou les cartes (`children`) ; sous un bureau choisi, sa
 * lecture en cours ou son échec à la place.
 */
function CartesCoproprietesQr({ total, visibles, bureau, children }: Readonly<{
  total: number
  visibles: readonly CoproprieteQr[]
  bureau?: FiltreBureauVueQr
  children: ReactNode
}>) {
  const lecture = bureau?.lecture ?? null
  if (lectureBureauEnAttenteQr(lecture)) return <LectureBureauQr lecture={lecture} onReessayer={bureau?.onReessayer} />
  if (total === 0) return <EtatVide texte={T.aucuneCopro} icone="qr" />
  if (visibles.length === 0) return <EtatVide texte={G.copropriete.aucuneFiltre} icone="qr" />
  return (
    // Groupe nommé natif (rôle group) ; min-w-0 annule le min-inline-size: min-content que le navigateur donne à un
    // fieldset (bordure, marge et retrait sont déjà remis à zéro par Tailwind) : même rendu que l'ancien div.
    <fieldset className="grid min-w-0 gap-4" aria-label={T.coproprietes}>{children}</fieldset>
  )
}

/** Filtre « Bureau » (E7) : « Tous les bureaux », puis les bureaux ; mêmes classes que le filtre par copropriété. */
function FiltreBureauQr({ options, valeur, onChange }: Readonly<Pick<FiltreBureauVueQr, 'options' | 'valeur' | 'onChange'>>) {
  return (
    <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-[#4A5E78]">
      <span>{G.bureaux.filtre.libelle}</span>
      <select value={valeur} onChange={(e) => onChange(e.target.value)} className="min-h-[44px] min-w-0 max-w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
        <option value="">{G.bureaux.filtre.tous}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
      </select>
    </label>
  )
}

/** Tableau d'un bureau en cours de lecture, ou son échec (message et « Réessayer »), à la place de la liste (comme E3). */
function LectureBureauQr({ lecture, onReessayer }: Readonly<{
  lecture: Exclude<LectureTableauBureauQr, { etat: 'pret' }>
  onReessayer?: () => void
}>) {
  if (lecture.etat === 'chargement') return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>
  return (
    <div className="space-y-3">
      <Encadre ton="erreur">{lecture.message}</Encadre>
      <Bouton variante="principal" icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton>
    </div>
  )
}

interface PropsListeSignalementsQr {
  coproprietes: readonly CoproprieteQr[]
  signalements: readonly SignalementQr[]
  filtre: string
  onFiltre: (coproprieteId: string) => void
  onOuvrir: (id: string) => void
  /** Titre (h2) posé à gauche du filtre : tableau de bord ; sans titre, le filtre seul à droite (vue Signalements). */
  titre?: { id: string; texte: string }
  /** E7 : filtre « Bureau » (vue Signalements du super admin) ; absent : la barre d'avant. */
  bureau?: FiltreBureauVueQr
}

/**
 * Liste des signalements reçus, du plus récent au plus ancien, et son filtre par copropriété : la même dans la vue
 * Signalements et sous les carrés du tableau de bord (mêmes lignes, même « Voir le détail », même filtre).
 */
function ListeSignalementsQr({ coproprietes, signalements, filtre, onFiltre, onOuvrir, titre, bureau }: Readonly<PropsListeSignalementsQr>) {
  const visibles = useMemo(() => filtrerSignalementsQr(signalements, filtre), [signalements, filtre])
  return (
    <>
      {/* Filtre propre à l'espace, toujours visible (même avec une seule copropriété) ; aucun sélecteur extérieur.
          min-w-0 et max-w-full : un nom de copropriété très long n'élargit pas la page au-delà de l'écran. */}
      <div className={`flex flex-wrap items-center gap-3 ${titre ? 'justify-between' : 'justify-end'}`}>
        {titre && <h2 id={titre.id} className="text-lg font-bold leading-snug text-[#0D1B2E]">{titre.texte}</h2>}
        {bureau && <FiltreBureauQr options={bureau.options} valeur={bureau.valeur} onChange={bureau.onChange} />}
        <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-[#4A5E78]">
          <span>{T.filtrerCopro}</span>
          <select value={filtre} onChange={(e) => onFiltre(e.target.value)} className="min-h-[44px] min-w-0 max-w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
            <option value="">{T.toutesCopros}</option>
            {coproprietes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
      </div>
      <SignalementsVisiblesQr visibles={visibles} filtre={filtre !== '' || Boolean(bureau?.valeur)} bureau={bureau} onOuvrir={onOuvrir} />
    </>
  )
}

/** Lignes de la liste, ou « aucun signalement » (avec ou sans filtre) ; sous un bureau choisi, sa lecture en cours ou son échec. */
function SignalementsVisiblesQr({ visibles, filtre, bureau, onOuvrir }: Readonly<{
  visibles: readonly SignalementQr[]
  /** Un filtre (copropriété ou bureau) est choisi. */
  filtre: boolean
  bureau?: FiltreBureauVueQr
  onOuvrir: (id: string) => void
}>) {
  const lecture = bureau?.lecture ?? null
  if (lectureBureauEnAttenteQr(lecture)) return <LectureBureauQr lecture={lecture} onReessayer={bureau?.onReessayer} />
  if (visibles.length === 0) return <EtatVide texte={filtre ? T.aucunSignalementFiltre : T.aucunSignalement} icone="demandes" />
  return (
    <ul className="space-y-3" aria-label={T.signalements}>
      {visibles.map((s) => <LigneSignalement key={s.id} signalement={s} onOuvrir={() => onOuvrir(s.id)} />)}
    </ul>
  )
}

/**
 * Ligne d'un signalement. « Voir le détail » sous le texte sur téléphone (côte à côte, le texte n'y avait que 155 px sur
 * 343 : motif flex-col sm:flex-row des lignes des bureaux) ; à partir de sm, la ligne d'avant (le texte, flex-1 de base
 * nulle, ne passait jamais à la ligne : flex-wrap n'y changeait rien).
 */
function LigneSignalement({ signalement: s, onOuvrir }: Readonly<{ signalement: SignalementQr; onOuvrir: () => void }>) {
  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge ton={TON_STATUT_QR[s.statut]}>{LIBELLE_STATUT_QR[s.statut]}</Badge>
            {s.priorite === 'urgente' && <Badge ton="rouge">{T.urgent}</Badge>}
            <span className="text-base font-bold text-[#0D1B2E]">{s.typeIntervention}</span>
          </div>
          <p className="text-base text-[#1F2D3D]">{lieuSignalementQr(s)}</p>
          {s.signalementLieId && <p className="text-sm font-semibold text-[#0D1B2E]">{texteSignalementLieQr(s.signalementLieId)}</p>}
          <p className="text-sm text-[#4A5E78]">
            {nomDeclarantQr(s)} · {situationLotQr(s)} · {s.telephone}
          </p>
          <p className="text-sm text-[#4A5E78]">{s.coproprieteNom} · {dateHeureParis(s.creeLe)}</p>
        </div>
        <Bouton variante="secondaire" petit icone="chevron-droite" onClick={onOuvrir}>{T.voirDetail}</Bouton>
      </div>
    </li>
  )
}
