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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { heureCourte, remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Encadre, EtatVide, Modale, Montant } from '@/components/coproprietaire-dashboard/ui'
import CarteCoproprieteQr from '@/components/aj-signalement/CarteCoproprieteQr'
import ModaleCoproprieteQr from '@/components/aj-signalement/ModaleCoproprieteQr'
import ModaleCoproprieteGestionnaireQr from '@/components/aj-signalement/ModaleCoproprieteGestionnaireQr'
import DetailSignalementQr from '@/components/aj-signalement/DetailSignalementQr'
import AssistantImportQr from '@/components/aj-signalement/AssistantImportQr'
import type { VueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import type { CabinetQr, CoproprieteQr, GestionnaireQr, SignalementQr, StatutSignalementQr, TableauQr } from '@/lib/aj-signalement/types'
import { chargerTableauQr, modifierCoproprieteQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  LIBELLE_STATUT_QR, TEXTES_TABLEAU_QR as T, TON_STATUT_QR, compteursTableauQr, dateHeureParis, filtrerSignalementsQr,
  lieuSignalementQr, messageErreurTableauQr, nomDeclarantQr, situationLotQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G, filtrerCoproprietesQr } from '@/lib/aj-signalement/affichage-gestion'
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
   * PR 2 : vue d'un gestionnaire connecté (espace de son cabinet) ; domaines e-mail de SON cabinet (GET /moi), seules
   * adresses qu'il peut ajouter aux destinataires. Absent : vue du super admin, inchangée.
   */
  gestionnaire?: VueGestionnaireTableauQr
}

export interface VueGestionnaireTableauQr {
  domaines: readonly string[]
}

type Etat =
  | { statut: 'chargement' }
  | { statut: 'pret'; tableau: TableauQr; miseAJourLe: Date }
  | { statut: 'erreur'; code: CodeErreurQr }

type Fenetre =
  | { type: 'creation' } | { type: 'import' } | { type: 'modification'; copropriete: CoproprieteQr } | { type: 'detail'; id: string } | null

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

/** Origine des liens encodés dans les QR codes : le site courant (ce que l'on voit est ce que l'on imprime). */
function origineCourante(): string {
  return typeof window === 'undefined' ? 'https://vitfix.io' : window.location.origin
}

export default function TableauSignalementsQr({ jeton, vue, gestion, onTableau, actualisation = 0, gestionnaire }: Readonly<PropsTableauSignalementsQr>) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [filtreCopro, setFiltreCopro] = useState('')
  const [filtreListe, setFiltreListe] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  // Changement de vue (menu, ou bouton Retour du navigateur) : la fenêtre ouverte et le message de succès appartiennent
  // à la vue quittée, ils disparaissent avec elle (état ajusté au rendu, sans effet).
  const [vueAffichee, setVueAffichee] = useState(vue)
  if (vue !== vueAffichee) {
    setVueAffichee(vue)
    setFenetre(null)
    setMessage(null)
  }

  const vueGestionnaire = gestionnaire !== undefined
  const charger = useCallback(async () => {
    const resultat = await chargerTableauQr(jeton)
    if (!resultat.ok) {
      // Gestionnaire : réseau coupé signalé aussi par un toast (SPEC § 2.8) ; le message reste à l'écran.
      if (vueGestionnaire && resultat.code === 'reseau') toast.error(messageErreurGestionnaireQr('reseau'))
      setEtat({ statut: 'erreur', code: resultat.code })
      return
    }
    setEtat({ statut: 'pret', tableau: resultat.tableau, miseAJourLe: new Date() })
  }, [jeton, vueGestionnaire])

  // Chargement initial depuis le serveur, puis à chaque demande de l'espace (actualisation) : l'état n'est posé qu'à la
  // réponse (asynchrone), pas dans le corps de l'effet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger, actualisation])

  // Le tableau chargé ou modifié ici sert aussi les vues Gestionnaires, Cabinets et Journal (un seul chargement).
  const tableauPret = etat.statut === 'pret' ? etat.tableau : null
  useEffect(() => {
    if (tableauPret && onTableau) onTableau(tableauPret)
  }, [tableauPret, onTableau])

  const fermer = useCallback(() => setFenetre(null), [])
  const ouvrir = (nouvelle: Exclude<Fenetre, null>) => {
    setMessage(null)
    setFenetre(nouvelle)
  }

  const mettreAJourCopro = (copropriete: CoproprieteQr, texte?: string) => {
    setEtat((e) => {
      if (e.statut !== 'pret') return e
      const existante = e.tableau.coproprietes.some((c) => c.id === copropriete.id)
      const coproprietes = existante
        ? e.tableau.coproprietes.map((c) => fusionnerCoproprieteQr(c, copropriete))
        : [...e.tableau.coproprietes, copropriete]
      const signalements = e.tableau.signalements.map((s) => (s.coproprieteId === copropriete.id ? { ...s, coproprieteNom: copropriete.nom } : s))
      return { ...e, tableau: { ...e.tableau, coproprietes, signalements } }
    })
    setMessage(texte ?? null)
    setFenetre(null)
  }

  /** Copropriété supprimée (sans signalement) : retirée de la liste. */
  const retirerCopro = (id: string) => {
    setEtat((e) => (e.statut === 'pret' ? { ...e, tableau: { ...e.tableau, coproprietes: e.tableau.coproprietes.filter((c) => c.id !== id) } } : e))
    setMessage(G.copropriete.supprimee)
    setFenetre(null)
  }

  /** « Ouvrir » la copropriété signalée comme doublon : sa fenêtre de modification remplace la fenêtre en cours. */
  const ouvrirCopro = (id: string) => {
    const autre = etat.statut === 'pret' ? etat.tableau.coproprietes.find((c) => c.id === id) : undefined
    if (autre) ouvrir({ type: 'modification', copropriete: autre })
  }

  /** Gestionnaire : « Voir cette copropriété » (doublon déjà dans ses copropriétés) ferme la fenêtre et montre sa carte. */
  const montrerCopro = (id: string) => {
    setFenetre(null)
    document.getElementById(idCarteCoproprieteQr(id))?.scrollIntoView?.({ block: 'start' })
  }

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
  const detail = fenetre?.type === 'detail' ? signalements.find((s) => s.id === fenetre.id) ?? null : null

  const liste: PropsListeSignalementsQr = {
    coproprietes,
    signalements,
    filtre: filtreCopro,
    onFiltre: setFiltreCopro,
    onOuvrir: (id) => ouvrir({ type: 'detail', id }),
  }

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
        />
      )}
      {vue === 'signalements' && <ListeSignalementsQr {...liste} />}

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
          />
        </Modale>
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
  message: string | null
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
}

function VueCoproprietesQr({
  coproprietes, message, filtre, onFiltre, onAjouter, onImporter, onModifier, onUtiliserAdresse, vueGestionnaire = false,
}: Readonly<PropsVueCoproprietesQr>) {
  const origine = origineCourante()
  const visibles = useMemo(
    () => (vueGestionnaire ? coproprietesGestionnaireOrdonneesQr(coproprietes) : filtrerCoproprietesQr(coproprietes, filtre)),
    [coproprietes, filtre, vueGestionnaire],
  )
  // Gestionnaires cités par les copropriétés : un filtre chacun (SPEC § 1.8).
  const gestionnaires = useMemo(() => {
    const noms = new Map<string, string>()
    for (const c of coproprietes) for (const g of c.gestionnaires) noms.set(g.id, g.nom ?? G.fiche.ancien)
    return [...noms].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [coproprietes])
  const filtres = G.copropriete.filtres
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {coproprietes.length > 0 && !vueGestionnaire ? (
          <label className="flex items-center gap-2 text-sm text-[#4A5E78]">
            <span>{G.copropriete.filtre}</span>
            <select value={filtre} onChange={(e) => onFiltre(e.target.value)} className="min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
              {(Object.keys(filtres) as Array<keyof typeof filtres>).map((cle) => <option key={cle} value={cle}>{filtres[cle]}</option>)}
              {gestionnaires.map(([id, nom]) => <option key={id} value={`gestionnaire:${id}`}>{remplir(G.copropriete.filtreGestionnaire, { nom })}</option>)}
            </select>
          </label>
        ) : <span />}
        <div className="flex flex-wrap gap-2">
          {onImporter && <Bouton variante="secondaire" icone="documents" onClick={onImporter}>{I.bouton}</Bouton>}
          <Bouton variante="or" icone="plus" onClick={onAjouter}>{T.ajouterCopro}</Bouton>
        </div>
      </div>
      {message && <Encadre ton="succes">{message}</Encadre>}
      {coproprietes.length === 0 ? (
        <EtatVide texte={T.aucuneCopro} icone="qr" />
      ) : visibles.length === 0 ? (
        <EtatVide texte={G.copropriete.aucuneFiltre} icone="qr" />
      ) : (
        // Groupe nommé natif (rôle group) ; min-w-0 annule le min-inline-size: min-content que le navigateur donne à un
        // fieldset (bordure, marge et retrait sont déjà remis à zéro par Tailwind) : même rendu que l'ancien div.
        <fieldset className="grid min-w-0 gap-4" aria-label={T.coproprietes}>
          {visibles.map((c) => (
            <CarteCoproprieteQr
              key={c.id}
              copropriete={c}
              origine={origine}
              onModifier={() => onModifier(c)}
              onUtiliserAdresse={vueGestionnaire ? undefined : (adresse) => onUtiliserAdresse(c, adresse)}
              vueGestionnaire={vueGestionnaire}
            />
          ))}
        </fieldset>
      )}
    </>
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
}

/**
 * Liste des signalements reçus, du plus récent au plus ancien, et son filtre par copropriété : la même dans la vue
 * Signalements et sous les carrés du tableau de bord (mêmes lignes, même « Voir le détail », même filtre).
 */
function ListeSignalementsQr({ coproprietes, signalements, filtre, onFiltre, onOuvrir, titre }: Readonly<PropsListeSignalementsQr>) {
  const visibles = useMemo(() => filtrerSignalementsQr(signalements, filtre), [signalements, filtre])
  return (
    <>
      {/* Filtre propre à l'espace, toujours visible (même avec une seule copropriété) ; aucun sélecteur extérieur.
          min-w-0 et max-w-full : un nom de copropriété très long n'élargit pas la page au-delà de l'écran. */}
      <div className={`flex flex-wrap items-center gap-3 ${titre ? 'justify-between' : 'justify-end'}`}>
        {titre && <h2 id={titre.id} className="text-lg font-bold leading-snug text-[#0D1B2E]">{titre.texte}</h2>}
        <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-[#4A5E78]">
          <span>{T.filtrerCopro}</span>
          <select value={filtre} onChange={(e) => onFiltre(e.target.value)} className="min-h-[44px] min-w-0 max-w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]">
            <option value="">{T.toutesCopros}</option>
            {coproprietes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
      </div>
      {visibles.length === 0 ? (
        <EtatVide texte={filtre ? T.aucunSignalementFiltre : T.aucunSignalement} icone="demandes" />
      ) : (
        <ul className="space-y-3" aria-label={T.signalements}>
          {visibles.map((s) => <LigneSignalement key={s.id} signalement={s} onOuvrir={() => onOuvrir(s.id)} />)}
        </ul>
      )}
    </>
  )
}

function LigneSignalement({ signalement: s, onOuvrir }: Readonly<{ signalement: SignalementQr; onOuvrir: () => void }>) {
  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
