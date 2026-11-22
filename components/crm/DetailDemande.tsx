'use client'

// ── CRM du secrétariat : détail d'une demande ───────────────────────────────
// Statut, priorité, rappel, fiche du client (modifiable), historique et notes.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Phone, X } from 'lucide-react'
import {
  PRIORITES_CRM,
  STATUTS_CRM,
  type ContactCrm,
  type DemandeCrm,
  type DetailDemandeCrm,
  type EvenementCrm,
  type LangueCrm,
  type StatutCrm,
} from '@/lib/crm/types'
import type { ModifierDemandeEntree } from '@/lib/crm/schemas'
import { formaterDateHeure, type TextesCrm } from '@/lib/crm/libelles'
import { formaterTelephone, lienAppel, lienWhatsApp } from '@/lib/crm/telephone'
import { ErreurApiCrm, apiCrm } from './api-crm'
import {
  CLASSE_BOUTON_PRINCIPAL,
  CLASSE_BOUTON_SECONDAIRE,
  CLASSE_CHAMP,
  Pastille,
  depuisChampDateHeure,
  versChampDateHeure,
} from './elements'

function texteEvenement(e: EvenementCrm, textes: TextesCrm): string {
  if (e.type === 'statut') {
    const [avant, apres] = e.contenu.split('>') as [StatutCrm, StatutCrm]
    const nom = (s: StatutCrm) => textes.statuts[s] ?? s
    return `${textes.detail.evenements.statut}${textes.deuxPoints}${nom(avant)} → ${nom(apres)}`
  }
  const libelle = textes.detail.evenements[e.type]
  return e.contenu ? `${libelle}${textes.deuxPoints}${e.contenu}` : libelle
}

const champsDeLaFiche = (contact: ContactCrm) => ({ nom: contact.nom, ville: contact.ville, email: contact.email ?? '', notes: contact.notes })

function FicheClient({ contact, textes, onModifie }: Readonly<{ contact: ContactCrm; textes: TextesCrm; onModifie: (c: ContactCrm) => void }>) {
  const t = textes.detail
  const [edition, setEdition] = useState(false)
  // Champs copiés de la fiche à l'ouverture de l'édition seulement : une relecture de la demande (statut, note) ne les
  // écrase pas pendant la saisie.
  const [champs, setChamps] = useState(() => champsDeLaFiche(contact))
  const [envoi, setEnvoi] = useState(false)

  function ouvrirEdition() {
    setChamps(champsDeLaFiche(contact))
    setEdition(true)
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault()
    setEnvoi(true)
    try {
      const { contact: maj } = await apiCrm.modifierContact(contact.id, champs)
      onModifie(maj)
      setEdition(false)
      toast.success(t.enregistre)
    } catch (e: unknown) {
      toast.error(e instanceof ErreurApiCrm && e.status === 409 ? t.numeroDejaUtilise : textes.erreurServeur)
      console.warn('[crm] modification de la fiche', e)
    } finally {
      setEnvoi(false)
    }
  }

  const whatsapp = lienWhatsApp(contact.telephone)
  const appel = lienAppel(contact.telephone)

  return (
    <section aria-label={t.client} className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{contact.nom || textes.sansNom}</p>
          <p className="text-sm text-gray-600">{formaterTelephone(contact.telephone)}</p>
          {contact.ville && <p className="text-sm text-gray-600">{contact.ville}</p>}
        </div>
        <div className="flex gap-1.5">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={CLASSE_BOUTON_SECONDAIRE} aria-label={t.ouvrirWhatsApp} title={t.ouvrirWhatsApp}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          {appel && (
            <a href={appel} className={CLASSE_BOUTON_SECONDAIRE} aria-label={t.appeler} title={t.appeler}>
              <Phone className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      {contact.notes && !edition && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{contact.notes}</p>}
      {!edition ? (
        <button type="button" onClick={ouvrirEdition} className="mt-2 text-sm text-gray-700 underline underline-offset-2">
          {t.modifierFiche}
        </button>
      ) : (
        <form onSubmit={enregistrer} className="mt-3 space-y-2">
          {(
            [
              ['nom', textes.fiche.nom, 120],
              ['ville', t.ville, 120],
              ['email', t.email, 254],
            ] as const
          ).map(([cle, libelle, max]) => (
            <div key={cle}>
              <label htmlFor={`crm-fiche-${cle}`} className="mb-1 block text-sm text-gray-600">
                {libelle}
              </label>
              <input
                id={`crm-fiche-${cle}`}
                type={cle === 'email' ? 'email' : 'text'}
                value={champs[cle]}
                maxLength={max}
                onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.value }))}
                className={CLASSE_CHAMP}
              />
            </div>
          ))}
          <div>
            <label htmlFor="crm-fiche-notes" className="mb-1 block text-sm text-gray-600">
              {t.notesClient}
            </label>
            <textarea id="crm-fiche-notes" rows={2} maxLength={4000} value={champs.notes} onChange={(e) => setChamps((c) => ({ ...c, notes: e.target.value }))} className={CLASSE_CHAMP} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className={CLASSE_BOUTON_PRINCIPAL}>
              {t.enregistrer}
            </button>
            <button type="button" onClick={() => setEdition(false)} className={CLASSE_BOUTON_SECONDAIRE}>
              {textes.fiche.annuler}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/**
 * Détail d'une demande. L'écran le monte avec `key={id}` : une autre demande = un autre composant, et la réponse
 * tardive d'une lecture précédente ne peut plus s'afficher à la place de la demande choisie (et une réponse qui ne
 * porte pas sur `id` est ignorée).
 */
export function DetailDemande({
  id,
  textes,
  langue,
  onFermer,
  onModifiee,
}: Readonly<{
  id: string
  textes: TextesCrm
  langue: LangueCrm
  onFermer: () => void
  onModifiee: (demande: DemandeCrm) => void
}>) {
  const t = textes.detail
  const [detail, setDetail] = useState<DetailDemandeCrm | null>(null)
  const [echec, setEchec] = useState(false)
  const [rappel, setRappel] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)

  /** Relit la demande ; le champ « Rappel » n'est remis à la valeur enregistrée qu'au premier chargement et après son enregistrement. */
  const charger = useCallback(
    async (majRappel: boolean) => {
      setEchec(false)
      try {
        const lu = await apiCrm.lireDemande(id)
        if (lu.demande.id !== id) return
        setDetail(lu)
        if (majRappel) setRappel(versChampDateHeure(lu.demande.rappel_le))
      } catch (e: unknown) {
        setEchec(true)
        console.warn('[crm] lecture de la demande', e)
      }
    },
    [id],
  )

  useEffect(() => {
    void charger(true)
  }, [charger])

  async function modifier(patch: ModifierDemandeEntree) {
    setEnvoi(true)
    try {
      const { demande } = await apiCrm.modifierDemande(id, patch)
      onModifiee(demande)
      await charger('rappel_le' in patch)
    } catch (e: unknown) {
      toast.error(textes.erreurServeur)
      console.warn('[crm] modification de la demande', e)
    } finally {
      setEnvoi(false)
    }
  }

  async function ajouterNote(evenement: FormEvent) {
    evenement.preventDefault()
    if (note.trim() === '') return
    setEnvoi(true)
    try {
      await apiCrm.ajouterNote(id, note.trim())
      setNote('')
      await charger(false)
    } catch (e: unknown) {
      toast.error(textes.erreurServeur)
      console.warn('[crm] note', e)
    } finally {
      setEnvoi(false)
    }
  }

  if (echec) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{textes.erreurChargement}</p>
        <button type="button" onClick={() => void charger(true)} className={CLASSE_BOUTON_SECONDAIRE}>
          {textes.reessayer}
        </button>
      </div>
    )
  }
  if (!detail) return <p className="text-sm text-gray-500">{textes.chargement}</p>

  const { demande, contact, evenements } = detail
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {textes.numero} {demande.numero} · {textes.canaux[demande.canal]} · {textes.motifs[demande.motif]} · {formaterDateHeure(demande.created_at, langue)}
          </p>
          <h2 className="break-words text-base font-semibold text-gray-900">{demande.titre}</h2>
        </div>
        <button type="button" onClick={onFermer} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label={t.fermer} title={t.fermer}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {demande.description && <p className="whitespace-pre-wrap text-sm text-gray-800">{demande.description}</p>}

      {contact ? (
        <FicheClient contact={contact} textes={textes} onModifie={(c) => setDetail((d) => (d ? { ...d, contact: c } : d))} />
      ) : (
        <p className="text-sm text-gray-500">{textes.sansContact}</p>
      )}

      <fieldset disabled={envoi}>
        <legend className="mb-1 text-sm text-gray-600">{t.statut}</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUTS_CRM.map((s) => (
            <Pastille key={s} actif={demande.statut === s} onClick={() => void modifier({ statut: s })}>
              {textes.statuts[s]}
            </Pastille>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={envoi}>
        <legend className="mb-1 text-sm text-gray-600">{t.priorite}</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITES_CRM.map((p) => (
            <Pastille key={p} actif={demande.priorite === p} onClick={() => void modifier({ priorite: p })} ton={p === 'urgente' ? 'danger' : 'neutre'}>
              {textes.priorites[p]}
            </Pastille>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="crm-detail-rappel" className="mb-1 block text-sm text-gray-600">
          {t.rappel}
        </label>
        <div className="flex flex-wrap gap-2">
          <input id="crm-detail-rappel" type="datetime-local" value={rappel} onChange={(e) => setRappel(e.target.value)} className={`${CLASSE_CHAMP} w-auto flex-1`} />
          <button type="button" disabled={envoi} onClick={() => void modifier({ rappel_le: depuisChampDateHeure(rappel) })} className={CLASSE_BOUTON_SECONDAIRE}>
            {t.enregistrerRappel}
          </button>
          {demande.rappel_le && (
            <button type="button" disabled={envoi} onClick={() => void modifier({ rappel_le: null })} className={CLASSE_BOUTON_SECONDAIRE}>
              {t.effacerRappel}
            </button>
          )}
        </div>
      </div>

      <section aria-label={t.historique}>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{t.historique}</h3>
        <ol className="space-y-2">
          {evenements.map((e) => (
            <li key={e.id} className="border-l-2 border-gray-200 pl-3 text-sm">
              <p className="whitespace-pre-wrap text-gray-800">{texteEvenement(e, textes)}</p>
              <p className="text-xs text-gray-500">
                {formaterDateHeure(e.created_at, langue)}
                {e.auteur_nom ? ` · ${e.auteur_nom}` : ''}
              </p>
            </li>
          ))}
        </ol>
        <form onSubmit={ajouterNote} className="mt-3 space-y-2">
          <label htmlFor="crm-note" className="block text-sm text-gray-600">
            {t.note}
          </label>
          <textarea id="crm-note" rows={2} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} className={CLASSE_CHAMP} />
          <button type="submit" disabled={envoi || note.trim() === ''} className={CLASSE_BOUTON_SECONDAIRE}>
            {t.ajouterNote}
          </button>
        </form>
      </section>
    </div>
  )
}
