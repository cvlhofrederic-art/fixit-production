'use client'

// ── Vue « Cabinets » de l'espace AJ Signalement (super admin) ────────────────────────────────────────────────────
//
// Demandes de Hugo du 10/11/2026 : le premier cabinet client n'est qu'un client parmi d'autres (d'autres domaines
// viendront) et chaque client a son adresse, vitfix.io/<identifiant>/… Chaque cabinet est une ligne saisie ici (jamais dans le
// code) : nom, identifiant du chemin (proposé depuis le nom, aperçu de l'adresse, réservés refusés ; figé dès qu'il a
// une copropriété ou un gestionnaire), langue de la page de signalement, domaines e-mail des gestionnaires (messageries
// publiques refusées). Rattachement DÉFINITIF des copropriétés sans cabinet (avertissement d'abord ; doublon avec le
// cabinet : la copropriété semblable, puis « Ce n'est pas un doublon » ou « Rattacher quand même »). Lien vers le Journal,
// absent de la barre du bas du téléphone.

import { useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Carte, Champ, CLASSES_SAISIE, Encadre, EtatVide, Modale } from '@/components/coproprietaire-dashboard/ui'
import { ChoixCoproprietesQr } from '@/components/aj-signalement/ChoixMultipleQr'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { creerCabinetQr, modifierCabinetQr, rattacherCoproprietesQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import { TEXTES_GESTION_QR as G, analyserDomainesQr, apercuCheminCabinetQr } from '@/lib/aj-signalement/affichage-gestion'
import { messageErreurTableauQr } from '@/lib/aj-signalement/affichage'
import { proposerIdentifiantCabinetQr, validerIdentifiantCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import {
  LANGUES_CABINET_QR, type CabinetQr, type CoproprieteQr, type DoublonRenduQr, type LangueCabinetQr, type SaisieCabinetQr,
} from '@/lib/aj-signalement/types'

const DOMAINES_MAX_QR = 20

export interface PropsCabinetsQr {
  /** null : chargement en cours. */
  cabinets: readonly CabinetQr[] | null
  erreur: CodeErreurQr | null
  coproprietes: readonly CoproprieteQr[]
  /** Un cabinet ou un rattachement a changé : l'espace recharge cabinets, fiches et tableau. */
  onModifie: () => void
  onReessayer: () => void
  onJournal: () => void
}

type Fenetre = { type: 'creation' } | { type: 'modification'; cabinet: CabinetQr } | null

export default function CabinetsQr({ cabinets, erreur, coproprietes, onModifie, onReessayer, onJournal }: Readonly<PropsCabinetsQr>) {
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [messages, setMessages] = useState<string[]>([])
  const fermer = () => setFenetre(null)
  const ouvrir = (f: Exclude<Fenetre, null>) => {
    setMessages([])
    setFenetre(f)
  }

  if (erreur) {
    return (
      <div className="space-y-4">
        <Encadre ton="erreur">{messageErreurTableauQr(erreur)}</Encadre>
        <Bouton variante="principal" icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton>
      </div>
    )
  }
  if (cabinets === null) return <p role="status" className="py-10 text-center text-base text-[#4A5E78]">{G.chargement}</p>

  const sansCabinet = coproprietes.filter((c) => c.cabinet === null)
  return (
    <div className="space-y-6">
      <Carte ton="or"><p className="text-base text-[#1F2D3D]">{G.cabinets.intro}</p></Carte>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Bouton variante="discret" icone="horloge" onClick={onJournal}>{G.cabinets.voirJournal}</Bouton>
        <Bouton variante="or" icone="plus" onClick={() => ouvrir({ type: 'creation' })}>{G.cabinets.nouveau}</Bouton>
      </div>
      {messages.length > 0 && <Encadre ton="succes">{messages.map((m) => <p key={m}>{m}</p>)}</Encadre>}

      {cabinets.length === 0 ? <EtatVide texte={G.cabinets.aucun} icone="documents" /> : (
        <div className="grid gap-4">
          {cabinets.map((c) => (
            <Carte
              key={c.id}
              titre={c.nom}
              sousTitre={remplir(G.cabinets.adresse, { identifiant: c.identifiant })}
              actions={(
                <>
                  {c.identifiantFige && <Badge ton="gris">{G.cabinets.fige}</Badge>}
                  <Bouton variante="secondaire" petit icone="outil" onClick={() => ouvrir({ type: 'modification', cabinet: c })}>{G.cabinets.modifier}</Bouton>
                </>
              )}
            >
              <div className="space-y-1 text-sm text-[#4A5E78]">
                <p>{remplir(G.cabinets.langueLigne, { langue: G.cabinets.langues[c.langue] ?? c.langue })}</p>
                <p>{remplir(G.cabinets.domainesLigne, { domaines: c.domaines.length > 0 ? c.domaines.join(', ') : G.cabinets.aucunDomaine })}</p>
                <p>{remplir(G.cabinets.compteurs, { copros: c.nbCoproprietes, gestionnaires: c.nbGestionnaires })}</p>
              </div>
            </Carte>
          ))}
        </div>
      )}

      {sansCabinet.length > 0 && cabinets.length > 0 && (
        <RattachementQr
          cabinets={cabinets}
          coproprietes={sansCabinet}
          onFait={(n) => {
            setMessages([remplir(G.cabinets.rattachees, { n })])
            onModifie()
          }}
        />
      )}

      {fenetre && (
        <Modale titre={fenetre.type === 'creation' ? G.cabinets.titreCreation : G.cabinets.titreModification} onFermer={fermer} labelFermer={G.fermer}>
          <FormulaireCabinetQr
            cabinet={fenetre.type === 'modification' ? fenetre.cabinet : null}
            onFermer={fermer}
            onEnregistre={(textes) => {
              setFenetre(null)
              setMessages(textes)
              onModifie()
            }}
          />
        </Modale>
      )}
    </div>
  )
}

// ── Fenêtre de création / modification ───────────────────────────────────────

interface PropsFormulaire {
  /** null : création. */
  cabinet: CabinetQr | null
  onFermer: () => void
  onEnregistre: (messages: string[]) => void
}

const memesDomaines = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((d, i) => d === b[i])

function FormulaireCabinetQr({ cabinet, onFermer, onEnregistre }: Readonly<PropsFormulaire>) {
  const idBase = useId()
  const [nom, setNom] = useState(cabinet?.nom ?? '')
  const [identifiant, setIdentifiant] = useState(cabinet?.identifiant ?? '')
  // L'identifiant suit le nom tant qu'il n'a pas été saisi à la main (création seulement).
  const [identifiantSaisi, setIdentifiantSaisi] = useState(cabinet !== null)
  const [langue, setLangue] = useState<LangueCabinetQr>(cabinet?.langue ?? 'fr')
  const [domaines, setDomaines] = useState(cabinet?.domaines.join(', ') ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const fige = cabinet?.identifiantFige === true
  const identifiantPropre = identifiant.trim().toLowerCase()

  const changerNom = (valeur: string) => {
    setNom(valeur)
    if (!identifiantSaisi) setIdentifiant(proposerIdentifiantCabinetQr(valeur))
  }

  const enregistrer = async () => {
    if (occupe) return
    const nomPropre = nom.trim()
    if (!nomPropre) return setErreur(G.cabinets.nomRequis)
    if (!fige) {
      const v = validerIdentifiantCabinetQr(identifiantPropre)
      if (!v.ok) return setErreur(v.raison === 'reserve' ? G.cabinets.identifiantReserve : G.cabinets.identifiantFormat)
    }
    const analyse = analyserDomainesQr(domaines)
    if (analyse.invalides.length > 0) return setErreur(remplir(G.cabinets.domainesInvalides, { liste: analyse.invalides.join(', ') }))
    if (analyse.domaines.length > DOMAINES_MAX_QR) return setErreur(G.cabinets.domainesTrop)

    let modification: Partial<SaisieCabinetQr> | null = null
    if (cabinet) {
      modification = {}
      if (nomPropre !== cabinet.nom) modification.nom = nomPropre
      if (!fige && identifiantPropre !== cabinet.identifiant) modification.identifiant = identifiantPropre
      if (langue !== cabinet.langue) modification.langue = langue
      if (!memesDomaines(analyse.domaines, cabinet.domaines)) modification.domaines = analyse.domaines
      if (Object.keys(modification).length === 0) return onFermer()
    }

    setErreur(null)
    setOccupe(true)
    const r = cabinet && modification
      ? await modifierCabinetQr(cabinet.id, modification)
      : await creerCabinetQr({ nom: nomPropre, identifiant: identifiantPropre, langue, domaines: analyse.domaines })
    setOccupe(false)
    if (!r.ok) return setErreur(messageEchecQr(r.code))
    const horsDomaines = r.fichesHorsDomaines.map((f) => f.nom ?? G.fiche.ancien)
    onEnregistre([
      cabinet ? G.cabinets.modifie : G.cabinets.cree,
      ...(horsDomaines.length > 0 ? [remplir(G.cabinets.fichesHorsDomaines, { noms: horsDomaines.join(', ') })] : []),
    ])
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enregistrer() }} aria-busy={occupe}>
      <Champ id={`${idBase}-nom`} etiquette={G.cabinets.nom}>
        <input id={`${idBase}-nom`} value={nom} onChange={(e) => changerNom(e.target.value)} maxLength={200} required className={CLASSES_SAISIE} />
      </Champ>
      <Champ
        id={`${idBase}-identifiant`}
        etiquette={G.cabinets.identifiant}
        aide={fige ? G.cabinets.identifiantFige : remplir(G.cabinets.identifiantAide, { apercu: apercuCheminCabinetQr(identifiantPropre) })}
      >
        <input
          id={`${idBase}-identifiant`} value={identifiant} disabled={fige} maxLength={40} autoComplete="off" spellCheck={false}
          aria-describedby={`${idBase}-identifiant-aide`}
          onChange={(e) => { setIdentifiantSaisi(true); setIdentifiant(e.target.value) }}
          className={`${CLASSES_SAISIE} disabled:bg-[#F7F4EE] disabled:text-[#4A5E78]`}
        />
      </Champ>
      <Champ id={`${idBase}-langue`} etiquette={G.cabinets.langue}>
        <select id={`${idBase}-langue`} value={langue} onChange={(e) => setLangue(e.target.value === 'pt' ? 'pt' : 'fr')} className={CLASSES_SAISIE}>
          {LANGUES_CABINET_QR.map((l) => <option key={l} value={l}>{G.cabinets.langues[l]}</option>)}
        </select>
      </Champ>
      <Champ id={`${idBase}-domaines`} etiquette={G.cabinets.domaines} aide={G.cabinets.domainesAide}>
        <input
          id={`${idBase}-domaines`} value={domaines} onChange={(e) => setDomaines(e.target.value)} autoComplete="off" spellCheck={false}
          aria-describedby={`${idBase}-domaines-aide`} className={CLASSES_SAISIE}
        />
      </Champ>

      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="principal" type="submit" disabled={occupe} className="flex-1">{cabinet ? G.enregistrer : G.cabinets.creer}</Bouton>
        <Bouton variante="secondaire" onClick={onFermer} disabled={occupe} className="flex-1">{G.annuler}</Bouton>
      </div>
    </form>
  )
}

// ── Rattachement des copropriétés sans cabinet ───────────────────────────────

interface PropsRattachement {
  cabinets: readonly CabinetQr[]
  coproprietes: readonly CoproprieteQr[]
  onFait: (rattachees: number) => void
}

function RattachementQr({ cabinets, coproprietes, onFait }: Readonly<PropsRattachement>) {
  const idBase = useId()
  const [selection, setSelection] = useState<string[]>([])
  const [cabinetId, setCabinetId] = useState('')
  const [confirmer, setConfirmer] = useState(false)
  const [doublon, setDoublon] = useState<DoublonRenduQr | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const cible = cabinets.find((c) => c.id === cabinetId) ?? null
  const changer = () => { setConfirmer(false); setDoublon(null) }

  const demander = () => {
    if (selection.length === 0 || !cible) return setErreur(G.cabinets.choisirAuMoinsUne)
    setErreur(null)
    setDoublon(null)
    setConfirmer(true)
  }

  const rattacher = async (drapeaux: { forcerDoublon?: true; confirmerDoublonProbable?: true } = {}) => {
    if (!cible || occupe) return
    setOccupe(true)
    const r = await rattacherCoproprietesQr(cible.id, selection, fetch, drapeaux)
    setOccupe(false)
    setConfirmer(false)
    if (!r.ok) {
      // Doublon avec une copropriété du cabinet (RG-08) : la montrer, et le choix possible (relecture 9).
      if (r.code === 'doublon' && r.doublon) {
        setErreur(null)
        return setDoublon(r.doublon)
      }
      setDoublon(null)
      return setErreur(messageEchecQr(r.code))
    }
    setSelection([])
    setDoublon(null)
    onFait(r.rattachees)
  }

  return (
    <Carte titre={remplir(G.cabinets.sansCabinet, { n: coproprietes.length })} sousTitre={G.cabinets.sansCabinetAide}>
      <div className="space-y-4">
        <ChoixCoproprietesQr
          legende={G.cabinets.choisirCopros} coproprietes={coproprietes} selection={selection}
          onChange={(ids) => { setSelection(ids); changer() }}
        />
        <Champ id={`${idBase}-cabinet`} etiquette={G.cabinets.rattacherA}>
          <select id={`${idBase}-cabinet`} value={cabinetId} onChange={(e) => { setCabinetId(e.target.value); changer() }} className={CLASSES_SAISIE}>
            <option value="">{G.cabinets.choisirCabinet}</option>
            {cabinets.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Champ>
        {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
        {doublon && (
          <Encadre ton="avertissement">
            <p>{remplir(G.copropriete.doublon, { nom: doublon.copropriete.nom, ville: doublon.copropriete.ville || '—' })}</p>
            {doublon.certitude === 'certain' && doublon.critere !== 'nom_code_postal' && <p className="mt-1">{G.copropriete.doublonBloquant}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {doublon.certitude === 'certain' && doublon.critere === 'nom_code_postal' && (
                <Bouton variante="danger" petit disabled={occupe} onClick={() => { void rattacher({ forcerDoublon: true }) }}>{G.cabinets.pasDoublonRattacher}</Bouton>
              )}
              {doublon.certitude === 'probable' && (
                <Bouton variante="danger" petit disabled={occupe} onClick={() => { void rattacher({ confirmerDoublonProbable: true }) }}>{G.cabinets.rattacherQuandMeme}</Bouton>
              )}
            </div>
          </Encadre>
        )}
        {confirmer && cible ? (
          <div className="space-y-3">
            <Encadre ton="avertissement">{remplir(G.cabinets.rattachementAvertissement, { identifiant: cible.identifiant })}</Encadre>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Bouton variante="danger" disabled={occupe} className="flex-1" onClick={() => { void rattacher() }}>{G.cabinets.confirmerRattachement}</Bouton>
              <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={() => setConfirmer(false)}>{G.annuler}</Bouton>
            </div>
          </div>
        ) : (
          <Bouton variante="principal" icone="immeuble" onClick={demander}>{G.cabinets.rattacher}</Bouton>
        )}
      </div>
    </Carte>
  )
}
