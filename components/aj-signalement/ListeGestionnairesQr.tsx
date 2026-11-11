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

import { useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Champ, CLASSES_SAISIE, Encadre, EtatVide, Modale } from '@/components/coproprietaire-dashboard/ui'
import { ChoixCoproprietesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import {
  creerGestionnaireQr, modifierGestionnaireQr, ouvrirAccesGestionnaireQr, ouvrirAccesGroupeQr, renvoyerConfirmationQr, type CodeErreurQr,
  type ResultatCreationGestionnaireQr,
} from '@/lib/aj-signalement/api'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import {
  LIBELLE_ETAT_GESTIONNAIRE_QR as ETAT, TEXTES_GESTION_QR as G, TON_ETAT_GESTIONNAIRE_QR as TON, actionAccesGestionnaireQr, dateParisQr,
  fichesAccesOuvrablesQr,
} from '@/lib/aj-signalement/affichage-gestion'
import { emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { CabinetQr, CoproprieteQr, GestionnaireQr } from '@/lib/aj-signalement/types'

export interface PropsListeGestionnairesQr {
  /** null : chargement en cours. */
  gestionnaires: readonly GestionnaireQr[] | null
  cabinets: readonly CabinetQr[] | null
  erreur: CodeErreurQr | null
  coproprietes: readonly CoproprieteQr[]
  onOuvrir: (id: string) => void
  /** Une fiche a changé : l'espace recharge les fiches et le tableau. */
  onModifie: () => void
  onReessayer: () => void
  /** Vers la vue Cabinets (domaines à renseigner). */
  onCabinets: () => void
}

/** Confirmation à (re)envoyer : en attente ou expirée. */
const confirmationEnAttente = (g: GestionnaireQr): boolean => g.etat === 'confirmation_envoyee' || g.etat === 'confirmation_expiree'

/** Fiches par appel de l'action groupée (accesGroupeQrSchema : 50 au plus). */
const LOT_ACCES_QR = 50

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

  if (erreur) {
    return (
      <div className="space-y-4">
        <Encadre ton="erreur">{messageErreurTableauQr(erreur)}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton>
      </div>
    )
  }
  if (gestionnaires === null) return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>

  const visibles = filtreCabinet ? gestionnaires.filter((g) => g.cabinet.id === filtreCabinet) : gestionnaires
  const ouvrables = fichesAccesOuvrablesQr(visibles)

  const agir = async (g: GestionnaireQr, action: 'renvoyer' | 'reactiver' | 'acces') => {
    if (occupe) return
    setMessages([])
    setErreurAction(null)
    setOccupe(g.id)
    if (action === 'acces') {
      const r = await ouvrirAccesGestionnaireQr(g.id)
      setOccupe(null)
      if (!r.ok) return setErreurAction(messageEchecQr(r.code))
      setMessages([r.emailEnvoye ? remplir(G.acces.envoye, { email: g.email ?? '' }) : G.acces.nonParti])
    } else if (action === 'renvoyer') {
      const r = await renvoyerConfirmationQr(g.id)
      setOccupe(null)
      if (!r.ok) return setErreurAction(messageEchecQr(r.code))
      setMessages([r.emailEnvoye ? remplir(G.gestionnaires.renvoye, { email: g.email ?? '' }) : G.gestionnaires.renvoiSansEmail])
    } else {
      const r = await modifierGestionnaireQr(g.id, { actif: true })
      setOccupe(null)
      if (!r.ok) return setErreurAction(messageEchecQr(r.code))
      setMessages([G.gestionnaires.reactive])
    }
    onModifie()
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
        setOccupe(null)
        setErreurAction(messageEchecQr(r.code))
        if (envoyes > 0) onModifie()
        return
      }
      envoyes += r.envoyes
      echecs.push(...r.echecs.map((e) => e.id))
    }
    setOccupe(null)
    const noms = echecs.map((id) => gestionnaires.find((g) => g.id === id)?.nom ?? G.fiche.ancien)
    setMessages([remplir(G.acces.groupeEnvoye, { n: envoyes }), ...(noms.length > 0 ? [remplir(G.acces.groupeEchecs, { noms: noms.join(', ') })] : [])])
    onModifie()
  }

  const creee = (r: Extract<ResultatCreationGestionnaireQr, { ok: true }>) => {
    setCreation(false)
    setMessages([
      r.emailEnvoye ? remplir(G.gestionnaires.cree, { email: r.gestionnaire.email ?? '' }) : G.gestionnaires.creeSansEmail,
      ...(r.coproprietesAvecAdresseSaisie > 0 ? [remplir(G.gestionnaires.dejaDestinataire, { n: r.coproprietesAvecAdresseSaisie })] : []),
    ])
    onModifie()
  }

  return (
    <div className="space-y-6">
      <p className="text-base text-[#1F2D3D]">{G.gestionnaires.intro}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {cabinets && cabinets.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-[#4A5E78]" htmlFor={`${idBase}-cabinet`}>
            <span>{G.gestionnaires.filtreCabinet}</span>
            <select
              id={`${idBase}-cabinet`} value={filtreCabinet} onChange={(e) => setFiltreCabinet(e.target.value)}
              className="min-h-[44px] rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E]"
            >
              <option value="">{G.gestionnaires.tousCabinets}</option>
              {cabinets.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
        ) : <span />}
        <div className="flex flex-wrap gap-2">
          {ouvrables.length > 0 && (
            <Bouton variante="secondaire" icone="envoyer" disabled={occupe !== null} onClick={() => setConfirmerGroupe(true)}>
              {remplir(G.acces.groupe, { n: ouvrables.length })}
            </Bouton>
          )}
          <Bouton variante="or" icone="plus" disabled={!cabinets} onClick={() => { setMessages([]); setCreation(true) }}>{G.gestionnaires.ajouter}</Bouton>
        </div>
      </div>
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
      {messages.length > 0 && <Encadre ton="succes">{messages.map((m) => <p key={m}>{m}</p>)}</Encadre>}
      {erreurAction && <Encadre ton="erreur">{erreurAction}</Encadre>}

      {visibles.length === 0 ? <EtatVide texte={G.gestionnaires.aucun} icone="assemblees" /> : (
        <ul className="space-y-3" aria-label={G.gestionnaires.liste}>
          {visibles.map((g) => (
            <li key={g.id} className="rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[#0D1B2E]">{g.nom ?? G.fiche.ancien}</h3>
                    <Badge ton={TON[g.etat]}>{ETAT[g.etat]}</Badge>
                    {g.domaineForce && <Badge ton="ambre">{G.gestionnaires.domaineForce}</Badge>}
                    {g.effacementDemandeLe && <Badge ton="ambre">{remplir(G.acces.effacementDemandeLe, { date: dateParisQr(g.effacementDemandeLe) })}</Badge>}
                  </div>
                  {g.email && <p className="break-all text-sm text-[#1F2D3D]">{g.email}</p>}
                  <p className="text-sm text-[#4A5E78]">{remplir(G.gestionnaires.compteurs, { copros: g.coproprietes, ouverts: g.ouverts, urgents: g.urgents })}</p>
                  <p className="text-sm text-[#4A5E78]">
                    {g.cabinet.nom} · {remplir(G.gestionnaires.ajouteLe, { date: dateParisQr(g.creeLe) })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Bouton variante="secondaire" petit icone="chevron-droite" onClick={() => onOuvrir(g.id)}>{G.gestionnaires.ouvrir}</Bouton>
                  {confirmationEnAttente(g) && (
                    <Bouton variante="discret" petit icone="envoyer" disabled={occupe !== null} onClick={() => { void agir(g, 'renvoyer') }}>{G.gestionnaires.renvoyer}</Bouton>
                  )}
                  {g.etat === 'desactive' && g.nom !== null && (
                    <Bouton variante="discret" petit icone="actualiser" disabled={occupe !== null} onClick={() => { void agir(g, 'reactiver') }}>{G.gestionnaires.reactiver}</Bouton>
                  )}
                  {actionAccesGestionnaireQr(g) && (
                    <Bouton variante="discret" petit icone="cadenas" disabled={occupe !== null} onClick={() => { void agir(g, 'acces') }}>
                      {actionAccesGestionnaireQr(g) === 'renvoyer' ? G.acces.renvoyer : G.acces.ouvrir}
                    </Bouton>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creation && cabinets && (
        <Modale titre={G.gestionnaires.titreCreation} onFermer={() => setCreation(false)} labelFermer={G.fermer}>
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

// ── Fenêtre « Ajouter un gestionnaire » ───────────────────────────────────────

interface PropsFormulaire {
  cabinets: readonly CabinetQr[]
  coproprietes: readonly CoproprieteQr[]
  onFermer: () => void
  onCree: (resultat: Extract<ResultatCreationGestionnaireQr, { ok: true }>) => void
  onOuvrir: (id: string) => void
  onCabinets: () => void
}

const FORMAT_EMAIL_QR = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const envoyer = async (forcerDomaine: boolean) => {
    if (occupe) return
    const nomPropre = nom.trim()
    const emailPropre = email.trim().toLowerCase()
    setFicheExistante(null)
    if (!nomPropre) return setErreur(G.gestionnaires.nomRequis)
    if (!FORMAT_EMAIL_QR.test(emailPropre)) return setErreur(G.gestionnaires.emailInvalide)
    if (!cabinet) return setErreur(G.gestionnaires.cabinetRequis)
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
    })
    setOccupe(false)
    if (r.ok) return onCree(r)
    if (r.code === 'hors_domaine') return setHorsDomaine(true)
    if (r.code === 'domaine_autre_cabinet') setHorsDomaine(false)
    if (r.code === 'existe_deja' && r.id) setFicheExistante(r.id)
    setErreur(messageEchecQr(r.code))
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
        <select
          id={`${idBase}-cabinet`} value={cabinetId} className={CLASSES_SAISIE}
          onChange={(e) => { setCabinetId(e.target.value); setSelection([]); setHorsDomaine(false) }}
        >
          {cabinets.length !== 1 && <option value="">{G.gestionnaires.choisirCabinet}</option>}
          {cabinets.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </Champ>

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
        <Bouton variante="principal" type="submit" icone="envoyer" disabled={occupe || sansDomaine || horsDomaine} className="flex-1">{G.gestionnaires.creer}</Bouton>
        <Bouton variante="secondaire" onClick={onFermer} disabled={occupe} className="flex-1">{G.annuler}</Bouton>
      </div>
    </form>
  )
}
