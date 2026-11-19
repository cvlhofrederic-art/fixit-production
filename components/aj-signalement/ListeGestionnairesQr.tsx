'use client'

// ── Vue « Gestionnaires » de l'espace AJ Signalement (super admin) : la liste ─────────────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : des fiches par gestionnaire (pages profil), qui reçoivent AUTOMATIQUEMENT par e-mail
// les signalements de leurs copropriétés, sur un domaine e-mail de LEUR cabinet. Liste dans l'ordre du serveur (adresse
// contestée en tête, à traiter), état, domaine forcé, compteurs ; « Ajouter un gestionnaire » (SPEC § 1.8) : adresse
// hors des domaines → avertissement puis « Créer quand même », sauf domaine d'un AUTRE cabinet client (refus, sans
// forçage) ; cabinet sans domaine → ses domaines d'abord ; adresse
// déjà en fiche → « Ouvrir la fiche ». Par ligne : Ouvrir (page profil, où se fait le départ), Renvoyer la
// confirmation, Réactiver. Aucun compte, aucune connexion de gestionnaire en PR 1.
// PR 2, lot 5 : accès de chaque gestionnaire à l'espace de son cabinet : « Ouvrir l'accès à son suivi » / « Renvoyer
// l'accès » par ligne (actionAccesGestionnaireQr : jamais sans les champs d'accès de la migration 20261112), action
// groupée « Ouvrir l'accès aux gestionnaires (n) » après confirmation (fiches à ouvrir seulement, par lots de 50),
// états d'accès et « Demande d'effacement le … ».
// PR 2, lot 6 : « Connexion à bloquer » (départ dont le bannissement du compte a échoué ; le bouton est sur la page
// profil) ; une réactivation dont le déblocage du compte échoue (207) le dit, à reprendre depuis la page profil.
// Correctif du 13/11/2026 (« les listes ne se rafraîchissent pas ») : chaque action (création, renvoi de la
// confirmation, réactivation, accès, accès groupé) attend la liste rechargée (onModifie) avant de fermer sa fenêtre et
// d'annoncer son succès, boutons désactivés jusque-là ; rechargement en échec : le succès reste annoncé au-dessus de
// l'erreur de chargement.
// Bureaux des cabinets (migration 20261119, écrans E2 et E3 du plan des bureaux, BROUILLON soumis avant fusion) :
//   - E2 : liste « Bureau » dans « Ajouter un gestionnaire », OBLIGATOIRE dès que le cabinet choisi a un bureau ouvert,
//     absente sinon (useChoixBureauFicheQr) ; bureaux fermés jamais proposés ; refus 409 bureau_requis, bureau_ferme,
//     a_reverifier expliqués, bureaux relus ;
//   - E3 : « Cabinet · Bureau » sur chaque ligne ; badge « Bureau à compléter » (fiche sans bureau, non effacée, d'un
//     cabinet qui a un bureau ouvert) ; filtre « Bureau » (tous, chaque bureau du cabinet, « Bureau à compléter ») qui
//     relit les fiches par ?bureau= ; sous ce filtre, chaque action relit aussi ses fiches avant d'annoncer son succès ;
//     lecture de ses options : en cours annoncée (« Chargement des bureaux… »), en échec dite avec « Réessayer » (toast
//     si le réseau est coupé), comme les listes « Bureau » ; un nom long ne l'élargit pas (classes du filtre E7) ;
//   - tant qu'aucun bureau n'existe (aucune clé nbBureaux ni bureau) : la vue est celle d'avant, sans requête nouvelle.
// Réactivation d'une fiche restée dans un bureau fermé (409 bureau_ferme) : la marche à suivre.

import { useCallback, useId, useRef, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Champ, CLASSES_SAISIE, Encadre, EtatVide, Modale } from '@/components/coproprietaire-dashboard/ui'
import { ChoixCoproprietesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import ChoixBureauQr, { EchecLectureBureauxQr } from '@/components/aj-signalement/ChoixBureauQr'
import { messageEchecAvecBureauQr, messageEchecQr, messageEchecReactivationQr } from '@/components/aj-signalement/messageEchecQr'
import { attendreAuPlusQr } from '@/components/aj-signalement/attenteListesQr'
import { useBureauxCabinetQr } from '@/components/aj-signalement/useBureauxCabinetQr'
import { useChoixBureauFicheQr } from '@/components/aj-signalement/useChoixBureauFicheQr'
import {
  chargerGestionnairesQr, creerGestionnaireQr, modifierGestionnaireQr, ouvrirAccesGestionnaireQr, ouvrirAccesGroupeQr, renvoyerConfirmationQr,
  type CodeErreurQr, type ResultatCreationGestionnaireQr,
} from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import {
  LIBELLE_ETAT_GESTIONNAIRE_QR as ETAT, TEXTES_GESTION_QR as G, TON_ETAT_GESTIONNAIRE_QR as TON, actionAccesGestionnaireQr, bureauACompleterQr,
  cabinetEtBureauQr, connexionABloquerQr, dateParisQr, fichesAccesOuvrablesQr, libelleBureauQr, nbBureauxCabinetQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { FILTRE_SANS_BUREAU_QR, type BureauResumeQr } from '@/lib/aj-signalement/bureaux'
import { emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { CabinetQr, CoproprieteQr, GestionnaireQr } from '@/lib/aj-signalement/types'

const BG = G.bureaux.gestionnaire
const BF = G.bureaux.filtre

export interface PropsListeGestionnairesQr {
  /** null : chargement en cours. */
  gestionnaires: readonly GestionnaireQr[] | null
  cabinets: readonly CabinetQr[] | null
  erreur: CodeErreurQr | null
  coproprietes: readonly CoproprieteQr[]
  onOuvrir: (id: string) => void
  /**
   * Une fiche a changé : l'espace recharge les fiches et le tableau ; tenue quand ils sont à jour (ou leur échec
   * affiché), au plus tard après DELAI_MAX_LISTES_QR_MS (attenteListesQr).
   */
  onModifie: () => Promise<void>
  onReessayer: () => void
  /** Vers la vue Cabinets (domaines à renseigner). */
  onCabinets: () => void
}

/** Confirmation à (re)envoyer : en attente ou expirée. */
const confirmationEnAttente = (g: GestionnaireQr): boolean => g.etat === 'confirmation_envoyee' || g.etat === 'confirmation_expiree'

/** Fiches par appel de l'action groupée (accesGroupeQrSchema : 50 au plus). */
const LOT_ACCES_QR = 50

type ActionLigneQr = 'renvoyer' | 'reactiver' | 'acces'
/** Résultat d'une action de ligne : textes du succès (et ce qui reste à reprendre, montré comme une erreur), ou l'échec. */
type ResultatActionLigneQr = { ok: true; textes: string[]; avertissement?: string } | { ok: false; message: string }

/** Appel d'une action de ligne (renvoi de la confirmation, réactivation, accès) et ses textes. */
async function appelerActionLigneQr(g: GestionnaireQr, action: ActionLigneQr): Promise<ResultatActionLigneQr> {
  if (action === 'acces') {
    const r = await ouvrirAccesGestionnaireQr(g.id)
    if (!r.ok) return { ok: false, message: messageEchecQr(r.code) }
    return { ok: true, textes: [r.emailEnvoye ? remplir(G.acces.envoye, { email: g.email ?? '' }) : G.acces.nonParti] }
  }
  if (action === 'renvoyer') {
    const r = await renvoyerConfirmationQr(g.id)
    if (!r.ok) return { ok: false, message: messageEchecQr(r.code) }
    return { ok: true, textes: [r.emailEnvoye ? remplir(G.gestionnaires.renvoye, { email: g.email ?? '' }) : G.gestionnaires.renvoiSansEmail] }
  }
  const r = await modifierGestionnaireQr(g.id, { actif: true })
  if (!r.ok) return { ok: false, message: messageEchecReactivationQr(r.code) }
  return { ok: true, textes: [G.gestionnaires.reactive], ...(r.incomplet ? { avertissement: G.compte.nonDebloquee } : {}) }
}

// ── Filtre « Bureau » (E3) ───────────────────────────────────────────────────

/** Fiches d'un filtre « Bureau » lues au serveur : en cours, lues, ou l'échec (message déjà choisi). */
type LectureFichesBureauQr = { etat: 'chargement' } | { etat: 'pret'; fiches: GestionnaireQr[] } | { etat: 'erreur'; message: string }

/**
 * Filtre « Bureau » : '' (tous : la liste de l'espace), l'id d'un bureau, ou FILTRE_SANS_BUREAU_QR (« Bureau à
 * compléter »). Chaque choix relit les fiches (GET /gestionnaires?etat=tous&bureau=…) ; une réponse dépassée par un autre
 * choix est ignorée. `relire` (après une action) garde la liste affichée pendant la relecture.
 */
function useFichesDuBureauQr() {
  const [filtre, setFiltre] = useState('')
  const [lu, setLu] = useState<{ filtre: string; lecture: LectureFichesBureauQr } | null>(null)
  const derniere = useRef(0)

  const lire = useCallback(async (f: string, garder: boolean): Promise<void> => {
    derniere.current += 1
    const numero = derniere.current
    if (!garder) setLu({ filtre: f, lecture: { etat: 'chargement' } })
    const r = await chargerGestionnairesQr({ etat: 'tous', bureau: f })
    if (numero !== derniere.current) return
    setLu({ filtre: f, lecture: r.ok ? { etat: 'pret', fiches: r.gestionnaires } : { etat: 'erreur', message: messageEchecAvecBureauQr(r.code, true) } })
  }, [])

  const choisir = (f: string) => {
    setFiltre(f)
    // « Tous » : une lecture encore en cours pour un bureau est ignorée.
    derniere.current += 1
    if (f) void lire(f, false)
  }
  /** Relecture du filtre choisi ; `garder` : la liste affichée reste en place. Sans filtre : rien à relire. */
  const relire = (garder = true): Promise<void> => (filtre ? lire(filtre, garder) : Promise.resolve())
  return {
    filtre,
    /** null : aucun filtre (la liste de l'espace). */
    lecture: filtre && lu?.filtre === filtre ? lu.lecture : null,
    choisir,
    relire,
    reessayer: () => { void relire(false) },
  }
}

/**
 * Cabinet dont les bureaux font les options du filtre « Bureau » : celui du filtre « Cabinet », sinon le seul cabinet
 * qui a des bureaux (plusieurs : « Tous » et « Bureau à compléter » seulement, jusqu'au choix d'un cabinet). Filtre
 * visible dès qu'un cabinet de la portée a des bureaux ; jamais tant qu'aucun bureau n'existe.
 */
function porteeFiltreBureauQr(cabinets: readonly CabinetQr[] | null, filtreCabinet: string): { visible: boolean; cabinet: CabinetQr | null } {
  const choisi = cabinets?.find((c) => c.id === filtreCabinet)
  if (choisi) return { visible: nbBureauxCabinetQr(choisi) > 0, cabinet: choisi }
  const avecBureaux = (cabinets ?? []).filter((c) => nbBureauxCabinetQr(c) > 0)
  return { visible: avecBureaux.length > 0, cabinet: avecBureaux.length === 1 ? avecBureaux[0] : null }
}

/** Fiches à montrer : celles de l'espace sans filtre « Bureau », celles lues pour ce filtre, aucune pendant sa lecture. */
function fichesAfficheesQr(gestionnaires: readonly GestionnaireQr[], lecture: LectureFichesBureauQr | null): readonly GestionnaireQr[] {
  if (!lecture) return gestionnaires
  return lecture.etat === 'pret' ? lecture.fiches : []
}

/**
 * Boutons de la barre des filtres : avec le filtre « Bureau », en haut de la barre (sur la ligne du filtre « Cabinet »,
 * le groupe des filtres pouvant passer sur deux lignes) ; sans lui, les classes d'avant.
 */
const classesBoutonsBarreQr = (avecBureau: boolean) => (avecBureau ? 'flex flex-wrap gap-2 self-start' : 'flex flex-wrap gap-2')

export default function ListeGestionnairesQr({
  gestionnaires, cabinets, erreur, coproprietes, onOuvrir, onModifie, onReessayer, onCabinets,
}: Readonly<PropsListeGestionnairesQr>) {
  const idBase = useId()
  const [creation, setCreation] = useState(false)
  const [filtreCabinet, setFiltreCabinet] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)
  const [confirmerGroupe, setConfirmerGroupe] = useState(false)
  const fichesBureau = useFichesDuBureauQr()
  const portee = porteeFiltreBureauQr(cabinets, filtreCabinet)
  // Options du filtre « Bureau » : lecture en cours annoncée, échec dit sous la barre (EchecLectureBureauxQr).
  const optionsBureau = useBureauxCabinetQr(portee.visible ? portee.cabinet : null)
  // Stable : la fenêtre de création garde le focus quand les listes de l'espace sont relues (la Modale ne se réinitialise pas).
  const fermerCreation = useCallback(() => setCreation(false), [])

  const annonces = (
    <>
      {messages.length > 0 && <Encadre ton="succes">{messages.map((m) => <p key={m}>{m}</p>)}</Encadre>}
      {erreurAction && <Encadre ton="erreur">{erreurAction}</Encadre>}
    </>
  )
  // Liste relue en échec après une action réussie : l'action reste annoncée au-dessus de l'erreur de chargement.
  if (erreur) {
    return (
      <div className="space-y-4">
        {annonces}
        <Encadre ton="erreur">{messageErreurTableauQr(erreur)}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton>
      </div>
    )
  }
  if (gestionnaires === null) return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>

  const fiches = fichesAfficheesQr(gestionnaires, fichesBureau.lecture)
  const visibles = filtreCabinet ? fiches.filter((g) => g.cabinet.id === filtreCabinet) : fiches
  const ouvrables = fichesAccesOuvrablesQr(visibles)

  /**
   * Listes relues après une action : celles de l'espace (onModifie, attente déjà bornée par l'espace) et, sous un filtre
   * « Bureau », ses fiches (attente bornée ici : DELAI_MAX_LISTES_QR_MS).
   */
  const listesRelues = async (): Promise<void> => {
    await Promise.all([onModifie(), attendreAuPlusQr(fichesBureau.relire())])
  }

  const choisirCabinet = (id: string) => {
    setFiltreCabinet(id)
    fichesBureau.choisir('')
  }

  const agir = async (g: GestionnaireQr, action: ActionLigneQr) => {
    if (occupe) return
    setMessages([])
    setErreurAction(null)
    setOccupe(g.id)
    const r = await appelerActionLigneQr(g, action)
    if (!r.ok) {
      setOccupe(null)
      return setErreurAction(r.message)
    }
    // Fait : boutons désactivés (aucun nouvel envoi) jusqu'à la liste à jour, puis le message.
    await listesRelues()
    setOccupe(null)
    setMessages(r.textes)
    if (r.avertissement) setErreurAction(r.avertissement)
  }

  /** Action groupée (P2-R1b) : les fiches à ouvrir, par lots de 50 ; bilan des envois et des échecs (noms seulement). */
  const ouvrirGroupe = async () => {
    if (occupe || ouvrables.length === 0) return
    setMessages([])
    setErreurAction(null)
    setConfirmerGroupe(false)
    setOccupe('groupe')
    let envoyes = 0
    const echecs: string[] = []
    for (let i = 0; i < ouvrables.length; i += LOT_ACCES_QR) {
      const r = await ouvrirAccesGroupeQr(ouvrables.slice(i, i + LOT_ACCES_QR).map((g) => g.id))
      if (!r.ok) {
        // Lots déjà partis : la liste les montre avant l'échec du suivant.
        if (envoyes > 0) await listesRelues()
        setOccupe(null)
        setErreurAction(messageEchecQr(r.code))
        return
      }
      envoyes += r.envoyes
      echecs.push(...r.echecs.map((e) => e.id))
    }
    const noms = echecs.map((id) => gestionnaires.find((g) => g.id === id)?.nom ?? G.fiche.ancien)
    await listesRelues()
    setOccupe(null)
    setMessages([remplir(G.acces.groupeEnvoye, { n: envoyes }), ...(noms.length > 0 ? [remplir(G.acces.groupeEchecs, { noms: noms.join(', ') })] : [])])
  }

  /** Fiche créée : la fenêtre reste ouverte et occupée jusqu'à la liste à jour, puis elle se ferme sur le message. */
  const creee = async (r: Extract<ResultatCreationGestionnaireQr, { ok: true }>) => {
    await listesRelues()
    setCreation(false)
    setMessages([
      r.emailEnvoye ? remplir(G.gestionnaires.cree, { email: r.gestionnaire.email ?? '' }) : G.gestionnaires.creeSansEmail,
      ...(r.coproprietesAvecAdresseSaisie > 0 ? [remplir(G.gestionnaires.dejaDestinataire, { n: r.coproprietesAvecAdresseSaisie })] : []),
    ])
  }

  return (
    <div className="space-y-6">
      <p className="text-base text-[#1F2D3D]">{G.gestionnaires.intro}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltresListeQr
          idBase={idBase} cabinets={cabinets} filtreCabinet={filtreCabinet} onCabinet={choisirCabinet}
          bureau={portee.visible ? {
            options: optionsBureau.bureaux, chargement: optionsBureau.lecture.etat === 'chargement', valeur: fichesBureau.filtre, onChange: fichesBureau.choisir,
          } : null}
        />
        <div className={classesBoutonsBarreQr(portee.visible)}>
          {ouvrables.length > 0 && (
            <Bouton variante="secondaire" icone="envoyer" disabled={occupe !== null} onClick={() => setConfirmerGroupe(true)}>
              {remplir(G.acces.groupe, { n: ouvrables.length })}
            </Bouton>
          )}
          <Bouton variante="or" icone="plus" disabled={!cabinets} onClick={() => { setMessages([]); setCreation(true) }}>{G.gestionnaires.ajouter}</Bouton>
        </div>
      </div>
      <EchecLectureBureauxQr lecture={optionsBureau.lecture} onReessayer={() => { void optionsBureau.recharger() }} />
      {confirmerGroupe && ouvrables.length > 0 && (
        <Encadre ton="info">
          <p>{G.acces.groupeAide}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Bouton variante="principal" petit icone="envoyer" disabled={occupe !== null} onClick={() => { void ouvrirGroupe() }}>
              {remplir(G.acces.confirmerGroupe, { n: ouvrables.length })}
            </Bouton>
            <Bouton variante="secondaire" petit disabled={occupe !== null} onClick={() => setConfirmerGroupe(false)}>{G.annuler}</Bouton>
          </div>
        </Encadre>
      )}
      {annonces}

      <FichesListeQr
        lecture={fichesBureau.lecture} visibles={visibles} cabinets={cabinets} libre={occupe === null}
        onOuvrir={onOuvrir} onAgir={(g, action) => { void agir(g, action) }} onReessayer={fichesBureau.reessayer}
      />

      {creation && cabinets && (
        <Modale titre={G.gestionnaires.titreCreation} onFermer={fermerCreation} labelFermer={G.fermer}>
          <FormulaireGestionnaireQr
            cabinets={cabinets} coproprietes={coproprietes} onFermer={() => setCreation(false)} onCree={creee}
            onOuvrir={(id) => { setCreation(false); onOuvrir(id) }}
            onCabinets={() => { setCreation(false); onCabinets() }}
          />
        </Modale>
      )}
    </div>
  )
}

// ── Filtres « Cabinet » et « Bureau » ─────────────────────────────────────────

const CLASSES_FILTRE = 'min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]'

interface PropsFiltres {
  idBase: string
  cabinets: readonly CabinetQr[] | null
  filtreCabinet: string
  onCabinet: (id: string) => void
  /**
   * Filtre « Bureau » ; null : aucun bureau dans la portée, le filtre n'existe pas (la barre est celle d'avant).
   * `chargement` : ses options (les bureaux du cabinet) sont en cours de lecture.
   */
  bureau: { options: readonly BureauResumeQr[]; chargement: boolean; valeur: string; onChange: (valeur: string) => void } | null
}

function FiltresListeQr({ idBase, cabinets, filtreCabinet, onCabinet, bureau }: Readonly<PropsFiltres>) {
  const liste = cabinets ?? []
  const cabinet = liste.length > 1 ? (
    <label className="flex items-center gap-2 text-sm text-[#4A5E78]" htmlFor={`${idBase}-cabinet`}>
      <span>{G.gestionnaires.filtreCabinet}</span>
      <select id={`${idBase}-cabinet`} value={filtreCabinet} onChange={(e) => onCabinet(e.target.value)} className={CLASSES_FILTRE}>
        <option value="">{G.gestionnaires.tousCabinets}</option>
        {liste.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
    </label>
  ) : null
  if (!bureau) return cabinet ?? <span />
  // Groupe des filtres (élément de la barre) : flex-1, il prend la place que laissent les boutons et y passe à la ligne
  // (« Bureau » sous « Cabinet ») ; les boutons restent sur la première ligne, à droite, comme avant le filtre « Bureau ».
  // Sa largeur minimale est celle de son filtre le plus large (pas de min-w-0 : jamais écrasé), bornée à la barre
  // (max-w-full) ; la liste « Bureau » rétrécit dans son étiquette (min-w-0) : un nom de bureau long n'élargit pas la page.
  // Pas de max-w-full sur la liste : il en ferait un contrôle « compressible » (largeur minimale nulle selon le
  // navigateur), et le groupe, seul avec elle (un seul cabinet), pourrait être écrasé à côté des boutons.
  return (
    <div className="flex max-w-full flex-1 flex-wrap items-center gap-3">
      {cabinet}
      <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-[#4A5E78]" htmlFor={`${idBase}-bureau`}>
        <span>{BF.libelle}</span>
        <select
          id={`${idBase}-bureau`} value={bureau.valeur} onChange={(e) => bureau.onChange(e.target.value)} className={`${CLASSES_FILTRE} min-w-0`}
        >
          <option value="">{BF.tous}</option>
          {bureau.options.map((b) => <option key={b.id} value={b.id}>{libelleBureauQr(b)}</option>)}
          <option value={FILTRE_SANS_BUREAU_QR}>{BF.aCompleter}</option>
        </select>
      </label>
      {bureau.chargement && <p role="status" className="text-sm text-[#4A5E78]">{G.bureaux.fenetre.chargement}</p>}
    </div>
  )
}

// ── Liste des fiches ─────────────────────────────────────────────────────────

interface PropsFichesListe {
  /** Lecture d'un filtre « Bureau » ; null : aucun filtre. */
  lecture: LectureFichesBureauQr | null
  visibles: readonly GestionnaireQr[]
  cabinets: readonly CabinetQr[] | null
  /** Faux pendant une action : les boutons d'action sont désactivés. */
  libre: boolean
  onOuvrir: (id: string) => void
  onAgir: (g: GestionnaireQr, action: ActionLigneQr) => void
  onReessayer: () => void
}

function FichesListeQr({ lecture, visibles, cabinets, libre, onOuvrir, onAgir, onReessayer }: Readonly<PropsFichesListe>) {
  if (lecture?.etat === 'chargement') return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>
  if (lecture?.etat === 'erreur') {
    return (
      <div className="space-y-3">
        <Encadre ton="erreur">{lecture.message}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton>
      </div>
    )
  }
  if (visibles.length === 0) return <EtatVide texte={lecture ? BF.aucunGestionnaire : G.gestionnaires.aucun} icone="assemblees" />
  return (
    <ul className="space-y-3" aria-label={G.gestionnaires.liste}>
      {visibles.map((g) => (
        <LigneGestionnaireQr key={g.id} g={g} aCompleter={bureauACompleterQr(g, cabinets)} libre={libre} onOuvrir={onOuvrir} onAgir={onAgir} />
      ))}
    </ul>
  )
}

interface PropsLigne {
  g: GestionnaireQr
  /** Badge « Bureau à compléter » (bureauACompleterQr). */
  aCompleter: boolean
  libre: boolean
  onOuvrir: (id: string) => void
  onAgir: (g: GestionnaireQr, action: ActionLigneQr) => void
}

function LigneGestionnaireQr({ g, aCompleter, libre, onOuvrir, onAgir }: Readonly<PropsLigne>) {
  const acces = actionAccesGestionnaireQr(g)
  return (
    <li className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[#0D1B2E]">{g.nom ?? G.fiche.ancien}</h3>
            <Badge ton={TON[g.etat]}>{ETAT[g.etat]}</Badge>
            {g.domaineForce && <Badge ton="ambre">{G.gestionnaires.domaineForce}</Badge>}
            {g.effacementDemandeLe && <Badge ton="ambre">{remplir(G.acces.effacementDemandeLe, { date: dateParisQr(g.effacementDemandeLe) })}</Badge>}
            {connexionABloquerQr(g) && <Badge ton="ambre">{G.compte.aBloquer}</Badge>}
            {aCompleter && <Badge ton="ambre">{BG.aCompleter}</Badge>}
          </div>
          {g.email && <p className="break-all text-sm text-[#1F2D3D]">{g.email}</p>}
          <p className="text-sm text-[#4A5E78]">{remplir(G.gestionnaires.compteurs, { copros: g.coproprietes, ouverts: g.ouverts, urgents: g.urgents })}</p>
          <p className="text-sm text-[#4A5E78]">
            {cabinetEtBureauQr(g.cabinet.nom, g.bureau)} · {remplir(G.gestionnaires.ajouteLe, { date: dateParisQr(g.creeLe) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" petit icone="chevron-droite" onClick={() => onOuvrir(g.id)}>{G.gestionnaires.ouvrir}</Bouton>
          {confirmationEnAttente(g) && (
            <Bouton variante="discret" petit icone="envoyer" disabled={!libre} onClick={() => onAgir(g, 'renvoyer')}>{G.gestionnaires.renvoyer}</Bouton>
          )}
          {g.etat === 'desactive' && g.nom !== null && (
            <Bouton variante="discret" petit icone="actualiser" disabled={!libre} onClick={() => onAgir(g, 'reactiver')}>{G.gestionnaires.reactiver}</Bouton>
          )}
          {acces && (
            <Bouton variante="discret" petit icone="cadenas" disabled={!libre} onClick={() => onAgir(g, 'acces')}>
              {acces === 'renvoyer' ? G.acces.renvoyer : G.acces.ouvrir}
            </Bouton>
          )}
        </div>
      </div>
    </li>
  )
}

// ── Fenêtre « Ajouter un gestionnaire » ───────────────────────────────────────

interface PropsFormulaire {
  cabinets: readonly CabinetQr[]
  coproprietes: readonly CoproprieteQr[]
  onFermer: () => void
  /** Fiche créée : tenue une fois la liste à jour (la fenêtre reste occupée jusque-là). */
  onCree: (resultat: Extract<ResultatCreationGestionnaireQr, { ok: true }>) => Promise<void>
  onOuvrir: (id: string) => void
  onCabinets: () => void
}

const FORMAT_EMAIL_QR = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Premier manque de la saisie, dans l'ordre des champs : son message ; null si rien ne manque. */
function manqueSaisieQr(nom: string, email: string, cabinet: CabinetQr | null, bureauManquant: boolean): string | null {
  if (!nom) return G.gestionnaires.nomRequis
  if (!FORMAT_EMAIL_QR.test(email)) return G.gestionnaires.emailInvalide
  if (!cabinet) return G.gestionnaires.cabinetRequis
  return bureauManquant ? BG.requis : null
}

function FormulaireGestionnaireQr({ cabinets, coproprietes, onFermer, onCree, onOuvrir, onCabinets }: Readonly<PropsFormulaire>) {
  const idBase = useId()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [cabinetId, setCabinetId] = useState(cabinets.length === 1 ? cabinets[0].id : '')
  const [selection, setSelection] = useState<string[]>([])
  const [horsDomaine, setHorsDomaine] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ficheExistante, setFicheExistante] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const cabinet = cabinets.find((c) => c.id === cabinetId) ?? null
  const coprosCabinet = coproprietes.filter((c) => c.cabinet?.id === cabinetId)
  const sansDomaine = cabinet !== null && cabinet.domaines.length === 0
  // Bureau (E2) : liste et choix exigé seulement si le cabinet a un bureau ouvert ; sinon la fenêtre est celle d'avant.
  const bureau = useChoixBureauFicheQr(cabinet)

  const choisirCabinet = (id: string) => {
    setCabinetId(id)
    setSelection([])
    setHorsDomaine(false)
    bureau.oublier()
  }

  /** Refus de la route : hors domaine (avertissement), fiche existante (lien), bureaux relus si besoin, et le message. */
  const refuser = (code: CodeErreurQr, idExistant: string | undefined) => {
    if (code === 'hors_domaine') return setHorsDomaine(true)
    if (code === 'domaine_autre_cabinet') setHorsDomaine(false)
    if (code === 'existe_deja' && idExistant) setFicheExistante(idExistant)
    bureau.apresRefus([code])
    setErreur(messageEchecAvecBureauQr(code, bureau.bureauId !== ''))
  }

  const envoyer = async (forcerDomaine: boolean) => {
    if (occupe) return
    const nomPropre = nom.trim()
    const emailPropre = email.trim().toLowerCase()
    setFicheExistante(null)
    const manque = manqueSaisieQr(nomPropre, emailPropre, cabinet, bureau.manquant)
    if (manque || !cabinet) return setErreur(manque ?? G.gestionnaires.cabinetRequis)
    setErreur(null)
    const dansCabinet = emailDansDomainesQr(emailPropre, cabinet.domaines)
    // Domaine d'un AUTRE cabinet client : refusé, sans « Créer quand même » (§ 6 ; le serveur refuse aussi).
    if (!dansCabinet && cabinets.some((c) => c.id !== cabinet.id && emailDansDomainesQr(emailPropre, c.domaines))) {
      setHorsDomaine(false)
      return setErreur(messageEchecQr('domaine_autre_cabinet'))
    }
    if (!forcerDomaine && !dansCabinet) return setHorsDomaine(true)
    setHorsDomaine(false)
    setOccupe(true)
    const ids = new Set(coprosCabinet.map((c) => c.id))
    const r = await creerGestionnaireQr({
      nom: nomPropre, email: emailPropre, cabinetId: cabinet.id, coproprieteIds: selection.filter((id) => ids.has(id)), forcerDomaine,
      // Bureau seulement s'il est choisi : sans bureau, le corps reste celui d'avant.
      ...(bureau.bureauId ? { bureauId: bureau.bureauId } : {}),
    })
    if (r.ok) {
      // Créée : la fenêtre reste occupée (aucun nouvel envoi) jusqu'à la liste à jour, puis elle se ferme.
      await onCree(r)
      return setOccupe(false)
    }
    setOccupe(false)
    refuser(r.code, r.id)
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void envoyer(false) }} aria-busy={occupe}>
      <p className="text-sm text-[#4A5E78]">{G.gestionnaires.aide}</p>
      <Champ id={`${idBase}-nom`} etiquette={G.gestionnaires.nom}>
        <input id={`${idBase}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} required autoComplete="off" className={CLASSES_SAISIE} />
      </Champ>
      <Champ id={`${idBase}-email`} etiquette={G.gestionnaires.email}>
        <input
          id={`${idBase}-email`} type="email" value={email} inputMode="email" autoComplete="off" spellCheck={false} required
          onChange={(e) => { setEmail(e.target.value); setHorsDomaine(false) }} className={CLASSES_SAISIE}
        />
      </Champ>
      <Champ id={`${idBase}-cabinet`} etiquette={G.gestionnaires.cabinet}>
        <select id={`${idBase}-cabinet`} value={cabinetId} className={CLASSES_SAISIE} onChange={(e) => choisirCabinet(e.target.value)}>
          {cabinets.length !== 1 && <option value="">{G.gestionnaires.choisirCabinet}</option>}
          {cabinets.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Champ>
      {bureau.avecBureaux && (
        <ChoixBureauQr
          id={`${idBase}-bureau`} etiquette={BG.champ} aide={BG.aide} lecture={bureau.lecture} bureaux={bureau.ouverts} valeur={bureau.bureauId}
          requis onChange={bureau.choisir} onReessayer={bureau.recharger}
        />
      )}

      {sansDomaine ? (
        <Encadre ton="avertissement">
          <p>{G.gestionnaires.domainesARenseigner}</p>
          <div className="mt-2"><Bouton variante="secondaire" petit icone="documents" onClick={onCabinets}>{G.gestionnaires.versCabinets}</Bouton></div>
        </Encadre>
      ) : cabinet && (
        <ChoixCoproprietesQr legende={G.gestionnaires.coproprietes} coproprietes={coprosCabinet} selection={selection} onChange={setSelection} />
      )}

      {horsDomaine && cabinet && (
        <Encadre ton="avertissement">
          <p>{remplir(G.gestionnaires.horsDomaine, { domaines: cabinet.domaines.join(', ') })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Bouton variante="secondaire" petit onClick={() => setHorsDomaine(false)}>{G.gestionnaires.corriger}</Bouton>
            <Bouton variante="danger" petit disabled={occupe} onClick={() => { void envoyer(true) }}>{G.gestionnaires.creerQuandMeme}</Bouton>
          </div>
        </Encadre>
      )}
      {erreur && (
        <Encadre ton="erreur">
          <p>{erreur}</p>
          {ficheExistante && (
            <div className="mt-2"><Bouton variante="secondaire" petit icone="chevron-droite" onClick={() => onOuvrir(ficheExistante)}>{G.gestionnaires.ouvrirFiche}</Bouton></div>
          )}
        </Encadre>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="principal" type="submit" icone="envoyer" disabled={occupe || sansDomaine || horsDomaine || bureau.enAttente} className="flex-1">{G.gestionnaires.creer}</Bouton>
        <Bouton variante="secondaire" onClick={onFermer} disabled={occupe} className="flex-1">{G.annuler}</Bouton>
      </div>
    </form>
  )
}
