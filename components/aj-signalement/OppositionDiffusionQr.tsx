'use client'

// ── AJ Signalement — « Ne plus envoyer d'informations à ce déclarant (à sa demande) » (PR 3, lot 8, BROUILLON) ───────
//
// Cahier PR 3 § 7.1 et route D-R7 (J31 : assister le cabinet pour les demandes des personnes) : opposition à la diffusion
// enregistrée par le cabinet à la demande ÉCRITE du déclarant, pour CETTE copropriété seulement (date de réception de la
// demande, non future, gardée en base). Geste en deux temps (avertissement, puis enregistrement ou Annuler), comme les
// gestes lourds de l'espace ; aucune adresse n'est envoyée (le serveur la lit dans le signalement). Écran en BROUILLON.

import { useId, useState } from 'react'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { opposerDeclarantDiffusionQr } from '@/lib/aj-signalement/api'
import { TEXTES_ECRAN_DIFFUSION_QR as TD, aujourdhuiParisEcranQr, dateNonFutureQr, type ProfilDiffusionQr } from '@/lib/aj-signalement/affichage-ecran-diffusion'
import { messageEchecDiffusionQr } from '@/components/aj-signalement/envoiDiffusionQr'

export default function OppositionDiffusionQr({
  coproprieteId, signalementId, profil,
}: Readonly<{ coproprieteId: string; signalementId: string; profil: ProfilDiffusionQr }>) {
  const idBase = useId()
  const t = TD.opposition
  const [ouverte, setOuverte] = useState(false)
  const [date, setDate] = useState('')
  const [erreurDate, setErreurDate] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [faite, setFaite] = useState(false)
  const idDate = `${idBase}-date`

  if (faite) return <Encadre ton="succes">{t.fait}</Encadre>
  if (!ouverte) return <Bouton variante="discret" petit onClick={() => setOuverte(true)}>{t.bouton}</Bouton>

  const enregistrer = async () => {
    if (occupe) return
    setErreur(null)
    if (!dateNonFutureQr(date)) {
      setErreurDate(true)
      document.getElementById(idDate)?.focus()
      return
    }
    setOccupe(true)
    const r = await opposerDeclarantDiffusionQr(coproprieteId, signalementId, date)
    setOccupe(false)
    if (!r.ok) return setErreur(messageEchecDiffusionQr(r.code, profil))
    setFaite(true)
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E4DDD0] p-4" aria-busy={occupe}>
      <Encadre ton="avertissement">{t.aide}</Encadre>
      <div>
        <Champ id={idDate} etiquette={t.date}>
          <input
            id={idDate} type="date" value={date} max={aujourdhuiParisEcranQr()} className={CLASSES_SAISIE}
            aria-invalid={erreurDate ? true : undefined} aria-describedby={erreurDate ? `${idDate}-erreur` : undefined}
            onChange={(e) => { setDate(e.target.value); setErreurDate(false) }}
          />
        </Champ>
        {erreurDate && <div id={`${idDate}-erreur`} className="mt-2"><Encadre ton="erreur" role="alert">{t.dateRequise}</Encadre></div>}
      </div>
      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="danger" petit disabled={occupe} onClick={() => { void enregistrer() }}>{t.confirmer}</Bouton>
        <Bouton variante="secondaire" petit disabled={occupe} onClick={() => { setOuverte(false); setErreurDate(false); setErreur(null) }}>{t.annuler}</Bouton>
      </div>
    </div>
  )
}
