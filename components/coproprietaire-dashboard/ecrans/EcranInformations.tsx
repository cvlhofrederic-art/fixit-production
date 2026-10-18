'use client'

// ── Mes informations ──────────────────────────────────────────────────────────
//
// Le lot tel que le syndic le connaît, les coordonnées (lecture seule : seul le syndic
// corrige), les coordonnées du syndic, le choix de la langue et la déconnexion.
// Pas de modification de profil, pas d'interrupteurs de notification.

import { useCallback, useState } from 'react'
import type { LotCopro, SyndicCopro } from '@/lib/coproprietaire/types'
import { pourcentage, remplir, type LangueCopro } from '@/lib/coproprietaire/textes'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { Bouton, Carte, Encadre, Ligne, Modale } from '@/components/coproprietaire-dashboard/ui'
import { seDeconnecter } from '@/lib/coproprietaire/etat'

/** Libellés propres à cet écran, FR / PT. */
const LIBELLES_LOCAUX: Record<LangueCopro, { autresLots: string; adresse: string }> = {
  fr: { autresLots: 'Vos autres lots', adresse: 'Adresse' },
  pt: { autresLots: 'As suas outras frações', adresse: 'Morada' },
}

/** « bâtiment D · étage 4 · lot 12 », sans les parties vides. */
function situationLot(lot: Pick<LotCopro, 'batiment' | 'etage' | 'numLot'>, t: PropsEcran['t']): string {
  return [
    lot.batiment ? `${t.commun.batiment} ${lot.batiment}` : '',
    lot.etage ? `${t.commun.etage} ${lot.etage}` : '',
    lot.numLot ? `${t.commun.lot} ${lot.numLot}` : '',
  ].filter(Boolean).join(' · ')
}

/** « 45 avenue du Prado, 13008 Marseille ». */
function adressePostale(s: Pick<SyndicCopro, 'adresse' | 'codePostal' | 'ville'>): string {
  const ville = [s.codePostal, s.ville].filter(Boolean).join(' ')
  return [s.adresse, ville].filter(Boolean).join(', ')
}

/** Lien tel: sans espaces ni ponctuation. */
function lienTelephone(telephone: string): string {
  return `tel:${telephone.replace(/[\s.()-]/g, '')}`
}

function changerLangue(langue: LangueCopro): void {
  document.cookie = `locale=${langue}; path=/; max-age=31536000; SameSite=Lax`
  // Le portail est servi sous un préfixe de langue : on ouvre l'adresse de la langue cible (ancre conservée).
  window.location.assign(`/${langue}/coproprietaire/dashboard/${window.location.hash}`)
}

/** Retire la parenthèse finale « (…) » d'un libellé — sans expression régulière, donc sans retour arrière. */
function sansParentheseFinale(libelle: string): string {
  const propre = libelle.trimEnd()
  if (!propre.endsWith(')')) return libelle
  const debut = propre.lastIndexOf('(')
  return debut < 0 ? libelle : propre.slice(0, debut).trimEnd()
}


export default function EcranInformations({ espace, t, langue, allerA }: PropsEcran) {
  const { profil, autresLots, immeuble, syndic } = espace
  const locataire = profil.role === 'locataire'
  const local = LIBELLES_LOCAUX[langue]
  const [confirmation, setConfirmation] = useState(false)
  const fermerConfirmation = useCallback(() => setConfirmation(false), [])

  const tantiemesTexte = (() => {
    if (locataire || profil.tantiemes <= 0) return ''
    if (profil.quotePart > 0) {
      return remplir(t.informations.tantiemes, { tantiemes: profil.tantiemes, pourcentage: pourcentage(profil.quotePart, langue) })
    }
    // Sans quote-part connue : le libellé sans sa parenthèse « (… des charges) ».
    return remplir(sansParentheseFinale(t.informations.tantiemes), { tantiemes: profil.tantiemes })
  })()

  const adresseImmeuble = adressePostale(immeuble)
  const syndicConnu = Boolean(syndic.nom || syndic.telephone || syndic.email || syndic.adresse)
  const adresseSyndic = adressePostale(syndic)

  return (
    <div className="space-y-4">
      <Carte titre={locataire ? t.informations.votreLogement : t.informations.votreLot}>
        <p className="text-lg font-bold text-[#0D1B2E]">{profil.immeuble}</p>
        {adresseImmeuble && <p className="text-sm text-[#4A5E78]">{adresseImmeuble}</p>}
        <p className="mt-2 text-base text-[#1F2D3D]">{situationLot(profil, t)}</p>
        {tantiemesTexte && <p className="mt-2 text-base text-[#1F2D3D]">{tantiemesTexte}</p>}

        {autresLots.length > 0 && (
          <div className="mt-5 border-t border-[#E4DDD0] pt-4">
            <h3 className="text-base font-semibold text-[#0D1B2E]">{local.autresLots}</h3>
            <ul className="mt-2 space-y-2">
              {autresLots.map(lot => (
                <li key={lot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4DDD0] bg-[#FBF9F4] px-4 py-3">
                  <span className="text-base text-[#1F2D3D]">
                    <span className="font-semibold text-[#0D1B2E]">{lot.immeuble}</span>
                    {situationLot(lot, t) && <span> · {situationLot(lot, t)}</span>}
                  </span>
                  <Bouton variante="secondaire" petit icone="immeuble" onClick={() => allerA('informations', `lot:${lot.id}`)}>
                    {t.informations.changerLot}
                  </Bouton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Carte>

      {locataire && <Encadre ton="info">{t.informations.locataireNote}</Encadre>}

      <Carte titre={t.informations.coordonnees}>
        <dl>
          <Ligne etiquette={t.informations.nom}>{`${profil.prenom} ${profil.nom}`.trim() || t.informations.nonRenseigne}</Ligne>
          <Ligne etiquette={t.informations.email}>{profil.email || t.informations.nonRenseigne}</Ligne>
          <Ligne etiquette={t.informations.telephone}>{profil.telephone || t.informations.nonRenseigne}</Ligne>
        </dl>
        <p className="mt-3 text-sm text-[#4A5E78]">{t.informations.inexact}</p>
      </Carte>

      <Carte titre={t.informations.votreSyndic}>
        {syndicConnu ? (
          <div className="space-y-3">
            {syndic.nom && <p className="text-lg font-bold text-[#0D1B2E]">{syndic.nom}</p>}
            {immeuble.gestionnaire && (
              <p className="text-base text-[#1F2D3D]">{remplir(t.informations.gestionnaire, { nom: immeuble.gestionnaire })}</p>
            )}
            {(syndic.telephone || syndic.email) && (
              <div className="flex flex-wrap gap-2">
                {syndic.telephone && (
                  <Bouton variante="secondaire" icone="telephone" href={lienTelephone(syndic.telephone)}>{syndic.telephone}</Bouton>
                )}
                {syndic.email && (
                  <Bouton variante="secondaire" icone="mail" href={`mailto:${syndic.email}`}>{syndic.email}</Bouton>
                )}
              </div>
            )}
            {adresseSyndic && (
              <dl>
                <Ligne etiquette={local.adresse}>{adresseSyndic}</Ligne>
              </dl>
            )}
          </div>
        ) : (
          <p className="text-base text-[#4A5E78]">{t.informations.syndicInconnu}</p>
        )}
      </Carte>

      <Carte titre={t.informations.langue}>
        <div className="flex flex-wrap gap-2">
          <Bouton variante={langue === 'fr' ? 'principal' : 'secondaire'} aria-pressed={langue === 'fr'} onClick={() => changerLangue('fr')}>
            {t.informations.francais}
          </Bouton>
          <Bouton variante={langue === 'pt' ? 'principal' : 'secondaire'} aria-pressed={langue === 'pt'} onClick={() => changerLangue('pt')}>
            {t.informations.portugais}
          </Bouton>
        </div>
      </Carte>

      <Bouton variante="danger" pleineLargeur icone="deconnexion" onClick={() => setConfirmation(true)}>
        {t.informations.meDeconnecter}
      </Bouton>

      {confirmation && (
        <Modale titre={t.informations.confirmationDeconnexion} onFermer={fermerConfirmation} labelFermer={t.commun.fermer}>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Bouton variante="secondaire" onClick={fermerConfirmation}>{t.informations.rester}</Bouton>
            <Bouton variante="danger" icone="deconnexion" onClick={() => { void seDeconnecter() }}>{t.informations.meDeconnecter}</Bouton>
          </div>
        </Modale>
      )}
    </div>
  )
}
