'use client'

// Dictionnaire matériaux (tableau de bord pro) : « dans telle situation, quels matériaux utiliser ? ».
// Deux modes : la recherche manuelle par mot-clé ou par catégorie (sans réseau, lib/dictionnaire-materiaux/recherche),
// et la description en langage naturel avec photos (route /api/dictionnaire-materiaux/analyse).
// Les matériaux affichés viennent toujours du catalogue du pays : même la réponse de l'IA n'en sort pas.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useLocale } from '@/lib/i18n/context'
import { fetchAuthentifie } from '@/lib/fetch-authentifie'
import { redimensionnerImage } from '@/lib/images/redimensionner-image'
import {
  dictionnairePour,
  lienVersEnseigne,
  listeEnTexte,
  paysDeLaLangue,
  rechercher,
  resoudreEtapes,
  situationsUtilisant,
  type Dictionnaire,
  type EtapeResolue,
  type Materiau,
  type Situation,
} from '@/lib/dictionnaire-materiaux'
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TOURS_HISTORIQUE_MAX,
  analyseEnTexte,
  etapesPourAffichage,
  type AnalyseIA,
  type TourHistorique,
} from '@/lib/dictionnaire-materiaux/ia/analyse'
import { COTE_MAX_PHOTO, PHOTOS_MAX, QUALITE_JPEG_PHOTO, verifierPhoto } from '@/lib/dictionnaire-materiaux/ia/photos'
import { libellesPour, type LibellesDictionnaire } from '@/lib/dictionnaire-materiaux/libelles'
import './dictionnaire-materiaux.css'

type Mode = 'manuel' | 'ia'
type Fiche = { type: 'situation'; id: string } | { type: 'materiau'; id: string }

interface Contexte {
  dico: Dictionnaire
  libelles: LibellesDictionnaire
  ouvrir: (fiche: Fiche) => void
}

/** AAAA-MM-JJ → JJ/MM/AAAA, sans dépendre du fuseau ni de la langue du navigateur. */
function dateLisible(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return jour && mois && annee ? `${jour}/${mois}/${annee}` : iso
}

function extrait(texte: string, max = 110): string {
  return texte.length > max ? `${texte.slice(0, max - 1).trimEnd()}…` : texte
}

async function copierListe(texte: string, libelles: LibellesDictionnaire) {
  try {
    await navigator.clipboard.writeText(texte)
    toast.success(libelles.copie)
  } catch {
    toast.error(libelles.copieImpossible)
  }
}

/* ── Liens vers la recherche des magasins ── */
function LiensEnseignes({ dico, libelles, materiau, compact = false }: Readonly<{
  dico: Dictionnaire
  libelles: LibellesDictionnaire
  materiau: Materiau
  compact?: boolean
}>) {
  // Typographie de la langue : pas d'espace avant « : » en portugais.
  const deuxPoints = useLocale() === 'pt' ? ':' : ' :'
  const enseignes = dico.enseignes.filter((e) => materiau.enseignes.includes(e.id))
  if (enseignes.length === 0) return null
  return (
    <div className={compact ? 'dico-magasins dico-magasins-c' : 'dico-magasins'}>
      {enseignes.map((e) => (
        <a
          key={e.id}
          href={lienVersEnseigne(e, materiau)}
          target="_blank"
          rel="noopener noreferrer"
          className={compact ? 'dico-magasin-c' : 'v5-btn'}
          aria-label={`${libelles.voirChez(e.nom)}${deuxPoints} ${materiau.nom}`}
        >
          {compact ? e.nom : libelles.voirChez(e.nom)} ↗
        </a>
      ))}
    </div>
  )
}

/* ── Matériaux rangés par étapes (fiche de situation et réponse de l'IA) ── */
function ListeEtapes({ etapes, contexte }: Readonly<{ etapes: EtapeResolue[]; contexte: Contexte }>) {
  const { dico, libelles, ouvrir } = contexte
  return (
    <div className="dico-etapes">
      {etapes.map((etape, i) => (
        <section key={`${i}-${etape.titre}`} className="dico-etape">
          <h4 className="dico-etape-t">
            {etape.titre}
            <span className="dico-etape-n">{etape.lignes.length}</span>
          </h4>
          <ul>
            {etape.lignes.map((ligne) => (
              <li key={ligne.materiau.id} className="dico-ligne">
                <div className="dico-ligne-g">
                  <button type="button" className="dico-lien" onClick={() => ouvrir({ type: 'materiau', id: ligne.materiau.id })}>
                    {ligne.materiau.nom}
                  </button>
                  {ligne.optionnel && <span className="dico-opt">{libelles.optionnel}</span>}
                  {ligne.note && <p className="dico-note">{ligne.note}</p>}
                </div>
                <LiensEnseignes dico={dico} libelles={libelles} materiau={ligne.materiau} compact />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Puces({ titre, lignes, variante }: Readonly<{ titre: string; lignes: string[]; variante?: 'attention' | 'questions' }>) {
  if (lignes.length === 0) return null
  return (
    <div className={variante ? `dico-bloc dico-bloc-${variante}` : 'dico-bloc'}>
      <h4>{titre}</h4>
      <ul>
        {lignes.map((ligne, i) => <li key={`${i}-${ligne.slice(0, 24)}`}>{ligne}</li>)}
      </ul>
    </div>
  )
}

/* ── Fiche d'une situation ── */
function FicheSituation({ situation, contexte, idTitre }: Readonly<{ situation: Situation; contexte: Contexte; idTitre: string }>) {
  const { dico, libelles } = contexte
  const etapes = useMemo(() => resoudreEtapes(dico, situation.etapes), [dico, situation])
  const domaine = dico.domaines.find((d) => d.id === situation.domaine)
  return (
    <>
      {domaine && <div className="dico-fil">{domaine.icone} {domaine.nom}</div>}
      <h3 id={idTitre} className="v5-modal-t" tabIndex={-1}>{situation.titre}</h3>
      <p className="dico-desc">{situation.description}</p>
      <Puces titre={libelles.aVerifier} lignes={situation.aVerifier} />
      <div className="dico-entete-liste">
        <div className="v5-st">{libelles.materiauxAUtiliser}</div>
        <button
          type="button"
          className="v5-btn v5-btn-sm"
          onClick={() => void copierListe(listeEnTexte(situation.titre, etapes, libelles.optionnel), libelles)}
        >
          📋 {libelles.copier}
        </button>
      </div>
      <ListeEtapes etapes={etapes} contexte={contexte} />
      <Puces titre={`⚠️ ${libelles.attention}`} lignes={situation.attention} variante="attention" />
    </>
  )
}

/* ── Fiche d'un matériau ── */
/** Situations montrées d'emblée sur la fiche d'un matériau : un matériau courant (lunettes, gants) sert dans des dizaines. */
export const SITUATIONS_VISIBLES = 12

function FicheMateriau({ materiau, contexte, idTitre }: Readonly<{ materiau: Materiau; contexte: Contexte; idTitre: string }>) {
  const { dico, libelles, ouvrir } = contexte
  const famille = dico.familles.find((f) => f.id === materiau.famille)
  const sousFamille = famille?.sousFamilles.find((sf) => sf.id === materiau.sousFamille)
  const situations = useMemo(() => situationsUtilisant(dico, materiau.id), [dico, materiau.id])
  const [toutesLesSituations, setToutesLesSituations] = useState(false)
  const visibles = toutesLesSituations ? situations : situations.slice(0, SITUATIONS_VISIBLES)
  return (
    <>
      {famille && (
        <div className="dico-fil">
          {famille.icone} {famille.nom}{sousFamille ? ` › ${sousFamille.nom}` : ''}
        </div>
      )}
      <h3 id={idTitre} className="v5-modal-t" tabIndex={-1}>{materiau.nom}</h3>
      <dl className="dico-details">
        <dt>{libelles.usage}</dt>
        <dd>{materiau.usage}</dd>
        {materiau.aSavoir && (
          <>
            <dt>{libelles.aSavoir}</dt>
            <dd className="dico-a-savoir">{materiau.aSavoir}</dd>
          </>
        )}
        {materiau.conditionnement && (
          <>
            <dt>{libelles.conditionnement}</dt>
            <dd>{materiau.conditionnement}</dd>
          </>
        )}
        {materiau.aussiAppele.length > 0 && (
          <>
            <dt>{libelles.aussiAppele}</dt>
            <dd>{materiau.aussiAppele.join(' · ')}</dd>
          </>
        )}
      </dl>
      <div className="v5-st">{libelles.ouTrouver}</div>
      <LiensEnseignes dico={dico} libelles={libelles} materiau={materiau} />
      <p className="dico-mention">{libelles.verifieLe(dateLisible(dico.verifieLe))} {libelles.stockAConfirmer}</p>
      {situations.length > 0 && (
        <>
          <div className="v5-st">{libelles.utiliseDans}</div>
          <div className="dico-chips">
            {visibles.map((s) => (
              <button key={s.id} type="button" className="dico-chip" onClick={() => ouvrir({ type: 'situation', id: s.id })}>
                {s.titre}
              </button>
            ))}
            {visibles.length < situations.length && (
              <button type="button" className="dico-chip dico-chip-plus" onClick={() => setToutesLesSituations(true)}>
                {libelles.voirToutesSituations(situations.length)}
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

/* ── Fenêtre des fiches : une pile, pour revenir de la fiche d'un matériau à celle de la situation ── */
const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tab et Maj+Tab tournent dans la fenêtre : le focus ne passe pas à la page restée derrière. */
function garderLeFocus(e: ReactKeyboardEvent, fenetre: HTMLElement) {
  const elements = Array.from(fenetre.querySelectorAll<HTMLElement>(FOCALISABLES))
  const premier = elements.at(0)
  const dernier = elements.at(-1)
  if (!premier || !dernier) return
  const actif = document.activeElement
  // Hors de la fenêtre, ou Tab sur le dernier élément : retour au premier. Maj+Tab sur le premier : au dernier.
  if (!fenetre.contains(actif) || (!e.shiftKey && actif === dernier)) {
    e.preventDefault()
    premier.focus()
  } else if (e.shiftKey && actif === premier) {
    e.preventDefault()
    dernier.focus()
  }
}

function FenetreFiche({ pile, contexte, retour, fermer }: Readonly<{
  pile: Fiche[]
  contexte: Contexte
  retour: () => void
  fermer: () => void
}>) {
  const { dico, libelles } = contexte
  const idTitre = useId()
  const fenetre = useRef<HTMLDivElement>(null)
  const fiche = pile.at(-1)
  const cleFiche = fiche ? `${pile.length}:${fiche.type}:${fiche.id}` : ''

  // Une fois fermée, la fenêtre rend le focus à ce qui l'avait ouverte.
  useEffect(() => {
    const ouvreur = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (ouvreur?.isConnected) ouvreur.focus()
    }
  }, [])

  // Échap ferme, Tab reste dans la fenêtre : les touches remontent de la fiche, qui garde le focus, jusqu'au fond.
  const surTouche = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') fermer()
    else if (e.key === 'Tab' && fenetre.current) garderLeFocus(e, fenetre.current)
  }

  // Chaque fiche s'ouvre en haut, le focus sur son titre (lu par les lecteurs d'écran), même quand on passe d'une
  // fiche à l'autre : le bouton qui a servi à y aller disparaît avec la fiche précédente.
  useEffect(() => {
    if (!cleFiche) return
    if (fenetre.current) fenetre.current.scrollTop = 0
    document.getElementById(idTitre)?.focus()
  }, [cleFiche, idTitre])

  const situation = fiche?.type === 'situation' ? dico.situations.find((s) => s.id === fiche.id) : undefined
  const materiau = fiche?.type === 'materiau' ? dico.materiaux.find((m) => m.id === fiche.id) : undefined
  if (!situation && !materiau) return null

  return (
    // Un clic ferme seulement s'il tombe sur le fond, pas dans la fiche. La fiche peut recevoir le focus (tabIndex -1) :
    // un clic sur son texte le garde dedans, et Échap y est entendu.
    <div className="v5-modal-ov show" onClick={(e) => { if (e.target === e.currentTarget) fermer() }} onKeyDown={surTouche}>
      <div ref={fenetre} className="v5-modal dico-fiche" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <div className="v5-modal-h">
          {pile.length > 1
            ? <button type="button" className="v5-btn v5-btn-sm" onClick={retour}>← {libelles.retour}</button>
            : <span />}
          <button type="button" className="v5-modal-x" onClick={fermer} aria-label={libelles.fermer}>×</button>
        </div>
        {situation && <FicheSituation situation={situation} contexte={contexte} idTitre={idTitre} />}
        {materiau && <FicheMateriau key={materiau.id} materiau={materiau} contexte={contexte} idTitre={idTitre} />}
      </div>
    </div>
  )
}

/* ── Mode manuel : mot-clé, ou parcours par type de travaux et par catégorie ── */
function LigneSituation({ situation, contexte }: Readonly<{ situation: Situation; contexte: Contexte }>) {
  return (
    <button type="button" className="dico-res" onClick={() => contexte.ouvrir({ type: 'situation', id: situation.id })}>
      <span className="dico-res-n">{situation.titre}</span>
      <span className="dico-res-d">{extrait(situation.description)}</span>
    </button>
  )
}

function LigneMateriauCatalogue({ materiau, contexte }: Readonly<{ materiau: Materiau; contexte: Contexte }>) {
  return (
    <button type="button" className="dico-res" onClick={() => contexte.ouvrir({ type: 'materiau', id: materiau.id })}>
      <span className="dico-res-n">{materiau.nom}</span>
      <span className="dico-res-d">{extrait(materiau.usage)}</span>
    </button>
  )
}

function Volet({ ouvert, basculer, icone, nom, compte, children }: Readonly<{
  ouvert: boolean
  basculer: () => void
  icone: string
  nom: string
  compte: string
  children: ReactNode
}>) {
  return (
    <div className={ouvert ? 'dico-volet ouvert' : 'dico-volet'}>
      <button type="button" className="dico-volet-t" aria-expanded={ouvert} onClick={basculer}>
        <span className="dico-volet-i" aria-hidden="true">{icone}</span>
        <span className="dico-volet-n">{nom}</span>
        <span className="dico-volet-c">{compte}</span>
      </button>
      {ouvert && <div className="dico-volet-ct">{children}</div>}
    </div>
  )
}

function ModeManuel({ contexte }: Readonly<{ contexte: Contexte }>) {
  const { dico, libelles } = contexte
  const [saisie, setSaisie] = useState('')
  const [domaineOuvert, setDomaineOuvert] = useState<string | null>(null)
  const [familleOuverte, setFamilleOuverte] = useState<string | null>(null)
  const requete = saisie.trim()
  const resultats = useMemo(() => rechercher(dico, requete), [dico, requete])
  const rienTrouve = requete !== '' && resultats.situations.length === 0 && resultats.materiaux.length === 0
  // Annonce des lecteurs d'écran : une zone présente dès l'affichage (une zone créée déjà remplie n'est pas lue),
  // avec le seul nombre de résultats plutôt que toute la liste à chaque lettre.
  let annonce = ''
  if (rienTrouve) annonce = libelles.aucunResultat(requete)
  else if (requete !== '') {
    annonce = `${libelles.nombreSituations(resultats.situations.length)}, ${libelles.nombreMateriaux(resultats.materiaux.length)}`
  }

  return (
    <>
      <div className="dico-recherche">
        <span className="dico-recherche-i" aria-hidden="true">🔍</span>
        <input
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={libelles.recherchePlaceholder}
          aria-label={libelles.rechercheLabel}
          autoComplete="off"
        />
        {saisie !== '' && (
          <button type="button" className="dico-recherche-x" onClick={() => setSaisie('')} aria-label={libelles.effacer}>×</button>
        )}
      </div>

      <output className="dico-sr">{annonce}</output>

      {requete !== '' && (
        <div>
          {rienTrouve && (
            <div className="v5-card dico-vide">
              <strong>{libelles.aucunResultat(requete)}</strong>
              <span>{libelles.aucunResultatAide}</span>
            </div>
          )}
          {resultats.situations.length > 0 && (
            <div className="v5-card dico-groupe">
              <div className="v5-st">{libelles.situations} · {resultats.situations.length}</div>
              {resultats.situations.map((r) => <LigneSituation key={r.element.id} situation={r.element} contexte={contexte} />)}
            </div>
          )}
          {resultats.materiaux.length > 0 && (
            <div className="v5-card dico-groupe">
              <div className="v5-st">{libelles.materiaux} · {resultats.materiaux.length}</div>
              {resultats.materiaux.map((r) => <LigneMateriauCatalogue key={r.element.id} materiau={r.element} contexte={contexte} />)}
            </div>
          )}
        </div>
      )}

      {requete === '' && (
        <div className="dico-parcours">
          <div className="v5-card dico-groupe">
            <div className="v5-st">{libelles.parDomaine}</div>
            {dico.domaines.map((domaine) => {
              const situations = dico.situations.filter((s) => s.domaine === domaine.id)
              if (situations.length === 0) return null
              return (
                <Volet
                  key={domaine.id}
                  ouvert={domaineOuvert === domaine.id}
                  basculer={() => setDomaineOuvert((d) => (d === domaine.id ? null : domaine.id))}
                  icone={domaine.icone}
                  nom={domaine.nom}
                  compte={libelles.nombreSituations(situations.length)}
                >
                  {situations.map((s) => <LigneSituation key={s.id} situation={s} contexte={contexte} />)}
                </Volet>
              )
            })}
          </div>
          <div className="v5-card dico-groupe">
            <div className="v5-st">{libelles.parFamille}</div>
            {dico.familles.map((famille) => {
              const materiaux = dico.materiaux.filter((m) => m.famille === famille.id)
              if (materiaux.length === 0) return null
              return (
                <Volet
                  key={famille.id}
                  ouvert={familleOuverte === famille.id}
                  basculer={() => setFamilleOuverte((f) => (f === famille.id ? null : famille.id))}
                  icone={famille.icone}
                  nom={famille.nom}
                  compte={libelles.nombreMateriaux(materiaux.length)}
                >
                  {famille.sousFamilles.map((sousFamille) => {
                    const duGroupe = materiaux.filter((m) => m.sousFamille === sousFamille.id)
                    if (duGroupe.length === 0) return null
                    return (
                      <div key={sousFamille.id} className="dico-sous-famille">
                        <div className="dico-sous-famille-t" title={sousFamille.description}>{sousFamille.nom}</div>
                        {duGroupe.map((m) => <LigneMateriauCatalogue key={m.id} materiau={m} contexte={contexte} />)}
                      </div>
                    )
                  })}
                </Volet>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Mode langage naturel : description, photos, réponse limitée au catalogue ── */
interface Tour {
  cle: number
  description: string
  photos: string[]
  analyse: AnalyseIA
}

function codeErreur(statut: number, corps: unknown): string {
  if (statut === 401) return 'non_connecte'
  if (statut === 429) return 'trop_de_demandes'
  const code = corps && typeof corps === 'object' ? (corps as { error?: unknown }).error : null
  return typeof code === 'string' ? code : 'defaut'
}

/** L'analyse rendue par la route, si elle en a bien la forme (une réponse d'un autre genre ne doit pas casser l'écran). */
function analyseDe(corps: unknown): AnalyseIA | null {
  const analyse = corps && typeof corps === 'object' ? (corps as { analyse?: unknown }).analyse : null
  if (!analyse || typeof analyse !== 'object') return null
  const a = analyse as Record<string, unknown>
  const listes = [a.situations, a.etapes, a.conseils, a.attention, a.questions, a.horsCatalogue]
  return typeof a.resume === 'string' && listes.every(Array.isArray) ? (analyse as AnalyseIA) : null
}

function ReponseIA({ analyse, contexte }: Readonly<{ analyse: AnalyseIA; contexte: Contexte }>) {
  const { dico, libelles, ouvrir } = contexte
  const etapes = useMemo(() => resoudreEtapes(dico, etapesPourAffichage(analyse)), [dico, analyse])
  const fiches = analyse.situations
    .map((id) => dico.situations.find((s) => s.id === id))
    .filter((s): s is Situation => s !== undefined)
  return (
    <div className="dico-tour dico-tour-ia">
      <div className="dico-tour-qui">{libelles.reponse}</div>
      {analyse.resume && <p className="dico-resume">{analyse.resume}</p>}
      {etapes.length > 0 && (
        <>
          <div className="dico-entete-liste">
            <div className="v5-st">{libelles.materiauxAUtiliser}</div>
            <button
              type="button"
              className="v5-btn v5-btn-sm"
              onClick={() => void copierListe(listeEnTexte(libelles.materiauxAUtiliser, etapes, libelles.optionnel), libelles)}
            >
              📋 {libelles.copier}
            </button>
          </div>
          <ListeEtapes etapes={etapes} contexte={contexte} />
        </>
      )}
      {fiches.length > 0 && (
        <div className="dico-bloc">
          <h4>{libelles.fichesProches}</h4>
          <div className="dico-chips">
            {fiches.map((s) => (
              <button key={s.id} type="button" className="dico-chip" onClick={() => ouvrir({ type: 'situation', id: s.id })}>
                {s.titre}
              </button>
            ))}
          </div>
        </div>
      )}
      <Puces titre={libelles.conseils} lignes={analyse.conseils} />
      <Puces titre={`⚠️ ${libelles.attention}`} lignes={analyse.attention} variante="attention" />
      <Puces titre={`❓ ${libelles.questions}`} lignes={analyse.questions} variante="questions" />
      <Puces titre={libelles.horsCatalogue} lignes={analyse.horsCatalogue} />
    </div>
  )
}

function ModeIA({ contexte }: Readonly<{ contexte: Contexte }>) {
  const { dico, libelles } = contexte
  const [tours, setTours] = useState<Tour[]>([])
  const [brouillon, setBrouillon] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  /** Photos choisies encore en préparation (redimensionnement) : tant qu'il en reste, rien ne part. */
  const [enPreparation, setEnPreparation] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  /** Texte lu par les lecteurs d'écran : analyse en cours, puis réponse reçue. */
  const [annonce, setAnnonce] = useState('')
  const champFichier = useRef<HTMLInputElement>(null)
  const prochaineCle = useRef(1)

  // Une photo à la fois, ajoutée dès qu'elle est prête. Pendant la préparation, « Juntar fotos » et « Analisar »
  // restent inactifs : une photo encore en cours ne peut ni partir sans le message, ni dépasser le maximum.
  const ajouterPhotos = useCallback(async (fichiers: File[]) => {
    const places = PHOTOS_MAX - photos.length
    if (fichiers.length > places) toast.info(libelles.photosMax(PHOTOS_MAX))
    const retenus = fichiers.slice(0, Math.max(0, places))
    if (retenus.length === 0) return
    // L'annonce précédente (« Resposta recebida. ») ne doit pas revenir une fois les photos prêtes.
    setAnnonce('')
    setEnPreparation(retenus.length)
    for (const fichier of retenus) {
      try {
        // JPEG, 1568 px au plus : lisible par le modèle, léger sur le réseau d'un chantier.
        const { dataUrl } = await redimensionnerImage(fichier, COTE_MAX_PHOTO, undefined, { type: 'image/jpeg', qualite: QUALITE_JPEG_PHOTO })
        const controle = verifierPhoto(dataUrl)
        if (controle.ok) setPhotos((p) => [...p, dataUrl].slice(0, PHOTOS_MAX))
        else toast.error(controle.raison === 'taille' ? libelles.erreurs.photo_trop_volumineuse : libelles.photoIllisible)
      } catch {
        // Image que le navigateur ne sait pas lire (format inconnu, fichier abîmé) : on le dit, les autres suivent.
        toast.error(libelles.photoIllisible)
      }
      setEnPreparation((n) => n - 1)
    }
  }, [photos.length, libelles])

  const envoyer = async () => {
    if (enCours || enPreparation > 0) return
    const envoyees = photos
    // Des photos sans un mot : la question va de soi sur un chantier.
    const description = brouillon.trim() || (envoyees.length > 0 ? libelles.descriptionPhotosSeules : '')
    if (description.length < DESCRIPTION_MIN) {
      setErreur(libelles.descriptionTropCourte)
      return
    }
    const historique: TourHistorique[] = tours
      .flatMap((tour): TourHistorique[] => [
        { role: 'user', texte: tour.description },
        { role: 'assistant', texte: analyseEnTexte(tour.analyse, dico) },
      ])
      .slice(-TOURS_HISTORIQUE_MAX)
    setEnCours(true)
    setErreur(null)
    setAnnonce(libelles.analyseEnCours)
    // Une erreur s'annonce d'elle-même (role="alert") : l'annonce ne parle que d'une réponse reçue.
    let annonceFinale = ''
    try {
      const reponse = await fetchAuthentifie('/api/dictionnaire-materiaux/analyse', {
        method: 'POST',
        body: JSON.stringify({ pays: dico.pays, description, photos: envoyees, historique }),
      })
      const corps: unknown = await reponse.json().catch(() => null)
      if (!reponse.ok) {
        const code = codeErreur(reponse.status, corps)
        setErreur(libelles.erreurs[code] ?? libelles.erreurs.defaut)
        return
      }
      const analyse = analyseDe(corps)
      if (!analyse) {
        setErreur(libelles.erreurs.reponse_invalide)
        return
      }
      const cle = prochaineCle.current++
      setTours((t) => [...t, { cle, description, photos: envoyees, analyse }])
      setBrouillon('')
      setPhotos((p) => p.filter((photo) => !envoyees.includes(photo)))
      annonceFinale = libelles.reponseRecue
    } catch {
      setErreur(libelles.erreurs.reseau)
    } finally {
      setEnCours(false)
      setAnnonce(annonceFinale)
    }
  }

  const recommencer = () => {
    setTours([])
    setBrouillon('')
    setPhotos([])
    setErreur(null)
    setAnnonce('')
  }

  const rienAEnvoyer = brouillon.trim() === '' && photos.length === 0

  return (
    <div className="v5-card dico-ia">
      <p className="dico-ia-intro">{libelles.iaIntro}</p>
      {/* Hors de la conversation marquée « occupée » : une zone d'annonce sous aria-busy peut rester muette. */}
      <output className="dico-sr">{enPreparation > 0 ? libelles.photosEnPreparation : annonce}</output>

      <div className="dico-conversation" aria-busy={enCours}>
        {tours.map((tour) => (
          <div key={tour.cle} className="dico-echange">
            <div className="dico-tour dico-tour-moi">
              <div className="dico-tour-qui">{libelles.vous}</div>
              <p>{tour.description}</p>
              {tour.photos.length > 0 && (
                <div className="dico-vignettes">
                  {tour.photos.map((photo, i) => (
                    <Image key={`${tour.cle}-${i}`} src={photo} alt={libelles.photoNumero(i + 1)} width={56} height={56} unoptimized />
                  ))}
                </div>
              )}
            </div>
            {tour.analyse && <ReponseIA analyse={tour.analyse} contexte={contexte} />}
          </div>
        ))}
      </div>

      <div className="dico-saisie">
        <textarea
          value={brouillon}
          onChange={(e) => setBrouillon(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void envoyer() }}
          placeholder={tours.length > 0 ? libelles.iaPlaceholderSuite : libelles.iaPlaceholder}
          aria-label={libelles.iaDescription}
          maxLength={DESCRIPTION_MAX}
          // En lecture seule plutôt que désactivé pendant l'analyse : le champ garde le focus.
          readOnly={enCours}
        />
        {photos.length > 0 && (
          <div className="dico-vignettes">
            {photos.map((photo, i) => (
              <div key={`${i}-${photo.length}`} className="dico-vignette">
                <Image src={photo} alt={libelles.photoNumero(i + 1)} width={56} height={56} unoptimized />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  aria-label={libelles.retirerPhoto(i + 1)}
                  disabled={enCours}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {erreur && <div className="dico-erreur" role="alert">⚠️ {erreur}</div>}
        <div className="dico-actions">
          <input
            ref={champFichier}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const fichiers = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (fichiers.length > 0) void ajouterPhotos(fichiers)
            }}
          />
          <button
            type="button"
            className="v5-btn"
            onClick={() => champFichier.current?.click()}
            disabled={enCours || enPreparation > 0 || photos.length >= PHOTOS_MAX}
          >
            📷 {enPreparation > 0 ? libelles.photosEnPreparation : `${libelles.ajouterPhotos} (${photos.length}/${PHOTOS_MAX})`}
          </button>
          {tours.length > 0 && (
            <button type="button" className="v5-btn" onClick={recommencer} disabled={enCours}>
              {libelles.nouvelleConversation}
            </button>
          )}
          {/* Pendant l'analyse, inactif sans être désactivé : le bouton cliqué garde le focus. */}
          <button
            type="button"
            className="v5-btn v5-btn-p dico-envoyer"
            onClick={() => void envoyer()}
            disabled={!enCours && (enPreparation > 0 || rienAEnvoyer)}
            aria-disabled={enCours || undefined}
          >
            {enCours ? libelles.analyseEnCours : libelles.analyser}
          </button>
        </div>
      </div>
      <p className="dico-mention">{libelles.avertissementIA}</p>
    </div>
  )
}

/* ── Section ── */
export default function DictionnaireMateriauxSection() {
  const langue = useLocale()
  const libelles = libellesPour(langue)
  const dico = dictionnairePour(paysDeLaLangue(langue))
  const [mode, setMode] = useState<Mode>('manuel')
  const [pile, setPile] = useState<Fiche[]>([])

  const ouvrir = useCallback((fiche: Fiche) => setPile((p) => [...p, fiche]), [])
  const retour = useCallback(() => setPile((p) => p.slice(0, -1)), [])
  const fermer = useCallback(() => setPile([]), [])

  if (!dico) {
    return (
      <div className="v5-fade">
        <div className="dico-wrap">
          <div className="v5-pg-t"><h1>{libelles.titre}</h1></div>
          <div className="v5-card dico-vide"><strong>{libelles.indisponible}</strong></div>
        </div>
      </div>
    )
  }

  const contexte: Contexte = { dico, libelles, ouvrir }

  return (
    <div className="v5-fade">
      <div className="dico-wrap">
        <div className="v5-pg-t">
          <h1>{libelles.titre}</h1>
          <p>{libelles.sousTitre(dico.enseignes.map((e) => e.nom).join(', '))}</p>
        </div>

        <div className="dico-modes">
          <button type="button" aria-pressed={mode === 'manuel'} className={mode === 'manuel' ? 'active' : ''} onClick={() => setMode('manuel')}>
            {libelles.modeManuel}
          </button>
          <button type="button" aria-pressed={mode === 'ia'} className={mode === 'ia' ? 'active' : ''} onClick={() => setMode('ia')}>
            {libelles.modeIA}
          </button>
        </div>

        {/* Les deux modes restent montés : passer de l'un à l'autre ne perd ni la recherche ni la conversation. */}
        <div hidden={mode !== 'manuel'}><ModeManuel contexte={contexte} /></div>
        <div hidden={mode !== 'ia'}><ModeIA contexte={contexte} /></div>

        <p className="dico-mention dico-pied">{libelles.verifieLe(dateLisible(dico.verifieLe))}</p>
      </div>

      {pile.length > 0 && <FenetreFiche pile={pile} contexte={contexte} retour={retour} fermer={fermer} />}
    </div>
  )
}
