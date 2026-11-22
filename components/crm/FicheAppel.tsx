'use client'

// ── CRM du secrétariat : fiche « Appel en cours » ───────────────────────────
// Saisie d'une demande pendant l'appel : le numéro retrouve la fiche du client (ou annonce un nouveau client), puis
// canal, motif, sujet, description et rappel. Le bouton WhatsApp ouvre la conversation du numéro.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MessageCircle, PhoneIncoming } from 'lucide-react'
import { CANAUX_CRM, MOTIFS_CRM, type CanalCrm, type ContactTrouveCrm, type DemandeCrm, type MotifCrm } from '@/lib/crm/types'
import type { TextesCrm } from '@/lib/crm/libelles'
import { lienWhatsApp, normaliserTelephone } from '@/lib/crm/telephone'
import { apiCrm } from './api-crm'
import { CLASSE_BOUTON_PRINCIPAL, CLASSE_BOUTON_SECONDAIRE, CLASSE_CHAMP, Pastille, depuisChampDateHeure } from './elements'

type EtatNumero = 'vide' | 'invalide' | 'recherche' | 'connu' | 'nouveau'

const ATTENTE_RECHERCHE_MS = 400

export function FicheAppel({
  textes,
  signalNouvelAppel,
  onCreee,
}: Readonly<{
  textes: TextesCrm
  /** Change à chaque clic sur « Nouvel appel » : la fiche se vide et le curseur va dans le numéro. */
  signalNouvelAppel: number
  onCreee: (demande: DemandeCrm) => void
}>) {
  const t = textes.fiche
  const champNumero = useRef<HTMLInputElement>(null)
  const [telephone, setTelephone] = useState('')
  const [etatNumero, setEtatNumero] = useState<EtatNumero>('vide')
  const [trouve, setTrouve] = useState<ContactTrouveCrm | null>(null)
  const [nom, setNom] = useState('')
  const [canal, setCanal] = useState<CanalCrm>('appel')
  const [motif, setMotif] = useState<MotifCrm | null>(null)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [rappel, setRappel] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const e164 = normaliserTelephone(telephone)

  function vider() {
    setTelephone('')
    setEtatNumero('vide')
    setTrouve(null)
    setNom('')
    setCanal('appel')
    setMotif(null)
    setTitre('')
    setDescription('')
    setRappel('')
    setErreur(null)
  }

  useEffect(() => {
    if (signalNouvelAppel === 0) return
    vider()
    champNumero.current?.focus()
  }, [signalNouvelAppel])

  // Fiche du client retrouvée par son numéro, une fois la saisie arrêtée.
  useEffect(() => {
    if (telephone.trim() === '') {
      setEtatNumero('vide')
      setTrouve(null)
      return
    }
    if (!e164) {
      setEtatNumero('invalide')
      setTrouve(null)
      return
    }
    // La fiche affichée est celle de l'ancien numéro tant que la recherche du nouveau n'a pas répondu : on l'oublie
    // tout de suite, sinon une validation rapide rattacherait la demande au mauvais client.
    let actif = true
    setTrouve(null)
    setEtatNumero('recherche')
    const minuteur = setTimeout(() => {
      apiCrm
        .contactParTelephone(e164)
        .then((r) => {
          if (!actif) return
          setTrouve(r.trouve)
          setEtatNumero(r.trouve ? 'connu' : 'nouveau')
        })
        .catch((e: unknown) => {
          if (!actif) return
          setTrouve(null)
          setEtatNumero('nouveau')
          toast.error(t.rechercheImpossible)
          console.warn('[crm] recherche du numéro', e)
        })
    }, ATTENTE_RECHERCHE_MS)
    return () => {
      actif = false
      clearTimeout(minuteur)
    }
  }, [telephone, e164, t.rechercheImpossible])

  async function creer(evenement: FormEvent) {
    evenement.preventDefault()
    if (etatNumero === 'invalide') return setErreur(t.numeroInvalide)
    if (!motif) return setErreur(t.motifManquant)
    if (titre.trim() === '' && description.trim() === '') return setErreur(t.saisieIncomplete)
    setErreur(null)
    setEnvoi(true)
    // Fiche choisie seulement si c'est bien celle du numéro saisi ; sinon le serveur la retrouve (ou la crée) par numéro.
    const ficheDuNumero = trouve && e164 !== null && trouve.contact.telephone === e164 ? trouve.contact.id : null
    try {
      const { demande } = await apiCrm.creerDemande({
        ...(ficheDuNumero ? { contact_id: ficheDuNumero } : { telephone: e164 ?? '', nom: nom.trim() }),
        titre: titre.trim(),
        description: description.trim(),
        motif,
        canal,
        rappel_le: depuisChampDateHeure(rappel),
      })
      toast.success(t.creee(demande.numero))
      vider()
      onCreee(demande)
    } catch (e: unknown) {
      toast.error(textes.erreurServeur)
      console.warn('[crm] création de la demande', e)
    } finally {
      setEnvoi(false)
    }
  }

  const whatsapp = lienWhatsApp(e164)

  return (
    <form onSubmit={creer} className="space-y-4" noValidate>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <PhoneIncoming className="h-4 w-4" aria-hidden="true" />
        {t.titre}
      </h2>

      <div>
        <label htmlFor="crm-numero" className="mb-1 block text-sm text-gray-600">
          {t.numero}
        </label>
        <input
          id="crm-numero"
          ref={champNumero}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="+351 912 345 678"
          className={CLASSE_CHAMP}
          aria-describedby="crm-numero-etat"
        />
        <div id="crm-numero-etat" aria-live="polite" className="mt-1.5 text-sm">
          {etatNumero === 'invalide' && <p className="text-red-700">{t.numeroInvalide}</p>}
          {etatNumero === 'connu' && trouve && (
            <p className="rounded-md bg-green-50 px-2 py-1 text-green-800">{t.clientConnu(trouve.contact.nom, trouve.nbDemandes)}</p>
          )}
          {etatNumero === 'nouveau' && <p className="text-gray-600">{t.nouveauClient}</p>}
        </div>
      </div>

      {etatNumero !== 'connu' && (
        <div>
          <label htmlFor="crm-nom" className="mb-1 block text-sm text-gray-600">
            {t.nom}
          </label>
          <input id="crm-nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} className={CLASSE_CHAMP} />
        </div>
      )}

      <fieldset>
        <legend className="mb-1 text-sm text-gray-600">{t.canal}</legend>
        <div className="flex flex-wrap gap-1.5">
          {CANAUX_CRM.map((c) => (
            <Pastille key={c} actif={canal === c} onClick={() => setCanal(c)}>
              {textes.canaux[c]}
            </Pastille>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm text-gray-600">{t.motif}</legend>
        <div className="flex flex-wrap gap-1.5">
          {MOTIFS_CRM.map((m) => (
            <Pastille key={m} actif={motif === m} onClick={() => setMotif(m)} ton={m === 'urgence' ? 'danger' : 'neutre'}>
              {textes.motifs[m]}
            </Pastille>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="crm-sujet" className="mb-1 block text-sm text-gray-600">
          {t.sujet}
        </label>
        <input id="crm-sujet" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={160} className={CLASSE_CHAMP} aria-describedby="crm-sujet-aide" />
        <p id="crm-sujet-aide" className="mt-1 text-xs text-gray-500">
          {t.sujetAide}
        </p>
      </div>

      <div>
        <label htmlFor="crm-description" className="mb-1 block text-sm text-gray-600">
          {t.description}
        </label>
        <textarea id="crm-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} className={CLASSE_CHAMP} />
      </div>

      <div>
        <label htmlFor="crm-rappel" className="mb-1 block text-sm text-gray-600">
          {t.rappel}
        </label>
        <input id="crm-rappel" type="datetime-local" value={rappel} onChange={(e) => setRappel(e.target.value)} className={CLASSE_CHAMP} />
      </div>

      {erreur && (
        <p role="alert" className="text-sm text-red-700">
          {erreur}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={envoi} className={`${CLASSE_BOUTON_PRINCIPAL} flex-1`}>
          {t.creer}
        </button>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={CLASSE_BOUTON_SECONDAIRE} aria-label={textes.detail.ouvrirWhatsApp} title={textes.detail.ouvrirWhatsApp}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </form>
  )
}
