'use client'

// ── AJ Signalement — formulaire « Diffuser un message » et message d'annonce (PR 3, lot 8, BROUILLON) ───────────────
//
// Cahier PR 3 § 7.2 (dans l'ordre : rappel du mois, modèle, objet, texte, à qui, nombre exact, instruction écrite,
// phrase du droit § 5.6, « Vérifier et envoyer », confirmation, envoi) et § 7.6 (accessibilité) ; décisions de Hugo du
// 11/11/2026 : messages d'exploitation seulement, aucun plafond (rappel du mois), H1 = C (message d'annonce au texte
// figé), H3 (modèles, dont « Ascenseur à l'arrêt »), H7 (fin de mission rappelée), H11 (le gestionnaire diffuse sans
// instruction écrite : c'est le cabinet). Écran en BROUILLON, soumis à Frédéric (F1).
//   - valeurs de la copropriété (D-R1) : bâtiments et étages RÉELLEMENT présents dans les signalements, regroupés ;
//     l'écran envoie des CLÉS, le serveur les reconvertit en valeurs brutes et écrit le libellé de l'e-mail ;
//   - « Un bâtiment » présélectionné dès deux bâtiments, aucun choisi (droit § 6, J2) ;
//   - nombre EXACT (D-R2, même fonction SQL que l'envoi), recalculé à chaque choix, dans une région aria-live ; jamais
//     additionné ici ; 0 personne → « Vérifier et envoyer » désactivé ;
//   - texte contrôlé dès l'écran (liens, adresses, crochets d'un modèle, termes commerciaux… : le motif sous le champ) ;
//     les numéros de téléphone sont jugés par le serveur seul (il connaît les numéros déclarés par le cabinet, H2) ;
//   - « Vérifier et envoyer » refait un aperçu FRAIS : la confirmation montre son nombre, son libellé et part avec son
//     instant ; 409 perimetre_change → nouvel aperçu, nouveau nombre, nouvelle confirmation (même opération) ;
//   - phrase du droit § 5.6, À LA LETTRE, juste au-dessus du bouton du formulaire ET du bouton qui envoie, reliée à
//     chacun (aria-describedby) ;
//   - envoi : reprise automatique tant que des messages attendent (envoiDiffusionQr.ts), progression, bilan.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, ChoixCartes, CLASSES_SAISIE, Encadre, Ligne } from '@/components/coproprietaire-dashboard/ui'
import {
  apercuDiffusionQr, chargerValeursDiffusionQr, diffuserMessageQr,
  type ApercuDiffusionQr, type ChampRefusDiffusionQr, type DemandeApercuDiffusionQr, type SaisieDiffusionQr, type ValeursDiffusionQr,
} from '@/lib/aj-signalement/api'
import {
  MODELES_SELECTEUR_DIFFUSION_QR, NOMS_MODELES_DIFFUSION_QR, TEXTES_MODELES_DIFFUSION_QR, annonceDiffusionQr,
} from '@/lib/aj-signalement/affichage-diffusion'
import { controlerTexteDiffusionQr, type NatureTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { PerimetreSaisiDiffusionQr } from '@/lib/aj-signalement/diffusion-formes'
import type { EtageCiblableQr } from '@/lib/aj-signalement/diffusion-valeurs'
import {
  PHRASE_CONFORT_DIFFUSION_QR, TEXTES_ECRAN_DIFFUSION_QR as TD, aujourdhuiParisEcranQr, dateNonFutureQr, jourCourtParisQr,
  messageRefusTexteDiffusionQr, personnesQr, raisonDiffusionImpossibleQr, rappelMoisDiffusionQr,
  type CoproprieteEcranDiffusionQr, type GardeDiffusionQr, type ProfilDiffusionQr,
} from '@/lib/aj-signalement/affichage-ecran-diffusion'
import { lignesIssueEnvoiDiffusionQr, messageEchecDiffusionQr, poursuivreEnvoiDiffusionQr } from '@/components/aj-signalement/envoiDiffusionQr'

type ModeleSelecteurQr = (typeof MODELES_SELECTEUR_DIFFUSION_QR)[number]
type PorteeChoisieQr = 'copropriete' | 'batiment' | 'etage'
type ChampQr = 'objet' | 'texte' | 'batiment' | 'etage' | 'nomBatiment' | 'nomEtage' | 'reference' | 'date'
type ErreursQr = Partial<Record<ChampQr, string>>
interface ChoixPerimetreQr { portee: PorteeChoisieQr; batiment: string; etage: string }

type Chargement = { etat: 'chargement' } | { etat: 'erreur'; message: string } | { etat: 'pret'; valeurs: ValeursDiffusionQr }
type EtatApercu = { etat: 'vide' } | { etat: 'calcul' } | { etat: 'pret'; apercu: ApercuDiffusionQr } | { etat: 'erreur'; message: string }
type Etape =
  | { nom: 'saisie' }
  | { nom: 'confirmation'; apercu: ApercuDiffusionQr; avis: string | null; erreur: string | null }
  | { nom: 'envoi'; total: number; envoyes: number; repondu: boolean }
  | { nom: 'fin'; lignes: string[]; termine: boolean }

const CHAMP_DU_REFUS: Record<ChampRefusDiffusionQr, ChampQr> = {
  objet: 'objet', texte: 'texte', libelleBatimentSaisi: 'nomBatiment', libelleEtageSaisi: 'nomEtage',
}
const ORDRE_CHAMPS: readonly ChampQr[] = ['objet', 'texte', 'batiment', 'etage', 'nomBatiment', 'nomEtage', 'reference', 'date']
const SEUIL_RECHERCHE = 8
const DELAI_ANNONCE_COMPTEUR_MS = 1500

/** Longueur en caractères (points de code), comme le serveur. */
const longueur = (t: string): number => Array.from(t).length
const cleRecherche = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
/** Bâtiment ou étage dont le nom écrit dans l'e-mail est à saisir (aucune variante affichable). */
const aNommer = (c: EtageCiblableQr | undefined): boolean => c !== undefined && (c.libelleASaisir || c.libelle === null)
const decrire = (...ids: Array<string | false | null | undefined>): string | undefined => {
  const liste = ids.filter((x): x is string => typeof x === 'string' && x !== '')
  return liste.length > 0 ? liste.join(' ') : undefined
}

/** Périmètre envoyé au serveur (des clés) ; null : choix incomplet (aucun aperçu). */
function perimetreDe(mode: 'message' | 'annonce', signalementId: string | undefined, c: ChoixPerimetreQr): PerimetreSaisiDiffusionQr | null {
  if (mode === 'annonce') return { portee: 'copropriete' }
  if (signalementId) return { portee: 'signalement', signalementId }
  if (c.portee === 'copropriete') return { portee: 'copropriete' }
  if (!c.batiment) return null
  if (c.portee === 'batiment') return { portee: 'batiment', batiment: c.batiment }
  return c.etage ? { portee: 'etage', batiment: c.batiment, etage: c.etage } : null
}

export interface PropsFormulaireDiffusionQr {
  copropriete: CoproprieteEcranDiffusionQr
  profil: ProfilDiffusionQr
  /** Message d'exploitation, ou message d'annonce au texte figé (H1 = C). */
  mode: 'message' | 'annonce'
  signalementId?: string
  delaiRepriseMs: number
  onGarde: (garde: GardeDiffusionQr) => void
  /** Fermeture protégée de la fenêtre (« Annuler », « Fermer »). */
  onFermer: () => void
  onAnnoncer: () => void
  onHistorique: () => void
}

export default function FormulaireDiffusionQr({
  copropriete, profil, mode, signalementId, delaiRepriseMs, onGarde, onFermer, onAnnoncer, onHistorique,
}: Readonly<PropsFormulaireDiffusionQr>) {
  const idBase = useId()
  const ids = {
    objet: `${idBase}-objet`, texte: `${idBase}-texte`, batiment: `${idBase}-batiment`, etage: `${idBase}-etage`,
    nomBatiment: `${idBase}-nom-batiment`, nomEtage: `${idBase}-nom-etage`, reference: `${idBase}-reference`, date: `${idBase}-date`,
    phrase: `${idBase}-phrase`, phraseConfirmation: `${idBase}-phrase-confirmation`, aideInstruction: `${idBase}-instruction-aide`,
    nombre: `${idBase}-nombre`, verifier: `${idBase}-verifier`,
  }
  const [chargement, setChargement] = useState<Chargement>({ etat: 'chargement' })
  // Tirée à l'ouverture : un double clic ou un nouvel essai (409, réseau) rend la diffusion déjà créée, jamais deux.
  const [operationId] = useState(() => globalThis.crypto.randomUUID())
  const [modele, setModele] = useState<ModeleSelecteurQr | ''>('')
  const [modeleDemande, setModeleDemande] = useState<ModeleSelecteurQr | null>(null)
  const [objet, setObjet] = useState('')
  const [texte, setTexte] = useState('')
  const [choix, setChoix] = useState<ChoixPerimetreQr>({ portee: 'copropriete', batiment: '', etage: '' })
  const [nomBatiment, setNomBatiment] = useState('')
  const [nomEtage, setNomEtage] = useState('')
  const [reference, setReference] = useState('')
  const [dateInstruction, setDateInstruction] = useState('')
  const [erreurs, setErreurs] = useState<ErreursQr>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [apercu, setApercu] = useState<EtatApercu>({ etat: 'vide' })
  const [etape, setEtape] = useState<Etape>({ nom: 'saisie' })
  const [occupe, setOccupe] = useState(false)
  const monte = useRef(true)
  const sequence = useRef(0)
  const titreConfirmation = useRef<HTMLHeadingElement>(null)
  const zoneEnvoi = useRef<HTMLParagraphElement>(null)
  const zoneBilan = useRef<HTMLDivElement>(null)
  const focusApres = useRef<string | null>(null)

  useEffect(() => {
    monte.current = true
    return () => { monte.current = false }
  }, [])

  /** Aperçu du périmètre choisi (D-R2) ; une réponse dépassée par un choix plus récent est ignorée. */
  const calculer = useCallback(async (perimetre: PerimetreSaisiDiffusionQr | null) => {
    sequence.current += 1
    const rang = sequence.current
    if (!perimetre) {
      setApercu({ etat: 'vide' })
      return
    }
    setApercu({ etat: 'calcul' })
    const r = await apercuDiffusionQr(copropriete.id, { perimetre, ...(mode === 'annonce' ? { annonce: true as const } : {}) })
    if (rang !== sequence.current || !monte.current) return
    setApercu(r.ok ? { etat: 'pret', apercu: r.apercu } : { etat: 'erreur', message: messageEchecDiffusionQr(r.code, profil) })
  }, [copropriete.id, mode, profil])

  // Valeurs de la copropriété (D-R1), puis le premier aperçu quand le périmètre par défaut est complet.
  useEffect(() => {
    let actif = true
    void chargerValeursDiffusionQr(copropriete.id).then((r) => {
      if (!actif) return
      if (!r.ok) {
        setChargement({ etat: 'erreur', message: messageEchecDiffusionQr(r.code, profil) })
        return
      }
      const v = r.valeurs
      const depart: ChoixPerimetreQr = { portee: v.batiments.length === 0 ? 'copropriete' : v.porteeParDefaut, batiment: '', etage: '' }
      setChargement({ etat: 'pret', valeurs: v })
      setChoix(depart)
      if (v.possible) void calculer(perimetreDe(mode, signalementId, depart))
    })
    return () => { actif = false }
  }, [copropriete.id, profil, mode, signalementId, calculer])

  // Protection de la fenêtre (Échap, clic dehors, changement de vue) : saisie en cours, envoi en cours.
  const saisieEnCours = (mode === 'message' && (objet.trim() !== '' || texte.trim() !== ''))
    || reference.trim() !== '' || dateInstruction !== '' || nomBatiment.trim() !== '' || nomEtage.trim() !== ''
  const garde: GardeDiffusionQr = etape.nom === 'envoi' ? 'envoi'
    : etape.nom === 'fin' || chargement.etat !== 'pret' || !saisieEnCours ? 'libre' : 'saisie'
  useEffect(() => { onGarde(garde) }, [garde, onGarde])

  // Focus : titre de la confirmation à l'arrivée ; champ refusé ou bouton « Vérifier et envoyer » au retour. Envoi puis
  // bilan : le bouton qui envoie disparaît, le focus va à la zone d'état puis au bilan (relecture 3 : il tombait hors de
  // la fenêtre, et Tab menait derrière son fond).
  useEffect(() => {
    if (etape.nom === 'confirmation') titreConfirmation.current?.focus()
    if (etape.nom === 'envoi') zoneEnvoi.current?.focus()
    if (etape.nom === 'fin') zoneBilan.current?.focus()
    if (etape.nom === 'saisie' && focusApres.current) {
      document.getElementById(focusApres.current)?.focus()
      focusApres.current = null
    }
  }, [etape.nom])

  if (chargement.etat === 'chargement') return <p role="status" className="text-base text-[#4A5E78]">{TD.chargement}</p>
  if (chargement.etat === 'erreur') {
    return (
      <div className="space-y-4">
        <Encadre ton="avertissement">{chargement.message}</Encadre>
        <Bouton variante="secondaire" onClick={onFermer}>{TD.boutons.fermer}</Bouton>
      </div>
    )
  }

  const v = chargement.valeurs
  const annonce = mode === 'annonce' ? annonceDiffusionQr(v.langue, copropriete.cabinetNom ?? '') : null
  const rappel = <p className="text-base text-[#1F2D3D]">{rappelMoisDiffusionQr(v.ceMois)}</p>

  if (!v.possible) {
    return (
      <div className="space-y-4">
        {rappel}
        <Encadre ton="avertissement">{raisonDiffusionImpossibleQr(v.raison, v.finMissionLe)}</Encadre>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bouton variante="secondaire" icone="horloge" onClick={onHistorique}>{TD.boutons.voirHistorique}</Bouton>
          <Bouton variante="secondaire" onClick={onFermer}>{TD.boutons.fermer}</Bouton>
        </div>
      </div>
    )
  }

  const perimetre = perimetreDe(mode, signalementId, choix)
  const batimentChoisi = v.batiments.find((b) => b.cle === choix.batiment)
  const etageChoisi = batimentChoisi?.etages.find((e) => e.cle === choix.etage)
  const avecNomBatiment = perimetre !== null && (perimetre.portee === 'batiment' || perimetre.portee === 'etage') && aNommer(batimentChoisi)
  const avecNomEtage = perimetre !== null && perimetre.portee === 'etage' && aNommer(etageChoisi)
  const objetEnvoye = annonce ? annonce.objet : objet.trim()
  const texteEnvoye = annonce ? annonce.texte : texte.trim()

  const libellesSaisis = (): Pick<DemandeApercuDiffusionQr, 'libelleBatimentSaisi' | 'libelleEtageSaisi'> => ({
    ...(avecNomBatiment && nomBatiment.trim() ? { libelleBatimentSaisi: nomBatiment.trim() } : {}),
    ...(avecNomEtage && nomEtage.trim() ? { libelleEtageSaisi: nomEtage.trim() } : {}),
  })
  const demandeApercu = (p: PerimetreSaisiDiffusionQr): DemandeApercuDiffusionQr => ({
    perimetre: p, ...(mode === 'annonce' ? { annonce: true as const } : {}), ...libellesSaisis(),
  })

  const effacerErreurs = (...champs: ChampQr[]) => setErreurs((e) => {
    const suite = { ...e }
    for (const c of champs) delete suite[c]
    return suite
  })

  // ── Modèle ──
  const appliquerModele = (m: ModeleSelecteurQr) => {
    setModele(m)
    setModeleDemande(null)
    if (m === 'libre') return
    const t = TEXTES_MODELES_DIFFUSION_QR[m][v.langue]
    setObjet(t.objet)
    setTexte(t.texte)
    effacerErreurs('objet', 'texte')
  }
  /** Texte du modèle courant, non retouché : un autre modèle peut le remplacer sans question. */
  const texteDuModele = modele !== '' && modele !== 'libre'
    && TEXTES_MODELES_DIFFUSION_QR[modele][v.langue].objet === objet && TEXTES_MODELES_DIFFUSION_QR[modele][v.langue].texte === texte
  const choisirModele = (m: ModeleSelecteurQr) => {
    if (m === modele) return
    const saisi = objet.trim() !== '' || texte.trim() !== ''
    if (m !== 'libre' && saisi && !texteDuModele) {
      setModeleDemande(m)
      return
    }
    appliquerModele(m)
  }

  // ── Périmètre ──
  const changerChoix = (suite: ChoixPerimetreQr) => {
    setChoix(suite)
    effacerErreurs('batiment', 'etage', 'nomBatiment', 'nomEtage')
    void calculer(perimetreDe(mode, signalementId, suite))
  }
  const choisirPortee = (p: PorteeChoisieQr) => changerChoix({ portee: p, batiment: choix.batiment, etage: p === 'etage' ? choix.etage : '' })
  const choisirBatiment = (cle: string) => {
    setNomBatiment('')
    setNomEtage('')
    changerChoix({ ...choix, batiment: cle, etage: '' })
  }
  const choisirEtage = (cle: string) => {
    setNomEtage('')
    changerChoix({ ...choix, etage: cle })
  }

  // ── Vérification (contrôles de l'écran, puis aperçu FRAIS) ──
  const controlerTexte = (valeur: string, nature: NatureTexteDiffusionQr, min: number, max: number, messageLongueur: string): string | null => {
    if (longueur(valeur) < min || longueur(valeur) > max) return messageLongueur
    // Les numéros de téléphone sont jugés par le serveur (numéros déclarés par le cabinet, H2) ; le reste, dès ici.
    const c = controlerTexteDiffusionQr(valeur, { nature, telephonesAutorises: [] })
    return !c.ok && c.motif !== 'telephone' ? messageRefusTexteDiffusionQr(c.motif, c.conseil) : null
  }
  const controler = (): ErreursQr => {
    const e: ErreursQr = {}
    if (mode === 'message') {
      const refusObjet = controlerTexte(objet.trim(), 'objet', 3, 120, TD.formulaire.objetLongueur)
      if (refusObjet) e.objet = refusObjet
      const refusTexte = controlerTexte(texte.trim(), 'texte', 10, 2000, TD.formulaire.texteLongueur)
      if (refusTexte) e.texte = refusTexte
      if (!signalementId && choix.portee !== 'copropriete') {
        if (!choix.batiment) e.batiment = TD.portee.choisirBatiment
        else if (choix.portee === 'etage' && !choix.etage) e.etage = TD.portee.choisirEtage
        if (avecNomBatiment && !nomBatiment.trim()) e.nomBatiment = TD.portee.nomRequis
        if (avecNomEtage && !nomEtage.trim()) e.nomEtage = TD.portee.nomRequis
      }
    }
    if (profil === 'super_admin') {
      const ref = reference.trim()
      if (longueur(ref) < 5 || longueur(ref) > 200 || ref.includes('@')) e.reference = TD.instruction.referenceRequise
      if (!dateNonFutureQr(dateInstruction)) e.date = TD.instruction.dateRequise
    }
    return e
  }
  const montrerErreurs = (e: ErreursQr) => {
    setErreurs(e)
    const premier = ORDRE_CHAMPS.find((c) => e[c])
    if (premier) document.getElementById(ids[premier])?.focus()
  }

  const verifier = async () => {
    if (occupe) return
    setErreur(null)
    const e = controler()
    if (Object.keys(e).length > 0 || !perimetre) {
      montrerErreurs(e)
      setErreur(TD.formulaire.corriger)
      return
    }
    setErreurs({})
    setOccupe(true)
    // Un aperçu en cours (choix précédent) ne remplacera pas celui-ci.
    sequence.current += 1
    const r = await apercuDiffusionQr(copropriete.id, demandeApercu(perimetre))
    if (!monte.current) return
    setOccupe(false)
    if (!r.ok) {
      if (r.code === 'texte_refuse' && r.refusTexte) return montrerErreurs({ [CHAMP_DU_REFUS[r.refusTexte.champ]]: messageRefusTexteDiffusionQr(r.refusTexte.motif, r.refusTexte.conseil) })
      setErreur(messageEchecDiffusionQr(r.code, profil))
      return
    }
    const a = r.apercu
    setApercu({ etat: 'pret', apercu: a })
    if (!a.possible) return setErreur(raisonDiffusionImpossibleQr(a.raison, v.finMissionLe))
    if (a.libelleASaisir || !a.libellePerimetre) return montrerErreurs(avecNomEtage && !avecNomBatiment ? { nomEtage: TD.portee.nomRequis } : { nomBatiment: TD.portee.nomRequis })
    if (a.nbDestinataires === 0) return setErreur(TD.nombre.personne)
    setEtape({ nom: 'confirmation', apercu: a, avis: null, erreur: null })
  }

  const retourSaisie = () => {
    focusApres.current = ids.verifier
    setEtape({ nom: 'saisie' })
  }

  // ── Envoi (D-R3), puis reprise automatique (D-R4) ──
  const envoyer = async () => {
    if (etape.nom !== 'confirmation' || !perimetre || !etape.apercu.libellePerimetre) return
    const a = etape.apercu
    const saisie: SaisieDiffusionQr = {
      operationId,
      modele: mode === 'annonce' ? 'annonce' : modele || 'libre',
      objet: objetEnvoye,
      texte: texteEnvoye,
      perimetre,
      ...libellesSaisis(),
      libellePerimetre: a.libellePerimetre ?? '',
      perimetreJusquAu: a.instant,
      nbDestinatairesAttendu: a.nbDestinataires,
      ...(profil === 'super_admin' ? { instruction: { reference: reference.trim(), recueLe: dateInstruction } } : {}),
    }
    setEtape({ nom: 'envoi', total: a.nbDestinataires, envoyes: 0, repondu: false })
    const r = await diffuserMessageQr(copropriete.id, saisie)
    if (!monte.current) return
    if (!r.ok) {
      if (r.code === 'perimetre_change') {
        // Le nombre a augmenté depuis l'aperçu : nouvel aperçu, nouveau nombre, nouvelle confirmation (même opération).
        const nouveau = await apercuDiffusionQr(copropriete.id, demandeApercu(perimetre))
        if (!monte.current) return
        if (!nouveau.ok) return setEtape({ nom: 'confirmation', apercu: a, avis: null, erreur: messageEchecDiffusionQr(nouveau.code, profil) })
        const n = nouveau.apercu
        setApercu({ etat: 'pret', apercu: n })
        const avis = n.nbDestinataires > 0 && n.possible && n.libellePerimetre
          ? remplir(TD.confirmation.perimetreChange, { personnes: personnesQr(n.nbDestinataires) })
          : n.possible ? TD.nombre.personne : raisonDiffusionImpossibleQr(n.raison, v.finMissionLe)
        return setEtape({ nom: 'confirmation', apercu: n, avis, erreur: null })
      }
      if (r.code === 'texte_refuse' && r.refusTexte) {
        const champ = CHAMP_DU_REFUS[r.refusTexte.champ]
        setErreurs({ [champ]: messageRefusTexteDiffusionQr(r.refusTexte.motif, r.refusTexte.conseil) })
        focusApres.current = ids[champ]
        return setEtape({ nom: 'saisie' })
      }
      return setEtape({ nom: 'confirmation', apercu: a, avis: null, erreur: messageEchecDiffusionQr(r.code, profil) })
    }
    setEtape({ nom: 'envoi', total: r.nbDestinataires, envoyes: r.envoyes, repondu: true })
    const issue = await poursuivreEnvoiDiffusionQr({
      diffusionId: r.diffusionId, depart: r, delaiMs: delaiRepriseMs, actif: () => monte.current,
      onProgres: (etat) => setEtape((e) => (e.nom === 'envoi' ? { ...e, envoyes: etat.envoyes } : e)),
    })
    if (!monte.current) return
    // Personnes opposées entre l'aperçu et l'envoi : envoi au nombre réel, dit à l'écran (cahier § 7.2, point 10).
    const ecart = r.rejeu ? 0 : Math.max(0, a.nbDestinataires - r.nbDestinataires)
    const lignes = lignesIssueEnvoiDiffusionQr(issue, profil, ecart)
    setEtape({ nom: 'fin', lignes: r.rejeu ? [TD.fin.rejeu, ...lignes] : lignes, termine: issue.type === 'termine' })
  }

  // ── Rendu ──
  // L'annonce n'est proposée qu'à la saisie (relecture 3) : à la confirmation et pendant l'envoi, passer à une autre vue
  // jetterait le message confirmé ou arrêterait la reprise automatique de l'envoi.
  const enTete = (avecAnnonce: boolean) => (
    <>
      {rappel}
      {avecAnnonce && mode === 'message' && !signalementId && v.nbNonAnnonces > 0 && (
        <Encadre ton="info">
          <p>{remplir(TD.annonce.encadre, { n: v.nbNonAnnonces })}</p>
          <div className="mt-2">
            <Bouton variante="or" petit icone="annonces" onClick={onAnnoncer}>{remplir(TD.annonce.bouton, { n: v.nbNonAnnonces })}</Bouton>
          </div>
        </Encadre>
      )}
      {v.finMissionLe && <p className="text-sm text-[#4A5E78]">{remplir(TD.finMission.info, { date: jourCourtParisQr(v.finMissionLe) })}</p>}
    </>
  )

  if (etape.nom === 'envoi') {
    return (
      <div className="space-y-4" aria-busy="true">
        {enTete(false)}
        <p ref={zoneEnvoi} tabIndex={-1} role="status" aria-live="polite" className="rounded-xl bg-[#F7F4EE] px-4 py-3 text-base font-semibold text-[#0D1B2E] outline-none">
          {etape.repondu ? remplir(TD.envoi.progression, { envoyes: etape.envoyes, total: etape.total }) : TD.envoi.enCours}
        </p>
      </div>
    )
  }

  if (etape.nom === 'fin') {
    return (
      <div className="space-y-4">
        <div ref={zoneBilan} tabIndex={-1} className="outline-none">
          <Encadre ton={etape.termine ? 'succes' : 'avertissement'} role="status">
            {etape.lignes.map((l) => <p key={l}>{l}</p>)}
          </Encadre>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bouton variante="secondaire" icone="horloge" onClick={onHistorique}>{TD.boutons.voirHistorique}</Bouton>
          <Bouton variante="principal" onClick={onFermer}>{TD.boutons.fermer}</Bouton>
        </div>
      </div>
    )
  }

  if (etape.nom === 'confirmation') {
    const a = etape.apercu
    const possible = a.possible && a.nbDestinataires > 0 && a.libellePerimetre !== null
    return (
      <section className="space-y-4" aria-labelledby={`${idBase}-confirmation`}>
        {enTete(false)}
        <h3 id={`${idBase}-confirmation`} ref={titreConfirmation} tabIndex={-1} className="text-lg font-bold text-[#0D1B2E] outline-none">{TD.confirmation.titre}</h3>
        {etape.avis && <Encadre ton="avertissement" role="alert">{etape.avis}</Encadre>}
        <dl>
          <Ligne etiquette={TD.confirmation.objet}>{objetEnvoye}</Ligne>
          <Ligne etiquette={TD.confirmation.perimetre}>{a.libellePerimetre ?? '—'}</Ligne>
          <Ligne etiquette={TD.confirmation.destinataires}>{personnesQr(a.nbDestinataires)}</Ligne>
        </dl>
        {etape.erreur && <Encadre ton="erreur">{etape.erreur}</Encadre>}
        <div className="space-y-3 border-t border-[#E4DDD0] pt-4">
          <p id={ids.phraseConfirmation} className="text-base font-semibold text-[#0D1B2E]">{PHRASE_CONFORT_DIFFUSION_QR}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Bouton variante="principal" icone="envoyer" aria-describedby={ids.phraseConfirmation} disabled={!possible} onClick={() => { void envoyer() }} className="flex-1">
              {remplir(TD.boutons.envoyer, { personnes: personnesQr(a.nbDestinataires) })}
            </Bouton>
            <Bouton variante="secondaire" onClick={retourSaisie} className="flex-1">{TD.boutons.annuler}</Bouton>
          </div>
        </div>
      </section>
    )
  }

  // ── Saisie ──
  const zeroOuImpossible = apercu.etat === 'pret' && (apercu.apercu.nbDestinataires === 0 || !apercu.apercu.possible)
  const erreurChamp = (champ: ChampQr) => (erreurs[champ]
    ? <div id={`${ids[champ]}-erreur`} className="mt-2"><Encadre ton="erreur" role="alert">{erreurs[champ]}</Encadre></div>
    : null)
  const invalide = (champ: ChampQr) => (erreurs[champ] ? true : undefined)

  let nombre: ReactNode
  if (!perimetre) nombre = <p>{choix.portee === 'etage' && choix.batiment ? TD.portee.choisirEtage : TD.portee.choisirBatiment}</p>
  else if (apercu.etat === 'calcul' || apercu.etat === 'vide') nombre = <p>{TD.nombre.calcul}</p>
  else if (apercu.etat === 'erreur') nombre = <p>{apercu.message}</p>
  else if (!apercu.apercu.possible) nombre = <p>{raisonDiffusionImpossibleQr(apercu.apercu.raison, v.finMissionLe)}</p>
  else if (apercu.apercu.nbDestinataires === 0) nombre = <p className="font-semibold">{TD.nombre.personne}</p>
  else {
    const a = apercu.apercu
    const personnes = personnesQr(a.nbDestinataires)
    nombre = (
      <>
        <p className="font-semibold">
          {a.libellePerimetre ? remplir(TD.nombre.partira, { personnes, perimetre: a.libellePerimetre }) : remplir(TD.nombre.partiraSansLibelle, { personnes })}
        </p>
        {a.nbExclusOpposition > 0 && (
          <p className="text-sm">{a.nbExclusOpposition === 1 ? TD.nombre.exclusUn : remplir(TD.nombre.exclus, { personnes: personnesQr(a.nbExclusOpposition) })}</p>
        )}
      </>
    )
  }

  let numeroSansNom = 0
  const optionsBatiments: OptionValeurQr[] = v.batiments.map((b) => ({
    cle: b.cle,
    libelle: b.libelle ?? b.variantes[0] ?? remplir(TD.portee.sansNom, { n: ++numeroSansNom }),
    description: b.variantes.length > 1 ? remplir(TD.portee.regroupe, { variantes: b.variantes.join(', ') }) : undefined,
  }))
  let numeroEtageSansNom = 0
  const optionsEtages: OptionValeurQr[] = (batimentChoisi?.etages ?? []).map((e) => ({
    cle: e.cle,
    libelle: e.libelle ?? e.variantes[0] ?? remplir(TD.portee.sansNomEtage, { n: ++numeroEtageSansNom }),
    description: e.variantes.length > 1 ? remplir(TD.portee.regroupe, { variantes: e.variantes.join(', ') }) : undefined,
  }))
  const optionsPortee = v.batiments.length === 0
    ? [{ valeur: 'copropriete' as const, libelle: TD.portee.copropriete }]
    : [
        { valeur: 'copropriete' as const, libelle: TD.portee.copropriete },
        { valeur: 'batiment' as const, libelle: TD.portee.batiment },
        { valeur: 'etage' as const, libelle: TD.portee.etage },
      ]

  return (
    <form className="space-y-5" aria-busy={occupe} noValidate onSubmit={(e) => { e.preventDefault(); void verifier() }}>
      {enTete(true)}

      {annonce ? (
        <>
          <Encadre ton="info">{TD.annonce.intro}</Encadre>
          <div>
            <p className="text-sm font-semibold text-[#4A5E78]">{TD.annonce.objet}</p>
            <p className="text-base text-[#0D1B2E]">{annonce.objet}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#4A5E78]">{TD.annonce.texte}</p>
            <p className="whitespace-pre-wrap rounded-xl bg-[#F7F4EE] px-4 py-3 text-base text-[#0D1B2E]">{annonce.texte}</p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <ChoixCartes
              nom={`${idBase}-modele`} legende={TD.formulaire.modele} valeur={modele} onChange={choisirModele}
              options={MODELES_SELECTEUR_DIFFUSION_QR.map((m) => ({ valeur: m, libelle: NOMS_MODELES_DIFFUSION_QR[m] }))}
            />
            {modeleDemande && (
              <Encadre ton="avertissement">
                <p>{remplir(TD.formulaire.remplacerModele, { modele: NOMS_MODELES_DIFFUSION_QR[modeleDemande] })}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Bouton variante="danger" petit onClick={() => appliquerModele(modeleDemande)}>{TD.formulaire.remplacer}</Bouton>
                  <Bouton variante="secondaire" petit onClick={() => setModeleDemande(null)}>{TD.formulaire.garder}</Bouton>
                </div>
              </Encadre>
            )}
          </div>

          <div>
            <Champ id={ids.objet} etiquette={TD.formulaire.objet}>
              <input
                id={ids.objet} value={objet} maxLength={120} autoComplete="off" className={CLASSES_SAISIE}
                aria-invalid={invalide('objet')} aria-describedby={decrire(erreurs.objet && `${ids.objet}-erreur`)}
                onChange={(e) => { setObjet(e.target.value); effacerErreurs('objet') }}
              />
            </Champ>
            <CompteurQr n={longueur(objet)} max={120} />
            {erreurChamp('objet')}
          </div>

          <div>
            <Champ id={ids.texte} etiquette={TD.formulaire.texte} aide={TD.formulaire.aideTexte}>
              <textarea
                id={ids.texte} value={texte} maxLength={2000} rows={7} className={`${CLASSES_SAISIE} resize-y`}
                aria-invalid={invalide('texte')} aria-describedby={decrire(`${ids.texte}-aide`, erreurs.texte && `${ids.texte}-erreur`)}
                onChange={(e) => { setTexte(e.target.value); effacerErreurs('texte') }}
              />
            </Champ>
            <CompteurQr n={longueur(texte)} max={2000} />
            {erreurChamp('texte')}
          </div>

          {signalementId ? (
            <div>
              <p className="text-base font-semibold text-[#0D1B2E]">{TD.portee.signalement}</p>
              <p className="text-sm text-[#4A5E78]">{TD.portee.signalementAide}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <ChoixCartes nom={`${idBase}-portee`} legende={TD.portee.legende} valeur={choix.portee} onChange={choisirPortee} options={optionsPortee} />
              {v.batiments.length === 0 && <p className="text-sm text-[#4A5E78]">{TD.portee.aucunBatiment}</p>}
              {choix.portee !== 'copropriete' && (
                <div>
                  <ChoixValeurQr
                    id={ids.batiment} nom={`${idBase}-batiments`} legende={TD.portee.batimentLegende} options={optionsBatiments}
                    valeur={choix.batiment} onChange={choisirBatiment} rechercher={TD.portee.rechercher}
                  />
                  {v.sansBatiment > 0 && <p className="mt-2 text-sm text-[#4A5E78]">{remplir(TD.portee.sansBatiment, { n: v.sansBatiment })}</p>}
                  {erreurChamp('batiment')}
                </div>
              )}
              {choix.portee === 'etage' && batimentChoisi && (
                <div>
                  {optionsEtages.length === 0 ? <p className="text-sm text-[#4A5E78]">{TD.portee.aucunEtage}</p> : (
                    <ChoixValeurQr
                      id={ids.etage} nom={`${idBase}-etages`} legende={TD.portee.etageLegende} options={optionsEtages}
                      valeur={choix.etage} onChange={choisirEtage}
                    />
                  )}
                  {batimentChoisi.sansEtage > 0 && <p className="mt-2 text-sm text-[#4A5E78]">{remplir(TD.portee.sansEtage, { n: batimentChoisi.sansEtage })}</p>}
                  {erreurChamp('etage')}
                </div>
              )}
              {avecNomBatiment && (
                <div>
                  <Champ id={ids.nomBatiment} etiquette={TD.portee.nomBatiment} aide={TD.portee.nomAide}>
                    <input
                      id={ids.nomBatiment} value={nomBatiment} maxLength={50} autoComplete="off" className={CLASSES_SAISIE}
                      aria-invalid={invalide('nomBatiment')} aria-describedby={decrire(`${ids.nomBatiment}-aide`, erreurs.nomBatiment && `${ids.nomBatiment}-erreur`)}
                      onChange={(e) => { setNomBatiment(e.target.value); effacerErreurs('nomBatiment') }}
                    />
                  </Champ>
                  {erreurChamp('nomBatiment')}
                </div>
              )}
              {avecNomEtage && (
                <div>
                  <Champ id={ids.nomEtage} etiquette={TD.portee.nomEtage} aide={TD.portee.nomAide}>
                    <input
                      id={ids.nomEtage} value={nomEtage} maxLength={50} autoComplete="off" className={CLASSES_SAISIE}
                      aria-invalid={invalide('nomEtage')} aria-describedby={decrire(`${ids.nomEtage}-aide`, erreurs.nomEtage && `${ids.nomEtage}-erreur`)}
                      onChange={(e) => { setNomEtage(e.target.value); effacerErreurs('nomEtage') }}
                    />
                  </Champ>
                  {erreurChamp('nomEtage')}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Nombre exact (D-R2), annoncé poliment : il ne change qu'à un choix, jamais à chaque frappe. */}
      <div id={ids.nombre} role="status" aria-live="polite" className="space-y-1 rounded-xl bg-[#F7F4EE] px-4 py-3 text-base text-[#0D1B2E]">
        {nombre}
      </div>

      {profil === 'super_admin' && (
        <fieldset className="space-y-3 rounded-xl border border-[#E4DDD0] p-4">
          <legend className="px-1 text-base font-semibold text-[#0D1B2E]">{TD.instruction.legende}</legend>
          <p id={ids.aideInstruction} className="text-sm text-[#4A5E78]">{TD.instruction.aide}</p>
          <div>
            <Champ id={ids.reference} etiquette={TD.instruction.reference}>
              <input
                id={ids.reference} value={reference} maxLength={200} autoComplete="off" className={CLASSES_SAISIE}
                aria-invalid={invalide('reference')} aria-describedby={decrire(ids.aideInstruction, erreurs.reference && `${ids.reference}-erreur`)}
                onChange={(e) => { setReference(e.target.value); effacerErreurs('reference') }}
              />
            </Champ>
            {erreurChamp('reference')}
          </div>
          <div>
            <Champ id={ids.date} etiquette={TD.instruction.date}>
              <input
                id={ids.date} type="date" value={dateInstruction} max={aujourdhuiParisEcranQr()} className={CLASSES_SAISIE}
                aria-invalid={invalide('date')} aria-describedby={decrire(erreurs.date && `${ids.date}-erreur`)}
                onChange={(e) => { setDateInstruction(e.target.value); effacerErreurs('date') }}
              />
            </Champ>
            {erreurChamp('date')}
          </div>
        </fieldset>
      )}

      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      {/* Droit § 5.6 : la phrase, À LA LETTRE, juste au-dessus du bouton, reliée à lui. */}
      <div className="space-y-3 border-t border-[#E4DDD0] pt-4">
        <p id={ids.phrase} className="text-base font-semibold text-[#0D1B2E]">{PHRASE_CONFORT_DIFFUSION_QR}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bouton id={ids.verifier} variante="principal" type="submit" aria-describedby={ids.phrase} disabled={occupe || zeroOuImpossible} className="flex-1">
            {TD.boutons.verifier}
          </Bouton>
          <Bouton variante="secondaire" onClick={onFermer} className="flex-1">{TD.boutons.annuler}</Bouton>
        </div>
      </div>
    </form>
  )
}

// ── Choix d'un bâtiment ou d'un étage (valeurs présentes, variantes en description, recherche au-delà de 8) ──

interface OptionValeurQr {
  cle: string
  libelle: string
  description?: string
}

function ChoixValeurQr({
  id, nom, legende, options, valeur, onChange, rechercher,
}: Readonly<{ id: string; nom: string; legende: string; options: readonly OptionValeurQr[]; valeur: string; onChange: (cle: string) => void; rechercher?: string }>) {
  const [recherche, setRecherche] = useState('')
  const motif = cleRecherche(recherche.trim())
  const visibles = motif ? options.filter((o) => o.cle === valeur || cleRecherche(`${o.libelle} ${o.description ?? ''}`).includes(motif)) : options
  return (
    <fieldset id={id} tabIndex={-1} className="space-y-2 outline-none">
      <legend className="mb-1 text-base font-semibold text-[#0D1B2E]">{legende}</legend>
      {rechercher && options.length > SEUIL_RECHERCHE && (
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label={rechercher} placeholder={rechercher} className={CLASSES_SAISIE} />
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[#E4DDD0] bg-white p-2">
        {visibles.map((o, i) => {
          const idDescription = o.description ? `${id}-description-${i}` : undefined
          return (
            <li key={o.cle}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-base text-[#0D1B2E] hover:bg-[#F7F4EE]">
                <input
                  type="radio" name={nom} value={o.cle} checked={o.cle === valeur} onChange={() => onChange(o.cle)}
                  aria-describedby={idDescription} className="h-5 w-5 shrink-0 accent-[#C9A84C]"
                />
                <span>{o.libelle}</span>
              </label>
              {o.description && <p id={idDescription} className="pl-10 text-sm text-[#4A5E78]">{o.description}</p>}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

// ── Compteur de caractères : visible à chaque frappe, annoncé après une pause (cahier § 7.6) ──

function CompteurQr({ n, max }: Readonly<{ n: number; max: number }>) {
  const texte = remplir(TD.formulaire.compteur, { n, max })
  // Rien n'est annoncé à l'ouverture (ni au retour à la valeur de départ) : seulement après une saisie, puis une pause.
  const [depart] = useState(texte)
  const [annonce, setAnnonce] = useState('')
  useEffect(() => {
    const minuteur = setTimeout(() => setAnnonce(texte), DELAI_ANNONCE_COMPTEUR_MS)
    return () => clearTimeout(minuteur)
  }, [texte])
  return (
    <p className="mt-1 text-right text-sm text-[#4A5E78]">
      <span aria-hidden="true">{texte}</span>
      <span className="sr-only" aria-live="polite">{annonce === texte && texte !== depart ? texte : ''}</span>
    </p>
  )
}
