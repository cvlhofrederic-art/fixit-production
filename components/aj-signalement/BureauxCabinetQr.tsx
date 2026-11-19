'use client'

// ── Bureaux d'un cabinet client : fenêtre de la vue « Cabinets » (super admin ; écran E1 du plan des bureaux) ────────
//
// Accord du 17/11/2026 sur les cinq choix de la note des bureaux : bureaux tenus par le super admin seul, aucune adresse
// de contact par bureau en V1, visibilité inchangée (le bureau classe et filtre). BROUILLON soumis avant fusion :
// composants et couleurs de l'espace (Badge, Bouton, Champ, Encadre), aucune nouvelle charte.
//   - liste (GET /cabinets/[id]/bureaux, triée par le serveur) : nom, ouvert ou fermé, gestionnaires actifs et
//     copropriétés actives rattachés ; « Renommer » (champ dans la ligne), « Fermer » ou « Rouvrir » (sans confirmation :
//     réversible, et refusé tant qu'un rattachement actif reste, 409 bureau_utilise) ;
//   - « Ajouter un bureau » (POST, nom rogné, 1 à 80 caractères) ;
//   - après chaque action : liste des bureaux ET liste des cabinets (compteur « Bureaux (n) » de la carte) relues avant
//     l'annonce ; la fenêtre reste occupée jusque-là (aucun second envoi) ;
//   - refus en clair (nom_pris, plafond_bureaux, bureau_utilise ; a_reverifier ou bureau disparu : les listes sont relues) ;
//   - migration 20261119 absente (503 base_absente) : « fonction pas encore disponible », rien d'autre.
// Focus (règle « Tab piégé » des fenêtres, comme LogoCabinetQr) : après chaque action, le message (annoncé) ; « Renommer »
// → le champ du nouveau nom ; « Annuler » ou nom inchangé → « Renommer ». Jamais sur le fond de la page.

import { useEffect, useId, useRef, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecBureauQr } from '@/components/aj-signalement/messageEchecQr'
import { useBureauxCabinetQr } from '@/components/aj-signalement/useBureauxCabinetQr'
import { creerBureauQr, modifierBureauQr, type ResultatBureauQr } from '@/lib/aj-signalement/api'
import { TEXTES_GESTION_QR as G, compteursBureauQr, messageErreurBureauQr } from '@/lib/aj-signalement/affichage-gestion'
import { NOM_BUREAU_MAX_QR, type BureauQr } from '@/lib/aj-signalement/bureaux'
import type { CabinetQr } from '@/lib/aj-signalement/types'

const B = G.bureaux.fenetre

export interface PropsBureauxCabinetQr {
  cabinet: Pick<CabinetQr, 'id' | 'nom'>
  onFermer: () => void
  /**
   * Une action a été faite, ou les bureaux ont changé entre-temps : l'espace relit la liste des cabinets (compteur de la
   * carte). `message` : l'action faite, gardée dans la vue. Tenue une fois la liste relue (la fenêtre reste occupée).
   */
  onModifie: (message?: string) => Promise<void>
}

type Annonce = { ton: 'succes' | 'erreur'; texte: string }
type Fait = Extract<ResultatBureauQr, { ok: true }>

/** Annonce d'une fermeture ou d'une réouverture faite. */
function texteBascule(r: Fait): string {
  if (!r.modifie) return B.inchange
  return remplir(r.bureau.ferme ? B.fermeFait : B.rouvert, { nom: r.bureau.nom })
}

export default function BureauxCabinetQr({ cabinet, onFermer, onModifie }: Readonly<PropsBureauxCabinetQr>) {
  const idBase = useId()
  const { lecture, recharger } = useBureauxCabinetQr(cabinet, { toujours: true })
  const [nom, setNom] = useState('')
  // Bureau en cours de renommage et nom saisi.
  const [renommage, setRenommage] = useState<{ id: string; nom: string } | null>(null)
  // 'ajout', ou l'id du bureau modifié : tout est désactivé jusqu'aux listes relues.
  const [occupe, setOccupe] = useState<string | null>(null)
  const [annonce, setAnnonce] = useState<Annonce | null>(null)
  // Élément à focaliser au rendu suivant : le message, le champ du nouveau nom, « Renommer ».
  const focusApres = useRef<string | null>(null)
  const idMessage = `${idBase}-message`
  const idNom = `${idBase}-nom`
  const idRenommer = (id: string) => `${idBase}-renommer-${id}`
  const idNouveauNom = `${idBase}-nouveau-nom`

  useEffect(() => {
    const cible = focusApres.current
    if (!cible) return
    focusApres.current = null
    document.getElementById(cible)?.focus()
  })

  const annoncer = (a: Annonce) => {
    focusApres.current = idMessage
    setAnnonce(a)
  }

  /**
   * Fin d'une action : faite → listes des bureaux et des cabinets relues, puis l'annonce ; refusée → le message (données
   * changées ou bureau disparu : listes relues d'abord). Vrai si l'action est faite.
   */
  const conclure = async (r: ResultatBureauQr, texteFait: (fait: Fait) => string): Promise<boolean> => {
    if (r.ok) {
      const texte = texteFait(r)
      await Promise.all([recharger(), onModifie(texte)])
      annoncer({ ton: 'succes', texte })
      return true
    }
    if (r.code === 'a_reverifier' || r.code === 'introuvable') await Promise.all([recharger(), onModifie()])
    annoncer({ ton: 'erreur', texte: messageEchecBureauQr(r.code) })
    return false
  }

  const ajouter = async () => {
    if (occupe) return
    const propre = nom.trim()
    if (!propre) return annoncer({ ton: 'erreur', texte: B.nomRequis })
    setOccupe('ajout')
    setAnnonce(null)
    const fait = await conclure(await creerBureauQr(cabinet.id, propre), (r) => remplir(B.ajoute, { nom: r.bureau.nom }))
    if (fait) setNom('')
    setOccupe(null)
  }

  const commencerRenommage = (b: BureauQr) => {
    focusApres.current = idNouveauNom
    setAnnonce(null)
    setRenommage({ id: b.id, nom: b.nom })
  }

  const annulerRenommage = (b: BureauQr) => {
    focusApres.current = idRenommer(b.id)
    setRenommage(null)
  }

  const renommer = async (b: BureauQr) => {
    if (occupe || renommage?.id !== b.id) return
    const propre = renommage.nom.trim()
    if (!propre) return annoncer({ ton: 'erreur', texte: B.nomRequis })
    if (propre === b.nom) return annulerRenommage(b)
    setOccupe(b.id)
    setAnnonce(null)
    const fait = await conclure(await modifierBureauQr(b.id, { nom: propre }), (r) => (r.modifie ? remplir(B.renomme, { nom: r.bureau.nom }) : B.inchange))
    if (fait) setRenommage(null)
    setOccupe(null)
  }

  const basculer = async (b: BureauQr) => {
    if (occupe) return
    setOccupe(b.id)
    setAnnonce(null)
    setRenommage(null)
    await conclure(await modifierBureauQr(b.id, { fermer: !b.ferme }), texteBascule)
    setOccupe(null)
  }

  if (lecture.etat === 'chargement') return <p role="status" className="text-base text-[#4A5E78]">{B.chargement}</p>
  if (lecture.etat === 'indisponible') {
    return (
      <div className="space-y-4">
        <Encadre ton="avertissement">{G.bureaux.indisponible}</Encadre>
        <Bouton variante="secondaire" onClick={onFermer}>{B.fermerFenetre}</Bouton>
      </div>
    )
  }

  const libre = occupe === null
  return (
    <div className="space-y-4" aria-busy={!libre}>
      <p className="text-base text-[#1F2D3D]">{B.intro}</p>
      {annonce && <div id={idMessage} tabIndex={-1} className="outline-none"><Encadre ton={annonce.ton}>{annonce.texte}</Encadre></div>}
      {lecture.etat === 'erreur' ? (
        <div className="space-y-3">
          <Encadre ton="erreur">{messageErreurBureauQr(lecture.code, true)}</Encadre>
          <Bouton variante="principal" icone="actualiser" onClick={() => { void recharger() }}>{G.reessayer}</Bouton>
        </div>
      ) : (
        <>
          <ListeBureauxQr
            bureaux={lecture.bureaux} renommage={renommage} libre={libre} idRenommer={idRenommer} idNouveauNom={idNouveauNom}
            onRenommer={commencerRenommage} onAnnuler={annulerRenommage} onBasculer={(b) => { void basculer(b) }}
            onEnregistrer={(b) => { void renommer(b) }} onSaisie={(saisie) => setRenommage((r) => (r ? { ...r, nom: saisie } : r))}
          />
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void ajouter() }}>
            <Champ id={idNom} etiquette={B.nom} aide={B.nomAide}>
              <input
                id={idNom} value={nom} maxLength={NOM_BUREAU_MAX_QR} autoComplete="off" aria-describedby={`${idNom}-aide`}
                onChange={(e) => setNom(e.target.value)} className={CLASSES_SAISIE}
              />
            </Champ>
            <Bouton variante="or" icone="plus" type="submit" disabled={!libre}>{occupe === 'ajout' ? B.ajout : B.ajouter}</Bouton>
          </form>
        </>
      )}
    </div>
  )
}

// ── Liste des bureaux ─────────────────────────────────────────────────────────

interface PropsListe {
  bureaux: readonly BureauQr[]
  renommage: { id: string; nom: string } | null
  /** Faux pendant une action : tous les boutons sont désactivés. */
  libre: boolean
  idRenommer: (id: string) => string
  idNouveauNom: string
  onRenommer: (b: BureauQr) => void
  onSaisie: (nom: string) => void
  onEnregistrer: (b: BureauQr) => void
  onAnnuler: (b: BureauQr) => void
  onBasculer: (b: BureauQr) => void
}

const CLASSES_LIGNE = 'rounded-2xl border border-[#E4DDD0] bg-white px-5 py-4 shadow-sm'

function ListeBureauxQr({ bureaux, renommage, ...ligne }: Readonly<PropsListe>) {
  if (bureaux.length === 0) return <p className="text-base text-[#4A5E78]">{B.aucun}</p>
  return (
    <ul className="space-y-3" aria-label={B.liste}>
      {bureaux.map((b) => (
        <li key={b.id} className={CLASSES_LIGNE}>
          {renommage?.id === b.id
            ? <RenommageBureauQr bureau={b} saisie={renommage.nom} {...ligne} />
            : <LigneBureauQr bureau={b} {...ligne} />}
        </li>
      ))}
    </ul>
  )
}

type PropsLigne = Readonly<Omit<PropsListe, 'bureaux' | 'renommage'> & { bureau: BureauQr }>

function LigneBureauQr({ bureau: b, libre, idRenommer, onRenommer, onBasculer }: PropsLigne) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-[#0D1B2E]">{b.nom}</h3>
          <Badge ton={b.ferme ? 'gris' : 'vert'}>{b.ferme ? B.ferme : B.ouvert}</Badge>
        </div>
        <p className="text-sm text-[#4A5E78]">{compteursBureauQr(b)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton
          id={idRenommer(b.id)} variante="secondaire" petit disabled={!libre} aria-label={remplir(B.renommerNomme, { nom: b.nom })}
          onClick={() => onRenommer(b)}
        >{B.renommer}</Bouton>
        <Bouton
          variante="secondaire" petit disabled={!libre} aria-label={remplir(b.ferme ? B.rouvrirNomme : B.fermerNomme, { nom: b.nom })}
          onClick={() => onBasculer(b)}
        >{b.ferme ? B.rouvrir : B.fermer}</Bouton>
      </div>
    </div>
  )
}

function RenommageBureauQr({ bureau: b, saisie, libre, idNouveauNom, onSaisie, onEnregistrer, onAnnuler }: PropsLigne & Readonly<{ saisie: string }>) {
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onEnregistrer(b) }}>
      <Champ id={idNouveauNom} etiquette={remplir(B.nouveauNom, { nom: b.nom })}>
        <input
          id={idNouveauNom} value={saisie} maxLength={NOM_BUREAU_MAX_QR} autoComplete="off" onChange={(e) => onSaisie(e.target.value)}
          className={CLASSES_SAISIE}
        />
      </Champ>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="principal" type="submit" disabled={!libre} className="flex-1">{G.enregistrer}</Bouton>
        <Bouton variante="secondaire" disabled={!libre} className="flex-1" onClick={() => onAnnuler(b)}>{G.annuler}</Bouton>
      </div>
    </form>
  )
}
