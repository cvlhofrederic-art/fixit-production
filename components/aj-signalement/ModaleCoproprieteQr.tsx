'use client'

// ── Fenêtre « Nouvelle copropriété » / « Modifier la copropriété » ───────────────────────────────────
//
// Nom (obligatoire), adresse, e-mails destinataires (séparés par des virgules ; vides = administrateur),
// QR code actif. En modification : « Remplacer le QR code » tire un nouveau jeton après confirmation
// (l'affiche imprimée ne répond plus). Erreurs persistantes dans la fenêtre ; rien n'est fermé sur échec.
// Depuis le 11/11/2026 (SPEC § 1.8, demandes de Hugo du 10/11) : cabinet client à la création (sinon « sans cabinet »,
// l'ancienne adresse ; le rattachement d'une copropriété existante se fait depuis la vue Cabinets), code postal, ville,
// immatriculation, référence, bâtiments, gestionnaires du cabinet et « Attribuer à tous » (rappel de la règle) ;
// doublon (« Ce n'est pas un doublon, créer » / « Créer quand même »), adresse saisie hors des domaines du cabinet
// (confirmation), adresse d'un gestionnaire refusée ; suppression d'une copropriété sans signalement (nom ressaisi).
// Les champs nouveaux ne partent que remplis ou changés : sans eux, le corps est celui d'avant (la route répond 503 à un
// champ nouveau tant que la migration du 11/11/2026 manque).
// PR 3, lot 8 (décision H7 de Hugo, cahier § 7.4 ; BROUILLON pour Frédéric) : en modification d'une copropriété rattachée
// à un cabinet, date facultative « Fin de mission prévue » (à partir de ce jour, plus aucune diffusion), RELUE par la
// route des valeurs de diffusion (D-R1, finMissionLe) ; le champ n'apparaît que si elle a répondu (migration du
// 13/11/2026 appliquée) et ne part que changé (diffusionFinGestionLe, null pour l'effacer).
// Bureaux des cabinets (E5, migration 20261119 ; BROUILLON soumis avant fusion) : liste « Bureau (facultatif) » dès que
// le cabinet a un bureau ouvert (ou que la copropriété en a un) : « Aucun bureau », les bureaux ouverts, et l’actuel même
// fermé ; le bureau ne part que choisi à la création, que changé en modification (null : « Aucun bureau »). 207
// bureau_non_pose : copropriété créée sans son bureau, dit à l’appelant (avertissement). 409 bureau_ferme : réactivation
// dans un bureau fermé (la marche à suivre) ou bureau fermé entre-temps (bureaux relus). Sans bureau ouvert : aucune liste,
// aucune requête.

import { useEffect, useId, useMemo, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { ChoixGestionnairesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import ChoixBureauQr from '@/components/aj-signalement/ChoixBureauQr'
import { messageEchecCoproprieteQr, messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { useBureauxCabinetQr } from '@/components/aj-signalement/useBureauxCabinetQr'
import type { CabinetQr, CoproprieteQr, DoublonRenduQr, GestionnaireQr, GestionnaireResumeQr, SaisieGestionCoproprieteQr } from '@/lib/aj-signalement/types'
import type { BureauResumeQr } from '@/lib/aj-signalement/bureaux'
import {
  attribuerGestionnairesCoproprieteQr, chargerValeursDiffusionQr, creerCoproprieteQr, modifierCoproprieteQr, supprimerCoproprieteQr,
  type EchecQr, type ModificationCoproprieteQr,
} from '@/lib/aj-signalement/api'
import { TEXTES_TABLEAU_QR as T, analyserEmailsQr, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G, aBureauOuvertQr, gestionnairesAttribuablesQr, refusBureauARelireQr } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_ECRAN_DIFFUSION_QR as TD } from '@/lib/aj-signalement/affichage-ecran-diffusion'

export interface PropsModaleCoproprieteQr {
  /** null : création. */
  copropriete: CoproprieteQr | null
  jeton: string | null
  onFermer: () => void
  /**
   * Fiche créée ou modifiée (compteurs conservés par l'appelant). Bureaux : copropriété créée sans son bureau (207) → le
   * message à montrer, et `avertissement` vrai.
   */
  onEnregistre: (copropriete: CoproprieteQr, message?: string, avertissement?: boolean) => void
  /** Cabinets clients de l'espace ; absent : fenêtre d'avant (ni cabinet, ni gestionnaires). */
  cabinets?: readonly CabinetQr[] | null
  /** Fiches gestionnaires de l'espace (choix, adresses refusées comme destinataires). */
  gestionnaires?: readonly GestionnaireQr[] | null
  /** Copropriété supprimée (proposé seulement sans signalement). */
  onSupprimee?: (id: string) => void
  /** « Ouvrir » la copropriété semblable signalée comme doublon. */
  onOuvrir?: (id: string) => void
}

type Drapeaux = Pick<SaisieGestionCoproprieteQr, 'forcerDoublon' | 'confirmerDoublonProbable' | 'confirmerHorsDomaine'>

const listeBatiments = (texte: string): string[] => [...new Set(texte.split(',').map((b) => b.trim()).filter(Boolean))]
const memesListes = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

/** Nom, adresse et destinataires : le corps d'origine de la création comme de la modification. */
type BaseQr = { nom: string; adresse: string; emailsDestinataires: string[] }
/** Champs de la fiche (rognés) : envoyés à la création s'ils sont remplis, en modification s'ils changent. */
type ChampsFicheQr = { codePostal: string; ville: string; immatriculation: string; referenceCabinet: string }
/** Ce que la fenêtre envoie, quelle que soit l'écriture. */
type EcritureQr = { base: BaseQr; fiche: ChampsFicheQr; batiments: string[]; options: Drapeaux }
/** Rattachement d'une nouvelle copropriété à son cabinet : gestionnaires, « à tous » et bureau ('' : aucun). */
type RattachementQr = { cabinetId: string; gestionnaireIds: readonly string[]; aTous: boolean; bureauId: string }
/** Fin de mission prévue relue par D-R1 (null : champ absent) et sa saisie. */
type FinMissionQr = { lue: { initiale: string | null } | null; valeur: string }
type SaisieLueQr = { ok: true; nom: string; emails: string[] } | { ok: false; erreur: string }

/** Contrôles faits avant tout appel : nom, adresses valables, aucune adresse d'une fiche gestionnaire ajoutée (RG-06 bis-1). */
function lireSaisieQr(
  nom: string, emails: string, copropriete: CoproprieteQr | null, gestionnaires: readonly GestionnaireQr[] | null | undefined,
): SaisieLueQr {
  const f = T.formulaire
  const nomPropre = nom.trim()
  if (!nomPropre) return { ok: false, erreur: f.nomRequis }
  const analyse = analyserEmailsQr(emails)
  if (analyse.invalides.length > 0) return { ok: false, erreur: remplir(f.emailsInvalides, { liste: analyse.invalides.join(', ') }) }
  // Adresse d'une fiche gestionnaire AJOUTÉE aux destinataires (RG-06 bis-1) : refusée ici, comme par le serveur.
  const dejaSaisies = new Set(copropriete?.emailsDestinataires.map((e) => e.toLowerCase()) ?? [])
  const adressesFiches = new Set((gestionnaires ?? []).map((x) => x.email?.toLowerCase()).filter((e): e is string => !!e))
  const conflits = analyse.emails.filter((e) => adressesFiches.has(e) && !dejaSaisies.has(e))
  if (conflits.length > 0) return { ok: false, erreur: remplir(G.copropriete.adresseGestionnaire, { liste: conflits.join(', ') }) }
  return { ok: true, nom: nomPropre, emails: analyse.emails }
}

/** Corps de la création : les champs nouveaux ne partent que remplis (sans eux, le corps est celui d'avant). */
function corpsCreationQr({ base, fiche, batiments }: EcritureQr, rattachement: RattachementQr | null): Parameters<typeof creerCoproprieteQr>[0] {
  const saisie: Parameters<typeof creerCoproprieteQr>[0] = { ...base }
  for (const [cle, valeur] of Object.entries(fiche) as Array<[keyof ChampsFicheQr, string]>) if (valeur) saisie[cle] = valeur
  if (batiments.length > 0) saisie.batiments = batiments
  if (!rattachement) return saisie
  saisie.cabinetId = rattachement.cabinetId
  if (rattachement.gestionnaireIds.length > 0) saisie.gestionnaireIds = [...rattachement.gestionnaireIds]
  if (rattachement.aTous) saisie.attribueeATous = true
  // Bureaux (E5) : facultatif, envoyé seulement s'il est choisi.
  if (rattachement.bureauId) saisie.bureauId = rattachement.bureauId
  return saisie
}

const champsFicheDeQr = (c: CoproprieteQr): ChampsFicheQr => ({
  codePostal: c.codePostal, ville: c.ville, immatriculation: c.immatriculation ?? '', referenceCabinet: c.referenceCabinet ?? '',
})

/**
 * Corps de la modification : nom, adresse, destinataires et activation, puis les champs de la fiche, les bâtiments, la fin
 * de mission et le bureau seulement changés (bureau : son id, ou null pour « Aucun bureau »).
 */
function corpsModificationQr(
  copropriete: CoproprieteQr, { base, fiche, batiments }: EcritureQr, actif: boolean, finMission: FinMissionQr, bureauId: string,
): ModificationCoproprieteQr {
  const modification: ModificationCoproprieteQr = { ...base, actif }
  const avant = champsFicheDeQr(copropriete)
  for (const cle of Object.keys(fiche) as Array<keyof ChampsFicheQr>) if (fiche[cle] !== avant[cle]) modification[cle] = fiche[cle]
  if (!memesListes(batiments, copropriete.batiments)) modification.batiments = batiments
  const fin = finMission.lue
  if (fin && finMission.valeur !== (fin.initiale ?? '')) modification.diffusionFinGestionLe = finMission.valeur || null
  if (bureauId !== (copropriete.bureau?.id ?? '')) modification.bureauId = bureauId || null
  return modification
}

/** Gestionnaires ou « à tous » changés par rapport à la copropriété enregistrée. */
function attributionsChangeesQr(c: CoproprieteQr, gestionnaireIds: readonly string[], aTous: boolean): boolean {
  const anciens = c.gestionnaires.map((x) => x.id)
  return aTous !== c.attribueeATous || gestionnaireIds.length !== anciens.length || gestionnaireIds.some((id) => !anciens.includes(id))
}

// ── Bureau de la copropriété (E5, migration 20261119, super admin) ───────────────────────────────────────────────────

/** Cabinet dont les bureaux sont lus, et s'il faut les lire même sans bureau annoncé (copropriété qui en a un). */
type PorteeBureauQr = { cabinet: Pick<CabinetQr, 'id' | 'nbBureaux'>; toujours: boolean }

/**
 * Liste « Bureau » (facultative) : à la création, dès que le cabinet choisi a un bureau ouvert ; en modification, dès que
 * la copropriété a un bureau (même fermé) ou que son cabinet a un bureau ouvert. Sinon (fenêtre d'avant, sans cabinet,
 * aucun bureau ouvert) : null, aucune liste ni requête.
 */
function porteeBureauQr(
  copropriete: CoproprieteQr | null, cabinets: readonly CabinetQr[] | null | undefined, choisi: CabinetQr | null,
): PorteeBureauQr | null {
  if (cabinets === undefined) return null
  if (!copropriete) return choisi && aBureauOuvertQr(choisi) ? { cabinet: choisi, toujours: false } : null
  const id = copropriete.cabinet?.id
  if (!id) return null
  const complet = cabinets?.find((k) => k.id === id) ?? null
  if (copropriete.bureau) return { cabinet: complet ?? { id }, toujours: true }
  return complet && aBureauOuvertQr(complet) ? { cabinet: complet, toujours: false } : null
}

/** Bureaux proposés : les ouverts, et l'actuel même fermé (il reste choisi tant qu'on ne le change pas), dans l'ordre reçu. */
function bureauxProposesQr(bureaux: readonly BureauResumeQr[], actuel: BureauResumeQr | undefined): BureauResumeQr[] {
  const proposes = bureaux.filter((b) => !b.ferme || b.id === actuel?.id)
  if (actuel && !proposes.some((b) => b.id === actuel.id)) proposes.push(actuel)
  return proposes
}

/** Liste « Bureau » de la fenêtre : portée, lecture des bureaux (aucune requête sans portée), bureaux proposés et choix. */
function useBureauCoproprieteQr(copropriete: CoproprieteQr | null, cabinets: readonly CabinetQr[] | null | undefined, choisi: CabinetQr | null) {
  const portee = porteeBureauQr(copropriete, cabinets, choisi)
  const actuel = copropriete?.bureau
  const initial = actuel?.id ?? ''
  const [bureauId, setBureauId] = useState(initial)
  const { lecture, bureaux, recharger } = useBureauxCabinetQr(portee?.cabinet ?? null, { toujours: portee?.toujours === true })
  const proposes = useMemo(() => bureauxProposesQr(bureaux, actuel), [bureaux, actuel])
  return {
    visible: portee !== null,
    lecture,
    proposes,
    bureauId,
    /** Bureau à envoyer : le choix tant que la liste est montrée, sinon celui d'avant (rien ne change). */
    valeur: portee ? bureauId : initial,
    choisir: setBureauId,
    oublier: () => setBureauId(initial),
    reessayer: () => { void recharger() },
    /** Refus lié aux bureaux (fermé, disparu, réactivation impossible) : bureaux relus, choix à refaire. */
    apresRefus: () => {
      setBureauId(initial)
      void recharger()
    },
  }
}

export default function ModaleCoproprieteQr({
  copropriete, jeton, onFermer, onEnregistre, cabinets, gestionnaires, onSupprimee, onOuvrir,
}: Readonly<PropsModaleCoproprieteQr>) {
  const idBase = useId()
  const [nom, setNom] = useState(copropriete?.nom ?? '')
  const [adresse, setAdresse] = useState(copropriete?.adresse ?? '')
  const [emails, setEmails] = useState(copropriete?.emailsDestinataires.join(', ') ?? '')
  const [actif, setActif] = useState(copropriete?.actif ?? true)
  const [cabinetId, setCabinetId] = useState(copropriete?.cabinet?.id ?? '')
  const [codePostal, setCodePostal] = useState(copropriete?.codePostal ?? '')
  const [ville, setVille] = useState(copropriete?.ville ?? '')
  const [immatriculation, setImmatriculation] = useState(copropriete?.immatriculation ?? '')
  const [reference, setReference] = useState(copropriete?.referenceCabinet ?? '')
  const [batiments, setBatiments] = useState(copropriete?.batiments.join(', ') ?? '')
  const [gestionnaireIds, setGestionnaireIds] = useState<string[]>(copropriete?.gestionnaires.map((g) => g.id) ?? [])
  const [aTous, setATous] = useState(copropriete?.attribueeATous ?? false)
  const [drapeaux, setDrapeaux] = useState<Drapeaux>({})
  const [doublon, setDoublon] = useState<DoublonRenduQr | null>(null)
  const [horsDomaine, setHorsDomaine] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [confirmerRemplacement, setConfirmerRemplacement] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [nomSuppression, setNomSuppression] = useState('')
  // PR 3 (H7) : fin de mission prévue, relue par D-R1 ; null : champ absent (sans cabinet, migration absente, échec).
  const [finMissionLue, setFinMissionLue] = useState<{ initiale: string | null } | null>(null)
  const [finMission, setFinMission] = useState('')
  const f = T.formulaire
  const g = G.copropriete

  const gestionAffichee = cabinets !== undefined
  const coproprieteRattacheeId = gestionAffichee && copropriete?.cabinet ? copropriete.id : null
  useEffect(() => {
    if (!coproprieteRattacheeId) return
    let actif = true
    void chargerValeursDiffusionQr(coproprieteRattacheeId).then((r) => {
      if (!actif) return
      // Fonction pas encore activée ou refus : la fiche reste celle d'avant, sans le champ.
      if (!r.ok) {
        console.warn('[aj-signalement] fin de mission non relue', r.code)
        return
      }
      setFinMissionLue({ initiale: r.valeurs.finMissionLe })
      setFinMission(r.valeurs.finMissionLe ?? '')
    })
    return () => { actif = false }
  }, [coproprieteRattacheeId])
  const cabinetChoisi = copropriete ? null : (cabinets ?? []).find((c) => c.id === cabinetId) ?? null
  const cabinet = copropriete ? copropriete.cabinet : cabinetChoisi
  // Bureaux (E5) : liste facultative, absente tant que le cabinet n'a aucun bureau ouvert (fenêtre d'avant).
  const bureau = useBureauCoproprieteQr(copropriete, cabinets, cabinetChoisi)
  // Gestionnaires proposés : ceux du cabinet à qui l'on peut confier la copropriété, et ceux qui l'ont déjà.
  const attribuables: Array<GestionnaireResumeQr & { email?: string | null }> = gestionnairesAttribuablesQr(gestionnaires ?? [], cabinet?.id)
  for (const actuel of copropriete?.gestionnaires ?? []) if (!attribuables.some((a) => a.id === actuel.id)) attribuables.push(actuel)

  const reinitialiserAlertes = () => {
    setDoublon(null)
    setHorsDomaine(false)
  }

  /** Refus du serveur : doublon et adresse hors domaine (à confirmer), sinon le message ; bureaux relus s'ils ont changé. */
  const refuser = (r: EchecQr, envoi: { bureauEnvoye: boolean; reactivation: boolean }) => {
    if (r.code === 'doublon' && r.doublon) return setDoublon(r.doublon)
    if (r.code === 'hors_domaine') return setHorsDomaine(true)
    if (refusBureauARelireQr(r.code, envoi.bureauEnvoye)) bureau.apresRefus()
    setErreur(r.code === 'invalide' || r.code === 'serveur' ? f.erreur : messageEchecCoproprieteQr(r.code, envoi))
  }

  /** Création (POST) ; 207 bureau_non_pose : la copropriété est créée, sans son bureau, et l'écran le dit. */
  const creer = async (ecriture: EcritureQr) => {
    const rattachement = cabinetChoisi ? { cabinetId: cabinetChoisi.id, gestionnaireIds, aTous, bureauId: bureau.valeur } : null
    const r = await creerCoproprieteQr({ ...corpsCreationQr(ecriture, rattachement), ...ecriture.options }, jeton)
    setOccupe(false)
    if (!r.ok) return refuser(r, { bureauEnvoye: Boolean(rattachement?.bureauId), reactivation: false })
    if (r.bureauNonPose) onEnregistre(r.copropriete, G.bureaux.copropriete.bureauNonPose, true)
    else onEnregistre(r.copropriete)
  }

  /** Gestionnaires et « à tous » changés : par la route des attributions, après la fiche ; null (message affiché) si refusé. */
  const avecAttributions = async (existante: CoproprieteQr, enregistree: CoproprieteQr): Promise<CoproprieteQr | null> => {
    if (!existante.cabinet || !attributionsChangeesQr(existante, gestionnaireIds, aTous)) return enregistree
    const r = await attribuerGestionnairesCoproprieteQr(existante.id, { gestionnaireIds, attribueeATous: aTous })
    if (r.ok) return { ...enregistree, gestionnaires: r.gestionnaires, attribueeATous: r.attribueeATous }
    setErreur(remplir(g.attributionsNonEnregistrees, { erreur: messageEchecQr(r.code) }))
    return null
  }

  /** Modification (PATCH), puis les attributions si elles changent. */
  const modifier = async (existante: CoproprieteQr, ecriture: EcritureQr) => {
    const corps = corpsModificationQr(existante, ecriture, actif, { lue: finMissionLue, valeur: finMission }, bureau.valeur)
    const r = await modifierCoproprieteQr(existante.id, { ...corps, ...ecriture.options }, jeton)
    if (!r.ok) {
      setOccupe(false)
      return refuser(r, { bureauEnvoye: typeof corps.bureauId === 'string', reactivation: actif && !existante.actif })
    }
    const enregistree = await avecAttributions(existante, r.copropriete)
    setOccupe(false)
    if (enregistree) onEnregistre(enregistree)
  }

  const enregistrer = async (nouveaux: Drapeaux = {}) => {
    if (occupe) return
    const saisie = lireSaisieQr(nom, emails, copropriete, gestionnaires)
    if (!saisie.ok) return setErreur(saisie.erreur)
    const d: Drapeaux = { ...drapeaux, ...nouveaux }
    setDrapeaux(d)
    setErreur(null)
    reinitialiserAlertes()
    setOccupe(true)
    const ecriture: EcritureQr = {
      base: { nom: saisie.nom, adresse: adresse.trim(), emailsDestinataires: saisie.emails },
      fiche: { codePostal: codePostal.trim(), ville: ville.trim(), immatriculation: immatriculation.trim(), referenceCabinet: reference.trim() },
      batiments: listeBatiments(batiments),
      options: Object.fromEntries(Object.entries(d).filter(([, v]) => v === true)) as Drapeaux,
    }
    if (copropriete) await modifier(copropriete, ecriture)
    else await creer(ecriture)
  }

  const remplacerQr = async () => {
    if (!copropriete || occupe) return
    setErreur(null)
    setOccupe(true)
    const resultat = await modifierCoproprieteQr(copropriete.id, { regenererJeton: true }, jeton)
    setOccupe(false)
    if (!resultat.ok) {
      setErreur(messageErreurTableauQr(resultat.code))
      return
    }
    onEnregistre(resultat.copropriete, f.qrRemplace)
  }

  const supprimer = async () => {
    if (!copropriete || !onSupprimee || occupe) return
    setErreur(null)
    setOccupe(true)
    const r = await supprimerCoproprieteQr(copropriete.id, nomSuppression.trim())
    setOccupe(false)
    if (!r.ok) return setErreur(messageEchecQr(r.code))
    onSupprimee(copropriete.id)
  }

  const champTexte = (cle: string, etiquette: string, valeur: string, changer: (v: string) => void, max: number) => (
    <Champ id={`${idBase}-${cle}`} etiquette={etiquette}>
      <input id={`${idBase}-${cle}`} value={valeur} onChange={(e) => changer(e.target.value)} maxLength={max} className={CLASSES_SAISIE} />
    </Champ>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); void enregistrer() }}
      aria-busy={occupe}
    >
      <Champ id={`${idBase}-nom`} etiquette={f.nom}>
        <input id={`${idBase}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} required className={CLASSES_SAISIE} />
      </Champ>
      <Champ id={`${idBase}-adresse`} etiquette={f.adresse}>
        <input id={`${idBase}-adresse`} value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={300} className={CLASSES_SAISIE} />
      </Champ>

      {gestionAffichee && !copropriete && (cabinets ?? []).length > 0 && (
        <Champ id={`${idBase}-cabinet`} etiquette={g.cabinet}>
          <select
            id={`${idBase}-cabinet`} value={cabinetId} className={CLASSES_SAISIE}
            onChange={(e) => { setCabinetId(e.target.value); setGestionnaireIds([]); setATous(false); bureau.oublier(); reinitialiserAlertes() }}
          >
            <option value="">{g.sansCabinet}</option>
            {(cabinets ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
      )}
      {gestionAffichee && copropriete && (
        <p className="text-sm text-[#4A5E78]">{copropriete.cabinet ? remplir(g.cabinetActuel, { nom: copropriete.cabinet.nom }) : g.sansCabinetModif}</p>
      )}
      {bureau.visible && (
        <ChoixBureauQr
          id={`${idBase}-bureau`} etiquette={G.bureaux.copropriete.champ} premiere={G.bureaux.copropriete.aucun} lecture={bureau.lecture}
          bureaux={bureau.proposes} valeur={bureau.bureauId} onChange={bureau.choisir} onReessayer={bureau.reessayer} disabled={occupe}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {champTexte('cp', g.codePostal, codePostal, setCodePostal, 8)}
        {champTexte('ville', g.ville, ville, setVille, 100)}
        {champTexte('immatriculation', g.immatriculation, immatriculation, setImmatriculation, 30)}
        {champTexte('reference', g.reference, reference, setReference, 50)}
      </div>
      {champTexte('batiments', g.batiments, batiments, setBatiments, 600)}

      <Champ id={`${idBase}-emails`} etiquette={f.emails} aide={f.emailsAide}>
        <input
          id={`${idBase}-emails`}
          value={emails}
          onChange={(e) => { setEmails(e.target.value); setHorsDomaine(false) }}
          inputMode="email"
          autoComplete="off"
          aria-describedby={`${idBase}-emails-aide`}
          className={CLASSES_SAISIE}
        />
      </Champ>

      {gestionAffichee && cabinet && gestionnaires !== undefined && (
        <div className="space-y-3 rounded-xl border border-[#E4DDD0] p-4">
          <ChoixGestionnairesQr legende={g.gestionnaires} gestionnaires={attribuables} selection={gestionnaireIds} onChange={setGestionnaireIds} vide={g.aucunGestionnaire} />
          <label className="flex min-h-[44px] items-center gap-3 text-base text-[#0D1B2E]">
            <input type="checkbox" checked={aTous} onChange={(e) => setATous(e.target.checked)} className="h-5 w-5 accent-[#C9A84C]" />
            <span>{g.aTous}</span>
          </label>
          <p className="text-sm text-[#4A5E78]">{g.aTousRappel}</p>
        </div>
      )}

      {copropriete && (
        <label className="flex min-h-[44px] items-center gap-3 text-base text-[#0D1B2E]">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="h-5 w-5 accent-[#C9A84C]" />
          <span>{f.actif}</span>
        </label>
      )}
      {copropriete && finMissionLue && (
        <Champ id={`${idBase}-fin-mission`} etiquette={TD.finMission.champ} aide={TD.finMission.aide}>
          <input
            id={`${idBase}-fin-mission`} type="date" value={finMission} onChange={(e) => setFinMission(e.target.value)}
            aria-describedby={`${idBase}-fin-mission-aide`} className={CLASSES_SAISIE}
          />
        </Champ>
      )}

      {doublon && (
        <Encadre ton="avertissement">
          <p>{remplir(g.doublon, { nom: doublon.copropriete.nom, ville: doublon.copropriete.ville || '—' })}</p>
          {doublon.certitude === 'certain' && doublon.critere !== 'nom_code_postal' && <p className="mt-1">{g.doublonBloquant}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {onOuvrir && <Bouton variante="secondaire" petit icone="chevron-droite" onClick={() => onOuvrir(doublon.copropriete.id)}>{g.ouvrirDoublon}</Bouton>}
            {doublon.certitude === 'certain' && doublon.critere === 'nom_code_postal' && (
              <Bouton variante="danger" petit disabled={occupe} onClick={() => { void enregistrer({ forcerDoublon: true }) }}>{g.pasDoublon}</Bouton>
            )}
            {doublon.certitude === 'probable' && (
              <Bouton variante="danger" petit disabled={occupe} onClick={() => { void enregistrer({ confirmerDoublonProbable: true }) }}>{g.creerQuandMeme}</Bouton>
            )}
          </div>
        </Encadre>
      )}
      {horsDomaine && (
        <Encadre ton="avertissement">
          <p>{g.horsDomaine}</p>
          <div className="mt-2">
            <Bouton variante="danger" petit disabled={occupe} onClick={() => { void enregistrer({ confirmerHorsDomaine: true }) }}>{g.confirmerHorsDomaine}</Bouton>
          </div>
        </Encadre>
      )}
      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="principal" type="submit" disabled={occupe} className="flex-1">
          {copropriete ? f.enregistrer : f.creerBouton}
        </Bouton>
        <Bouton variante="secondaire" onClick={onFermer} disabled={occupe} className="flex-1">{f.annuler}</Bouton>
      </div>

      {copropriete && (
        <div className="border-t border-[#E4DDD0] pt-4">
          {confirmerRemplacement ? (
            <div className="space-y-3">
              <Encadre ton="avertissement">{f.remplacerQrAide}</Encadre>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Bouton variante="danger" disabled={occupe} onClick={() => { void remplacerQr() }} className="flex-1">{f.confirmerRemplacer}</Bouton>
                <Bouton variante="secondaire" disabled={occupe} onClick={() => setConfirmerRemplacement(false)} className="flex-1">{f.annuler}</Bouton>
              </div>
            </div>
          ) : (
            <Bouton variante="discret" petit icone="actualiser" onClick={() => setConfirmerRemplacement(true)}>{f.remplacerQr}</Bouton>
          )}
        </div>
      )}

      {copropriete && onSupprimee && copropriete.nbSignalements === 0 && (
        <div className="border-t border-[#E4DDD0] pt-4">
          {suppression ? (
            <div className="space-y-3">
              <Encadre ton="avertissement">{g.supprimerAide}</Encadre>
              <Champ id={`${idBase}-suppression`} etiquette={g.nomConfirmation}>
                <input id={`${idBase}-suppression`} value={nomSuppression} onChange={(e) => setNomSuppression(e.target.value)} autoComplete="off" className={CLASSES_SAISIE} />
              </Champ>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Bouton variante="danger" disabled={occupe || nomSuppression.trim() !== copropriete.nom} onClick={() => { void supprimer() }} className="flex-1">
                  {g.confirmerSupprimer}
                </Bouton>
                <Bouton variante="secondaire" disabled={occupe} onClick={() => { setSuppression(false); setNomSuppression('') }} className="flex-1">{f.annuler}</Bouton>
              </div>
            </div>
          ) : (
            <Bouton variante="danger" petit onClick={() => setSuppression(true)}>{g.supprimer}</Bouton>
          )}
        </div>
      )}
    </form>
  )
}
