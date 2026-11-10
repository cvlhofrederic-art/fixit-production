'use client'

// ── Application publique « AJ Signalement » ───────────────────────────────────
//
// Ce que voit la personne qui a scanné le QR code d'une copropriété : le nom de la copropriété, le
// formulaire (coordonnées obligatoires puis le parcours du portail copropriétaire), et la confirmation
// avec le numéro du signalement. Pas de compte, pas de suivi : l'administrateur recontacte le déclarant
// au téléphone ou à l'e-mail laissés. Pensée pour un téléphone (une colonne, cibles de 44 px).
// Copropriété sans adresse (demande de Hugo du 06/11/2026) : une carte « Copropriété » explique en une phrase à
// quoi sert la position, puis montre l'adresse proposée d'après elle (copropriété « à moitié identifiée ») ; refus
// ou échec n'empêchent rien. Adresse connue : elle est affichée et aucune position n'est demandée.

import { useState } from 'react'
import { dateLongue, remplir, textesCopro } from '@/lib/coproprietaire/textes'
import type { CoproprieteQrPublique, LangueSignalementQr } from '@/lib/aj-signalement/types'
import { TEXTES_SIGNALEMENT_QR, type TextesSignalementQr } from '@/lib/aj-signalement/textes'
import { Bouton, Carte, Icone } from '@/components/coproprietaire-dashboard/ui'
import FormulaireSignalementQr, { type ConfirmationSignalementQr } from '@/components/aj-signalement/FormulaireSignalementQr'
import { useAdresseProposeeQr, type AdresseProposeeEtat } from '@/components/aj-signalement/useAdresseProposeeQr'

/** Message de la carte « Copropriété » selon l'état de la géolocalisation ; '' pendant la demande au navigateur. */
function messageAdresse(a: AdresseProposeeEtat, tq: TextesSignalementQr): string {
  switch (a.etat) {
    case 'recherche':
      return tq.adresseRecherche
    case 'proposee':
      return remplir(tq.adresseProposee, { adresse: a.adresse })
    case 'refusee':
      return tq.positionRefusee
    case 'echec':
      return tq.adresseIntrouvable
    default:
      return ''
  }
}

export interface PropsAppSignalementQr {
  jeton: string
  copropriete: CoproprieteQrPublique
  langue: LangueSignalementQr
}

export default function AppSignalementQr({ jeton, copropriete, langue }: Readonly<PropsAppSignalementQr>) {
  const t = textesCopro(langue)
  const tq = TEXTES_SIGNALEMENT_QR[langue]
  const [confirmation, setConfirmation] = useState<ConfirmationSignalementQr | null>(null)
  // Incrémentée à chaque nouveau signalement : le formulaire est remonté vide.
  const [cle, setCle] = useState(0)
  // Ici et non dans le formulaire : un nouveau signalement ne redemande pas la position.
  const adresse = useAdresseProposeeQr(jeton, copropriete.adresse)

  const enHaut = () => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }
  const recommencer = () => {
    setConfirmation(null)
    setCle((c) => c + 1)
    enHaut()
  }

  return (
    <div id="aj-signalement" className="flex min-h-screen flex-col bg-[#F7F4EE] text-[#1F2D3D]">
      <header className="bg-[#0D1B2E] px-4 py-5 text-white md:py-7">
        <div className="mx-auto w-full max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]">
            <Icone nom="qr" taille={18} />
            <span>{tq.application}</span>
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-tight md:text-3xl">{copropriete.nom}</h1>
          {copropriete.adresse && <p className="mt-1 text-base text-white/80">{copropriete.adresse}</p>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:py-8">
        {confirmation ? (
          <Carte ton="vert" titre={remplir(tq.confirmationTitre, { date: dateLongue(confirmation.date, langue) })}>
            <div className="space-y-2">
              <p className="text-base font-semibold text-[#0D1B2E]">{remplir(tq.confirmationNumero, { numero: confirmation.numero })}</p>
              <p className="text-base text-[#1F2D3D]">
                {remplir(tq.confirmationSuite, { telephone: confirmation.telephone, email: confirmation.email })}
              </p>
            </div>
            <div className="mt-5">
              <Bouton variante="secondaire" icone="demandes" onClick={recommencer}>{tq.autreSignalement}</Bouton>
            </div>
          </Carte>
        ) : (
          <>
            <h2 className="font-serif text-xl text-[#0D1B2E] md:text-2xl">{tq.titre}</h2>
            <p className="mb-5 mt-2 text-base">{remplir(tq.accroche, { copropriete: copropriete.nom })}</p>
            {adresse.etat !== 'inutile' && (
              <Carte titre={tq.copropriete} className="mb-6">
                <p className="text-base font-semibold text-[#0D1B2E]">{copropriete.nom}</p>
                <p className="mt-1 text-sm text-[#4A5E78]">{tq.geolocalisationExplication}</p>
                <p aria-live="polite" className="mt-2 text-base text-[#1F2D3D]">{messageAdresse(adresse, tq)}</p>
              </Carte>
            )}
            <FormulaireSignalementQr
              key={cle}
              jeton={jeton}
              langue={langue}
              t={t}
              tq={tq}
              adresseProposee={adresse.etat === 'proposee' ? adresse.adresse : ''}
              onEnvoye={(c) => { setConfirmation(c); enHaut() }}
            />
          </>
        )}
      </main>

      <footer className="px-4 pb-8 text-center text-sm text-[#4A5E78]">{tq.piedDePage}</footer>
    </div>
  )
}
