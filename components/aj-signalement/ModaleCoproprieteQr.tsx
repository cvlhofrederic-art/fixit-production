'use client'

// ── Fenêtre « Nouvelle copropriété » / « Modifier la copropriété » ───────────────────────────────────
//
// Nom (obligatoire), adresse, e-mails destinataires (séparés par des virgules ; vides = administrateur),
// QR code actif. En modification : « Remplacer le QR code » tire un nouveau jeton après confirmation
// (l'affiche imprimée ne répond plus). Erreurs persistantes dans la fenêtre ; rien n'est fermé sur échec.

import { useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import type { CoproprieteQr } from '@/lib/aj-signalement/types'
import { creerCoproprieteQr, modifierCoproprieteQr } from '@/lib/aj-signalement/api'
import { TEXTES_TABLEAU_QR as T, analyserEmailsQr, messageErreurTableauQr } from '@/lib/aj-signalement/affichage'

export interface PropsModaleCoproprieteQr {
  /** null : création. */
  copropriete: CoproprieteQr | null
  jeton: string | null
  onFermer: () => void
  /** Fiche créée ou modifiée (compteurs conservés par l'appelant). */
  onEnregistre: (copropriete: CoproprieteQr, message?: string) => void
}

export default function ModaleCoproprieteQr({ copropriete, jeton, onFermer, onEnregistre }: Readonly<PropsModaleCoproprieteQr>) {
  const idBase = useId()
  const [nom, setNom] = useState(copropriete?.nom ?? '')
  const [adresse, setAdresse] = useState(copropriete?.adresse ?? '')
  const [emails, setEmails] = useState(copropriete?.emailsDestinataires.join(', ') ?? '')
  const [actif, setActif] = useState(copropriete?.actif ?? true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [confirmerRemplacement, setConfirmerRemplacement] = useState(false)
  const f = T.formulaire

  const enregistrer = async () => {
    if (occupe) return
    const nomPropre = nom.trim()
    if (!nomPropre) {
      setErreur(f.nomRequis)
      return
    }
    const analyse = analyserEmailsQr(emails)
    if (analyse.invalides.length > 0) {
      setErreur(remplir(f.emailsInvalides, { liste: analyse.invalides.join(', ') }))
      return
    }
    setErreur(null)
    setOccupe(true)
    const saisie = { nom: nomPropre, adresse: adresse.trim(), emailsDestinataires: analyse.emails }
    const resultat = copropriete
      ? await modifierCoproprieteQr(copropriete.id, { ...saisie, actif }, jeton)
      : await creerCoproprieteQr(saisie, jeton)
    setOccupe(false)
    if (!resultat.ok) {
      setErreur(resultat.code === 'invalide' || resultat.code === 'serveur' ? f.erreur : messageErreurTableauQr(resultat.code))
      return
    }
    onEnregistre(resultat.copropriete)
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
      <Champ id={`${idBase}-emails`} etiquette={f.emails} aide={f.emailsAide}>
        <input
          id={`${idBase}-emails`}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          inputMode="email"
          autoComplete="off"
          aria-describedby={`${idBase}-emails-aide`}
          className={CLASSES_SAISIE}
        />
      </Champ>
      {copropriete && (
        <label className="flex min-h-[44px] items-center gap-3 text-base text-[#0D1B2E]">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="h-5 w-5 accent-[#C9A84C]" />
          <span>{f.actif}</span>
        </label>
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
    </form>
  )
}
