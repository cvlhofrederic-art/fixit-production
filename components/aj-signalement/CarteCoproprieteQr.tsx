'use client'

// ── Carte d'une copropriété : QR code, lien, destinataires, affiche PDF, QR PNG ─────────────────────
//
// Le QR code encode le lien public de la copropriété (origine du site courant). Les fichiers sont
// préparés dans le navigateur à partir de la matrice du QR code (lib/aj-signalement/qr) : affiche A4 à
// poser sur place, ou QR seul pour une mise en page maison.

import { useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Badge, Bouton, BoutonCopier, Carte, Encadre } from '@/components/coproprietaire-dashboard/ui'
import QrCodeSvg from '@/components/aj-signalement/QrCodeSvg'
import { urlSignalementQr, type CoproprieteQr } from '@/lib/aj-signalement/types'
import { TEXTES_TABLEAU_QR as T, destinatairesAffichesQr, resumeCompteursQr } from '@/lib/aj-signalement/affichage'
import { affichePdfQr, nomFichierQr, pngQr, telechargerFichier, type MatriceQr } from '@/lib/aj-signalement/qr'

export interface PropsCarteCoproprieteQr {
  copropriete: CoproprieteQr
  /** Origine des liens encodés (« https://vitfix.io »). */
  origine: string
  onModifier: () => void
}

export default function CarteCoproprieteQr({ copropriete, origine, onModifier }: Readonly<PropsCarteCoproprieteQr>) {
  const [matrice, setMatrice] = useState<MatriceQr | null>(null)
  const [preparation, setPreparation] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const url = urlSignalementQr(copropriete.jeton, origine)

  const telechargerPng = () => {
    if (!matrice) return
    const png = pngQr(matrice, 24, 4)
    if (!png) {
      setErreur(T.erreurFichier)
      return
    }
    telechargerFichier(`qr-${nomFichierQr(copropriete.nom)}.png`, png)
  }

  const telechargerPdf = async () => {
    if (!matrice || preparation) return
    setPreparation(true)
    setErreur(null)
    try {
      const pdf = await affichePdfQr({ nom: copropriete.nom, adresse: copropriete.adresse, url, matrice })
      telechargerFichier(`affiche-qr-${nomFichierQr(copropriete.nom)}.pdf`, pdf)
    } catch (e) {
      console.warn('[aj-signalement] affiche non préparée', e)
      setErreur(T.erreurFichier)
    } finally {
      setPreparation(false)
    }
  }

  return (
    <Carte
      titre={copropriete.nom}
      sousTitre={copropriete.adresse || T.sansAdresse}
      actions={copropriete.actif ? undefined : <Badge ton="gris">{T.qrDesactive}</Badge>}
      ton={copropriete.actif ? 'neutre' : 'gris'}
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="shrink-0 self-center rounded-xl border border-[#E4DDD0] bg-white p-2 sm:self-start">
          <QrCodeSvg texte={url} libelle={remplir(T.libelleQr, { nom: copropriete.nom })} taille={176} onMatrice={setMatrice} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-[#4A5E78]">{T.lien}</p>
            <p className="break-all text-base text-[#0D1B2E]">{url}</p>
            <div className="mt-2">
              <BoutonCopier texte={url} libelle={T.copierLien} libelleCopie={T.lienCopie} />
            </div>
          </div>
          <p className="text-sm text-[#4A5E78]">
            <span className="font-semibold">{T.destinataires}</span> {destinatairesAffichesQr(copropriete)}
          </p>
          <p className="text-sm text-[#4A5E78]">{resumeCompteursQr(copropriete)}</p>
          {erreur && <Encadre ton="erreur">{erreur}</Encadre>}
          <div className="flex flex-wrap gap-2">
            <Bouton variante="principal" icone="documents" petit disabled={!matrice || preparation} onClick={() => { void telechargerPdf() }}>
              {preparation ? T.preparation : T.affichePdf}
            </Bouton>
            <Bouton variante="secondaire" icone="qr" petit disabled={!matrice} onClick={telechargerPng}>{T.qrPng}</Bouton>
            <Bouton variante="secondaire" icone="outil" petit onClick={onModifier}>{T.modifier}</Bouton>
          </div>
        </div>
      </div>
    </Carte>
  )
}
