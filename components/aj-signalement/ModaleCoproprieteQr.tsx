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

import { useEffect, useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { ChoixGestionnairesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import type { CabinetQr, CoproprieteQr, DoublonRenduQr, GestionnaireQr, GestionnaireResumeQr, SaisieGestionCoproprieteQr } from '@/lib/aj-signalement/types'
import {
  attribuerGestionnairesCoproprieteQr, chargerValeursDiffusionQr, creerCoproprieteQr, modifierCoproprieteQr, supprimerCoproprieteQr,
  type ModificationCoproprieteQr,
} from '@/lib/aj-signalement/api'
import { TEXTES_TABLEAU_QR as T, analyserEmailsQr, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { TEXTES_GESTION_QR as G, gestionnairesAttribuablesQr } from '@/lib/aj-signalement/affichage-gestion'
import { TEXTES_ECRAN_DIFFUSION_QR as TD } from '@/lib/aj-signalement/affichage-ecran-diffusion'

export interface PropsModaleCoproprieteQr {
  /** null : création. */
  copropriete: CoproprieteQr | null
  jeton: string | null
  onFermer: () => void
  /** Fiche créée ou modifiée (compteurs conservés par l'appelant). */
  onEnregistre: (copropriete: CoproprieteQr, message?: string) => void
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
  const cabinet = copropriete ? copropriete.cabinet : (cabinets ?? []).find((c) => c.id === cabinetId) ?? null
  // Gestionnaires proposés : ceux du cabinet à qui l'on peut confier la copropriété, et ceux qui l'ont déjà.
  const attribuables: Array<GestionnaireResumeQr & { email?: string | null }> = gestionnairesAttribuablesQr(gestionnaires ?? [], cabinet?.id)
  for (const actuel of copropriete?.gestionnaires ?? []) if (!attribuables.some((a) => a.id === actuel.id)) attribuables.push(actuel)

  const reinitialiserAlertes = () => {
    setDoublon(null)
    setHorsDomaine(false)
  }

  const enregistrer = async (nouveaux: Drapeaux = {}) => {
    if (occupe) return
    const nomPropre = nom.trim()
    if (!nomPropre) return setErreur(f.nomRequis)
    const analyse = analyserEmailsQr(emails)
    if (analyse.invalides.length > 0) return setErreur(remplir(f.emailsInvalides, { liste: analyse.invalides.join(', ') }))
    // Adresse d'une fiche gestionnaire AJOUTÉE aux destinataires (RG-06 bis-1) : refusée ici, comme par le serveur.
    const dejaSaisies = new Set(copropriete?.emailsDestinataires.map((e) => e.toLowerCase()) ?? [])
    const adressesFiches = new Set((gestionnaires ?? []).map((x) => x.email?.toLowerCase()).filter((e): e is string => !!e))
    const conflits = analyse.emails.filter((e) => adressesFiches.has(e) && !dejaSaisies.has(e))
    if (conflits.length > 0) return setErreur(remplir(g.adresseGestionnaire, { liste: conflits.join(', ') }))

    const d: Drapeaux = { ...drapeaux, ...nouveaux }
    setDrapeaux(d)
    setErreur(null)
    reinitialiserAlertes()
    setOccupe(true)
    const base = { nom: nomPropre, adresse: adresse.trim(), emailsDestinataires: analyse.emails }
    const fiche = { codePostal: codePostal.trim(), ville: ville.trim(), immatriculation: immatriculation.trim(), referenceCabinet: reference.trim() }
    const listeBat = listeBatiments(batiments)
    const options = Object.fromEntries(Object.entries(d).filter(([, v]) => v === true)) as Drapeaux

    let resultat
    if (!copropriete) {
      const saisie: Parameters<typeof creerCoproprieteQr>[0] = { ...base }
      if (cabinet) saisie.cabinetId = cabinet.id
      for (const [cle, valeur] of Object.entries(fiche) as Array<[keyof typeof fiche, string]>) if (valeur) saisie[cle] = valeur
      if (listeBat.length > 0) saisie.batiments = listeBat
      if (cabinet && gestionnaireIds.length > 0) saisie.gestionnaireIds = gestionnaireIds
      if (cabinet && aTous) saisie.attribueeATous = true
      resultat = await creerCoproprieteQr({ ...saisie, ...options }, jeton)
    } else {
      const modification: ModificationCoproprieteQr = { ...base, actif }
      if (fiche.codePostal !== copropriete.codePostal) modification.codePostal = fiche.codePostal
      if (fiche.ville !== copropriete.ville) modification.ville = fiche.ville
      if (fiche.immatriculation !== (copropriete.immatriculation ?? '')) modification.immatriculation = fiche.immatriculation
      if (fiche.referenceCabinet !== (copropriete.referenceCabinet ?? '')) modification.referenceCabinet = fiche.referenceCabinet
      if (!memesListes(listeBat, copropriete.batiments)) modification.batiments = listeBat
      if (finMissionLue && finMission !== (finMissionLue.initiale ?? '')) modification.diffusionFinGestionLe = finMission || null
      resultat = await modifierCoproprieteQr(copropriete.id, { ...modification, ...options }, jeton)
    }
    if (!resultat.ok) {
      setOccupe(false)
      if (resultat.code === 'doublon' && resultat.doublon) return setDoublon(resultat.doublon)
      if (resultat.code === 'hors_domaine') return setHorsDomaine(true)
      return setErreur(resultat.code === 'invalide' || resultat.code === 'serveur' ? f.erreur : messageEchecQr(resultat.code))
    }

    // Gestionnaires et « à tous » d'une copropriété existante : par la route des attributions, après la fiche.
    let enregistree = resultat.copropriete
    const anciens = copropriete?.gestionnaires.map((x) => x.id) ?? []
    const attributionsChangees = copropriete !== null && cabinet !== null
      && (aTous !== copropriete.attribueeATous || gestionnaireIds.length !== anciens.length || gestionnaireIds.some((id) => !anciens.includes(id)))
    if (copropriete && attributionsChangees) {
      const r = await attribuerGestionnairesCoproprieteQr(copropriete.id, { gestionnaireIds, attribueeATous: aTous })
      if (!r.ok) {
        setOccupe(false)
        return setErreur(remplir(g.attributionsNonEnregistrees, { erreur: messageEchecQr(r.code) }))
      }
      enregistree = { ...enregistree, gestionnaires: r.gestionnaires, attribueeATous: r.attribueeATous }
    }
    setOccupe(false)
    onEnregistre(enregistree)
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
            onChange={(e) => { setCabinetId(e.target.value); setGestionnaireIds([]); setATous(false); reinitialiserAlertes() }}
          >
            <option value="">{g.sansCabinet}</option>
            {(cabinets ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
      )}
      {gestionAffichee && copropriete && (
        <p className="text-sm text-[#4A5E78]">{copropriete.cabinet ? remplir(g.cabinetActuel, { nom: copropriete.cabinet.nom }) : g.sansCabinetModif}</p>
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
